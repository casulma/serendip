import { router, Stack, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { answerReview, answerTrivia, dueReviews, randomTrivia, type ReviewItem, type TriviaItem } from "../../db/repo";
import { formatDay } from "../../domain/dates";
import type { ReviewState } from "../../domain/leitner";
import { choiceLabel, scoreMessage, type QuizChoice } from "../../domain/quiz";
import { fr } from "../../i18n/fr";
import { Button, Card, CategoryChip, Muted, Overline, ProgressBar } from "../../ui/components";
import { QuestionView } from "../../ui/QuestionView";
import { fontSize, radius, spacing, useTheme } from "../../ui/theme";

type Mode = "revision" | "aleatoire";
type Item = { kind: "review"; review: ReviewItem } | { kind: "trivia"; trivia: TriviaItem };
type Outcome = { label: string; correct: boolean };

export default function QuizSession() {
  const db = useSQLiteContext();
  const t = useTheme();
  const mode: Mode = useLocalSearchParams<{ mode: string }>().mode === "revision" ? "revision" : "aleatoire";
  const [items, setItems] = useState<Item[] | undefined>();
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<QuizChoice | undefined>();
  const [selfGraded, setSelfGraded] = useState<boolean | undefined>();
  const [nextState, setNextState] = useState<ReviewState | undefined>();
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);

  useEffect(() => {
    void (async () => {
      setItems(
        mode === "revision"
          ? (await dueReviews(db)).map((review): Item => ({ kind: "review", review }))
          : (await randomTrivia(db)).map((trivia): Item => ({ kind: "trivia", trivia })),
      );
    })();
  }, [db, mode]);

  const title = mode === "revision" ? fr.quiz.revisionTitle : fr.quiz.randomTitle;
  if (!items) return <ActivityIndicator style={{ flex: 1, backgroundColor: t.background }} color={t.accent} />;

  if (items.length === 0 || index >= items.length) {
    return <Summary title={title} mode={mode} outcomes={outcomes} empty={items.length === 0} />;
  }

  const item = items[index]!;
  const question = item.kind === "review" ? item.review.question : item.trivia.question;
  const answered = picked !== undefined || selfGraded !== undefined;
  const correct = picked ? picked.correct : selfGraded === true;

  const record = async (success: boolean) => {
    if (item.kind === "review") setNextState(await answerReview(db, item.review.fact.id, success));
    else await answerTrivia(db, item.trivia, success);
    const label = question ? question.prompt : item.kind === "review" ? item.review.fact.text : "";
    setOutcomes((o) => [...o, { label, correct: success }]);
  };

  const next = () => {
    setPicked(undefined);
    setSelfGraded(undefined);
    setNextState(undefined);
    setIndex((i) => i + 1);
  };

  return (
    <>
      <Stack.Screen options={{ title }} />
      <ScrollView style={{ backgroundColor: t.background }} contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
        <View style={{ gap: spacing.xs }}>
          <Muted>{fr.quiz.progress(index + 1, items.length)}</Muted>
          <ProgressBar value={index / items.length} />
        </View>

        <Card style={{ gap: spacing.md }}>
          <CategoryChip id={item.kind === "review" ? item.review.fact.category : item.trivia.category} />
          {question ? (
            <QuestionView
              key={question.id}
              question={question}
              picked={picked}
              onPick={(c) => {
                setPicked(c);
                void record(c.correct);
              }}
            />
          ) : (
            // A Wikipédia anecdote without a generated question: self-graded flashcard.
            item.kind === "review" && (
              <View style={{ gap: spacing.md }}>
                <Overline>{fr.fact.didYouKnow}</Overline>
                <Text style={{ color: t.text, fontSize: fontSize.fact, lineHeight: 31 }}>{item.review.fact.text}</Text>
                {!answered && (
                  <View style={{ flexDirection: "row", gap: spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <Button label={fr.quiz.knew} onPress={() => (setSelfGraded(true), void record(true))} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button label={fr.quiz.didntKnow} variant="secondary" onPress={() => (setSelfGraded(false), void record(false))} />
                    </View>
                  </View>
                )}
              </View>
            )
          )}
        </Card>

        {answered && (
          <Card style={{ gap: spacing.sm, backgroundColor: correct ? t.successSoft : t.dangerSoft, borderColor: correct ? t.success : t.danger }}>
            <Text style={{ color: correct ? t.success : t.danger, fontSize: fontSize.body, fontWeight: "800" }}>
              {correct ? fr.quiz.right : question ? fr.quiz.wrong(choiceLabel(question.answer)) : fr.quiz.noted}
            </Text>
            {item.kind === "review" && question && item.review.fact.origin === "oqdb" && (
              <Text style={{ color: t.text, fontSize: fontSize.body, lineHeight: 25 }}>{item.review.fact.text}</Text>
            )}
            {item.kind === "review" && nextState && (
              <Muted>{fr.quiz.nextReview(nextState.box, formatDay(nextState.dueDay))}</Muted>
            )}
            <Pressable
              accessibilityRole="link"
              onPress={() => WebBrowser.openBrowserAsync(item.kind === "review" ? item.review.fact.source : item.trivia.wikidata)}
            >
              <Text style={{ color: t.accent, fontSize: fontSize.small, fontWeight: "700" }}>
                {item.kind === "review" ? fr.fact.source : fr.quiz.wikidata} ↗
              </Text>
            </Pressable>
          </Card>
        )}

        {answered && <Button label={index + 1 < items.length ? fr.quiz.next : fr.quiz.seeScore} onPress={next} />}
      </ScrollView>
    </>
  );
}

function Summary({ title, mode, outcomes, empty }: { title: string; mode: Mode; outcomes: Outcome[]; empty: boolean }) {
  const t = useTheme();
  const correct = outcomes.filter((o) => o.correct).length;
  return (
    <>
      <Stack.Screen options={{ title }} />
      <ScrollView style={{ backgroundColor: t.background }} contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
        {empty ? (
          <Card style={{ gap: spacing.sm }}>
            <Text style={{ color: t.text, fontSize: fontSize.fact, fontWeight: "800" }}>
              {mode === "revision" ? fr.quiz.nothingDue : fr.quiz.noTrivia}
            </Text>
            <Muted>{mode === "revision" ? fr.quiz.nothingDueHint : fr.quiz.noTriviaHint}</Muted>
          </Card>
        ) : (
          <>
            <Card style={{ alignItems: "center", gap: spacing.xs }}>
              <Overline>{fr.quiz.score}</Overline>
              <Text style={{ color: t.accent, fontSize: fontSize.hero, fontWeight: "800" }}>
                {correct} / {outcomes.length}
              </Text>
              <Text style={{ color: t.text, fontSize: fontSize.body }}>{scoreMessage({ total: outcomes.length, correct })}</Text>
            </Card>
            <Card style={{ gap: spacing.sm }}>
              {outcomes.map((o, i) => (
                <View key={i} style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" }}>
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: radius.pill,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: o.correct ? t.successSoft : t.dangerSoft,
                    }}
                  >
                    <Text style={{ color: o.correct ? t.success : t.danger, fontWeight: "800" }}>{o.correct ? "✓" : "✗"}</Text>
                  </View>
                  <Text style={{ color: t.text, flex: 1, fontSize: fontSize.small, lineHeight: 19 }} numberOfLines={2}>
                    {o.label}
                  </Text>
                </View>
              ))}
            </Card>
          </>
        )}
        <Button label={fr.quiz.back} variant="secondary" onPress={() => router.back()} />
      </ScrollView>
    </>
  );
}
