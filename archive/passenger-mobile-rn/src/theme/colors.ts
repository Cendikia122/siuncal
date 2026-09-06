import { StyleSheet } from "react-native";

export const colors = {
  // Brand
  primaryGreen: "#4A7C59",
  lightGreen: "#EBF3EE",
  darkGreen: "#2E5040",
  accentYellow: "#C8A23E",
  lightYellow: "#FBF4E1",

  // Surfaces
  pageBg: "#F4F4F4",
  surface: "#FFFFFF",
  surfaceAlt: "#F4F4F4",
  warmWhite: "#F4F4F4",

  // Text
  textPrimary: "#1A1A1A",
  textSecondary: "#6C7280",
  textMuted: "#9CA3AF",

  // Borders
  border: "#E5E0D4",
  cardBorder: "rgba(0,0,0,0.09)",

  // Semantic
  danger: "#B94A48",
  dangerLight: "#FBE8E6",
  blue: "#4E8AC8",
  mapRoad: "#D8D1C3",
  mapPark: "#DDEADB",
} as const;

export const cardBorderWidth = StyleSheet.hairlineWidth;

export const shadows = {
  card: {
    shadowColor: "#000000",
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
} as const;
