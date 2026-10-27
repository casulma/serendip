import { useColorScheme } from "react-native";

const light = {
  background: "#FAF8F4",
  card: "#FFFFFF",
  text: "#1F1D1A",
  muted: "#6B665E",
  border: "#E4DFD6",
  accent: "#2F6F5E",
  accentText: "#FFFFFF",
  danger: "#A23B2A",
  chip: "#EFEAE1",
};

const dark: typeof light = {
  background: "#141311",
  card: "#1E1C19",
  text: "#F1EDE6",
  muted: "#A39D93",
  border: "#34312C",
  accent: "#6FB8A3",
  accentText: "#0E1513",
  danger: "#E07A66",
  chip: "#2A2723",
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? dark : light;
}

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const fontSize = { small: 13, body: 17, fact: 21, title: 26 };
