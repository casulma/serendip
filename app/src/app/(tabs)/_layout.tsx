import { Tabs } from "expo-router/tabs";
import { Text, type ColorValue } from "react-native";
import { fr } from "../../i18n/fr";
import { useTheme } from "../../ui/theme";

// Plain glyphs keep the tab bar dependency-free (no icon font).
const icon = (glyph: string) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return <Text style={{ color, fontSize: 18 }}>{glyph}</Text>;
  };

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: t.background },
        headerTintColor: t.text,
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border },
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.muted,
        sceneStyle: { backgroundColor: t.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: fr.tabs.home, tabBarIcon: icon("⌂") }} />
      <Tabs.Screen name="decouvrir" options={{ title: fr.tabs.discover, tabBarIcon: icon("✦") }} />
      <Tabs.Screen name="carnet" options={{ title: fr.tabs.notebook, tabBarIcon: icon("☰") }} />
      <Tabs.Screen name="reglages" options={{ title: fr.tabs.settings, tabBarIcon: icon("⚙") }} />
    </Tabs>
  );
}
