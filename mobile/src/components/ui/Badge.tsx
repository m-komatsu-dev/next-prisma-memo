import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius } from "../../theme";

type BadgeVariant = "default" | "public" | "shared" | "tag";

type BadgeProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: BadgeVariant;
};

export function Badge({ children, style, variant = "default" }: BadgeProps) {
  return (
    <View style={[styles.base, variantStyles[variant], style]}>
      <Text style={[styles.text, variantTextStyles[variant]]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 24,
    paddingHorizontal: 9,
  },
  default: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  defaultText: {
    color: colors.textMuted,
  },
  public: {
    backgroundColor: "rgba(15, 118, 110, 0.09)",
    borderColor: "rgba(15, 118, 110, 0.24)",
  },
  publicText: {
    color: colors.accent,
  },
  shared: {
    backgroundColor: colors.primarySoft,
    borderColor: "rgba(37, 99, 235, 0.2)",
  },
  sharedText: {
    color: colors.primaryStrong,
  },
  tag: {
    backgroundColor: colors.primarySoft,
    borderColor: "rgba(37, 99, 235, 0.16)",
    minHeight: 28,
    paddingHorizontal: 10,
  },
  tagText: {
    color: colors.primaryStrong,
  },
  text: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0,
  },
});

const variantStyles = {
  default: styles.default,
  public: styles.public,
  shared: styles.shared,
  tag: styles.tag,
} satisfies Record<BadgeVariant, object>;

const variantTextStyles = {
  default: styles.defaultText,
  public: styles.publicText,
  shared: styles.sharedText,
  tag: styles.tagText,
} satisfies Record<BadgeVariant, object>;
