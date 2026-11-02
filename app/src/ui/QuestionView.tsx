import { useMemo } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { choiceLabel, shuffledChoices, type QuizChoice } from "../domain/quiz";
import type { Question } from "../pack/types";
import { IMAGES } from "../pack/images.generated";
import { fontSize, radius, spacing, useTheme } from "./theme";

/**
 * A 4-choice question. Once `picked` is set, the right answer turns green and a
 * wrong pick red; choices are then locked.
 */
export function QuestionView({
  question,
  picked,
  onPick,
}: {
  question: Question;
  picked: QuizChoice | undefined;
  onPick: (choice: QuizChoice) => void;
}) {
  const t = useTheme();
  // Shuffle once per question, not on every render.
  const choices = useMemo(() => shuffledChoices(question), [question]);
  const images = choices.every((c) => c.kind === "image");

  const colors = (c: QuizChoice) => {
    if (!picked) return { bg: t.card, border: t.border, fg: t.text };
    if (c.correct) return { bg: t.successSoft, border: t.success, fg: t.success };
    if (c === picked) return { bg: t.dangerSoft, border: t.danger, fg: t.danger };
    return { bg: t.card, border: t.border, fg: t.muted };
  };

  return (
    <View style={{ gap: spacing.md }}>
      <Text style={{ color: t.text, fontSize: fontSize.question, lineHeight: 31, fontWeight: "700" }}>{question.prompt}</Text>
      {question.promptImage && IMAGES[question.promptImage] !== undefined && (
        <Image
          source={IMAGES[question.promptImage]!}
          accessibilityLabel="Drapeau"
          style={{ width: "70%", aspectRatio: 3 / 2, alignSelf: "center", borderRadius: radius.sm }}
          resizeMode="contain"
        />
      )}
      <View style={images ? { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm } : { gap: spacing.sm }}>
        {choices.map((c, i) => {
          const k = colors(c);
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={choiceLabel(c)}
              accessibilityState={{ disabled: !!picked, selected: c === picked }}
              disabled={!!picked}
              onPress={() => onPick(c)}
              style={({ pressed }) => [
                {
                  backgroundColor: k.bg,
                  borderColor: k.border,
                  borderWidth: picked && (c.correct || c === picked) ? 2 : 1,
                  borderRadius: radius.md,
                  padding: images ? spacing.sm : spacing.md,
                  opacity: pressed ? 0.75 : 1,
                },
                images && { width: "48%", alignItems: "center" },
              ]}
            >
              {c.kind === "image" ? (
                IMAGES[c.image] !== undefined && (
                  <Image source={IMAGES[c.image]!} style={{ width: "100%", aspectRatio: 3 / 2 }} resizeMode="contain" />
                )
              ) : (
                <Text style={{ color: k.fg, fontSize: fontSize.body, fontWeight: "600" }}>{c.text}</Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
