import type { RadiusScale, Theme, ThemeColors } from "./names.ts";

/**
 * Vireo "Oliwka" color palette for the light and dark themes.
 *
 * Neutrals lean slightly green so they read as part of the brand rather than
 * a default grey. `safe` is a cooler, bluer green than `primary`, so a brand
 * button is never mistaken for "you can afford it".
 */
export const colors: ThemeColors = {
  light: {
    background: "#F5F6F1",
    foreground: "#1B2119",
    card: "#FFFFFF",
    cardForeground: "#1B2119",
    popover: "#FFFFFF",
    popoverForeground: "#1B2119",
    primary: "#3D5A2E",
    primaryForeground: "#F5F8EF",
    secondary: "#E3EBC4",
    secondaryForeground: "#2E4322",
    muted: "#E9ECE3",
    mutedForeground: "#5A6356",
    accent: "#E6EBDC",
    accentForeground: "#1B2119",
    destructive: "#B3261E",
    border: "#DDE1D6",
    input: "#7F8A76",
    ring: "#5F7F45",
    safe: "#2A7549",
    safeSubtle: "#E1F1E6",
    caution: "#8F5C00",
    cautionSubtle: "#F8EBCF",
    risk: "#B3261E",
    riskSubtle: "#FBE4E1",
    chart1: "#3D5A2E",
    chart2: "#B06F1C",
    chart3: "#3A7688",
    chart4: "#8A5A9E",
    chart5: "#6F7F2E",
  },
  dark: {
    background: "#121611",
    foreground: "#E7EBE1",
    card: "#1A1F18",
    cardForeground: "#E7EBE1",
    popover: "#1F251D",
    popoverForeground: "#E7EBE1",
    primary: "#A9C47F",
    primaryForeground: "#16200F",
    secondary: "#2C3A22",
    secondaryForeground: "#D3E3B0",
    muted: "#262C23",
    mutedForeground: "#9CA695",
    accent: "#2A3127",
    accentForeground: "#E7EBE1",
    destructive: "#F2877E",
    border: "#2E362B",
    input: "#6A7563",
    ring: "#A9C47F",
    safe: "#6CC58B",
    safeSubtle: "#1C3325",
    caution: "#E6B04F",
    cautionSubtle: "#3A2D12",
    risk: "#F2877E",
    riskSubtle: "#3D1C19",
    chart1: "#A9C47F",
    chart2: "#E0A15A",
    chart3: "#6FB3C4",
    chart4: "#C39AD6",
    chart5: "#D6D97A",
  },
};

/** Corner radii: controls use `lg`, cards `2xl`, chips `rounded-full`. */
export const radius: RadiusScale = {
  sm: "6px",
  md: "8px",
  lg: "10px",
  xl: "12px",
  "2xl": "16px",
  "3xl": "20px",
  "4xl": "24px",
};

/** The complete Vireo theme. */
export const theme: Theme = { colors, radius };
