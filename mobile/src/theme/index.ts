import { useColorScheme } from 'react-native';

export interface ColorTokens {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  onPrimary: string;
  danger: string;
  dangerSurface: string;
  warning: string;
  warningSurface: string;
  success: string;
  successSurface: string;
  /** Filled heart / active like. */
  like: string;
  /** Overlay behind images while they load. */
  placeholder: string;
}

const light: ColorTokens = {
  background: '#FFFFFF',
  surface: '#F3F4F6',
  text: '#111827',
  textMuted: '#4B5563',
  border: '#D1D5DB',
  primary: '#2563EB',
  onPrimary: '#FFFFFF',
  danger: '#B91C1C',
  dangerSurface: '#FEE2E2',
  warning: '#92400E',
  warningSurface: '#FEF3C7',
  success: '#166534',
  successSurface: '#DCFCE7',
  like: '#E11D48',
  placeholder: '#E5E7EB',
};

const dark: ColorTokens = {
  background: '#0B0F17',
  surface: '#1F2937',
  text: '#F9FAFB',
  textMuted: '#9CA3AF',
  border: '#374151',
  primary: '#60A5FA',
  onPrimary: '#0B0F17',
  danger: '#FCA5A5',
  dangerSurface: '#450A0A',
  warning: '#FCD34D',
  warningSurface: '#422006',
  success: '#86EFAC',
  successSurface: '#052E16',
  like: '#FB7185',
  placeholder: '#273244',
};

export const colors = { light, dark } as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const;

export const typography = {
  title: { fontSize: 28, fontWeight: '700' },
  heading: { fontSize: 20, fontWeight: '600' },
  body: { fontSize: 16, fontWeight: '400' },
  label: { fontSize: 14, fontWeight: '600' },
  caption: { fontSize: 13, fontWeight: '400' },
} as const;

export interface Theme {
  scheme: 'light' | 'dark';
  colors: ColorTokens;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
}

/** Current theme, following the system light/dark setting. */
export function useTheme(): Theme {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { scheme, colors: colors[scheme], spacing, radius, typography };
}
