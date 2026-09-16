import { COLORS } from "@/themes/colors";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, WebViewNavigation } from "react-native-webview";

// Shared in-app Paystack checkout used by BOTH payment flows (deposits and
// subscriptions). The checkout lives inside this app (not in a Chrome Custom
// Tab) so it survives the user backgrounding the app to pay with a bank
// transfer (Opay etc.) - the OS can reclaim custom-tab activities but not a
// WebView running in this app's own process.

// Paystack redirects the customer to the transaction callback URL after a
// successful payment. Our cancel_action mirrors that URL with a marker so we
// can tell "cancelled from the checkout" apart from "paid".
const CALLBACK_MARKER = "/dashboard/wallet/deposit/callback";
const CANCEL_MARKER = "status=cancelled";

// window.close() does not work inside a WebView, so Paystack redirects here
// when a page wants to close itself (e.g. after a 3DS authorisation ends).
const PAYSTACK_CLOSE_URL = "https://standard.paystack.co/close";

export const isTerminalRedirect = (url: string) =>
  url.includes(CALLBACK_MARKER) || url.startsWith(PAYSTACK_CLOSE_URL);

export const isCancelledRedirect = (url: string) => url.includes(CANCEL_MARKER);

type PaystackWebViewProps = {
  /** Authorization URL of the checkout to render. */
  checkoutUrl: string;
  /**
   * Manual close (X button / Android back). `terminalHandled` is true when a
   * terminal redirect already fired for this checkout, so callers can skip a
   * duplicate verification.
   */
  onClose: (options: { terminalHandled: boolean }) => void;
  /**
   * Fired exactly once per checkout when the WebView hits a terminal redirect
   * (callback URL or close sentinel). Callers close their checkout state and
   * decide whether to verify.
   */
  onTerminalRedirect: (url: string) => void;
};

export function PaystackWebView({
  checkoutUrl,
  onClose,
  onTerminalRedirect,
}: PaystackWebViewProps) {
  const insets = useSafeAreaInsets();
  const webviewRef = useRef<WebView>(null);
  // Guards against handling the same redirect twice (onShouldStartLoadWithRequest
  // and onNavigationStateChange can both fire for the same navigation).
  const handledRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  // Reset per-checkout state whenever a (new) checkout URL is presented.
  useEffect(() => {
    handledRef.current = false;
    setIsLoading(true);
    setLoadFailed(false);
  }, [checkoutUrl]);

  const handleTerminalRedirect = useCallback(
    (url: string) => {
      if (!url || handledRef.current) return;
      if (!isTerminalRedirect(url)) return;

      handledRef.current = true;
      onTerminalRedirect(url);
    },
    [onTerminalRedirect]
  );

  // ShouldStartLoadRequest extends WebViewNavigation; the narrower type is
  // not re-exported by react-native-webview's entry point.
  const handleShouldStart = useCallback(
    (request: WebViewNavigation) => {
      handleTerminalRedirect(request.url);
      return !isTerminalRedirect(request.url);
    },
    [handleTerminalRedirect]
  );

  const handleNavigationState = useCallback(
    (nav: WebViewNavigation) => {
      if (nav.url) handleTerminalRedirect(nav.url);
    },
    [handleTerminalRedirect]
  );

  const handleRetry = useCallback(() => {
    setLoadFailed(false);
    setIsLoading(true);
    webviewRef.current?.reload();
  }, []);

  return (
    <Modal
      visible
      animationType="slide"
      onRequestClose={() => onClose({ terminalHandled: handledRef.current })}
      statusBarTranslucent={false}
    >
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={styles.headerSide} />
          <Text style={styles.headerTitle}>Secure payment</Text>
          <Pressable
            accessibilityLabel="Close payment window"
            hitSlop={10}
            onPress={() => onClose({ terminalHandled: handledRef.current })}
            style={styles.headerSide}
            testID="checkout-close"
          >
            <Ionicons name="close" size={24} color={COLORS.primary} />
          </Pressable>
        </View>

        <View style={styles.body}>
          <WebView
            key={checkoutUrl}
            ref={webviewRef}
            source={{ uri: checkoutUrl }}
            style={styles.webview}
            javaScriptEnabled
            domStorageEnabled
            onLoadStart={() => setIsLoading(true)}
            onLoadEnd={() => setIsLoading(false)}
            onError={() => setLoadFailed(true)}
            onShouldStartLoadWithRequest={handleShouldStart}
            onNavigationStateChange={handleNavigationState}
          />

          {isLoading && !loadFailed ? (
            <View style={styles.loadingOverlay} pointerEvents="none">
              <ActivityIndicator size="large" color={COLORS.secondary} />
            </View>
          ) : null}

          {loadFailed ? (
            <View style={[styles.errorOverlay, { paddingTop: insets.top + 56 }]}>
              <Ionicons
                name="cloud-offline-outline"
                size={40}
                color={COLORS.primary}
              />
              <Text style={styles.errorTitle}>
                Could not open the payment page
              </Text>
              <Text style={styles.errorBody}>
                Check your connection, then try again. Your payment is not lost
                — you can also resume it later from the payment prompt.
              </Text>
              <Pressable
                onPress={handleRetry}
                style={styles.retryButton}
                testID="checkout-retry"
              >
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
              <Pressable
                onPress={() => onClose({ terminalHandled: handledRef.current })}
                style={styles.backButton}
                testID="checkout-back"
              >
                <Text style={styles.backText}>Go back</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    flex: 1,
  },
  header: {
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderBottomColor: "#E9EDEB",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  headerSide: {
    alignItems: "center",
    justifyContent: "center",
    width: 32,
  },
  headerTitle: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: "800",
  },
  body: {
    flex: 1,
  },
  webview: {
    backgroundColor: COLORS.white,
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: COLORS.white,
    justifyContent: "center",
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: COLORS.white,
    justifyContent: "center",
    paddingBottom: 40,
    paddingHorizontal: 28,
  },
  errorTitle: {
    color: COLORS.primary,
    fontSize: 17,
    fontWeight: "800",
    marginTop: 14,
    textAlign: "center",
  },
  errorBody: {
    color: "#51605A",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
    textAlign: "center",
  },
  retryButton: {
    alignItems: "center",
    backgroundColor: COLORS.secondary,
    borderRadius: 10,
    marginTop: 22,
    paddingVertical: 13,
    width: "100%",
  },
  retryText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "800",
  },
  backButton: {
    alignItems: "center",
    marginTop: 10,
    paddingVertical: 10,
    width: "100%",
  },
  backText: {
    color: "#8D9793",
    fontSize: 13,
    fontWeight: "800",
  },
});
