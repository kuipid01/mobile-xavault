import { Image } from "expo-image"
import { View } from "react-native"

export const LogoWhiteBG = () => {
    return (
        <View className="bg-white rounded-xl">
            <Image
                source={require("../../assets/images/splash-icon.png")}
                contentFit="contain"
                style={{ width: 40, height: 40 }}
            />
        </View>
    )
}