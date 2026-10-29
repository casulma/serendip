import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Text, View, type ListViewToken } from "react-native";
import { factsReceivedOn, feedCountOn, getSettings, revealNextFact, type FactView } from "../../db/repo";
import { dayKey } from "../../domain/dates";
import { feedLimit } from "../../domain/quota";
import { fr } from "../../i18n/fr";
import { Button, Muted } from "../../ui/components";
import { FactCard } from "../../ui/FactCard";
import { fontSize, spacing, useTheme } from "../../ui/theme";

// Today's facts, then one trailing page: "next" reveals a new fact as soon as
// it scrolls into view (that is when it is actually seen and counted), "end"
// closes the day.
type Page = { kind: "fact"; fact: FactView } | { kind: "next" } | { kind: "end"; exhausted: boolean };

const keyOf = (p: Page) => (p.kind === "fact" ? p.fact.id : p.kind);

export default function Discover() {
  const db = useSQLiteContext();
  const t = useTheme();
  const [pages, setPages] = useState<Page[] | undefined>();
  const [limit, setLimit] = useState(0);
  const [seen, setSeen] = useState(0);
  const [height, setHeight] = useState(0);
  const revealing = useRef(false);
  const exhausted = useRef(false);

  const load = useCallback(async () => {
    const today = dayKey(new Date());
    const s = await getSettings(db);
    const facts = await factsReceivedOn(db, today);
    const fromFeed = await feedCountOn(db, today);
    const lim = feedLimit(s.factsPerDay, s.notificationsPerDay);
    setLimit(lim);
    setSeen(fromFeed);
    const tail: Page = fromFeed < lim && !exhausted.current ? { kind: "next" } : { kind: "end", exhausted: exhausted.current };
    setPages([...facts.map((fact): Page => ({ kind: "fact", fact })), tail]);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const reveal = useCallback(async () => {
    if (revealing.current) return;
    revealing.current = true;
    try {
      const r = await revealNextFact(db);
      if ("reason" in r && r.reason === "exhausted") exhausted.current = true;
      await load();
    } finally {
      revealing.current = false;
    }
  }, [db, load]);

  // FlatList requires a stable onViewableItemsChanged: route through a ref.
  const revealRef = useRef(reveal);
  useEffect(() => {
    revealRef.current = reveal;
  }, [reveal]);
  const [onViewable] = useState(() => ({ viewableItems }: { viewableItems: ListViewToken[] }) => {
    if (viewableItems.some((v) => (v.item as Page).kind === "next")) void revealRef.current();
  });

  const updateFact = (fact: FactView) => {
    // A flagged fact leaves the feed and frees its slot in the quota.
    if (fact.unclear) {
      void load();
      return;
    }
    setPages((ps) => ps?.map((p) => (p.kind === "fact" && p.fact.id === fact.id ? { kind: "fact", fact } : p)));
  };

  if (!pages) return null;

  if (limit === 0) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: spacing.lg, backgroundColor: t.background }}>
        <Muted>{fr.discover.noFeed}</Muted>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.background }} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
      {height > 0 && (
        <FlatList
          data={pages}
          keyExtractor={keyOf}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
          // Reopen on the latest fact rather than the first one of the day.
          initialScrollIndex={Math.max(0, pages.length - 2)}
          viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
          onViewableItemsChanged={onViewable}
          renderItem={({ item }) => (
            <View style={{ height, padding: spacing.md }}>
              {item.kind === "fact" && <FactCard fact={item.fact} onChange={updateFact} />}
              {item.kind === "next" && (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md }}>
                  <ActivityIndicator color={t.accent} />
                  <Muted>{pages.length === 1 ? fr.discover.swipeHint : fr.discover.reveal}</Muted>
                </View>
              )}
              {item.kind === "end" && (
                <View style={{ flex: 1, justifyContent: "center", gap: spacing.md }}>
                  <Text style={{ color: t.text, fontSize: fontSize.title, fontWeight: "700" }}>{fr.discover.doneTitle}</Text>
                  <Muted>{item.exhausted ? fr.discover.exhausted : fr.discover.doneBody}</Muted>
                  <Button label={fr.tabs.notebook} variant="secondary" onPress={() => router.navigate("/carnet")} />
                </View>
              )}
            </View>
          )}
        />
      )}
      <View pointerEvents="none" style={{ position: "absolute", top: spacing.sm, right: spacing.lg }}>
        <Muted>{fr.discover.counter(seen, limit)}</Muted>
      </View>
    </View>
  );
}
