import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  Dimensions, StatusBar, Animated as RNAnimated,
  ActionSheetIOS, Alert, Platform, Modal, FlatList,
  TextInput, KeyboardAvoidingView, TouchableWithoutFeedback,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  markStoryViewed, deleteStory, likeStory, getStoryViewers, sendMessage,
  StoryGroup, StoryViewerDto,
} from '../api/social';

const { width: W, height: H } = Dimensions.get('window');
const STORY_DURATION = 5000;
// Bottom bar heights — tap zones stop here so the bar is always touchable
const OWNER_BAR_H  = Platform.OS === 'ios' ? 90  : 70;
const VIEWER_BAR_H = Platform.OS === 'ios' ? 110 : 90;

type RouteParams = { groups: StoryGroup[]; startUserId: number };

// Story viewer is a fullscreen immersive screen — Avatar always uses dark hardcoded colors
// since it's overlaid on photos/videos
const Avatar: React.FC<{ uri?: string | null; name: string; size?: number }> = ({ uri, name, size = 36 }) => {
  const { themeColors: c } = useTheme();
  return uri
    ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
    : <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#2A2A3A', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: c.primary, fontWeight: '700', fontSize: size * 0.4 }}>{name?.[0]?.toUpperCase()}</Text>
      </View>;
};

// ── Viewers Sheet ──────────────────────────────────────────────────────────────
const ViewersSheet: React.FC<{
  storyId: number;
  ownerId: number;
  onClose: () => void;
}> = ({ storyId, ownerId, onClose }) => {
  const { themeColors: c } = useTheme();
  const [viewers, setViewers] = useState<StoryViewerDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStoryViewers(storyId, ownerId)
      .then(setViewers)
      .finally(() => setLoading(false));
  }, [storyId]);

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={sheetS.overlay}>
          <TouchableWithoutFeedback>
            <View style={[sheetS.sheet, { backgroundColor: c.surface, borderTopColor: c.border }]}>
              <View style={[sheetS.handle, { backgroundColor: c.border }]} />
              <Text style={[sheetS.title, { color: c.text }]}>{loading ? 'Views' : `Views · ${viewers.length}`}</Text>
              {loading ? (
                <ActivityIndicator color={c.primary} style={{ marginTop: 24 }} />
              ) : (
                <FlatList
                  data={viewers}
                  keyExtractor={v => String(v.userId)}
                  contentContainerStyle={{ paddingBottom: 30 }}
                  renderItem={({ item }) => (
                    <View style={sheetS.row}>
                      <Avatar uri={item.avatarUrl} name={item.fullName} size={40} />
                      <Text style={[sheetS.name, { color: c.text }]}>{item.fullName}</Text>
                      {item.hasLiked && <Text style={[sheetS.heart, { color: c.error }]}>♥</Text>}
                    </View>
                  )}
                  ListEmptyComponent={
                    <View style={{ alignItems: 'center', paddingTop: 30 }}>
                      <Text style={[{ fontSize: 14 }, { color: c.textMuted }]}>No views yet</Text>
                    </View>
                  }
                />
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const sheetS = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '60%', minHeight: 200,
    borderTopWidth: 1,
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 16 },
  title: { fontSize: 16, fontWeight: '700', paddingHorizontal: 20, marginBottom: 12 },
  row:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, gap: 12 },
  name: { flex: 1, fontSize: 14, fontWeight: '500' },
  heart: { fontSize: 16 },
});

// ── Story Viewer ───────────────────────────────────────────────────────────────
export const StoryViewerScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route      = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const { groups, startUserId } = route.params;
  const { user } = useAuth();
  const { themeColors: c } = useTheme();

  const startGroupIdx = groups.findIndex(g => g.userId === startUserId);
  const [groupIdx, setGroupIdx] = useState(startGroupIdx < 0 ? 0 : startGroupIdx);
  const [storyIdx, setStoryIdx] = useState(0);

  const progress = useRef(new RNAnimated.Value(0)).current;
  const animRef  = useRef<RNAnimated.CompositeAnimation | null>(null);

  const [likedStoryIds, setLikedStoryIds] = useState<Set<number>>(
    () => new Set(groups.flatMap(g => g.stories.filter(s => s.isLikedByMe).map(s => s.id)))
  );
  const [localLikeCounts, setLocalLikeCounts] = useState<Map<number, number>>(
    () => new Map(groups.flatMap(g => g.stories.map(s => [s.id, s.likeCount])))
  );

  const [replyText, setReplyText]     = useState('');
  const [replySent, setReplySent]     = useState(false);
  const [showViewers, setShowViewers] = useState(false);

  const group        = groups[groupIdx];
  const story        = group?.stories[storyIdx];
  const totalStories = group?.stories.length ?? 0;
  const isOwn        = group?.userId === user?.userId;
  const isLiked      = likedStoryIds.has(story?.id ?? -1);
  const likeCount    = localLikeCounts.get(story?.id ?? -1) ?? story?.likeCount ?? 0;

  useEffect(() => {
    if (!story || !user) return;
    markStoryViewed(story.id, user.userId).catch(() => {});
    setReplyText('');
    setReplySent(false);
    startProgress();
    return () => animRef.current?.stop();
  }, [groupIdx, storyIdx]);

  const startProgress = () => {
    progress.setValue(0);
    animRef.current?.stop();
    animRef.current = RNAnimated.timing(progress, {
      toValue: 1, duration: STORY_DURATION, useNativeDriver: false,
    });
    animRef.current.start(({ finished }) => { if (finished) goNext(); });
  };

  const goNext = () => {
    if (storyIdx < totalStories - 1) setStoryIdx(i => i + 1);
    else if (groupIdx < groups.length - 1) { setGroupIdx(i => i + 1); setStoryIdx(0); }
    else navigation.goBack();
  };

  const goPrev = () => {
    if (storyIdx > 0) setStoryIdx(i => i - 1);
    else if (groupIdx > 0) { setGroupIdx(i => i - 1); setStoryIdx(0); }
  };

  const handleLike = async () => {
    if (!user || !story) return;
    const storyId = story.id;
    const wasLiked = likedStoryIds.has(storyId);
    // Optimistic update — flip immediately so UI responds instantly
    setLikedStoryIds(prev => {
      const next = new Set(prev);
      wasLiked ? next.delete(storyId) : next.add(storyId);
      return next;
    });
    setLocalLikeCounts(prev =>
      new Map(prev).set(storyId, (prev.get(storyId) ?? story.likeCount) + (wasLiked ? -1 : 1))
    );
    try {
      const res = await likeStory(storyId, user.userId);
      // Sync with server truth
      setLikedStoryIds(prev => {
        const next = new Set(prev);
        res.liked ? next.add(storyId) : next.delete(storyId);
        return next;
      });
      setLocalLikeCounts(prev => new Map(prev).set(storyId, res.likeCount));
    } catch {
      // Revert on error
      setLikedStoryIds(prev => {
        const next = new Set(prev);
        wasLiked ? next.add(storyId) : next.delete(storyId);
        return next;
      });
      setLocalLikeCounts(prev => new Map(prev).set(storyId, story.likeCount));
    }
  };

  const handleReply = async () => {
    if (!user || !story || !replyText.trim()) return;
    animRef.current?.stop();
    await sendMessage(user.userId, group.userId, replyText.trim(), story.imageUrl);
    setReplyText('');
    setReplySent(true);
    setTimeout(() => { setReplySent(false); startProgress(); }, 1500);
  };

  const handleDeleteStory = () => {
    if (!user || !story) return;
    const storyId = story.id;
    Alert.alert('Delete Story', 'Remove this story?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteStory(storyId, user.userId);
          if (totalStories > 1) setStoryIdx(i => Math.max(0, i - 1));
          else if (groups.length > 1) { setGroupIdx(i => Math.max(0, i - 1)); setStoryIdx(0); }
          else navigation.goBack();
        },
      },
    ]);
  };

  const handleStoryOptions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Delete Story'], cancelButtonIndex: 0, destructiveButtonIndex: 1 },
        (i) => { if (i === 1) handleDeleteStory(); },
      );
    } else {
      Alert.alert('Story Options', '', [
        { text: 'Delete Story', style: 'destructive', onPress: handleDeleteStory },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  if (!group || !story) return null;

  const timeAgo = (iso: string) => {
    const utc = iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z';
    const m = Math.floor((Date.now() - new Date(utc).getTime()) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const bottomH = isOwn ? OWNER_BAR_H : VIEWER_BAR_H;

  return (
    // Outer flex column: [spacer, bottom-bar]
    // All story chrome is absolutely positioned on top.
    // The spacer passes through touches to the absolute tap zones.
    <View style={styles.container}>
      <StatusBar hidden />

      {/* ── Background ── */}
      {story.postId ? (
        <>
          <Image source={{ uri: story.imageUrl }} style={styles.image} resizeMode="cover" blurRadius={28} />
          <LinearGradient
            colors={['rgba(10,10,20,0.72)', 'rgba(10,10,20,0.50)', 'rgba(10,10,20,0.72)']}
            style={StyleSheet.absoluteFill}
          />
        </>
      ) : (
        <>
          <Image source={{ uri: story.imageUrl }} style={styles.image} resizeMode="cover" />
          <LinearGradient
            colors={['rgba(0,0,0,0.5)', 'transparent', 'transparent', 'rgba(0,0,0,0.45)']}
            style={StyleSheet.absoluteFill}
            locations={[0, 0.25, 0.7, 1]}
          />
        </>
      )}

      {/* ── Progress bars ── */}
      <View style={styles.progressRow}>
        {group.stories.map((_, i) => (
          <View key={i} style={styles.progressTrack}>
            <RNAnimated.View
              style={[
                styles.progressFill,
                {
                  width: i < storyIdx
                    ? '100%'
                    : i === storyIdx
                      ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                      : '0%',
                },
              ]}
            />
          </View>
        ))}
      </View>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Avatar uri={group.avatarUrl} name={group.fullName} size={36} />
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Text style={styles.userName}>{group.fullName}</Text>
          <Text style={styles.storyTime}>{timeAgo(story.createdAt)}</Text>
        </View>
        {isOwn && (
          <TouchableOpacity onPress={handleStoryOptions} style={styles.headerBtn}>
            <Text style={styles.headerDots}>···</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* ── Caption overlay ── */}
      {!!story.caption && (
        <View style={styles.captionOverlay} pointerEvents="none">
          <View style={styles.captionBubble}>
            <Text style={styles.captionText}>{story.caption}</Text>
          </View>
        </View>
      )}

      {/* ── Tap zones — stop above the bottom bar ── */}
      <View style={[styles.tapRow, { bottom: bottomH }]}>
        <TouchableOpacity style={{ flex: 1 }} onPress={goPrev} />
        <TouchableOpacity style={{ flex: 2 }} onPress={goNext} />
      </View>

      {/* ── Shared post card — rendered AFTER tap zones so it wins touches ── */}
      {!!story.postId && (
        <View style={styles.postCardWrap} pointerEvents="box-none">
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => { animRef.current?.stop(); navigation.navigate('PostDetail', { postId: story.postId! }); }}
          >
            <View style={styles.postCard}>
              {/* Author row */}
              <View style={styles.postCardHeader}>
                {story.postAuthorAvatarUrl
                  ? <Image source={{ uri: story.postAuthorAvatarUrl }} style={styles.postCardAvatar} />
                  : (
                    <View style={[styles.postCardAvatar, styles.postCardAvatarFallback]}>
                      <Text style={styles.postCardAvatarLetter}>
                        {(story.postAuthorName ?? 'U')[0].toUpperCase()}
                      </Text>
                    </View>
                  )
                }
                <Text style={styles.postCardAuthorName} numberOfLines={1}>
                  {story.postAuthorName ?? 'Post'}
                </Text>
                <Text style={styles.postCardEllipsis}>···</Text>
              </View>

              {/* 1:1 image */}
              <Image source={{ uri: story.imageUrl }} style={styles.postCardImage} resizeMode="cover" />

              {/* Post caption */}
              {!!story.postCaption && (
                <View style={styles.postCardCaption}>
                  <Text style={styles.postCardCaptionText} numberOfLines={2}>
                    {story.postCaption}
                  </Text>
                </View>
              )}
            </View>

            {/* "See post" label */}
            <View style={styles.seePostRow}>
              <Text style={styles.seePostLabel}>See post</Text>
              <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.8)" />
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Spacer — fills the middle, passes touches through ── */}
      <View style={{ flex: 1 }} pointerEvents="none" />

      {/* ── Bottom bar (in normal flow, always on top) ── */}
      {isOwn ? (
        <TouchableOpacity style={styles.ownerBar} onPress={() => setShowViewers(true)} activeOpacity={0.8}>
          <Ionicons name="eye-outline" size={16} color="#fff" />
          <Text style={styles.ownerStat}>  {story.viewCount}</Text>
          <Text style={styles.ownerDot}>·</Text>
          <Ionicons name="heart" size={16} color={c.error} />
          <Text style={[styles.ownerStat, { color: c.error }]}>  {likeCount}</Text>
          <Text style={styles.ownerLabel}>  viewers & likes</Text>
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>
      ) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.viewerBar}>
            {/* Like button */}
            <TouchableOpacity onPress={handleLike} style={styles.likeBtn} activeOpacity={0.7}>
              <Ionicons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={32}
                color={isLiked ? c.error : 'rgba(255,255,255,0.85)'}
              />
            </TouchableOpacity>

            {/* Reply input */}
            <TextInput
              style={styles.replyInput}
              placeholder={replySent ? 'Reply sent ✓' : `Reply to ${group.fullName.split(' ')[0]}…`}
              placeholderTextColor={replySent ? c.primary : 'rgba(255,255,255,0.5)'}
              value={replyText}
              onChangeText={setReplyText}
              onFocus={() => animRef.current?.stop()}
              onBlur={() => { if (!replyText.trim()) startProgress(); }}
              returnKeyType="send"
              onSubmitEditing={handleReply}
              editable={!replySent}
            />

            {replyText.trim().length > 0 && (
              <TouchableOpacity onPress={handleReply} style={[styles.sendBtn, { backgroundColor: c.primary }]}>
                <Text style={[styles.sendBtnText, { color: c.white }]}>→</Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      )}

      {/* ── Viewers modal ── */}
      {showViewers && (
        <ViewersSheet
          storyId={story.id}
          ownerId={user!.userId}
          onClose={() => setShowViewers(false)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  image: { position: 'absolute', width: W, height: H },

  // Progress
  progressRow: {
    position: 'absolute', top: 52, left: 12, right: 12, zIndex: 10,
    flexDirection: 'row', gap: 3,
  },
  progressTrack: { flex: 1, height: 2, backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 1, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#fff', borderRadius: 1 },

  // Header
  header: {
    position: 'absolute', top: 62, left: 12, right: 12, zIndex: 10,
    flexDirection: 'row', alignItems: 'center',
  },
  userName: { color: '#fff', fontWeight: '700', fontSize: 14 },
  storyTime: { color: 'rgba(255,255,255,0.65)', fontSize: 11 },
  headerBtn: { padding: 8 },
  headerDots: { color: '#fff', fontSize: 16, letterSpacing: 1 },
  closeIcon: { color: '#fff', fontSize: 18, fontWeight: '300' },

  // Caption overlay
  captionOverlay: {
    position: 'absolute', zIndex: 5,
    left: 24, right: 24, top: '38%',
    alignItems: 'center',
  },
  captionBubble: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10,
  },
  captionText: { color: '#fff', fontSize: 18, fontWeight: '600', textAlign: 'center', lineHeight: 26 },

  // Shared post card
  postCardWrap: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    zIndex: 6, alignItems: 'center', justifyContent: 'center',
  },
  postCard: {
    width: W * 0.82,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  postCardHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10, gap: 8,
    backgroundColor: '#fff',
  },
  postCardAvatar: { width: 30, height: 30, borderRadius: 15 },
  postCardAvatarFallback: { backgroundColor: '#E8E8E8', alignItems: 'center', justifyContent: 'center' },
  postCardAvatarLetter: { fontSize: 12, fontWeight: '700', color: '#555' },
  postCardAuthorName: { flex: 1, fontSize: 13, fontWeight: '600', color: '#111' },
  postCardEllipsis: { fontSize: 16, color: '#888', letterSpacing: 1 },
  postCardImage: { width: W * 0.82, height: W * 0.82 },
  postCardCaption: {
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E8E8E8',
  },
  postCardCaptionText: { fontSize: 13, color: '#111', lineHeight: 18 },
  seePostRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: 10,
  },
  seePostLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },

  // Tap zones
  tapRow: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 4, flexDirection: 'row' },

  // Owner bottom bar
  ownerBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    paddingBottom: Platform.OS === 'ios' ? 36 : 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  ownerStat: { color: '#fff', fontSize: 15, fontWeight: '700' },
  ownerDot: { color: 'rgba(255,255,255,0.4)', fontSize: 16, marginHorizontal: 6 },
  ownerLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 13, flex: 1 },
  ownerChevron: { color: 'rgba(255,255,255,0.5)', fontSize: 20 },

  // Viewer bottom bar
  viewerBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  likeBtn: { paddingHorizontal: 4 },
  replyInput: {
    flex: 1,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10,
    color: '#fff', fontSize: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnText: { fontSize: 18, fontWeight: '800' },
});
