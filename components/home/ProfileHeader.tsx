import { getAccessToken } from "@/api/auth";
import { useDrawerStore } from "@/store/drawerStore";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { jwtDecode } from "jwt-decode";
import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { COLORS } from "../../themes/colors";

const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
};

type JwtWithEmail = { email?: string; sub?: string;[key: string]: unknown };

const ProfileHeader = () => {
    const openDrawer = useDrawerStore((state) => state.openDrawer);
    const [email, setEmail] = useState<string | null>(null);
    const [name, setName] = useState<string | null>(null);

    useEffect(() => {
        getAccessToken().then((token) => {
            if (!token) return;
            try {
                const payload = jwtDecode<JwtWithEmail>(token);
                setEmail(payload.email ?? payload.sub ?? null);
            } catch {
                // leave email null
            }
        });
        AsyncStorage.getItem("name").then(setName);
    }, []);

    return (
        <View style={styles.container}>
            <View style={styles.profileRow}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open profile drawer"
                    onPress={() => openDrawer("profile")}
                    style={styles.avatarWrap}
                >
                    <Image
                        source={{
                            uri: "https://i.pinimg.com/1200x/31/02/62/3102629a406ed439592d5833f0faa979.jpg",
                        }}
                        style={styles.avatar}
                    />
                </Pressable>

                <View style={styles.userText}>
                    <Text style={styles.greeting}>{getGreeting()}</Text>
                    {(name || email) && (
                        <Text style={styles.name} numberOfLines={1}>
                            {name || email}
                        </Text>
                    )}
                </View>
            </View>

            <View style={styles.actions}>
                {/* <TouchableOpacity activeOpacity={0.75} style={styles.iconButton}>
                    <Ionicons name="search" size={18} color={COLORS.white} />
                </TouchableOpacity> */}

                <TouchableOpacity activeOpacity={0.75} style={styles.iconButton}>
                    <View style={styles.notificationDot} />
                    <Ionicons
                        name="notifications-outline"
                        size={18}
                        color={COLORS.primary}
                    />
                </TouchableOpacity>
            </View>
        </View>
    );
};

export default ProfileHeader;

const styles = StyleSheet.create({
    container: {
        width: "100%",
        minHeight: 58,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 10,
    },

    profileRow: {
        flexDirection: "row",
        gap: 12,
        alignItems: "center",
        flex: 1,
        paddingRight: 12,
    },

    avatarWrap: {
        width: 40,
        height: 40,
        borderRadius: 25,
        backgroundColor: "rgba(255,255,255,0.16)",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
    },

    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },

    userText: {
        flex: 1,
    },

    greeting: {
        color: COLORS.primary,
        fontSize: 20,
        fontWeight: "900",
        letterSpacing: -0.4,
    },

    name: {
        color: COLORS.primary,
        fontSize: 13,
        fontWeight: "700",
        marginTop: 3,
    },

    actions: {
        flexDirection: "row",
        gap: 8,
        alignItems: "center",
    },

    iconButton: {
        width: 42,
        height: 42,
        backgroundColor: "rgba(255,255,255,0.13)",
        borderRadius: 21,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.14)",
        position: "relative",
    },

    notificationDot: {
        position: "absolute",
        top: 10,
        right: 11,
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: "#F4C95D",
        borderWidth: 1,
        borderColor: "#106B4F",
        zIndex: 2,
    },
});
