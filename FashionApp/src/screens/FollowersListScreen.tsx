import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { getFollowers, getFollowing, getFriends, followUser, unfollowUser, UserCard } from '../api/social';
import { typography, spacing, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';

type RouteParams = { userId: number; type: 'followers' | 'following' | 'friends'; name: string };

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

const Avatar: React.FC<{ uri?: string | null; name: string; size?: number }> = ({ uri, name, size = 44 }) => {
  const { themeColors: c } = useTheme();
  return uri
    ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
    : <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.surfaceElevated, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: c.primary, fontWeight: '700', fontSize: size * 0.38 }}>{name?.[0]?.toUpperCase()}</Text>
      </View>;
};

export const FollowersListScreen: React.FC = () => {
  const { user }   = useAuth();
  const navigation = useNavigation<any>();
  const route      = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const { userId, type, name } = route.params;
  const { themeColors: c } = useTheme();

  const [list, setList]       = useState<UserCard[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    if (!user) return;
    setLoading(true);
    const fetch = type === 'followers' ? getFollowers(userId, user.userId)
      : type === 'friends'             ? getFriends(userId, user.userId)
      :                                   getFollowing(userId, user.userId);
    fetch.then(setList).finally(() => setLoading(false));
  }, [userId, type, user?.userId]));

  const handleFollow = async (targetId: number, isFollowing: boolean) => {
    if (!user) return;
    if (isFollowing) {
      await unfollowUser(user.userId, targetId);
    } else {
      await followUser(user.userId, targetId);
    }
    setList(prev => prev.map(u =>
      u.userId === targetId ? { ...u, isFollowedByMe: !isFollowing } : u
    ));
  };

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={c.text} />
        </TouchableOpacity>
        <View>
          <Text style={[styles.title, { color: c.text }]}>
            {type === 'followers' ? 'Followers' : type === 'friends' ? 'Friends' : 'Following'}
          </Text>
          <Text style={[styles.subtitle, { color: c.textMuted }]}>{name}</Text>
        </View>
      </View>

      {loading
        ? <ActivityIndicator color={c.primary} style={{ marginTop: 40 }} />
        : (
          <FlatList
            data={list}
            keyExtractor={u => String(u.userId)}
            contentContainerStyle={styles.listContent}
            renderItem={({ item, index }) => {
              const isMe = item.userId === user?.userId;
              const state = getFollowState(item.isFollowedByMe, item.followsMe);
              return (
                <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
                  <View style={[styles.userRow, { borderBottomColor: c.border + '40' }]}>
                    <TouchableOpacity
                      style={styles.userLeft}
                      onPress={() => navigation.navigate('UserProfile', { userId: item.userId })}
                      activeOpacity={0.8}
                    >
                      <Avatar uri={item.avatarUrl} name={item.fullName} size={46} />
                      <View style={styles.userInfo}>
                        <Text style={[styles.userName, { color: c.text }]}>{item.fullName}</Text>
                        {item.username ? <Text style={[styles.userHandle, { color: c.textMuted }]}>@{item.username}</Text> : null}
                      </View>
                    </TouchableOpacity>

                    {!isMe && (
                      <TouchableOpacity
                        style={[
                          styles.followBtn,
                          { backgroundColor: c.primary },
                          state === 'following' && { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.border },
                          state === 'friends' && { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.success },
                        ]}
                        onPress={() => handleFollow(item.userId, item.isFollowedByMe)}
                        activeOpacity={0.8}
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
                    )}
                  </View>
                </Animated.View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons
                  name={type === 'followers' ? 'people-outline' : type === 'friends' ? 'heart-outline' : 'person-add-outline'}
                  size={40} color={c.textMuted} style={styles.emptyIcon}
                />
                <Text style={[styles.emptyText, { color: c.textSecondary }]}>
                  {type === 'followers' ? 'No followers yet' : type === 'friends' ? 'No friends yet' : 'Not following anyone yet'}
                </Text>
              </View>
            }
          />
        )
      }
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: spacing.lg, paddingTop: 52, paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  title: { fontSize: typography.fontSizeLG, fontWeight: typography.fontWeightBold },
  subtitle: { fontSize: typography.fontSizeSM },

  listContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 100 },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  userLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  userInfo: { flex: 1 },
  userName: { fontSize: typography.fontSizeMD, fontWeight: typography.fontWeightSemiBold },
  userHandle: { fontSize: typography.fontSizeXS, marginTop: 2 },

  followBtn: {
    paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.md,
  },
  followBtnText: { fontWeight: typography.fontWeightBold, fontSize: typography.fontSizeSM },

  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { marginBottom: spacing.md },
  emptyText: { fontSize: typography.fontSizeMD },
});
