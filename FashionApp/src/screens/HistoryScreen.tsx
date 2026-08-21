import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image,
  Pressable, Modal, Alert, ActivityIndicator,
  RefreshControl, TouchableOpacity, Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { getTryOnHistory, TryOnHistoryItem } from '../api/outfit';
import {
  getOutfitSummary, toggleLike, toggleFavorite,
  OutfitSummary,
} from '../api/outfitSocial';
import { CommentsSheet } from '../components/ui/CommentsSheet';
import { useAuth } from '../context/AuthContext';
import { Badge, IconBox } from '../components/ui/Badge';
import { typography, spacing, radius, shadows } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { CATVTON_BASE_URL } from '../api/client';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const imgSrc = (url: string) => ({ uri: url.startsWith('http') ? url : `${CATVTON_BASE_URL}${url}` });

// ── Action bar shown under each card ─────────────────────────────────────────
const ActionBar: React.FC<{
  item: TryOnHistoryItem;
  userId: number;
  onComment: () => void;
}> = ({ item, userId, onComment }) => {
  const { themeColors: c } = useTheme();
  const [social, setSocial] = useState<OutfitSummary>({
    likeCount: 0, commentCount: 0, liked: false, favorited: false,
  });

  useEffect(() => {
    getOutfitSummary(item.id, userId).then(setSocial).catch(() => {});
  }, [item.id, userId]);

  const handleLike = async () => {
    const res = await toggleLike(item.id, userId).catch(() => null);
    if (res) setSocial(s => ({ ...s, liked: res.liked, likeCount: res.likeCount }));
  };

  const handleFavorite = async () => {
    const res = await toggleFavorite(item.id, userId).catch(() => null);
    if (res) setSocial(s => ({ ...s, favorited: res.favorited }));
  };

  const handleShare = async () => {
    const url = item.resultImageUrl
      ? (item.resultImageUrl.startsWith('http') ? item.resultImageUrl : `${CATVTON_BASE_URL}${item.resultImageUrl}`)
      : '';
    await Share.share({
      message: `Check out my outfit try-on with SmartFashion! 👗✨${url ? `\n${url}` : ''}`,
      url: url || undefined,
    }).catch(() => {});
  };

  return (
    <View style={[styles.actionBar, { borderTopColor: c.border }]}>
      {/* Like */}
      <TouchableOpacity onPress={handleLike} style={styles.actionBtn}>
        <Ionicons
          name={social.liked ? 'heart' : 'heart-outline'}
          size={20}
          color={social.liked ? c.error : c.textMuted}
        />
        {social.likeCount > 0 && (
          <Text style={[styles.actionCount, { color: c.textMuted }]}>{social.likeCount}</Text>
        )}
      </TouchableOpacity>

      {/* Comment */}
      <TouchableOpacity onPress={onComment} style={styles.actionBtn}>
        <Ionicons name="chatbubble-outline" size={18} color={c.textMuted} />
        {social.commentCount > 0 && (
          <Text style={[styles.actionCount, { color: c.textMuted }]}>{social.commentCount}</Text>
        )}
      </TouchableOpacity>

      {/* Share */}
      <TouchableOpacity onPress={handleShare} style={styles.actionBtn}>
        <Ionicons name="share-outline" size={20} color={c.textMuted} />
      </TouchableOpacity>

      {/* Favorite */}
      <TouchableOpacity onPress={handleFavorite} style={[styles.actionBtn, styles.actionBtnRight]}>
        <Ionicons
          name={social.favorited ? 'bookmark' : 'bookmark-outline'}
          size={20}
          color={social.favorited ? c.primary : c.textMuted}
        />
      </TouchableOpacity>
    </View>
  );
};

// ── Card ──────────────────────────────────────────────────────────────────────
const HistoryCard: React.FC<{
  item: TryOnHistoryItem;
  userId: number;
  onPress: () => void;
  index: number;
}> = ({ item, userId, onPress, index }) => {
  const { themeColors: c } = useTheme();
  const [commentsOpen, setCommentsOpen] = useState(false);

  return (
    <>
      <Animated.View
        entering={FadeInDown.delay(index * 60).duration(380).springify()}
        style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}
      >
        <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.88 }]}>
          <View style={styles.cardImageBox}>
            {item.resultImageUrl
              ? <Image source={imgSrc(item.resultImageUrl)} style={styles.cardImage} resizeMode="cover" />
              : (
                <View style={[styles.cardImageEmpty, { backgroundColor: c.surfaceElevated }]}>
                  <IconBox symbol="◈" variant="accent" size={36} />
                </View>
              )
            }
            <LinearGradient colors={['transparent', '#000000BB']} style={styles.cardOverlay} />
            <View style={styles.cardDateBox}>
              <Text style={styles.cardDate}>{formatDate(item.createdAt)}</Text>
            </View>
          </View>
          <View style={styles.cardBody}>
            <Text style={[styles.cardTitle, { color: c.text }]} numberOfLines={1}>
              {item.selectedOutfitTitle || 'Try-On'}
            </Text>
            {!!item.selectedOutfitCategory && (
              <Badge label={item.selectedOutfitCategory} variant="primary" size="sm" />
            )}
          </View>
        </Pressable>

        {/* Social action bar */}
        <ActionBar item={item} userId={userId} onComment={() => setCommentsOpen(true)} />
      </Animated.View>

      <CommentsSheet
        visible={commentsOpen}
        historyId={item.id}
        onClose={() => setCommentsOpen(false)}
      />
    </>
  );
};

// ── Screen ────────────────────────────────────────────────────────────────────
type Props = { navigation: any };

export const HistoryScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const { themeColors: c } = useTheme();
  const [items, setItems] = useState<TryOnHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<TryOnHistoryItem | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    try {
      setItems(await getTryOnHistory(user.userId));
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to load history.');
    } finally { setLoading(false); setRefreshing(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(true); };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: c.background }]}>
        <ActivityIndicator color={c.primary} size="large" />
        <Text style={[styles.loadingText, { color: c.textSecondary }]}>Loading your history…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>

      {/* ── Header ── */}
      <Animated.View entering={FadeIn.duration(450)}>
        <LinearGradient colors={[c.surfaceElevated, c.background]} style={styles.header}>
          <View style={styles.headerRow}>
            <View style={{ gap: 4 }}>
              <Badge label="YOUR WARDROBE" variant="success" />
              <Text style={[styles.headerTitle, { color: c.text }]}>Style History</Text>
              <Text style={[styles.headerSub, { color: c.textSecondary }]}>All your virtual try-ons</Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('Favorites')}
              style={[styles.favBtn, { backgroundColor: c.primary + '18', borderColor: c.primary + '50' }]}
            >
              <Ionicons name="heart" size={18} color={c.primary} />
              <Text style={[styles.favBtnText, { color: c.primary }]}>Saved</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </Animated.View>

      {items.length === 0 ? (
        <Animated.View entering={FadeIn.delay(200).duration(500)} style={styles.empty}>
          <View style={styles.emptyIconBox}>
            <IconBox symbol="≡" variant="success" size={64} />
          </View>
          <Text style={[styles.emptyTitle, { color: c.text }]}>No History Yet</Text>
          <Text style={[styles.emptySub, { color: c.textSecondary }]}>
            Your virtual try-on results will appear here once you generate them.
          </Text>
        </Animated.View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => String(i.id)}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <HistoryCard
              item={item}
              userId={user?.id ?? user?.userId ?? 0}
              index={index}
              onPress={() => setSelected(item)}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />
          }
        />
      )}

      {/* ── Detail modal ── */}
      <Modal visible={!!selected} animationType="slide" transparent presentationStyle="pageSheet">
        {selected && (
          <View style={[styles.modal, { backgroundColor: c.surface }]}>
            <View style={[styles.modalHandle, { backgroundColor: c.border }]} />
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleGroup}>
                <Badge label="LOOK DETAIL" variant="primary" size="sm" />
                <Text style={[styles.modalTitle, { color: c.text }]}>{selected.selectedOutfitTitle || 'Try-On Detail'}</Text>
              </View>
              <Pressable onPress={() => setSelected(null)} style={({ pressed }) => [styles.closeBtn, { backgroundColor: c.surfaceElevated, borderColor: c.border }, pressed && { opacity: 0.7 }]}>
                <Text style={[styles.closeBtnText, { color: c.textSecondary }]}>✕</Text>
              </Pressable>
            </View>

            {selected.resultImageUrl
              ? <Image source={imgSrc(selected.resultImageUrl)} style={[styles.modalImage, { backgroundColor: c.surfaceElevated }]} resizeMode="cover" />
              : (
                <View style={[styles.modalImageEmpty, { backgroundColor: c.surfaceElevated }]}>
                  <IconBox symbol="◈" variant="accent" size={48} />
                  <Text style={[styles.modalImageEmptyText, { color: c.textMuted }]}>No image available</Text>
                </View>
              )
            }

            {/* Share row inside modal */}
            <View style={[styles.modalActions, { borderTopColor: c.border, borderBottomColor: c.border }]}>
              {[
                { icon: 'share-social-outline', label: 'Share', onPress: async () => {
                  const url = selected.resultImageUrl?.startsWith('http') ? selected.resultImageUrl : `${CATVTON_BASE_URL}${selected.resultImageUrl}`;
                  await Share.share({ message: `My outfit try-on 👗✨\n${url}`, url }).catch(() => {});
                }},
              ].map(a => (
                <TouchableOpacity key={a.label} onPress={a.onPress} style={styles.modalActionBtn}>
                  <Ionicons name={a.icon as any} size={20} color={c.primary} />
                  <Text style={[styles.modalActionLabel, { color: c.primary }]}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalBody}>
              {[
                { label: 'Date',     value: formatDate(selected.createdAt) },
                selected.prompt                  && { label: 'Prompt',   value: selected.prompt },
                selected.selectedOutfitColor     && { label: 'Colour',   value: selected.selectedOutfitColor },
                selected.selectedOutfitCategory  && { label: 'Category', value: selected.selectedOutfitCategory },
              ].filter(Boolean).map((row: any) => (
                <View key={row.label} style={[styles.modalRow, { borderBottomColor: c.border }]}>
                  <Text style={[styles.modalRowLabel, { color: c.textMuted }]}>{row.label}</Text>
                  <Text style={[styles.modalRowValue, { color: c.text }]}>{row.value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
};

const CARD_W = '48.5%';

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  loadingText: { fontSize: typography.fontSizeSM },

  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: typography.fontSize2XL, fontWeight: typography.fontWeightBold },
  headerSub: { fontSize: typography.fontSizeSM },
  favBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: radius.full, borderWidth: 1,
  },
  favBtnText: { fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightSemiBold },

  list: { padding: spacing.md, paddingBottom: spacing.xxxl + 20 },
  row: { justifyContent: 'space-between' },

  card: { width: CARD_W, marginBottom: spacing.md, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, ...shadows.sm },
  cardImageBox: { height: 190, position: 'relative' },
  cardImage: { width: '100%', height: '100%' },
  cardImageEmpty: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  cardOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 70 },
  cardDateBox: { position: 'absolute', bottom: 10, left: 10, backgroundColor: '#00000060', paddingVertical: 3, paddingHorizontal: 8, borderRadius: radius.full },
  cardDate: { color: '#FFFFFF', fontSize: typography.fontSizeXS, fontWeight: typography.fontWeightSemiBold },
  cardBody: { padding: spacing.sm, gap: 5 },
  cardTitle: { fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightSemiBold },

  actionBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 4 },
  actionBtnRight: { marginLeft: 'auto' },
  actionCount: { fontSize: 11, fontWeight: '600' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.md },
  emptyIconBox: { marginBottom: spacing.sm },
  emptyTitle: { fontSize: typography.fontSizeXL, fontWeight: typography.fontWeightBold },
  emptySub: { fontSize: typography.fontSizeMD, textAlign: 'center', lineHeight: 22 },

  modal: { flex: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: 56 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: spacing.md },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  modalTitleGroup: { gap: 6, flex: 1 },
  modalTitle: { fontSize: typography.fontSizeLG, fontWeight: typography.fontWeightBold },
  closeBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  closeBtnText: { fontSize: 14, fontWeight: typography.fontWeightBold },
  modalImage: { width: '100%', height: 340 },
  modalImageEmpty: { height: 200, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  modalImageEmptyText: { fontSize: typography.fontSizeSM },
  modalActions: {
    flexDirection: 'row', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingRight: spacing.lg },
  modalActionLabel: { fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightSemiBold },
  modalBody: { padding: spacing.lg, gap: spacing.sm },
  modalRow: { paddingVertical: spacing.sm, borderBottomWidth: 1 },
  modalRowLabel: { fontSize: 10, fontWeight: typography.fontWeightBold, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 },
  modalRowValue: { fontSize: typography.fontSizeMD },
});
