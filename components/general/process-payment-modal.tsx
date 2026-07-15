import { BlurView } from "expo-blur";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

const COLORS = {
    primary: "#063B2E",
    secondary: "#0F6B4F",
    tertiary: "#D6A84F",
    text: "#404945",
    border: "#717975",
    hash: "#F6F7FB",
    white: "#FFFFFF",
};

type PollStatus = "checking" | "success" | "timeout";

type ProcessingModalProps = {
    visible: boolean;
    /**
     * Called on an interval while the modal is visible. Should resolve
     * `true` once the subscription is confirmed active, `false` (or throw)
     * otherwise — a thrown/rejected check is treated as "not active yet"
     * and polling continues rather than failing the whole flow.
     *
     * Example:
     *   const { refetch } = useActiveSubscription();
     *   const checkStatus = async () => {
     *     const { data } = await refetch();
     *     return data?.status === "active";
     *   };
     */
    checkStatus: () => Promise<boolean>;
    /** Max number of polling attempts before giving up. Defaults to 20. */
    maxAttempts?: number;
    /** Delay between polls in ms. Defaults to 3000 (20 attempts ≈ 1 min). */
    pollIntervalMs?: number;
    /** Called the moment `checkStatus` resolves true. */
    onConfirmed?: () => void;
    /** Called when the user dismisses the modal after a timeout. */
    onDismiss: () => void;
};

export function ProcessingPaymentModal({
    visible,
    checkStatus,
    maxAttempts = 20,
    pollIntervalMs = 3000,
    onConfirmed,
    onDismiss,
}: ProcessingModalProps) {
    const [status, setStatus] = useState<PollStatus>("checking");

    // Keep the latest callbacks in refs so the polling effect doesn't
    // need to restart every time a parent re-renders with a new inline fn.
    const checkStatusRef = useRef(checkStatus);
    const onConfirmedRef = useRef(onConfirmed);
    checkStatusRef.current = checkStatus;
    onConfirmedRef.current = onConfirmed;

    useEffect(() => {
        if (!visible) {
            setStatus("checking");
            return;
        }

        let cancelled = false;
        let attempt = 0;
        let timer: ReturnType<typeof setTimeout>;

        setStatus("checking");

        const runCheck = async () => {
            attempt += 1;

            let isActive = false;
            try {
                isActive = await checkStatusRef.current();
            } catch {
                // Treat errors as "not confirmed yet" and keep polling —
                // a flaky check shouldn't prematurely fail the whole flow.
                isActive = false;
            }

            if (cancelled) return;

            if (isActive) {
                setStatus("success");
                onConfirmedRef.current?.();
                return;
            }

            if (attempt >= maxAttempts) {
                setStatus("timeout");
                return;
            }

            timer = setTimeout(runCheck, pollIntervalMs);
        };

        runCheck();

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [visible, maxAttempts, pollIntervalMs]);

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            statusBarTranslucent
            onRequestClose={() => {
                // Only allow closing via back button once we're past checking
                if (status !== "checking") onDismiss();
            }}
        >
            <View style={styles.overlay}>
                <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />

                <View style={styles.dialog}>
                    {status === "checking" && (
                        <>
                            <View style={styles.loaderCircle}>
                                <ActivityIndicator size="large" color={COLORS.secondary} />
                            </View>
                            <Text style={styles.title}>Confirming payment...</Text>
                            <Text style={styles.message}>
                                Please wait while we verify your payment.
                                {"\n\n"}
                                This usually takes a few seconds.
                            </Text>
                        </>
                    )}

                    {status === "success" && (
                        <>
                            <View style={[styles.loaderCircle, styles.successCircle]}>
                                <Text style={styles.successGlyph}>✓</Text>
                            </View>
                            <Text style={styles.title}>Payment confirmed!</Text>
                            <Text style={styles.message}>
                                Your subscription is now active.
                            </Text>
                        </>
                    )}

                    {status === "timeout" && (
                        <>
                            <View style={[styles.loaderCircle, styles.timeoutCircle]}>
                                <Text style={styles.timeoutGlyph}>⏱</Text>
                            </View>
                            <Text style={styles.title}>Still processing</Text>
                            <Text style={styles.message}>
                                This is taking longer than expected.
                                {"\n\n"}
                                Please check your profile or transaction history in a
                                few minutes to confirm your new plan.
                            </Text>

                            <TouchableOpacity
                                activeOpacity={0.85}
                                onPress={onDismiss}
                                style={styles.action}
                                accessibilityRole="button"
                                accessibilityLabel="OK"
                            >
                                <Text style={styles.actionText}>Got it</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        alignItems: "center",
        flex: 1,
        justifyContent: "center",
        paddingHorizontal: 24,
        backgroundColor: "rgba(6, 59, 46, 0.12)",
    },

    dialog: {
        alignItems: "center",
        backgroundColor: COLORS.white,
        borderRadius: 20,
        elevation: 12,
        paddingBottom: 24,
        paddingHorizontal: 28,
        paddingTop: 28,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.16,
        shadowRadius: 24,
        width: "100%",
        maxWidth: 340,
    },

    loaderCircle: {
        alignItems: "center",
        backgroundColor: "rgba(15, 107, 79, 0.12)",
        borderRadius: 28,
        height: 56,
        justifyContent: "center",
        marginBottom: 16,
        width: 56,
    },

    successCircle: {
        backgroundColor: "rgba(15, 107, 79, 0.14)",
    },

    successGlyph: {
        color: COLORS.secondary,
        fontSize: 26,
        fontWeight: "700",
    },

    timeoutCircle: {
        backgroundColor: "rgba(214, 168, 79, 0.18)",
    },

    timeoutGlyph: {
        color: COLORS.tertiary,
        fontSize: 24,
    },

    title: {
        color: COLORS.primary,
        fontFamily: "System",
        fontSize: 18,
        fontWeight: "700",
        marginBottom: 8,
        textAlign: "center",
    },

    message: {
        color: COLORS.text,
        fontFamily: "System",
        fontSize: 15,
        lineHeight: 22,
        textAlign: "center",
    },

    action: {
        backgroundColor: COLORS.secondary,
        borderRadius: 12,
        marginTop: 24,
        paddingVertical: 12,
        width: "100%",
    },

    actionText: {
        color: COLORS.white,
        fontFamily: "System",
        fontSize: 16,
        fontWeight: "600",
        textAlign: "center",
    },
});