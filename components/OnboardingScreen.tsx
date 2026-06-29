import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useOnboarding } from '@/context/OnboardingContext';
import { ProgressDots } from '@/components/ProgressDots';
import { COLORS } from '@/themes/colors';

export function OnboardingScreen() {
  const { setStep } = useOnboarding();

  return (
    <View style={styles.container}>
      {/* Progress */}
      <View style={styles.progressContainer}>
        <ProgressDots activeIndex={0} />
      </View>

      {/* Headline */}
      <View style={styles.centerContent}>
        <Text style={styles.title}>
          Put every naira somewhere.
        </Text>
        <Text style={styles.subtitle}>
          Create envelopes for rent, food, savings, transport, emergencies, and more.
        </Text>
      </View>

      {/* Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardLeft}>
            <View style={styles.iconBox}>
              <Text>🍴</Text>
            </View>

            <View>
              <Text style={styles.cardTitle}>Food</Text>
              <Text style={styles.cardMeta}>
                there is ₦100,000 total
              </Text>
            </View>
          </View>

          <Text style={styles.badge}>75%</Text>
        </View>

        <View style={styles.rowItem}>
          <Text style={styles.rowLabel}>🛒 Groceries</Text>
          <Text style={styles.rowValue}>₦35,000</Text>
        </View>

        <View style={styles.rowItem}>
          <Text style={styles.rowLabel}>🍔 Eating Out</Text>
          <Text style={styles.rowValue}>₦35,000</Text>
        </View>
      </View>

      {/* Bottom Actions */}
      <View style={styles.bottom}>
        <TouchableOpacity
          onPress={() => setStep('welcome')}
          style={styles.primaryButton}
          activeOpacity={0.9}
        >
          <Text style={styles.primaryButtonText}>Continue</Text>
          <Text style={styles.arrow}>❯</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },

  progressContainer: {
    marginTop: 16,
  },

  centerContent: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },

  title: {
    color: COLORS.primary,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.2,
    lineHeight: 32,
  },

  subtitle: {
    color: COLORS.text,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },

  card: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 12,
    marginBottom: 12,
  },

  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  iconBox: {
    backgroundColor: '#ecfdf5',
    padding: 10,
    borderRadius: 12,
    marginRight: 12,
  },

  cardTitle: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 14,
  },

  cardMeta: {
    color: '#9ca3af',
    fontSize: 11,
    marginTop: 2,
  },

  badge: {
    color: '#059669',
    fontWeight: '700',
    fontSize: 12,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },

  rowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },

  rowLabel: {
    color: '#4b5563',
    fontSize: 12,
    paddingLeft: 40,
  },

  rowValue: {
    color: '#0f172a',
    fontWeight: '600',
    fontSize: 12,
  },

  bottom: {
    alignItems: 'center',
  },

  primaryButton: {
    width: '100%',
    height: 56,
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },

  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
    marginRight: 6,
  },

  arrow: {
    color: '#ffffff',
    fontSize: 12,
    marginTop: 2,
  },
});
