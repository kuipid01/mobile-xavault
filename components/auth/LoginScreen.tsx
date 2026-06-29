import { Input } from '@/components/Input';
import { useLogin } from '@/hooks/auth/auth';
import { COLORS, Radius } from '@/themes/colors';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';

const LoginScreen = () => {
  const [viewPassword, setViewPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { mutateAsync: login, isPending } = useLogin();

  const handleLogin = async () => {
    try {

      await login({
        email: email,
        password: password,
      });
      Toast.show({
        type: 'success',
        text1: 'Login successful',
        text2: 'Welcome back 👋',
      });
      router.replace('/(app)/home');
    } catch (error) {
      console.error('Login failed:', error);
      Toast.show({
        type: 'error',
        text1: 'Login failed',
        text2: 'Please check your credentials and try again.',
      });
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {/* Brand */}
      <View style={styles.brandMark}>
        <Text style={styles.brandMarkText}>XA</Text>
      </View>
      <Text style={styles.brand}>XAVAULT</Text>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Secure access to your legacy vault.</Text>
      </View>

      {/* Form Card */}
      <View style={styles.card}>
        <Input label="Email" placeholder="Enter your email" value={email} onChangeText={setEmail} />
        <Input
          label="Password"
          placeholder="Enter your password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          viewPassword={viewPassword}
          setViewPassword={setViewPassword}
        />

        <TouchableOpacity style={[styles.button, isPending && styles.buttonDisabled]} disabled={isPending} onPress={handleLogin}>
          <Text style={styles.buttonText}>{isPending ? 'Signing in...' : 'Sign In'}</Text>
        </TouchableOpacity>

        <Text onPress={() => router.push('/(auth)/register')} style={styles.footerText}>
          Don&apos;t have an account? <Text style={styles.link}>Create one</Text>
        </Text>
      </View>
    </ScrollView>
  );
};

export default LoginScreen;

const styles = {
  container: {
    flexGrow: 1,
    backgroundColor: '#F6F7FB',
    paddingHorizontal: 24,
    justifyContent: 'center' as const,

  },

  brand: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: COLORS.primary,
    letterSpacing: 2,
    textAlign: 'center' as const,
    marginBottom: 32,
  },

  header: {
    alignItems: 'center' as const,
    marginBottom: 28,
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
  },

  card: {
    backgroundColor: COLORS.white,
    padding: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E7ECE9',
  },

  button: {
    backgroundColor: COLORS.primary,
    height: 48,
    borderRadius: Radius.medium,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: 10,
  },

  buttonText: {
    color: 'white',
    fontWeight: '700' as const,
    letterSpacing: 1.2,
    fontSize: 13,
  },

  buttonDisabled: {
    opacity: 0.65,
  },

  footerText: {
    marginTop: 14,
    textAlign: 'center' as const,
    fontSize: 12,
    color: '#6B7280',
  },

  link: {
    color: COLORS.primary,
    fontWeight: '600' as const,
  },

  brandMark: {
    alignSelf: 'center' as const,
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 14,
  },

  brandMarkText: {
    color: COLORS.tertiary,
    fontSize: 20,
    fontWeight: '900' as const,
  },
};
