import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { Alert, ScrollView, Switch, Text, View } from "react-native";
import { countAvailable, getSettings, saveSettings, type Settings } from "../../db/repo";
import { SESSION_SIZES } from "../../domain/session";
import { fr } from "../../i18n/fr";
import { CATEGORIES, DIFFICULTY_LABELS, type Difficulty } from "../../pack/types";
import { PACK_VERSION } from "../../pack/version.generated";
import { Card, Chip, Muted, Overline } from "../../ui/components";
import { fontSize, spacing, useTheme } from "../../ui/theme";

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const t = useTheme();
  const [s, setS] = useState<Settings | undefined>();
  const [available, setAvailable] = useState(0);

  useFocusEffect(
    useCallback(() => {
      void getSettings(db).then(setS);
      void countAvailable(db).then(setAvailable);
    }, [db]),
  );

  if (!s) return null;

  const update = async (next: Settings) => {
    if (next.categories.length === 0 || next.difficulties.length === 0) {
      Alert.alert(fr.settings.atLeastOne);
      return;
    }
    setS(next);
    await saveSettings(db, next);
    setAvailable(await countAvailable(db));
  };

  const toggle = <T,>(list: T[], item: T, on: boolean, order: readonly T[]) => order.filter((x) => (x === item ? on : list.includes(x)));

  return (
    <ScrollView style={{ backgroundColor: t.background }} contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
      <Card style={{ gap: spacing.sm }}>
        <Overline>{fr.settings.sessionSize}</Overline>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {SESSION_SIZES.map((n) => (
            <Chip key={n} label={String(n)} active={s.sessionSize === n} onPress={() => update({ ...s, sessionSize: n })} />
          ))}
        </View>
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <Overline>{fr.settings.difficulties}</Overline>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {([1, 2, 3] as Difficulty[]).map((d) => (
            <Chip
              key={d}
              label={DIFFICULTY_LABELS[d]}
              active={s.difficulties.includes(d)}
              onPress={() => update({ ...s, difficulties: toggle(s.difficulties, d, !s.difficulties.includes(d), [1, 2, 3] as const) })}
            />
          ))}
        </View>
        <Muted>{fr.settings.difficultiesHint}</Muted>
      </Card>

      <Card style={{ gap: spacing.xs }}>
        <Overline>{fr.settings.categories}</Overline>
        {CATEGORIES.map((c) => (
          <View key={c.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 2 }}>
            <Text style={{ color: t.text, fontSize: fontSize.body, flex: 1 }}>
              {c.glyph} {c.label}
            </Text>
            <Switch
              value={s.categories.includes(c.id)}
              onValueChange={(on) => update({ ...s, categories: toggle(s.categories, c.id, on, CATEGORIES.map((x) => x.id)) })}
              trackColor={{ true: t.accent, false: t.border }}
              accessibilityLabel={c.label}
            />
          </View>
        ))}
        <Muted style={{ marginTop: spacing.sm }}>{fr.settings.available(available)}</Muted>
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <Overline>{fr.settings.howItWorks}</Overline>
        <Muted>{fr.settings.howItWorksBody}</Muted>
      </Card>

      <Muted>
        {fr.settings.credits}
        {"\n"}
        {fr.settings.packVersion(PACK_VERSION)}
      </Muted>
    </ScrollView>
  );
}
