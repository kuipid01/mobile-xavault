import { useValidateMail } from '@/hooks/auth/auth';
import { COLORS, Padding } from '@/themes/colors';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';

const getApiErrorMessage = (error: any) => {
  const data = error?.response?.data;

  if (typeof data?.message === 'string') {
    return data.message;
  }

  if (typeof error?.message === 'string') {
    return error.message;
  }

  return 'Please try again.';
};

const VerifyMailScreen = () => {
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === 'string' ? params.email : '';
  const { mutateAsync: validateMail, isPending } = useValidateMail();

  const checkVerificationStatus = useCallback(async (showPendingToast = true) => {
    if (!email) {
      Toast.show({
        type: 'error',
        text1: 'Email missing',
        text2: 'Please register again so we can check the right email.',
      });
      return;
    }

    try {
      const result = await validateMail({ email });
      const mailVerified = Boolean(result?.data?.mail_verified);

      if (mailVerified) {
        Toast.show({
          type: 'success',
          text1: 'Email verified',
          text2: 'You can now log in.',
        });
        router.replace('/(auth)/login');
        return;
      }

      if (showPendingToast) {
        Toast.show({
          type: 'info',
          text1: 'Not verified yet',
          text2: 'Open the verification link in your email, then check again.',
        });
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Could not check email',
        text2: getApiErrorMessage(error),
      });
    }
  }, [email, validateMail]);

  useEffect(() => {
    checkVerificationStatus(false);
  }, [checkVerificationStatus]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="mail-open-outline" size={34} color={COLORS.primary} />
        </View>

        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.subtitle}>
          We sent a verification link to {email || 'your email'}. Open the link, then come back here to continue.
        </Text>

        <TouchableOpacity
          style={[styles.button, isPending && styles.buttonDisabled]}
          disabled={isPending}
          onPress={() => checkVerificationStatus()}
        >
          <Text style={styles.buttonText}>{isPending ? 'Checking...' : 'I have verified, check again'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
          <Text style={styles.footerText}>Back to login</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default VerifyMailScreen;

const styles = {
  container: {
    flex: 1,
    backgroundColor: COLORS.hash,
    paddingHorizontal: Padding.containerX,
    paddingVertical: Padding.containerY,
    justifyContent: 'center' as const,
  },

  iconWrap: {
    alignSelf: 'center' as const,
    width: 76,
    height: 76,
    borderRadius: 999,
    backgroundColor: COLORS.white,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginBottom: 22,
  },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E7ECE9',
    shadowColor: '#063B2E',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 4,
  },

  title: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: COLORS.primary,
    textAlign: 'center' as const,
    marginBottom: 10,
  },

  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: '#6B7280',
    textAlign: 'center' as const,
    marginBottom: 30,
  },

  button: {
    backgroundColor: COLORS.primary,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },

  buttonDisabled: {
    opacity: 0.7,
  },

  buttonText: {
    color: COLORS.white,
    fontWeight: '700' as const,
    fontSize: 15,
  },

  footerText: {
    marginTop: 20,
    textAlign: 'center' as const,
    color: COLORS.primary,
    fontWeight: '700' as const,
  },
};
