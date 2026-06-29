import { Input } from '@/components/Input';
import { useRegister } from '@/hooks/auth/auth';
import { COLORS, Padding } from '@/themes/colors';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';

const RegisterScreen = () => {
  const [viewPassword, setViewPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { mutateAsync: register, isPending } = useRegister();

  const getApiErrorMessage = (error: any) => {
    const data = error?.response?.data;

    if (data?.error && typeof data.error === 'object') {
      const firstError = Object.values(data.error)[0];

      if (typeof firstError === 'string') {
        return firstError;
      }
    }

    if (typeof data?.message === 'string') {
      return data.message;
    }

    if (typeof error?.message === 'string') {
      return error.message;
    }

    return 'Please try again.';
  };

  const handleRegister = async () => {
    if (password !== confirmPassword) {
      Toast.show({
        type: 'error',
        text1: 'Passwords do not match',
      });
      return;
    }

    try {
      const normalizedEmail = email.trim().toLowerCase();

      await register({ email: normalizedEmail, password, confirm_password: confirmPassword });

      Toast.show({
        type: 'success',
        text1: 'Account created, we sent a mail to your account',
        text2: 'Welcome to XAVAULT 🎉',
      });

      router.replace({
        pathname: '/(auth)/verify-mail',
        params: { email: normalizedEmail },
      });
    } catch (error: any) {
      console.log(error, 'ERROR');

      Toast.show({
        type: 'error',
        text1: 'Registration failed',
        text2: getApiErrorMessage(error),
      });
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color="#000" />
        </TouchableOpacity>

        <View style={styles.titleContainer}>
          <Text style={styles.title}>Create an account</Text>
          <Text style={styles.subtitle}>
            Sign up to get started and enjoy our services.
          </Text>
        </View>
      </View>

      {/* Form */}
      <View style={styles.form}>
        <Input placeholder='Enter Email' label="Email" icon="mail-outline" value={email} onChangeText={setEmail} />
        <Input
          placeholder='Enter Password'
          label="Password"
          icon="lock-closed-outline"
          secureTextEntry
          viewPassword={viewPassword}
          setViewPassword={setViewPassword}
          value={password}
          onChangeText={setPassword}
        />
        <Input
          placeholder='Confirm Password'
          label="Confirm Password"
          icon="lock-closed-outline"
          secureTextEntry
          viewPassword={viewPassword}
          setViewPassword={setViewPassword}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        {/* Button */}
        <TouchableOpacity style={[styles.button, isPending && styles.buttonDisabled]} disabled={isPending} onPress={handleRegister}>
          <Text style={styles.buttonText}>{isPending ? 'Creating...' : 'Create Account'}</Text>
        </TouchableOpacity>
      </View>
      <View>
        <Pressable onPress={() => router.push("/(auth)/login")}>
          <Text style={styles.footerText}>
            Already have an account? <Text style={styles.link}>Log in</Text>
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
};

export default RegisterScreen;

const styles = {
  container: {
    flexGrow: 1,
    backgroundColor: COLORS.hash,
    paddingHorizontal: Padding.containerX,
    paddingVertical: Padding.containerY,
  },

  header: {
    marginTop: 20,
  },

  backButton: {
    backgroundColor: COLORS.white,
    width: 44,
    height: 44,
    borderRadius: 999,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },

  titleContainer: {
    marginTop: 24,
    alignItems: 'center' as const,
  },

  title: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: COLORS.primary,
    marginBottom: 6,
  },

  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center' as const,
    paddingHorizontal: 10,
  },

  form: {
    marginTop: 32,
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E7ECE9',
    shadowColor: '#063B2E',
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 3,
  },

  button: {
    marginTop: 20,
    backgroundColor: COLORS.primary,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },

  buttonDisabled: {
    opacity: 0.65,
  },

  buttonText: {
    color: 'white',
    fontWeight: '700' as const,
    fontSize: 15,
  },

  footerText: {
    marginTop: 20,
    textAlign: 'center' as const,
    color: COLORS.text,
  },

  link: {
    color: COLORS.primary,
    fontWeight: '700' as const,
  },
};
