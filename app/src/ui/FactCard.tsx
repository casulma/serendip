import { useSQLiteContext } from "expo-sqlite";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { setFavorite, setKnown, setUnclear, type FactView } from "../db/repo";
import { formatDay } from "../domain/dates";
import { fr } from "../i18n/fr";
import { categoryLabel } from "../pack/types";
import { Button, Chip, Muted } from "./components";
import { fontSize, spacing, useTheme } from "./theme";

/**
 * A received fact with its actions (favorite, "je le savais déjà", "pas clair", source).
 * OpenQuizzDB facts show their question first; with `hideAnswer` the answer
 * and its anecdote stay hidden until asked for.
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

  const markKnown = () => {
    Alert.alert(fr.fact.knewItConfirmTitle, fr.fact.knewItConfirmBody, [
      { text: fr.fact.cancel, style: "cancel" },
      {
        text: fr.fact.knewItConfirm,
        style: "destructive",
        onPress: async () => {
          await setKnown(db, fact.id, true);
          onChange({ ...fact, known: true });
        },
      },
    ]);
  };

  const flagUnclear = () => {
    Alert.alert(fr.fact.unclearConfirmTitle, fr.fact.unclearConfirmBody, [
      { text: fr.fact.cancel, style: "cancel" },
      {
        text: fr.fact.unclearConfirm,
        style: "destructive",
        onPress: async () => {
          await setUnclear(db, fact.id, true);
          onChange({ ...fact, unclear: true });
        },
      },
    ]);
  };

  const unflag = async () => {
    await setUnclear(db, fact.id, false);
    onChange({ ...fact, unclear: false });
  };

  const restore = async () => {
    await setKnown(db, fact.id, false);
    onChange({ ...fact, known: false });
  };

  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <ScrollView contentContainerStyle={{ gap: spacing.md }}>
        <Chip label={categoryLabel(fact.category)} />
        {q ? (
          <>
            <Text style={{ color: t.text, fontSize: fontSize.fact, lineHeight: 30, fontWeight: "600" }}>{q.prompt}</Text>
            {revealed ? (
              <Text style={{ color: t.accent, fontSize: fontSize.fact, lineHeight: 30, fontWeight: "700" }}>
                {q.answer.kind === "text" ? q.answer.text : q.answer.alt}
              </Text>
            ) : (
              <Button label={fr.fact.reveal} onPress={() => setRevealed(true)} />
            )}
            {revealed && <Text style={{ color: t.text, fontSize: fontSize.body, lineHeight: 26 }}>{fact.text}</Text>}
          </>
        ) : (
          <Text style={{ color: t.text, fontSize: fontSize.fact, lineHeight: 30 }}>{fact.text}</Text>
        )}
        {showDetails && fact.tags.includes("peut-changer") && <Muted>{fr.fact.mayChange}</Muted>}
        {showDetails && (
          <Pressable accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(fact.source)}>
            <Text style={{ color: t.accent, fontSize: fontSize.body, textDecorationLine: "underline" }}>{fr.fact.source}</Text>
          </Pressable>
        )}
        {showDetails && fact.credit && <Muted>{fr.fact.credit(fact.credit)}</Muted>}
        {showReview && (
          <Muted>
            {fr.fact.received(formatDay(fact.receivedDay))}
            {fact.known ? "" : `\n${fr.fact.box(fact.box, formatDay(fact.dueDay))}`}
          </Muted>
        )}
      </ScrollView>
      <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
        <Button label={fact.favorite ? `★ ${fr.fact.unfavorite}` : `☆ ${fr.fact.favorite}`} variant="secondary" onPress={toggleFavorite} />
        {fact.unclear ? (
          <>
            <Muted>{fr.fact.flagged}</Muted>
            <Button label={fr.fact.unflag} variant="secondary" onPress={unflag} />
          </>
        ) : fact.known ? (
          <>
            <Muted>{fr.fact.known}</Muted>
            <Button label={fr.fact.restore} variant="secondary" onPress={restore} />
          </>
        ) : (
          <>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Button label={fr.fact.knewIt} variant="secondary" onPress={markKnown} accessibilityHint={fr.fact.knewItHint} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label={fr.fact.unclear} variant="danger" onPress={flagUnclear} accessibilityHint={fr.fact.unclearHint} />
              </View>
            </View>
            <Muted>{fr.fact.knewItHint}</Muted>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, borderWidth: 1, borderRadius: 16, padding: spacing.lg },
});
