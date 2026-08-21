import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from '../api/auth';
import { updateAvatar } from '../api/social';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { typography, spacing, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';

export const EditProfileScreen: React.FC = () => {
  const { user, updateUser } = useAuth();
  const navigation = useNavigation<any>();
  const { themeColors: c } = useTheme();

  const [fullName, setFullName]   = useState(user?.fullName ?? '');
  const [username, setUsername]   = useState(user?.username ?? '');
  const [bio, setBio]             = useState(user?.bio ?? '');
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatarUrl ?? null);
  const [avatarChanged, setAvatarChanged] = useState(false);
  const [loading, setLoading]     = useState(false);

  const initials = fullName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??';

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to change your profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
      setAvatarChanged(true);
    }
  };

  const handleSave = async () => {
    if (!fullName.trim()) { Alert.alert('Validation', 'Full name cannot be empty.'); return; }
    if (!username.trim() || username.trim().length < 3) {
      Alert.alert('Validation', 'Username must be at least 3 characters.'); return;
    }
    if (!/^[a-z0-9_.]+$/.test(username.trim().toLowerCase())) {
      Alert.alert('Validation', 'Username may only contain letters, numbers, underscores, and dots.'); return;
    }
    if (!user) return;

    setLoading(true);
    try {
      // If avatar changed, update it separately first
      let newAvatarUrl = user.avatarUrl;
      if (avatarChanged && avatarUri) {
        const res = await updateAvatar(user.userId, avatarUri);
        newAvatarUrl = res.avatarUrl;
      }

      const updated = await updateProfile(
        fullName.trim(),
        username.trim().toLowerCase(),
        bio.trim() || null,
        avatarChanged ? newAvatarUrl : undefined,
      );
      await updateUser(updated);
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.container, { backgroundColor: c.background }]}>

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={[styles.backIcon, { color: c.text }]}>‹</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: c.text }]}>Edit Profile</Text>
          <TouchableOpacity onPress={handleSave} disabled={loading} style={styles.saveBtn}>
            {loading
              ? <ActivityIndicator size="small" color={c.primary} />
              : <Text style={[styles.saveTxt, { color: c.primary }]}>Save</Text>}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Avatar picker */}
          <Animated.View entering={FadeInDown.delay(60).duration(350)} style={styles.avatarSection}>
            <TouchableOpacity onPress={pickAvatar} activeOpacity={0.8} style={styles.avatarWrap}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
              ) : (
                <LinearGradient colors={[c.primaryLight, c.primary, c.primaryDark]} style={styles.avatarFallback}>
                  <Text style={[styles.avatarInitials, { color: c.white }]}>{initials}</Text>
                </LinearGradient>
              )}
              <View style={[styles.cameraBadge, { backgroundColor: c.primary, borderColor: c.background }]}>
                <Text style={[styles.cameraIcon, { color: c.white }]}>◎</Text>
              </View>
            </TouchableOpacity>
            <Text style={[styles.changePhotoLabel, { color: c.primary }]}>Change profile photo</Text>
          </Animated.View>

          {/* Fields */}
          <Animated.View entering={FadeInDown.delay(120).duration(350)} style={[styles.fieldsCard, { backgroundColor: c.surface, borderColor: c.border }]}>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: c.textMuted }]}>FULL NAME</Text>
              <Input
                value={fullName}
                onChangeText={setFullName}
                placeholder="Your full name"
                autoCapitalize="words"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: c.textMuted }]}>USERNAME</Text>
              <Input
                value={username}
                onChangeText={t => setUsername(t.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
                placeholder="jane_doe"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={[styles.fieldHint, { color: c.textMuted }]}>Letters, numbers, underscores, dots · 3–30 chars</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: c.textMuted }]}>BIO</Text>
              <Input
                value={bio}
                onChangeText={setBio}
                placeholder="Tell people a bit about yourself…"
                multiline
                numberOfLines={3}
                style={styles.bioInput}
              />
              <Text style={[styles.fieldHint, { color: c.textMuted }, { textAlign: 'right' }]}>{bio.length}/150</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: c.textMuted }]}>EMAIL</Text>
              <View style={[styles.readonlyRow, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}>
                <Text style={[styles.readonlyValue, { color: c.textSecondary }]}>{user?.email}</Text>
                <Text style={styles.readonlyLock}>🔒</Text>
              </View>
              <Text style={[styles.fieldHint, { color: c.textMuted }]}>Email cannot be changed here</Text>
            </View>

          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(350)} style={styles.btnWrap}>
            <Button
              label={loading ? 'Saving…' : 'Save Changes'}
              onPress={handleSave}
              loading={loading}
            />
            <Button label="Cancel" onPress={() => navigation.goBack()} variant="ghost" />
          </Animated.View>

        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: 52, paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4, minWidth: 44 },
  backIcon: { fontSize: 28, lineHeight: 32 },
  headerTitle: { fontSize: typography.fontSizeLG, fontWeight: typography.fontWeightBold },
  saveBtn: { minWidth: 44, alignItems: 'flex-end', padding: 4 },
  saveTxt: { fontSize: typography.fontSizeMD, fontWeight: typography.fontWeightBold },

  scroll: { paddingBottom: 60 },

  avatarSection: { alignItems: 'center', paddingTop: spacing.xl, paddingBottom: spacing.lg },
  avatarWrap: { position: 'relative' },
  avatarImg: { width: 96, height: 96, borderRadius: 48 },
  avatarFallback: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 32, fontWeight: typography.fontWeightBold },
  cameraBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 30, height: 30, borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  cameraIcon: { fontSize: 13 },
  changePhotoLabel: { marginTop: spacing.sm, fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightSemiBold },

  fieldsCard: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  fieldGroup: { gap: 4 },
  fieldLabel: {
    fontSize: 10, fontWeight: typography.fontWeightBold,
    letterSpacing: 1.2, textTransform: 'uppercase',
    marginBottom: 4,
  },
  fieldHint: { fontSize: typography.fontSizeXS, marginTop: 4 },

  bioInput: { minHeight: 80, textAlignVertical: 'top' },

  readonlyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: radius.md, borderWidth: 1,
    paddingHorizontal: spacing.md, paddingVertical: 12,
  },
  readonlyValue: { fontSize: typography.fontSizeMD },
  readonlyLock: { fontSize: 14 },

  btnWrap: { marginHorizontal: spacing.lg, marginTop: spacing.lg, gap: 4 },
});
