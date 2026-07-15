import React, { useEffect, useState } from "react";
import {
    Alert,
    Linking,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { PlanCode } from "../../api/subscription";
import { useModal } from "../../context/special-modal-context";
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
    xlarge: 24,
};

// Lowest to highest — same ordering used on the full UpgradePlan screen.
const PLAN_ORDER: PlanCode[] = ["free", "lite", "premium", "power"];
const tierIndexOf = (code: PlanCode) => {
    const idx = PLAN_ORDER.indexOf(code);
    return idx === -1 ? 0 : idx;
};

type SingleNormalizedPlan = {
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
};

const planTaglines: Record<string, string> = {
    free: "Start locking money away",
    lite: "For your first real habit",
    premium: "Built for salary earners",
    power: "For families & shared goals",
};

const formatNairaFromKobo = (kobo: number) => {
    return `₦${Number(kobo / 100).toLocaleString("en-NG")}`;
};

const formatLimit = (value: number) => (value === -1 ? "Unlimited" : value);

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

const getTopFeatures = (plan: SingleNormalizedPlan) => {
    const features: string[] = [
        `${formatLimit(plan.max_locked_plans)} locked plans`,
        `${formatLimit(plan.max_flexible_envelopes)} flexible envelopes`,
    ];

    if (plan.has_salary_split) features.push("Automatic salary split");
    if (plan.has_shared_envelopes) features.push("Shared envelopes with others");
    if (plan.has_full_analytics) features.push("Full vault analytics");
    if (plan.has_advanced_rules) features.push("Advanced locking rules");

    return features.slice(0, 3);
};

interface SubscriptionModalProps {
    title?: string;
    subtitle?: string;
    onSkip?: () => void | Promise<void>;
    onUpgradeStarted?: () => void | Promise<void>;
    onSubscribed?: () => void | Promise<void>;
}

const SubscriptionModal = ({
    title = "Unlock more with Premium",
    subtitle = "Get more locked plans, more envelopes, and full control over how your salary is split away.",
    onSkip,
    onUpgradeStarted,
    onSubscribed,
}: SubscriptionModalProps) => {
    const { closeModal } = useModal();

    const { data: plans = [], isLoading } = useSubscriptionPlans();
    const { data: activeSubscription, isLoading: isLoadingActiveSubscription } =
        useActiveSubscription({ enabled: true });
    const createSubscription = useCreateSubscription();
    const { startVerification } = useSubscriptionVerificationContext();

    // Free isn't something to "upgrade" to — it's the default state,
    // not a sellable tier in this modal.
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

    const currentPlanCode: PlanCode =
        (activeSubscription?.plan?.Code as PlanCode) || "free";
    const currentTierIndex = tierIndexOf(currentPlanCode);
    // Only enforce the downgrade lock while there's a genuinely active
    // paid subscription — a lapsed/expired one shouldn't block anything.
    const hasActivePaidPlan =
        activeSubscription?.status === "active" && currentPlanCode !== "free";

    const suggestedIndex = (() => {
        const nextUpgrade = normalizedPlans.findIndex(
            (p) => tierIndexOf(p.code) > currentTierIndex
        );
        return nextUpgrade !== -1 ? nextUpgrade : 0;
    })();

    const [selectedIndex, setSelectedIndex] = useState(0);
    const hasSetInitialIndex = React.useRef(false);

    // Default to the current plan card if it's visible here, otherwise
    // the cheapest available upgrade — mirrors UpgradePlan's behavior.
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

        setSelectedIndex(currentPlanIndex !== -1 ? currentPlanIndex : suggestedIndex);
        hasSetInitialIndex.current = true;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLoading, isLoadingActiveSubscription, plans.length]);

    const selectedPlan = normalizedPlans[selectedIndex];
    const selectedPlanTierIndex = selectedPlan ? tierIndexOf(selectedPlan.code) : -1;
    const isSelectedPlanCurrent = selectedPlan?.code === currentPlanCode;
    const isSelectedPlanDowngrade =
        hasActivePaidPlan && selectedPlanTierIndex < currentTierIndex;

    const handleSkip = async () => {
        await onSkip?.();
        closeModal({ skipDismissCallback: true });
    };

    const handleSubscribe = async () => {
        if (!selectedPlan?.id || createSubscription.isPending) return;

        if (isSelectedPlanDowngrade) {
            Alert.alert(
                "Can't downgrade yet",
                `Downgrading to ${selectedPlan.name} is available once your current plan expires${activeSubscription?.current_period_end
                    ? ` on ${formatDate(activeSubscription.current_period_end)}`
                    : ""
                }.`
            );
            return;
        }

        if (isSelectedPlanCurrent && hasActivePaidPlan) {
            return;
        }

        await createSubscription.mutateAsync(
            { plan_id: selectedPlan.id },
            {
                onSuccess: async (res) => {
                    if (res?.payment_url) {
                        // Persist to AsyncStorage before leaving the app — the
                        // root-mounted PaymentVerificationWatcher picks this up
                        // and shows/resumes the confirmation modal on return,
                        // even if this modal/screen has since been unmounted.
                        await onUpgradeStarted?.();
                        await startVerification(selectedPlan.id);
                        await Linking.openURL(res.payment_url);
                        closeModal({ skipDismissCallback: true });
                        return;
                    }

                    await onSubscribed?.();
                    closeModal({ skipDismissCallback: true });
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
        if (!selectedPlan) return "Select a plan";
        if (isSelectedPlanCurrent && hasActivePaidPlan) return "Current Plan";
        if (isSelectedPlanDowngrade) return "Available after your plan expires";
        return selectedPlan.price_kobo === 0
            ? `Continue with ${selectedPlan.name}`
            : `Lock in ${selectedPlan.name} · ${formatNairaFromKobo(selectedPlan.price_kobo)}/mo`;
    })();

    const isPrimaryButtonDisabled =
        isLoading ||
        isLoadingActiveSubscription ||
        !selectedPlan ||
        createSubscription.isPending ||
        isSelectedPlanDowngrade ||
        (isSelectedPlanCurrent && hasActivePaidPlan);

    return (
        <View style={styles.sheet}>
            <View style={styles.dragHandle} />

            <TouchableOpacity
                style={styles.closeButton}
                onPress={handleSkip}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
                <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>

            <View style={styles.headerBlock}>
                <Text style={styles.eyebrow}>UPGRADE</Text>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>{subtitle}</Text>
            </View>

            {isLoading || isLoadingActiveSubscription ? (
                <View style={styles.loadingBox}>
                    <Text style={styles.loadingText}>Loading plans...</Text>
                </View>
            ) : (
                <View style={styles.plansList}>
                    {normalizedPlans.map((plan, index) => {
                        const isActive = index === selectedIndex;
                        const isCurrent = plan.code === currentPlanCode;
                        const isDowngrade =
                            hasActivePaidPlan && tierIndexOf(plan.code) < currentTierIndex;
                        const isRecommended =
                            !isCurrent && !isDowngrade && index === suggestedIndex;
                        const features = getTopFeatures(plan);

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
                                    setSelectedIndex(index);
                                }}
                                style={[
                                    styles.planCard,
                                    {
                                        borderColor: isActive ? COLORS.secondary : COLORS.hash,
                                        backgroundColor: isActive ? COLORS.white : COLORS.hash,
                                        opacity: isDowngrade ? 0.55 : 1,
                                    },
                                ]}
                            >
                                <View style={styles.planTopRow}>
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

                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <View style={styles.planNameRow}>
                                            <Text style={styles.planName}>{plan.name}</Text>
                                            {isCurrent && (
                                                <View style={[styles.badge, styles.currentBadge]}>
                                                    <Text style={[styles.badgeText, styles.currentBadgeText]}>
                                                        CURRENT
                                                    </Text>
                                                </View>
                                            )}
                                            {isRecommended && (
                                                <View style={styles.badge}>
                                                    <Text style={styles.badgeText}>BEST VALUE</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={styles.planTagline}>
                                            {isDowngrade
                                                ? "Available once your current plan expires"
                                                : planTaglines[plan.code] || "Upgrade your limits"}
                                        </Text>
                                    </View>

                                    <View style={styles.priceBlock}>
                                        <Text style={styles.priceValue}>
                                            {plan.price_kobo === 0
                                                ? "₦0"
                                                : formatNairaFromKobo(plan.price_kobo)}
                                        </Text>
                                        <Text style={styles.priceUnit}>/month</Text>
                                    </View>
                                </View>

                                {isActive && (
                                    <View style={styles.featureList}>
                                        {features.map((feature) => (
                                            <View key={feature} style={styles.featureRow}>
                                                <View style={styles.featureDot} />
                                                <Text style={styles.featureText}>{feature}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            )}

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

            {isSelectedPlanDowngrade && (
                <Text style={styles.downgradeCaption}>
                    Available once your current plan expires
                    {activeSubscription?.current_period_end
                        ? ` on ${formatDate(activeSubscription.current_period_end)}`
                        : ""}
                    .
                </Text>
            )}

            <TouchableOpacity onPress={handleSkip} activeOpacity={0.7}>
                <Text style={styles.dismissText}>Not now</Text>
            </TouchableOpacity>
        </View>
    );
};

export default SubscriptionModal;

const styles = StyleSheet.create({
    sheet: {
        backgroundColor: COLORS.white,
        borderRadius: Radius.xlarge,
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: 28,
        marginHorizontal: 16,
    },
    dragHandle: {
        alignSelf: "center",
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: COLORS.hash,
        marginBottom: 8,
    },
    closeButton: {
        position: "absolute",
        top: 16,
        right: 16,
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: COLORS.hash,
        zIndex: 1,
    },
    closeText: {
        fontSize: 13,
        color: COLORS.primary,
        fontWeight: "600",
    },
    headerBlock: {
        marginTop: 8,
        marginBottom: 20,
        paddingRight: 32,
    },
    eyebrow: {
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 1,
        color: COLORS.tertiary,
        marginBottom: 6,
    },
    title: {
        fontSize: 22,
        fontWeight: "700",
        color: COLORS.primary,
        lineHeight: 28,
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 13,
        color: COLORS.text,
        lineHeight: 19,
    },
    loadingBox: {
        borderRadius: Radius.large,
        padding: 24,
        backgroundColor: COLORS.hash,
        alignItems: "center",
        marginBottom: 20,
    },
    loadingText: {
        color: COLORS.text,
        fontSize: 14,
        fontWeight: "500",
    },
    plansList: {
        gap: 12,
        marginBottom: 20,
    },
    planCard: {
        borderWidth: 1.5,
        borderRadius: Radius.large,
        padding: 16,
    },
    planTopRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    radio: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        alignItems: "center",
        justifyContent: "center",
    },
    radioCheck: {
        color: COLORS.white,
        fontSize: 11,
        fontWeight: "700",
    },
    planNameRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
    },
    planName: {
        fontSize: 16,
        fontWeight: "700",
        color: COLORS.primary,
    },
    badge: {
        backgroundColor: COLORS.tertiary,
        borderRadius: Radius.small,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    currentBadge: {
        backgroundColor: COLORS.primary,
    },
    currentBadgeText: {
        color: COLORS.white,
    },
    badgeText: {
        fontSize: 9,
        fontWeight: "700",
        color: COLORS.primary,
        letterSpacing: 0.3,
    },
    planTagline: {
        fontSize: 12,
        color: COLORS.text,
        marginTop: 2,
    },
    priceBlock: {
        alignItems: "flex-end",
    },
    priceValue: {
        fontSize: 17,
        fontWeight: "700",
        color: COLORS.primary,
    },
    priceUnit: {
        fontSize: 11,
        color: COLORS.text,
    },
    featureList: {
        marginTop: 14,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: COLORS.hash,
        gap: 8,
    },
    featureRow: {
        flexDirection: "row",
        alignItems: "center",
    },
    featureDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: COLORS.secondary,
        marginRight: 8,
    },
    featureText: {
        fontSize: 12.5,
        color: COLORS.text,
        flexShrink: 1,
    },
    primaryButton: {
        backgroundColor: COLORS.secondary,
        borderRadius: Radius.medium,
        paddingVertical: 16,
        alignItems: "center",
        marginBottom: 12,
    },
    primaryButtonDisabled: {
        opacity: 0.65,
    },
    primaryButtonText: {
        color: COLORS.white,
        fontSize: 15,
        fontWeight: "600",
    },
    downgradeCaption: {
        fontSize: 11,
        color: COLORS.border,
        textAlign: "center",
        marginTop: -4,
        marginBottom: 12,
    },
    dismissText: {
        fontSize: 13,
        fontWeight: "500",
        color: COLORS.border,
        textAlign: "center",
    },
});
