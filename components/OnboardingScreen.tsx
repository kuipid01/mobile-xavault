import { useOnboarding } from "@/context/OnboardingContext";
import { Ionicons } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";

import LockSavings from "@/assets/onboarding/lock-savings.svg";
import SecureWithdraw from "@/assets/onboarding/secure-withdraw.svg";
import SplitMoney from "@/assets/onboarding/split-money.svg";
const { width } = Dimensions.get("window");

const slides = [
  {
    id: "1",
    Image: SplitMoney,
    background: "#F8C9A5",
    title: "Split your money before it slips away.",
  },
  {
    id: "2",
    Image: LockSavings,
    background: "#9DB9E8",
    title: "Lock savings until your plan is ready.",
  },
  {
    id: "3",
    Image: SecureWithdraw,
    background: "#B7DFC3",
    title: "Withdraw securely when goals unlock.",
  },
];

export function OnboardingScreen() {
  const { setStep } = useOnboarding();

  const [activeIndex, setActiveIndex] = useState(0);

  const flatListRef = useRef<FlatList>(null);

  const finish = () => {
    setStep("welcome");
  };

  const next = () => {
    if (activeIndex === slides.length - 1) {
      finish();
      return;
    }

    flatListRef.current?.scrollToIndex({
      index: activeIndex + 1,
      animated: true,
    });
  };

  const onScrollEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    const index = Math.round(
      event.nativeEvent.contentOffset.x / width
    );

    setActiveIndex(index);
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: slides[activeIndex].background,
        },
      ]}
    >
      {/* SLIDES */}
      <FlatList
        ref={flatListRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        keyExtractor={(item) => item.id}
        onMomentumScrollEnd={onScrollEnd}
        renderItem={({ item }) => {
          const Illustration = item.Image;

          return (
            <View
              style={[
                styles.slide,
                { backgroundColor: item.background },
              ]}
            >
              <View style={styles.imageContainer}>
                <Illustration
                  width={320}
                  height={320}
                />
              </View>

              <View style={styles.textContainer}>
                <Text style={styles.title}>
                  {item.title}
                </Text>

                <View style={styles.rule} />
              </View>
            </View>
          );
        }}
      />

      {/* BOTTOM CONTROLS */}
      <View style={styles.actions}>
        <TouchableOpacity
          onPress={finish}
          hitSlop={12}
        >
          <Text style={styles.skip}>Skip</Text>
        </TouchableOpacity>

        <View style={styles.dots}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === activeIndex && styles.activeDot,
              ]}
            />
          ))}
        </View>

        <TouchableOpacity
          onPress={next}
          activeOpacity={0.8}
          style={styles.nextButton}
        >
          <Ionicons
            name="arrow-forward"
            size={20}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  slide: {
    width,
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 120,
    justifyContent: "space-between",
  },

  imageContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  image: {
    width: width * 0.75,
    height: width * 0.75,
  },

  textContainer: {
    marginBottom: 20,
  },

  title: {
    color: "#080A0C",
    fontFamily: "Lexend_700Bold",
    fontSize: 25,
    lineHeight: 31,
    maxWidth: 320,
  },

  rule: {
    width: 42,
    height: 2,
    backgroundColor: "#080A0C",
    marginTop: 18,
  },

  actions: {
    position: "absolute",
    bottom: 34,
    left: 24,
    right: 24,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  skip: {
    color: "#080A0C",
    fontFamily: "Lexend_700Bold",
    fontSize: 14,
  },

  dots: {
    flexDirection: "row",
    gap: 7,
  },

  dot: {
    width: 6,
    height: 6,
    borderRadius: 99,
    backgroundColor: "rgba(8,10,12,0.3)",
  },

  activeDot: {
    width: 22,
    backgroundColor: "#080A0C",
  },

  nextButton: {
    width: 46,
    height: 46,
    borderRadius: 23,

    backgroundColor: "#080A0C",

    alignItems: "center",
    justifyContent: "center",
  },
});