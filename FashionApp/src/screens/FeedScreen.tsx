import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, TextInput, ActivityIndicator, RefreshControl,
  KeyboardAvoidingView, Platform, ScrollView, Dimensions,
  ActionSheetIOS, Alert, Modal, TouchableWithoutFeedback,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  getFeed, getFeedStories, toggleLike, getComments,
  addComment, updatePost, deletePost, repostPost,
  sendMessage, getFollowing, getUnreadNotificationCount,
  PostDto, StoryGroup, CommentDto, UserCard,
} from '../api/social';
import { typography, spacing, radius } from '../theme';
import { useSimilarGarmentPicker } from '../components/SimilarGarmentPicker';

const { width: SCREEN_W } = Dimensions.get('window');

// ── Avatar helper ─────────────────────────────────────────────────────────────
const Avatar: React.FC<{ uri?: string | null; name: string; size?: number }> = ({ uri, name, size = 36 }) => {
  const { themeColors: c } = useTheme();
  return uri
    ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
    : (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.surfaceElevated, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: c.primary, fontWeight: '700', fontSize: size * 0.4 }}>{name?.[0]?.toUpperCase()}</Text>
      </View>
    );
};

// ── Stories Bar ───────────────────────────────────────────────────────────────
const StoriesBar: React.FC<{
  groups: StoryGroup[];
  myUserId: number;
  onPress: (group: StoryGroup) => void;
  onAddStory: () => void;
  onViewMyStory?: () => void;
}> = ({ groups, myUserId, onPress, onAddStory, onViewMyStory }) => {
  const { themeColors: c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const myGroup = groups.find(g => g.userId === myUserId);
  const others  = groups.filter(g => g.userId !== myUserId);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.storiesScroll}
    >
      {/* My story: circle = view, badge = add */}
      <View style={styles.storyItem}>
        <View style={styles.myStoryWrap}>
          <TouchableOpacity
            style={styles.myStoryTouchable}
            onPress={myGroup && onViewMyStory ? onViewMyStory : onAddStory}
            activeOpacity={0.8}
          >
            <View style={[styles.storyRing, styles.storyRingAdd]}>
              <View style={styles.addStoryCircle}>
                {myGroup
                  ? <Avatar uri={myGroup.avatarUrl} name={myGroup.fullName} size={52} />
                  : <Text style={styles.addStoryIcon}>+</Text>
                }
              </View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addBadge}
            onPress={onAddStory}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={styles.addBadgeText}>+</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.storyName} numberOfLines={1}>Your story</Text>
      </View>

      {others.map(g => (
        <TouchableOpacity key={g.userId} style={styles.storyItem} onPress={() => onPress(g)} activeOpacity={0.8}>
          <LinearGradient
            colors={g.hasUnviewed ? [c.primaryLight, c.primary, c.accent] : [c.borderLight, c.border]}
            style={styles.storyRing}
            start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }}
          >
            <View style={styles.storyAvatarWrap}>
              <Avatar uri={g.avatarUrl} name={g.fullName} size={52} />
            </View>
          </LinearGradient>
          <Text style={styles.storyName} numberOfLines={1}>{g.fullName.split(' ')[0]}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

// ── Post Card ─────────────────────────────────────────────────────────────────
const PostCard: React.FC<{
  post: PostDto;
  myUserId: number;
  onLike: (postId: number) => void;
  onCommentPress: (post: PostDto) => void;
  onUserPress: (userId: number) => void;
  onOptions: (post: PostDto) => void;
  onShare: (post: PostDto) => void;
  onTryOn: (post: PostDto) => void;
  index: number;
}> = ({ post, myUserId, onLike, onCommentPress, onUserPress, onOptions, onShare, onTryOn, index }) => {
  const { themeColors: c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);

  const timeAgo = (iso: string) => {
    const utc = iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z';
    const diff = Date.now() - new Date(utc).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  };

  return (
    <Animated.View entering={FadeInDown.delay(index * 80).duration(400)} style={styles.postCard}>
      {/* Header */}
      <View style={styles.postHeader}>
        <TouchableOpacity style={styles.postHeaderLeft} onPress={() => onUserPress(post.userId)} activeOpacity={0.8}>
          <Avatar uri={post.avatarUrl} name={post.fullName} size={38} />
          <View style={styles.postHeaderInfo}>
            <Text style={styles.postUserName}>{post.fullName}</Text>
            <Text style={styles.postTime}>{timeAgo(post.createdAt)}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onOptions(post)} style={styles.optionsBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="ellipsis-horizontal" size={20} color={c.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Image */}
      <Image source={{ uri: post.imageUrl }} style={styles.postImage} resizeMode="cover" />

      {/* Actions */}
      <View style={styles.postActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onLike(post.id)} activeOpacity={0.7}>
          <Ionicons
            name={post.isLikedByMe ? 'heart' : 'heart-outline'}
            size={24}
            color={post.isLikedByMe ? c.error : c.textSecondary}
          />
          <Text style={[styles.actionCount, post.isLikedByMe && styles.actionCountActive]}>
            {post.likeCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={() => onCommentPress(post)} activeOpacity={0.7}>
          <Ionicons name="chatbubble-outline" size={22} color={c.textSecondary} />
          <Text style={styles.actionCount}>{post.commentCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={() => onShare(post)} activeOpacity={0.7}>
          <Ionicons name="paper-plane-outline" size={22} color={c.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionBtn, styles.tryOnBtn]} onPress={() => onTryOn(post)} activeOpacity={0.7}>
          <Ionicons name="shirt-outline" size={20} color={c.primary} />
          <Text style={[styles.actionCount, { color: c.primary, fontWeight: typography.fontWeightSemiBold }]}>Try On</Text>
        </TouchableOpacity>
      </View>

      {/* Caption */}
      {!!post.caption && (
        <View style={styles.captionRow}>
          <Text style={styles.captionUser}>{post.fullName.split(' ')[0]}</Text>
          <Text style={styles.captionText}> {post.caption}</Text>
        </View>
      )}
    </Animated.View>
  );
};

// ── Comments Sheet ────────────────────────────────────────────────────────────
const CommentsSheet: React.FC<{
  post: PostDto | null;
  myUserId: number;
  myName: string;
  onClose: () => void;
}> = ({ post, myUserId, myName, onClose }) => {
  const { themeColors: c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const [comments, setComments] = useState<CommentDto[]>([]);
  const [text, setText]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [sending, setSending]   = useState(false);

  React.useEffect(() => {
    if (!post) return;
    setLoading(true);
    getComments(post.id).then(setComments).finally(() => setLoading(false));
  }, [post?.id]);

  const handleSend = async () => {
    if (!post || !text.trim()) return;
    setSending(true);
    try {
      const comment = await addComment(post.id, myUserId, text.trim());
      setComments(prev => [...prev, comment]);
      setText('');
    } finally { setSending(false); }
  };

  if (!post) return null;

  return (
    <View style={styles.sheetOverlay}>
      <TouchableOpacity style={styles.sheetDismiss} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>Comments</Text>

        {loading
          ? <ActivityIndicator color={c.primary} style={{ marginTop: 24 }} />
          : (
            <FlatList
              data={comments}
              keyExtractor={item => String(item.id)}
              style={styles.commentsList}
              renderItem={({ item }) => (
                <View style={styles.commentRow}>
                  <Avatar uri={item.avatarUrl} name={item.fullName} size={30} />
                  <View style={styles.commentBubble}>
                    <Text style={styles.commentUser}>{item.fullName}</Text>
                    <Text style={styles.commentText}>{item.text}</Text>
                  </View>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.emptyComments}>No comments yet. Be the first!</Text>}
            />
          )
        }

        <View style={styles.commentInputRow}>
          <Avatar uri={null} name={myName} size={32} />
          <TextInput
            style={styles.commentInput}
            placeholder="Add a comment…"
            placeholderTextColor={c.textMuted}
            value={text}
            onChangeText={setText}
            multiline
          />
          <TouchableOpacity onPress={handleSend} disabled={sending || !text.trim()} style={styles.sendBtn}>
            <Text style={[styles.sendText, (!text.trim() || sending) && styles.sendTextDisabled]}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

// ── Edit Caption Modal ─────────────────────────────────────────────────────────
const EditCaptionModal: React.FC<{
  post: PostDto | null;
  onSave: (postId: number, caption: string) => void;
  onClose: () => void;
}> = ({ post, onSave, onClose }) => {
  const { themeColors: c } = useTheme();
  const editStyles = React.useMemo(() => makeEditStyles(c), [c]);
  const [caption, setCaption] = useState(post?.caption ?? '');

  React.useEffect(() => { setCaption(post?.caption ?? ''); }, [post?.id]);

  if (!post) return null;

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={editStyles.overlay} behavior="padding">
        <View style={editStyles.box}>
          <Text style={editStyles.title}>Edit Caption</Text>
          <TextInput
            style={editStyles.input}
            value={caption}
            onChangeText={setCaption}
            multiline
            autoFocus
            placeholder="Write a caption…"
            placeholderTextColor={c.textMuted}
          />
          <View style={editStyles.btns}>
            <TouchableOpacity style={editStyles.cancelBtn} onPress={onClose}>
              <Text style={editStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={editStyles.saveBtn} onPress={() => onSave(post.id, caption)}>
              <Text style={editStyles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ── Share Modal ───────────────────────────────────────────────────────────────
const ShareModal: React.FC<{
  post: PostDto | null;
  myUserId: number;
  onClose: () => void;
  onAddToStory: (post: PostDto) => void;
}> = ({ post, myUserId, onClose, onAddToStory }) => {
  const { themeColors: c } = useTheme();
  const [following, setFollowing] = useState<UserCard[]>([]);
  const [loading, setLoading]     = useState(true);
  const [sending, setSending]     = useState<number | null>(null);
  const [sentTo, setSentTo]       = useState<Set<number>>(new Set());
  const [addedToStory, setAddedToStory] = useState(false);

  React.useEffect(() => {
    if (!post) return;
    setSentTo(new Set());
    setAddedToStory(false);
    setLoading(true);
    getFollowing(myUserId, myUserId).then(setFollowing).finally(() => setLoading(false));
  }, [post?.id]);

  const handleShare = async (friend: UserCard) => {
    if (!post) return;
    setSending(friend.userId);
    try {
      await sendMessage(
        myUserId, friend.userId, '__post__',
        undefined, undefined,
        post.id, post.imageUrl,
        post.fullName, post.avatarUrl ?? undefined, post.caption,
      );
      setSentTo(prev => new Set([...prev, friend.userId]));
    } catch (e: any) {
      const msg = e?.response?.data?.error;
      if (msg === 'blocked') Alert.alert('Cannot send', 'You are blocked by this user.');
      else if (msg === 'request_pending') Alert.alert('Request pending', 'Your message request is still pending.');
      else Alert.alert('Error', 'Could not share the post. Please try again.');
    } finally { setSending(null); }
  };

  const handleAddToStory = () => {
    if (!post) return;
    onClose();
    onAddToStory(post);
  };

  if (!post) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <TouchableWithoutFeedback>
            <View style={{ backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingBottom: 36, maxHeight: '65%', borderTopWidth: 1, borderColor: c.border }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: c.border, alignSelf: 'center', marginBottom: 12 }} />
              <Text style={{ fontSize: typography.fontSizeLG, fontWeight: typography.fontWeightBold as any, color: c.text, paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
                Share
              </Text>

              {/* Add to Story row */}
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 10, paddingHorizontal: spacing.lg, marginBottom: 4 }}
                onPress={handleAddToStory}
                activeOpacity={0.75}
              >
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.surfaceElevated, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.primary, borderStyle: 'dashed' }}>
                  <Ionicons name="add" size={26} color={c.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: typography.fontSizeMD, fontWeight: '700' as any, color: c.text }}>Add to Story</Text>
                  <Text style={{ fontSize: typography.fontSizeXS, color: c.textMuted, marginTop: 1 }}>Share this post to your story</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
              </TouchableOpacity>

              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginHorizontal: spacing.lg, marginBottom: spacing.sm }} />
              <Text style={{ fontSize: typography.fontSizeSM, fontWeight: '600' as any, color: c.textMuted, paddingHorizontal: spacing.lg, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Send to friends
              </Text>

              {loading
                ? <ActivityIndicator color={c.primary} style={{ marginTop: 24 }} />
                : (
                  <FlatList
                    data={following}
                    keyExtractor={f => String(f.userId)}
                    contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 10 }}
                        onPress={() => handleShare(item)}
                        disabled={sending !== null || sentTo.has(item.userId)}
                        activeOpacity={0.75}
                      >
                        <Avatar uri={item.avatarUrl} name={item.fullName} size={44} />
                        <Text style={{ flex: 1, fontSize: typography.fontSizeMD, fontWeight: typography.fontWeightSemiBold as any, color: c.text }}>
                          {item.fullName}
                        </Text>
                        {sentTo.has(item.userId)
                          ? <Ionicons name="checkmark-circle" size={22} color={c.success} />
                          : sending === item.userId
                            ? <ActivityIndicator size="small" color={c.primary} />
                            : <Text style={{ fontSize: typography.fontSizeSM, color: c.primary, fontWeight: typography.fontWeightSemiBold as any }}>Send</Text>
                        }
                      </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                      <Text style={{ textAlign: 'center', color: c.textMuted, paddingTop: 16, fontSize: typography.fontSizeMD }}>
                        Follow people to send this post
                      </Text>
                    }
                  />
                )
              }
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

// ── Feed Screen ───────────────────────────────────────────────────────────────
export const FeedScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const { themeColors: c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const { openPicker, Picker } = useSimilarGarmentPicker();

  const [posts, setPosts]                       = useState<PostDto[]>([]);
  const [stories, setStories]                   = useState<StoryGroup[]>([]);
  const [refreshing, setRefreshing]             = useState(false);
  const [loadingMore, setMore]                  = useState(false);
  const [page, setPage]                         = useState(0);
  const [hasMore, setHasMore]                   = useState(true);
  const [commentPost, setCommentPost]           = useState<PostDto | null>(null);
  const [editPost, setEditPost]                 = useState<PostDto | null>(null);
  const [sharePost, setSharePost]               = useState<PostDto | null>(null);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  const initialLoading = useRef(true);

  const loadData = async (reset = false) => {
    if (!user) return;
    const p = reset ? 0 : page;
    const [newPosts, newStories] = await Promise.all([
      getFeed(user.userId, p),
      getFeedStories(user.userId),
    ]);
    if (reset) {
      setPosts(newPosts);
      setPage(1);
      initialLoading.current = false;
    } else {
      setPosts(prev => {
        const combined = [...prev, ...newPosts];
        const seen = new Set<number>();
        return combined.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
      });
      setPage(p + 1);
    }
    setHasMore(newPosts.length === 20);
    setStories(newStories);
  };

  useFocusEffect(useCallback(() => {
    initialLoading.current = true;
    loadData(true);
    if (user) {
      getUnreadNotificationCount(user.userId).then(setUnreadNotifCount).catch(() => {});
    }
  }, []));

  const onRefresh = async () => { setRefreshing(true); await loadData(true); setRefreshing(false); };
  const onEndReached = async () => {
    if (!hasMore || loadingMore || initialLoading.current) return;
    setMore(true); await loadData(false); setMore(false);
  };

  const handleLike = async (postId: number) => {
    if (!user) return;
    const res = await toggleLike(postId, user.userId);
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, isLikedByMe: res.liked, likeCount: res.likeCount } : p
    ));
    if (commentPost?.id === postId)
      setCommentPost(cp => cp ? { ...cp, isLikedByMe: res.liked, likeCount: res.likeCount } : cp);
  };

  const handleAddStory = async () => {
    if (!user) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow photo access in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: false,
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      navigation.navigate('CreateStory', { imageUri: result.assets[0].uri });
    }
  };

  const handleViewMyStory = () => {
    const myGroup = stories.find(g => g.userId === user?.userId);
    if (!myGroup) { handleAddStory(); return; }
    navigation.navigate('StoryViewer', { groups: stories, startUserId: user!.userId });
  };

  const handleStoryPress = (group: StoryGroup) => {
    navigation.navigate('StoryViewer', { groups: stories, startUserId: group.userId });
  };

  const handleCreatePost = async () => {
    if (!user) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.85 });
    if (!result.canceled && result.assets[0]) {
      navigation.navigate('CreatePost', { imageUri: result.assets[0].uri });
    }
  };

  const handleEditCaption = (post: PostDto) => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Edit Caption', undefined,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save',
            onPress: async (newCaption: string | undefined) => {
              if (newCaption === undefined) return;
              const updated = await updatePost(post.id, user!.userId, newCaption);
              setPosts(prev => prev.map(p => p.id === post.id ? updated : p));
            },
          },
        ],
        'plain-text', post.caption,
      );
    } else {
      setEditPost(post);
    }
  };

  const handleAndroidEditSave = async (postId: number, caption: string) => {
    setEditPost(null);
    const updated = await updatePost(postId, user!.userId, caption);
    setPosts(prev => prev.map(p => p.id === postId ? updated : p));
  };

  const handleDeletePost = (postId: number) => {
    Alert.alert('Delete Post', 'This will permanently delete your post.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deletePost(postId, user!.userId);
          setPosts(prev => prev.filter(p => p.id !== postId));
        },
      },
    ]);
  };

  const handleRepost = async (postId: number) => {
    if (!user) return;
    const newPost = await repostPost(postId, user.userId);
    setPosts(prev => [newPost, ...prev]);
    Alert.alert('Reposted', 'The post has been added to your profile.');
  };

  const handlePostOptions = (post: PostDto) => {
    const isOwn = post.userId === user?.userId;
    if (Platform.OS === 'ios') {
      if (isOwn) {
        ActionSheetIOS.showActionSheetWithOptions(
          { options: ['Cancel', 'Edit Caption', 'Delete Post'], cancelButtonIndex: 0, destructiveButtonIndex: 2 },
          (i) => {
            if (i === 1) handleEditCaption(post);
            if (i === 2) handleDeletePost(post.id);
          },
        );
      } else {
        ActionSheetIOS.showActionSheetWithOptions(
          { options: ['Cancel', 'Repost'], cancelButtonIndex: 0 },
          (i) => { if (i === 1) handleRepost(post.id); },
        );
      }
    } else {
      if (isOwn) {
        Alert.alert('Post Options', '', [
          { text: 'Edit Caption', onPress: () => handleEditCaption(post) },
          { text: 'Delete Post', style: 'destructive', onPress: () => handleDeletePost(post.id) },
          { text: 'Cancel', style: 'cancel' },
        ]);
      } else {
        Alert.alert('', '', [
          { text: 'Repost', onPress: () => handleRepost(post.id) },
          { text: 'Cancel', style: 'cancel' },
        ]);
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.topBarBtn}>
            <Ionicons name="chevron-back" size={24} color={c.text} />
          </TouchableOpacity>
          <Text style={styles.topBarBrand}>SmartFashion</Text>
        </View>
        <View style={styles.topBarActions}>
          <TouchableOpacity
            onPress={() => { setUnreadNotifCount(0); navigation.navigate('Notifications'); }}
            style={styles.topBarBtn}
          >
            <View>
              <Ionicons name="notifications-outline" size={24} color={c.text} />
              {unreadNotifCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleCreatePost} style={styles.topBarBtn}>
            <Ionicons name="add-circle-outline" size={26} color={c.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Email verification banner */}
      {!user?.isEmailVerified && (
        <TouchableOpacity
          style={styles.verifyBanner}
          onPress={() => navigation.navigate('VerifyEmail', { userId: user?.userId, email: user?.email })}
          activeOpacity={0.85}
        >
          <View style={styles.verifyBannerLeft}>
            <Ionicons name="mail-outline" size={18} color={c.primary} />
            <View>
              <Text style={styles.verifyBannerTitle}>Verify your email address</Text>
              <Text style={styles.verifyBannerSub}>Check your inbox · tap to enter the code</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.primary} />
        </TouchableOpacity>
      )}

      <FlatList
        data={posts}
        keyExtractor={p => String(p.id)}
        renderItem={({ item, index }) => (
          <PostCard
            post={item}
            myUserId={user?.userId ?? 0}
            onLike={handleLike}
            onCommentPress={setCommentPost}
            onUserPress={id => navigation.navigate('UserProfile', { userId: id })}
            onOptions={handlePostOptions}
            onShare={setSharePost}
            onTryOn={p => openPicker(p.imageUrl)}
            index={index}
          />
        )}
        ListHeaderComponent={
          <StoriesBar
            groups={stories}
            myUserId={user?.userId ?? 0}
            onPress={handleStoryPress}
            onAddStory={handleAddStory}
            onViewMyStory={handleViewMyStory}
          />
        }
        ListEmptyComponent={
          !refreshing ? (
            <View style={styles.emptyFeed}>
              <Text style={styles.emptyIcon}>◇</Text>
              <Text style={styles.emptyTitle}>Your feed is empty</Text>
              <Text style={styles.emptySubtitle}>Follow people to see their posts here</Text>
              <TouchableOpacity style={styles.discoverBtn} onPress={() => navigation.navigate('Discover')}>
                <Text style={styles.discoverText}>Discover People</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator color={c.primary} style={{ marginVertical: 16 }} /> : null}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.feedContent}
      />

      {commentPost && (
        <CommentsSheet
          post={commentPost}
          myUserId={user?.userId ?? 0}
          myName={user?.fullName ?? ''}
          onClose={() => setCommentPost(null)}
        />
      )}

      {editPost && (
        <EditCaptionModal
          post={editPost}
          onSave={handleAndroidEditSave}
          onClose={() => setEditPost(null)}
        />
      )}

      {sharePost && (
        <ShareModal
          post={sharePost}
          myUserId={user?.userId ?? 0}
          onClose={() => setSharePost(null)}
          onAddToStory={(post) => navigation.navigate('CreateStory', {
            imageUri: post.imageUrl,
            postId: post.id,
            postAuthorName: post.fullName,
            postAuthorAvatar: post.avatarUrl,
            postCaption: post.caption,
          })}
        />
      )}
      {Picker}
    </View>
  );
};

// ── Style factories ───────────────────────────────────────────────────────────
const makeEditStyles = (c: any) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', paddingHorizontal: spacing.lg },
  box: { backgroundColor: c.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: c.border },
  title: { fontSize: typography.fontSizeLG, fontWeight: typography.fontWeightBold as any, color: c.text, marginBottom: spacing.md },
  input: {
    backgroundColor: c.surfaceElevated, borderRadius: radius.md,
    padding: spacing.md, color: c.text, fontSize: typography.fontSizeMD,
    minHeight: 80, textAlignVertical: 'top', marginBottom: spacing.lg,
  },
  btns: { flexDirection: 'row' as const, gap: spacing.md },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: radius.md, backgroundColor: c.surfaceElevated, alignItems: 'center' as const },
  cancelText: { color: c.text, fontWeight: typography.fontWeightSemiBold as any },
  saveBtn: { flex: 1, paddingVertical: 12, borderRadius: radius.md, backgroundColor: c.primary, alignItems: 'center' as const },
  saveText: { color: c.white, fontWeight: typography.fontWeightBold as any },
});

const makeStyles = (c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: 52, paddingBottom: spacing.md,
    borderBottomWidth: 1, borderBottomColor: c.border,
    backgroundColor: c.background,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  topBarBrand: { fontSize: typography.fontSize2XL, fontWeight: typography.fontWeightExtraBold as any, color: c.primary, letterSpacing: 1 },
  topBarActions: { flexDirection: 'row', gap: spacing.md },
  topBarBtn: { padding: 4 },

  notifBadge: {
    position: 'absolute', top: -4, right: -6,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: c.error, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 2, borderWidth: 1.5, borderColor: c.background,
  },
  notifBadgeText: { color: c.white, fontSize: 9, fontWeight: '800', lineHeight: 11 },

  verifyBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: c.surfaceElevated, borderBottomWidth: 1, borderBottomColor: c.border,
    paddingHorizontal: spacing.lg, paddingVertical: 10,
  },
  verifyBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  verifyBannerTitle: { fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightSemiBold as any, color: c.primary },
  verifyBannerSub: { fontSize: typography.fontSizeXS, color: c.textMuted, marginTop: 1 },

  feedContent: { paddingBottom: 100 },

  // Stories
  storiesScroll: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.md },
  storyItem: { alignItems: 'center', width: 68 },
  myStoryWrap: { position: 'relative', width: 64, height: 64 },
  myStoryTouchable: { width: 64, height: 64 },
  storyRing: { width: 64, height: 64, borderRadius: 32, padding: 2.5, marginBottom: 4 },
  storyRingAdd: { backgroundColor: c.surfaceElevated },
  storyAvatarWrap: { width: '100%' as any, height: '100%' as any, borderRadius: 30, overflow: 'hidden' as const, backgroundColor: c.surface },
  addStoryCircle: { width: '100%' as any, height: '100%' as any, borderRadius: 30, overflow: 'hidden' as const, backgroundColor: c.surfaceElevated, alignItems: 'center' as const, justifyContent: 'center' as const },
  addStoryIcon: { fontSize: 28, color: c.primary, fontWeight: '300' as any },
  addBadge: { position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderRadius: 10, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.background },
  addBadgeText: { color: c.white, fontSize: 13, fontWeight: '700', lineHeight: 15 },
  storyName: { fontSize: 10, color: c.textSecondary, textAlign: 'center', maxWidth: 64 },

  // Post card
  postCard: { backgroundColor: c.background, marginBottom: 2 },
  postHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
  postHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  postHeaderInfo: { flex: 1 },
  postUserName: { fontSize: typography.fontSizeMD, fontWeight: typography.fontWeightSemiBold as any, color: c.text },
  postTime: { fontSize: typography.fontSizeXS, color: c.textMuted, marginTop: 1 },
  optionsBtn: { paddingLeft: spacing.md },
  postImage: { width: SCREEN_W, height: SCREEN_W, backgroundColor: c.surfaceElevated },
  postActions: { flexDirection: 'row', gap: spacing.lg, padding: spacing.md, paddingBottom: spacing.sm },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tryOnBtn: { marginLeft: 'auto' },
  actionCount: { fontSize: typography.fontSizeSM, color: c.textSecondary, fontWeight: typography.fontWeightMedium as any },
  actionCountActive: { color: c.error },
  captionRow: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingBottom: spacing.md, flexWrap: 'wrap' },
  captionUser: { fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightSemiBold as any, color: c.text },
  captionText: { fontSize: typography.fontSizeSM, color: c.textSecondary, flex: 1 },

  // Empty feed
  emptyFeed: { alignItems: 'center', paddingTop: 80, paddingHorizontal: spacing.xl },
  emptyIcon: { fontSize: 48, color: c.textMuted, marginBottom: spacing.lg },
  emptyTitle: { fontSize: typography.fontSizeLG, fontWeight: typography.fontWeightBold as any, color: c.text, marginBottom: spacing.sm },
  emptySubtitle: { fontSize: typography.fontSizeMD, color: c.textSecondary, textAlign: 'center', marginBottom: spacing.xl },
  discoverBtn: { backgroundColor: c.primary, borderRadius: radius.lg, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  discoverText: { color: c.white, fontWeight: typography.fontWeightBold as any, fontSize: typography.fontSizeMD },

  // Comments sheet
  sheetOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 100 },
  sheetDismiss: { flex: 1 },
  sheet: {
    backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderTopWidth: 1, borderColor: c.border,
    maxHeight: '75%', minHeight: 300,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  sheetTitle: { fontSize: typography.fontSizeLG, fontWeight: typography.fontWeightBold as any, color: c.text, textAlign: 'center', paddingBottom: spacing.md, borderBottomWidth: 1, borderColor: c.border },
  commentsList: { flex: 1, paddingHorizontal: spacing.md, paddingTop: spacing.md },
  commentRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.md },
  commentBubble: { flex: 1, backgroundColor: c.surfaceElevated, borderRadius: radius.md, padding: spacing.sm },
  commentUser: { fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightSemiBold as any, color: c.primary, marginBottom: 2 },
  commentText: { fontSize: typography.fontSizeSM, color: c.text },
  emptyComments: { textAlign: 'center', color: c.textMuted, marginTop: 40, fontSize: typography.fontSizeMD },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: spacing.md, borderTopWidth: 1, borderColor: c.border },
  commentInput: { flex: 1, backgroundColor: c.surfaceElevated, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 8, color: c.text, fontSize: typography.fontSizeSM, maxHeight: 80 },
  sendBtn: { paddingHorizontal: spacing.md, paddingVertical: 8 },
  sendText: { color: c.primary, fontWeight: typography.fontWeightBold as any, fontSize: typography.fontSizeMD },
  sendTextDisabled: { color: c.textMuted },
});
