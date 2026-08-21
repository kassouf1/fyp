import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Image, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView,
  ActivityIndicator, Modal, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { createPost, searchUsers, UserCard } from '../api/social';
import { typography, spacing, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';

type RouteParams = { imageUri: string };

export const CreatePostScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route      = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const { user }   = useAuth();
  const { themeColors: c } = useTheme();
  const { imageUri } = route.params;

  const [caption, setCaption]       = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  // Tag people state
  const [tagModalVisible, setTagModalVisible] = useState(false);
  const [tagQuery, setTagQuery]               = useState('');
  const [tagResults, setTagResults]           = useState<UserCard[]>([]);
  const [tagSearching, setTagSearching]       = useState(false);
  const [taggedUsers, setTaggedUsers]         = useState<UserCard[]>([]);

  const handleShare = async () => {
    if (!user) return;
    setLoading(true); setError('');
    try {
      await createPost(user.userId, imageUri, caption.trim(), taggedUsers.map(u => u.userId));
      navigation.goBack();
    } catch (e: any) {
      setError(e.message || 'Failed to share post.');
    } finally { setLoading(false); }
  };

  const handleTagSearch = useCallback(async (q: string) => {
    setTagQuery(q);
    if (!q.trim() || !user) { setTagResults([]); return; }
    setTagSearching(true);
    try {
      const results = await searchUsers(q.trim(), user.userId);
      setTagResults(results.filter(r => r.userId !== user.userId));
    } catch {
      setTagResults([]);
    } finally { setTagSearching(false); }
  }, [user]);

  const toggleTag = (u: UserCard) => {
    setTaggedUsers(prev =>
      prev.some(t => t.userId === u.userId)
        ? prev.filter(t => t.userId !== u.userId)
        : [...prev, u]
    );
  };

  const removeTag = (userId: number) =>
    setTaggedUsers(prev => prev.filter(t => t.userId !== userId));

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.container, { backgroundColor: c.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelBtn}>
            <Text style={[styles.cancelText, { color: c.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: c.text }]}>New Post</Text>
          <TouchableOpacity onPress={handleShare} disabled={loading} style={styles.shareBtn}>
            {loading
              ? <ActivityIndicator color={c.primary} size="small" />
              : <Text style={[styles.shareText, { color: c.primary }]}>Share</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Image source={{ uri: imageUri }} style={[styles.preview, { backgroundColor: c.surfaceElevated }]} resizeMode="cover" />

          {/* Caption */}
          <View style={styles.captionRow}>
            <TextInput
              style={[styles.captionInput, { color: c.text }]}
              placeholder="Write a caption…"
              placeholderTextColor={c.textMuted}
              value={caption}
              onChangeText={setCaption}
              multiline
              maxLength={300}
              autoFocus
            />
            <Text style={[styles.charCount, { color: c.textMuted }]}>{caption.length}/300</Text>
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: c.border }]} />

          {/* Tag people row */}
          <TouchableOpacity style={styles.actionRow} onPress={() => setTagModalVisible(true)} activeOpacity={0.7}>
            <Ionicons name="pricetag-outline" size={18} color={c.primary} />
            <Text style={[styles.actionLabel, { color: c.text }]}>Tag people</Text>
            {taggedUsers.length > 0
              ? <Text style={[styles.actionValue, { color: c.primary }]}>{taggedUsers.map(u => `@${u.username ?? u.fullName}`).join(', ')}</Text>
              : <Text style={[styles.actionPlaceholder, { color: c.textMuted }]}>None</Text>
            }
            <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
          </TouchableOpacity>

          {/* Tagged chips */}
          {taggedUsers.length > 0 && (
            <View style={styles.chipsRow}>
              {taggedUsers.map(u => (
                <TouchableOpacity key={u.userId} style={[styles.chip, { backgroundColor: c.surfaceElevated, borderColor: c.primary + '60' }]} onPress={() => removeTag(u.userId)} activeOpacity={0.75}>
                  <Text style={[styles.chipText, { color: c.primary }]}>@{u.username ?? u.fullName}</Text>
                  <Ionicons name="close" size={11} color={c.textMuted} style={{ marginLeft: 3 }} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {!!error && <Text style={[styles.error, { color: c.error }]}>{error}</Text>}
        </ScrollView>
      </View>

      {/* Tag people modal */}
      <Modal visible={tagModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setTagModalVisible(false)}>
        <View style={[styles.modalContainer, { backgroundColor: c.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: c.border }]}>
            <TouchableOpacity onPress={() => setTagModalVisible(false)}>
              <Text style={[styles.modalDone, { color: c.primary }]}>Done</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: c.text }]}>Tag People</Text>
            <View style={{ width: 48 }} />
          </View>

          <View style={[styles.searchBar, { backgroundColor: c.surfaceElevated }]}>
            <Ionicons name="search" size={16} color={c.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: c.text }]}
              placeholder="Search by name or username…"
              placeholderTextColor={c.textMuted}
              value={tagQuery}
              onChangeText={handleTagSearch}
              autoFocus
              autoCapitalize="none"
            />
            {tagSearching && <ActivityIndicator size="small" color={c.textMuted} />}
          </View>

          <FlatList
            data={tagResults}
            keyExtractor={item => String(item.userId)}
            renderItem={({ item }) => {
              const isSelected = taggedUsers.some(t => t.userId === item.userId);
              return (
                <TouchableOpacity style={[styles.userRow, { borderBottomColor: c.border + '40' }]} onPress={() => toggleTag(item)} activeOpacity={0.75}>
                  <View style={[styles.avatarPlaceholder, { backgroundColor: c.surfaceElevated }]}>
                    <Text style={[styles.avatarText, { color: c.textMuted }]}>
                      {(item.fullName?.[0] ?? '?').toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={[styles.userFullName, { color: c.text }]}>{item.fullName}</Text>
                    {item.username ? <Text style={[styles.userUsername, { color: c.textMuted }]}>@{item.username}</Text> : null}
                  </View>
                  <View style={[styles.checkbox, { borderColor: c.border }, isSelected && { backgroundColor: c.primary, borderColor: c.primary }]}>
                    {isSelected && <Ionicons name="checkmark" size={13} color={c.white} />}
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              tagQuery.trim().length > 0 && !tagSearching
                ? <Text style={[styles.emptyText, { color: c.textMuted }]}>No users found</Text>
                : null
            }
            keyboardShouldPersistTaps="handled"
          />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: 52, paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  cancelBtn: { padding: 4 },
  cancelText: { fontSize: typography.fontSizeMD },
  title: { fontSize: typography.fontSizeLG, fontWeight: typography.fontWeightBold },
  shareBtn: { padding: 4 },
  shareText: { fontSize: typography.fontSizeMD, fontWeight: typography.fontWeightBold },

  preview: { width: '100%', height: 360 },

  captionRow: { padding: spacing.lg },
  captionInput: {
    fontSize: typography.fontSizeMD,
    minHeight: 80, textAlignVertical: 'top',
  },
  charCount: { fontSize: typography.fontSizeXS, textAlign: 'right' },

  divider: { height: 1, marginHorizontal: spacing.lg },

  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: 14,
  },
  actionLabel: { fontSize: typography.fontSizeMD, fontWeight: typography.fontWeightMedium },
  actionValue: { flex: 1, textAlign: 'right', fontSize: typography.fontSizeSM },
  actionPlaceholder: { flex: 1, textAlign: 'right', fontSize: typography.fontSizeSM },

  chipsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs,
    paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1,
  },
  chipText: { fontSize: typography.fontSizeXS, fontWeight: typography.fontWeightMedium },

  error: { fontSize: typography.fontSizeSM, marginHorizontal: spacing.lg, marginTop: spacing.sm },

  // Modal
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: 16, paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  modalDone: { fontSize: typography.fontSizeMD, fontWeight: typography.fontWeightSemiBold },
  modalTitle: { fontSize: typography.fontSizeLG, fontWeight: typography.fontWeightBold },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderRadius: radius.md,
    margin: spacing.lg, paddingHorizontal: spacing.md, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: typography.fontSizeMD },

  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  avatarPlaceholder: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: typography.fontSizeLG, fontWeight: typography.fontWeightBold },
  userInfo: { flex: 1 },
  userFullName: { fontSize: typography.fontSizeMD, fontWeight: typography.fontWeightMedium },
  userUsername: { fontSize: typography.fontSizeSM, marginTop: 2 },
  checkbox: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyText: { fontSize: typography.fontSizeMD, textAlign: 'center', marginTop: spacing.xl },
});
