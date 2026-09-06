import { StyleSheet, Text, View } from "react-native";

import { colors } from "../theme/colors";

type Props = {
  routeId?: string;
  color?: string;
  size?: number;
};

export function AngkotMark({ routeId = "03", color = colors.primaryGreen, size = 42 }: Props) {
  return (
    <View style={[styles.root, { width: size, height: size, borderRadius: size * 0.34, backgroundColor: color }]}>
      <Text style={[styles.text, { fontSize: size * 0.31 }]}>{routeId}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    color: colors.surface,
    fontWeight: "900",
  },
});
