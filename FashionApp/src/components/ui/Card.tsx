import React from 'react';
import { StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { radius, spacing, shadows } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  elevated?: boolean;
  accent?: boolean;
  delay?: number;
  noAnimation?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children, style, elevated, accent, delay = 0, noAnimation = false,
}) => {
  const { themeColors: c } = useTheme();
  const styles = React.useMemo(() => makeStyles(c), [c]);
  return (
    <Animated.View
      entering={noAnimation ? undefined : FadeInDown.delay(delay).duration(420).springify()}
      style={[
        styles.card,
        elevated && styles.elevated,
        accent && styles.accent,
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
};

const makeStyles = (c: any) => StyleSheet.create({
  card: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: c.border,
  },
  elevated: {
    backgroundColor: c.surfaceElevated,
    ...shadows.md,
  },
  accent: {
    borderColor: c.primary,
    borderWidth: 1.5,
  },
});
