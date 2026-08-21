import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, FlatList,
  TouchableOpacity, Image, ActivityIndicator, ScrollView, Pressable, Dimensions,
} from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import {
  searchUsers, followUser, unfollowUser, getExplorePosts,
  UserCard, PostDto,
} from '../api/social';
import { typography, spacing, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useSimilarGarmentPicker } from '../components/SimilarGarmentPicker';

const { width: SCREEN_W } = Dimensions.get('window');
const GRID_GAP = 2;
const TILE = (SCREEN_W - GRID_GAP * 2) / 3;

const Avatar: React.FC<{ uri?: string | null; name: string; size?: number }> = ({ uri, name, size = 44 }) => {
  const { themeColors: c } = useTheme();
  return uri
    ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
    : <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.surfaceElevated, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: c.primary, fontWeight: '700', fontSize: size * 0.38 }}>{name?.[0]?.toUpperCase()}</Text>
      </View>;
};

type FollowState = 'follow' | 'follow-back' | 'following' | 'friends';

function getFollowState(isFollowedByMe: boolean, followsMe: boolean): FollowState {
  if (isFollowedByMe && followsMe) return 'friends';
  if (!isFollowedByMe && followsMe) return 'follow-back';
  if (isFollowedByMe) return 'following';
  return 'follow';
}

function followLabel(state: FollowState): string {
  if (state === 'friends') return 'Friends';
  if (state === 'follow-back') return 'Follow Back';
  if (state === 'following') return 'Following';
  return 'Follow';
}

const STYLE_CARDS = [
  { label: 'Casual',     sub: 'Everyday looks',      icon: '👕', tint: 'success' as const, params: { prompt: 'Casual everyday outfit' } },
  { label: 'Streetwear', sub: 'Urban style',          icon: '🧢', tint: 'error' as const,   params: { prompt: 'Streetwear urban outfit' } },
  { label: 'Formal',     sub: 'Office & events',      icon: '👔', tint: 'primary' as const, params: { prompt: 'Formal outfit for men for the office' } },
  { label: 'Elegant',    sub: 'Classy & refined',     icon: '✨', tint: 'accent' as const,  params: { prompt: 'Elegant outfit for women for a party' } },
  { label: 'Sports',     sub: 'Active wear',          icon: '🏃', tint: 'success' as const, params: { prompt: 'Sporty streetwear active outfit' } },
  { label: 'Party',      sub: 'Night out looks',      icon: '🎉', tint: 'warning' as const, params: { prompt: 'Outfit for a night out party' } },
];

export const SearchScreen: React.FC = () => {
  const { user }     = useAuth();
  const navigation   = useNavigation<any>();
  const { themeColors: c } = useTheme();
  const [query, setQuery]           = useState('');
  const [results, setResults]       = useState<UserCard[]>([]);
  const [posts, setPosts]           = useState<PostDto[]>([]);
  const [loading, setLoading]       = useState(false);
  const [postsLoading, setPostsLoading] = useState(false);
  const [error, setError]           = useState('');
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const { openPicker, Picker } = useSimilarGarmentPicker();

  // Load the explore grid whenever the screen is focused
  useFocusEffect(useCallback(() => {
    if (!user) return;
    setPostsLoading(true);
    getExplorePosts(user.userId)
      .then(setPosts)
      .catch(() => {})
      .finally(() => setPostsLoading(false));
  }, [user?.userId]));

  const handleSearch = (text: string) => {
    setQuery(text);
    setError('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      if (!user) return;
      setLoading(true);
      try {
        const res = await searchUsers(text.trim(), user.userId);
        setResults(res);
      } catch (e: any) {
        setError(e.message || 'Search failed. Is the server running?');
        setResults([]);
      } finally { setLoading(false); }
    }, 400);
  };

  const handleFollow = async (targetId: number, isFollowing: boolean) => {
    if (!user) return;
    if (isFollowing) {
      await unfollowUser(user.userId, targetId);
    } else {
      await followUser(user.userId, targetId);
    }
    setResults(prev =>
      prev.map(u => u.userId === targetId ? { ...u, isFollowedByMe: !isFollowing } : u)
    );
  };

  const showSuggestions = !query.trim();

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.text }]}>Discover</Text>
        <Text style={[styles.titleSub, { color: c.textSecondary }]}>Looks from everyone, ready to try on</Text>
      </View>

      {/* Search bar */}
      <View style={[styles.searchBar, { backgroundColor: c.surfaceElevated }]}>
        <Ionicons name="search" size={16} color={c.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: c.text }]}
          placeholder="Search people…"
          placeholderTextColor={c.textMuted}
          value={query}
          onChangeText={handleSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {!!query && (
          <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setError(''); }}>
            <Ionicons name="close" size={16} color={c.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {!!error && (
        <View style={[styles.errorBox, { backgroundColor: c.error + '15', borderColor: c.error + '80' }]}>
          <Ionicons name="alert-circle" size={14} color={c.error} />
          <Text style={[styles.errorText, { color: c.error }]}>{error}</Text>
        </View>
      )}

      {/* ── Search results ── */}
      {!showSuggestions && (
        <>
          {loading && <ActivityIndicator color={c.primary} style={{ marginTop: 24 }} />}
          <FlatList
            data={results}
            keyExtractor={u => String(u.userId)}
            contentContainerStyle={styles.list}
            renderItem={({ item, index }) => {
              const state = getFollowState(item.isFollowedByMe, item.followsMe);
              return (
                <Animated.View entering={FadeInDown.delay(index * 60).duration(300)}>
                  <TouchableOpacity
                    style={[styles.userRow, { borderBottomColor: c.border + '50' }]}
                    onPress={() => navigation.navigate('UserProfile', { userId: item.userId })}
                    activeOpacity={0.75}
                  >
                    <Avatar uri={item.avatarUrl} name={item.fullName} size={46} />
                    <View style={styles.userInfo}>
                      <Text style={[styles.userName, { color: c.text }]}>{item.fullName}</Text>
                      {item.username ? <Text style={[styles.userHandle, { color: c.textMuted }]}>@{item.username}</Text> : null}
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.followBtn,
                        { backgroundColor: c.primary },
                        state === 'following' && { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.border },
                        state === 'friends' && { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.success },
                      ]}
                      onPress={() => handleFollow(item.userId, item.isFollowedByMe)}
                    >
                      <Text style={[
                        styles.followBtnText,
                        { color: c.white },
                        state === 'following' && { color: c.text },
                        state === 'friends' && { color: c.success },
                      ]}>
                        {followLabel(state)}
                      </Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                </Animated.View>
              );
            }}
            ListEmptyComponent={
              !loading ? (
                <View style={styles.empty}>
                  <Ionicons name="search" size={32} color={c.textMuted} style={styles.emptyIcon} />
                  <Text style={[styles.emptyText, { color: c.textSecondary }]}>No users found for "{query}"</Text>
                </View>
              ) : null
            }
          />
        </>
      )}

      {/* ── Suggested for you ── */}
      {showSuggestions && (
        <>
          {/* Style recommendations row */}
          <Animated.View entering={FadeIn.delay(100).duration(400)}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: c.textMuted }]}>Style Ideas</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.styleRow}
            >
              {STYLE_CARDS.map((card, i) => {
                const tint = (c as any)[card.tint] as string;
                return (
                  <Pressable
                    key={card.label}
                    onPress={() => navigation.navigate('Recommend' as any, card.params)}
                    style={({ pressed }) => [styles.styleCard, { opacity: pressed ? 0.82 : 1 }]}
                  >
                    <LinearGradient colors={[tint + '1F', tint + '0A']} style={[styles.styleCardGrad, { backgroundColor: c.surface }]}>
                      <Text style={styles.styleCardIcon}>{card.icon}</Text>
                      <Text style={[styles.styleCardLabel, { color: c.text }]}>{card.label}</Text>
                      <Text style={[styles.styleCardSub, { color: c.textSecondary }]}>{card.sub}</Text>
                    </LinearGradient>
                  </Pressable>
                );
              })}
              {/* Brand Shop card */}
              <Pressable
                onPress={() => navigation.navigate('BrandShop' as any)}
                style={({ pressed }) => [styles.styleCard, { opacity: pressed ? 0.82 : 1 }]}
              >
                <LinearGradient colors={[c.primaryLight + '1F', c.primaryLight + '0A']} style={[styles.styleCardGrad, { backgroundColor: c.surface }]}>
                  <Text style={styles.styleCardIcon}>🛍️</Text>
                  <Text style={[styles.styleCardLabel, { color: c.text }]}>Brand Shop</Text>
                  <Text style={[styles.styleCardSub, { color: c.textSecondary }]}>Nike · Zara · Adidas</Text>
                </LinearGradient>
              </Pressable>
            </ScrollView>
          </Animated.View>

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: c.textMuted }]}>Posts</Text>
          </View>

          {postsLoading ? (
            <ActivityIndicator color={c.primary} style={{ marginTop: 32 }} />
          ) : (
            <FlatList
              data={posts}
              keyExtractor={p => String(p.id)}
              numColumns={3}
              contentContainerStyle={styles.grid}
              renderItem={({ item, index }) => (
                <Pressable
                  style={styles.gridTile}
                  onPress={() => navigation.navigate('PostViewer' as any, { posts, startIndex: index })}
                >
                  <Image source={{ uri: item.imageUrl }} style={[styles.gridImage, { backgroundColor: c.surfaceElevated }]} resizeMode="cover" />
                  <TouchableOpacity
                    style={[styles.gridTryOnBtn, { backgroundColor: c.background + 'E6', borderColor: c.primary }]}
                    onPress={() => openPicker(item.imageUrl)}
                    hitSlop={8}
                  >
                    <Ionicons name="shirt-outline" size={14} color={c.primary} />
                  </TouchableOpacity>
                </Pressable>
              )}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Ionicons name="images-outline" size={32} color={c.textMuted} style={styles.emptyIcon} />
                  <Text style={[styles.emptyText, { color: c.textSecondary }]}>No posts yet</Text>
                  <Text style={[styles.emptySubtext, { color: c.textMuted }]}>Be the first to share a look</Text>
                </View>
              }
            />
          )}
        </>
      )}
      {Picker}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingTop: 56, paddingBottom: spacing.md },
  title: { fontSize: typography.fontSize2XL, fontWeight: typography.fontWeightExtraBold },
  titleSub: { fontSize: typography.fontSizeSM, marginTop: 2 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: radius.lg,
    marginHorizontal: spacing.lg, paddingHorizontal: spacing.md,
    paddingVertical: 10, marginBottom: spacing.sm,
  },
  searchInput: { flex: 1, fontSize: typography.fontSizeMD },

  sectionHeader: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 4 },
  sectionTitle: { fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightSemiBold, textTransform: 'uppercase', letterSpacing: 0.8 },

  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 100 },
  userRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1,
  },
  userLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  userInfo: { flex: 1 },
  userName: { fontSize: typography.fontSizeMD, fontWeight: typography.fontWeightSemiBold },
  userHandle: { fontSize: typography.fontSizeXS, marginTop: 2 },
  userMeta: { fontSize: typography.fontSizeXS, marginTop: 2 },

  followBtn: {
    paddingHorizontal: spacing.md, paddingVertical: 7,
    borderRadius: radius.md,
  },
  followBtnText: { fontWeight: typography.fontWeightBold, fontSize: typography.fontSizeSM },

  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { marginBottom: spacing.md },
  emptyText: { fontSize: typography.fontSizeMD },
  emptySubtext: { fontSize: typography.fontSizeSM, marginTop: 6 },

  styleRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.sm },
  styleCard: { borderRadius: radius.xl, overflow: 'hidden', width: 120 },
  styleCardGrad: { padding: spacing.md, borderRadius: radius.xl, height: 110, justifyContent: 'flex-end', gap: 2 },
  styleCardIcon: { fontSize: 28, marginBottom: 4 },
  styleCardLabel: { fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightBold },
  styleCardSub: { fontSize: typography.fontSizeXS },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    marginHorizontal: spacing.lg, marginTop: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md, padding: spacing.md,
  },
  errorText: { fontSize: typography.fontSizeSM, flex: 1 },

  grid: { paddingBottom: 100 },
  gridTile: { width: TILE, height: TILE, marginRight: GRID_GAP, marginBottom: GRID_GAP },
  gridImage: { width: '100%', height: '100%' },
  gridTryOnBtn: {
    position: 'absolute', bottom: 6, right: 6,
    width: 26, height: 26, borderRadius: 13, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
});
