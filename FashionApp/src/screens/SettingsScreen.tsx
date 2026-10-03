import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch, Pressable,
  Alert, Modal, Linking, TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { changePassword } from '../api/auth';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Badge, IconBox, BadgeVariant } from '../components/ui/Badge';
import { typography, spacing, radius } from '../theme';

// ── Sheet modal ───────────────────────────────────────────────────────────────
const Sheet: React.FC<{
  visible: boolean; title: string; subtitle?: string;
  onClose: () => void; children: React.ReactNode;
  bgColor: string; borderColor: string; textColor: string; subColor: string;
}> = ({ visible, title, subtitle, onClose, children, bgColor, borderColor, textColor, subColor }) => (
  <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
    <View style={s.overlay}>
      <View style={[s.sheetContainer, { backgroundColor: bgColor, borderTopColor: borderColor }]}>
        <View style={[s.handle, { backgroundColor: borderColor }]} />
        <View style={s.sheetHeader}>
          <View>
            <Text style={[s.sheetTitle, { color: textColor }]}>{title}</Text>
            {subtitle && <Text style={[s.sheetSubtitle, { color: subColor }]}>{subtitle}</Text>}
          </View>
          <Pressable onPress={onClose} style={[s.closeBtn, { backgroundColor: bgColor, borderColor }]}>
            <Ionicons name="close" size={16} color={subColor} />
          </Pressable>
        </View>
        {children}
      </View>
    </View>
  </Modal>
);

// ── Menu row ──────────────────────────────────────────────────────────────────
const MenuRow: React.FC<{
  icon: keyof typeof Ionicons.glyphMap; iconVariant: BadgeVariant;
  label: string; sublabel?: string; onPress?: () => void; right?: React.ReactNode;
  textColor: string; subColor: string;
}> = ({ icon, iconVariant, label, sublabel, onPress, right, textColor, subColor }) => (
  <Pressable
    onPress={onPress}
    disabled={!onPress && right === undefined}
    style={({ pressed }) => [s.menuRow, pressed && onPress && { opacity: 0.72 }]}
  >
    <View style={s.menuLeft}>
      <IconBox icon={icon} variant={iconVariant} size={38} />
      <View style={s.menuText}>
        <Text style={[s.menuLabel, { color: textColor }]}>{label}</Text>
        {sublabel ? <Text style={[s.menuSublabel, { color: subColor }]} numberOfLines={1}>{sublabel}</Text> : null}
      </View>
    </View>
    {right !== undefined ? right : onPress && <Ionicons name="chevron-forward" size={18} color={subColor} />}
  </Pressable>
);

// ── Screen ────────────────────────────────────────────────────────────────────
export const SettingsScreen: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigation = useNavigation<any>();
  const { isDark, toggleTheme, themeColors: c } = useTheme();

  const [pwOpen, setPwOpen]       = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [notifs, setNotifs]       = useState(true);

  const [curPw, setCurPw]         = useState('');
  const [newPw, setNewPw]         = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  const openChangePassword = () => {
    setCurPw(''); setNewPw(''); setConfirmPw(''); setShowPw(false);
    setPwOpen(true);
  };

  const handleChangePassword = async () => {
    if (!curPw || !newPw || !confirmPw) { Alert.alert('Validation', 'All fields are required.'); return; }
    if (newPw.length < 6) { Alert.alert('Validation', 'New password must be at least 6 characters.'); return; }
    if (newPw !== confirmPw) { Alert.alert('Validation', 'New passwords do not match.'); return; }
    if (!user) return;
    setPwLoading(true);
    try {
      await changePassword(user.userId, curPw, newPw);
      setPwOpen(false);
      Alert.alert('Success', 'Password updated.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to change password.');
    } finally { setPwLoading(false); }
  };

  const handleSignOut = () =>
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);

  const rowProps = { textColor: c.text, subColor: c.textMuted };

  return (
    <View style={[s.container, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: c.background, borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={26} color={c.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: c.text }]}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, { paddingBottom: 48 }]}>

        {/* ── Account ── */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: c.textMuted }]}>Account</Text>
          <Card noAnimation style={[s.menuCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            <MenuRow {...rowProps}
              icon="person-outline" iconVariant="primary"
              label="Edit Profile"
              sublabel={user?.username ? `@${user.username}` : 'Update name, username, bio & photo'}
              onPress={() => navigation.navigate('EditProfile')}
            />
            <View style={[s.divider, { backgroundColor: c.border }]} />
            <MenuRow {...rowProps}
              icon="mail-outline" iconVariant="primary"
              label="Email Address"
              sublabel={user?.email ?? ''}
            />
            {!user?.isEmailVerified && (
              <>
                <View style={[s.divider, { backgroundColor: c.border }]} />
                <MenuRow {...rowProps}
                  icon="shield-checkmark-outline" iconVariant="warning"
                  label="Verify Email"
                  sublabel="Tap to verify your account"
                  onPress={() => navigation.navigate('VerifyEmail', { userId: user?.userId, email: user?.email })}
                />
              </>
            )}
          </Card>
        </View>

        {/* ── Security ── */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: c.textMuted }]}>Security</Text>
          <Card noAnimation style={[s.menuCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            <MenuRow {...rowProps}
              icon="lock-closed-outline" iconVariant="accent"
              label="Change Password"
              sublabel="Update your login password"
              onPress={openChangePassword}
            />
            <View style={[s.divider, { backgroundColor: c.border }]} />
            <MenuRow {...rowProps}
              icon="key-outline" iconVariant="accent"
              label="Two-Factor Auth"
              sublabel="Coming soon"
            />
            <View style={[s.divider, { backgroundColor: c.border }]} />
            <MenuRow {...rowProps}
              icon="time-outline" iconVariant="accent"
              label="Login Activity"
              sublabel="See where you're signed in"
            />
          </Card>
        </View>

        {/* ── Preferences ── */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: c.textMuted }]}>Preferences</Text>
          <Card noAnimation style={[s.menuCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            <MenuRow {...rowProps}
              icon="notifications-outline" iconVariant="success"
              label="Notifications"
              sublabel="Push and in-app alerts"
              right={
                <Switch
                  value={notifs} onValueChange={setNotifs}
                  trackColor={{ false: c.border, true: c.primary + '70' }}
                  thumbColor={notifs ? c.primary : c.textMuted}
                />
              }
            />
            <View style={[s.divider, { backgroundColor: c.border }]} />
            <MenuRow {...rowProps}
              icon="moon-outline" iconVariant="success"
              label="Dark Mode"
              sublabel={isDark ? 'Currently dark' : 'Currently light'}
              right={
                <Switch
                  value={isDark}
                  onValueChange={toggleTheme}
                  trackColor={{ false: c.border, true: c.primary + '70' }}
                  thumbColor={isDark ? c.primary : c.textMuted}
                />
              }
            />
          </Card>
        </View>

        {/* ── Business ── */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: c.textMuted }]}>Business</Text>
          <Card noAnimation style={[s.menuCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            <MenuRow {...rowProps}
              icon="storefront-outline" iconVariant="accent"
              label="Brand Partner API"
              sublabel="List your brand's catalog on SmartFashion"
              onPress={() => navigation.navigate('BrandPartner')}
            />
          </Card>
        </View>

        {/* ── App ── */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: c.textMuted }]}>App</Text>
          <Card noAnimation style={[s.menuCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            <MenuRow {...rowProps}
              icon="information-circle-outline" iconVariant="muted"
              label="About SmartFashion"
              sublabel="Version 1.0.0"
              onPress={() => setAboutOpen(true)}
            />
            <View style={[s.divider, { backgroundColor: c.border }]} />
            <MenuRow {...rowProps}
              icon="star-outline" iconVariant="muted"
              label="Rate the App"
              sublabel="Leave a review"
              onPress={() => Linking.openURL('https://apps.apple.com/').catch(() => {})}
            />
            <View style={[s.divider, { backgroundColor: c.border }]} />
            <MenuRow {...rowProps}
              icon="flag-outline" iconVariant="warning"
              label="Report an Issue"
              sublabel="Send feedback by email"
              onPress={() => Linking.openURL('mailto:support@smartfashion.com?subject=Issue%20Report').catch(() => {})}
            />
          </Card>
        </View>

        {/* ── Sign Out ── */}
        <View style={s.section}>
          <Button label="Sign Out" onPress={handleSignOut} variant="outline" />
        </View>

        <Text style={[s.version, { color: c.textMuted }]}>SmartFashion  ·  v1.0.0</Text>
      </ScrollView>

      {/* Change Password Sheet */}
      <Sheet
        visible={pwOpen} title="Change Password" subtitle="Choose a strong password"
        onClose={() => setPwOpen(false)}
        bgColor={c.surface} borderColor={c.border} textColor={c.text} subColor={c.textMuted}
      >
        <Input label="Current Password" value={curPw} onChangeText={setCurPw}
          placeholder="Enter current password" secureTextEntry={!showPw} autoCapitalize="none" />
        <Input label="New Password" value={newPw} onChangeText={setNewPw}
          placeholder="Minimum 6 characters" secureTextEntry={!showPw} autoCapitalize="none" />
        <Input label="Confirm New Password" value={confirmPw} onChangeText={setConfirmPw}
          placeholder="Re-enter new password" secureTextEntry={!showPw} autoCapitalize="none"
          rightIcon={<Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={16} color={c.primary} />}
          onRightIconPress={() => setShowPw(v => !v)}
        />
        <Button label={pwLoading ? 'Updating…' : 'Update Password'} onPress={handleChangePassword}
          loading={pwLoading} style={{ marginTop: spacing.sm }} />
        <Button label="Cancel" onPress={() => setPwOpen(false)} variant="ghost" />
      </Sheet>

      {/* About Sheet */}
      <Sheet
        visible={aboutOpen} title="About SmartFashion"
        onClose={() => setAboutOpen(false)}
        bgColor={c.surface} borderColor={c.border} textColor={c.text} subColor={c.textMuted}
      >
        <View style={s.aboutContent}>
          <LinearGradient colors={[c.primaryLight, c.primary]} style={s.aboutLogo}>
            <Ionicons name="shirt" size={30} color={c.white} />
          </LinearGradient>
          <Text style={[s.aboutAppName, { color: c.text }]}>SmartFashion</Text>
          <Badge label="Version 1.0.0" variant="primary" size="md" />
          <View style={[s.aboutDivider, { backgroundColor: c.border }]} />
          <Text style={[s.aboutDescription, { color: c.textSecondary }]}>
            SmartFashion is an AI-powered styling assistant that uses computer vision and
            large language models to recommend personalised outfits and let you virtually
            try on any look before purchasing.
          </Text>
          <Text style={[s.aboutFooter, { color: c.textMuted }]}>Built as a Final Year Project  ·  2025–2026</Text>
        </View>
        <Button label="Close" onPress={() => setAboutOpen(false)} variant="outline" style={{ marginTop: spacing.md }} />
      </Sheet>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: 52, paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, padding: 4 },
  headerTitle: { fontSize: typography.fontSizeLG, fontWeight: typography.fontWeightBold },
  scroll: { paddingTop: spacing.sm },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.md },
  sectionTitle: {
    fontSize: typography.fontSizeXS, fontWeight: typography.fontWeightBold,
    letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: spacing.sm,
  },
  menuCard: { padding: 0, overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  menuText: { flex: 1 },
  menuLabel: { fontSize: typography.fontSizeMD, fontWeight: typography.fontWeightMedium },
  menuSublabel: { fontSize: typography.fontSizeXS, marginTop: 2 },
  divider: { height: 1, marginLeft: spacing.md + 38 + spacing.md },
  version: { textAlign: 'center', fontSize: typography.fontSizeXS, marginTop: spacing.lg, letterSpacing: 0.8 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000060' },
  sheetContainer: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl,
    borderTopWidth: 1,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: spacing.md, marginBottom: spacing.md },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg },
  sheetTitle: { fontSize: typography.fontSizeXL, fontWeight: typography.fontWeightBold },
  sheetSubtitle: { fontSize: typography.fontSizeSM, marginTop: 4 },
  closeBtn: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  aboutContent: { alignItems: 'center', gap: spacing.md },
  aboutLogo: { width: 72, height: 72, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  aboutAppName: { fontSize: typography.fontSize2XL, fontWeight: typography.fontWeightBold },
  aboutDivider: { width: '100%', height: 1 },
  aboutDescription: { fontSize: typography.fontSizeSM, textAlign: 'center', lineHeight: 22 },
  aboutFooter: { fontSize: typography.fontSizeXS, letterSpacing: 0.5 },
});
