import {
  Bus1Stroke,
  MapMarker1Stroke,
  RefreshCircle1ClockwiseStroke,
} from "@lineiconshq/free-icons";
import { ActivityIndicator, Dimensions, Pressable, StyleSheet, Text, View } from "react-native";

import { AngkotMark } from "../AngkotMark";
import { SentraIcon } from "../icons/SentraIcon";
import { colors, shadows } from "../../theme/colors";
import { findRouteForVehicle } from "../../data/routes";
import { PublicVehicle } from "../../types";

const { width: screenWidth } = Dimensions.get("window");

type Props = {
  vehicles: PublicVehicle[];
  loading: boolean;
  onRefresh: () => Promise<void>;
};

const center = {
  lat: -6.595,
  lon: 106.816,
};

export function TrackingMapPreview({ vehicles, loading, onRefresh }: Props) {
  const width = screenWidth - 32;
  const height = 246;

  return (
    <View style={[styles.shell, shadows.card]}>
      <View style={[styles.map, { width, height }]}>
        <MapGrid width={width} height={height} />
        <RouteLines width={width} height={height} />
        <VehicleMarkers vehicles={vehicles} width={width} height={height} />

        <View style={[styles.userPoint, { left: width * 0.42, top: height * 0.52 }]} />
        <View style={[styles.userRing, { left: width * 0.42 - 23, top: height * 0.52 - 23 }]} />

        <View style={styles.topBadge}>
          <SentraIcon icon={Bus1Stroke} color={colors.primaryGreen} size={16} />
          <Text style={styles.topBadgeText}>{vehicles.length} angkot terpantau</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Segarkan posisi angkot"
          onPress={() => void onRefresh()}
          style={styles.refreshButton}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.primaryGreen} />
          ) : (
            <SentraIcon icon={RefreshCircle1ClockwiseStroke} color={colors.primaryGreen} size={20} />
          )}
        </Pressable>

        <View style={styles.locationBadge}>
          <View style={styles.locationIcon}>
            <SentraIcon icon={MapMarker1Stroke} color={colors.blue} size={17} />
          </View>
          <View>
            <Text style={styles.locationLabel}>Lokasi Anda</Text>
            <Text style={styles.locationValue}>Bogor, Jawa Barat</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function MapGrid({ width, height }: { width: number; height: number }) {
  return (
    <>
      <View style={[styles.park, { left: width * 0.02, top: height * 0.68, width: width * 0.36, height: height * 0.28 }]} />
      <View style={[styles.park, { left: width * 0.70, top: height * 0.08, width: width * 0.28, height: height * 0.22 }]} />
      {[0.18, 0.38, 0.61, 0.82].map((left, index) => (
        <View
          key={`v-${left}`}
          style={[
            styles.roadVertical,
            { left: width * left, width: index === 1 ? 6 : 4, transform: [{ rotate: index % 2 ? "-11deg" : "8deg" }] },
          ]}
        />
      ))}
      {[0.22, 0.45, 0.69].map((top, index) => (
        <View
          key={`h-${top}`}
          style={[
            styles.roadHorizontal,
            { top: height * top, height: index === 1 ? 6 : 4, transform: [{ rotate: index % 2 ? "8deg" : "-5deg" }] },
          ]}
        />
      ))}
      <Text style={[styles.mapLabel, { left: width * 0.48, top: height * 0.45 }]}>Bogor</Text>
      <Text style={[styles.mapPlace, { left: width * 0.12, top: height * 0.24 }]}>Merdeka</Text>
      <Text style={[styles.mapPlace, { right: width * 0.10, top: height * 0.64 }]}>Pajajaran</Text>
    </>
  );
}

function RouteLines({ width, height }: { width: number; height: number }) {
  const lines = [
    { left: 0.18, top: 0.28, width: 0.70, color: "#9C4A4A", rotate: "14deg" },
    { left: 0.12, top: 0.58, width: 0.74, color: "#6F5C9A", rotate: "-19deg" },
    { left: 0.24, top: 0.47, width: 0.58, color: colors.primaryGreen, rotate: "-2deg" },
    { left: 0.35, top: 0.72, width: 0.50, color: colors.accentYellow, rotate: "21deg" },
  ];

  return (
    <>
      {lines.map((line) => (
        <View
          key={`${line.color}-${line.rotate}`}
          style={[
            styles.routeLine,
            {
              left: width * line.left,
              top: height * line.top,
              width: width * line.width,
              backgroundColor: line.color,
              transform: [{ rotate: line.rotate }],
            },
          ]}
        />
      ))}
    </>
  );
}

function VehicleMarkers({ vehicles, width, height }: { vehicles: PublicVehicle[]; width: number; height: number }) {
  const scaleX = width / 0.12;
  const scaleY = height / 0.10;

  const fallbackPositions = [
    { x: width * 0.18, y: height * 0.30 },
    { x: width * 0.70, y: height * 0.36 },
    { x: width * 0.60, y: height * 0.68 },
  ];

  return (
    <>
      {vehicles.slice(0, 8).map((vehicle, index) => {
        const route = findRouteForVehicle(vehicle.route_name);
        const status = vehicle.status ?? "UNKNOWN";
        const hasCoordinates = typeof vehicle.latest_lat === "number" && typeof vehicle.latest_lon === "number";
        const point = hasCoordinates
          ? {
              x: width / 2 + ((vehicle.latest_lon ?? center.lon) - center.lon) * scaleX,
              y: height / 2 - ((vehicle.latest_lat ?? center.lat) - center.lat) * scaleY,
            }
          : fallbackPositions[index % fallbackPositions.length] ?? fallbackPositions[0]!;
        const x = Math.max(20, Math.min(width - 20, point.x));
        const y = Math.max(42, Math.min(height - 28, point.y));

        return (
          <View key={vehicle.vehicle_id} style={[styles.vehicleMarker, { left: x - 17, top: y - 17 }]}>
            <AngkotMark
              routeId={route?.id ?? "?"}
              color={status === "OFFLINE" ? colors.textMuted : route?.color ?? colors.primaryGreen}
              size={status === "ACTIVE" ? 34 : 29}
            />
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  map: {
    backgroundColor: "#ECE7DD",
    overflow: "hidden",
  },
  park: {
    position: "absolute",
    borderRadius: 28,
    backgroundColor: colors.mapPark,
  },
  roadVertical: {
    position: "absolute",
    top: -24,
    bottom: -24,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  roadHorizontal: {
    position: "absolute",
    left: -24,
    right: -24,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  routeLine: {
    position: "absolute",
    height: 4,
    borderRadius: 999,
    opacity: 0.88,
  },
  vehicleMarker: {
    position: "absolute",
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  userPoint: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.blue,
    borderWidth: 3,
    borderColor: colors.surface,
  },
  userRing: {
    position: "absolute",
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 1,
    borderColor: "rgba(78,138,200,0.35)",
    backgroundColor: "rgba(78,138,200,0.08)",
  },
  topBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.94)",
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  topBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.darkGreen,
  },
  refreshButton: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.94)",
    alignItems: "center",
    justifyContent: "center",
  },
  locationBadge: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.95)",
    padding: 11,
  },
  locationIcon: {
    width: 34,
    height: 34,
    borderRadius: 13,
    backgroundColor: "#EAF2FA",
    alignItems: "center",
    justifyContent: "center",
  },
  locationLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
  },
  locationValue: {
    fontSize: 13,
    fontWeight: "900",
    color: colors.textPrimary,
  },
  mapLabel: {
    position: "absolute",
    fontSize: 20,
    fontWeight: "900",
    color: "rgba(26,26,26,0.22)",
  },
  mapPlace: {
    position: "absolute",
    fontSize: 11,
    fontWeight: "800",
    color: "rgba(26,26,26,0.26)",
  },
});
