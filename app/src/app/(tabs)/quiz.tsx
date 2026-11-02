import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { countDueReviews, RANDOM_SESSION_SIZE } from "../../db/repo";
import { INTERVALS } from "../../domain/leitner";
import { fr } from "../../i18n/fr";
import { Button, Card, Muted, Overline } from "../../ui/components";
import { fontSize, radius, spacing, useTheme } from "../../ui/theme";

export default function QuizHub() {
  const db = useSQLiteContext();
  const t = useTheme();
  const [due, setDue] = useState(0);

  useFocusEffect(
    useCallback(() => {
      void countDueReviews(db).then(setDue);
    }, [db]),
  );

  return (
    <ScrollView style={{ backgroundColor: t.background }} contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
      <Card style={{ gap: spacing.sm }}>
        <Overline color={t.accent}>{fr.quiz.revisionTitle}</Overline>
        <Text style={{ color: t.text, fontSize: fontSize.fact, fontWeight: "800" }}>{fr.quiz.dueCount(due)}</Text>
        <Muted>{fr.quiz.revisionHint}</Muted>
        <Button label={fr.quiz.start} disabled={due === 0} onPress={() => router.push("/quiz/revision")} />
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <Overline color={t.accent}>{fr.quiz.randomTitle}</Overline>
        <Text style={{ color: t.text, fontSize: fontSize.fact, fontWeight: "800" }}>{fr.quiz.randomCount(RANDOM_SESSION_SIZE)}</Text>
        <Muted>{fr.quiz.randomHint}</Muted>
        <Button label={fr.quiz.start} onPress={() => router.push("/quiz/aleatoire")} />
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <Overline>{fr.settings.leitnerTitle}</Overline>
        <Muted>{fr.settings.leitner}</Muted>
        <View style={{ flexDirection: "row", gap: spacing.xs }}>
          {INTERVALS.map((days, i) => (
            <View key={i} style={{ flex: 1, alignItems: "center", backgroundColor: t.raised, borderRadius: radius.sm, paddingVertical: spacing.sm }}>
              <Text style={{ color: t.muted, fontSize: 11, fontWeight: "700" }}>{fr.quiz.box(i + 1)}</Text>
              <Text style={{ color: t.text, fontSize: fontSize.body, fontWeight: "800" }}>{fr.quiz.days(days)}</Text>
            </View>
          ))}
        </View>
      </Card>
    </ScrollView>
  );
}
