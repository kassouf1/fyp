import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, Pressable, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { typography, spacing, radius } from '../../theme';
import {
  getComments, addComment, deleteComment, OutfitComment,
} from '../../api/outfitSocial';
import { BASE_URL } from '../../api/client';

const avatar = (url: string | null) =>
  url ? { uri: url.startsWith('http') ? url : `${BASE_URL}${url}` } : require('../../../assets/icon.png');

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

interface Props {
  visible: boolean;
  historyId: number;
  onClose: () => void;
}

export const CommentsSheet: React.FC<Props> = ({ visible, historyId, onClose }) => {
  const { user } = useAuth();
  const { themeColors: c } = useTheme();
  const [comments, setComments] = useState<OutfitComment[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    getComments(historyId)
      .then(setComments)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible, historyId]);

  const handleSend = async () => {
    if (!text.trim() || !user) return;
    setSending(true);
    try {
      const c2 = await addComment(historyId, user.id, text.trim());
      setComments(prev => [...prev, c2]);
      setText('');
    } catch {
      Alert.alert('Error', 'Could not post comment.');
    } finally {
      setSending(false);
    }
  };

  const handleDelete = (commentId: number) => {
    if (!user) return;
    Alert.alert('Delete comment', 'Remove this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteComment(commentId, user.id);
            setComments(prev => prev.filter(c => c.id !== commentId));
          } catch {}
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.sheet, { backgroundColor: c.surface }]}
      >
        {/* Handle bar */}
        <View style={[styles.handle, { backgroundColor: c.border }]} />

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: c.border }]}>
          <Text style={[styles.headerTitle, { color: c.text }]}>Comments</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color={c.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Comments list */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={c.primary} />
          </View>
        ) : (
          <FlatList
            data={comments}
            keyExtractor={i => String(i.id)}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.center}>
                <Ionicons name="chatbubble-outline" size={36} color={c.textMuted} />
                <Text style={[styles.emptyText, { color: c.textMuted }]}>Be the first to comment</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={styles.commentRow}>
                <Image source={avatar(item.avatar)} style={[styles.commentAvatar, { backgroundColor: c.surfaceElevated }]} />
                <View style={styles.commentBubble}>
                  <View style={[styles.bubble, { backgroundColor: c.surfaceElevated }]}>
                    <Text style={[styles.commentUser, { color: c.primary }]}>{item.username}</Text>
                    <Text style={[styles.commentText, { color: c.text }]}>{item.text}</Text>
                  </View>
                  <Text style={[styles.commentTime, { color: c.textMuted }]}>{timeAgo(item.createdAt)}</Text>
                </View>
                {user?.id === item.userId && (
                  <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
                    <Ionicons name="trash-outline" size={14} color={c.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            )}
          />
        )}

        {/* Input */}
        <View style={[styles.inputRow, { borderTopColor: c.border, backgroundColor: c.surface }]}>
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={setText}
            placeholder="Write a comment…"
            placeholderTextColor={c.textMuted}
            style={[styles.input, { color: c.text, backgroundColor: c.surfaceElevated, borderColor: c.border }]}
            multiline
            maxLength={300}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!text.trim() || sending}
            style={[styles.sendBtn, { backgroundColor: text.trim() ? c.primary : c.border }]}
          >
            {sending
              ? <ActivityIndicator size="small" color={c.white} />
              : <Ionicons name="send" size={16} color={text.trim() ? c.white : c.textMuted} />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000060' },
  sheet: {
    maxHeight: '80%', minHeight: '50%',
    borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl,
    paddingBottom: 24,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: typography.fontSizeMD, fontWeight: typography.fontWeightBold },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
  emptyText: { fontSize: typography.fontSizeSM },
  list: { padding: spacing.lg, gap: spacing.md },
  commentRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  commentAvatar: { width: 32, height: 32, borderRadius: 16 },
  commentBubble: { flex: 1, gap: 2 },
  bubble: { borderRadius: radius.lg, padding: spacing.sm, paddingHorizontal: spacing.md },
  commentUser: { fontSize: typography.fontSizeXS, fontWeight: typography.fontWeightBold, marginBottom: 2 },
  commentText: { fontSize: typography.fontSizeSM, lineHeight: 18 },
  commentTime: { fontSize: 10, marginLeft: spacing.sm },
  deleteBtn: { padding: 6, marginTop: 4 },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1, borderRadius: radius.lg, borderWidth: 1,
    paddingHorizontal: spacing.md, paddingVertical: 8,
    fontSize: typography.fontSizeSM, maxHeight: 80,
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
});
