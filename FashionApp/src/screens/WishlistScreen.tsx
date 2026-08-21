import React from 'react';
import {
  View, Text, StyleSheet, FlatList, Image,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { typography, spacing, radius } from '../theme';
import { BrandProduct } from '../data/localClothes';
import { useWishlist } from '../hooks/useWishlist';

type Props = { navigation: any };

export const WishlistScreen: React.FC<Props> = ({ navigation }) => {
  const { themeColors: c } = useTheme();
  const { items, remove } = useWishlist();

  const renderItem = ({ item, index }: { item: BrandProduct; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(300).springify()}>
      <TouchableOpacity
        style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}
        onPress={() => navigation.navigate('ClothingDetail', { product: item })}
        activeOpacity={0.85}
      >
        {/* Image */}
        <View style={[styles.imgWrap, { backgroundColor: c.surfaceElevated }]}>
          <Image source={{ uri: item.imageUrl }} style={styles.img} resizeMode="contain" />
        </View>

        {/* Info */}
        <View style={styles.info}>
          {!!item.brand && (
            <Text style={[styles.brand, { color: c.primary }]} numberOfLines={1}>{item.brand}</Text>
          )}
          <Text style={[styles.name, { color: c.text }]} numberOfLines={2}>{item.name}</Text>
          <Text style={[styles.price, { color: c.textSecondary }]}>{item.price}</Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.tryOnBtn, { backgroundColor: c.primary }]}
              onPress={() => navigation.navigate('TryOn', { clothesImageUrl: item.imageUrl })}
            >
              <Ionicons name="shirt-outline" size={14} color={c.white} />
              <Text style={[styles.tryOnBtnText, { color: c.white }]}>Try On</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.removeBtn, { borderColor: c.border }]}
              onPress={() => remove(item.id)}
            >
              <Ionicons name="heart-dislike-outline" size={16} color={c.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <Animated.View entering={FadeIn.duration(400)}>
        <LinearGradient colors={[c.surfaceElevated, c.surface]} style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={c.text} />
          </TouchableOpacity>
          <View>
            <Text style={[styles.headerTitle, { color: c.text }]}>Wishlist</Text>
            <Text style={[styles.headerSub, { color: c.textMuted }]}>
              {items.length} saved item{items.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </LinearGradient>
      </Animated.View>

      <FlatList
        data={items}
        keyExtractor={i => i.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="heart-outline" size={56} color={c.textMuted} />
            <Text style={[styles.emptyTitle, { color: c.text }]}>Nothing saved yet</Text>
            <Text style={[styles.emptySub, { color: c.textMuted }]}>
              Tap the ♡ on any clothing item to save it here.
            </Text>
            <TouchableOpacity
              style={[styles.browseBtn, { backgroundColor: c.primary }]}
              onPress={() => navigation.navigate('BrandShop')}
            >
              <Text style={[styles.browseBtnText, { color: c.white }]}>Browse Clothes</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingTop: 56, paddingBottom: spacing.md, paddingHorizontal: spacing.lg,
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
  },
  backBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: typography.fontSizeXL, fontWeight: typography.fontWeightBold },
  headerSub: { fontSize: typography.fontSizeXS },

  list: { padding: spacing.lg, gap: spacing.md },

  card: {
    flexDirection: 'row', borderRadius: radius.xl, borderWidth: 1,
    overflow: 'hidden',
  },
  imgWrap: { width: 110, aspectRatio: 3 / 4 },
  img: { width: '100%', height: '100%' },

  info: { flex: 1, padding: spacing.md, justifyContent: 'space-between' },
  brand: { fontSize: typography.fontSizeXS, fontWeight: typography.fontWeightBold, letterSpacing: 0.5, textTransform: 'uppercase' },
  name: { fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightSemiBold, marginTop: 2, lineHeight: 18 },
  price: { fontSize: typography.fontSizeSM, fontWeight: '700', marginTop: 4 },

  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  tryOnBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, borderRadius: radius.lg, paddingVertical: 7,
  },
  tryOnBtnText: { fontSize: typography.fontSizeXS, fontWeight: typography.fontWeightBold },
  removeBtn: {
    width: 34, height: 34, borderRadius: radius.md, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },

  empty: { alignItems: 'center', paddingTop: 100, gap: spacing.md, paddingHorizontal: spacing.xl },
  emptyTitle: { fontSize: typography.fontSizeLG, fontWeight: typography.fontWeightBold },
  emptySub: { fontSize: typography.fontSizeSM, textAlign: 'center', lineHeight: 20 },
  browseBtn: { marginTop: spacing.sm, borderRadius: radius.xl, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  browseBtnText: { fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightBold },
});
