import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, Share, Switch, Text, View } from "react-native";
import { countUnclear, exportUnclear, getSettings, saveSettings, type Settings } from "../../db/repo";
import { MAX_FACTS_PER_DAY, clampNotifications } from "../../domain/quota";
import { fr } from "../../i18n/fr";
import { CATEGORIES, type CategoryId } from "../../pack/types";
import { PACK_VERSION } from "../../pack/version.generated";
import { Button, Muted } from "../../ui/components";
import { fontSize, spacing, useTheme } from "../../ui/theme";

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const t = useTheme();
  const [s, setS] = useState<Settings | undefined>();
  const [unclear, setUnclear] = useState(0);

  useFocusEffect(
    useCallback(() => {
      void getSettings(db).then(setS);
      void countUnclear(db).then(setUnclear);
    }, [db]),
  );

  const shareUnclear = async () => {
    const data = await exportUnclear(db);
    await Share.share({ title: fr.settings.unclearTitle, message: JSON.stringify(data, null, 1) });
  };

  if (!s) return null;

  const update = async (next: Settings) => {
    const fixed = { ...next, notificationsPerDay: clampNotifications(next.factsPerDay, next.notificationsPerDay) };
    setS(fixed);
    await saveSettings(db, fixed);
  };

  const toggleCategory = (id: CategoryId, on: boolean) => {
    const categories = on ? [...s.categories, id] : s.categories.filter((c) => c !== id);
    if (categories.length === 0) {
      Alert.alert(fr.settings.atLeastOne);
      return;
    }
    // Keep the canonical order, whatever the toggling order.
    void update({ ...s, categories: CATEGORIES.map((c) => c.id).filter((c) => categories.includes(c)) });
  };

  const section = { color: t.text, fontSize: fontSize.body, fontWeight: "700" as const, marginTop: spacing.lg };

  return (
    <ScrollView style={{ backgroundColor: t.background }} contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}>
      <Text style={section}>{fr.settings.factsPerDay}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <Stepper label="−" disabled={s.factsPerDay <= 1} onPress={() => update({ ...s, factsPerDay: s.factsPerDay - 1 })} />
        <Text style={{ color: t.text, fontSize: fontSize.title, minWidth: 40, textAlign: "center" }}>{s.factsPerDay}</Text>
        <Stepper label="+" disabled={s.factsPerDay >= MAX_FACTS_PER_DAY} onPress={() => update({ ...s, factsPerDay: s.factsPerDay + 1 })} />
      </View>
      <Muted>{fr.settings.factsPerDayHint}</Muted>
      <Muted>{fr.settings.notificationsSoon}</Muted>

      <Text style={section}>{fr.settings.categories}</Text>
      <Muted>{fr.settings.categoriesHint}</Muted>
      {CATEGORIES.map((c) => (
        <View key={c.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.xs }}>
          <Text style={{ color: t.text, fontSize: fontSize.body }}>{c.label}</Text>
          <Switch
            value={s.categories.includes(c.id)}
            onValueChange={(on) => toggleCategory(c.id, on)}
            trackColor={{ true: t.accent, false: t.border }}
            accessibilityLabel={c.label}
          />
        </View>
      ))}

      <Text style={section}>{fr.settings.unclearTitle}</Text>
      <Muted>{fr.settings.unclearCount(unclear)}</Muted>
      <Muted>{fr.settings.unclearExportHint}</Muted>
      <Button label={fr.settings.unclearExport} variant="secondary" disabled={unclear === 0} onPress={shareUnclear} />

      <Text style={section}>{fr.settings.leitnerTitle}</Text>
      <Muted>{fr.settings.leitner}</Muted>

      <Muted style={{ marginTop: spacing.xl }}>
        {fr.settings.credits}
        {"\n"}
        {fr.settings.packVersion(PACK_VERSION)}
      </Muted>
    </ScrollView>
  );
}

function Stepper({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === "+" ? "Augmenter" : "Diminuer"}
      disabled={disabled}
      onPress={onPress}
      style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: t.border, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.4 : 1 }}
    >
      <Text style={{ color: t.accent, fontSize: 22 }}>{label}</Text>
    </Pressable>
  );
}
