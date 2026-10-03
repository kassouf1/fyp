import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp, ZoomIn, FadeIn } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { forgotPassword, resetPassword } from '../../api/auth';
import { typography, spacing, radius } from '../../theme';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 60;

export const ForgotPasswordScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { signIn } = useAuth();
  const { themeColors: c } = useTheme();

  const [step, setStep]                   = useState<'email' | 'reset'>('email');
  const [email, setEmail]                 = useState('');
  const [code, setCode]                   = useState('');
  const [newPassword, setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPw]   = useState('');
  const [showPw, setShowPw]               = useState(false);
  const [error, setError]                 = useState('');
  const [successMsg, setSuccessMsg]       = useState('');
  const [loading, setLoading]             = useState(false);
  const [resendCooldown, setCooldown]     = useState(0);
  const [resendLoading, setResendLoading] = useState(false);

  const inputRef    = useRef<TextInput>(null);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, []);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN);
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  // ── Step 1: request a code ──────────────────────────────────────────────────
  const handleSendCode = async () => {
    if (!email.trim()) { setError('Please enter your email.'); return; }
    setError(''); setLoading(true);
    try {
      await forgotPassword(email.trim());
      setSuccessMsg('If an account exists for that email, a reset code has been sent.');
      setStep('reset');
      startCooldown();
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resendLoading) return;
    setResendLoading(true); setError(''); setSuccessMsg('');
    try {
      await forgotPassword(email.trim());
      setCode('');
      setSuccessMsg('A new code has been sent to your email.');
      startCooldown();
    } catch (e: any) {
      setError(e.message || 'Failed to resend code.');
    } finally { setResendLoading(false); }
  };

  // ── Step 2: enter code + new password ───────────────────────────────────────
  const handleReset = async () => {
    if (code.length < CODE_LENGTH) { setError('Please enter the 6-digit code.'); return; }
    if (newPassword.length < 6) { setError('New password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    setError(''); setLoading(true);
    try {
      const user = await resetPassword(email.trim(), code, newPassword);
      await signIn(user);
    } catch (e: any) {
      setError(e.message || 'Invalid or expired code.');
    } finally { setLoading(false); }
  };

  const digits = Array.from({ length: CODE_LENGTH }, (_, i) => code[i] ?? '');

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <LinearGradient colors={[c.background, c.surface, c.background]} style={styles.flex}>

        <View style={[styles.orb1, { backgroundColor: c.primary + '08' }]} />
        <View style={[styles.orb2, { backgroundColor: c.accent + '06' }]} />

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={c.text} />
          </TouchableOpacity>

          <Animated.View entering={ZoomIn.delay(0).duration(600).springify()} style={styles.header}>
            <LinearGradient colors={[c.primary + '1F', c.primary + '0A']} style={[styles.logoRing, { shadowColor: c.primary }]}>
              <LinearGradient colors={[c.primaryLight, c.primary]} style={styles.logoInner}>
                <Text style={[styles.logoIcon, { color: c.white }]}>✦</Text>
              </LinearGradient>
            </LinearGradient>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(500)} style={styles.brandRow}>
            <Text style={[styles.brand, { color: c.text }]}>SmartFashion</Text>
            <Text style={[styles.tagline, { color: c.textMuted }]}>
              {step === 'email' ? 'Reset your password' : 'Choose a new password'}
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(350).duration(500).springify()} style={[styles.form, { backgroundColor: c.surface, borderColor: c.border }]}>
            {step === 'email' ? (
              <>
                <Text style={[styles.title, { color: c.text }]}>Forgot password?</Text>
                <Text style={[styles.subtitle, { color: c.textSecondary }]}>
                  Enter the email on your account and we'll send you a reset code.
                </Text>

                {!!error && (
                  <Animated.View entering={FadeIn.duration(300)} style={[styles.errorBox, { backgroundColor: c.error + '14', borderColor: c.error + '80' }]}>
                    <Text style={[styles.errorText, { color: c.error }]}>◈ {error}</Text>
                  </Animated.View>
                )}

                <Animated.View entering={FadeInDown.delay(450).duration(400)}>
                  <Input
                    label="Email Address"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="name@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </Animated.View>

                <Animated.View entering={FadeInUp.delay(550).duration(400)}>
                  <Button
                    label={loading ? 'Sending…' : 'Send Reset Code'}
                    onPress={handleSendCode}
                    loading={loading}
                    style={styles.btnTop}
                  />
                </Animated.View>
              </>
            ) : (
              <>
                <Text style={[styles.title, { color: c.text }]}>Check your inbox</Text>
                <Text style={[styles.subtitle, { color: c.textSecondary }]}>
                  Enter the 6-digit code sent to{'\n'}
                  <Text style={[styles.emailHighlight, { color: c.primary }]}>{email.trim()}</Text>
                </Text>

                {!!error && (
                  <Animated.View entering={FadeIn.duration(300)} style={[styles.errorBox, { backgroundColor: c.error + '14', borderColor: c.error + '80' }]}>
                    <Text style={[styles.errorText, { color: c.error }]}>◈ {error}</Text>
                  </Animated.View>
                )}
                {!!successMsg && (
                  <Animated.View entering={FadeIn.duration(300)} style={[styles.successBox, { backgroundColor: c.success + '14', borderColor: c.success + '80' }]}>
                    <Text style={[styles.successText, { color: c.success }]}>◎ {successMsg}</Text>
                  </Animated.View>
                )}

                <Animated.View entering={FadeInDown.delay(450).duration(400)}>
                  <TouchableOpacity activeOpacity={1} onPress={() => inputRef.current?.focus()} style={styles.otpRow}>
                    {digits.map((d, i) => (
                      <View
                        key={i}
                        style={[
                          styles.otpBox,
                          { borderColor: c.border, backgroundColor: c.surfaceElevated },
                          code.length === i && { borderColor: c.primary },
                          d !== '' && { borderColor: c.primary + '80', backgroundColor: c.primary + '1A' },
                        ]}
                      >
                        <Text style={[styles.otpDigit, { color: c.text }]}>{d}</Text>
                        {code.length === i && d === '' && <View style={[styles.cursor, { backgroundColor: c.primary }]} />}
                      </View>
                    ))}
                    <TextInput
                      ref={inputRef}
                      value={code}
                      onChangeText={v => { setCode(v.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH)); setError(''); }}
                      keyboardType="number-pad"
                      maxLength={CODE_LENGTH}
                      style={styles.hiddenInput}
                      autoFocus
                    />
                  </TouchableOpacity>
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(500).duration(400)}>
                  <Input
                    label="New Password"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Minimum 6 characters"
                    secureTextEntry={!showPw}
                    autoCapitalize="none"
                    rightIcon={<Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={16} color={c.textMuted} />}
                    onRightIconPress={() => setShowPw(v => !v)}
                  />
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(550).duration(400)}>
                  <Input
                    label="Confirm New Password"
                    value={confirmPassword}
                    onChangeText={setConfirmPw}
                    placeholder="Re-enter your new password"
                    secureTextEntry={!showPw}
                    autoCapitalize="none"
                  />
                </Animated.View>

                <Animated.View entering={FadeInUp.delay(600).duration(400)}>
                  <Button
                    label={loading ? 'Resetting…' : 'Reset Password'}
                    onPress={handleReset}
                    loading={loading}
                    style={styles.btnTop}
                  />
                </Animated.View>

                <Animated.View entering={FadeIn.delay(650).duration(400)} style={styles.resendRow}>
                  <Text style={[styles.resendLabel, { color: c.textSecondary }]}>Didn't receive a code? </Text>
                  {resendCooldown > 0 ? (
                    <Text style={[styles.resendCooldown, { color: c.textMuted }]}>Resend in {resendCooldown}s</Text>
                  ) : (
                    <TouchableOpacity onPress={handleResend} disabled={resendLoading}>
                      <Text style={[styles.resendLink, { color: c.primary }]}>{resendLoading ? 'Sending…' : 'Resend code'}</Text>
                    </TouchableOpacity>
                  )}
                </Animated.View>
              </>
            )}
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xxl },
  orb1: { position: 'absolute', top: -80, left: -80, width: 280, height: 280, borderRadius: 140 },
  orb2: { position: 'absolute', bottom: 100, right: -100, width: 320, height: 320, borderRadius: 160 },

  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },

  header: { alignItems: 'center', marginBottom: spacing.lg },
  logoRing: {
    width: 80, height: 80, borderRadius: 24, padding: 3,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 10,
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
  subtitle: { fontSize: typography.fontSizeMD, marginBottom: spacing.lg, lineHeight: 22 },
  emailHighlight: { fontWeight: typography.fontWeightSemiBold },

  errorBox: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  errorText: { fontSize: typography.fontSizeSM },
  successBox: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  successText: { fontSize: typography.fontSizeSM },

  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg, marginTop: spacing.sm, position: 'relative' },
  otpBox: {
    width: 46, height: 56, borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  otpDigit: { fontSize: 22, fontWeight: typography.fontWeightBold },
  cursor: { width: 2, height: 22, borderRadius: 1 },
  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1 },

  btnTop: { marginTop: spacing.xs, marginBottom: spacing.xs },

  resendRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: spacing.md },
  resendLabel: { fontSize: typography.fontSizeSM },
  resendCooldown: { fontSize: typography.fontSizeSM },
  resendLink: { fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightSemiBold },
});
