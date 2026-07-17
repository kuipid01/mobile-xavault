import { Ionicons } from "@expo/vector-icons";
import EvilIcons from "@expo/vector-icons/EvilIcons";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import type { ReactNode } from "react";
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, Radius } from "../../themes/colors";

type TabIcon = {
    inactive: (color: string) => ReactNode;
    active: (color: string) => ReactNode;
};

const TAB_ICONS: Record<string, TabIcon> = {
    home: {
        inactive: (color) => (
            <Ionicons name="home-outline" size={22} color={color} />
        ),
        active: (color) => (
            <Ionicons name="home" size={22} color={color} />
        ),
    },

    "(plan)": {
        inactive: (color) => (
            <FontAwesome5 name="box" size={22} color={color} />
        ),
        active: (color) => (
            <FontAwesome5 name="box-open" size={22} color={color} />
        ),
    },

    profile: {
        inactive: (color) => (
            <EvilIcons name="user" size={27} color={color} />
        ),
        active: (color) => (
            <FontAwesome name="user" size={22} color={color} />
        ),
    },
};

const DEFAULT_TAB_ICON: TabIcon = {
    inactive: (color) => (
        <Ionicons name="ellipse-outline" size={22} color={color} />
    ),
    active: (color) => (
        <Ionicons name="ellipse" size={22} color={color} />
    ),
};

const TAB_LABELS: Record<string, string> = {
    home: "Home",
    "(plan)": "Plans",
    profile: "Profile",
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
    const insets = useSafeAreaInsets();
    const currentRoute = state.routes[state.index];

    if (HIDE_TAB_BAR_ROUTES.has(currentRoute.name)) {
        return null;
    }

    return (
        <View
            style={[
                styles.wrapper,
                { paddingBottom: Math.max(insets.bottom, 12) },
            ]}
        >
            <View style={styles.tabBar}>
                {state.routes.map((route, routeIndex) => {
                    if (!VISIBLE_TABS.has(route.name)) {
                        return null;
                    }

                    const isFocused = state.index === routeIndex;
                    const { options } = descriptors[route.key];

                    const routeOptions = options as typeof options & {
                        href?: string | null;
                    };

                    if (routeOptions.href === null) {
                        return null;
                    }

                    const label =
                        options.title ??
                        TAB_LABELS[route.name] ??
                        route.name;

                    const icons = TAB_ICONS[route.name] ?? DEFAULT_TAB_ICON;

                    const iconColor = isFocused
                        ? COLORS.primary
                        : COLORS.border;

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
                                    styles.indicator,
                                    isFocused && styles.indicatorActive,
                                ]}
                            />

                            {isFocused ? (
                                icons.active(iconColor)
                            ) : (
                                icons.inactive(iconColor)
                            )}

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
        bottom: 0,
        backgroundColor: "rgba(255,255,255,0.96)",
        borderTopColor: "rgba(6, 59, 46, 0.08)",
        borderTopWidth: 1,
        zIndex: 999,
    },

    tabBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-around",
        paddingTop: 10,
        width: "100%",
    },

    tabItem: {
        alignItems: "center",
        flex: 1,
        gap: 5,
        justifyContent: "center",
        paddingVertical: 4,
    },

    indicator: {
        backgroundColor: "transparent",
        borderRadius: Radius.small,
        height: 3,
        marginBottom: 2,
        width: 22,
    },

    indicatorActive: {
        backgroundColor: COLORS.primary,
    },

    label: {
        color: COLORS.border,
        fontSize: 10,
        fontWeight: "700",
        letterSpacing: 0.2,
    },

    labelActive: {
        color: COLORS.primary,
        fontWeight: "900",
    },
});
