import React, { useState } from 'react';
import {
  View, TextInput, Text, StyleSheet,
  TouchableOpacity, TextInputProps, ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, interpolateColor,
} from 'react-native-reanimated';
import { typography, spacing, radius } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
}

export const Input: React.FC<InputProps> = ({
  label, error, hint, leftIcon, rightIcon, onRightIconPress,
  containerStyle, style, ...props
}) => {
  const { themeColors: colors } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [focused, setFocused] = useState(false);
  const focus = useSharedValue(0);
  const glowOpacity = useSharedValue(0);

  const borderStyle = useAnimatedStyle(() => {
    const borderColor = interpolateColor(
      focus.value,
      [0, 1],
      [error ? colors.error : colors.border, error ? colors.error : colors.primary],
    );
    return { borderColor };
  });

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const handleFocus = () => {
    setFocused(true);
    focus.value = withTiming(1, { duration: 200 });
    glowOpacity.value = withTiming(1, { duration: 250 });
    props.onFocus?.({} as any);
  };
  const handleBlur = () => {
    setFocused(false);
    focus.value = withTiming(0, { duration: 200 });
    glowOpacity.value = withTiming(0, { duration: 250 });
    props.onBlur?.({} as any);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.wrapper}>
        {/* Focus glow ring behind the input */}
        <Animated.View style={[styles.glow, glowStyle]} />
        <Animated.View style={[styles.inputWrapper, borderStyle]}>
          {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
          <TextInput
            style={[styles.input, leftIcon ? styles.inputWithLeft : null, style]}
            placeholderTextColor={colors.textMuted}
            onFocus={handleFocus}
            onBlur={handleBlur}
            selectionColor={colors.primary}
            {...props}
          />
          {rightIcon && (
            <TouchableOpacity style={styles.iconRight} onPress={onRightIconPress} activeOpacity={0.7}>
              {rightIcon}
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>
      {error
        ? <Text style={styles.error}>{error}</Text>
        : hint
        ? <Text style={styles.hint}>{hint}</Text>
        : null}
    </View>
  );
};

const makeStyles = (colors: any) => StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: {
    color: colors.textSecondary,
    fontSize: typography.fontSizeSM,
    fontWeight: typography.fontWeightSemiBold,
    marginBottom: spacing.xs,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  wrapper: { position: 'relative' },
  glow: {
    position: 'absolute',
    inset: -3,
    borderRadius: radius.md + 4,
    borderWidth: 1,
    borderColor: colors.primary + '30',
    backgroundColor: 'transparent',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderRadius: radius.md,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: typography.fontSizeMD,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    fontWeight: typography.fontWeightRegular,
  },
  inputWithLeft: { paddingLeft: spacing.xs },
  iconLeft: { paddingLeft: spacing.md },
  iconRight: { paddingRight: spacing.md },
  error: { color: colors.error, fontSize: typography.fontSizeXS, marginTop: spacing.xs, marginLeft: spacing.xs },
  hint: { color: colors.textMuted, fontSize: typography.fontSizeXS, marginTop: spacing.xs, marginLeft: spacing.xs },
});
