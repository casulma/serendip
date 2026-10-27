import { Stack } from "expo-router";
import { SQLiteProvider, type SQLiteDatabase } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { Suspense } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { importPackIfNeeded } from "../db/importPack";
import { migrate } from "../db/schema";
import { fr } from "../i18n/fr";
import { spacing, useTheme } from "../ui/theme";

async function init(db: SQLiteDatabase) {
  await migrate(db);
  await importPackIfNeeded(db);
}

function Loading() {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, backgroundColor: t.background, padding: spacing.lg }}>
      <ActivityIndicator color={t.accent} />
      <Text style={{ color: t.text, fontSize: 17 }}>{fr.loading}</Text>
      <Text style={{ color: t.muted, fontSize: 13, textAlign: "center" }}>{fr.loadingDetail}</Text>
    </View>
  );
}

export default function RootLayout() {
  const t = useTheme();
  return (
    <Suspense fallback={<Loading />}>
      <SQLiteProvider databaseName="serendip.db" onInit={init} useSuspense>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: t.background },
            headerTintColor: t.text,
            contentStyle: { backgroundColor: t.background },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="fait/[id]" options={{ title: "" }} />
        </Stack>
      </SQLiteProvider>
    </Suspense>
  );
}
