import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  ActivityIndicator, TextInput, KeyboardAvoidingView, Platform,
  Alert, ActionSheetIOS, Dimensions,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import {
  getPost, getComments, toggleLike, addComment, deleteComment,
  PostDto, CommentDto,
} from '../api/social';
import { typography, spacing, radius } from '../theme';

const { width: W } = Dimensions.get('window');

type RouteParams = { postId: number };

const Avatar: React.FC<{ uri?: string | null; name: string; size?: number }> = ({ uri, name, size = 36 }) => {
  const { themeColors: c } = useTheme();
  return uri
    ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
    : (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.surfaceElevated, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: c.primary, fontWeight: '700', fontSize: size * 0.38 }}>{name?.[0]?.toUpperCase()}</Text>
      </View>
    );
};

const formatTime = (iso: string) => {
  const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export const PostDetailScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const { themeColors: c } = useTheme();
  const { postId } = route.params;

  const [post, setPost]               = useState<PostDto | null>(null);
  const [comments, setComments]       = useState<CommentDto[]>([]);
  const [loading, setLoading]         = useState(true);
  const [liked, setLiked]             = useState(false);
  const [likeCount, setLikeCount]     = useState(0);
  const [commentText, setCommentText] = useState('');
  const [sendingCmt, setSendingCmt]   = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [p, cmts] = await Promise.all([
        getPost(postId, user.userId),
        getComments(postId),
      ]);
      setPost(p);
      setLiked(p.isLikedByMe);
      setLikeCount(p.likeCount);
      setComments(cmts);
    } catch {
      Alert.alert('Error', 'Could not load post.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [postId, user?.userId]);

  useEffect(() => { load(); }, [load]);

  const handleLike = async () => {
    if (!user || !post) return;
    const prev = { liked, likeCount };
    setLiked(l => !l);
    setLikeCount(n => liked ? n - 1 : n + 1);
    try {
      const res = await toggleLike(post.id, user.userId);
      setLiked(res.liked);
      setLikeCount(res.likeCount);
    } catch {
      setLiked(prev.liked);
      setLikeCount(prev.likeCount);
    }
  };

  const handleAddComment = async () => {
    if (!user || !post || !commentText.trim()) return;
    const t = commentText.trim();
    setCommentText('');
    setSendingCmt(true);
    try {
      const newCmt = await addComment(post.id, user.userId, t);
      setComments(prev => [...prev, newCmt]);
    } catch {
      Alert.alert('Error', 'Could not post comment.');
    } finally {
      setSendingCmt(false);
    }
  };

  const handleDeleteComment = (cmtId: number) => {
    if (!user) return;
    Alert.alert('Delete comment?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteComment(post!.id, cmtId, user.userId);
          setComments(prev => prev.filter(c => c.id !== cmtId));
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <ActivityIndicator color={c.primary} size="large" />
      </View>
    );
  }

  if (!post) return null;

  const isOwn = post.userId === user?.userId;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: c.background, borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={c.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: c.text }]}>Post</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Author row */}
        <View style={styles.authorRow}>
          <TouchableOpacity
            style={styles.authorInfo}
            onPress={() => navigation.navigate('UserProfile', { userId: post.userId })}
            activeOpacity={0.8}
          >
            <Avatar uri={post.avatarUrl} name={post.fullName} size={40} />
            <View>
              <Text style={[styles.authorName, { color: c.text }]}>{post.fullName}</Text>
              <Text style={[styles.postTime, { color: c.textMuted }]}>{formatTime(post.createdAt)}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Image */}
        <Image source={{ uri: post.imageUrl }} style={styles.postImage} resizeMode="cover" />

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleLike} activeOpacity={0.7}>
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={26}
              color={liked ? c.error : c.text}
            />
            <Text style={[styles.actionCount, { color: c.textSecondary }]}>{likeCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
            <Ionicons name="chatbubble-outline" size={24} color={c.text} />
            <Text style={[styles.actionCount, { color: c.textSecondary }]}>{comments.length}</Text>
          </TouchableOpacity>
        </View>

        {/* Caption */}
        {!!post.caption && (
          <View style={styles.captionRow}>
            <Text style={[styles.captionAuthor, { color: c.text }]}>{post.fullName} </Text>
            <Text style={[styles.captionText, { color: c.text }]}>{post.caption}</Text>
          </View>
        )}

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: c.border }]} />

        {/* Comments */}
        <View style={styles.commentsSection}>
          {comments.length === 0 ? (
            <Text style={[styles.noComments, { color: c.textMuted }]}>No comments yet. Be the first!</Text>
          ) : (
            comments.map(cmt => (
              <TouchableOpacity
                key={cmt.id}
                style={styles.commentRow}
                onLongPress={() => cmt.userId === user?.userId && handleDeleteComment(cmt.id)}
                activeOpacity={0.85}
              >
                <Avatar uri={cmt.avatarUrl} name={cmt.fullName} size={32} />
                <View style={styles.commentBubble}>
                  <Text style={[styles.commentAuthor, { color: c.text }]}>{cmt.fullName}</Text>
                  <Text style={[styles.commentText, { color: c.textSecondary }]}>{cmt.text}</Text>
                  <Text style={[styles.commentTime, { color: c.textMuted }]}>{formatTime(cmt.createdAt)}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Comment input */}
      <View style={[styles.inputBar, { backgroundColor: c.background, borderTopColor: c.border }]}>
        <Avatar uri={user?.avatarUrl} name={user?.fullName ?? '?'} size={32} />
        <TextInput
          style={[styles.input, { backgroundColor: c.surfaceElevated, color: c.text }]}
          placeholder="Add a comment…"
          placeholderTextColor={c.textMuted}
          value={commentText}
          onChangeText={setCommentText}
          returnKeyType="send"
          onSubmitEditing={handleAddComment}
          multiline
        />
        <TouchableOpacity
          onPress={handleAddComment}
          disabled={!commentText.trim() || sendingCmt}
          activeOpacity={0.7}
        >
          {sendingCmt
            ? <ActivityIndicator size="small" color={c.primary} />
            : <Ionicons name="send" size={22} color={commentText.trim() ? c.primary : c.textMuted} />
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: 52, paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 44, padding: 4 },
  headerTitle: { fontSize: typography.fontSizeLG, fontWeight: typography.fontWeightBold },

  authorRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  authorInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  authorName: { fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightSemiBold },
  postTime: { fontSize: typography.fontSizeXS, marginTop: 1 },

  postImage: { width: W, height: W },

  actions: {
    flexDirection: 'row', gap: spacing.lg,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionCount: { fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightMedium },

  captionRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: spacing.md, paddingBottom: spacing.sm,
  },
  captionAuthor: { fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightSemiBold },
  captionText: { fontSize: typography.fontSizeSM, lineHeight: 20 },

  divider: { height: StyleSheet.hairlineWidth, marginBottom: spacing.md },

  commentsSection: { paddingHorizontal: spacing.md, gap: spacing.md },
  noComments: { textAlign: 'center', fontSize: typography.fontSizeSM, paddingVertical: spacing.lg },

  commentRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  commentBubble: { flex: 1 },
  commentAuthor: { fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightSemiBold },
  commentText: { fontSize: typography.fontSizeSM, lineHeight: 19, marginTop: 1 },
  commentTime: { fontSize: 11, marginTop: 3 },

  inputBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? 28 : spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1, borderRadius: radius.xl,
    paddingHorizontal: spacing.md, paddingVertical: 9,
    fontSize: typography.fontSizeSM, maxHeight: 80,
  },
});
