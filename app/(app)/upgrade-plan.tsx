import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PlanCode } from "../../api/subscription";
import {
  useActiveSubscription,
  useCreateSubscription,
  useSubscriptionPlans,
} from "../../hooks/app/subscription";
import { useSubscriptionVerificationContext } from "../../hooks/verify-sub";

const COLORS = {
  primary: "#063B2E",
  secondary: "#0F6B4F",
  tertiary: "#D6A84F",
  text: "#404945",
  border: "#717975",
  hash: "#F6F7FB",
  white: "#FFFFFF",
};

const Radius = {
  small: 4,
  medium: 8,
  large: 12,
};

const Padding = {
  containerX: 24,
};

const SCREEN_WIDTH = Dimensions.get("window").width;
const CARD_GAP = 16;
const CARD_WIDTH = SCREEN_WIDTH - Padding.containerX * 2 - 32;
const SNAP_INTERVAL = CARD_WIDTH + CARD_GAP;

// Lowest to highest — drives upgrade/downgrade comparisons below.
const PLAN_ORDER: PlanCode[] = ["free", "lite", "premium", "power"];
const tierIndexOf = (code: PlanCode) => {
  const idx = PLAN_ORDER.indexOf(code);
  return idx === -1 ? 0 : idx;
};

type SingleNormalizedPlan =
  {
    id: string;
    code: PlanCode;
    name: string;
    price_kobo: number;
    max_locked_plans: number;
    max_flexible_envelopes: number;
    max_emergency_vaults: number;
    max_monthly_volume_kobo: number;
    free_flexible_withdrawals_monthly: number;
    free_emergency_withdrawals_monthly: number;
    has_salary_split: boolean;
    has_full_analytics: boolean;
    has_shared_envelopes: boolean;
    has_advanced_rules: boolean;

  }
const planTaglines: Record<string, string> = {
  free: "Start locking money away",
  lite: "For your first real habit",
  premium: "Built for salary earners",
  power: "For families & shared goals",
};

const formatNairaFromKobo = (kobo: number) => {
  return `₦${Number(kobo / 100).toLocaleString("en-NG")}`;
};

const formatVolumeFromKobo = (kobo: number) => {
  return `₦${Number(kobo / 100).toLocaleString("en-NG")}`;
};
const formatLimit = (value: number) =>
  value === -1 ? "Unlimited" : value;

const formatDate = (iso?: string) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
};

const getPlanFeatures = (plan: SingleNormalizedPlan) => {
  const features = [
    `${formatLimit(plan.max_locked_plans)} locked plans`,
    `${formatLimit(plan.max_flexible_envelopes)} flexible envelopes`,
    `${plan.max_emergency_vaults} emergency vault${plan.max_emergency_vaults > 1 ? "s" : ""}`,
    `Up to ${formatVolumeFromKobo(plan.max_monthly_volume_kobo)} moved monthly`,
  ];

  if (plan.free_flexible_withdrawals_monthly > 0) {
    features.push(
      `${plan.free_flexible_withdrawals_monthly} free flexible withdrawal${plan.free_flexible_withdrawals_monthly > 1 ? "s" : ""} / month`
    );
  }

  if (plan.has_salary_split) features.push("Automatic salary split");
  if (plan.has_full_analytics) features.push("Full vault analytics");
  if (plan.has_shared_envelopes) features.push("Shared envelopes with others");
  if (plan.has_advanced_rules) features.push("Advanced locking rules");

  return features;
};

export default function UpgradePlan() {
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const hasSetInitialIndex = useRef(false);

  const { data: plans = [], isLoading } = useSubscriptionPlans();
  const { data: activeSubscription, isLoading: isLoadingActiveSubscription } =
    useActiveSubscription({ enabled: true });
  const { startVerification } = useSubscriptionVerificationContext();

  // Free isn't something to "upgrade" to — it's the default state, not
  // a sellable tier on this screen.
  const normalizedPlans: SingleNormalizedPlan[] = plans
    .filter((plan) => plan.Code !== "free")
    .map((plan) => ({
      id: plan.ID,
      code: plan.Code,
      name: plan.Name,
      price_kobo: plan.PriceKobo,
      max_locked_plans: plan.MaxLockedPlans,
      max_flexible_envelopes: plan.MaxFlexibleEnvelopes,
      max_emergency_vaults: plan.MaxEmergencyVaults,
      max_monthly_volume_kobo: plan.MaxMonthlyVolumeKobo,
      free_flexible_withdrawals_monthly: plan.FreeFlexibleWithdrawalsMonthly,
      free_emergency_withdrawals_monthly: plan.FreeEmergencyWithdrawalsMonthly,
      has_salary_split: plan.HasSalarySplit,
      has_full_analytics: plan.HasFullAnalytics,
      has_shared_envelopes: plan.HasSharedEnvelopes,
      has_advanced_rules: plan.HasAdvancedRules,
    }));

  const createSubscription = useCreateSubscription();

  const currentPlanCode: PlanCode =
    (activeSubscription?.plan?.Code as PlanCode) || "free";
  const currentTierIndex = tierIndexOf(currentPlanCode);
  // Only enforce the downgrade lock while there's a genuinely active
  // paid subscription — a lapsed/expired one shouldn't block anything.
  const hasActivePaidPlan =
    activeSubscription?.status === "active" && currentPlanCode !== "free";

  // Default to the user's current plan card if it's visible in this
  // list, otherwise the first tier above them (e.g. they're on Free,
  // so land on the cheapest paid upgrade rather than index 0 blindly).
  useEffect(() => {
    if (
      hasSetInitialIndex.current ||
      isLoading ||
      isLoadingActiveSubscription ||
      normalizedPlans.length === 0
    ) {
      return;
    }

    const currentPlanIndex = normalizedPlans.findIndex(
      (p) => p.code === currentPlanCode
    );

    if (currentPlanIndex !== -1) {
      setActiveIndex(currentPlanIndex);
    } else {
      const firstUpgradeIndex = normalizedPlans.findIndex(
        (p) => tierIndexOf(p.code) > currentTierIndex
      );
      setActiveIndex(Math.max(0, firstUpgradeIndex));
    }

    hasSetInitialIndex.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isLoadingActiveSubscription, plans.length]);

  const activePlan = normalizedPlans[activeIndex];
  const activePlanTierIndex = activePlan ? tierIndexOf(activePlan.code) : -1;
  const isActivePlanCurrent = activePlan?.code === currentPlanCode;
  const isActivePlanDowngrade =
    hasActivePaidPlan && activePlanTierIndex < currentTierIndex;

  // "Not sure?" now points at the cheapest available upgrade rather
  // than a hardcoded premium index, so it still makes sense once
  // someone is already on premium (it'd point at power instead).
  const suggestedIndex = (() => {
    const nextUpgrade = normalizedPlans.findIndex(
      (p) => tierIndexOf(p.code) > currentTierIndex
    );
    return nextUpgrade !== -1 ? nextUpgrade : 0;
  })();

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const index = Math.round(x / SNAP_INTERVAL);
    setActiveIndex(Math.max(0, Math.min(normalizedPlans.length - 1, index)));
  };

  const scrollToIndex = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * SNAP_INTERVAL, animated: true });
    setActiveIndex(index);
  };

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(app)/(tabs)/profile");
    }
  };

  const handleSubscribe = async () => {
    if (!activePlan?.id || createSubscription.isPending) return;

    if (isActivePlanDowngrade) {
      Alert.alert(
        "Can't downgrade yet",
        `Downgrading to ${activePlan.name} is available once your current plan expires${activeSubscription?.current_period_end
          ? ` on ${formatDate(activeSubscription.current_period_end)}`
          : ""
        }.`
      );
      return;
    }

    if (isActivePlanCurrent && hasActivePaidPlan) {
      // Nothing to do — button should already be disabled for this
      // case, this is just a safety net.
      return;
    }

    await createSubscription.mutateAsync(
      { plan_id: activePlan.id },
      {
        onSuccess: async (res) => {
          if (res?.payment_url) {
            await startVerification(activePlan.id);
            await Linking.openURL(res.payment_url);
            return;
          }
        },
        onError: () => {
          Alert.alert(
            "Subscription failed",
            "We could not start your subscription. Please try again."
          );
        },
      }
    );
  };

  const primaryButtonLabel = (() => {
    if (createSubscription.isPending) return "Processing...";
    if (!activePlan) return "Select a plan";
    if (isActivePlanCurrent && hasActivePaidPlan) return "Current Plan";
    if (isActivePlanDowngrade) return "Available after your plan expires";
    return activePlan.price_kobo === 0
      ? `Continue with ${activePlan.name}`
      : `Lock in ${activePlan.name} · ${formatNairaFromKobo(activePlan.price_kobo)}/mo`;
  })();

  const isPrimaryButtonDisabled =
    isLoading ||
    isLoadingActiveSubscription ||
    !activePlan ||
    createSubscription.isPending ||
    isActivePlanDowngrade ||
    (isActivePlanCurrent && hasActivePaidPlan);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={goBack}
          activeOpacity={0.7}
        >
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Upgrade Plan</Text>

        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>
            Lock more. Split smarter. Grow faster.
          </Text>

          <Text style={styles.heroSubtitle}>
            Every plan gives you more locked plans, more envelopes, and more
            control over how your salary is split and put away, not just a
            bigger budget.
          </Text>
        </View>

        {isLoading || isLoadingActiveSubscription ? (
          <View style={styles.loadingBox}>
            <Text style={styles.loadingText}>Loading plans...</Text>
          </View>
        ) : (
          <>
            <ScrollView
              ref={scrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={SNAP_INTERVAL}
              snapToAlignment="start"
              onMomentumScrollEnd={handleMomentumEnd}
              contentContainerStyle={styles.cardScrollContent}
            >
              {normalizedPlans.map((plan, index) => {
                const isActive = index === activeIndex;
                const isCurrent = plan.code === currentPlanCode;
                const isDowngrade =
                  hasActivePaidPlan && tierIndexOf(plan.code) < currentTierIndex;
                const isRecommended =
                  !isCurrent && !isDowngrade && index === suggestedIndex;
                const features = getPlanFeatures(plan);

                return (
                  <TouchableOpacity
                    key={plan.id}
                    activeOpacity={0.85}
                    onPress={() => {
                      if (isDowngrade) {
                        Alert.alert(
                          "Can't downgrade yet",
                          `Downgrading to ${plan.name} is available once your current plan expires${activeSubscription?.current_period_end
                            ? ` on ${formatDate(activeSubscription.current_period_end)}`
                            : ""
                          }.`
                        );
                        return;
                      }
                      scrollToIndex(index);
                    }}
                    style={[
                      styles.card,
                      {
                        width: CARD_WIDTH,
                        marginRight: index === normalizedPlans.length - 1 ? 0 : CARD_GAP,
                        borderColor: isActive ? COLORS.secondary : COLORS.hash,
                        backgroundColor: isActive ? COLORS.white : COLORS.hash,
                        opacity: isDowngrade ? 0.55 : 1,
                      },
                    ]}
                  >
                    {isCurrent && (
                      <View style={[styles.recommendedBadge, styles.currentBadge]}>
                        <Text style={[styles.recommendedText, styles.currentBadgeText]}>
                          CURRENT PLAN
                        </Text>
                      </View>
                    )}

                    {isRecommended && (
                      <View style={styles.recommendedBadge}>
                        <Text style={styles.recommendedText}>
                          MOST LOCKED-IN
                        </Text>
                      </View>
                    )}

                    <View style={styles.cardTopRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardName}>{plan.name}</Text>
                        <Text style={styles.cardTagline}>
                          {isDowngrade
                            ? "Available once your current plan expires"
                            : planTaglines[plan.code] || "Upgrade your limits"}
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.radio,
                          isActive && {
                            borderColor: COLORS.secondary,
                            backgroundColor: COLORS.secondary,
                          },
                        ]}
                      >
                        {isActive && <Text style={styles.radioCheck}>✓</Text>}
                      </View>
                    </View>

                    <View style={styles.priceRow}>
                      <Text style={styles.priceValue}>
                        {plan.price_kobo === 0
                          ? "₦0"
                          : formatNairaFromKobo(plan.price_kobo)}
                      </Text>

                      <Text style={styles.priceUnit}>/month</Text>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.featureList}>
                      {features.map((feature) => (
                        <View key={feature} style={styles.featureRow}>
                          <View style={styles.featureDot} />
                          <Text style={styles.featureText}>{feature}</Text>
                        </View>
                      ))}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.dotsRow}>
              {normalizedPlans.map((plan, index) => (
                <View
                  key={plan.id}
                  style={[
                    styles.dot,
                    index === activeIndex && styles.dotActive,
                  ]}
                />
              ))}
            </View>

            <TouchableOpacity
              style={styles.notSureButton}
              activeOpacity={0.7}
              onPress={() => scrollToIndex(suggestedIndex)}
            >
              <Text style={styles.notSureText}>
                Not sure? Check the best plan for you
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            isPrimaryButtonDisabled && styles.primaryButtonDisabled,
          ]}
          activeOpacity={0.85}
          disabled={isPrimaryButtonDisabled}
          onPress={handleSubscribe}
        >
          <Text style={styles.primaryButtonText}>{primaryButtonLabel}</Text>
        </TouchableOpacity>

        <Text style={styles.footerCaption}>
          {isActivePlanDowngrade
            ? `You can switch down to this plan once your current one expires${activeSubscription?.current_period_end
              ? ` on ${formatDate(activeSubscription.current_period_end)}`
              : ""
            }.`
            : "Change or cancel your plan anytime from Settings."}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Padding.containerX,
    paddingVertical: 12,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.large,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.hash,
  },
  backChevron: {
    fontSize: 20,
    color: COLORS.primary,
    marginTop: -2,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.primary,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  heroSection: {
    paddingHorizontal: Padding.containerX,
    paddingTop: 8,
    paddingBottom: 20,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.primary,
    lineHeight: 30,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  loadingBox: {
    marginHorizontal: Padding.containerX,
    borderRadius: Radius.large,
    padding: 24,
    backgroundColor: COLORS.hash,
    alignItems: "center",
  },
  loadingText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "500",
  },
  cardScrollContent: {
    paddingHorizontal: Padding.containerX,
    paddingVertical: 8,
  },
  card: {
    borderWidth: 1.5,
    borderRadius: Radius.large,
    padding: 20,
  },
  recommendedBadge: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.tertiary,
    borderRadius: Radius.small,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 12,
  },
  currentBadge: {
    backgroundColor: COLORS.primary,
  },
  currentBadgeText: {
    color: COLORS.white,
  },
  recommendedText: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  cardName: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.primary,
  },
  cardTagline: {
    fontSize: 13,
    color: COLORS.text,
    marginTop: 2,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioCheck: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "700",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 16,
  },
  priceValue: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.primary,
  },
  priceUnit: {
    fontSize: 13,
    color: COLORS.text,
    marginLeft: 4,
    marginBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.hash,
    marginVertical: 16,
  },
  featureList: {
    gap: 10,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  featureDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.secondary,
    marginRight: 10,
  },
  featureText: {
    fontSize: 13,
    color: COLORS.text,
    flexShrink: 1,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.border,
    opacity: 0.4,
  },
  dotActive: {
    width: 18,
    backgroundColor: COLORS.secondary,
    opacity: 1,
  },
  notSureButton: {
    alignSelf: "center",
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: Radius.medium,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  notSureText: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.text,
  },
  footer: {
    paddingHorizontal: Padding.containerX,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.hash,
  },
  primaryButton: {
    backgroundColor: COLORS.secondary,
    borderRadius: Radius.medium,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButtonDisabled: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "600",
  },
  footerCaption: {
    fontSize: 11,
    color: COLORS.border,
    textAlign: "center",
    marginTop: 8,
  },
});
