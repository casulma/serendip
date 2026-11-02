import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { countDueReviews, countReceived, feedRemainingToday, lastReceivedFact, type FactView } from "../../db/repo";
import { fr } from "../../i18n/fr";
import { Button, Muted, Overline, Screen } from "../../ui/components";
import { FactCard } from "../../ui/FactCard";
import { fontSize, spacing, useTheme } from "../../ui/theme";

export default function Home() {
  const db = useSQLiteContext();
  const t = useTheme();
  const [fact, setFact] = useState<FactView | undefined>();
  const [remaining, setRemaining] = useState(0);
  const [received, setReceived] = useState(0);
  const [due, setDue] = useState(0);

  const load = useCallback(async () => {
    setFact(await lastReceivedFact(db));
    setRemaining(await feedRemainingToday(db));
    setReceived(await countReceived(db));
    setDue(await countDueReviews(db));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onChange = (f: FactView) => (f.unclear ? void load() : setFact(f));

  return (
    <Screen style={{ gap: spacing.md }}>
      {fact ? (
        <>
          <Overline>{fr.home.lastFact}</Overline>
          <FactCard fact={fact} onChange={onChange} />
        </>
      ) : (
        <View style={{ flex: 1, justifyContent: "center", gap: spacing.sm }}>
          <Text style={{ color: t.text, fontSize: fontSize.title, fontWeight: "800" }}>{fr.home.title}</Text>
          <Muted>{fr.home.noFactYet}</Muted>
        </View>
      )}
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Button label={fr.home.discover(remaining)} onPress={() => router.navigate("/decouvrir")} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label={fr.home.review(due)} variant="secondary" disabled={due === 0} onPress={() => router.push("/quiz/revision")} />
        </View>
      </View>
      <Muted>{fr.home.counts(received)}</Muted>
    </Screen>
  );
}
