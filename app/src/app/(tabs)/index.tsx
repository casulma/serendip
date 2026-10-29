import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { countReceived, feedRemainingToday, lastReceivedFact, type FactView } from "../../db/repo";
import { fr } from "../../i18n/fr";
import { Button, Muted, Screen } from "../../ui/components";
import { FactCard } from "../../ui/FactCard";
import { spacing } from "../../ui/theme";

export default function Home() {
  const db = useSQLiteContext();
  const [fact, setFact] = useState<FactView | undefined>();
  const [remaining, setRemaining] = useState(0);
  const [received, setReceived] = useState(0);

  const load = useCallback(async () => {
    setFact(await lastReceivedFact(db));
    setRemaining(await feedRemainingToday(db));
    setReceived(await countReceived(db));
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
          <Muted>{fr.home.lastFact}</Muted>
          <FactCard fact={fact} onChange={onChange} />
        </>
      ) : (
        <View style={{ flex: 1, justifyContent: "center" }}>
          <Muted>{fr.home.noFactYet}</Muted>
        </View>
      )}
      <View style={{ gap: spacing.sm }}>
        <Button label={fr.home.discover(remaining)} onPress={() => router.navigate("/decouvrir")} />
        <Muted>
          {fr.home.counts(received)} · {fr.home.quizSoon}
        </Muted>
      </View>
    </Screen>
  );
}
