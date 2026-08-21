import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp, ZoomIn, FadeIn } from 'react-native-reanimated';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { register, socialAuth } from '../../api/auth';
import { typography, spacing, radius } from '../../theme';
import { AuthStackParamList } from '../../navigation/AuthNavigator';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID     = 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID     = 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com';
const GOOGLE_ANDROID_CLIENT_ID = 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com';

type Props = { navigation: NativeStackNavigationProp<AuthStackParamList, 'Register'> };

export const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const { signIn } = useAuth();
  const { themeColors: c } = useTheme();
  const [fullName, setFullName]     = useState('');
  const [username, setUsername]     = useState('');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [confirm, setConfirm]       = useState('');
  const [showPw, setShowPw]         = useState(false);
  const [error, setError]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [socialLoading, setSocial]  = useState<'google' | 'apple' | null>(null);

  const redirectUri = makeRedirectUri({ scheme: 'smart-fashion' });

  const [googleRequest, googleResponse, googlePrompt] = Google.useAuthRequest({
    clientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    redirectUri,
  });

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const token = googleResponse.authentication?.accessToken;
      if (token) fetchGoogleUser(token);
    } else if (googleResponse?.type === 'error') {
      setError('Google sign-in failed. Please try again.');
      setSocial(null);
    } else if (googleResponse?.type === 'dismiss') {
      setSocial(null);
    }
  }, [googleResponse]);

  const fetchGoogleUser = async (accessToken: string) => {
    try {
      const res = await fetch('https://www.googleapis.com/userinfo/v2/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const info = await res.json();
      const user = await socialAuth('google', info.email, info.name ?? '', info.id ?? '');
      if (user.isNewAccount) {
        navigation.navigate('CompleteProfile', { pendingUser: user });
      } else {
        await signIn(user);
      }
    } catch (e: any) {
      setError(e.message || 'Google sign-in failed.');
    } finally { setSocial(null); }
  };

  const handleRegister = async () => {
    if (!fullName.trim() || !username.trim() || !email.trim() || !password || !confirm) {
      setError('All fields are required.'); return;
    }
    if (username.trim().length < 3) { setError('Username must be at least 3 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setError(''); setLoading(true);
    try {
      const res = await register({
        fullName: fullName.trim(),
        username: username.trim().toLowerCase(),
        email: email.trim(),
        password,
      });
      // Sign in immediately — user enters the app right away.
      // A verification code was emailed; they can verify later from Profile → Account.
      await signIn(res);
    } catch (e: any) {
      setError(e.message || 'Registration failed. Please try again.');
    } finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    setSocial('google'); setError('');
    await googlePrompt();
  };

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
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <LinearGradient colors={[c.background, c.surface, c.background]} style={styles.flex}>

        <View style={[styles.orb1, { backgroundColor: c.accent + '07' }]} />
        <View style={[styles.orb2, { backgroundColor: c.primary + '07' }]} />

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Logo */}
          <Animated.View entering={ZoomIn.delay(0).duration(600).springify()} style={styles.header}>
            <LinearGradient colors={[c.primary + '1F', c.primary + '0A']} style={[styles.logoRing, { shadowColor: c.primary }]}>
              <LinearGradient colors={[c.primaryLight, c.primary]} style={styles.logoInner}>
                <Text style={[styles.logoIcon, { color: c.white }]}>✦</Text>
              </LinearGradient>
            </LinearGradient>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.brandRow}>
            <Text style={[styles.brand, { color: c.text }]}>SmartFashion</Text>
            <Text style={[styles.tagline, { color: c.textMuted }]}>Join the future of fashion</Text>
          </Animated.View>

          {/* Form */}
          <Animated.View entering={FadeInUp.delay(350).duration(500).springify()} style={[styles.form, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.title, { color: c.text }]}>Create Account</Text>
            <Text style={[styles.subtitle, { color: c.textSecondary }]}>Start your style journey today</Text>

            {!!error && (
              <Animated.View entering={FadeIn.duration(300)} style={[styles.errorBox, { backgroundColor: c.error + '14', borderColor: c.error + '80' }]}>
                <Text style={[styles.errorText, { color: c.error }]}>◈ {error}</Text>
              </Animated.View>
            )}

            {[
              { label: 'Full Name',     value: fullName, setter: setFullName, placeholder: 'Jane Doe',           extra: {} },
              { label: 'Username',      value: username, setter: setUsername, placeholder: 'jane_doe',           extra: { autoCapitalize: 'none' as const, autoCorrect: false } },
              { label: 'Email Address', value: email,    setter: setEmail,    placeholder: 'name@example.com',   extra: { keyboardType: 'email-address' as const, autoCapitalize: 'none' as const } },
            ].map((f, i) => (
              <Animated.View key={f.label} entering={FadeInDown.delay(450 + i * 80).duration(400)}>
                <Input label={f.label} value={f.value} onChangeText={f.setter} placeholder={f.placeholder} {...f.extra} />
              </Animated.View>
            ))}

            <Animated.View entering={FadeInDown.delay(610).duration(400)}>
              <Input
                label="Password" value={password} onChangeText={setPassword}
                placeholder="Minimum 6 characters" secureTextEntry={!showPw} autoCapitalize="none"
                rightIcon={<Text style={[styles.eyeIcon, { color: c.textMuted }]}>{showPw ? '◑' : '◎'}</Text>}
                onRightIconPress={() => setShowPw(!showPw)}
              />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(690).duration(400)}>
              <Input
                label="Confirm Password" value={confirm} onChangeText={setConfirm}
                placeholder="Re-enter your password" secureTextEntry={!showPw} autoCapitalize="none"
              />
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(760).duration(400)}>
              <Button
                label={loading ? 'Creating account…' : 'Create Account'}
                onPress={handleRegister}
                loading={loading}
                style={styles.btnTop}
              />
            </Animated.View>

            {/* ── Social Divider ── */}
            <Animated.View entering={FadeIn.delay(800).duration(400)} style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: c.border }]} />
              <Text style={[styles.dividerText, { color: c.textMuted }]}>or continue with</Text>
              <View style={[styles.dividerLine, { backgroundColor: c.border }]} />
            </Animated.View>

            {/* ── Social Buttons ── */}
            <Animated.View entering={FadeInUp.delay(850).duration(400)} style={styles.socialRow}>
              <TouchableOpacity
                style={[styles.socialBtn, styles.googleBtn, { backgroundColor: c.white, borderColor: c.border }]}
                onPress={handleGoogle}
                disabled={socialLoading !== null || !googleRequest}
                activeOpacity={0.8}
              >
                {socialLoading === 'google' ? (
                  <Text style={[styles.googleBtnText, { color: c.black }]}>Connecting…</Text>
                ) : (
                  <>
                    <Text style={styles.googleLogo}>G</Text>
                    <Text style={[styles.googleBtnText, { color: c.black }]}>Google</Text>
                  </>
                )}
              </TouchableOpacity>

              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={[styles.socialBtn, styles.appleBtn, { backgroundColor: c.black, borderColor: c.borderLight }]}
                  onPress={handleApple}
                  disabled={socialLoading !== null}
                  activeOpacity={0.8}
                >
                  {socialLoading === 'apple' ? (
                    <Text style={[styles.appleBtnText, { color: c.white }]}>Connecting…</Text>
                  ) : (
                    <>
                      <Text style={[styles.appleLogo, { color: c.white }]}></Text>
                      <Text style={[styles.appleBtnText, { color: c.white }]}>Apple</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </Animated.View>

            <Animated.View entering={FadeIn.delay(900).duration(400)}>
              <Button
                label="Already have an account? Sign In"
                onPress={() => navigation.navigate('Login')}
                variant="ghost"
              />
            </Animated.View>
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xxxl, paddingBottom: spacing.xxl },
  orb1: { position: 'absolute', top: -80, right: -80, width: 280, height: 280, borderRadius: 140 },
  orb2: { position: 'absolute', bottom: 80, left: -100, width: 300, height: 300, borderRadius: 150 },

  header: { alignItems: 'center', marginBottom: spacing.lg },
  logoRing: {
    width: 80, height: 80, borderRadius: 24, padding: 3,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5, shadowRadius: 20, elevation: 10,
  },
  logoInner: { width: '100%', height: '100%', borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  logoIcon: { fontSize: 32 },

  brandRow: { alignItems: 'center', marginBottom: spacing.xl },
  brand: { fontSize: typography.fontSize2XL + 2, fontWeight: typography.fontWeightExtraBold, letterSpacing: 1.5 },
  tagline: { fontSize: typography.fontSizeSM, marginTop: spacing.xs, letterSpacing: 0.5 },

  form: {
    borderRadius: 28, padding: spacing.lg + 4,
    borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.4, shadowRadius: 24, elevation: 12,
  },
  title: { fontSize: typography.fontSize2XL, fontWeight: typography.fontWeightBold, marginBottom: 4 },
  subtitle: { fontSize: typography.fontSizeMD, marginBottom: spacing.lg },

  errorBox: {
    borderWidth: 1,
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md,
  },
  errorText: { fontSize: typography.fontSizeSM },

  eyeIcon: { fontSize: 16 },
  btnTop: { marginBottom: spacing.md },

  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.md },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: typography.fontSizeSM, marginHorizontal: spacing.md },

  socialRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },

  socialBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 13, borderRadius: radius.lg, gap: 8, borderWidth: 1,
  },
  googleBtn: {},
  googleLogo: { fontSize: 16, fontWeight: '700', color: '#4285F4' },
  googleBtnText: { fontSize: typography.fontSizeMD, fontWeight: typography.fontWeightSemiBold },

  appleBtn: {},
  appleLogo: { fontSize: 17, lineHeight: 20 },
  appleBtnText: { fontSize: typography.fontSizeMD, fontWeight: typography.fontWeightSemiBold },
});
