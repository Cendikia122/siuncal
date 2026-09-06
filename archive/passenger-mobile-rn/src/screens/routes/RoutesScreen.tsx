import {
  Bus1Stroke,
  CalendarDaysStroke,
  MapMarker5Stroke,
  Route1Stroke,
} from "@lineiconshq/free-icons";
import { StyleSheet, Text, View } from "react-native";

import { Screen } from "../../components/Screen";
import { SentraIcon } from "../../components/icons/SentraIcon";
import { VehicleCard } from "../../components/vehicles/VehicleCard";
import { routes, RouteData } from "../../data/routes";
import { cardBorderWidth, colors, shadows } from "../../theme/colors";
import { cardGap, radius } from "../../theme/layout";
import { PublicVehicle } from "../../types";

type Props = {
  vehicles: PublicVehicle[];
};

export function RoutesScreen({ vehicles }: Props) {
  return (
    <Screen>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Informasi Trayek</Text>
        <Text style={styles.pageSubtitle}>
          Koridor resmi angkot Bogor dan kendaraan yang sedang terpantau.
        </Text>
      </View>

      {/* Operator Badge */}
      <View style={[styles.operatorCard, shadows.card]}>
        <View style={styles.operatorIcon}>
          <SentraIcon icon={Bus1Stroke} color={colors.primaryGreen} size={20} />
        </View>
        <View style={styles.operatorText}>
          <Text style={styles.operatorTitle}>Angkot Kota Bogor</Text>
          <Text style={styles.operatorMeta}>Data publik dibatasi untuk keamanan operasional.</Text>
        </View>
      </View>

      {/* Route List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Semua Trayek</Text>
        <View style={styles.cardList}>
          {routes.map((route) => (
            <RouteCard
              key={route.id}
              route={route}
              activeVehicles={vehicles.filter((v) => {
                const name = v.route_name?.toLowerCase() ?? "";
                return name.includes(route.id) || name.includes(route.name.toLowerCase());
              }).length}
            />
          ))}
        </View>
      </View>

      {/* Vehicles Section */}
      {vehicles.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kendaraan Terpantau</Text>
          <View style={styles.cardList}>
            {vehicles.slice(0, 5).map((vehicle) => (
              <VehicleCard key={vehicle.vehicle_id} vehicle={vehicle} />
            ))}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

function RouteCard({ route, activeVehicles }: { route: RouteData; activeVehicles: number }) {
  return (
    <View style={[styles.routeCard, shadows.card]}>
      {/* 4px solid left border */}
      <View style={[styles.routeRail, { backgroundColor: route.color }]} />

      {/* 32×32 number badge */}
      <View style={[styles.routeBadge, { backgroundColor: route.color }]}>
        <Text style={styles.routeBadgeText}>{route.id}</Text>
      </View>

      <View style={styles.routeBody}>
        <Text style={styles.routeTitle}>{route.name} — {route.destination}</Text>
        <View style={styles.metaRow}>
          <SentraIcon icon={CalendarDaysStroke} color={colors.textMuted} size={13} />
          <Text style={styles.metaText}>{route.hours}</Text>
        </View>
        <View style={styles.metaRow}>
          <SentraIcon icon={Route1Stroke} color={colors.textMuted} size={13} />
          <Text style={styles.metaText}>Headway {route.headway}</Text>
        </View>
        <View style={styles.stopRow}>
          {route.stops.slice(0, 3).map((stop) => (
            <View key={stop.name} style={styles.stopChip}>
              <SentraIcon icon={MapMarker5Stroke} color={colors.primaryGreen} size={11} />
              <Text style={styles.stopText}>{stop.name}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Active count */}
      <View style={styles.activeBadge}>
        <Text style={styles.activeCount}>{activeVehicles}</Text>
        <Text style={styles.activeLabel}>aktif</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    gap: 5,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  pageSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },

  operatorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.card,
    borderWidth: cardBorderWidth,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
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
  operatorText: {
    flex: 1,
    gap: 2,
  },
  operatorTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  operatorMeta: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },

  section: {
    gap: cardGap,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  cardList: {
    gap: cardGap,
  },

  routeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.card,
    borderWidth: cardBorderWidth,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 14,
    paddingLeft: 18,
    overflow: "hidden",
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
    fontWeight: "700",
    color: colors.textPrimary,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metaText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  stopRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginTop: 2,
  },
  stopChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.lightGreen,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  stopText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.darkGreen,
    letterSpacing: 0.08 * 11,
  },
  activeBadge: {
    minWidth: 40,
    alignItems: "center",
    borderRadius: radius.badge,
    backgroundColor: colors.lightYellow,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  activeCount: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.accentYellow,
  },
  activeLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.textSecondary,
    letterSpacing: 0.08 * 10,
  },
});
