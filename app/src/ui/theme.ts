import { useColorScheme } from "react-native";
import type { CategoryId } from "../pack/types";

const light = {
  background: "#F6F2EA",
  card: "#FFFFFF",
  raised: "#FBF8F2",
  text: "#1F1D1A",
  muted: "#6E685F",
  border: "#E6DFD3",
  accent: "#2F6F5E",
  accentText: "#FFFFFF",
  accentSoft: "#E3EFEA",
  success: "#2E7D4F",
  successSoft: "#E2F2E8",
  retry: "#B86E00",
  retrySoft: "#FBEBD3",
  danger: "#B3412E",
  dangerSoft: "#F8E4DF",
  chip: "#EFE9DF",
  shadow: "#3B2F1E",
};

const dark: typeof light = {
  background: "#121110",
  card: "#1C1A18",
  raised: "#242220",
  text: "#F1EDE6",
  muted: "#A39D93",
  border: "#33302B",
  accent: "#6FB8A3",
  accentText: "#0E1513",
  accentSoft: "#1E2F2A",
  success: "#7CC79A",
  successSoft: "#1D2E24",
  retry: "#F0B45C",
  retrySoft: "#3A2A14",
  danger: "#E58A76",
  dangerSoft: "#35211C",
  chip: "#2A2723",
  shadow: "#000000",
};

export type Theme = typeof light & { dark: boolean };

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? { ...dark, dark: true } : { ...light, dark: false };
}

// One hue per category: text colour on a soft tint of the same hue.
const CATEGORY_HUES: Record<CategoryId, { light: string; dark: string }> = {
  histoire: { light: "#8A5527", dark: "#E0A877" },
  geographie: { light: "#23715F", dark: "#7CCBB5" },
  sciences: { light: "#3556A0", dark: "#9DB4EA" },
  nature: { light: "#4B7424", dark: "#A9D27F" },
  "arts-litterature": { light: "#8C3569", dark: "#E39CC6" },
  musique: { light: "#6B3FA0", dark: "#C3A6EC" },
  "cinema-tv": { light: "#AD4126", dark: "#F0A08A" },
  sport: { light: "#9A6200", dark: "#EBC173" },
  langue: { light: "#22748A", dark: "#86CDE0" },
  mythologie: { light: "#7A5A12", dark: "#E6C77A" },
  gastronomie: { light: "#A33A4C", dark: "#F09AAA" },
  societe: { light: "#594F72", dark: "#BDB2DD" },
};

export function categoryColors(id: CategoryId, t: Theme): { fg: string; bg: string } {
  const hue = CATEGORY_HUES[id] ?? CATEGORY_HUES.societe;
  const fg = t.dark ? hue.dark : hue.light;
  // 8-digit hex: the same hue at low opacity.
  return { fg, bg: `${fg}${t.dark ? "26" : "1A"}` };
}

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = { sm: 10, md: 14, lg: 22, pill: 999 };
export const fontSize = { small: 13, body: 17, fact: 21, question: 23, title: 28, hero: 44 };

/** Soft elevation, readable in both themes. */
export const shadow = (t: Theme) => ({
  shadowColor: t.shadow,
  shadowOpacity: t.dark ? 0.4 : 0.08,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
});
