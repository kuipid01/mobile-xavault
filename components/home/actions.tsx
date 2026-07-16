import { router, usePathname } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { COLORS } from "../../themes/colors";

type BtnProps = {
    text: string;
    action: () => void;
    active?: boolean;
};

type ActionsHeaderProps = {
    onDeposit: () => void;
    onWithdraw: () => void;
};

const Button = ({ text, action, active }: BtnProps) => {
    return (
        <TouchableOpacity onPress={action}>
            <Text style={active ? styles.buttonTextActive : styles.buttonText}>{text}</Text>
        </TouchableOpacity>
    );
};

const ActionsHeader = ({ onDeposit }: ActionsHeaderProps) => {
    const pathname = usePathname();
    const isHome = pathname.includes("/home");
    const isPlan = pathname.includes("/plans");

    return (
        <View style={styles.actionsWrap}>
            <Button text='Home' action={() => { router.push("/(app)/(tabs)/home") }} active={isHome} />
            <Button text='Plan' action={() => { router.push("/(app)/(tabs)/(plan)/plans") }} active={isPlan} />
            <Button text='Save' action={onDeposit} active={false} />
        </View>
    );
};

export default ActionsHeader;


const styles = StyleSheet.create({

    actionsWrap: {
        alignItems: "center",
        flexDirection: "row",
        gap: 10,
        marginBottom: 20,
        marginTop: 10,

    },
    buttonTextActive: {
        color: COLORS.primary,
        fontWeight: "bold",
        fontSize: 20,
    },
    buttonText: {
        color: COLORS.primary,
        opacity: .7,
        fontWeight: "bold",
        fontSize: 20,
    },



});
