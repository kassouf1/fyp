import React, { useState } from 'react';
import {
  Modal, View, Text, Image, TouchableOpacity, ActivityIndicator,
  StyleSheet, Pressable, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { findSimilarGarment, SimilarGarmentMatch } from '../api/outfit';
import { useTheme } from '../context/ThemeContext';
import { typography, spacing, radius } from '../theme';

// Shared by every "Try On" button placed on someone else's post (Discover
// grid, Feed, PostViewer): instead of feeding the raw post photo straight
// into try-on, search the garment catalog for the closest-looking item and
// let the user pick one — CatVTON works far better against a clean product
// photo than against another photo of a person wearing it. Falls back to
// the original photo if nothing close enough is found.
export function useSimilarGarmentPicker() {
  const navigation = useNavigation<any>();
  const { themeColors: c } = useTheme();

  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<SimilarGarmentMatch[]>([]);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);

  const openPicker = async (imageUrl: string) => {
    setSourceUrl(imageUrl);
    setVisible(true);
    setLoading(true);
    setMatches([]);
    try {
      const results = await findSimilarGarment(imageUrl, 'top');
      setMatches(results);
    } catch {
      setMatches([]);
    } finally {
      setLoading(false);
    }
  };

  const pick = (m: SimilarGarmentMatch) => {
    setVisible(false);
    navigation.navigate('TryOn', { clothesImageUrl: m.imageUrl, topId: m.id, topTitle: m.title });
  };

  const useOriginalPhoto = () => {
    setVisible(false);
    if (sourceUrl) navigation.navigate('TryOn', { clothesImageUrl: sourceUrl });
  };

  const Picker = (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => setVisible(false)}>
      <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
        <Pressable style={[styles.sheet, { backgroundColor: c.background }]} onPress={() => {}}>
          <View style={[styles.handle, { backgroundColor: c.border }]} />
          <Text style={[styles.title, { color: c.text }]}>Find this in our catalog</Text>
          <Text style={[styles.subtitle, { color: c.textMuted }]}>
            Try-on works best with a clean product photo — pick the closest match
          </Text>

          {loading ? (
            <ActivityIndicator color={c.primary} style={{ marginVertical: spacing.xl }} />
          ) : matches.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {matches.map(m => (
                <TouchableOpacity key={m.id} style={styles.matchCard} onPress={() => pick(m)} activeOpacity={0.85}>
                  <Image source={{ uri: m.imageUrl }} style={[styles.matchImage, { backgroundColor: c.surfaceElevated }]} resizeMode="cover" />
                  <Text style={[styles.matchTitle, { color: c.text }]} numberOfLines={2}>{m.title}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <Text style={[styles.empty, { color: c.textMuted }]}>No close catalog match found.</Text>
          )}

          <TouchableOpacity onPress={useOriginalPhoto} style={styles.fallbackBtn}>
            <Text style={[styles.fallbackText, { color: c.primary }]}>Use the original photo instead</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );

  return { openPicker, Picker };
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xl },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  title: { fontSize: typography.fontSizeLG, fontWeight: typography.fontWeightBold },
  subtitle: { fontSize: typography.fontSizeSM, marginTop: 4, marginBottom: spacing.md },
  row: { gap: spacing.md, paddingVertical: spacing.sm },
  matchCard: { width: 120 },
  matchImage: { width: 120, height: 150, borderRadius: radius.lg, marginBottom: 6 },
  matchTitle: { fontSize: typography.fontSizeXS, fontWeight: typography.fontWeightMedium },
  empty: { fontSize: typography.fontSizeSM, textAlign: 'center', paddingVertical: spacing.lg },
  fallbackBtn: { marginTop: spacing.md, alignItems: 'center', paddingVertical: spacing.sm },
  fallbackText: { fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightSemiBold },
});
