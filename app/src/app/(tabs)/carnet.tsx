import { Link, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { receivedFacts, type FactView } from "../../db/repo";
import { formatDay } from "../../domain/dates";
import { matches } from "../../domain/search";
import { fr } from "../../i18n/fr";
import { categoryLabel } from "../../pack/types";
import { Chip, Muted, Screen } from "../../ui/components";
import { fontSize, spacing, useTheme } from "../../ui/theme";

export default function Notebook() {
  const db = useSQLiteContext();
  const t = useTheme();
  const [facts, setFacts] = useState<FactView[]>([]);
  const [query, setQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void receivedFacts(db).then(setFacts);
    }, [db]),
  );

  // The notebook only holds received facts (≤ a few per day): filtering in memory is enough.
  const shown = useMemo(
    () => facts.filter((f) => (!favoritesOnly || f.favorite) && matches(f.text, query)),
    [facts, favoritesOnly, query],
  );

  return (
    <Screen style={{ paddingBottom: 0 }}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={fr.notebook.search}
        placeholderTextColor={t.muted}
        accessibilityLabel={fr.notebook.search}
        style={{ color: t.text, backgroundColor: t.card, borderColor: t.border, borderWidth: 1, borderRadius: 12, padding: 12, fontSize: fontSize.body }}
      />
      <View style={{ flexDirection: "row", marginVertical: spacing.sm }}>
        <Chip label={`★ ${fr.notebook.favoritesOnly}`} active={favoritesOnly} onPress={() => setFavoritesOnly((v) => !v)} />
      </View>
      <FlatList
        data={shown}
        keyExtractor={(f) => f.id}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: t.border }} />}
        ListEmptyComponent={<Muted style={{ marginTop: spacing.lg }}>{facts.length === 0 ? fr.notebook.empty : fr.notebook.noResult}</Muted>}
        renderItem={({ item }) => (
          <Link href={{ pathname: "/fait/[id]", params: { id: item.id } }} asChild>
            <Pressable style={{ paddingVertical: spacing.md, gap: spacing.xs }}>
              <Text numberOfLines={3} style={{ color: t.text, fontSize: fontSize.body, lineHeight: 24 }}>
                {item.favorite ? "★ " : ""}
                {item.text}
              </Text>
              <Muted>
                {categoryLabel(item.category)} · {formatDay(item.receivedDay)}
                {item.known ? ` · ${fr.fact.knewIt.toLowerCase()}` : ""}
                {item.unclear ? ` · ${fr.fact.unclear.toLowerCase()}` : ""}
              </Muted>
            </Pressable>
          </Link>
        )}
      />
    </Screen>
  );
}
