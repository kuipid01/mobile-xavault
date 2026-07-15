import { Tabs } from "expo-router";
import CustomTabBar from "../../../components/navigation/CustomTabBar";

export default function TabsLayout() {
    return (
        <Tabs
            tabBar={(props) => <CustomTabBar {...props} />}
            screenOptions={{ headerShown: false }}
        >
            <Tabs.Screen name="home" options={{ title: "Home" }} />
            <Tabs.Screen name="(plan)" options={{ title: "Plans" }} />
            <Tabs.Screen name="profile" options={{ title: "Profile" }} />
        </Tabs>
    );
}