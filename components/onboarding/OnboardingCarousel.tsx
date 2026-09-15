import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  View,
} from "react-native";

import { OnboardingControls } from "./OnboardingControls";
import { OnboardingSlideView } from "./OnboardingSlideView";
import { ONBOARDING_SLIDES } from "./slides";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type OnboardingCarouselProps = {
  /**
   * Called once when the user finishes onboarding — either by tapping
   * "Get Started" on the last slide or "Skip" at any point.
   */
  onFinish: () => void;
};

/**
 * The swipeable slide deck of onboarding.
 *
 * Owns the current slide index and wires the pieces together:
 * - a horizontal, paged FlatList of `OnboardingSlideView`s
 * - a tinted container whose background follows the active slide
 * - the bottom `OnboardingControls` bar (skip / dots / next)
 *
 * What happens after finishing (navigation, persistence) lives in the
 * parent, not here.
 */
export function OnboardingCarousel({ onFinish }: OnboardingCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const flatListRef = useRef<FlatList>(null);

  const isLastSlide = activeIndex === ONBOARDING_SLIDES.length - 1;

  /** Background of the active slide, applied to the whole screen. */
  const containerBackground = useMemo(
    () => ONBOARDING_SLIDES[activeIndex].background,
    [activeIndex],
  );

  /** Scroll the carousel to a slide and keep the index in sync. */
  const goToSlide = useCallback((index: number) => {
    setActiveIndex(index);

    flatListRef.current?.scrollToIndex({ index, animated: true });
  }, []);

  const handleNext = useCallback(() => {
    if (isLastSlide) {
      onFinish();
      return;
    }

    goToSlide(activeIndex + 1);
  }, [activeIndex, goToSlide, isLastSlide, onFinish]);

  /**
   * Track which slide the user swiped to. Fired once the scroll settles
   * on a page (pagingEnabled guarantees whole-slide positions).
   */
  const handleScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);

      setActiveIndex(index);
    },
    [],
  );

  return (
    <View style={[styles.container, { backgroundColor: containerBackground }]}>
      {/* SWIPEABLE SLIDES */}
      <FlatList
        ref={flatListRef}
        data={ONBOARDING_SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        keyExtractor={(slide) => slide.id}
        onMomentumScrollEnd={handleScrollEnd}
        renderItem={({ item }) => <OnboardingSlideView slide={item} />}
      />

      {/* SKIP / DOTS / NEXT BAR */}
      <OnboardingControls
        activeIndex={activeIndex}
        slideCount={ONBOARDING_SLIDES.length}
        isLastSlide={isLastSlide}
        onSkip={onFinish}
        onNext={handleNext}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
