import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { getNotifications, markAllNotificationsRead, NotificationDto } from '../api/social';
import { typography, spacing, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';

const Avatar: React.FC<{ uri?: string | null; name: string; size?: number }> = ({ uri, name, size = 42 }) => {
  const { themeColors: c } = useTheme();
  return uri
    ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
    : <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.surfaceElevated, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: c.primary, fontWeight: '700', fontSize: size * 0.38 }}>{name?.[0]?.toUpperCase()}</Text>
      </View>;
};

const notifIcon = (type: string, c: any) => {
  switch (type) {
    case 'like':    return { icon: '♥', color: c.error };
    case 'comment': return { icon: '◯', color: c.accent };
    case 'follow':  return { icon: '◈', color: c.primary };
    case 'repost':  return { icon: '↺', color: c.primary };
    case 'tag':     return { icon: '◉', color: c.accent };
    default:        return { icon: '◎', color: c.textMuted };
  }
};

const notifText = (n: NotificationDto) => {
  switch (n.type) {
    case 'like':    return `${n.actorName} liked your post`;
    case 'comment': return `${n.actorName} commented: "${n.commentText}"`;
    case 'follow':  return `${n.actorName} started following you`;
    case 'repost':  return `${n.actorName} reposted your photo`;
    case 'tag':     return `${n.actorName} tagged you in a post`;
    default:        return `${n.actorName} interacted with you`;
  }
};

const timeAgo = (iso: string) => {
  const utc = iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z';
  const m = Math.floor((Date.now() - new Date(utc).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export const NotificationsScreen: React.FC = () => {
  const { user }   = useAuth();
  const navigation = useNavigation<any>();
  const { themeColors: c } = useTheme();
  const [notifications, setNotifs] = useState<NotificationDto[]>([]);
  const [loading, setLoading]      = useState(true);

  useFocusEffect(useCallback(() => {
    if (!user) return;
    setLoading(true);
    getNotifications(user.userId)
      .then(ns => {
        setNotifs(ns);
        markAllNotificationsRead(user.userId).catch(() => {});
      })
      .finally(() => setLoading(false));
  }, [user?.userId]));

  const handlePress = (n: NotificationDto) => {
    if (n.type === 'follow') navigation.navigate('UserProfile', { userId: n.actorId });
    else if (n.postId)       navigation.navigate('UserProfile', { userId: n.actorId });
  };

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backIcon, { color: c.text }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: c.text }]}>Activity</Text>
      </View>

      {loading
        ? <ActivityIndicator color={c.primary} style={{ marginTop: 40 }} />
        : (
          <FlatList
            data={notifications}
            keyExtractor={n => String(n.id)}
            contentContainerStyle={styles.list}
            renderItem={({ item, index }) => {
              const { icon, color } = notifIcon(item.type, c);
              return (
                <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
                  <TouchableOpacity
                    style={[
                      styles.notifRow,
                      { borderBottomColor: c.border + '40' },
                      !item.isRead && { backgroundColor: c.primary + '08' },
                    ]}
                    onPress={() => handlePress(item)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.avatarWrap}>
                      <Avatar uri={item.actorAvatar} name={item.actorName} size={42} />
                      <View style={[styles.iconBadge, { backgroundColor: color, borderColor: c.background }]}>
                        <Text style={styles.iconBadgeText}>{icon}</Text>
                      </View>
                    </View>
                    <View style={styles.notifInfo}>
                      <Text style={[styles.notifText, { color: c.text }]} numberOfLines={2}>{notifText(item)}</Text>
                      <Text style={[styles.notifTime, { color: c.textMuted }]}>{timeAgo(item.createdAt)}</Text>
                    </View>
                    {!item.isRead && <View style={[styles.unreadDot, { backgroundColor: c.primary }]} />}
                  </TouchableOpacity>
                </Animated.View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={[styles.emptyIcon, { color: c.textMuted }]}>◎</Text>
                <Text style={[styles.emptyTitle, { color: c.text }]}>No activity yet</Text>
                <Text style={[styles.emptySubtitle, { color: c.textSecondary }]}>Likes, comments and follows will appear here</Text>
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
  backIcon: { fontSize: 28, lineHeight: 32 },
  title: { fontSize: typography.fontSize2XL, fontWeight: typography.fontWeightExtraBold },

  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 100 },
  notifRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 12, borderBottomWidth: 1 },
  avatarWrap: { position: 'relative' },
  iconBadge: { position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  iconBadgeText: { fontSize: 9, color: '#fff', fontWeight: '800' },
  notifInfo: { flex: 1 },
  notifText: { fontSize: typography.fontSizeSM, lineHeight: 19 },
  notifTime: { fontSize: typography.fontSizeXS, marginTop: 3 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },

  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: spacing.md },
  emptyTitle: { fontSize: typography.fontSizeLG, fontWeight: typography.fontWeightBold, marginBottom: spacing.sm },
  emptySubtitle: { fontSize: typography.fontSizeMD, textAlign: 'center', paddingHorizontal: spacing.xl },
});
