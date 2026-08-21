export const darkColors = {
  background: '#0B0D14',
  surface: '#12141C',
  surfaceElevated: '#1A1E29',
  border: '#242836',
  borderLight: '#2E3341',

  primary: '#5B6EF5',
  primaryLight: '#8B98FF',
  primaryDark: '#3D4ED1',

  accent: '#2DD4BF',
  accentLight: '#5EEAD4',

  text: '#F5F6FA',
  textSecondary: '#9CA3B5',
  textMuted: '#6B7280',

  success: '#34D399',
  error: '#EF4444',
  warning: '#F5A623',

  white: '#FFFFFF',
  black: '#000000',
};

export const lightColors = {
  background: '#FFFFFF',
  surface: '#F6F7FA',
  surfaceElevated: '#FFFFFF',
  border: '#E3E6EC',
  borderLight: '#EDEFF3',

  primary: '#4C5FE0',
  primaryLight: '#7C89F0',
  primaryDark: '#3542B8',

  accent: '#0EA895',
  accentLight: '#2DD4BF',

  text: '#12141C',
  textSecondary: '#565C6D',
  textMuted: '#8A90A0',

  success: '#16A472',
  error: '#DC3545',
  warning: '#C97F0E',

  white: '#FFFFFF',
  black: '#000000',
};

export const getColors = (isDark: boolean) => isDark ? darkColors : lightColors;

export const colors = darkColors;

export const typography = {
  fontSizeXS: 11,
  fontSizeSM: 13,
  fontSizeMD: 15,
  fontSizeLG: 17,
  fontSizeXL: 20,
  fontSize2XL: 24,
  fontSize3XL: 30,
  fontSize4XL: 36,

  fontWeightLight: '300' as const,
  fontWeightRegular: '400' as const,
  fontWeightMedium: '500' as const,
  fontWeightSemiBold: '600' as const,
  fontWeightBold: '700' as const,
  fontWeightExtraBold: '800' as const,

  lineHeightTight: 1.2,
  lineHeightNormal: 1.5,
  lineHeightRelaxed: 1.8,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  primary: {
    shadowColor: '#5B6EF5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
};
