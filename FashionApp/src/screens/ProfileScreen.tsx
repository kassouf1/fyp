import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, Dimensions, ActivityIndicator, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getUserProfile, getUserPosts, PostDto } from '../api/social';
import { getTryOnHistory, TryOnHistoryItem } from '../api/outfit';
import { CATVTON_BASE_URL } from '../api/client';
import { typography, spacing, radius } from '../theme';

const { width: W } = Dimensions.get('window');
const CELL = (W - 2) / 3;

const imgSrc = (url: string) => ({ uri: url.startsWith('http') ? url : `${CATVTON_BASE_URL}${url}` });

type Tab = 'wardrobe' | 'posts';

type Props = { navigation: any };

export const ProfileScreen: React.FC<Props> = () => {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const { themeColors: c } = useTheme();

  const [friendCount, setFriendCount]       = useState(0);
  const [postCount, setPostCount]           = useState(0);
  const [posts, setPosts]                   = useState<PostDto[]>([]);
  const [tryOns, setTryOns]                 = useState<TryOnHistoryItem[]>([]);
  const [loading, setLoading]               = useState(true);
  const [tab, setTab]                       = useState<Tab>('wardrobe');

  const initials = user?.fullName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? '??';

  // Sharing a post is secondary to the wardrobe, so it doesn't get a tab-bar
  // slot of its own — just a quiet entry point here, next to the feed it fills.
  const handleAddPost = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow photo access in Settings.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (!result.canceled && result.assets[0]) {
        navigation.navigate('CreatePost', { imageUri: result.assets[0].uri });
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not open photo library.');
    }
  };

  useFocusEffect(useCallback(() => {
    if (!user?.userId) return;
    setLoading(true);
    Promise.all([
      getUserProfile(user.userId, user.userId),
      getUserPosts(user.userId, user.userId),
      getTryOnHistory(user.userId),
    ]).then(([profile, myPosts, history]) => {
      setFriendCount(profile.friendCount);
      setPostCount(profile.postCount);
      setPosts(myPosts);
      setTryOns(history);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user?.userId]));

  const renderHeader = () => (
    <View style={{ backgroundColor: c.background }}>
      {/* Top bar */}
      <View style={[s.topBar, { backgroundColor: c.background, borderBottomColor: c.border }]}>
        <Text style={[s.topUsername, { color: c.text }]}>
          {user?.username ?? user?.fullName ?? 'Profile'}
        </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={s.settingsBtn} activeOpacity={0.7}>
          <Ionicons name="settings-outline" size={22} color={c.text} />
        </TouchableOpacity>
      </View>

      {/* Avatar + stats row */}
      <View style={s.profileRow}>
        <LinearGradient colors={[c.primaryLight, c.primary]} style={s.avatarRing}>
          <View style={[s.avatarWrap, { borderColor: c.background }]}>
            {user?.avatarUrl
              ? <Image source={{ uri: user.avatarUrl }} style={s.avatar} />
              : (
                <LinearGradient colors={[c.primaryLight, c.primary, c.primaryDark]} style={[s.avatar, { alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={[s.initials, { color: c.white }]}>{initials}</Text>
                </LinearGradient>
              )
            }
          </View>
        </LinearGradient>

        <View style={s.statsRow}>
          <TouchableOpacity style={s.statItem} onPress={() => setTab('wardrobe')}>
            <Text style={[s.statValue, { color: c.text }]}>{tryOns.length}</Text>
            <Text style={[s.statLabel, { color: c.textSecondary }]}>Looks</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.statItem} onPress={() => navigation.navigate('FollowersList', { userId: user?.userId, type: 'friends', name: user?.fullName })}>
            <Text style={[s.statValue, { color: c.text }]}>{friendCount}</Text>
            <Text style={[s.statLabel, { color: c.textSecondary }]}>Friends</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.statItem} onPress={() => setTab('posts')}>
            <Text style={[s.statValue, { color: c.text }]}>{postCount}</Text>
            <Text style={[s.statLabel, { color: c.textSecondary }]}>Posts</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Name + bio */}
      <View style={s.bioArea}>
        <Text style={[s.fullName, { color: c.text }]}>{user?.fullName}</Text>
        {!!user?.bio && <Text style={[s.bio, { color: c.textSecondary }]}>{user.bio}</Text>}
      </View>

      {/* Action buttons */}
      <View style={s.actionRow}>
        <TouchableOpacity
          style={[s.actionBtn, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}
          onPress={() => navigation.navigate('EditProfile')}
          activeOpacity={0.8}
        >
          <Ionicons name="pencil-outline" size={14} color={c.text} />
          <Text style={[s.actionBtnText, { color: c.text }]}>Edit Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tryOnBtn, { backgroundColor: c.primary }]}
          onPress={() => navigation.navigate('TryOn')}
          activeOpacity={0.85}
        >
          <Ionicons name="shirt" size={14} color={c.white} />
          <Text style={[s.tryOnBtnText, { color: c.white }]}>Try On</Text>
        </TouchableOpacity>
      </View>

      {/* Wardrobe / Posts tabs */}
      <View style={[s.tabRow, { borderBottomColor: c.border }]}>
        <TouchableOpacity
          style={[s.tabBtn, tab === 'wardrobe' && { borderBottomColor: c.primary }]}
          onPress={() => setTab('wardrobe')}
          activeOpacity={0.7}
        >
          <Ionicons name="shirt-outline" size={16} color={tab === 'wardrobe' ? c.primary : c.textMuted} />
          <Text style={[s.tabLabel, { color: tab === 'wardrobe' ? c.primary : c.textMuted }]}>Wardrobe</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tabBtn, tab === 'posts' && { borderBottomColor: c.primary }]}
          onPress={() => setTab('posts')}
          activeOpacity={0.7}
        >
          <Ionicons name="grid-outline" size={16} color={tab === 'posts' ? c.primary : c.textMuted} />
          <Text style={[s.tabLabel, { color: tab === 'posts' ? c.primary : c.textMuted }]}>Posts</Text>
        </TouchableOpacity>
        {tab === 'posts' && (
          <TouchableOpacity onPress={handleAddPost} activeOpacity={0.7} style={s.addPostBtn}>
            <Ionicons name="add" size={18} color={c.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[s.container, { backgroundColor: c.background }]}>
        {renderHeader()}
        <ActivityIndicator color={c.primary} style={{ marginTop: 40 }} />
      </View>
    );
  }

  return (
    <View style={[s.container, { backgroundColor: c.background }]}>
      {tab === 'wardrobe' ? (
        <FlatList
          data={tryOns}
          numColumns={3}
          keyExtractor={i => String(i.id)}
          ListHeaderComponent={renderHeader}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => navigation.navigate('History')} activeOpacity={0.9}>
              {item.resultImageUrl
                ? <Image source={imgSrc(item.resultImageUrl)} style={s.gridCell} />
                : <View style={[s.gridCell, { backgroundColor: c.surfaceElevated, alignItems: 'center', justifyContent: 'center' }]}>
                    <Ionicons name="shirt-outline" size={20} color={c.textMuted} />
                  </View>
              }
            </TouchableOpacity>
          )}
          columnWrapperStyle={{ gap: 1 }}
          ItemSeparatorComponent={() => <View style={{ height: 1 }} />}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Ionicons name="shirt-outline" size={40} color={c.textMuted} />
              <Text style={[s.emptyText, { color: c.textMuted }]}>Your wardrobe is empty</Text>
              <Text style={[s.emptySubtext, { color: c.textMuted }]}>Try on a look to start building it</Text>
              <TouchableOpacity onPress={() => navigation.navigate('TryOn')} style={{ marginTop: spacing.sm }}>
                <Text style={[s.emptyAction, { color: c.primary }]}>Try On Now</Text>
              </TouchableOpacity>
            </View>
          }
        />
      ) : (
        <FlatList
          data={posts}
          numColumns={3}
          keyExtractor={p => String(p.id)}
          ListHeaderComponent={renderHeader}
          renderItem={({ item, index }) => (
            <TouchableOpacity onPress={() => navigation.navigate('PostViewer', { posts, startIndex: index })} activeOpacity={0.9}>
              <Image source={{ uri: item.imageUrl }} style={s.gridCell} />
              {item.likeCount > 0 && (
                <View style={s.likeOverlay}>
                  <Ionicons name="heart" size={11} color="#fff" style={{ textShadowColor: '#000', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } }} />
                  <Text style={s.likeText}>{item.likeCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          columnWrapperStyle={{ gap: 1 }}
          ItemSeparatorComponent={() => <View style={{ height: 1 }} />}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Ionicons name="images-outline" size={40} color={c.textMuted} />
              <Text style={[s.emptyText, { color: c.textMuted }]}>No posts yet</Text>
              <TouchableOpacity onPress={handleAddPost} style={{ marginTop: spacing.sm }}>
                <Text style={[s.emptyAction, { color: c.primary }]}>Share your first photo</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1 },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: 52, paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topUsername: { fontSize: typography.fontSizeLG, fontWeight: typography.fontWeightBold },
  settingsBtn: { padding: 6 },

  profileRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm,
  },
  avatarRing: { width: 92, height: 92, borderRadius: 46, padding: 3, marginRight: spacing.md },
  avatarWrap: { flex: 1, borderRadius: 43, borderWidth: 3, overflow: 'hidden' },
  avatar: { width: '100%', height: '100%', borderRadius: 43 },
  initials: { fontSize: 28, fontWeight: '800' },

  statsRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center', gap: 2 },
  statValue: { fontSize: typography.fontSizeLG, fontWeight: typography.fontWeightBold },
  statLabel: { fontSize: typography.fontSizeXS },

  bioArea: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm, gap: 2 },
  fullName: { fontSize: typography.fontSizeMD, fontWeight: typography.fontWeightSemiBold },
  bio: { fontSize: typography.fontSizeSM, lineHeight: 20 },

  actionRow: {
    flexDirection: 'row', gap: spacing.sm,
    paddingHorizontal: spacing.lg, marginBottom: spacing.md,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', gap: 6, borderWidth: 1, borderRadius: radius.sm,
    paddingVertical: 8, alignItems: 'center', justifyContent: 'center',
  },
  actionBtnText: { fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightSemiBold },
  tryOnBtn: {
    flex: 1, flexDirection: 'row', gap: 6, borderRadius: radius.sm,
    paddingVertical: 8, alignItems: 'center', justifyContent: 'center',
  },
  tryOnBtnText: { fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightBold },

  tabRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tabBtn: {
    flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabLabel: { fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightSemiBold },
  addPostBtn: { position: 'absolute', right: spacing.md, top: 10, padding: 4 },

  gridCell: { width: CELL, height: CELL },
  likeOverlay: { position: 'absolute', bottom: 4, left: 5, flexDirection: 'row', alignItems: 'center', gap: 3 },
  likeText: { color: '#fff', fontSize: 11, fontWeight: '600', textShadowColor: '#000', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },

  emptyWrap: { paddingTop: 60, alignItems: 'center', gap: spacing.sm },
  emptyText: { fontSize: typography.fontSizeMD },
  emptySubtext: { fontSize: typography.fontSizeSM, marginTop: -4 },
  emptyAction: { fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightSemiBold },
});
