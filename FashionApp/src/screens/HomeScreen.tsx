import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Animated, {
  FadeInDown, FadeInUp, FadeIn,
  useSharedValue, useAnimatedStyle, withSpring,
} from 'react-native-reanimated';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Badge, IconBox, BadgeVariant } from '../components/ui/Badge';
import { getConversations } from '../api/social';
import { typography, spacing, radius, shadows } from '../theme';

type Props = { navigation: any };

type Feature = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
  screen: string;
  variant: BadgeVariant;
};

// Wearing comes first: try-on and AI styling lead the grid. Shopping and the
// style feed are here too, but as browsing, not a social home base.
const FEATURES: Feature[] = [
  { icon: 'shirt-outline',      title: 'Virtual Try-On',  desc: 'Preview looks on yourself',       screen: 'TryOn',      variant: 'primary' },
  { icon: 'color-wand-outline', title: 'AI Recommender',  desc: 'Outfit ideas tailored to you',    screen: 'Recommend',  variant: 'accent'  },
  { icon: 'bag-handle-outline', title: 'Brand Shop',      desc: 'Browse real pieces to try on',    screen: 'BrandShop',  variant: 'success' },
  { icon: 'images-outline',     title: 'Style Feed',      desc: 'Looks from the community',        screen: 'Feed',       variant: 'muted'   },
];

const STATS: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }[] = [
  { icon: 'sparkles-outline',       label: 'AI Models',     value: '2+'   },
  { icon: 'color-palette-outline',  label: 'Style Moods',   value: '∞'    },
  { icon: 'flash-outline',          label: 'Availability',  value: '24/7' },
];

const TIPS = [
  'Layer different textures for a dynamic look.',
  'Neutral tones are your foundation — build from there.',
  'Accessories elevate any outfit instantly.',
  'Fit and proportion matter more than brand.',
];

const FeatureTile: React.FC<{
  feature: Feature; index: number; onPress: () => void;
}> = ({ feature, index, onPress }) => {
  const { themeColors: c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const scale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View
      entering={FadeInDown.delay(180 + index * 90).duration(420).springify()}
      style={[styles.tile, scaleStyle]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.96, { damping: 18, stiffness: 400 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 12, stiffness: 200 }); }}
        style={styles.tileInner}
      >
        <IconBox icon={feature.icon} variant={feature.variant} size={42} />
        <View>
          <Text style={styles.tileTitle}>{feature.title}</Text>
          <Text style={styles.tileDesc} numberOfLines={2}>{feature.desc}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
};

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const { themeColors: c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const firstName = user?.fullName?.split(' ')[0] ?? 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
  const tip = TIPS[new Date().getDay() % TIPS.length];
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);

  // Messaging doesn't get its own tab anymore — just a quiet icon here.
  useFocusEffect(
    React.useCallback(() => {
      if (!user?.userId) return;
      getConversations(user.userId)
        .then(convs => setUnreadMsgCount(convs.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0)))
        .catch(() => {});
    }, [user?.userId])
  );

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Header ── */}
        <Animated.View entering={FadeIn.duration(500)} style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting},</Text>
            <View style={styles.nameRow}>
              <Text style={styles.heroName}>{firstName}</Text>
              <Badge label="Member" variant="primary" dot size="sm" />
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable onPress={() => navigation.navigate('Chats')} style={styles.msgBtn}>
              <Ionicons name="chatbubble-outline" size={22} color={c.text} />
              {unreadMsgCount > 0 && (
                <View style={styles.msgBadge}>
                  <Text style={styles.msgBadgeText}>{unreadMsgCount > 9 ? '9+' : unreadMsgCount}</Text>
                </View>
              )}
            </Pressable>
            <Pressable onPress={() => navigation.navigate('Profile')} style={styles.avatarBtn}>
              <LinearGradient colors={[c.primaryLight, c.primary]} style={styles.avatar}>
                <Text style={styles.avatarText}>{firstName[0].toUpperCase()}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </Animated.View>

        {/* ── Try-On CTA ── */}
        <Animated.View entering={FadeInUp.delay(120).duration(450)} style={styles.ctaWrapper}>
          <Pressable onPress={() => navigation.navigate('TryOn')}>
            <LinearGradient colors={[c.primaryLight, c.primary, c.primaryDark]} style={styles.cta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <View style={styles.ctaIconCircle}>
                <Ionicons name="shirt" size={22} color={c.white} />
              </View>
              <View style={styles.ctaBody}>
                <Text style={styles.ctaLabel}>VIRTUAL TRY-ON</Text>
                <Text style={styles.ctaTitle}>Try On an Outfit Now</Text>
              </View>
              <Ionicons name="arrow-forward" size={20} color={c.white} />
            </LinearGradient>
          </Pressable>
        </Animated.View>

        {/* ── Section heading ── */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Explore</Text>
          <Text style={styles.sectionSub}>What would you like to do today?</Text>
        </Animated.View>

        {/* ── Feature grid ── */}
        <View style={styles.grid}>
          {FEATURES.map((f, i) => (
            <FeatureTile key={f.screen} feature={f} index={i} onPress={() => navigation.navigate(f.screen)} />
          ))}
        </View>

        {/* ── Stats ── */}
        <Animated.View entering={FadeInUp.delay(560).duration(450)} style={styles.statsRow}>
          {STATS.map((s, i) => (
            <View key={s.label} style={[styles.statItem, i < STATS.length - 1 && styles.statBorder]}>
              <Ionicons name={s.icon} size={18} color={c.primary} style={styles.statIcon} />
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </Animated.View>

        {/* ── Tip ── */}
        <Animated.View entering={FadeIn.delay(680).duration(450)} style={styles.tipRow}>
          <Ionicons name="bulb-outline" size={16} color={c.primary} />
          <Text style={styles.tipText}>{tip}</Text>
        </Animated.View>

      </ScrollView>
    </View>
  );
};

const makeStyles = (c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg },
  greeting: { fontSize: typography.fontSizeSM, color: c.textSecondary, letterSpacing: 0.3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  heroName: { fontSize: typography.fontSize3XL, fontWeight: typography.fontWeightExtraBold as any, color: c.text, letterSpacing: -0.5 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  msgBtn: { padding: 6 },
  msgBadge: {
    position: 'absolute', top: 2, right: 2, minWidth: 15, height: 15, borderRadius: 8,
    backgroundColor: c.error, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: c.background,
  },
  msgBadgeText: { fontSize: 8, fontWeight: '800' as any, color: c.white, lineHeight: 10 },
  avatarBtn: { shadowColor: c.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  avatar: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: typography.fontSizeLG, fontWeight: typography.fontWeightBold as any, color: c.white },

  ctaWrapper: { borderRadius: radius.xl, overflow: 'hidden', ...shadows.primary, shadowColor: c.primary, marginBottom: spacing.xl },
  cta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md + 4, borderRadius: radius.xl },
  ctaIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.white + '22', alignItems: 'center', justifyContent: 'center' },
  ctaBody: { flex: 1 },
  ctaLabel: { fontSize: 9, fontWeight: typography.fontWeightBold as any, color: c.white + 'B3', letterSpacing: 1.6, marginBottom: 2 },
  ctaTitle: { fontSize: typography.fontSizeLG, fontWeight: typography.fontWeightBold as any, color: c.white },

  sectionHead: { marginBottom: spacing.md },
  sectionTitle: { fontSize: typography.fontSize2XL, fontWeight: typography.fontWeightBold as any, color: c.text },
  sectionSub: { fontSize: typography.fontSizeSM, color: c.textSecondary, marginTop: 4 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.md },
  tile: {
    width: '48.5%', backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
    borderRadius: radius.lg, minHeight: 148,
  },
  tileInner: { flex: 1, padding: spacing.md, justifyContent: 'space-between' },
  tileTitle: { fontSize: typography.fontSizeMD, fontWeight: typography.fontWeightBold as any, color: c.text, marginTop: spacing.sm },
  tileDesc: { fontSize: typography.fontSizeXS, color: c.textSecondary, lineHeight: 16, marginTop: 3 },

  statsRow: {
    flexDirection: 'row', marginTop: spacing.xl,
    backgroundColor: c.surface, borderRadius: radius.xl,
    borderWidth: 1, borderColor: c.border,
  },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: spacing.md + 4 },
  statBorder: { borderRightWidth: 1, borderRightColor: c.border },
  statIcon: { marginBottom: 6 },
  statValue: { fontSize: typography.fontSize2XL, fontWeight: typography.fontWeightExtraBold as any, color: c.text },
  statLabel: { fontSize: typography.fontSizeXS, color: c.textMuted, letterSpacing: 0.6, marginTop: 3, textTransform: 'uppercase' },

  tipRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg, paddingHorizontal: spacing.xs },
  tipText: { flex: 1, fontSize: typography.fontSizeSM, color: c.textSecondary, fontStyle: 'italic', lineHeight: 18 },
});
