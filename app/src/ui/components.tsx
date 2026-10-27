import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { fontSize, spacing, useTheme } from "./theme";

export function Screen({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return <View style={[{ flex: 1, backgroundColor: t.background, padding: spacing.md }, style]}>{children}</View>;
}

export function Title({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={{ color: t.text, fontSize: fontSize.title, fontWeight: "700", marginBottom: spacing.md }}>{children}</Text>;
}

export function Muted({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={style}>
      <Text style={{ color: t.muted, fontSize: fontSize.small, lineHeight: 19 }}>{children}</Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  accessibilityHint?: string;
}) {
  const t = useTheme();
  const bg = variant === "primary" ? t.accent : "transparent";
  const fg = variant === "primary" ? t.accentText : variant === "danger" ? t.danger : t.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: variant === "primary" ? bg : t.border, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}
    >
      <Text style={{ color: fg, fontSize: fontSize.body, fontWeight: "600", textAlign: "center" }}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: active ? t.accent : t.chip }]}
    >
      <Text style={{ color: active ? t.accentText : t.muted, fontSize: fontSize.small, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { borderWidth: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: spacing.md },
  chip: { alignSelf: "flex-start", borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
});
