import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { countAvailable, getSettings, overview, type Overview } from "../../db/repo";
import { fr } from "../../i18n/fr";
import { Button, Card, Muted, Overline, ProgressBar, RetryBadge } from "../../ui/components";
import { fontSize, spacing, useTheme } from "../../ui/theme";

export default function Home() {
  const db = useSQLiteContext();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [o, setO] = useState<Overview | undefined>();
  const [size, setSize] = useState(10);
  const [available, setAvailable] = useState(0);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        setO(await overview(db));
        setSize((await getSettings(db)).sessionSize);
        setAvailable(await countAvailable(db));
      })();
    }, [db]),
  );

  if (!o) return null;
  const rate = o.answered > 0 ? Math.round((o.correct / o.answered) * 100) : undefined;

  return (
    <ScrollView
      style={{ backgroundColor: t.background }}
      contentContainerStyle={{ padding: spacing.md, paddingTop: insets.top + spacing.lg, gap: spacing.md }}
    >
      <View style={{ gap: spacing.xs, marginBottom: spacing.sm }}>
        <Text style={{ color: t.text, fontSize: fontSize.hero, fontWeight: "900", letterSpacing: -1 }}>{fr.appName}</Text>
        <Muted>{fr.home.tagline}</Muted>
      </View>

      <Card style={{ gap: spacing.md }}>
        {available === 0 ? (
          <Muted>{fr.home.noQuestions}</Muted>
        ) : (
          <Button label={fr.home.newGame(size)} onPress={() => router.push({ pathname: "/partie", params: { mode: "nouvelle" } })} />
        )}
        <View style={{ gap: spacing.xs }}>
          <ProgressBar value={o.total ? o.seen / o.total : 0} />
          <Muted>
            {fr.home.progress(o.seen, o.total)}
            {rate !== undefined ? ` · ${fr.home.rate(rate)}` : ""}
          </Muted>
        </View>
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Overline>{fr.home.toReview(o.toReview)}</Overline>
          {o.toReview > 0 && <RetryBadge />}
        </View>
        <Muted>{fr.home.toReviewHint}</Muted>
        {o.toReview > 0 && (
          <Button label={fr.home.reviewNow} variant="secondary" onPress={() => router.push({ pathname: "/partie", params: { mode: "erreurs" } })} />
        )}
      </Card>
    </ScrollView>
  );
}
