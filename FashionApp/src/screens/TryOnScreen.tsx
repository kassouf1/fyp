import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Pressable, Image, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system/legacy';
import Animated, { FadeInDown, FadeInUp, FadeIn } from 'react-native-reanimated';
import { generateTryOn, GarmentMode, OutfitItem } from '../api/outfit';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge, IconBox } from '../components/ui/Badge';
import { useAuth } from '../context/AuthContext';
import { typography, spacing, radius, shadows } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { CATVTON_BASE_URL } from '../api/client';

type Props = { navigation: any; route: any };

// Native picker uris are real file paths (file:///.../photo.jpg), so parsing
// an extension off the end works. Web picker uris are blob: URLs with no
// extension at all, so falling back to that same parsing produces garbage —
// prefer the picker's reported mime type, and only trust a parsed extension
// if it actually looks like one.
const getFileExtension = (uri: string, mimeType?: string | null): string => {
  if (mimeType) {
    const fromMime = mimeType.split('/').pop();
    if (fromMime) return fromMime === 'jpeg' ? 'jpg' : fromMime;
  }
  const fromUri = uri.split('.').pop();
  if (fromUri && fromUri.length <= 5 && /^[a-zA-Z0-9]+$/.test(fromUri)) return fromUri;
  return 'jpg';
};

const StepLabel: React.FC<{ n: number; title: string; delay?: number }> = ({ n, title, delay = 0 }) => {
  const { themeColors: c } = useTheme();
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(380)} style={styles.stepHeader}>
      <View style={[styles.stepNum, { backgroundColor: c.primary + '15', borderColor: c.primary + '50' }]}>
        <Text style={[styles.stepNumText, { color: c.primary }]}>{n}</Text>
      </View>
      <Text style={[styles.stepTitle, { color: c.text }]}>{title}</Text>
    </Animated.View>
  );
};

type PickTarget = 'top' | 'bottom' | 'person';

const MODE_OPTIONS: { mode: GarmentMode; label: string }[] = [
  { mode: 'top',    label: 'Top' },
  { mode: 'bottom', label: 'Bottom' },
  { mode: 'both',   label: 'Both' },
];

const ModeSelector: React.FC<{ mode: GarmentMode; onChange: (m: GarmentMode) => void; delay?: number }> = ({ mode, onChange, delay = 0 }) => {
  const { themeColors: c } = useTheme();
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(380)} style={[styles.modeRow, { backgroundColor: c.surface, borderColor: c.border }]}>
      {MODE_OPTIONS.map(opt => {
        const active = opt.mode === mode;
        return (
          <Pressable
            key={opt.mode}
            onPress={() => onChange(opt.mode)}
            style={[styles.modeBtn, active && { backgroundColor: c.primary }]}
          >
            <Text style={[styles.modeBtnText, { color: active ? c.white : c.textSecondary }]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </Animated.View>
  );
};

const ImagePickerPanel: React.FC<{
  image: ImagePicker.ImagePickerAsset | null;
  onPick: (source: 'camera' | 'library') => void;
  onRemove: () => void;
  delay?: number;
}> = ({ image, onPick, onRemove, delay = 0 }) => {
  const { themeColors: c } = useTheme();

  if (image) {
    return (
      <Animated.View entering={FadeIn.duration(300)}>
        <Pressable onPress={onRemove}>
          <Image source={{ uri: image.uri }} style={[styles.preview, { backgroundColor: c.surface }]} />
          <View style={[styles.removeOverlay, { borderColor: c.error + '60' }]}>
            <Text style={[styles.removeText, { color: c.white }]}>✕  Remove Photo</Text>
          </View>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(380)} style={styles.pickRow}>
      {[
        { label: 'Gallery', sublabel: 'Choose from gallery', symbol: '▲', source: 'library' as const },
        { label: 'Camera',  sublabel: 'Take a new photo',    symbol: '◷', source: 'camera'  as const },
      ].map(p => (
        <Pressable
          key={p.source}
          onPress={() => onPick(p.source)}
          style={({ pressed }) => [styles.pickBtn, { borderColor: c.border }, pressed && styles.pickBtnPressed]}
        >
          <LinearGradient colors={[c.accent + '1F', c.accent + '0A']} style={[styles.pickGrad, { backgroundColor: c.surface }]}>
            <IconBox symbol={p.symbol} variant="accent" size={44} />
            <Text style={[styles.pickLabel, { color: c.text }]}>{p.label}</Text>
            <Text style={[styles.pickSublabel, { color: c.textMuted }]}>{p.sublabel}</Text>
          </LinearGradient>
        </Pressable>
      ))}
    </Animated.View>
  );
};

// One garment slot (top or bottom) — own photo / camera / Brand Shop, with
// the "picked from Brand Shop" preview state. Factored out so "both" mode
// can render two of these instead of duplicating the whole block.
const GarmentSlotPicker: React.FC<{
  slot: 'top' | 'bottom';
  label: string;
  image: ImagePicker.ImagePickerAsset | null;
  imageUrl: string | null;
  onPick: (source: 'camera' | 'library') => void;
  onRemoveImage: () => void;
  onRemoveUrl: () => void;
  onBrowseBrandShop: () => void;
  delay?: number;
}> = ({ label, image, imageUrl, onPick, onRemoveImage, onRemoveUrl, onBrowseBrandShop, delay = 0 }) => {
  const { themeColors: c } = useTheme();
  return (
    <View style={styles.slotBlock}>
      <Text style={[styles.slotLabel, { color: c.textSecondary }]}>{label}</Text>
      {imageUrl && !image ? (
        <Animated.View entering={FadeIn.duration(300)}>
          <Pressable onPress={onRemoveUrl}>
            <Image source={{ uri: imageUrl }} style={[styles.preview, { backgroundColor: c.surface }]} resizeMode="cover" />
            <View style={[styles.removeOverlay, { borderColor: c.error + '60' }]}>
              <Text style={[styles.removeText, { color: c.white }]}>✕  Remove</Text>
            </View>
            <View style={[styles.brandBadge, { backgroundColor: c.primary + 'EB' }]}>
              <Text style={[styles.brandBadgeText, { color: c.white }]}>From Brand Shop</Text>
            </View>
          </Pressable>
        </Animated.View>
      ) : (
        <ImagePickerPanel image={image} onPick={onPick} onRemove={onRemoveImage} delay={delay} />
      )}

      {!image && !imageUrl && (
        <Animated.View entering={FadeInDown.delay(delay + 50).duration(380)} style={styles.brandShopRow}>
          <Pressable
            onPress={onBrowseBrandShop}
            style={({ pressed }) => [styles.brandShopBtn, { borderColor: c.accent + '50', opacity: pressed ? 0.8 : 1 }]}
          >
            <LinearGradient colors={[c.accent + '1F', c.accent + '0A']} style={[styles.brandShopGrad, { backgroundColor: c.surface }]}>
              <Text style={[styles.brandShopIcon]}>🛍️</Text>
              <View>
                <Text style={[styles.brandShopTitle, { color: c.text }]}>Browse Brand Shop</Text>
                <Text style={[styles.brandShopSub, { color: c.textMuted }]}>Zara · Nike · Adidas · and more</Text>
              </View>
              <Text style={[styles.brandShopArrow, { color: c.accent }]}>›</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
};

export const TryOnScreen: React.FC<Props> = ({ route, navigation }) => {
  const { user } = useAuth();
  const { themeColors: c } = useTheme();
  const selectedOutfit: OutfitItem | undefined = route.params?.selectedOutfit;
  // Brand Shop passes the catalog id directly (no selectedOutfit wrapper) —
  // lets the backend use that exact local file instead of re-downloading
  // clothesImageUrl, while still showing the normal image preview below.
  const directTopId: string | undefined = route.params?.topId;
  const directBottomId: string | undefined = route.params?.bottomId;
  // A recommended garment (with a real catalog id) was tapped via "Try This
  // On" — use it directly instead of asking for a clothes photo, and skip
  // the top/bottom/both picker since the recommendation already decided
  // which pieces to use.
  const hasRecommendedGarment = !!selectedOutfit?.topId;
  const hasRecommendedBottom  = !!selectedOutfit?.bottomId;

  const [garmentMode, setGarmentMode] = useState<GarmentMode>('top');
  // A recommendation with both a top and a bottom should try on the whole
  // outfit, not just the top — top-only fallback combos (catalog missing a
  // bottom for that gender/style) still work since hasRecommendedBottom
  // is false in that case.
  const effectiveMode: GarmentMode = hasRecommendedGarment
    ? (hasRecommendedBottom ? 'both' : 'top')
    : garmentMode;
  const [clothesImage,    setClothesImage]    = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [clothesImageUrl, setClothesImageUrl] = useState<string | null>(route.params?.clothesImageUrl ?? null);
  const [bottomImage,     setBottomImage]     = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [bottomImageUrl,  setBottomImageUrl]  = useState<string | null>(null);
  const [personImage,     setPersonImage]     = useState<ImagePicker.ImagePickerAsset | null>(null);

  // Picking a new item from Brand Shop navigates back to this same TryOn
  // screen instance (it's already on the stack) rather than mounting a new
  // one, so route.params changes without re-running the useState initializer
  // above — sync it explicitly or the newly-picked garment never shows up.
  useEffect(() => {
    if (route.params?.clothesImageUrl) {
      setClothesImageUrl(route.params.clothesImageUrl);
      setClothesImage(null);
    }
    if (route.params?.bottomImageUrl) {
      setBottomImageUrl(route.params.bottomImageUrl);
      setBottomImage(null);
    }
  }, [route.params?.clothesImageUrl, route.params?.bottomImageUrl]);
  const prompt = selectedOutfit
    ? `${selectedOutfit.title || ''} ${selectedOutfit.top || ''} ${selectedOutfit.bottom || ''}`.trim()
    : '';
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const pickImage = async (target: PickTarget, source: 'camera' | 'library') => {
    const perms =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perms.granted) {
      Alert.alert('Permission Required', 'Please allow access in your device settings.');
      return;
    }
    const res =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.85, allowsEditing: true, aspect: [3, 4] })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.85, allowsEditing: true, aspect: [3, 4] });
    if (!res.canceled && res.assets.length > 0) {
      if (target === 'top')         { setClothesImage(res.assets[0]); setClothesImageUrl(null); }
      else if (target === 'bottom') { setBottomImage(res.assets[0]);  setBottomImageUrl(null);  }
      else                          { setPersonImage(res.assets[0]);  }
      setResultUrl(null);
    }
  };

  const handleGenerate = async () => {
    if (!personImage) { Alert.alert('Missing Photo', 'Please add a photo of the person.'); return; }
    if (!user) { Alert.alert('Not Logged In', 'Please sign in to use this feature.'); return; }

    const hasTop    = !!(clothesImage || clothesImageUrl || selectedOutfit?.topId || directTopId);
    const hasBottom = !!(bottomImage || bottomImageUrl || selectedOutfit?.bottomId || directBottomId);
    if (effectiveMode === 'top' && !hasTop) { Alert.alert('Missing Garment', 'Please add a top to try on.'); return; }
    if (effectiveMode === 'bottom' && !hasBottom) { Alert.alert('Missing Garment', 'Please add a bottom to try on.'); return; }
    if (effectiveMode === 'both' && (!hasTop || !hasBottom)) { Alert.alert('Missing Garment', 'Please add both a top and a bottom to try them on together.'); return; }

    setLoading(true); setResultUrl(null);
    try {
      const personExt  = getFileExtension(personImage.uri, personImage.mimeType);
      const clothesExt = clothesImage ? getFileExtension(clothesImage.uri, clothesImage.mimeType) : 'jpg';
      const bottomExt  = bottomImage ? getFileExtension(bottomImage.uri, bottomImage.mimeType) : 'jpg';

      const result = await generateTryOn({
        userId: user.userId,
        prompt: prompt.trim(),
        selectedOutfitTitle:    selectedOutfit?.title    ?? '',
        selectedOutfitColor:    (selectedOutfit as any)?.color    ?? '',
        selectedOutfitCategory: (selectedOutfit as any)?.category ?? '',
        personImageUri:  personImage.uri,
        personImageName: `person.${personExt}`,
        personImageType: personImage.mimeType ?? `image/${personExt}`,
        garmentMode: effectiveMode,
        ...(clothesImage && {
          clothesImageUri:  clothesImage.uri,
          clothesImageName: `clothes.${clothesExt}`,
          clothesImageType: clothesImage.mimeType ?? `image/${clothesExt}`,
        }),
        clothesImageUrl: clothesImageUrl ?? undefined,
        topId: selectedOutfit?.topId ?? directTopId,
        ...(bottomImage && {
          bottomImageUri:  bottomImage.uri,
          bottomImageName: `bottom.${bottomExt}`,
          bottomImageType: bottomImage.mimeType ?? `image/${bottomExt}`,
        }),
        bottomImageUrl: bottomImageUrl ?? undefined,
        bottomId: selectedOutfit?.bottomId ?? directBottomId,
      });

      const url =
        result.result_url ??
        result.catvton_result?.result_url ??
        result.catvton_result?.result_image ??
        null;

      if (url) {
        setResultUrl(url.startsWith('http') ? url : `${CATVTON_BASE_URL}${url}`);
      } else {
        Alert.alert('No Result', 'The AI did not return an image. Please try again.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Try-on generation failed.');
    } finally {
      setLoading(false);
    }
  };

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!resultUrl) return;
    if (Platform.OS === 'web') {
      // React Native's Alert/MediaLibrary have no web equivalent — trigger a
      // normal browser download instead.
      const a = document.createElement('a');
      a.href = resultUrl;
      a.download = 'try-on-result.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }
    setSaving(true);
    try {
      const perms = await MediaLibrary.requestPermissionsAsync();
      if (!perms.granted) {
        Alert.alert('Permission Required', 'Please allow photo access in Settings to save images.');
        return;
      }
      const localUri = FileSystem.cacheDirectory + `try-on-${Date.now()}.png`;
      const { uri } = await FileSystem.downloadAsync(resultUrl, localUri);
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Saved', 'Try-on result saved to your photos.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save image.');
    } finally {
      setSaving(false);
    }
  };

  const handlePost = () => {
    if (!resultUrl) return;
    (navigation as any).navigate('CreatePost', { imageUri: resultUrl });
  };

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Header ── */}
        <Animated.View entering={FadeIn.duration(500)}>
          <LinearGradient colors={[c.accent + '20', c.background]} style={styles.header}>
            <Badge label="COMPUTER VISION" variant="accent" />
            <Text style={[styles.headerTitle, { color: c.text }]}>Virtual Try-On</Text>
            <Text style={[styles.headerSub, { color: c.textSecondary }]}>See yourself in any outfit instantly</Text>
            {selectedOutfit && (
              <View style={[styles.selectedRow, { backgroundColor: c.accent + '10', borderColor: c.accent + '30' }]}>
                <IconBox symbol="◈" variant="accent" size={28} />
                <Text style={[styles.selectedText, { color: c.accentLight }]} numberOfLines={1}>
                  {selectedOutfit.title || 'Selected Outfit'}
                </Text>
              </View>
            )}
          </LinearGradient>
        </Animated.View>

        {/* ── Step 1 — Clothes Photo ── */}
        <View style={styles.stepSection}>
          <StepLabel n={1} title="Clothes Photo" delay={100} />

          {hasRecommendedGarment ? (
            <Animated.View entering={FadeIn.duration(300)} style={[styles.selectedRow, { backgroundColor: c.primary + '10', borderColor: c.primary + '30', marginTop: spacing.xs }]}>
              <IconBox symbol="✓" variant="primary" size={28} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.selectedText, { color: c.text }]} numberOfLines={1}>
                  Using: {selectedOutfit?.title}
                </Text>
                <Text style={[styles.stepHint, { color: c.textMuted, marginBottom: 0 }]}>
                  {hasRecommendedBottom
                    ? 'This recommended top + bottom will be used together'
                    : 'This exact recommended garment will be used'}
                </Text>
              </View>
            </Animated.View>
          ) : (
            <>
              <Animated.View entering={FadeInDown.delay(100).duration(380)}>
                <Text style={[styles.stepHint, { color: c.textMuted }]}>
                  What do you want to try on?
                </Text>
              </Animated.View>
              <ModeSelector mode={garmentMode} onChange={setGarmentMode} delay={110} />

              <Animated.View entering={FadeInDown.delay(120).duration(380)}>
                <Text style={[styles.stepHint, { color: c.textMuted, marginTop: spacing.md }]}>
                  Take or upload a photo, or pick from Brand Shop
                </Text>
              </Animated.View>

              {(garmentMode === 'top' || garmentMode === 'both') && (
                <GarmentSlotPicker
                  slot="top"
                  label="Top"
                  image={clothesImage}
                  imageUrl={clothesImageUrl}
                  onPick={(src) => pickImage('top', src)}
                  onRemoveImage={() => setClothesImage(null)}
                  onRemoveUrl={() => setClothesImageUrl(null)}
                  onBrowseBrandShop={() => (navigation as any).navigate('BrandShop', { forSlot: 'top' })}
                  delay={150}
                />
              )}

              {(garmentMode === 'bottom' || garmentMode === 'both') && (
                <GarmentSlotPicker
                  slot="bottom"
                  label="Bottom"
                  image={bottomImage}
                  imageUrl={bottomImageUrl}
                  onPick={(src) => pickImage('bottom', src)}
                  onRemoveImage={() => setBottomImage(null)}
                  onRemoveUrl={() => setBottomImageUrl(null)}
                  onBrowseBrandShop={() => (navigation as any).navigate('BrandShop', { forSlot: 'bottom' })}
                  delay={garmentMode === 'both' ? 180 : 150}
                />
              )}
            </>
          )}
        </View>

        {/* ── Step 2 — Person Photo ── */}
        <View style={styles.stepSection}>
          <StepLabel n={2} title="Your Photo" delay={200} />
          <Animated.View entering={FadeInDown.delay(220).duration(380)}>
            <Text style={[styles.stepHint, { color: c.textMuted }]}>
              Take or upload a full-body photo of yourself
            </Text>
          </Animated.View>
          <ImagePickerPanel
            image={personImage}
            onPick={(src) => pickImage('person', src)}
            onRemove={() => setPersonImage(null)}
            delay={250}
          />
        </View>

        {/* ── Generate ── */}
        <Animated.View entering={FadeInUp.delay(280).duration(380)} style={styles.generateRow}>
          <Button
            label={loading ? 'Generating your look…' : 'Generate Try-On'}
            onPress={handleGenerate}
            disabled={loading || !personImage}
            loading={loading}
          />
        </Animated.View>

        {/* ── Loading state ── */}
        {loading && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.loadingBox}>
            <ActivityIndicator size="large" color={c.accent} />
            <Text style={[styles.loadingTitle, { color: c.text }]}>AI is processing your look</Text>
            <Text style={[styles.loadingSub, { color: c.textMuted }]}>
              {effectiveMode === 'both'
                ? 'Applying your top, then your bottom — this can take a couple of minutes'
                : 'This may take up to 90 seconds'}
            </Text>
            <Badge label="PROCESSING" variant="accent" dot />
          </Animated.View>
        )}

        {/* ── Result ── */}
        {resultUrl && !loading && (
          <Card style={styles.resultCard} elevated delay={0}>
            <View style={styles.resultHeader}>
              <IconBox symbol="◆" variant="primary" size={32} />
              <View>
                <Text style={[styles.resultTitle, { color: c.text }]}>Your Try-On Result</Text>
                <Badge label="AI GENERATED" variant="primary" />
              </View>
            </View>
            <Image
              source={{ uri: resultUrl }}
              style={[styles.resultImage, { backgroundColor: c.surfaceElevated }]}
              resizeMode="cover"
            />
            <View style={styles.resultActions}>
              <Pressable
                onPress={handleSave}
                disabled={saving}
                style={({ pressed }) => [styles.resultActionBtn, { borderColor: c.border, opacity: pressed || saving ? 0.7 : 1 }]}
              >
                {saving
                  ? <ActivityIndicator size="small" color={c.text} />
                  : <>
                      <Text style={[styles.resultActionIcon, { color: c.text }]}>⬇</Text>
                      <Text style={[styles.resultActionLabel, { color: c.text }]}>Save</Text>
                    </>
                }
              </Pressable>
              <Pressable
                onPress={handlePost}
                style={({ pressed }) => [styles.resultActionBtn, styles.resultActionBtnPrimary, { opacity: pressed ? 0.85 : 1 }]}
              >
                <LinearGradient colors={[c.primaryLight, c.primary]} style={styles.resultActionGrad}>
                  <Text style={[styles.resultActionIconPrimary, { color: c.white }]}>⬆</Text>
                  <Text style={[styles.resultActionLabelPrimary, { color: c.white }]}>Post</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </Card>
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
  headerSub: { fontSize: typography.fontSizeSM },
  selectedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, borderRadius: radius.md, padding: spacing.sm, borderWidth: 1 },
  selectedText: { flex: 1, fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightSemiBold },

  stepSection: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  stepNum: {
    width: 28, height: 28, borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  stepNumText: { fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightBold },
  stepTitle: { fontSize: typography.fontSizeLG, fontWeight: typography.fontWeightSemiBold },
  stepHint: { fontSize: typography.fontSizeXS, marginBottom: spacing.sm },

  modeRow: {
    flexDirection: 'row', borderRadius: radius.lg, borderWidth: 1,
    padding: 4, gap: 4,
  },
  modeBtn: {
    flex: 1, paddingVertical: 10, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  modeBtnText: { fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightSemiBold },

  slotBlock: { marginTop: spacing.md },
  slotLabel: {
    fontSize: typography.fontSizeXS, fontWeight: typography.fontWeightBold,
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: spacing.xs,
  },

  preview: { width: '100%', height: 300, borderRadius: radius.xl },
  removeOverlay: {
    position: 'absolute', bottom: 16, alignSelf: 'center',
    backgroundColor: '#000000AA', paddingVertical: 8, paddingHorizontal: 20, borderRadius: radius.full,
    borderWidth: 1,
  },
  removeText: { fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightSemiBold },

  pickRow: { flexDirection: 'row', gap: spacing.md },
  pickBtn: { flex: 1, borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, ...shadows.sm },
  pickBtnPressed: { opacity: 0.8 },
  pickGrad: { paddingVertical: spacing.xl + 4, alignItems: 'center', gap: spacing.sm, borderRadius: radius.xl },
  pickLabel: { fontSize: typography.fontSizeMD, fontWeight: typography.fontWeightSemiBold },
  pickSublabel: { fontSize: typography.fontSizeXS },

  brandBadge: {
    position: 'absolute', top: 12, left: 12,
    borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  brandBadgeText: { fontSize: 10, fontWeight: '800' },

  brandShopRow: { marginTop: spacing.md },
  brandShopBtn: { borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1 },
  brandShopGrad: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md, borderRadius: radius.xl,
  },
  brandShopIcon: { fontSize: 28 },
  brandShopTitle: { fontSize: typography.fontSizeMD, fontWeight: typography.fontWeightBold },
  brandShopSub: { fontSize: typography.fontSizeXS, marginTop: 2 },
  brandShopArrow: { fontSize: 26, marginLeft: 'auto' },

  generateRow: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },

  loadingBox: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
  loadingTitle: { fontSize: typography.fontSizeLG, fontWeight: typography.fontWeightSemiBold },
  loadingSub: { fontSize: typography.fontSizeSM },

  resultCard: { margin: spacing.lg },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  resultTitle: { fontSize: typography.fontSizeMD, fontWeight: typography.fontWeightBold, marginBottom: 4 },
  resultImage: { width: '100%', height: 420, borderRadius: radius.lg },
  resultActions: { flexDirection: 'row', gap: spacing.md, paddingTop: spacing.md },
  resultActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: radius.md, borderWidth: 1.5, paddingVertical: 12,
  },
  resultActionBtnPrimary: { borderWidth: 0, padding: 0, overflow: 'hidden' },
  resultActionGrad: {
    flex: 1, width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: radius.md,
  },
  resultActionIcon: { fontSize: 16 },
  resultActionLabel: { fontSize: typography.fontSizeMD, fontWeight: typography.fontWeightSemiBold },
  resultActionIconPrimary: { fontSize: 16 },
  resultActionLabelPrimary: { fontSize: typography.fontSizeMD, fontWeight: typography.fontWeightBold },
});
