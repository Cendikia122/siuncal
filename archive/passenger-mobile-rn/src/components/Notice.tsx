import { StyleSheet, Text, View } from "react-native";

import { colors } from "../theme/colors";
import { radius } from "../theme/layout";

type Props = {
  text: string;
  tone: "success" | "warning" | "danger";
};

export function Notice({ text, tone }: Props) {
  const background =
    tone === "success" ? colors.lightGreen : tone === "danger" ? colors.dangerLight : colors.lightYellow;
  const color =
    tone === "success" ? colors.darkGreen : tone === "danger" ? colors.danger : colors.accentYellow;

  return (
    <View style={[styles.notice, { backgroundColor: background }]}>
      <Text style={[styles.text, { color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  text: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
});
