import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp, ZoomIn, FadeIn } from 'react-native-reanimated';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { updateProfile, AuthResponse } from '../../api/auth';
import { ApiError } from '../../api/client';
import { typography, spacing, radius } from '../../theme';
import { AuthStackParamList } from '../../navigation/AuthNavigator';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'CompleteProfile'>;
  route: RouteProp<AuthStackParamList, 'CompleteProfile'>;
};

export const CompleteProfileScreen: React.FC<Props> = ({ navigation, route }) => {
  const { pendingUser } = route.params;
  const { signIn } = useAuth();
  const { themeColors: c } = useTheme();

  // Apple/Google never supply a username, and only sometimes supply a real
  // name — pre-fill with whatever the server auto-generated so the user is
  // editing/confirming rather than starting from a blank field.
  const [fullName, setFullName] = useState(pendingUser.fullName);
  const [username, setUsername] = useState(pendingUser.username);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const canSubmit = fullName.trim().length > 0 && username.trim().length >= 3;

  const handleContinue = async () => {
    if (!canSubmit) { setError('Please fill in both fields.'); return; }
    setError(''); setLoading(true);
    try {
      // UpdateProfile requires an authenticated request — the token exists
      // (SocialAuth already issued one) but hasn't been persisted yet since
      // signIn() is deliberately deferred until this screen is done.
      await AsyncStorage.setItem('auth_token', pendingUser.token);
      const updated = await updateProfile(fullName.trim(), username.trim().toLowerCase(), pendingUser.bio ?? null);
      await signIn(updated);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : (e.message || 'Could not save your profile.'));
    } finally { setLoading(false); }
  };

  const handleCancel = async () => {
    await AsyncStorage.removeItem('auth_token');
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <LinearGradient colors={[c.background, c.surface, c.background]} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <Animated.View entering={ZoomIn.delay(0).duration(600).springify()} style={styles.header}>
            <LinearGradient colors={[c.primary + '1F', c.primary + '0A']} style={[styles.logoRing, { shadowColor: c.primary }]}>
              <LinearGradient colors={[c.primaryLight, c.primary]} style={styles.logoInner}>
                <Text style={[styles.logoIcon, { color: c.white }]}>✦</Text>
              </LinearGradient>
            </LinearGradient>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(200).duration(500).springify()} style={[styles.form, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.title, { color: c.text }]}>Complete your profile</Text>
            <Text style={[styles.subtitle, { color: c.textSecondary }]}>
              Almost there — pick a name and username before you jump in
            </Text>
            <Text style={[styles.emailNote, { color: c.textMuted }]}>Signing in as {pendingUser.email}</Text>

            {!!error && (
              <Animated.View entering={FadeIn.duration(300)} style={[styles.errorBox, { backgroundColor: c.error + '14', borderColor: c.error + '80' }]}>
                <Text style={[styles.errorText, { color: c.error }]}>◈ {error}</Text>
              </Animated.View>
            )}

            <Animated.View entering={FadeInDown.delay(300).duration(400)}>
              <Input label="Full Name" value={fullName} onChangeText={setFullName} placeholder="Jane Doe" />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(370).duration(400)}>
              <Input
                label="Username"
                value={username}
                onChangeText={setUsername}
                placeholder="jane_doe"
                autoCapitalize="none"
                autoCorrect={false}
                hint="Letters, numbers, underscores and dots only"
              />
            </Animated.View>

            <Animated.View entering={FadeInUp.delay(440).duration(400)}>
              <Button
                label={loading ? 'Saving…' : 'Continue'}
                onPress={handleContinue}
                loading={loading}
                disabled={!canSubmit || loading}
                style={styles.btnTop}
              />
            </Animated.View>

            <Animated.View entering={FadeIn.delay(480).duration(400)}>
              <TouchableOpacity onPress={handleCancel} disabled={loading} style={styles.cancelRow}>
                <Text style={[styles.cancelText, { color: c.textMuted }]}>Not you? Go back</Text>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xxxl, paddingBottom: spacing.xxl, justifyContent: 'center' },

  header: { alignItems: 'center', marginBottom: spacing.lg },
  logoRing: {
    width: 80, height: 80, borderRadius: 24, padding: 3,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5, shadowRadius: 20, elevation: 10,
  },
  logoInner: { width: '100%', height: '100%', borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  logoIcon: { fontSize: 32 },

  form: {
    borderRadius: 28, padding: spacing.lg + 4,
    borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.4, shadowRadius: 24, elevation: 12,
  },
  title: { fontSize: typography.fontSize2XL, fontWeight: typography.fontWeightBold, marginBottom: 4 },
  subtitle: { fontSize: typography.fontSizeMD, marginBottom: spacing.sm },
  emailNote: { fontSize: typography.fontSizeSM, marginBottom: spacing.lg },

  errorBox: {
    borderWidth: 1,
    borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md,
  },
  errorText: { fontSize: typography.fontSizeSM },

  btnTop: { marginTop: spacing.sm, marginBottom: spacing.sm },
  cancelRow: { alignItems: 'center', paddingVertical: spacing.sm },
  cancelText: { fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightSemiBold },
});
