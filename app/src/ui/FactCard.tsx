import { useSQLiteContext } from "expo-sqlite";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { setFavorite, setKnown, setUnclear, type FactView } from "../db/repo";
import { formatDay } from "../domain/dates";
import { choiceLabel } from "../domain/quiz";
import { fr } from "../i18n/fr";
import { Action, Button, Card, CategoryChip, Muted, Overline } from "./components";
import { fontSize, radius, spacing, useTheme } from "./theme";

/**
 * A received fact with its actions (favorite, "je le savais déjà", "pas clair").
 * OpenQuizzDB facts show their question first; with `hideAnswer` the answer
 * and its anecdote stay hidden until asked for. Each action explains itself in
 * its confirmation dialog, so the card carries no hint text that could be
 * mistaken for another button's.
 */
export function FactCard({
  fact,
  onChange,
  showReview = false,
  hideAnswer = false,
}: {
  fact: FactView;
  onChange: (fact: FactView) => void;
  showReview?: boolean;
  hideAnswer?: boolean;
}) {
  const db = useSQLiteContext();
  const t = useTheme();
  const [revealed, setRevealed] = useState(!hideAnswer);
  const q = fact.question;
  const showDetails = !q || revealed;

  const toggleFavorite = async () => {
    await setFavorite(db, fact.id, !fact.favorite);
    onChange({ ...fact, favorite: !fact.favorite });
  };

  const confirm = (title: string, body: string, ok: string, run: () => Promise<void>) =>
    Alert.alert(title, body, [
      { text: fr.fact.cancel, style: "cancel" },
      { text: ok, style: "destructive", onPress: () => void run() },
    ]);

  const markKnown = () =>
    confirm(fr.fact.knewItConfirmTitle, fr.fact.knewItConfirmBody, fr.fact.knewItConfirm, async () => {
      await setKnown(db, fact.id, true);
      onChange({ ...fact, known: true });
    });

  const flagUnclear = () =>
    confirm(fr.fact.unclearConfirmTitle, fr.fact.unclearConfirmBody, fr.fact.unclearConfirm, async () => {
      await setUnclear(db, fact.id, true);
      onChange({ ...fact, unclear: true });
    });

  const undo = async () => {
    if (fact.unclear) {
      await setUnclear(db, fact.id, false);
      onChange({ ...fact, unclear: false });
    } else {
      await setKnown(db, fact.id, false);
      onChange({ ...fact, known: false });
    }
  };

  return (
    <Card style={{ flex: 1, padding: 0, overflow: "hidden" }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <CategoryChip id={fact.category} />
          {fact.favorite && <Text style={{ color: t.accent, fontSize: 18 }}>★</Text>}
        </View>

        {q ? (
          <>
            <Text style={{ color: t.text, fontSize: fontSize.question, lineHeight: 31, fontWeight: "700" }}>{q.prompt}</Text>
            {revealed ? (
              <View style={{ backgroundColor: t.accentSoft, borderRadius: radius.md, padding: spacing.md, gap: 2 }}>
                <Overline color={t.accent}>{fr.fact.answer}</Overline>
                <Text style={{ color: t.accent, fontSize: fontSize.fact, fontWeight: "800" }}>{choiceLabel(q.answer)}</Text>
              </View>
            ) : (
              <Button label={fr.fact.reveal} variant="secondary" onPress={() => setRevealed(true)} />
            )}
            {revealed && (
              <View style={{ gap: spacing.xs }}>
                <Overline>{fr.fact.didYouKnow}</Overline>
                <Text style={{ color: t.text, fontSize: fontSize.body, lineHeight: 26 }}>{fact.text}</Text>
              </View>
            )}
          </>
        ) : (
          <>
            <Overline>{fr.fact.didYouKnow}</Overline>
            <Text style={{ color: t.text, fontSize: fontSize.fact, lineHeight: 31 }}>{fact.text}</Text>
          </>
        )}

        {showDetails && fact.tags.includes("peut-changer") && <Muted>{fr.fact.mayChange}</Muted>}
        {showDetails && (
          <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
            <Pressable accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(fact.source)}>
              <Text style={{ color: t.accent, fontSize: fontSize.small, fontWeight: "700" }}>{fr.fact.source} ↗</Text>
            </Pressable>
            {fact.credit && <Muted>{fr.fact.credit(fact.credit)}</Muted>}
          </View>
        )}
        {showReview && (
          <Muted>
            {fr.fact.received(formatDay(fact.receivedDay))}
            {fact.known || fact.unclear ? "" : `\n${fr.fact.box(fact.box, formatDay(fact.dueDay))}`}
          </Muted>
        )}
      </ScrollView>

      <View style={{ borderTopWidth: 1, borderTopColor: t.border, padding: spacing.md, gap: spacing.sm }}>
        {fact.known || fact.unclear ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Muted>{fact.unclear ? fr.fact.flagged : fr.fact.known}</Muted>
            </View>
            <Action glyph="↺" label={fact.unclear ? fr.fact.unflag : fr.fact.restore} onPress={undo} />
          </View>
        ) : (
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Action glyph={fact.favorite ? "★" : "☆"} label={fr.fact.favorite} active={fact.favorite} onPress={toggleFavorite} />
            <Action glyph="✓" label={fr.fact.knewItShort} onPress={markKnown} accessibilityHint={fr.fact.knewItHint} />
            <Action glyph="?" label={fr.fact.unclear} onPress={flagUnclear} accessibilityHint={fr.fact.unclearHint} />
          </View>
        )}
      </View>
    </Card>
  );
}
