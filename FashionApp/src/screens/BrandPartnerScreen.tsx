import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge, IconBox } from '../components/ui/Badge';
import { typography, spacing, radius } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { applyBrandPartner, resyncBrandPartner, BrandPartnerResult } from '../api/brandPartner';

const EXAMPLE_JSON = `[
  {
    "id": "z-10234",
    "title": "Zara Oversized Cotton Shirt",
    "price": 39.90,
    "imageUrl": "https://static.zara.net/.../shirt.jpg",
    "category": "top",
    "gender": "men",
    "color": "white"
  }
]`;

type Props = { navigation: any };

export const BrandPartnerScreen: React.FC<Props> = ({ navigation }) => {
  const { themeColors: c } = useTheme();

  const [brandName, setBrandName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [category, setCategory] = useState('');
  const [showSpec, setShowSpec] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BrandPartnerResult | null>(null);

  const canSubmit = brandName.trim() && contactEmail.trim() && apiBaseUrl.trim();

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await applyBrandPartner({
        brandName: brandName.trim(),
        contactEmail: contactEmail.trim(),
        apiBaseUrl: apiBaseUrl.trim(),
        apiKey: apiKey.trim() || undefined,
        category: category.trim() || undefined,
      });
      setResult(res);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not submit your application.');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async () => {
    if (!result) return;
    setLoading(true);
    try {
      const res = await resyncBrandPartner(result.id);
      setResult(res);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Retry failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={c.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: c.text }]}>Brand Partner API</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Animated.View entering={FadeInDown.duration(380)}>
          <Badge label="FOR BRANDS" variant="primary" />
          <Text style={[styles.title, { color: c.text }]}>List your catalog on SmartFashion</Text>
          <Text style={[styles.subtitle, { color: c.textSecondary }]}>
            Connect your product API and your items appear in Brand Shop — ready for
            customers to browse and virtually try on — automatically.
          </Text>
        </Animated.View>

        <Card style={{ marginTop: spacing.lg }} delay={60}>
          <Input label="Brand Name" value={brandName} onChangeText={setBrandName} placeholder="e.g. Zara" />
          <Input label="Contact Email" value={contactEmail} onChangeText={setContactEmail}
            placeholder="partnerships@brand.com" autoCapitalize="none" keyboardType="email-address" />
          <Input label="Catalog API URL" value={apiBaseUrl} onChangeText={setApiBaseUrl}
            placeholder="https://api.yourbrand.com/products" autoCapitalize="none" keyboardType="url"
            hint="We'll send a GET request here and expect your product catalog back as JSON." />
          <Input label="API Key (optional)" value={apiKey} onChangeText={setApiKey}
            placeholder="Sent as X-Api-Key and Authorization: Bearer" autoCapitalize="none" secureTextEntry />
          <Input label="Category (optional)" value={category} onChangeText={setCategory}
            placeholder="e.g. Fast fashion, Streetwear, Formal wear" />

          <TouchableOpacity onPress={() => setShowSpec(v => !v)} style={styles.specToggle}>
            <Ionicons name={showSpec ? 'chevron-up' : 'chevron-down'} size={16} color={c.primary} />
            <Text style={[styles.specToggleText, { color: c.primary }]}>
              {showSpec ? 'Hide expected JSON format' : 'View expected JSON format'}
            </Text>
          </TouchableOpacity>

          {showSpec && (
            <View style={[styles.specBox, { backgroundColor: c.background, borderColor: c.border }]}>
              <Text style={[styles.specText, { color: c.textSecondary }]}>{EXAMPLE_JSON}</Text>
              <Text style={[styles.specNote, { color: c.textMuted }]}>
                A raw array or a {'{ products: [...] }'} / {'{ items: [...] }'} / {'{ data: [...] }'} wrapper both
                work. Only title and imageUrl are required — price, category, gender and color are optional.
              </Text>
            </View>
          )}

          <Button
            label={loading ? 'Connecting…' : 'Connect & Import Catalog'}
            onPress={handleSubmit}
            disabled={!canSubmit || loading}
            loading={loading}
            style={{ marginTop: spacing.md }}
          />
        </Card>

        {result && (
          <Animated.View entering={FadeInDown.duration(320)}>
            <Card
              style={{ marginTop: spacing.md }}
              accent={result.status === 'Active'}
            >
              <View style={styles.resultHeader}>
                <IconBox
                  icon={result.status === 'Active' ? 'checkmark-circle' : result.status === 'Failed' ? 'close-circle' : 'time'}
                  variant={result.status === 'Active' ? 'success' : result.status === 'Failed' ? 'error' : 'warning'}
                  size={36}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.resultTitle, { color: c.text }]}>
                    {result.status === 'Active' ? `Connected to ${result.brandName}`
                      : result.status === 'Failed' ? 'Connection failed'
                      : 'Connecting…'}
                  </Text>
                  {result.status === 'Active' && (
                    <Text style={[styles.resultSub, { color: c.textSecondary }]}>
                      Imported {result.productCount} product{result.productCount === 1 ? '' : 's'} — now live in Brand Shop.
                    </Text>
                  )}
                  {result.status === 'Failed' && (
                    <Text style={[styles.resultSub, { color: c.error }]}>{result.lastError}</Text>
                  )}
                </View>
              </View>

              {result.status === 'Active' ? (
                <Button
                  label="View in Brand Shop"
                  variant="outline"
                  onPress={() => navigation.navigate('BrandShop')}
                  style={{ marginTop: spacing.md }}
                />
              ) : result.status === 'Failed' ? (
                <Button
                  label={loading ? 'Retrying…' : 'Retry Connection'}
                  variant="outline"
                  onPress={handleRetry}
                  loading={loading}
                  style={{ marginTop: spacing.md }}
                />
              ) : null}
            </Card>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: 52, paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 40, padding: 4 },
  headerTitle: { fontSize: typography.fontSizeLG, fontWeight: typography.fontWeightBold },

  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { fontSize: typography.fontSize2XL, fontWeight: typography.fontWeightBold, marginTop: spacing.sm },
  subtitle: { fontSize: typography.fontSizeSM, lineHeight: 20, marginTop: spacing.xs },

  specToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.xs, marginBottom: spacing.xs },
  specToggleText: { fontSize: typography.fontSizeSM, fontWeight: typography.fontWeightSemiBold },
  specBox: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  specText: { fontFamily: 'monospace', fontSize: typography.fontSizeXS, lineHeight: 18 },
  specNote: { fontSize: typography.fontSizeXS, lineHeight: 16, marginTop: spacing.sm },

  resultHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  resultTitle: { fontSize: typography.fontSizeMD, fontWeight: typography.fontWeightBold },
  resultSub: { fontSize: typography.fontSizeSM, marginTop: 4, lineHeight: 19 },
});
