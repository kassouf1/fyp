import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Image, TextInput,
  TouchableOpacity, ActivityIndicator, KeyboardAvoidingView,
  Platform, StatusBar, TouchableWithoutFeedback,
  PanResponder, Animated as RNAnimated, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { createStory } from '../api/social';
import { typography, spacing, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';

type RouteParams = {
  imageUri: string;
  postId?: number;
  postAuthorName?: string;
  postAuthorAvatar?: string | null;
  postCaption?: string;
};

const { width: W, height: H } = Dimensions.get('window');
const FONT_SIZES = [14, 18, 22, 26, 32, 40];
const STORY_H    = Math.round(W * (16 / 9));
// Card is 82% of screen width; image inside is square (1:1)
const CARD_W     = Math.round(W * 0.82);

export const StoryCreateScreen: React.FC = () => {
  const navigation        = useNavigation<any>();
  const route             = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const { user }          = useAuth();
  const { themeColors: c } = useTheme();
  const { imageUri, postId, postAuthorName, postAuthorAvatar, postCaption } = route.params;

  const [caption, setCaption]         = useState('');
  const [editing, setEditing]         = useState(false);
  const [fontSizeIdx, setFontSizeIdx] = useState(2);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const inputRef = useRef<TextInput>(null);

  const pan     = useRef(new RNAnimated.ValueXY({ x: 0, y: 0 })).current;
  const lastPos = useRef({ x: 0, y: 0 });

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        !editing && (Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4),
      onPanResponderGrant: () => {
        pan.setOffset(lastPos.current);
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: RNAnimated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, g) => {
        lastPos.current = { x: lastPos.current.x + g.dx, y: lastPos.current.y + g.dy };
        pan.flattenOffset();
      },
    })
  ).current;

  const fontSize = FONT_SIZES[fontSizeIdx];

  const handleAaPress     = () => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 80); };
  const handleDoneEditing = () => { setEditing(false); inputRef.current?.blur(); };
  const increaseFontSize  = () => setFontSizeIdx(i => Math.min(i + 1, FONT_SIZES.length - 1));
  const decreaseFontSize  = () => setFontSizeIdx(i => Math.max(i - 1, 0));

  const handleShare = async () => {
    if (!user) return;
    setLoading(true); setError('');
    try {
      await createStory(
        user.userId, imageUri, caption.trim() || undefined,
        postId, postAuthorName, postAuthorAvatar, postCaption,
      );
      navigation.goBack();
    } catch (e: any) {
      setError(e.message || 'Failed to share story.');
      setLoading(false);
    }
  };

  const isPostStory = !!postId;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" hidden />

      {isPostStory ? (
        /* ── Post shared to story: gradient background + Instagram-style post card ── */
        <>
          {/* Soft blurred background */}
          <Image
            source={{ uri: imageUri }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
            blurRadius={30}
          />
          <LinearGradient
            colors={['rgba(10,10,20,0.72)', 'rgba(10,10,20,0.55)', 'rgba(10,10,20,0.72)']}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Centered post card */}
          <View style={styles.postCardWrap} pointerEvents="none">
            <View style={styles.postCard}>
              {/* Author row */}
              <View style={styles.postCardHeader}>
                {postAuthorAvatar
                  ? <Image source={{ uri: postAuthorAvatar }} style={styles.postCardAvatar} />
                  : (
                    <View style={[styles.postCardAvatar, styles.postCardAvatarFallback]}>
                      <Text style={styles.postCardAvatarLetter}>
                        {(postAuthorName ?? 'U')[0].toUpperCase()}
                      </Text>
                    </View>
                  )
                }
                <Text style={styles.postCardAuthorName} numberOfLines={1}>
                  {postAuthorName ?? 'Unknown'}
                </Text>
                <Text style={styles.postCardEllipsis}>···</Text>
              </View>

              {/* 1:1 image */}
              <Image
                source={{ uri: imageUri }}
                style={styles.postCardImage}
                resizeMode="cover"
              />

              {/* Caption */}
              {!!postCaption && (
                <View style={styles.postCardCaption}>
                  <Text style={styles.postCardCaptionText} numberOfLines={2}>
                    {postCaption}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </>
      ) : (
        /* ── Normal story: full-screen photo, 9:16 ── */
        <Image
          source={{ uri: imageUri }}
          style={{ position: 'absolute', width: W, height: Math.max(H, STORY_H), top: 0 }}
          resizeMode="cover"
        />
      )}

      {/* Draggable caption overlay */}
      {caption.length > 0 && !editing && (
        <View style={[StyleSheet.absoluteFillObject, styles.captionLayer]} pointerEvents="box-none">
          <RNAnimated.View
            style={[styles.captionAnchor, { transform: pan.getTranslateTransform() }]}
            {...panResponder.panHandlers}
          >
            <TouchableOpacity onPress={handleAaPress} activeOpacity={0.85}>
              <View style={styles.captionBubble}>
                <Text style={[styles.captionBubbleText, { fontSize }]}>{caption}</Text>
              </View>
            </TouchableOpacity>
          </RNAnimated.View>
        </View>
      )}

      {/* Editing overlay */}
      {editing && (
        <KeyboardAvoidingView
          style={StyleSheet.absoluteFillObject}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          pointerEvents="box-none"
        >
          <TouchableWithoutFeedback onPress={handleDoneEditing}>
            <View style={styles.editOverlay}>
              <TouchableWithoutFeedback>
                <View style={styles.editBox}>
                  <TextInput
                    ref={inputRef}
                    style={[styles.editInput, { fontSize }]}
                    value={caption}
                    onChangeText={setCaption}
                    multiline
                    maxLength={150}
                    placeholder="Type something…"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    returnKeyType="done"
                    blurOnSubmit
                    onSubmitEditing={handleDoneEditing}
                    textAlign="center"
                  />
                </View>
              </TouchableWithoutFeedback>
              <TouchableOpacity style={styles.doneBtn} onPress={handleDoneEditing}>
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      )}

      {/* Top toolbar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.circleBtn}>
          <Text style={styles.circleBtnText}>✕</Text>
        </TouchableOpacity>

        {caption.length > 0 && !editing && (
          <View style={styles.sizeRow}>
            <TouchableOpacity onPress={decreaseFontSize} style={[styles.circleBtn, styles.sizeBtn]} disabled={fontSizeIdx === 0}>
              <Text style={[styles.circleBtnText, { fontSize: 13 }]}>A−</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={increaseFontSize} style={[styles.circleBtn, styles.sizeBtn]} disabled={fontSizeIdx === FONT_SIZES.length - 1}>
              <Text style={[styles.circleBtnText, { fontSize: 16 }]}>A+</Text>
            </TouchableOpacity>
          </View>
        )}

        {!editing && (
          <TouchableOpacity onPress={handleAaPress} style={[styles.circleBtn, styles.aaBtn]}>
            <Text style={[styles.circleBtnText, styles.aaBtnText]}>Aa</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Bottom bar */}
      {!editing && (
        <View style={styles.bottomBar}>
          {!!error && <Text style={[styles.error, { color: c.error }]}>{error}</Text>}
          <TouchableOpacity
            style={[styles.shareBtn, { backgroundColor: c.primary }, loading && styles.shareBtnDisabled]}
            onPress={handleShare}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={c.white} size="small" />
              : <Text style={[styles.shareBtnText, { color: c.white }]}>Share to Story  →</Text>
            }
          </TouchableOpacity>
          <Text style={styles.disclaimer}>Disappears after 24 hours</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },

  // ── Post card (centered on story canvas) ─────────────────────────────────────
  postCardWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postCard: {
    width: CARD_W,
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#fff',
  },
  postCardAvatar: { width: 30, height: 30, borderRadius: 15 },
  postCardAvatarFallback: { backgroundColor: '#E8E8E8', alignItems: 'center', justifyContent: 'center' },
  postCardAvatarLetter: { fontSize: 12, fontWeight: '700', color: '#555' },
  postCardAuthorName: { flex: 1, fontSize: 13, fontWeight: '600', color: '#111' },
  postCardEllipsis: { fontSize: 16, color: '#888', letterSpacing: 1 },
  postCardImage: { width: CARD_W, height: CARD_W },
  postCardCaption: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E8E8E8' },
  postCardCaptionText: { fontSize: 13, color: '#111', lineHeight: 18 },

  // ── Caption overlay ───────────────────────────────────────────────────────────
  captionLayer: { alignItems: 'center', justifyContent: 'center' },
  captionAnchor: {},
  captionBubble: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10, maxWidth: W - 48,
  },
  captionBubbleText: { color: '#fff', fontWeight: '700', textAlign: 'center' },

  // ── Editing overlay ───────────────────────────────────────────────────────────
  editOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  editBox: { width: W * 0.82, backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: radius.lg, padding: spacing.lg },
  editInput: { color: '#fff', fontWeight: '700', textAlign: 'center', minHeight: 56, maxHeight: 130 },
  doneBtn: {
    position: 'absolute', top: Platform.OS === 'ios' ? 62 : 38, right: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 8,
  },
  doneBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // ── Top toolbar ───────────────────────────────────────────────────────────────
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 32,
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
  },
  circleBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  circleBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  sizeRow: { flexDirection: 'row', gap: 8, flex: 1, justifyContent: 'center' },
  sizeBtn: { backgroundColor: 'rgba(255,255,255,0.15)' },
  aaBtn: { backgroundColor: 'rgba(0,0,0,0.5)' },
  aaBtnText: { fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },

  // ── Bottom bar ────────────────────────────────────────────────────────────────
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: spacing.md, gap: spacing.sm,
  },
  error: { fontSize: typography.fontSizeSM, textAlign: 'center' },
  shareBtn: {
    borderRadius: radius.md, paddingVertical: 14, alignItems: 'center',
  },
  shareBtnDisabled: { opacity: 0.6 },
  shareBtnText: { fontSize: typography.fontSizeMD, fontWeight: typography.fontWeightBold },
  disclaimer: { color: 'rgba(255,255,255,0.5)', fontSize: typography.fontSizeXS, textAlign: 'center' },
});
