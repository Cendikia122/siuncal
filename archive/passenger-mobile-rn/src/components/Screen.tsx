import { PropsWithChildren } from "react";
import { ScrollView, StyleSheet } from "react-native";

import { colors } from "../theme/colors";
import { screenPadding, sectionGap } from "../theme/layout";

type Props = PropsWithChildren<{
  bottomInset?: number;
}>;

export function Screen({ children, bottomInset = 24 }: Props) {
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset }]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  content: {
    paddingHorizontal: screenPadding,
    paddingTop: 16,
    gap: sectionGap,
  },
});
