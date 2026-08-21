import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { typography, spacing, radius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

export type BadgeVariant = 'primary' | 'accent' | 'success' | 'error' | 'warning' | 'muted';
export type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  uppercase?: boolean;
}

const makeVariants = (colors: any): Record<BadgeVariant, { bg: string; border: string; text: string; dot: string }> => ({
  primary: { bg: colors.primary + '14', border: colors.primary + '45', text: colors.primary,       dot: colors.primary },
  accent:  { bg: colors.accent  + '14', border: colors.accent  + '45', text: colors.accentLight,   dot: colors.accent },
  success: { bg: colors.success + '14', border: colors.success + '40', text: colors.success,        dot: colors.success },
  error:   { bg: colors.error   + '14', border: colors.error   + '40', text: colors.error,          dot: colors.error },
  warning: { bg: colors.warning + '14', border: colors.warning + '40', text: colors.warning,        dot: colors.warning },
  muted:   { bg: colors.surfaceElevated, border: colors.border,        text: colors.textSecondary,  dot: colors.textMuted },
});

export const Badge: React.FC<BadgeProps> = ({
  label, variant = 'muted', size = 'sm', dot = false, uppercase = true,
}) => {
  const { themeColors } = useTheme();
  const VARIANTS = React.useMemo(() => makeVariants(themeColors), [themeColors]);
  const v = VARIANTS[variant];
  const isSmall = size === 'sm';
  return (
    <View style={[
      styles.base,
      { backgroundColor: v.bg, borderColor: v.border },
      isSmall ? styles.sm : styles.md,
    ]}>
      {dot && <View style={[styles.dot, { backgroundColor: v.dot }]} />}
      <Text style={[
        styles.label,
        { color: v.text },
        isSmall ? styles.textSm : styles.textMd,
        uppercase && styles.uppercase,
      ]}>
        {label}
      </Text>
    </View>
  );
};

// Small themed icon box — used in menus / feature cards
interface IconBoxProps {
  symbol?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: BadgeVariant;
  size?: number;
}

export const IconBox: React.FC<IconBoxProps> = ({ symbol, icon, variant = 'primary', size = 40 }) => {
  const { themeColors } = useTheme();
  const VARIANTS = React.useMemo(() => makeVariants(themeColors), [themeColors]);
  const v = VARIANTS[variant];
  return (
    <View style={[
      styles.iconBox,
      { width: size, height: size, borderRadius: size * 0.28, backgroundColor: v.bg, borderColor: v.border },
    ]}>
      {icon
        ? <Ionicons name={icon} size={size * 0.46} color={v.text} />
        : <Text style={[styles.iconSymbol, { color: v.text, fontSize: size * 0.42 }]}>{symbol}</Text>
      }
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: radius.full, alignSelf: 'flex-start',
  },
  sm: { paddingVertical: 3, paddingHorizontal: spacing.sm, gap: 5 },
  md: { paddingVertical: 5, paddingHorizontal: spacing.md, gap: 6 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  label: { fontWeight: typography.fontWeightBold, letterSpacing: 0.6 },
  textSm: { fontSize: typography.fontSizeXS },
  textMd: { fontSize: typography.fontSizeSM },
  uppercase: { textTransform: 'uppercase' },

  iconBox: {
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  iconSymbol: { fontWeight: typography.fontWeightBold, lineHeight: undefined },
});
