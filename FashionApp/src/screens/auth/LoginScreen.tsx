import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp, ZoomIn, FadeIn } from 'react-native-reanimated';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { login, socialAuth } from '../../api/auth';
import { ApiError } from '../../api/client';
import { typography, spacing, radius } from '../../theme';
import { AuthStackParamList } from '../../navigation/AuthNavigator';

type Props = { navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'> };

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const { signIn } = useAuth();
  const { themeColors: c } = useTheme();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword]     = useState('');
  const [showPassword, setShowPw]   = useState(false);
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [socialLoading, setSocial]  = useState<'apple' | null>(null);

  // ── Email / Password login ──────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) { setError('Please fill in all fields.'); return; }
    setError(''); setLoading(true);
    try {
      const user = await login({ identifier: identifier.trim(), password });
      await signIn(user);
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 403 && e.data?.code === 'EMAIL_NOT_VERIFIED') {
        navigation.navigate('VerifyEmail', { userId: e.data.userId, email: e.data.email });
      } else {
        setError(e.message || 'Login failed. Please try again.');
      }
    } finally { setLoading(false); }
  };

  // ── Apple Sign In ──────────────────────────────────────────────────────────
  const handleApple = async () => {
    setSocial('apple'); setError('');
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      const appleEmail = credential.email ?? `apple_${credential.user}@privaterelay.appleid.com`;
      const appleName  = credential.fullName
        ? `${credential.fullName.givenName ?? ''} ${credential.fullName.familyName ?? ''}`.trim()
        : '';

      const user = await socialAuth('apple', appleEmail, appleName, credential.user);
      if (user.isNewAccount) {
        navigation.navigate('CompleteProfile', { pendingUser: user });
      } else {
        await signIn(user);
      }
    } catch (e: any) {
      if (e?.code !== 'ERR_REQUEST_CANCELED') {
        setError(e.message || 'Apple sign-in failed.');
      }
    } finally { setSocial(null); }
  };

  return (
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: c.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <Animated.View entering={ZoomIn.delay(0).duration(500).springify()} style={styles.header}>
          <LinearGradient colors={[c.primaryLight, c.primary]} style={[styles.logo, { shadowColor: c.primary }]}>
            <Ionicons name="shirt" size={30} color={c.white} />
          </LinearGradient>
          <Text style={[styles.brand, { color: c.text }]}>SmartFashion</Text>
          <Text style={[styles.tagline, { color: c.textMuted }]}>Your AI-powered style companion</Text>
        </Animated.View>

        {/* Heading */}
        <Animated.View entering={FadeInDown.delay(160).duration(450)} style={styles.titleRow}>
          <Text style={[styles.title, { color: c.text }]}>Welcome back</Text>
          <Text style={[styles.subtitle, { color: c.textSecondary }]}>Sign in to continue</Text>
        </Animated.View>

        {!!error && (
          <Animated.View entering={FadeIn.duration(300)} style={[styles.errorBox, { backgroundColor: c.error + '14', borderColor: c.error + '40' }]}>
            <Ionicons name="alert-circle" size={16} color={c.error} />
            <Text style={[styles.errorText, { color: c.error }]}>{error}</Text>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(260).duration(400)}>
          <Input
            label="Email or Username"
            value={identifier}
            onChangeText={setIdentifier}
            placeholder="name@example.com or jane_doe"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(320).duration(400)}>
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            rightIcon={<Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={c.textMuted} />}
            onRightIconPress={() => setShowPw(!showPassword)}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(380).duration(400)}>
          <TouchableOpacity style={styles.forgotRow} onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={[styles.forgot, { color: c.primary }]}>Forgot password?</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(440).duration(400)}>
          <Button
            label={loading ? 'Signing in…' : 'Sign In'}
            onPress={handleLogin}
            loading={loading}
            style={styles.btnTop}
          />
        </Animated.View>

        {/* ── Social sign-in — Apple only; Google removed until real OAuth
             credentials are configured (see LoginScreen git history) ── */}
        {Platform.OS === 'ios' && (
          <>
            <Animated.View entering={FadeIn.delay(480).duration(400)} style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: c.border }]} />
              <Text style={[styles.dividerText, { color: c.textMuted }]}>or continue with</Text>
              <View style={[styles.dividerLine, { backgroundColor: c.border }]} />
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(520).duration(400)} style={styles.socialRow}>
              <TouchableOpacity
                style={[styles.socialBtn, { backgroundColor: c.black, borderColor: c.borderLight }]}
                onPress={handleApple}
                disabled={socialLoading !== null}
                activeOpacity={0.8}
              >
                {socialLoading === 'apple' ? (
                  <Text style={[styles.socialBtnText, { color: c.white }]}>Connecting…</Text>
                ) : (
                  <>
                    <Ionicons name="logo-apple" size={19} color={c.white} />
                    <Text style={[styles.socialBtnText, { color: c.white }]}>Apple</Text>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>
          </>
        )}

        {/* ── Footer ── */}
        <Animated.View entering={FadeIn.delay(580).duration(400)} style={styles.footerRow}>
          <Text style={[styles.footerText, { color: c.textSecondary }]}>Don't have an account?</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={[styles.footerLink, { color: c.primary }]}> Sign Up</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xxl, paddingBottom: spacing.xxl },

  header: { alignItems: 'center', marginBottom: spacing.xl },
  logo: {
    width: 64, height: 64, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 14, elevation: 8,
  },
  brand: { fontSize: typography.fontSizeXL, fontWeight: typography.fontWeightExtraBold, letterSpacing: 0.5 },
  tagline: { fontSize: typography.fontSizeSM, marginTop: 4 },

  titleRow: { marginBottom: spacing.lg },
  title: { fontSize: typography.fontSize2XL, fontWeight: typography.fontWeightBold, marginBottom: 4 },
  subtitle: { fontSize: typography.fontSizeMD },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md,
  },
  errorText: { fontSize: typography.fontSizeSM, flex: 1 },

  forgotRow: { alignSelf: 'flex-end', marginBottom: spacing.lg, marginTop: -spacing.sm },
  forgot: { fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightSemiBold },

  btnTop: { marginBottom: spacing.md },

  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.md },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: typography.fontSizeSM, marginHorizontal: spacing.md },

  socialRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },

  socialBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 13, borderRadius: radius.lg, gap: 8,
    borderWidth: 1,
  },
  socialBtnText: {
    fontSize: typography.fontSizeMD,
    fontWeight: typography.fontWeightSemiBold,
  },

  footerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingBottom: spacing.md },
  footerText: { fontSize: typography.fontSizeSM },
  footerLink: { fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightBold },
});
