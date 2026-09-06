import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Platform,
  StatusBar as RNStatusBar,
  SafeAreaView,
} from "react-native";

import { routes, RouteData } from "../../data/routes";
import { cardBorderWidth, colors, shadows } from "../../theme/colors";
import { cardGap, radius, screenPadding } from "../../theme/layout";

type Props = {
  onBack: () => void;
};

export function BusLaneScreen({ onBack }: Props) {
  return (
    <SafeAreaView style={styles.root}>
      <View
        style={[
          styles.header,
          { paddingTop: Platform.OS === "android" ? (RNStatusBar.currentHeight ?? 24) + 4 : 0 },
        ]}
      >
        <Pressable
          style={styles.backButton}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Kembali"
        >
          <Text style={styles.backIcon}>{"‹"}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Informasi Trayek</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Operator info */}
        <View style={[styles.operatorCard, shadows.card]}>
          <View style={styles.operatorIcon}>
            <Text style={styles.operatorEmoji}>🚐</Text>
          </View>
          <View style={styles.operatorText}>
            <Text style={styles.operatorName}>Angkot Kota Bogor</Text>
            <Text style={styles.operatorMeta}>{routes.length} trayek beroperasi</Text>
          </View>
        </View>

        {/* Route list */}
        <View style={styles.routeList}>
          {routes.map((route) => (
            <RouteListItem key={route.id} route={route} />
          ))}
        </View>

        <Text style={styles.footerText}>
          Data operasional diperbarui berkala oleh Dishub Kota Bogor.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function RouteListItem({ route }: { route: RouteData }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.routeItem, pressed && styles.routeItemPressed, shadows.card]}
      accessibilityRole="button"
    >
      {/* 4px solid left rail */}
      <View style={[styles.routeRail, { backgroundColor: route.color }]} />

      {/* 32×32 badge */}
      <View style={[styles.routeBadge, { backgroundColor: route.color }]}>
        <Text style={styles.routeBadgeText}>{route.id}</Text>
      </View>

      <View style={styles.routeBody}>
        <Text style={styles.routeTitle}>
          {route.stops[0]!.name}
          <Text style={styles.routeArrow}>{" › "}</Text>
          {route.stops[route.stops.length - 1]!.name}
        </Text>
        <View style={styles.routeMeta}>
          <Text style={styles.routeMetaTime}>{route.hours}</Text>
          <Text style={styles.routeMetaDot}>·</Text>
          <Text style={styles.routeMetaHeadway}>{route.headway}</Text>
        </View>
      </View>

      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    paddingHorizontal: screenPadding,
    paddingBottom: 12,
    borderBottomWidth: cardBorderWidth,
    borderBottomColor: colors.cardBorder,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: {
    fontSize: 30,
    color: colors.textPrimary,
    lineHeight: 36,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
  },
  headerSpacer: {
    width: 40,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: screenPadding,
    gap: cardGap,
    paddingBottom: 36,
  },

  operatorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: cardBorderWidth,
    borderColor: colors.cardBorder,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  operatorIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.badge,
    backgroundColor: colors.lightGreen,
    alignItems: "center",
    justifyContent: "center",
  },
  operatorEmoji: {
    fontSize: 20,
  },
  operatorText: {
    flex: 1,
    gap: 2,
  },
  operatorName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  operatorMeta: {
    fontSize: 13,
    color: colors.textSecondary,
  },

  routeList: {
    gap: cardGap,
  },
  routeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: cardBorderWidth,
    borderColor: colors.cardBorder,
    paddingVertical: 12,
    paddingHorizontal: 14,
    paddingLeft: 18,
    overflow: "hidden",
  },
  routeItemPressed: {
    backgroundColor: "#F8F8F9",
  },
  routeRail: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  routeBadge: {
    width: 32,
    height: 32,
    borderRadius: radius.badge,
    alignItems: "center",
    justifyContent: "center",
  },
  routeBadgeText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#fff",
  },
  routeBody: {
    flex: 1,
    gap: 4,
  },
  routeTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
    lineHeight: 20,
  },
  routeArrow: {
    color: colors.textMuted,
    fontWeight: "400",
  },
  routeMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  routeMetaTime: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  routeMetaDot: {
    fontSize: 13,
    color: colors.textMuted,
  },
  routeMetaHeadway: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  chevron: {
    fontSize: 18,
    color: colors.textMuted,
    fontWeight: "300",
  },

  footerText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 19,
  },
});
