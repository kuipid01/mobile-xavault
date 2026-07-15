import { COLORS } from "@/themes/colors";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
    StyleSheet,
    TextInput,
    TextInputProps,
    TouchableOpacity,
    View
} from "react-native";

type Props = TextInputProps & {
    label: string;
    icon?: any;
    iconColor?: string;
    iconPosition?: "left" | "right";
    viewPassword?: boolean;
    setViewPassword?: (value: boolean) => void;
};

export const FlatInput = ({
    label,
    icon,
    iconColor,
    iconPosition = "left",
    placeholder,
    value,
    onChangeText,
    secureTextEntry,
    viewPassword,
    setViewPassword,
    style,
    ...inputProps
}: Props) => {
    const isPassword = secureTextEntry;

    return (
        <View style={styles.wrapper}>

            <View style={styles.inputContainer}>
                {/* Left icon */}

                <TextInput
                    placeholder={placeholder}
                    placeholderTextColor="#9AA5A1"
                    value={value}
                    onChangeText={onChangeText}
                    secureTextEntry={isPassword && !viewPassword}
                    {...inputProps}
                    style={[
                        styles.input,
                        icon && iconPosition === "left" ? { paddingLeft: 40 } : { paddingRight: 40 },
                        isPassword && { paddingRight: 45 },
                        style,
                    ]}
                />
                {icon && (
                    <Ionicons
                        name={icon}
                        size={18}
                        color={iconColor || COLORS.primary}
                        style={iconPosition === "left" ? styles.leftIcon : styles.rightIcon}
                    />
                )}

                {/* Password toggle icon */}
                {isPassword && setViewPassword && (
                    <TouchableOpacity
                        onPress={() => setViewPassword(!viewPassword)}
                        style={styles.rightIcon}
                    >
                        <Ionicons
                            name={viewPassword ? "eye-outline" : "eye-off-outline"}
                            size={18}
                            color={COLORS.primary}
                        />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        marginBottom: 14,
    },

    label: {
        fontSize: 11,
        letterSpacing: 1,
        color: COLORS.text,
        marginBottom: 8,
        fontWeight: "800",
        fontFamily: "PlayfairDisplay_700Bold",
    },

    inputContainer: {
        position: "relative",
        height: 56,
        justifyContent: "center",
        borderBottomWidth: 1,
        borderWidth: 0,
        borderBottomColor: "#9AA5A1",
    },

    input: {
        height: "100%",
        paddingHorizontal: 2,
        fontSize: 15,
        color: COLORS.white,
        fontWeight: "600",
        fontFamily: "PlayfairDisplay_600SemiBold",
    },

    leftIcon: {
        position: "absolute",
        left: 12,
        zIndex: 10,
    },

    rightIcon: {
        position: "absolute",
        right: 12,
        zIndex: 10,
    },
});
