import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { typography, spacing, radius } from '../theme';
import { getFavorites, toggleFavorite, FavoriteOutfit } from '../api/outfitSocial';
import { CATVTON_BASE_URL } from '../api/client';

const imgSrc = (url: string) =>
  ({ uri: url.startsWith('http') ? url : `${CATVTON_BASE_URL}${url}` });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

type Props = { navigation: any };

export const FavoritesScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const { themeColors: c } = useTheme();
  const [items, setItems] = useState<FavoriteOutfit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getFavorites(user.id);
      setItems(data);
    } catch {}
  }, [user]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleUnfavorite = async (item: FavoriteOutfit) => {
    if (!user) return;
    await toggleFavorite(item.tryOnHistoryId, user.id);
    setItems(prev => prev.filter(i => i.favoriteId !== item.favoriteId));
  };

  const renderItem = ({ item, index }: { item: FavoriteOutfit; index: number }) => {
    const outfit = item.outfit;
    if (!outfit) return null;
    return (
      <Animated.View entering={FadeInDown.delay(index * 50).duration(350).springify()}>
        <TouchableOpacity
          style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}
          onPress={() => navigation.navigate('TryOn')}
          activeOpacity={0.85}
        >
          <View style={styles.cardImg}>
            {outfit.resultImageUrl ? (
              <Image source={imgSrc(outfit.resultImageUrl)} style={styles.img} resizeMode="cover" />
            ) : (
              <View style={[styles.imgPlaceholder, { backgroundColor: c.surfaceElevated }]}>
                <Ionicons name="image-outline" size={32} color={c.textMuted} />
              </View>
            )}
            <LinearGradient colors={['transparent', '#000000CC']} style={styles.imgOverlay} />
            <Text style={styles.dateLabel}>{fmtDate(outfit.createdAt)}</Text>
          </View>
          <View style={[styles.cardBody, { backgroundColor: c.surface }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: c.text }]} numberOfLines={1}>
                {outfit.selectedOutfitTitle || 'Try-On Outfit'}
              </Text>
              {!!outfit.selectedOutfitCategory && (
                <Text style={[styles.cardCat, { color: c.textMuted }]}>{outfit.selectedOutfitCategory}</Text>
              )}
            </View>
            <TouchableOpacity onPress={() => handleUnfavorite(item)} style={styles.heartBtn}>
              <Ionicons name="heart" size={22} color={c.error} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <Animated.View entering={FadeIn.duration(400)}>
        <LinearGradient colors={[c.surfaceElevated, c.background]} style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={c.text} />
          </TouchableOpacity>
          <View>
            <Text style={[styles.headerTitle, { color: c.text }]}>Favourites</Text>
            <Text style={[styles.headerSub, { color: c.textMuted }]}>{items.length} saved outfit{items.length !== 1 ? 's' : ''}</Text>
          </View>
        </LinearGradient>
      </Animated.View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={c.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => String(i.favoriteId)}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="heart-outline" size={56} color={c.textMuted} />
              <Text style={[styles.emptyTitle, { color: c.text }]}>No favourites yet</Text>
              <Text style={[styles.emptySub, { color: c.textMuted }]}>
                Tap the ♥ on any try-on to save it here.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 56, paddingBottom: spacing.md, paddingHorizontal: spacing.lg,
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
  },
  backBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: typography.fontSizeXL, fontWeight: typography.fontWeightBold },
  headerSub: { fontSize: typography.fontSizeXS },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  grid: { padding: spacing.lg, paddingTop: spacing.md },
  row: { gap: spacing.md, marginBottom: spacing.md },
  card: { flex: 1, borderRadius: radius.xl, borderWidth: 1, overflow: 'hidden' },
  cardImg: { position: 'relative', aspectRatio: 3 / 4 },
  img: { width: '100%', height: '100%' },
  imgPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  imgOverlay: { ...StyleSheet.absoluteFillObject },
  dateLabel: { position: 'absolute', bottom: 8, left: 8, color: '#fff', fontSize: 10, fontWeight: '600' },
  cardBody: { flexDirection: 'row', alignItems: 'center', padding: spacing.sm, paddingHorizontal: 10 },
  cardTitle: { fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightSemiBold },
  cardCat: { fontSize: 10, marginTop: 2 },
  heartBtn: { padding: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100, gap: spacing.md },
  emptyTitle: { fontSize: typography.fontSizeLG, fontWeight: typography.fontWeightBold },
  emptySub: { fontSize: typography.fontSizeSM, textAlign: 'center', maxWidth: 240, lineHeight: 20 },
});
