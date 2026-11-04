import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { overview, statsByCategory, type CategoryStats, type Overview } from "../../db/repo";
import { fr } from "../../i18n/fr";
import { category, type CategoryId } from "../../pack/types";
import { Card, Muted, Overline } from "../../ui/components";
import { categoryColors, fontSize, radius, spacing, useTheme } from "../../ui/theme";

export default function Stats() {
  const db = useSQLiteContext();
  const t = useTheme();
  const [o, setO] = useState<Overview | undefined>();
  const [cats, setCats] = useState<CategoryStats[]>([]);

  useFocusEffect(
    useCallback(() => {
      void overview(db).then(setO);
      void statsByCategory(db).then(setCats);
    }, [db]),
  );

  if (!o) return null;
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

  return (
    <ScrollView style={{ backgroundColor: t.background }} contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        <Tile label={fr.stats.answered} value={String(o.answered)} />
        <Tile label={fr.stats.rate} value={`${pct(o.correct, o.answered)} %`} />
        <Tile label={fr.stats.toReview} value={String(o.toReview)} color={t.retry} />
        <Tile label={fr.stats.discovered} value={`${pct(o.seen, o.total)} %`} />
      </View>

      <Card style={{ gap: spacing.md }}>
        <Overline>{fr.stats.byCategory}</Overline>
        {o.answered === 0 && <Muted>{fr.stats.none}</Muted>}
        {cats.map((c) => {
          const colors = categoryColors(c.category as CategoryId, t);
          const rate = pct(c.correct, c.answered);
          return (
            <View key={c.category} style={{ gap: 4 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: t.text, fontSize: fontSize.body, fontWeight: "600" }}>
                  {category(c.category).glyph} {category(c.category).label}
                </Text>
                <Text style={{ color: colors.fg, fontSize: fontSize.body, fontWeight: "800" }}>{c.answered > 0 ? `${rate} %` : "—"}</Text>
              </View>
              <View style={{ height: 8, borderRadius: radius.pill, backgroundColor: colors.bg, overflow: "hidden" }}>
                <View style={{ width: `${rate}%`, height: "100%", backgroundColor: colors.fg }} />
              </View>
              <Muted>{fr.stats.line(c.seen, c.total)}</Muted>
            </View>
          );
        })}
      </Card>
    </ScrollView>
  );
}

function Tile({ label, value, color }: { label: string; value: string; color?: string }) {
  const t = useTheme();
  return (
    <Card style={{ flexBasis: "47%", flexGrow: 1, padding: spacing.md, gap: 2 }}>
      <Overline>{label}</Overline>
      <Text style={{ color: color ?? t.text, fontSize: fontSize.title, fontWeight: "900" }}>{value}</Text>
    </Card>
  );
}
