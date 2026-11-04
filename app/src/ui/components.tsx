import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { category, type CategoryId } from "../pack/types";
import { categoryColors, fontSize, radius, shadow, spacing, useTheme } from "./theme";

export function Screen({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return <View style={[{ flex: 1, backgroundColor: t.background, padding: spacing.md }, style]}>{children}</View>;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }, shadow(t), style]}>{children}</View>;
}

export function Title({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={{ color: t.text, fontSize: fontSize.title, fontWeight: "800", letterSpacing: -0.5 }}>{children}</Text>;
}

/** Small uppercase label above a block ("LE SAVIEZ-VOUS ?", "RÉVISION"…). */
export function Overline({ children, color }: { children: ReactNode; color?: string }) {
  const t = useTheme();
  return (
    <Text style={{ color: color ?? t.muted, fontSize: 12, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" }}>
      {children}
    </Text>
  );
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
        { backgroundColor: bg, borderColor: variant === "primary" ? bg : t.border, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
      ]}
    >
      <Text style={{ color: fg, fontSize: fontSize.body, fontWeight: "700", textAlign: "center" }}>{label}</Text>
    </Pressable>
  );
}

/** Compact action with a glyph, used in rows of equal-width actions. */
export function Action({
  glyph,
  label,
  onPress,
  active,
  accessibilityHint,
}: {
  glyph: string;
  label: string;
  onPress: () => void;
  active?: boolean;
  accessibilityHint?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: active ? t.accentSoft : t.raised, borderColor: active ? t.accent : t.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Text style={{ color: active ? t.accent : t.text, fontSize: 18 }}>{glyph}</Text>
      <Text numberOfLines={1} style={{ color: active ? t.accent : t.muted, fontSize: 12, fontWeight: "600" }}>
        {label}
      </Text>
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
      <Text style={{ color: active ? t.accentText : t.muted, fontSize: fontSize.small, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

export function CategoryChip({ id }: { id: CategoryId }) {
  const t = useTheme();
  const c = categoryColors(id, t);
  return (
    <View style={[styles.chip, { backgroundColor: c.bg }]}>
      <Text style={{ color: c.fg, fontSize: fontSize.small, fontWeight: "700" }}>
        {category(id).glyph} {category(id).label}
      </Text>
    </View>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const t = useTheme();
  return (
    <View style={{ height: 6, borderRadius: radius.pill, backgroundColor: t.chip, overflow: "hidden" }}>
      <View style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`, height: "100%", backgroundColor: t.accent }} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: spacing.lg },
  button: { borderWidth: 1, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: spacing.md },
  action: { flex: 1, alignItems: "center", gap: 2, borderWidth: 1, borderRadius: radius.md, paddingVertical: 10 },
  chip: { alignSelf: "flex-start", borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 12 },
});

/** The "à revoir" badge on a question missed in an earlier game. */
export function RetryBadge() {
  const t = useTheme();
  return (
    <View
      accessibilityLabel="Question à revoir : ratée lors d'une partie précédente"
      style={[styles.chip, { backgroundColor: t.retrySoft, flexDirection: "row", gap: 4, alignItems: "center" }]}
    >
      <Text style={{ color: t.retry, fontSize: fontSize.small, fontWeight: "800" }}>↻ À revoir</Text>
    </View>
  );
}
