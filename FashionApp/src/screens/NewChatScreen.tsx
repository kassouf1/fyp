import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getFriends, UserCard } from '../api/social';
import { typography, spacing, radius } from '../theme';

const Avatar: React.FC<{ uri?: string | null; name: string; size?: number }> = ({ uri, name, size = 46 }) => {
  const { themeColors: c } = useTheme();
  return uri
    ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
    : <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.surfaceElevated, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: c.primary, fontWeight: '700', fontSize: size * 0.38 }}>{name?.[0]?.toUpperCase()}</Text>
      </View>;
};

// You can only start a new conversation with a friend (a mutual follow) —
// this keeps DMs to people who already follow each other both ways, rather
// than opening messaging up to anyone searchable in Discover.
export const NewChatScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const { themeColors: c } = useTheme();

  const [friends, setFriends]   = useState<UserCard[]>([]);
  const [query, setQuery]       = useState('');
  const [loading, setLoading]   = useState(true);

  useFocusEffect(useCallback(() => {
    if (!user) return;
    setLoading(true);
    getFriends(user.userId, user.userId).then(setFriends).finally(() => setLoading(false));
  }, [user?.userId]));

  const filtered = query.trim()
    ? friends.filter(f =>
        f.fullName.toLowerCase().includes(query.trim().toLowerCase()) ||
        f.username?.toLowerCase().includes(query.trim().toLowerCase()))
    : friends;

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={c.text} />
        </TouchableOpacity>
        <View>
          <Text style={[styles.title, { color: c.text }]}>New Message</Text>
          <Text style={[styles.subtitle, { color: c.textMuted }]}>You can message friends you follow each other with</Text>
        </View>
      </View>

      <View style={[styles.searchBar, { backgroundColor: c.surfaceElevated }]}>
        <Ionicons name="search" size={16} color={c.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: c.text }]}
          placeholder="Search friends…"
          placeholderTextColor={c.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
      </View>

      {loading
        ? <ActivityIndicator color={c.primary} style={{ marginTop: 40 }} />
        : (
          <FlatList
            data={filtered}
            keyExtractor={u => String(u.userId)}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.userRow, { borderBottomColor: c.border + '40' }]}
                onPress={() => navigation.navigate('Chat', {
                  partnerId: item.userId,
                  partnerName: item.fullName,
                  partnerAvatar: item.avatarUrl,
                })}
                activeOpacity={0.75}
              >
                <Avatar uri={item.avatarUrl} name={item.fullName} />
                <View style={styles.userInfo}>
                  <Text style={[styles.userName, { color: c.text }]}>{item.fullName}</Text>
                  {item.username ? <Text style={[styles.userHandle, { color: c.textMuted }]}>@{item.username}</Text> : null}
                </View>
                <Ionicons name="chatbubble-outline" size={18} color={c.textMuted} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="people-outline" size={40} color={c.textMuted} />
                <Text style={[styles.emptyText, { color: c.text }]}>
                  {query.trim() ? 'No friends match that search' : 'No friends yet'}
                </Text>
                {!query.trim() && (
                  <>
                    <Text style={[styles.emptySubtext, { color: c.textMuted }]}>
                      Friends are people who follow you back. Follow someone and have them follow you to start chatting.
                    </Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Discover')} style={{ marginTop: spacing.md }}>
                      <Text style={[styles.emptyAction, { color: c.primary }]}>Find People to Follow</Text>
                    </TouchableOpacity>
                  </>
                )}
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
  title: { fontSize: typography.fontSizeLG, fontWeight: typography.fontWeightBold },
  subtitle: { fontSize: typography.fontSizeXS, marginTop: 2, maxWidth: 260 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: radius.lg,
    marginHorizontal: spacing.lg, paddingHorizontal: spacing.md,
    paddingVertical: 10, marginTop: spacing.md, marginBottom: spacing.sm,
  },
  searchInput: { flex: 1, fontSize: typography.fontSizeMD },

  listContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 100 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 10, borderBottomWidth: 1 },
  userInfo: { flex: 1 },
  userName: { fontSize: typography.fontSizeMD, fontWeight: typography.fontWeightSemiBold },
  userHandle: { fontSize: typography.fontSizeXS, marginTop: 2 },

  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: spacing.xl, gap: spacing.sm },
  emptyText: { fontSize: typography.fontSizeMD, fontWeight: typography.fontWeightSemiBold },
  emptySubtext: { fontSize: typography.fontSizeSM, textAlign: 'center', lineHeight: 20 },
  emptyAction: { fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightSemiBold },
});
