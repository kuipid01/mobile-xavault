import type { UserProfile } from "@/api/profile";
import { COLORS } from "@/themes/colors";
import { Ionicons } from "@expo/vector-icons";
import { Image, StyleSheet, View } from "react-native";

type Props = {
  profile?: Pick<UserProfile, "gender" | "profile_image_url"> | null;
  size?: number;
};

const getGenderIcon = (gender?: string | null): keyof typeof Ionicons.glyphMap => {
  const normalized = gender?.trim().toLowerCase();

  if (normalized === "male" || normalized === "man") return "male-outline";
  if (normalized === "female" || normalized === "woman") return "female-outline";
  return "person-outline";
};

export function ProfileAvatar({ profile, size = 44 }: Props) {
  const radius = size / 2;

  if (profile?.profile_image_url) {
    return (
      <Image
        source={{ uri: profile.profile_image_url }}
        style={[styles.image, { borderRadius: radius, height: size, width: size }]}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        { borderRadius: radius, height: size, width: size },
      ]}
    >
      <Ionicons
        name={getGenderIcon(profile?.gender)}
        size={size * 0.52}
        color={COLORS.secondary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: COLORS.primary,
  },
  fallback: {
    alignItems: "center",
    backgroundColor: "#DDEFE7",
    justifyContent: "center",
  },
});
