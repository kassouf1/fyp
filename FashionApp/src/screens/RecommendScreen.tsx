import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, Image, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown, FadeInUp, FadeIn,
  useSharedValue, useAnimatedStyle, withSpring,
} from 'react-native-reanimated';
import { recommendOutfit, OutfitItem } from '../api/outfit';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge, IconBox } from '../components/ui/Badge';
import { typography, spacing, radius, shadows } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { OUTFIT_RECOMMENDER_BASE_URL } from '../api/client';

const PROMPT_SUGGESTIONS = [
  'Casual summer outfit for a beach day',
  'Elegant black outfit for a dinner date',
  'Streetwear look for men',
  'Business casual for the office',
  'Cozy autumn outfit in earth tones',
  'Something elegant for a wedding',
];

const Chip: React.FC<{ label: string; selected: boolean; onPress: () => void }> = ({ label, selected, onPress }) => {
  const { themeColors: c } = useTheme();
  const scale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={scaleStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.92, { damping: 18, stiffness: 500 }); }}
        onPressOut={() => { scale.value = withSpring(1,    { damping: 12, stiffness: 200 }); }}
      >
        {selected ? (
          <LinearGradient colors={[c.primaryLight, c.primary]} style={styles.chipActive} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Text style={[styles.chipActiveText, { color: c.white }]}>◆ {label}</Text>
          </LinearGradient>
        ) : (
          <View style={[styles.chip, { borderColor: c.border, backgroundColor: c.surface }]}>
            <Text style={[styles.chipText, { color: c.textSecondary }]}>{label}</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
};

// Piece row icons — letter in a themed box instead of emoji
const PIECE_CONFIG = [
  { key: 'top',    symbol: 'T', label: 'Top',    variant: 'primary' as const },
  { key: 'bottom', symbol: 'B', label: 'Bottom', variant: 'accent'  as const },
];

const OutfitCard: React.FC<{ outfit: OutfitItem; index: number; onTryOn: (o: OutfitItem) => void }> = ({ outfit, index, onTryOn }) => {
  const { themeColors: c } = useTheme();
  // Show the whole outfit (top + bottom) side by side, not just the top
  // garment, whenever the recommendation has both pieces — falls back to
  // the single top image for top-only combinations.
  const hasFullOutfit = !!(outfit.imageUrl && outfit.bottomImageUrl);
  return (
    <Card delay={index * 110} elevated style={styles.outfitCard}>
      {hasFullOutfit ? (
        <View style={styles.outfitCollage}>
          <Image source={{ uri: outfit.imageUrl }} style={[styles.collageMain, { backgroundColor: c.surfaceElevated }]} resizeMode="cover" />
          <Image source={{ uri: outfit.bottomImageUrl }} style={[styles.collageSideImage, { backgroundColor: c.surfaceElevated }]} resizeMode="cover" />
        </View>
      ) : outfit.imageUrl && (
        <Image source={{ uri: outfit.imageUrl }} style={[styles.outfitImage, { backgroundColor: c.surfaceElevated }]} resizeMode="cover" />
      )}
      <View style={styles.outfitHeader}>
        <View style={[styles.outfitIndexBox, { borderColor: c.primary + '45', backgroundColor: c.primary + '12' }]}>
          <Text style={[styles.outfitIndex, { color: c.primary }]}>{String(index + 1).padStart(2, '0')}</Text>
        </View>
        <View style={styles.outfitHeaderRight}>
          <Text style={[styles.outfitTitle, { color: c.text }]}>{outfit.title || `Look ${index + 1}`}</Text>
          <Badge label="AI CURATED" variant="primary" />
        </View>
      </View>

      <View style={[styles.separator, { backgroundColor: c.border }]} />

      <View style={styles.pieces}>
        {PIECE_CONFIG.map(p => {
          const val = (outfit as any)[p.key];
          if (!val) return null;
          return (
            <View key={p.key} style={[styles.piece, { backgroundColor: c.background }]}>
              <IconBox symbol={p.symbol} variant={p.variant} size={36} />
              <View style={styles.pieceBody}>
                <Text style={[styles.pieceLabel, { color: c.textMuted }]}>{p.label}</Text>
                <Text style={[styles.pieceValue, { color: c.text }]}>{val}</Text>
              </View>
            </View>
          );
        })}
      </View>

      <Pressable onPress={() => onTryOn(outfit)} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}>
        <LinearGradient colors={[c.primaryLight, c.primary, c.primaryDark]} style={styles.tryOnBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          <Text style={[styles.tryOnBtnText, { color: c.white }]}>◈  Try This On</Text>
        </LinearGradient>
      </Pressable>
    </Card>
  );
};

type Props = { navigation: any; route: any };

export const RecommendScreen: React.FC<Props> = ({ navigation, route }) => {
  const { themeColors: c } = useTheme();
  const presets = route.params ?? {};
  const [prompt, setPrompt] = useState<string>(presets.prompt ?? '');
  const [results, setResults] = useState<OutfitItem[]>([]);
  const [loading, setLoading] = useState(false);

  const canSubmit = prompt.trim().length > 0;

  const handleRecommend = async () => {
    if (!canSubmit) return;
    setLoading(true); setResults([]);
    try {
      const data = await recommendOutfit({ prompt: prompt.trim() });
      // The recommender returns one object with a `combinations` array, each
      // holding raw catalog products (e.g. `{ top: { title, color, ... } }`),
      // not the flat {title, top, bottom} shape OutfitCard expects.
      const combos: any[] = Array.isArray(data) ? data : (data as any)?.combinations ?? [];
      const list: OutfitItem[] = combos.map((combo: any) => ({
        title: combo.top?.title ?? combo.top?.brand ?? 'Outfit',
        top: combo.top?.title ?? '',
        bottom: combo.bottom?.title ?? '',
        color: combo.top?.color,
        category: combo.top?.category,
        topId: combo.top?.id,
        bottomId: combo.bottom?.id,
        imageUrl: combo.top?.image_path ? `${OUTFIT_RECOMMENDER_BASE_URL}${combo.top.image_path}` : undefined,
        bottomImageUrl: combo.bottom?.image_path ? `${OUTFIT_RECOMMENDER_BASE_URL}${combo.bottom.image_path}` : undefined,
      }));
      setResults(list);
    } catch (e: any) { Alert.alert('Error', e.message || 'Failed to get recommendations.'); }
    finally { setLoading(false); }
  };

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Header ── */}
        <Animated.View entering={FadeIn.duration(500)}>
          <LinearGradient colors={[c.surfaceElevated, c.background]} style={styles.header}>
            <Badge label="AI RECOMMENDER" variant="primary" />
            <Text style={[styles.headerTitle, { color: c.text }]}>Tell us what you want</Text>
            <Text style={[styles.headerSub, { color: c.textSecondary }]}>Describe the outfit in your own words — style, colors, occasion, anything</Text>
          </LinearGradient>
        </Animated.View>

        {/* ── Brand Shop shortcut ── */}
        <Animated.View entering={FadeInDown.delay(40).duration(380)} style={styles.tryOnShortcut}>
          <Pressable
            onPress={() => navigation.navigate('BrandShop')}
            style={({ pressed }) => [styles.tryOnShortcutBtn, { borderColor: c.primary + '40' }, pressed && { opacity: 0.8 }]}
          >
            <LinearGradient
              colors={[c.primary + '1F', c.primary + '0A']}
              style={styles.tryOnShortcutGrad}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              <View style={styles.tryOnShortcutLeft}>
                <IconBox symbol="◑" variant="primary" size={40} />
                <View>
                  <Text style={[styles.tryOnShortcutTitle, { color: c.text }]}>Brand Shop</Text>
                  <Text style={[styles.tryOnShortcutSub, { color: c.textMuted }]}>Zara · Nike · Adidas · and more</Text>
                </View>
              </View>
              <Text style={[styles.tryOnShortcutArrow, { color: c.primary }]}>›</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>

        {/* ── Virtual Try-On shortcut ── */}
        <Animated.View entering={FadeInDown.delay(60).duration(380)} style={styles.tryOnShortcut}>
          <Pressable
            onPress={() => navigation.navigate('TryOn')}
            style={({ pressed }) => [styles.tryOnShortcutBtn, { borderColor: c.accent + '40' }, pressed && { opacity: 0.8 }]}
          >
            <LinearGradient
              colors={[c.accent + '1F', c.accent + '0A']}
              style={styles.tryOnShortcutGrad}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              <View style={styles.tryOnShortcutLeft}>
                <IconBox symbol="◈" variant="accent" size={40} />
                <View>
                  <Text style={[styles.tryOnShortcutTitle, { color: c.text }]}>Virtual Try-On</Text>
                  <Text style={[styles.tryOnShortcutSub, { color: c.textMuted }]}>Upload a photo & try any outfit</Text>
                </View>
              </View>
              <Text style={[styles.tryOnShortcutArrow, { color: c.accent }]}>›</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>

        {/* ── Prompt input ── */}
        <Animated.View entering={FadeInDown.delay(80).duration(380)} style={styles.filters}>
          <View style={[styles.promptBox, { borderColor: c.border, backgroundColor: c.surface }]}>
            <TextInput
              value={prompt}
              onChangeText={setPrompt}
              placeholder="e.g. Casual black outfit for a summer beach date"
              placeholderTextColor={c.textMuted}
              style={[styles.promptInput, { color: c.text }]}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <Text style={[styles.filterLabel, { color: c.textSecondary, marginTop: spacing.md }]}>Need inspiration?</Text>
          <View style={styles.chips}>
            {PROMPT_SUGGESTIONS.map(s => (
              <Chip key={s} label={s} selected={prompt === s} onPress={() => setPrompt(s)} />
            ))}
          </View>
        </Animated.View>

        {/* ── Submit ── */}
        <Animated.View entering={FadeInUp.delay(380).duration(400)} style={styles.submitRow}>
          <Button
            label={loading ? 'Analysing preferences…' : 'Generate Recommendations'}
            onPress={handleRecommend}
            disabled={!canSubmit || loading}
            loading={loading}
          />
        </Animated.View>

        {/* ── Loading ── */}
        {loading && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.loadingBox}>
            <ActivityIndicator color={c.primary} size="large" />
            <Text style={[styles.loadingTitle, { color: c.text }]}>Curating your looks</Text>
            <Text style={[styles.loadingSub, { color: c.textMuted }]}>Our AI model is selecting the best outfits for you</Text>
          </Animated.View>
        )}

        {/* ── Results ── */}
        {results.length > 0 && (
          <Animated.View entering={FadeInDown.duration(400)} style={styles.results}>
            <View style={styles.resultsHeader}>
              <Text style={[styles.resultsTitle, { color: c.text }]}>Your Curated Looks</Text>
              <Badge label={`${results.length} outfit${results.length > 1 ? 's' : ''}`} variant="primary" size="md" dot />
            </View>
            {results.map((o, i) => (
              <OutfitCard key={i} outfit={o} index={i} onTryOn={(outfit) => navigation.navigate('TryOn', { selectedOutfit: outfit })} />
            ))}
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: spacing.xxl },

  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.lg, gap: spacing.xs },
  headerTitle: { fontSize: typography.fontSize2XL, fontWeight: typography.fontWeightBold, marginTop: 4 },
  headerSub: { fontSize: typography.fontSizeSM, marginBottom: spacing.sm },

  tryOnShortcut: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  tryOnShortcutBtn: { borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1 },
  tryOnShortcutGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderRadius: radius.xl },
  tryOnShortcutLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tryOnShortcutTitle: { fontSize: typography.fontSizeMD, fontWeight: typography.fontWeightBold },
  tryOnShortcutSub: { fontSize: typography.fontSizeXS, marginTop: 2 },
  tryOnShortcutArrow: { fontSize: 26 },

  filters: { padding: spacing.lg },
  filterLabel: { fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightBold, letterSpacing: 0.8, textTransform: 'uppercase' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },

  promptBox: { borderRadius: radius.lg, borderWidth: 1.5, padding: spacing.md },
  promptInput: { fontSize: typography.fontSizeMD, lineHeight: 22, minHeight: 84 },

  chip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: radius.full, borderWidth: 1.5 },
  chipActive: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: radius.full },
  chipText: { fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightMedium },
  chipActiveText: { fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightBold },

  submitRow: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },

  loadingBox: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
  loadingTitle: { fontSize: typography.fontSizeLG, fontWeight: typography.fontWeightSemiBold },
  loadingSub: { fontSize: typography.fontSizeSM, textAlign: 'center', paddingHorizontal: spacing.xl },

  results: { paddingHorizontal: spacing.lg },
  resultsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  resultsTitle: { fontSize: typography.fontSizeXL, fontWeight: typography.fontWeightBold },

  outfitCard: { marginBottom: spacing.md, overflow: 'hidden' },
  outfitImage: { width: '100%', height: 220, borderRadius: radius.lg, marginBottom: spacing.md },
  outfitCollage: { flexDirection: 'row', height: 220, gap: spacing.xs, marginBottom: spacing.md },
  collageMain: { flex: 1.3, borderRadius: radius.lg },
  collageSideImage: { flex: 1, borderRadius: radius.lg },
  outfitHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.md },
  outfitIndexBox: {
    width: 36, height: 36, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  outfitIndex: { fontWeight: typography.fontWeightBold, fontSize: typography.fontSizeSM, letterSpacing: 0.5 },
  outfitHeaderRight: { flex: 1, gap: 6 },
  outfitTitle: { fontSize: typography.fontSizeMD, fontWeight: typography.fontWeightSemiBold, lineHeight: 20 },
  separator: { height: 1, marginBottom: spacing.md },
  pieces: { gap: spacing.sm, marginBottom: spacing.md },
  piece: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderRadius: radius.md, padding: spacing.sm },
  pieceBody: { flex: 1, justifyContent: 'center' },
  pieceLabel: { fontSize: typography.fontSizeXS, fontWeight: typography.fontWeightBold, letterSpacing: 1, textTransform: 'uppercase' },
  pieceValue: { fontSize: typography.fontSizeMD, marginTop: 2, lineHeight: 20 },
  tryOnBtn: { borderRadius: radius.md, paddingVertical: spacing.sm + 4, alignItems: 'center' },
  tryOnBtnText: { fontWeight: typography.fontWeightBold, fontSize: typography.fontSizeMD, letterSpacing: 0.8 },
});
