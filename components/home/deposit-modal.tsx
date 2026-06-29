import { BlurView } from "expo-blur";
import { useState } from "react";
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { Wallet } from "../../api/types";
import { COLORS } from "../../themes/colors";

type Props = {
    visible: boolean;
    onClose: () => void;
    onDeposit: (amount: string) => Promise<void> | void;
    onCreateTransferAccount: () => Promise<void> | void;
    wallet?: Wallet;
    isPending?: boolean;
    isCreatingTransferAccount?: boolean;
};

const DepositModal = ({
    visible,
    onClose,
    onDeposit,
    onCreateTransferAccount,
    wallet,
    isPending,
    isCreatingTransferAccount,
}: Props) => {
    const [amount, setAmount] = useState("");

    const formattedAmount = amount ? Number(amount).toLocaleString("en-NG") : "0";

    const handleAmountChange = (value: string) => {
        const cleaned = value.replace(/[^0-9]/g, "");
        setAmount(cleaned);
    };

    const handleSubmit = async () => {
        if (!amount) return;

        await onDeposit(amount);
        setAmount("");
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="slide">
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={styles.overlay}
            >
                <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFill} />

                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

                <View style={styles.sheet}>
                    <View style={styles.handle} />

                    <Text style={styles.title}>Deposit Money</Text>

                    <Text style={styles.subtitle}>
                        Enter the amount you want to deposit into your vault.
                    </Text>

                    <View style={styles.transferBox}>
                        <Text style={styles.transferTitle}>Bank transfer</Text>
                        {wallet?.dedicated_account_number ? (
                            <>
                                <Text style={styles.transferBank}>
                                    {wallet.dedicated_bank_name || "Paystack Bank"}
                                </Text>
                                <Text style={styles.transferNumber}>
                                    {wallet.dedicated_account_number}
                                </Text>
                                <Text style={styles.transferName}>
                                    {wallet.dedicated_account_name}
                                </Text>
                            </>
                        ) : (
                            <>
                                <Text style={styles.transferHint}>
                                    Generate a transfer account for direct deposits.
                                </Text>
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    style={styles.transferButton}
                                    onPress={onCreateTransferAccount}
                                    disabled={isCreatingTransferAccount}
                                >
                                    <Text style={styles.transferButtonText}>
                                        {isCreatingTransferAccount
                                            ? "Creating..."
                                            : "Generate Account"}
                                    </Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>

                    <View style={styles.inputBox}>
                        <Text style={styles.currency}>₦</Text>

                        <TextInput
                            value={amount}
                            onChangeText={handleAmountChange}
                            keyboardType="number-pad"
                            placeholder="0"
                            placeholderTextColor="#A0A6A3"
                            style={styles.input}
                        />

                        <Text style={styles.decimal}>.00</Text>
                    </View>

                    <Text style={styles.preview}>Amount: ₦{formattedAmount}.00</Text>

                    <TouchableOpacity
                        activeOpacity={0.8}
                        style={[
                            styles.button,
                            (!amount || isPending) && styles.buttonDisabled,
                        ]}
                        onPress={handleSubmit}
                        disabled={!amount || isPending}
                    >
                        <Text style={styles.buttonText}>{isPending ? "Processing..." : "Continue"}</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

export default DepositModal;

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: "flex-end",
    },

    sheet: {
        backgroundColor: COLORS.white,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingHorizontal: 24,
        paddingTop: 12,
        paddingBottom: 34,
    },

    handle: {
        width: 48,
        height: 5,
        borderRadius: 999,
        backgroundColor: "#D8DDDA",
        alignSelf: "center",
        marginBottom: 24,
    },

    title: {
        fontSize: 22,
        fontWeight: "800",
        color: COLORS.primary,
        marginBottom: 8,
    },

    subtitle: {
        fontSize: 14,
        color: COLORS.text,
        lineHeight: 20,
        marginBottom: 24,
    },

    transferBox: {
        borderRadius: 18,
        backgroundColor: "#EFF8F4",
        borderWidth: 1,
        borderColor: "rgba(15, 107, 79, 0.16)",
        padding: 16,
        marginBottom: 18,
    },

    transferTitle: {
        color: COLORS.primary,
        fontSize: 12,
        fontWeight: "900",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginBottom: 8,
    },

    transferBank: {
        color: COLORS.border,
        fontSize: 12,
        fontWeight: "700",
        marginBottom: 4,
    },

    transferNumber: {
        color: COLORS.primary,
        fontSize: 28,
        fontWeight: "900",
        marginBottom: 4,
    },

    transferName: {
        color: COLORS.secondary,
        fontSize: 13,
        fontWeight: "800",
    },

    transferHint: {
        color: COLORS.text,
        fontSize: 13,
        fontWeight: "600",
        lineHeight: 18,
        marginBottom: 12,
    },

    transferButton: {
        height: 44,
        borderRadius: 14,
        backgroundColor: COLORS.primary,
        alignItems: "center",
        justifyContent: "center",
    },

    transferButtonText: {
        color: COLORS.white,
        fontSize: 13,
        fontWeight: "900",
    },

    inputBox: {
        height: 64,
        borderRadius: 18,
        backgroundColor: COLORS.hash,
        borderWidth: 1,
        borderColor: "rgba(113, 121, 117, 0.18)",
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 18,
    },

    currency: {
        fontSize: 24,
        fontWeight: "800",
        color: COLORS.primary,
        marginRight: 6,
    },

    input: {
        flex: 1,
        fontSize: 26,
        fontWeight: "800",
        color: COLORS.primary,
        paddingVertical: 0,
    },

    decimal: {
        fontSize: 24,
        fontWeight: "800",
        color: COLORS.primary,
    },

    preview: {
        marginTop: 12,
        fontSize: 13,
        fontWeight: "600",
        color: COLORS.border,
    },

    button: {
        height: 56,
        borderRadius: 18,
        backgroundColor: COLORS.secondary,
        alignItems: "center",
        justifyContent: "center",
        marginTop: 26,
    },

    buttonDisabled: {
        opacity: 0.45,
    },

    buttonText: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: "800",
    },
});
