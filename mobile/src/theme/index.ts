import { Platform, type TextStyle, type ViewStyle } from "react-native";

export const colors = {
  accent: "#0f766e",
  background: "#f7f8fb",
  border: "rgba(17, 24, 39, 0.1)",
  borderStrong: "rgba(17, 24, 39, 0.16)",
  danger: "#dc2626",
  dangerSoft: "rgba(254, 242, 242, 0.85)",
  primary: "#2563eb",
  primarySoft: "#dbeafe",
  primaryStrong: "#1d4ed8",
  selection: "#fef3c7",
  surface: "rgba(255, 255, 255, 0.86)",
  surfaceMuted: "#eef3f8",
  surfaceStrong: "#ffffff",
  text: "#111827",
  textMuted: "#5b6678",
  textSoft: "#7b8494",
  white: "#ffffff",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 18,
  "2xl": 22,
  "3xl": 24,
  "4xl": 28,
  "5xl": 34,
  "6xl": 42,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 18,
  pill: 999,
} as const;

export const typography = {
  body: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 24,
  } satisfies TextStyle,
  button: {
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0,
  } satisfies TextStyle,
  eyebrow: {
    color: colors.primaryStrong,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  } satisfies TextStyle,
  label: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "800",
  } satisfies TextStyle,
  screenTitle: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 36,
  } satisfies TextStyle,
  muted: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
  } satisfies TextStyle,
} as const;

export const shadows = {
  soft: Platform.select<ViewStyle>({
    ios: {
      shadowColor: "#0f172a",
      shadowOffset: { height: 18, width: 0 },
      shadowOpacity: 0.1,
      shadowRadius: 30,
    },
    android: {
      elevation: 3,
    },
    default: {},
  }),
  card: Platform.select<ViewStyle>({
    ios: {
      shadowColor: "#0f172a",
      shadowOffset: { height: 16, width: 0 },
      shadowOpacity: 0.12,
      shadowRadius: 24,
    },
    android: {
      elevation: 5,
    },
    default: {},
  }),
  primary: Platform.select<ViewStyle>({
    ios: {
      shadowColor: colors.primary,
      shadowOffset: { height: 14, width: 0 },
      shadowOpacity: 0.22,
      shadowRadius: 20,
    },
    android: {
      elevation: 3,
    },
    default: {},
  }),
} as const;
