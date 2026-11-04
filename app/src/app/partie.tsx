import { router, Stack, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { newGame, overrideAsCorrect, recordAnswer, retryGame, type GameQuestion } from "../db/repo";
import { checkAnswer } from "../domain/answer";
import { points, scoreMessage, shuffle } from "../domain/session";
import { fr } from "../i18n/fr";
import { DIFFICULTY_LABELS } from "../pack/types";
import { Button, Card, CategoryChip, Muted, Overline, ProgressBar, RetryBadge } from "../ui/components";
import { fontSize, radius, spacing, useTheme } from "../ui/theme";

type Result = { q: GameQuestion; correct: boolean; hinted: boolean; input: string; typo: boolean; overridden: boolean };

export default function Game() {
  const db = useSQLiteContext();
  const t = useTheme();
  const mode = useLocalSearchParams<{ mode?: string }>().mode === "erreurs" ? "erreurs" : "nouvelle";
  const [questions, setQuestions] = useState<GameQuestion[] | undefined>();
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [round, setRound] = useState(0);

  useEffect(() => {
    void (async () => {
      setQuestions(mode === "erreurs" ? await retryGame(db) : await newGame(db));
      setIndex(0);
      setResults([]);
    })();
  }, [db, mode, round]);

  const title = mode === "erreurs" ? fr.game.reviewTitle : fr.game.title;
  if (!questions) return <ActivityIndicator style={{ flex: 1, backgroundColor: t.background }} color={t.accent} />;

  if (questions.length === 0) {
    return (
      <Screen title={title}>
        <Card style={{ gap: spacing.sm }}>
          <Text style={{ color: t.text, fontSize: fontSize.fact, fontWeight: "800" }}>{fr.game.nothing}</Text>
          <Muted>{mode === "erreurs" ? fr.game.nothingReview : fr.game.nothingNew}</Muted>
        </Card>
        <Button label={fr.game.home} variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  if (index >= questions.length) {
    return <Summary title={title} results={results} onAgain={() => setRound((r) => r + 1)} />;
  }

  const q = questions[index]!;
  return (
    <Screen title={title}>
      <View style={{ gap: spacing.xs }}>
        <Muted>{fr.game.progress(index + 1, questions.length)}</Muted>
        <ProgressBar value={index / questions.length} />
      </View>
      <QuestionCard
        key={q.id}
        q={q}
        last={index + 1 === questions.length}
        onAnswered={async (r) => {
          await recordAnswer(db, q, { correct: r.correct, hinted: r.hinted });
          setResults((rs) => [...rs, r]);
        }}
        onOverride={async () => {
          await overrideAsCorrect(db, q);
          setResults((rs) => rs.map((r) => (r.q.id === q.id ? { ...r, correct: true, overridden: true } : r)));
        }}
        onNext={() => setIndex((i) => i + 1)}
      />
    </Screen>
  );
}

function Screen({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen options={{ title }} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function QuestionCard({
  q,
  last,
  onAnswered,
  onOverride,
  onNext,
}: {
  q: GameQuestion;
  last: boolean;
  onAnswered: (r: Result) => Promise<void>;
  onOverride: () => Promise<void>;
  onNext: () => void;
}) {
  const t = useTheme();
  const [input, setInput] = useState("");
  const [showChoices, setShowChoices] = useState(false);
  const [result, setResult] = useState<Result | undefined>();
  const choices = useMemo(() => shuffle([q.answer, ...q.choices]), [q]);

  const answer = async (text: string, hinted: boolean) => {
    if (result) return;
    const v = hinted ? { correct: text === q.answer, exact: true } : checkAnswer(text, q.answer, q.accept);
    const r: Result = { q, correct: v.correct, hinted, input: text, typo: v.correct && !v.exact, overridden: false };
    setResult(r);
    await onAnswered(r);
  };

  return (
    <>
      <Card style={{ gap: spacing.md }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignItems: "center" }}>
          <CategoryChip id={q.category} />
          {q.retry && <RetryBadge />}
          <View style={{ flex: 1 }} />
          <Muted>{DIFFICULTY_LABELS[q.difficulty]}</Muted>
        </View>
        <Text style={{ color: t.text, fontSize: fontSize.question, lineHeight: 31, fontWeight: "700" }}>{q.question}</Text>

        {!result && !showChoices && (
          <View style={{ gap: spacing.sm }}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={fr.game.placeholder}
              placeholderTextColor={t.muted}
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={() => input.trim() && void answer(input, false)}
              accessibilityLabel={fr.game.placeholder}
              style={{
                color: t.text,
                backgroundColor: t.raised,
                borderColor: t.border,
                borderWidth: 1,
                borderRadius: radius.md,
                padding: 14,
                fontSize: fontSize.body,
              }}
            />
            <Button label={fr.game.submit} disabled={!input.trim()} onPress={() => void answer(input, false)} />
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Button label={fr.game.showChoices} variant="secondary" onPress={() => setShowChoices(true)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label={fr.game.skip} variant="secondary" onPress={() => void answer("", false)} />
              </View>
            </View>
          </View>
        )}

        {!result && showChoices && (
          <View style={{ gap: spacing.sm }}>
            {choices.map((c) => (
              <Choice key={c} label={c} onPress={() => void answer(c, true)} />
            ))}
            <Muted>{fr.game.choicesHint}</Muted>
          </View>
        )}

        {result && result.hinted && (
          <View style={{ gap: spacing.sm }}>
            {choices.map((c) => (
              <Choice key={c} label={c} state={c === q.answer ? "right" : c === result.input ? "wrong" : "idle"} />
            ))}
          </View>
        )}
      </Card>

      {result && (
        <Card
          style={{
            gap: spacing.sm,
            backgroundColor: result.correct ? t.successSoft : t.dangerSoft,
            borderColor: result.correct ? t.success : t.danger,
          }}
        >
          <Text style={{ color: result.correct ? t.success : t.danger, fontSize: fontSize.fact, fontWeight: "800" }}>
            {result.correct ? (result.typo ? fr.game.rightTypo(q.answer) : result.overridden ? fr.game.overridden : fr.game.right) : fr.game.wrong(q.answer)}
          </Text>
          {result.correct && q.retry && <Muted>{fr.game.caughtUp}</Muted>}
          {!result.correct && result.input.trim() !== "" && !result.hinted && <Muted>{fr.game.youSaid(result.input.trim())}</Muted>}
          {!result.correct && <Muted>{fr.game.willReturn}</Muted>}
          <Text style={{ color: t.text, fontSize: fontSize.body, lineHeight: 25 }}>{q.explanation}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
            <Pressable
              accessibilityRole="link"
              onPress={() => WebBrowser.openBrowserAsync(`https://fr.wikipedia.org/wiki/${encodeURIComponent(q.wikipedia.replace(/ /g, "_"))}`)}
            >
              <Text style={{ color: t.accent, fontSize: fontSize.small, fontWeight: "700" }}>{fr.game.article} ↗</Text>
            </Pressable>
            {!result.correct && !result.hinted && result.input.trim() !== "" && (
              <Pressable
                accessibilityRole="button"
                onPress={async () => {
                  await onOverride();
                  setResult({ ...result, correct: true, overridden: true });
                }}
              >
                <Text style={{ color: t.muted, fontSize: fontSize.small, fontWeight: "700", textDecorationLine: "underline" }}>{fr.game.override}</Text>
              </Pressable>
            )}
          </View>
        </Card>
      )}

      {result && <Button label={last ? fr.game.finish : fr.game.next} onPress={onNext} />}
    </>
  );
}

function Choice({ label, onPress, state = "idle" }: { label: string; onPress?: () => void; state?: "idle" | "right" | "wrong" }) {
  const t = useTheme();
  const k =
    state === "right"
      ? { bg: t.successSoft, border: t.success, fg: t.success }
      : state === "wrong"
        ? { bg: t.dangerSoft, border: t.danger, fg: t.danger }
        : { bg: t.raised, border: t.border, fg: t.text };
  return (
    <Pressable
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: k.bg,
        borderColor: k.border,
        borderWidth: state === "idle" ? 1 : 2,
        borderRadius: radius.md,
        padding: spacing.md,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Text style={{ color: k.fg, fontSize: fontSize.body, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

function Summary({ title, results, onAgain }: { title: string; results: Result[]; onAgain: () => void }) {
  const t = useTheme();
  const score = results.reduce((n, r) => n + points(r.correct, r.hinted), 0);
  const max = results.length * 2;
  const right = results.filter((r) => r.correct).length;
  return (
    <Screen title={title}>
      <Card style={{ alignItems: "center", gap: spacing.xs }}>
        <Overline>{fr.game.score}</Overline>
        <Text style={{ color: t.accent, fontSize: fontSize.hero, fontWeight: "900" }}>{fr.game.points(score, max)}</Text>
        <Text style={{ color: t.text, fontSize: fontSize.body }}>{fr.game.correctCount(right, results.length)}</Text>
        <Muted>{scoreMessage(score, max)}</Muted>
      </Card>
      <Card style={{ gap: spacing.md }}>
        {results.map((r) => (
          <View key={r.q.id} style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" }}>
            <Text style={{ color: r.correct ? t.success : t.danger, fontWeight: "900", fontSize: fontSize.body }}>{r.correct ? "✓" : "✗"}</Text>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: t.text, fontSize: fontSize.small, lineHeight: 19 }}>{r.q.question}</Text>
              <Text style={{ color: t.muted, fontSize: fontSize.small, fontWeight: "700" }}>{r.q.answer}</Text>
            </View>
            {!r.correct && <Text style={{ color: t.retry, fontWeight: "800" }}>↻</Text>}
          </View>
        ))}
      </Card>
      <Button label={fr.game.again} onPress={onAgain} />
      <Button label={fr.game.home} variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}
