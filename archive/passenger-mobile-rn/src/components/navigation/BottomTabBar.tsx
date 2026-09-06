import {
  Flag1Stroke,
  Home2Stroke,
  User4Stroke,
} from "@lineiconshq/free-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { SentraIcon } from "../icons/SentraIcon";
import { cardBorderWidth, colors } from "../../theme/colors";

export type TabKey = "home" | "report" | "profile";

type Props = {
  active: TabKey;
  onChange: (tab: TabKey) => void;
};

const tabs = [
  { key: "home", label: "Beranda", icon: Home2Stroke },
  { key: "report", label: "Lapor", icon: Flag1Stroke },
  { key: "profile", label: "Profil", icon: User4Stroke },
] satisfies { key: TabKey; label: string; icon: typeof Home2Stroke }[];

export function BottomTabBar({ active, onChange }: Props) {
  return (
    <View style={styles.root}>
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        const iconColor = isActive ? colors.primaryGreen : colors.textMuted;

        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            onPress={() => onChange(tab.key)}
            style={styles.item}
          >
            <SentraIcon icon={tab.icon} color={iconColor} size={22} />
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {tab.label}
            </Text>
            {isActive ? <View style={styles.activeDot} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderTopWidth: cardBorderWidth,
    borderTopColor: colors.cardBorder,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 20,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    minHeight: 52,
    position: "relative",
  },
  label: {
    fontSize: 10,
    fontWeight: "500",
    color: colors.textMuted,
    letterSpacing: 0.08 * 10,
  },
  labelActive: {
    color: colors.primaryGreen,
    fontWeight: "700",
  },
  activeDot: {
    position: "absolute",
    bottom: -6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primaryGreen,
  },
});
