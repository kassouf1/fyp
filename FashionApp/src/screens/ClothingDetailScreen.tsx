import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Image, ScrollView,
  TouchableOpacity, Dimensions, StatusBar, Share, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown, FadeIn, useSharedValue, useAnimatedStyle,
  withSequence, withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { typography, spacing, radius } from '../theme';
import { BrandProduct } from '../data/localClothes';
import { useWishlist } from '../hooks/useWishlist';

const { width: W, height: H } = Dimensions.get('window');
const IMG_H = H * 0.52;

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const TAG_LABEL: Record<string, string> = {
  tshirt: 'T-Shirt', shirt: 'Shirt', hoodie: 'Hoodie', sweatshirt: 'Sweatshirt',
  jacket: 'Jacket', coat: 'Coat', dress: 'Dress', gown: 'Gown', skirt: 'Skirt',
  suit: 'Suit', joggers: 'Joggers', sweatpants: 'Sweatpants', shorts: 'Shorts',
  womens: "Women's", mens: "Men's", sports: 'Sportswear', formal: 'Formal',
  casual: 'Casual', summer: 'Summer', outdoor: 'Outdoor', luxury: 'Luxury',
  party: 'Party', basic: 'Essentials', top: 'Top', bottoms: 'Bottoms',
};

function deriveCategory(tags: string[]): string {
  const priority = [
    'gown', 'suit', 'dress', 'skirt', 'hoodie', 'sweatshirt',
    'jacket', 'coat', 'joggers', 'sweatpants', 'shorts', 'tshirt', 'shirt',
  ];
  for (const t of priority) {
    if (tags.includes(t)) return TAG_LABEL[t] ?? t;
  }
  return 'Clothing';
}

function visibleTags(tags: string[]): string[] {
  const skip = new Set(['top', 'bottoms', 'basic', 'sports', 'mens', 'womens']);
  return tags
    .filter(t => TAG_LABEL[t] && !skip.has(t))
    .map(t => TAG_LABEL[t])
    .slice(0, 5);
}

type Props = {
  route: { params: { product: BrandProduct; forSlot?: 'top' | 'bottom' } };
  navigation: any;
};

export const ClothingDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { product, forSlot } = route.params;
  const { themeColors: c } = useTheme();
  const { isSaved, toggle } = useWishlist();
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  const saved = isSaved(product.id);
  const category = deriveCategory(product.tags);
  const chips = visibleTags(product.tags);

  // Heart bounce animation
  const heartScale = useSharedValue(1);
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: heartScale.value }] }));

  const handleSave = async () => {
    heartScale.value = withSequence(withTiming(1.4, { duration: 150 }), withTiming(1, { duration: 150 }));
    const nowSaved = await toggle(product.id);
    if (nowSaved) {
      Alert.alert('Saved!', `"${product.name}" added to your wishlist.`, [{ text: 'View Wishlist', onPress: () => navigation.navigate('Wishlist') }, { text: 'OK' }]);
    }
  };

  const handleShare = async () => {
    const brand = product.brand ? `${product.brand} — ` : '';
    await Share.share({
      title: product.name,
      message: `${brand}${product.name}\nPrice: ${product.price}\n\nCheck it out on SmartFashion! 🧥`,
    });
  };

  const handleTryOn = () => {
    // TryOn's bottom slot only syncs from bottomImageUrl/bottomId — sending
    // this under the top fields (clothesImageUrl/topId) regardless of which
    // slot we came from meant picking a bottom silently landed in the top
    // slot instead, and the bottom picker never showed anything selected.
    if (forSlot === 'bottom') {
      navigation.navigate('TryOn', {
        bottomImageUrl: product.imageUrl,
        bottomId: product.topId,
        bottomTitle: product.name,
        forSlot,
      });
    } else {
      navigation.navigate('TryOn', {
        clothesImageUrl: product.imageUrl,
        topId: product.topId,
        topTitle: product.name,
        forSlot,
      });
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <StatusBar barStyle="light-content" />

      {/* ── Hero image ── */}
      <View style={[styles.imgContainer, { backgroundColor: c.surfaceElevated }]}>
        <Image source={{ uri: product.imageUrl }} style={styles.img} resizeMode="contain" />
        <LinearGradient
          colors={['#000000AA', 'transparent', 'transparent', '#00000055']}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Back button */}
        <TouchableOpacity style={styles.overlayBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={c.white} />
        </TouchableOpacity>

        {/* Top-right icon cluster */}
        <View style={styles.topRight}>
          {/* Share */}
          <TouchableOpacity style={styles.overlayBtn} onPress={handleShare}>
            <Ionicons name="share-social-outline" size={20} color={c.white} />
          </TouchableOpacity>

          {/* Save / Wishlist */}
          <Animated.View style={heartStyle}>
            <TouchableOpacity style={styles.overlayBtn} onPress={handleSave}>
              <Ionicons
                name={saved ? 'heart' : 'heart-outline'}
                size={20}
                color={saved ? c.error : c.white}
              />
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Category badge */}
        <View style={styles.categoryBadge}>
          <Text style={[styles.categoryBadgeText, { color: c.white }]}>{category}</Text>
        </View>
      </View>

      {/* ── Info panel ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.info}
        showsVerticalScrollIndicator={false}
      >
        {/* Brand + Name */}
        <Animated.View entering={FadeInDown.delay(80).duration(350)}>
          {!!product.brand && (
            <Text style={[styles.brand, { color: c.primary }]}>{product.brand}</Text>
          )}
          <Text style={[styles.name, { color: c.text }]}>{product.name}</Text>
        </Animated.View>

        {/* Price + Rating */}
        <Animated.View entering={FadeInDown.delay(140).duration(350)} style={styles.priceRow}>
          <Text style={[styles.price, { color: c.text }]}>{product.price}</Text>
          <View style={[styles.ratingBadge, { backgroundColor: c.surfaceElevated }]}>
            <Ionicons name="star" size={12} color={c.warning} />
            <Text style={[styles.ratingText, { color: c.text }]}>4.8</Text>
          </View>
        </Animated.View>

        {/* Tag chips */}
        {chips.length > 0 && (
          <Animated.View entering={FadeInDown.delay(180).duration(350)} style={styles.tagsRow}>
            {chips.map(t => (
              <View key={t} style={[styles.tag, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}>
                <Text style={[styles.tagText, { color: c.textMuted }]}>{t}</Text>
              </View>
            ))}
          </Animated.View>
        )}

        <View style={[styles.divider, { backgroundColor: c.border }]} />

        {/* Size picker */}
        <Animated.View entering={FadeInDown.delay(220).duration(350)}>
          <Text style={[styles.sectionTitle, { color: c.text }]}>Select Size</Text>
          <View style={styles.sizesRow}>
            {SIZES.map(s => {
              const active = selectedSize === s;
              return (
                <TouchableOpacity
                  key={s}
                  onPress={() => setSelectedSize(s)}
                  style={[
                    styles.sizeBtn,
                    { borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primary + '1A' : c.surface },
                  ]}
                >
                  <Text style={[styles.sizeBtnText, { color: active ? c.primary : c.textMuted }]}>{s}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>

        {/* About */}
        <Animated.View entering={FadeInDown.delay(260).duration(350)}>
          <Text style={[styles.sectionTitle, { color: c.text }]}>About this item</Text>
          <Text style={[styles.desc, { color: c.textMuted }]}>
            {product.brand
              ? `A quality ${category.toLowerCase()} from ${product.brand}. Crafted for everyday comfort and style, this piece features a clean silhouette and premium fabric finish.`
              : `A quality ${category.toLowerCase()} with a clean silhouette and premium fabric finish — perfect for everyday wear.`}
          </Text>
        </Animated.View>

        {/* Quick actions row */}
        <Animated.View entering={FadeInDown.delay(300).duration(350)} style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.quickBtn, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}
            onPress={handleSave}
          >
            <Ionicons name={saved ? 'heart' : 'heart-outline'} size={18} color={saved ? c.error : c.textMuted} />
            <Text style={[styles.quickBtnText, { color: saved ? c.error : c.textMuted }]}>
              {saved ? 'Saved' : 'Save'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickBtn, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}
            onPress={handleShare}
          >
            <Ionicons name="share-social-outline" size={18} color={c.textMuted} />
            <Text style={[styles.quickBtnText, { color: c.textMuted }]}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickBtn, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}
            onPress={() => navigation.navigate('Wishlist')}
          >
            <Ionicons name="bookmark-outline" size={18} color={c.textMuted} />
            <Text style={[styles.quickBtnText, { color: c.textMuted }]}>Wishlist</Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Bottom bar ── */}
      <Animated.View
        entering={FadeIn.delay(300).duration(400)}
        style={[styles.bottomBar, { backgroundColor: c.surface, borderTopColor: c.border }]}
      >
        <TouchableOpacity
          style={[styles.tryOnBtn, { backgroundColor: c.primary }]}
          onPress={handleTryOn}
          activeOpacity={0.85}
        >
          <Ionicons name="shirt-outline" size={20} color={c.white} />
          <Text style={[styles.tryOnBtnText, { color: c.white }]}>
            {forSlot === 'top' ? 'Use as Top' : forSlot === 'bottom' ? 'Use as Bottom' : 'Try On'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  imgContainer: { width: W, height: IMG_H },
  img: { width: '100%', height: '100%' },

  overlayBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#00000066',
    alignItems: 'center', justifyContent: 'center',
  },
  topRight: {
    position: 'absolute', top: 52, right: spacing.lg,
    flexDirection: 'row', gap: spacing.sm,
  },
  categoryBadge: {
    position: 'absolute', bottom: spacing.md, left: spacing.lg,
    backgroundColor: '#00000066', borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingVertical: 4,
  },
  categoryBadgeText: { fontSize: typography.fontSizeXS, fontWeight: '600' },

  info: { padding: spacing.lg, paddingTop: spacing.md },
  brand: {
    fontSize: typography.fontSizeXS, fontWeight: typography.fontWeightBold,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4,
  },
  name: { fontSize: typography.fontSizeXL, fontWeight: typography.fontWeightBold, lineHeight: 28 },

  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  price: { fontSize: 24, fontWeight: '800' },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  ratingText: { fontSize: typography.fontSizeSM, fontWeight: '600' },

  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  tag: { borderWidth: 1, borderRadius: radius.xl, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  tagText: { fontSize: typography.fontSizeXS },

  divider: { height: StyleSheet.hairlineWidth, marginVertical: spacing.lg },
  sectionTitle: { fontSize: typography.fontSizeMD, fontWeight: typography.fontWeightBold, marginBottom: spacing.sm },

  sizesRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.lg },
  sizeBtn: { width: 48, height: 40, borderWidth: 1.5, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  sizeBtnText: { fontSize: typography.fontSizeSM, fontWeight: '600' },

  desc: { fontSize: typography.fontSizeSM, lineHeight: 22, marginBottom: spacing.lg },

  quickActions: { flexDirection: 'row', gap: spacing.sm },
  quickBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderWidth: 1, borderRadius: radius.xl, paddingVertical: spacing.sm,
  },
  quickBtnText: { fontSize: typography.fontSizeXS, fontWeight: '600' },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: spacing.lg, paddingBottom: 36,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tryOnBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, borderRadius: radius.xl, paddingVertical: spacing.md,
  },
  tryOnBtnText: { fontSize: typography.fontSizeMD, fontWeight: typography.fontWeightBold },
});
