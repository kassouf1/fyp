import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, Dimensions, Alert,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import {
  getUserProfile, getUserPosts, followUser, unfollowUser,
  blockUser, unblockUser, isUserBlocked,
  UserProfile, PostDto, SharedFollower,
} from '../api/social';
import { typography, spacing, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';

const { width: W } = Dimensions.get('window');
const GRID_SIZE = (W - 3) / 3;

type RouteParams = { userId: number };

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

function formatSharedFollowers(sample: SharedFollower[], total: number): string {
  if (total === 0 || sample.length === 0) return '';
  const names = sample.map(f => f.username ? `@${f.username}` : f.fullName);
  if (total === 1) return `Followed by ${names[0]}`;
  if (total === 2) return `Followed by ${names[0]} and ${names[1]}`;
  const others = total - 2;
  return `Followed by ${names[0]}, ${names[1]} and ${others} other${others > 1 ? 's' : ''}`;
}

const Avatar: React.FC<{ uri?: string | null; name: string; size?: number }> = ({ uri, name, size = 80 }) => {
  const { themeColors: c } = useTheme();
  return uri
    ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: c.primary }} />
    : <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.surfaceElevated, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.primary }}>
        <Text style={{ color: c.primary, fontWeight: '700', fontSize: size * 0.38 }}>{name?.[0]?.toUpperCase()}</Text>
      </View>;
};

const StatBox: React.FC<{ value: number; label: string; onPress?: () => void }> = ({ value, label, onPress }) => {
  const { themeColors: c } = useTheme();
  return (
    <TouchableOpacity style={styles.statBox} onPress={onPress} disabled={!onPress} activeOpacity={0.7}>
      <Text style={[styles.statValue, { color: c.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: c.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );
};

export const UserProfileScreen: React.FC = () => {
  const { user }   = useAuth();
  const navigation = useNavigation<any>();
  const route      = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const { userId } = route.params;
  const { themeColors: c } = useTheme();

  const [profile, setProfile]     = useState<UserProfile | null>(null);
  const [posts, setPosts]         = useState<PostDto[]>([]);
  const [loading, setLoading]     = useState(true);
  const [followLoading, setFL]    = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  const isOwnProfile = user?.userId === userId;

  useFocusEffect(useCallback(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      getUserProfile(userId, user.userId),
      getUserPosts(userId, user.userId),
      isOwnProfile ? Promise.resolve(false) : isUserBlocked(userId, user.userId).catch(() => false),
    ]).then(([p, ps, blocked]) => {
      setProfile(p as UserProfile);
      setPosts(ps as PostDto[]);
      setIsBlocked(blocked as boolean);
    }).catch(() => {
      // profile stays null → handled below
    }).finally(() => setLoading(false));
  }, [userId, user?.userId]));

  const handleFollow = async () => {
    if (!user || !profile) return;
    setFL(true);
    try {
      if (profile.isFollowedByMe) {
        await unfollowUser(user.userId, userId);
        setProfile(p => p ? { ...p, isFollowedByMe: false, followerCount: p.followerCount - 1 } : p);
      } else {
        await followUser(user.userId, userId);
        setProfile(p => p ? { ...p, isFollowedByMe: true, followerCount: p.followerCount + 1 } : p);
      }
    } finally { setFL(false); }
  };

  const handleMessage = () => {
    if (!profile) return;
    navigation.navigate('Chat', { partnerId: userId, partnerName: profile.fullName, partnerAvatar: profile.avatarUrl });
  };

  const handleBlock = () => {
    if (!user || !profile) return;
    if (isBlocked) {
      Alert.alert('Unblock', `Allow ${profile.fullName} to interact with you again?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unblock', onPress: async () => {
          await unblockUser(user.userId, userId);
          setIsBlocked(false);
        }},
      ]);
    } else {
      Alert.alert('Block User', `Block ${profile.fullName}? They won't be able to message you.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: async () => {
          await blockUser(user.userId, userId);
          setIsBlocked(true);
        }},
      ]);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <ActivityIndicator color={c.primary} size="large" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { paddingTop: 52 }]}>
          <Text style={[styles.backIcon, { color: c.text }]}>‹</Text>
          <Text style={[styles.backText, { color: c.text }]}>Back</Text>
        </TouchableOpacity>
        <Text style={{ color: c.textMuted, fontSize: 16 }}>Could not load profile</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      {/* Back */}
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Text style={[styles.backIcon, { color: c.text }]}>‹</Text>
        <Text style={[styles.backText, { color: c.text }]}>{profile.fullName}</Text>
      </TouchableOpacity>

      <FlatList
        data={posts}
        keyExtractor={p => String(p.id)}
        numColumns={3}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.gridContent}
        ListHeaderComponent={
          <View style={styles.profileHeader}>
            <Avatar uri={profile.avatarUrl} name={profile.fullName} size={80} />
            <View style={styles.statsRow}>
              <StatBox value={profile.postCount} label="Posts" />
              <StatBox
                value={profile.friendCount}
                label="Friends"
                onPress={() => navigation.navigate('FollowersList', { userId, type: 'friends', name: profile.fullName })}
              />
            </View>

            <Text style={[styles.profileName, { color: c.text }]}>{profile.fullName}</Text>
            {profile.username ? <Text style={[styles.profileHandle, { color: c.textMuted }]}>@{profile.username}</Text> : null}

            {!isOwnProfile && profile.sharedFollowerCount > 0 && (
              <View style={styles.sharedFollowersRow}>
                <Text style={[styles.sharedFollowersIcon, { color: c.textMuted }]}>◯</Text>
                <Text style={[styles.sharedFollowersText, { color: c.textSecondary }]} numberOfLines={2}>
                  {formatSharedFollowers(profile.sharedFollowers, profile.sharedFollowerCount)}
                </Text>
              </View>
            )}

            {!isOwnProfile && (() => {
              const state = getFollowState(profile.isFollowedByMe, profile.followsMe);
              return (
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[
                      styles.followBtn,
                      { backgroundColor: c.primary },
                      state === 'following' && { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.border },
                      state === 'friends' && { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.success },
                    ]}
                    onPress={handleFollow}
                    disabled={followLoading}
                    activeOpacity={0.8}
                  >
                    <Text style={[
                      styles.followBtnText,
                      { color: c.background },
                      state === 'following' && { color: c.text },
                      state === 'friends' && { color: c.success },
                    ]}>
                      {followLoading ? '…' : followLabel(state)}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.msgBtn, { borderColor: c.border }]} onPress={handleMessage} activeOpacity={0.8}>
                    <Text style={[styles.msgBtnText, { color: c.text }]}>Message</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.blockBtn, { borderColor: isBlocked ? c.error : c.border }]}
                    onPress={handleBlock}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={isBlocked ? 'lock-open-outline' : 'ban-outline'}
                      size={16}
                      color={isBlocked ? c.error : c.textMuted}
                    />
                  </TouchableOpacity>
                </View>
              );
            })()}

            <View style={[styles.gridDivider, { backgroundColor: c.border }]} />
          </View>
        }
        renderItem={({ item, index }) => (
          <TouchableOpacity
            style={[styles.gridCell, { backgroundColor: c.surfaceElevated }]}
            onPress={() => navigation.navigate('PostViewer', { posts, startIndex: index })}
            activeOpacity={0.85}
          >
            <Image source={{ uri: item.imageUrl }} style={styles.gridImage} />
            {item.likeCount > 0 && (
              <View style={styles.gridLikeRow}>
                <Text style={styles.gridLikeIcon}>♥</Text>
                <Text style={styles.gridLikeCount}>{item.likeCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyIcon, { color: c.textMuted }]}>◇</Text>
            <Text style={[styles.emptyText, { color: c.textSecondary }]}>No posts yet</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  backBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: 52, paddingBottom: spacing.md },
  backIcon: { fontSize: 28, marginRight: 4, lineHeight: 32 },
  backText: { fontSize: typography.fontSizeLG, fontWeight: typography.fontWeightBold },

  profileHeader: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  statsRow: { flexDirection: 'row', marginTop: spacing.md, marginBottom: spacing.md },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: typography.fontSizeXL, fontWeight: typography.fontWeightExtraBold },
  statLabel: { fontSize: typography.fontSizeXS, marginTop: 2 },
  profileName: { fontSize: typography.fontSizeLG, fontWeight: typography.fontWeightBold, marginBottom: 2 },
  profileHandle: { fontSize: typography.fontSizeSM, marginBottom: spacing.sm },

  sharedFollowersRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    marginBottom: spacing.md,
  },
  sharedFollowersIcon: { fontSize: 13, marginTop: 1 },
  sharedFollowersText: {
    flex: 1, fontSize: typography.fontSizeXS, lineHeight: 18,
  },

  actionRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  followBtn: {
    flex: 1, paddingVertical: 9, borderRadius: radius.md,
    alignItems: 'center',
  },
  followBtnText: { fontWeight: typography.fontWeightBold, fontSize: typography.fontSizeSM },
  msgBtn: {
    flex: 1, paddingVertical: 9, borderRadius: radius.md,
    borderWidth: 1, alignItems: 'center',
  },
  msgBtnText: { fontWeight: typography.fontWeightSemiBold, fontSize: typography.fontSizeSM },
  blockBtn: {
    width: 36, paddingVertical: 9, borderRadius: radius.md,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },

  gridDivider: { height: 1, marginBottom: 2 },
  gridContent: { paddingBottom: 100 },
  gridRow: { gap: 1.5 },
  gridCell: { width: GRID_SIZE, height: GRID_SIZE, position: 'relative' },
  gridImage: { width: '100%', height: '100%' },
  gridLikeRow: { position: 'absolute', bottom: 6, left: 6, flexDirection: 'row', alignItems: 'center', gap: 3 },
  gridLikeIcon: { color: '#fff', fontSize: 12 },
  gridLikeCount: { color: '#fff', fontSize: 11, fontWeight: '600' },

  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 40, marginBottom: spacing.md },
  emptyText: { fontSize: typography.fontSizeMD },
});
