import React from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS } from '@/themes/colors';

type Props = {
  /** Index of the active dot (zero-based). */
  activeIndex: number;
  /** Total number of dots to render. */
  count?: number;
};

/**
 * Row of small progress dots where the active one stretches wide.
 * Shared indicator used by the onboarding carousel (and reusable in any
 * paged flow).
 */
export function ProgressDots({ activeIndex, count = 3 }: Props) {
  return (
    <View style={styles.container}>
      {Array.from({ length: count }).map((_, index) => {
        const isActive = index === activeIndex;

        return (
          <View
            key={index}
            style={[
              styles.dot,
              isActive ? styles.activeDot : styles.inactiveDot,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    height: 6,
    borderRadius: 999,
  },
  activeDot: {
    width: 24,
    backgroundColor: COLORS.primary,
  },
  inactiveDot: {
    width: 8,
    backgroundColor: COLORS.neutral,
  },
});
