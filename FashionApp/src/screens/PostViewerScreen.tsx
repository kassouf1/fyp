import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  Dimensions, Alert, ActionSheetIOS, Platform, TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  PostDto, CommentDto,
  toggleLike, getComments, addComment, deleteComment,
  deletePost, updatePost,
} from '../api/social';
import { typography, spacing, radius } from '../theme';
import { useSimilarGarmentPicker } from '../components/SimilarGarmentPicker';

const { width: W, height: H } = Dimensions.get('window');

type RouteParams = { posts: PostDto[]; startIndex: number };

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

const formatTime = (iso: string) => {
  const d = new Date(iso.endsWith('Z') ? iso : iso + 'Z');
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
};

// ── Single post card ──────────────────────────────────────────────────────────
const PostCard: React.FC<{
  post: PostDto;
  onUpdate: (updated: PostDto) => void;
  onDelete: (id: number) => void;
  onTryOn: (post: PostDto) => void;
}> = ({ post, onUpdate, onDelete, onTryOn }) => {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const { themeColors: c } = useTheme();
  const isOwn = post.userId === user?.userId;

  const [liked, setLiked]         = useState(post.isLikedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [comments, setComments]   = useState<CommentDto[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText]   = useState('');
  const [loadingCmts, setLoadingCmts]   = useState(false);

  const handleLike = async () => {
    if (!user) return;
    const prev = { liked, likeCount };
    setLiked(!liked);
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

  const loadComments = useCallback(async () => {
    setLoadingCmts(true);
    try { setComments(await getComments(post.id)); } finally { setLoadingCmts(false); }
  }, [post.id]);

  const toggleComments = () => {
    if (!showComments) loadComments();
    setShowComments(v => !v);
  };

  const handleAddComment = async () => {
    if (!user || !commentText.trim()) return;
    const t = commentText.trim();
    setCommentText('');
    try {
      const newCmt = await addComment(post.id, user.userId, t);
      setComments(prev => [...prev, newCmt]);
    } catch { Alert.alert('Error', 'Could not post comment.'); }
  };

  const handleDeleteComment = (cmtId: number) => {
    if (!user) return;
    Alert.alert('Delete comment?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteComment(post.id, cmtId, user.userId);
        setComments(prev => prev.filter(cmt => cmt.id !== cmtId));
      }},
    ]);
  };

  const handleOptions = () => {
    if (!isOwn) return;
    const opts = ['Cancel', 'Edit Caption', 'Delete Post'];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: opts, cancelButtonIndex: 0, destructiveButtonIndex: 2 },
        i => {
          if (i === 1) promptEdit();
          if (i === 2) confirmDelete();
        },
      );
    } else {
      Alert.alert('Post Options', undefined, [
        { text: 'Edit Caption', onPress: promptEdit },
        { text: 'Delete Post', style: 'destructive', onPress: confirmDelete },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const promptEdit = () => {
    if (Platform.OS === 'ios') {
      Alert.prompt('Edit Caption', undefined, async (text) => {
        if (text === undefined || !user) return;
        const updated = await updatePost(post.id, user.userId, text);
        onUpdate(updated);
      }, 'plain-text', post.caption);
    } else {
      Alert.alert('Edit Caption', 'Use iOS for inline editing');
    }
  };

  const confirmDelete = () => {
    Alert.alert('Delete Post', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        if (!user) return;
        await deletePost(post.id, user.userId);
        onDelete(post.id);
      }},
    ]);
  };

  return (
    <View style={[ps.card, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={ps.cardHeader}>
        <TouchableOpacity
          style={ps.authorRow}
          onPress={() => navigation.navigate('UserProfile', { userId: post.userId })}
          activeOpacity={0.8}
        >
          <Avatar uri={post.avatarUrl} name={post.fullName} size={34} />
          <View>
            <Text style={[ps.authorName, { color: c.text }]}>{post.fullName}</Text>
            <Text style={[ps.postTime, { color: c.textMuted }]}>{formatTime(post.createdAt)}</Text>
          </View>
        </TouchableOpacity>
        {isOwn && (
          <TouchableOpacity onPress={handleOptions} style={ps.moreBtn}>
            <Text style={[ps.moreIcon, { color: c.textMuted }]}>•••</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Image */}
      <Image source={{ uri: post.imageUrl }} style={ps.postImage} resizeMode="cover" />

      {/* Actions */}
      <View style={ps.actions}>
        <TouchableOpacity onPress={handleLike} style={ps.actionBtn} activeOpacity={0.7}>
          <Text style={[ps.actionIcon, { color: liked ? c.error : c.textMuted }]}>
            {liked ? '♥' : '♡'}
          </Text>
          <Text style={[ps.actionCount, { color: c.textSecondary }]}>{likeCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={toggleComments} style={ps.actionBtn} activeOpacity={0.7}>
          <Text style={[ps.actionIcon, { color: showComments ? c.primary : c.textMuted }]}>◎</Text>
          <Text style={[ps.actionCount, { color: c.textSecondary }]}>{post.commentCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onTryOn(post)}
          style={[ps.tryOnBtn, { backgroundColor: c.primary }]}
          activeOpacity={0.85}
        >
          <Text style={[ps.tryOnBtnText, { color: c.white }]}>◈ Try On</Text>
        </TouchableOpacity>
      </View>

      {/* Caption */}
      {!!post.caption && (
        <View style={ps.captionWrap}>
          <Text style={[ps.captionName, { color: c.text }]}>{post.fullName} </Text>
          <Text style={[ps.captionText, { color: c.text }]}>{post.caption}</Text>
        </View>
      )}

      {/* Comments section */}
      {showComments && (
        <View style={[ps.commentsWrap, { borderTopColor: c.border }]}>
          {loadingCmts
            ? <Text style={[ps.loadingTxt, { color: c.textMuted }]}>Loading…</Text>
            : comments.map(cmt => (
              <TouchableOpacity
                key={cmt.id}
                onLongPress={() => (cmt.userId === user?.userId) && handleDeleteComment(cmt.id)}
                style={ps.commentRow}
              >
                <Text style={[ps.commentName, { color: c.text }]}>{cmt.fullName} </Text>
                <Text style={[ps.commentText, { color: c.textSecondary }]}>{cmt.text}</Text>
              </TouchableOpacity>
            ))
          }
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={[ps.commentInput, { backgroundColor: c.surfaceElevated, borderColor: c.border }]}>
              <TextInput
                style={[ps.commentInputText, { color: c.text }]}
                placeholder="Add a comment…"
                placeholderTextColor={c.textMuted}
                value={commentText}
                onChangeText={setCommentText}
                returnKeyType="send"
                onSubmitEditing={handleAddComment}
              />
              <TouchableOpacity onPress={handleAddComment} disabled={!commentText.trim()}>
                <Text style={[ps.sendBtn, { color: commentText.trim() ? c.primary : c.textMuted }]}>Post</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}

      <View style={[ps.separator, { backgroundColor: c.border }]} />
    </View>
  );
};

const ps = StyleSheet.create({
  card: { width: W },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  authorName: { fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightSemiBold },
  postTime: { fontSize: typography.fontSizeXS },
  moreBtn: { padding: 6 },
  moreIcon: { fontSize: 14, letterSpacing: 2 },
  postImage: { width: W, height: W },
  actions: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionIcon: { fontSize: 22 },
  actionCount: { fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightMedium },
  tryOnBtn: { marginLeft: 'auto', paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.full },
  tryOnBtnText: { fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightBold },
  captionWrap: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  captionName: { fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightSemiBold },
  captionText: { fontSize: typography.fontSizeSM, lineHeight: 20 },
  commentsWrap: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  loadingTxt: { fontSize: typography.fontSizeXS, paddingVertical: spacing.sm, textAlign: 'center' },
  commentRow: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 3 },
  commentName: { fontSize: typography.fontSizeXS, fontWeight: typography.fontWeightSemiBold },
  commentText: { fontSize: typography.fontSizeXS, lineHeight: 18 },
  commentInput: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderRadius: radius.xl, borderWidth: 1,
    paddingHorizontal: spacing.md, paddingVertical: 8, marginTop: spacing.sm,
  },
  commentInputText: { flex: 1, fontSize: typography.fontSizeSM },
  sendBtn: { fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightSemiBold },
  separator: { height: 8 },
});

// ── Screen ────────────────────────────────────────────────────────────────────
export const PostViewerScreen: React.FC = () => {
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const navigation = useNavigation<any>();
  const { themeColors: c } = useTheme();

  const [posts, setPosts] = useState<PostDto[]>(route.params.posts);
  const listRef = useRef<FlatList>(null);
  const { openPicker, Picker } = useSimilarGarmentPicker();

  useEffect(() => {
    const { startIndex } = route.params;
    if (startIndex > 0) {
      setTimeout(() => {
        listRef.current?.scrollToIndex({ index: startIndex, animated: false });
      }, 100);
    }
  }, []);

  const handleUpdate = (updated: PostDto) =>
    setPosts(prev => prev.map(p => p.id === updated.id ? updated : p));

  const handleDelete = (id: number) => {
    setPosts(prev => {
      const next = prev.filter(p => p.id !== id);
      if (next.length === 0) navigation.goBack();
      return next;
    });
  };

  return (
    <View style={[vs.container, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[vs.header, { backgroundColor: c.background, borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={vs.backBtn}>
          <Text style={[vs.backIcon, { color: c.text }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[vs.headerTitle, { color: c.text }]}>Posts</Text>
        <View style={{ width: 44 }} />
      </View>

      <FlatList
        ref={listRef}
        data={posts}
        keyExtractor={p => String(p.id)}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onTryOn={p => openPicker(p.imageUrl)}
          />
        )}
        showsVerticalScrollIndicator={false}
        onScrollToIndexFailed={info => {
          setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, animated: false }), 200);
        }}
      />
      {Picker}
    </View>
  );
};

const vs = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: 52, paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 44, padding: 4 },
  backIcon: { fontSize: 28, lineHeight: 32 },
  headerTitle: { fontSize: typography.fontSizeLG, fontWeight: typography.fontWeightBold },
});
