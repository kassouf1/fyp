import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Image, ActivityIndicator, Alert, ActionSheetIOS,
  Dimensions,
} from 'react-native';

const CARD_W = Math.round(Dimensions.get('window').width * 0.65);
import { Video, ResizeMode } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getMessages, sendMessage, blockUser, deleteMessage as apiDeleteMsg, editMessage as apiEditMsg, MessageDto } from '../api/social';
import { Ionicons } from '@expo/vector-icons';
import { typography, spacing, radius } from '../theme';

type RouteParams = { partnerId: number; partnerName: string; partnerAvatar: string | null };

const isVideo = (url: string) =>
  /\.(mp4|mov|avi|mkv|webm)$/i.test(url) || url.includes('video');

const Avatar: React.FC<{ uri?: string | null; name: string; size?: number }> = ({ uri, name, size = 32 }) => {
  const { themeColors: c } = useTheme();
  return uri
    ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
    : (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.surfaceElevated, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: c.primary, fontWeight: '700', fontSize: size * 0.38 }}>{name?.[0]?.toUpperCase()}</Text>
      </View>
    );
};

const POLL_INTERVAL = 4000;

export const ChatScreen: React.FC = () => {
  const { user }   = useAuth();
  const navigation = useNavigation<any>();
  const route      = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const { partnerId, partnerName, partnerAvatar } = route.params;
  const { themeColors: c } = useTheme();

  const [messages, setMessages]   = useState<MessageDto[]>([]);
  const [text, setText]           = useState('');
  const [loading, setLoading]     = useState(true);
  const [sending, setSending]     = useState(false);
  const [pendingMedia, setPendingMedia] = useState<{ uri: string; type: 'image' | 'video' } | null>(null);
  const [editingMsg, setEditingMsg] = useState<{ id: number; originalText: string } | null>(null);
  const listRef    = useRef<FlatList>(null);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const swipeRefs  = useRef<Map<number, Swipeable>>(new Map());

  const load = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    try {
      const msgs = await getMessages(user.userId, partnerId);
      setMessages(msgs);
    } finally { if (!silent) setLoading(false); }
  }, [user?.userId, partnerId]);

  useEffect(() => {
    load();
    pollRef.current = setInterval(() => load(true), POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load]);

  const handleSend = async () => {
    if (!user) return;

    if (editingMsg) {
      if (!text.trim()) return;
      try {
        const updated = await apiEditMsg(editingMsg.id, user.userId, text.trim());
        setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, text: updated.text } : m));
        setEditingMsg(null);
        setText('');
      } catch {
        Alert.alert('Error', 'Could not edit message.');
      }
      return;
    }

    if (!text.trim() && !pendingMedia) return;
    setSending(true);
    try {
      const msg = await sendMessage(
        user.userId,
        partnerId,
        text.trim(),
        undefined,
        pendingMedia?.uri,
      );
      setMessages(prev => [...prev, msg]);
      setText('');
      setPendingMedia(null);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } finally { setSending(false); }
  };

  const handleDeleteMsg = (msgId: number) => {
    Alert.alert('Delete message', 'This will delete the message for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          if (!user) return;
          try {
            await apiDeleteMsg(msgId, user.userId);
            setMessages(prev => prev.filter(m => m.id !== msgId));
          } catch {
            Alert.alert('Error', 'Could not delete message.');
          }
        },
      },
    ]);
  };

  const handleEditMsg = (item: MessageDto) => {
    setEditingMsg({ id: item.id, originalText: item.text });
    setText(item.text);
  };

  const cancelEdit = () => {
    setEditingMsg(null);
    setText('');
  };

  const renderSwipeActions = (item: MessageDto, isPlainText: boolean) => (
    <View style={styles.swipeActions}>
      {isPlainText && (
        <TouchableOpacity
          style={[styles.swipeBtn, { backgroundColor: c.primary }]}
          activeOpacity={0.85}
          onPress={() => { swipeRefs.current.get(item.id)?.close(); handleEditMsg(item); }}
        >
          <Ionicons name="pencil-outline" size={18} color={c.white} />
          <Text style={[styles.swipeBtnLabel, { color: c.white }]}>Edit</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={[styles.swipeBtn, { backgroundColor: c.error }]}
        activeOpacity={0.85}
        onPress={() => { swipeRefs.current.get(item.id)?.close(); handleDeleteMsg(item.id); }}
      >
        <Ionicons name="trash-outline" size={18} color={c.white} />
        <Text style={[styles.swipeBtnLabel, { color: c.white }]}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  const handleBlock = () => {
    Alert.alert(
      'Block User',
      `Block ${partnerName}? They won't be able to message you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block', style: 'destructive',
          onPress: async () => {
            if (!user) return;
            await blockUser(user.userId, partnerId);
            navigation.goBack();
          },
        },
      ],
    );
  };

  const handleMoreOptions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'View Profile', 'Block User'], cancelButtonIndex: 0, destructiveButtonIndex: 2 },
        (i) => {
          if (i === 1) navigation.navigate('UserProfile', { userId: partnerId });
          if (i === 2) handleBlock();
        },
      );
    } else {
      Alert.alert('Options', '', [
        { text: 'View Profile', onPress: () => navigation.navigate('UserProfile', { userId: partnerId }) },
        { text: 'Block User', style: 'destructive', onPress: handleBlock },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const handlePickMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow photo/video access in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.85,
      videoMaxDuration: 60,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const type = asset.type === 'video' ? 'video' : 'image';
      setPendingMedia({ uri: asset.uri, type });
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isMine = (msg: MessageDto) => msg.senderId === user?.userId;

  const renderPostMessage = (item: MessageDto, mine: boolean, showAv: boolean) => {
    const authorName   = item.postAuthorName ?? (mine ? 'You' : partnerName);
    const authorAvatar = item.postAuthorAvatarUrl ?? null;
    const caption      = item.postCaption ?? '';
    const hasImage     = !!item.postImageUrl;
    const canNavigate  = !!item.postId;

    const card = (
      <View style={[styles.postCard, { backgroundColor: c.surface, borderColor: c.border }]}>
        {/* Author row */}
        <View style={[styles.postCardHeader, { borderBottomColor: c.border }]}>
          {authorAvatar
            ? <Image source={{ uri: authorAvatar }} style={styles.postCardAvatar} />
            : (
              <View style={[styles.postCardAvatar, { backgroundColor: c.surfaceElevated, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: c.primary, fontSize: 11, fontWeight: '700' }}>{authorName[0]?.toUpperCase()}</Text>
              </View>
            )
          }
          <Text style={[styles.postCardAuthorName, { color: c.text }]} numberOfLines={1}>{authorName}</Text>
          <Ionicons name="ellipsis-horizontal" size={14} color={c.textMuted} />
        </View>

        {/* Square image */}
        {hasImage
          ? <Image source={{ uri: item.postImageUrl! }} style={styles.postCardImage} resizeMode="cover" />
          : <View style={[styles.postCardImage, { backgroundColor: c.surfaceElevated, alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="image-outline" size={40} color={c.textMuted} />
            </View>
        }

        {/* Caption */}
        {!!caption && (
          <View style={[styles.postCardCaption, { borderTopColor: c.border }]}>
            <Text style={{ color: c.text, fontSize: 13, lineHeight: 18 }} numberOfLines={2}>{caption}</Text>
          </View>
        )}
      </View>
    );

    return (
      <View style={[styles.msgRow, mine && styles.msgRowMine]}>
        {!mine && (
          <View style={styles.avatarSpacer}>
            {showAv && <Avatar uri={partnerAvatar} name={partnerName} size={26} />}
          </View>
        )}
        <View>
          {canNavigate
            ? <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('PostDetail', { postId: item.postId! })}>{card}</TouchableOpacity>
            : card
          }
          <Text style={[styles.postCardTime, { color: c.textMuted, textAlign: mine ? 'right' : 'left' }]}>
            {formatTime(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  const renderMediaBubble = (url: string, mine: boolean) => {
    if (isVideo(url)) {
      return (
        <Video
          source={{ uri: url }}
          style={styles.mediaVideo}
          useNativeControls
          resizeMode={ResizeMode.CONTAIN}
          isLooping={false}
        />
      );
    }
    return (
      <Image
        source={{ uri: url }}
        style={styles.mediaImage}
        resizeMode="cover"
      />
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: c.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.container, { backgroundColor: c.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: c.background, borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={26} color={c.text} />
          </TouchableOpacity>
          <Avatar uri={partnerAvatar} name={partnerName} size={36} />
          <Text style={[styles.headerName, { color: c.text }]}>{partnerName}</Text>
          <TouchableOpacity onPress={handleMoreOptions} style={styles.profileBtn}>
            <Ionicons name="ellipsis-vertical" size={20} color={c.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Messages */}
        {loading
          ? <ActivityIndicator color={c.primary} style={{ flex: 1 }} />
          : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={m => String(m.id)}
              contentContainerStyle={styles.messageList}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
              renderItem={({ item, index }) => {
                const mine = isMine(item);
                const prevMsg = messages[index - 1];
                const showAvatar = !mine && (!prevMsg || prevMsg.senderId !== item.senderId);

                const hasMedia   = !!item.mediaUrl;
                const hasStory   = !!item.storyImageUrl;
                const hasPost    = !!item.postId && !!item.postImageUrl;
                const isPostText = item.text === '__post__' || item.text === '📸 Shared a post';
                const hasText    = !!item.text && !isPostText;
                const isPlainText = hasText && !hasMedia && !hasStory && !hasPost && !isPostText;

                const rowContent = (hasPost || isPostText)
                  ? renderPostMessage(item, mine, showAvatar)
                  : (
                    <View style={[styles.msgRow, mine && styles.msgRowMine]}>
                      {!mine && (
                        <View style={styles.avatarSpacer}>
                          {showAvatar && <Avatar uri={partnerAvatar} name={partnerName} size={26} />}
                        </View>
                      )}
                      <View style={[
                        styles.bubble,
                        mine ? [styles.bubbleMine, { backgroundColor: c.primary, borderColor: c.primary }]
                             : [styles.bubbleTheirs, { backgroundColor: c.surfaceElevated, borderColor: c.border }],
                        hasMedia && !hasText && !hasStory && styles.bubbleMedia,
                      ]}>
                        {hasStory && (
                          <View style={styles.storyReply}>
                            <Image source={{ uri: item.storyImageUrl! }} style={styles.storyReplyImage} resizeMode="cover" />
                            <Text style={[styles.storyReplyLabel, mine ? { color: c.white + 'BB' } : { color: c.textMuted }]}>
                              {mine ? 'Replied to their story' : 'Replied to your story'}
                            </Text>
                            <View style={[styles.storyReplySep, { backgroundColor: mine ? c.white + '44' : c.border }]} />
                          </View>
                        )}
                        {hasMedia && renderMediaBubble(item.mediaUrl!, mine)}
                        {(hasText || (!hasMedia && !hasStory)) && (
                          <Text style={[styles.bubbleText, { color: mine ? c.white : c.text }]}>
                            {item.text}
                          </Text>
                        )}
                        <Text style={[styles.bubbleTime, { color: mine ? c.white + 'AA' : c.textMuted }]}>
                          {formatTime(item.createdAt)}
                        </Text>
                      </View>
                    </View>
                  );

                if (!mine) return rowContent;

                return (
                  <Swipeable
                    key={item.id}
                    ref={ref => { if (ref) swipeRefs.current.set(item.id, ref); else swipeRefs.current.delete(item.id); }}
                    renderRightActions={() => renderSwipeActions(item, isPlainText)}
                    friction={2}
                    rightThreshold={40}
                    overshootRight={false}
                  >
                    {rowContent}
                  </Swipeable>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyChat}>
                  <Text style={[styles.emptyChatText, { color: c.textSecondary }]}>
                    Say hi to {partnerName.split(' ')[0]} 👋
                  </Text>
                </View>
              }
            />
          )
        }

        {/* Pending media preview */}
        {pendingMedia && (
          <View style={[styles.mediaPreviewBar, { backgroundColor: c.surface, borderTopColor: c.border }]}>
            {pendingMedia.type === 'image'
              ? <Image source={{ uri: pendingMedia.uri }} style={styles.mediaPreviewThumb} resizeMode="cover" />
              : (
                <View style={[styles.mediaPreviewThumb, { backgroundColor: c.surfaceElevated, alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ fontSize: 24 }}>🎬</Text>
                </View>
              )
            }
            <Text style={[styles.mediaPreviewLabel, { color: c.textSecondary }]}>
              {pendingMedia.type === 'video' ? 'Video ready to send' : 'Photo ready to send'}
            </Text>
            <TouchableOpacity onPress={() => setPendingMedia(null)} style={styles.mediaPreviewRemove}>
              <Ionicons name="close" size={16} color={c.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {/* Edit mode banner */}
        {editingMsg && (
          <View style={[styles.editBanner, { backgroundColor: c.surface, borderTopColor: c.border, borderBottomColor: c.border }]}>
            <Ionicons name="pencil-outline" size={14} color={c.primary} />
            <Text style={[styles.editBannerText, { color: c.text }]}>Editing message</Text>
            <TouchableOpacity onPress={cancelEdit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={18} color={c.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {/* Input row */}
        <View style={[styles.inputRow, { backgroundColor: c.background, borderTopColor: c.border }]}>
          {/* Attach button */}
          <TouchableOpacity onPress={handlePickMedia} style={styles.attachBtn} activeOpacity={0.7}>
            <Ionicons name="add-circle-outline" size={26} color={c.textMuted} />
          </TouchableOpacity>

          <TextInput
            style={[styles.input, { backgroundColor: c.surfaceElevated, color: c.text }]}
            placeholder={`Message ${partnerName.split(' ')[0]}…`}
            placeholderTextColor={c.textMuted}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              { backgroundColor: c.primary },
              (!text.trim() && !pendingMedia || sending) && { backgroundColor: c.border },
            ]}
            onPress={handleSend}
            disabled={(!text.trim() && !pendingMedia) || sending}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-up" size={18} color={c.white} />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: spacing.lg, paddingTop: 52, paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4, marginRight: 4 },
  headerName: { flex: 1, fontSize: typography.fontSizeLG, fontWeight: typography.fontWeightBold },
  profileBtn: { padding: 4 },

  messageList: { padding: spacing.md, paddingBottom: spacing.xl, gap: 4 },

  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4 },
  msgRowMine: { flexDirection: 'row-reverse' },
  avatarSpacer: { width: 26 },

  bubble: {
    maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 18, borderWidth: 1,
  },
  bubbleMine: { borderBottomRightRadius: 4 },
  bubbleTheirs: { borderBottomLeftRadius: 4 },
  bubbleMedia: { paddingHorizontal: 4, paddingVertical: 4 },

  // Story reply
  storyReply: { marginBottom: 8 },
  storyReplyImage: { width: 160, height: 90, borderRadius: 10, marginBottom: 6 },
  storyReplyLabel: { fontSize: typography.fontSizeXS, marginBottom: 6 },
  storyReplySep: { height: 1, marginBottom: 6 },

  // Instagram-style shared post card
  postCard: {
    width: CARD_W,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: 4,
  },
  postCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 10, paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  postCardAvatar: { width: 26, height: 26, borderRadius: 13 },
  postCardAuthorName: { flex: 1, fontSize: 13, fontWeight: '600' },
  postCardImage: { width: CARD_W, height: CARD_W },
  postCardCaption: {
    paddingHorizontal: 10, paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  postCardTime: { fontSize: 10, marginTop: 2 },

  // Media in bubble
  mediaImage: { width: 200, height: 200, borderRadius: 12, marginBottom: 4 },
  mediaVideo: { width: 220, height: 160, borderRadius: 12, marginBottom: 4 },

  bubbleText: { fontSize: typography.fontSizeMD, lineHeight: 20 },
  bubbleTime: { fontSize: 10, marginTop: 3, textAlign: 'right' },

  emptyChat: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyChatText: { fontSize: typography.fontSizeMD },

  // Pending media preview bar
  mediaPreviewBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  mediaPreviewThumb: { width: 48, height: 48, borderRadius: radius.sm, overflow: 'hidden' },
  mediaPreviewLabel: { flex: 1, fontSize: typography.fontSizeSM },
  mediaPreviewRemove: { padding: 6 },

  // Swipe actions
  swipeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 10,
    paddingLeft: 6,
    gap: 8,
    marginBottom: 4,
  },
  swipeBtn: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 3,
  },
  swipeBtnLabel: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.2 },

  // Edit mode banner
  editBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: spacing.md, paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  editBannerText: { flex: 1, fontSize: typography.fontSizeSM, fontStyle: 'italic' as const },

  // Input
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    padding: spacing.md, borderTopWidth: 1,
  },
  attachBtn: { padding: 6, marginBottom: 4 },
  input: {
    flex: 1, borderRadius: radius.xl,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    fontSize: typography.fontSizeMD, maxHeight: 100,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
});
