import { useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEffect, useState } from "react";
import { receivedFact, type FactView } from "../../db/repo";
import { Screen } from "../../ui/components";
import { FactCard } from "../../ui/FactCard";

export default function FactDetail() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [fact, setFact] = useState<FactView | undefined>();

  useEffect(() => {
    void receivedFact(db, id).then(setFact);
  }, [db, id]);

  if (!fact) return null;
  return (
    <Screen>
      <FactCard fact={fact} onChange={setFact} showReview />
    </Screen>
  );
}
