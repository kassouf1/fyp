import React from 'react';
import { Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { typography, spacing, radius, shadows } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

const SIZES = {
  sm: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  md: { paddingVertical: spacing.md + 2, paddingHorizontal: spacing.lg },
  lg: { paddingVertical: spacing.lg - 2, paddingHorizontal: spacing.xl },
};
const TEXT_SIZES = {
  sm: typography.fontSizeSM,
  md: typography.fontSizeMD,
  lg: typography.fontSizeLG,
};

export const Button: React.FC<ButtonProps> = ({
  label, onPress, variant = 'primary', size = 'md',
  loading = false, disabled = false, style, textStyle, fullWidth = true,
}) => {
  const { themeColors: c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  const scale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const isDisabled = disabled || loading;

  const pressIn = () => { scale.value = withSpring(0.95, { damping: 18, stiffness: 400 }); };
  const pressOut = () => { scale.value = withSpring(1, { damping: 12, stiffness: 180 }); };

  const inner = loading
    ? <ActivityIndicator color={variant === 'primary' ? c.white : c.primary} size="small" />
    : <Text style={[
        variant === 'primary'  ? styles.tPrimary  :
        variant === 'outline'  ? styles.tOutline  :
        variant === 'ghost'    ? styles.tGhost    : styles.tSecondary,
        { fontSize: TEXT_SIZES[size] }, textStyle,
      ]}>{label}</Text>;

  return (
    <Animated.View style={[fullWidth && styles.fullWidth, scaleStyle, style]}>
      <Pressable
        onPress={onPress} onPressIn={pressIn} onPressOut={pressOut}
        disabled={isDisabled} style={{ opacity: isDisabled ? 0.45 : 1 }}
      >
        {variant === 'primary' && (
          <LinearGradient
            colors={[c.primaryLight, c.primary, c.primaryDark]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[styles.base, SIZES[size], styles.primaryShadow]}
          >{inner}</LinearGradient>
        )}
        {variant === 'outline' && (
          <Animated.View style={[styles.base, styles.outline, SIZES[size]]}>{inner}</Animated.View>
        )}
        {variant === 'ghost' && (
          <Animated.View style={[styles.ghost, SIZES[size]]}>{inner}</Animated.View>
        )}
        {variant === 'secondary' && (
          <Animated.View style={[styles.base, styles.secondary, SIZES[size]]}>{inner}</Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
};

const makeStyles = (c: any) => StyleSheet.create({
  fullWidth: { width: '100%' },
  base: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  primaryShadow: { borderRadius: radius.md, ...shadows.primary, shadowColor: c.primary },
  outline: { borderWidth: 1.5, borderColor: c.primary, backgroundColor: 'transparent' },
  secondary: { backgroundColor: c.surfaceElevated },
  ghost: { alignItems: 'center', justifyContent: 'center' },
  tPrimary: { color: c.white, fontWeight: typography.fontWeightBold, letterSpacing: 0.6 },
  tOutline: { color: c.primary, fontWeight: typography.fontWeightSemiBold, letterSpacing: 0.5 },
  tSecondary: { color: c.text, fontWeight: typography.fontWeightSemiBold },
  tGhost: { color: c.textSecondary, fontWeight: typography.fontWeightMedium, textAlign: 'center' },
});
