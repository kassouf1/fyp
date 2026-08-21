import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import {
  getConversations, getMessageRequests, acceptMessageRequest, rejectMessageRequest,
  ConversationDto, MessageRequestDto,
} from '../api/social';
import { typography, spacing, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';

const Avatar: React.FC<{ uri?: string | null; name: string; size?: number }> = ({ uri, name, size = 50 }) => {
  const { themeColors: c } = useTheme();
  return uri
    ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
    : <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.surfaceElevated, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: c.primary, fontWeight: '700', fontSize: size * 0.38 }}>{name?.[0]?.toUpperCase()}</Text>
      </View>;
};

const timeAgo = (iso: string | null) => {
  if (!iso) return '';
  const utc = iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z';
  const m = Math.floor((Date.now() - new Date(utc).getTime()) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

export const ChatListScreen: React.FC = () => {
  const { user }   = useAuth();
  const navigation = useNavigation<any>();
  const { themeColors: c } = useTheme();
  const [conversations, setConv]     = useState<ConversationDto[]>([]);
  const [requests, setRequests]      = useState<MessageRequestDto[]>([]);
  const [loading, setLoading]        = useState(true);
  const [accepting, setAccepting]    = useState<number | null>(null);

  useFocusEffect(useCallback(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      getConversations(user.userId),
      getMessageRequests(user.userId),
    ]).then(([convs, reqs]) => { setConv(convs); setRequests(reqs); })
      .finally(() => setLoading(false));
  }, [user?.userId]));

  const handleAccept = async (req: MessageRequestDto) => {
    if (!user) return;
    setAccepting(req.id);
    try {
      await acceptMessageRequest(req.id, user.userId);
      setRequests(prev => prev.filter(r => r.id !== req.id));
      navigation.navigate('Chat', {
        partnerId: req.senderId,
        partnerName: req.senderName,
        partnerAvatar: req.senderAvatar,
      });
    } finally { setAccepting(null); }
  };

  const handleReject = (req: MessageRequestDto) => {
    Alert.alert('Decline Request', `Decline message from ${req.senderName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Decline', style: 'destructive',
        onPress: async () => {
          if (!user) return;
          await rejectMessageRequest(req.id, user.userId);
          setRequests(prev => prev.filter(r => r.id !== req.id));
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <Text style={[styles.title, { color: c.text }]}>Messages</Text>
        <TouchableOpacity onPress={() => navigation.navigate('NewChat')} style={styles.newBtn}>
          <Ionicons name="create-outline" size={24} color={c.primary} />
        </TouchableOpacity>
      </View>

      {loading
        ? <ActivityIndicator color={c.primary} style={{ marginTop: 40 }} />
        : (
          <FlatList
            data={conversations}
            keyExtractor={item => String(item.userId)}
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              requests.length > 0 ? (
                <View style={[styles.requestsSection, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}>
                  <View style={styles.requestsHeader}>
                    <Ionicons name="mail-outline" size={16} color={c.primary} />
                    <Text style={[styles.requestsTitle, { color: c.text }]}>
                      Message Requests ({requests.length})
                    </Text>
                  </View>
                  {requests.map(req => (
                    <View key={req.id} style={[styles.requestRow, { borderBottomColor: c.border + '40' }]}>
                      <Avatar uri={req.senderAvatar} name={req.senderName} size={44} />
                      <View style={styles.requestInfo}>
                        <Text style={[styles.requestName, { color: c.text }]}>{req.senderName}</Text>
                        <Text style={[styles.requestMsg, { color: c.textMuted }]} numberOfLines={1}>
                          {req.messageText}
                        </Text>
                      </View>
                      <View style={styles.requestBtns}>
                        <TouchableOpacity
                          style={[styles.acceptBtn, { backgroundColor: c.primary }]}
                          onPress={() => handleAccept(req)}
                          disabled={accepting === req.id}
                          activeOpacity={0.8}
                        >
                          {accepting === req.id
                            ? <ActivityIndicator size="small" color={c.background} />
                            : <Ionicons name="checkmark" size={16} color={c.background} />
                          }
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.rejectBtn, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}
                          onPress={() => handleReject(req)}
                          activeOpacity={0.8}
                        >
                          <Ionicons name="close" size={16} color={c.textMuted} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null
            }
            renderItem={({ item, index }) => (
              <Animated.View entering={FadeInDown.delay(index * 60).duration(300)}>
                <TouchableOpacity
                  style={[styles.convRow, { borderBottomColor: c.border + '40' }]}
                  onPress={() => navigation.navigate('Chat', {
                    partnerId: item.userId,
                    partnerName: item.fullName,
                    partnerAvatar: item.avatarUrl,
                  })}
                  activeOpacity={0.75}
                >
                  <View style={styles.avatarWrap}>
                    <Avatar uri={item.avatarUrl} name={item.fullName} size={50} />
                    {item.unreadCount > 0 && (
                      <View style={[styles.unreadBadge, { backgroundColor: c.primary, borderColor: c.background }]}>
                        <Text style={[styles.unreadText, { color: c.background }]}>{item.unreadCount > 9 ? '9+' : item.unreadCount}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.convInfo}>
                    <View style={styles.convTopRow}>
                      <Text style={[styles.convName, { color: c.textSecondary }, item.unreadCount > 0 && { fontWeight: typography.fontWeightBold, color: c.text }]}>
                        {item.fullName}
                      </Text>
                      <Text style={[styles.convTime, { color: c.textMuted }]}>{timeAgo(item.lastMessageAt)}</Text>
                    </View>
                    <Text
                      style={[styles.convPreview, { color: c.textMuted }, item.unreadCount > 0 && { color: c.textSecondary, fontWeight: typography.fontWeightMedium }]}
                      numberOfLines={1}
                    >
                      {item.lastMessage ?? 'Start a conversation'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            )}
            ListEmptyComponent={
              requests.length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="chatbubbles-outline" size={48} color={c.textMuted} style={{ marginBottom: spacing.md }} />
                  <Text style={[styles.emptyTitle, { color: c.text }]}>No messages yet</Text>
                  <Text style={[styles.emptySubtitle, { color: c.textSecondary }]}>Message friends you follow each other with</Text>
                  <TouchableOpacity style={[styles.searchBtn, { backgroundColor: c.primary }]} onPress={() => navigation.navigate('NewChat')}>
                    <Text style={[styles.searchBtnText, { color: c.white }]}>New Message</Text>
                  </TouchableOpacity>
                </View>
              ) : null
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: 56, paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  title: { fontSize: typography.fontSize2XL, fontWeight: typography.fontWeightExtraBold },
  newBtn: { padding: 4 },
  list: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 100 },

  // Message requests
  requestsSection: {
    borderRadius: radius.lg, borderWidth: 1,
    marginBottom: spacing.md, overflow: 'hidden',
  },
  requestsHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.md, paddingVertical: 10,
  },
  requestsTitle: { fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightBold },
  requestRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    borderBottomWidth: 1,
  },
  requestInfo: { flex: 1 },
  requestName: { fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightSemiBold, marginBottom: 2 },
  requestMsg: { fontSize: typography.fontSizeXS },
  requestBtns: { flexDirection: 'row', gap: 6 },
  acceptBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  rejectBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },

  // Conversations
  convRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 12, borderBottomWidth: 1 },
  avatarWrap: { position: 'relative' },
  unreadBadge: { position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  unreadText: { fontSize: 9, fontWeight: '800' },
  convInfo: { flex: 1 },
  convTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  convName: { fontSize: typography.fontSizeMD, fontWeight: typography.fontWeightMedium },
  convTime: { fontSize: typography.fontSizeXS },
  convPreview: { fontSize: typography.fontSizeSM },

  // Empty
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: typography.fontSizeLG, fontWeight: typography.fontWeightBold, marginBottom: spacing.sm },
  emptySubtitle: { fontSize: typography.fontSizeMD, marginBottom: spacing.xl },
  searchBtn: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.lg },
  searchBtnText: { fontWeight: typography.fontWeightBold },
});
