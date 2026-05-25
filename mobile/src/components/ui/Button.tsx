import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type GestureResponderEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { colors, radius, shadows, typography } from "../../theme";

type ButtonVariant = "primary" | "secondary" | "dark" | "danger" | "soft";

type ButtonProps = {
  children: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  variant?: ButtonVariant;
};

export function Button({
  children,
  disabled = false,
  loading = false,
  onPress,
  style,
  textStyle,
  variant = "primary",
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const variantStyle = variantStyles[variant];
  const variantTextStyle = variantTextStyles[variant];

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variantStyle,
        pressed ? styles.pressed : undefined,
        isDisabled ? styles.disabled : undefined,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" || variant === "dark" ? colors.white : colors.primaryStrong} />
      ) : (
        <Text style={[styles.text, variantTextStyle, textStyle]}>{children}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  danger: {
    backgroundColor: colors.dangerSoft,
    borderColor: "rgba(220, 38, 38, 0.22)",
  },
  dangerText: {
    color: colors.danger,
  },
  dark: {
    backgroundColor: colors.text,
    borderColor: "transparent",
    ...shadows.soft,
  },
  darkText: {
    color: colors.white,
  },
  disabled: {
    opacity: 0.62,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ translateY: 1 }],
  },
  primary: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryStrong,
    ...shadows.primary,
  },
  primaryText: {
    color: colors.white,
  },
  secondary: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.borderStrong,
  },
  secondaryText: {
    color: colors.text,
  },
  soft: {
    backgroundColor: colors.primarySoft,
    borderColor: "rgba(37, 99, 235, 0.18)",
  },
  softText: {
    color: colors.primaryStrong,
  },
  text: {
    ...typography.button,
  },
});

const variantStyles = {
  danger: styles.danger,
  dark: styles.dark,
  primary: styles.primary,
  secondary: styles.secondary,
  soft: styles.soft,
} satisfies Record<ButtonVariant, object>;

const variantTextStyles = {
  danger: styles.dangerText,
  dark: styles.darkText,
  primary: styles.primaryText,
  secondary: styles.secondaryText,
  soft: styles.softText,
} satisfies Record<ButtonVariant, object>;
