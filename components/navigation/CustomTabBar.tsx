import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

// Paired outline/filled icons for inactive/active states
const TAB_ICONS: Record<
    string,
    { inactive: keyof typeof Ionicons.glyphMap; active: keyof typeof Ionicons.glyphMap }
> = {
    home: { inactive: "home-outline", active: "home" },
    "(plan)": { inactive: "swap-horizontal-outline", active: "swap-horizontal" },
    profile: { inactive: "person-outline", active: "person" },
};

const TAB_LABELS: Record<string, string> = {
    home: "Home",
    "(plan)": "Plans",
    profile: "Settings",
};
const HIDE_TAB_BAR_ROUTES = new Set([
    "upgrade-plan",
    "my-profile",
    "change-email",
    "payment-settings",
    "login-settings",
    "security-questions",
    "upgrade-suggestions",
]);


const VISIBLE_TABS = new Set(["home", "(plan)", "profile"]);

export default function CustomTabBar({
    state,
    descriptors,
    navigation,
}: Readonly<BottomTabBarProps>) {
    const currentRoute = state.routes[state.index];
    if (HIDE_TAB_BAR_ROUTES.has(currentRoute.name)) {
        return null;
    }

    return (
        <View style={styles.wrapper}>
            <View style={styles.tabBar}>
                {state.routes.map((route) => {
                    if (!VISIBLE_TABS.has(route.name)) return null;

                    const routeIndex = state.routes.findIndex((item) => item.key === route.key);
                    const isFocused = state.index === routeIndex;
                    const { options } = descriptors[route.key];
                    const routeOptions = options as typeof options & { href?: string | null };
                    if (routeOptions.href === null) return null;

                    const label =
                        options.title ??
                        TAB_LABELS[route.name] ??
                        route.name;

                    const icons = TAB_ICONS[route.name] ?? {
                        inactive: "ellipse-outline",
                        active: "ellipse",
                    };

                    const onPress = () => {
                        const event = navigation.emit({
                            type: "tabPress",
                            target: route.key,
                            canPreventDefault: true,
                        });
                        if (!isFocused && !event.defaultPrevented) {
                            navigation.navigate(route.name);
                        }
                    };

                    return (
                        <TouchableOpacity
                            key={route.key}
                            activeOpacity={0.75}
                            onPress={onPress}
                            style={styles.tabItem}
                        >
                            <View
                                style={[
                                    styles.iconWrap,
                                    isFocused && styles.iconWrapActive,
                                ]}
                            >
                                <Ionicons
                                    name={isFocused ? icons.active : icons.inactive}
                                    size={isFocused ? 20 : 19}
                                    color={
                                        isFocused ? "#FFFFFF" : "#9EAAA5"
                                    }
                                />
                            </View>

                            <Text
                                style={[
                                    styles.label,
                                    isFocused && styles.labelActive,
                                ]}
                            >
                                {label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 24,
        alignItems: "center",
        zIndex: 999,
        pointerEvents: "box-none",
    },

    tabBar: {
        height: 68,
        paddingHorizontal: 10,
        borderRadius: 999,
        backgroundColor: "#FFFFFF",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#DDE6E1",
        shadowColor: "#063B2E",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.10,
        shadowRadius: 24,
        elevation: 12,
    },

    tabItem: {
        width: 70,
        alignItems: "center",
        justifyContent: "center",

        gap: 5,
    },

    iconWrap: {
        width: 40,
        height: 40,
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
    },

    iconWrapActive: {
        backgroundColor: "#063B2E",
        shadowColor: "#063B2E",
        shadowOffset: { width: 0, height: 4 },
        borderRadius: 9999,
        shadowOpacity: 0.28,
        shadowRadius: 10,
        elevation: 6,
    },

    label: {
        fontSize: 10,
        fontWeight: "700",
        color: "#9EAAA5",
        letterSpacing: 0.2,
    },

    labelActive: {
        color: "#063B2E",
        fontWeight: "900",
    },
});
