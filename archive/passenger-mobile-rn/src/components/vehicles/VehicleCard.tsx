import { Bus1Stroke, MapMarker5Stroke } from "@lineiconshq/free-icons";
import { StyleSheet, Text, View } from "react-native";

import { SentraIcon } from "../icons/SentraIcon";
import { cardBorderWidth, colors, shadows } from "../../theme/colors";
import { radius } from "../../theme/layout";
import { findRouteForVehicle } from "../../data/routes";
import { formatLastSeen } from "../../format";
import { PublicVehicle } from "../../types";

type Props = {
  vehicle: PublicVehicle;
};

export function VehicleCard({ vehicle }: Props) {
  const route = findRouteForVehicle(vehicle.route_name);
  const routeColor = route?.color ?? colors.primaryGreen;
  const status = vehicle.status ?? "UNKNOWN";
  const eta = status === "ACTIVE" ? `${2 + (vehicle.plate_no.length % 8)} menit` : "—";
  const statusBg =
    status === "ACTIVE" ? colors.lightGreen : status === "IDLE" ? colors.lightYellow : colors.surfaceAlt;

  return (
    <View style={[styles.card, shadows.card]}>
      {/* Route rail */}
      <View style={[styles.routeRail, { backgroundColor: routeColor }]} />

      {/* Route badge */}
      <View style={[styles.routeBadge, { backgroundColor: routeColor }]}>
        <Text style={styles.routeBadgeText}>{route?.id ?? "?"}</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.rowBetween}>
          <Text style={styles.eta}>{eta}</Text>
          <View style={[styles.statusPill, { backgroundColor: statusBg }]}>
            <Text style={styles.statusText}>{status}</Text>
          </View>
        </View>
        <Text style={styles.plate}>{vehicle.plate_no}</Text>
        <View style={styles.metaRow}>
          <SentraIcon icon={Bus1Stroke} color={colors.textMuted} size={13} />
          <Text style={styles.metaText}>{vehicle.route_name ?? "Trayek belum tersedia"}</Text>
        </View>
        <View style={styles.metaRow}>
          <SentraIcon icon={MapMarker5Stroke} color={colors.textMuted} size={13} />
          <Text style={styles.metaText}>{formatLastSeen(vehicle.last_seen_at)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
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
    marginTop: 2,
  },
  routeBadgeText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#fff",
  },
  body: {
    flex: 1,
    gap: 4,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  eta: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  statusPill: {
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textPrimary,
    letterSpacing: 0.08 * 10,
  },
  plate: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metaText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
  },
});
