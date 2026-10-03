import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image,
  TextInput, TouchableOpacity, Dimensions, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import { BrandProduct, fetchBrandProducts, filterLocalClothes } from '../data/localClothes';
import { typography, spacing, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useWishlist } from '../hooks/useWishlist';

const { width: W } = Dimensions.get('window');
const CARD_W = (W - spacing.lg * 2 - spacing.md) / 2;

// Matches our own catalog's actual fields (category/gender/style) — every
// chip here is guaranteed to return items that work with virtual try-on.
const BRAND_CHIPS = [
  { label: 'All',          query: ''            },
  { label: '👕 Tops',       query: 'top'         },
  { label: '👖 Bottoms',    query: 'bottom'      },
  { label: '🧑 Men',        query: 'men'         },
  { label: '👩 Women',      query: 'women'       },
  { label: 'Casual',        query: 'casual'      },
  { label: 'Streetwear',    query: 'streetwear'  },
  { label: 'Elegant',       query: 'elegant'     },
  { label: 'Minimal',       query: 'minimal'     },
];

// Arrived from TryOn picking a specific slot — the category itself isn't a
// choice anymore (that's what got you here), so there's no "Tops"/"Bottoms"/
// "Shoes"/"All" chip to accidentally wander off into the wrong category with.
// Only gender/style narrow further within the locked category.
const SLOT_CHIPS: Record<'top' | 'bottom', { label: string; query: string }[]> = {
  top: [
    { label: 'All Tops',  query: '' },
    { label: '🧑 Men',     query: 'men' },
    { label: '👩 Women',   query: 'women' },
    { label: 'Casual',     query: 'casual' },
    { label: 'Streetwear', query: 'streetwear' },
    { label: 'Elegant',    query: 'elegant' },
    { label: 'Minimal',    query: 'minimal' },
  ],
  bottom: [
    { label: 'All Bottoms', query: '' },
    { label: '🧑 Men',       query: 'men' },
    { label: '👩 Women',     query: 'women' },
    { label: 'Casual',       query: 'casual' },
    { label: 'Streetwear',   query: 'streetwear' },
    { label: 'Elegant',      query: 'elegant' },
    { label: 'Minimal',      query: 'minimal' },
  ],
};

type Props = { navigation: any };

export const BrandShopScreen: React.FC<Props> = ({ navigation }) => {
  const { themeColors: c } = useTheme();
  const { count: wishlistCount } = useWishlist();
  const route = useRoute<any>();
  // Arrived from TryOn's "Top Photo" or "Bottom Photo" picker — carry that
  // through so ClothingDetail's "Try On" button fills the right slot back on
  // TryOn, and pre-filter the grid to the matching category to save a tap.
  const forSlot: 'top' | 'bottom' | undefined = route.params?.forSlot;

  const chips = forSlot ? SLOT_CHIPS[forSlot] : BRAND_CHIPS;

  const [searchText, setSearchText] = useState('');
  const [activeChip, setActiveChip] = useState('');
  const [allProducts, setAllProducts] = useState<BrandProduct[]>([]);
  const [products,    setProducts]    = useState<BrandProduct[]>([]);
  const [loading,     setLoading]     = useState(true);
  const inputRef = useRef<TextInput>(null);

  // The pool everything filters within — locked to the picked slot's
  // category so there's no way to end up looking at shoes while picking a
  // top, no matter what's typed in search or tapped in the chip row.
  const categoryBase = React.useMemo(
    () => (forSlot ? filterLocalClothes(allProducts, forSlot) : allProducts),
    [allProducts, forSlot],
  );

  useEffect(() => {
    fetchBrandProducts()
      .then(items => {
        setAllProducts(items);
        setProducts(forSlot ? filterLocalClothes(items, forSlot) : items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const applyFilter = useCallback((q: string, source: BrandProduct[]) => {
    setProducts(filterLocalClothes(source, q));
  }, []);

  const handleSearch = () => {
    const q = searchText.trim();
    applyFilter(q, categoryBase);
  };

  const handleChip = (chip: { label: string; query: string }) => {
    setActiveChip(chip.query);
    setSearchText('');
    applyFilter(chip.query, categoryBase);
  };

  // kept for FlatList onEndReached signature compatibility
  const handleLoadMore = () => {};

  const handlePickProduct = (product: BrandProduct) => {
    navigation.navigate('ClothingDetail', { product, forSlot });
  };

  const renderProduct = ({ item, index }: { item: BrandProduct; index: number }) => (
    <Animated.View entering={FadeInDown.delay((index % 12) * 40).duration(300)}>
      <TouchableOpacity
        style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}
        onPress={() => handlePickProduct(item)}
        activeOpacity={0.8}
      >
        <View style={[styles.cardImgWrap, { backgroundColor: c.surfaceElevated }]}>
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.cardImg}
            resizeMode="cover"
          />
          <View style={[styles.tryOnBadge, { backgroundColor: c.primary }]}>
            <Text style={[styles.tryOnBadgeText, { color: c.white }]}>Details</Text>
          </View>
        </View>
        {!!item.brand && (
          <Text style={[styles.cardBrand, { color: c.primary }]} numberOfLines={1}>{item.brand}</Text>
        )}
        <Text style={[styles.cardName, { color: c.text }]} numberOfLines={2}>{item.name}</Text>
        {!!item.price && (
          <Text style={[styles.cardPrice, { color: c.textSecondary }]}>{item.price}</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>

      {/* ── Header ── */}
      <Animated.View entering={FadeIn.duration(400)}>
        <LinearGradient colors={[c.surfaceElevated, c.surface]} style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={c.text} />
            </TouchableOpacity>
            <View style={styles.headerTitles}>
              <Text style={[styles.headerTitle, { color: c.text }]}>Brand Shop</Text>
              <Text style={[styles.headerSub, { color: c.textMuted }]}>
                {forSlot === 'top' ? 'Pick a top to try on' : forSlot === 'bottom' ? 'Pick a bottom to try on' : 'Pick a clothes item to try on'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Wishlist')} style={styles.wishlistBtn}>
              <Ionicons name="heart-outline" size={22} color={c.text} />
              {wishlistCount > 0 && (
                <View style={[styles.badge, { backgroundColor: c.error }]}>
                  <Text style={[styles.badgeText, { color: c.white }]}>{wishlistCount > 9 ? '9+' : wishlistCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Search bar */}
          <View style={[styles.searchBar, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Ionicons name="search-outline" size={18} color={c.textMuted} />
            <TextInput
              ref={inputRef}
              value={searchText}
              onChangeText={t => { setSearchText(t); setActiveChip(''); applyFilter(t, categoryBase); }}
              onSubmitEditing={handleSearch}
              placeholder={forSlot === 'top' ? 'Search tops…' : forSlot === 'bottom' ? 'Search bottoms…' : 'Search tops, bottoms…'}
              placeholderTextColor={c.textMuted}
              style={[styles.searchInput, { color: c.text }]}
              returnKeyType="search"
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => { setSearchText(''); setActiveChip(''); applyFilter('', categoryBase); }}>
                <Ionicons name="close-circle" size={18} color={c.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Brand chips */}
          <FlatList
            data={chips}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={i => i.label}
            contentContainerStyle={styles.chips}
            renderItem={({ item }) => {
              const active = activeChip === item.query && searchText === '';
              return (
                <TouchableOpacity
                  onPress={() => handleChip(item)}
                  activeOpacity={0.75}
                  style={[styles.chip, { borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primary + '18' : c.surface }]}
                >
                  <Text style={[styles.chipText, { color: active ? c.primary : c.textMuted }]}>{item.label}</Text>
                </TouchableOpacity>
              );
            }}
          />
        </LinearGradient>
      </Animated.View>

      {/* ── Grid ── */}
      {loading ? (
        <View style={styles.emptyWrap}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      ) : (
        <FlatList
          data={products}
          numColumns={2}
          keyExtractor={(item, idx) => `${item.id}_${idx}`}
          renderItem={renderProduct}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={[styles.emptyTitle, { color: c.textMuted }]}>No items found</Text>
              <Text style={[styles.emptySub, { color: c.textMuted }]}>Try a different search term.</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: { paddingTop: 56, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xs },
  backBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerTitles: { flex: 1 },
  wishlistBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { fontSize: 9, fontWeight: '800' },
  headerTitle: { fontSize: typography.fontSizeXL, fontWeight: typography.fontWeightBold },
  headerSub: { fontSize: typography.fontSizeXS },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderRadius: radius.lg, borderWidth: 1,
    paddingHorizontal: spacing.md, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: typography.fontSizeMD, padding: 0 },

  chips: { gap: spacing.sm, paddingVertical: spacing.xs },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1 },
  chipText: { fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightSemiBold },

  grid: { padding: spacing.lg, gap: spacing.md },
  row: { gap: spacing.md },

  card: {
    width: CARD_W, borderRadius: radius.xl, borderWidth: 1,
    overflow: 'hidden', marginBottom: spacing.md,
  },
  cardImgWrap: { width: CARD_W, height: CARD_W * 1.25, position: 'relative' },
  cardImg: { width: '100%', height: '100%' },
  tryOnBadge: {
    position: 'absolute', bottom: 8, right: 8,
    borderRadius: radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  tryOnBadgeText: { fontSize: 10, fontWeight: '800' },
  cardBrand: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase', paddingHorizontal: 10, paddingTop: 8 },
  cardName: { fontSize: typography.fontSizeXS + 1, paddingHorizontal: 10, paddingTop: 2, lineHeight: 16 },
  cardPrice: { fontSize: typography.fontSizeXS, paddingHorizontal: 10, paddingVertical: 8, fontWeight: typography.fontWeightSemiBold },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.md },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: typography.fontSizeLG, fontWeight: typography.fontWeightBold, textAlign: 'center' },
  emptySub: { fontSize: typography.fontSizeSM, textAlign: 'center', lineHeight: 20 },
});
