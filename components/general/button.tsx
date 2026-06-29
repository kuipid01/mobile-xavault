import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { COLORS } from "../../themes/colors";

type IconName = ComponentProps<typeof Ionicons>["name"];

type Props = {
    text: string;
    icon: IconName;
    iconColor?: string;
    onPress?: () => void;
};

const ActionButton = ({
    text,
    icon,
    iconColor = "#FFFFFF",
    onPress,
}: Props) => {
    return (
        <TouchableOpacity activeOpacity={0.7} onPress={onPress} style={styles.wrapper}>
            <View style={[styles.iconBox,]}>
                <Ionicons name={icon} size={20} color={iconColor} />
            </View>

            <Text style={styles.actionText}>{text}</Text>
        </TouchableOpacity>
    );
};

export default ActionButton;

const styles = StyleSheet.create({
    wrapper: {
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        width: 66, height: 66, borderRadius: 16,
        backgroundColor: "rgba(255,255,255,0.1)",
    },

    iconBox: {
        color: "white",
        alignItems: "center",
        justifyContent: "center",
    },

    actionText: {
        color: COLORS.white,
        fontSize: 10,
        fontWeight: "500",
    },
});