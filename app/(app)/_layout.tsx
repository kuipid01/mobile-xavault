import { Tabs } from "expo-router";
import CustomTabBar from "../../components/navigation/CustomTabBar";

export default function AppLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
        }}
      />

      <Tabs.Screen
        name="(plan)"
        options={{
          title: "Plans",
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
        }}
      />

      <Tabs.Screen
        name="my-profile"
        options={{
          title: "My Profile",
          href: null,
        }}
      />

      <Tabs.Screen
        name="change-email"
        options={{
          title: "Change Email",
          href: null,
        }}
      />

      <Tabs.Screen
        name="payment-settings"
        options={{
          title: "Payment Settings",
          href: null,
        }}
      />

      <Tabs.Screen
        name="login-settings"
        options={{
          title: "Login Settings",
          href: null,
        }}
      />

      <Tabs.Screen
        name="security-questions"
        options={{
          title: "Security Questions",
          href: null,
        }}
      />

      <Tabs.Screen
        name="feedback-suggestions"
        options={{
          title: "Feedback & Suggestions",
          href: null,
        }}
      />
    </Tabs>
  );
}
