import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
  StatusBar as RNStatusBar,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";

import { BOGOR_REGION } from "../../config/maps";
import { routes, LatLng } from "../../data/routes";
import { PublicVehicle } from "../../types";
import { calcDistance, fetchRoutePolyline } from "../../utils/directions";
import { colors } from "../../theme/colors";
import { findRouteForVehicle } from "../../data/routes";

type Props = {
  vehicles: PublicVehicle[];
  onBack: () => void;
  onRefresh: () => Promise<void>;
};

type RoutePolylines = Record<string, LatLng[]>;

export function AllBusMapScreen({ vehicles, onBack, onRefresh }: Props) {
  const mapRef = useRef<MapView>(null);
  const [polylines, setPolylines] = useState<RoutePolylines>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void loadPolylines();
  }, []);

  const loadPolylines = async () => {
    setLoading(true);
    const results = await Promise.all(
      routes.map(async (route) => {
        const points = await fetchRoutePolyline(route);
        return { id: route.id, points };
      }),
    );
    const map: RoutePolylines = {};
    for (const { id, points } of results) {
      map[id] = points;
    }
    setPolylines(map);
    setLoading(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  const recenter = () => {
    mapRef.current?.animateToRegion(BOGOR_REGION, 500);
  };

  const activeCount = vehicles.filter((v) => v.status === "ACTIVE").length;

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={BOGOR_REGION}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
      >
        {routes.map((route) => {
          const pts = polylines[route.id];
          if (!pts || pts.length < 2) return null;
          return (
            <Polyline
              key={route.id}
              coordinates={pts}
              strokeColor={route.color}
              strokeWidth={4}
            />
          );
        })}

        {vehicles.map((vehicle) => {
          const hasCoords =
            typeof vehicle.latest_lat === "number" &&
            typeof vehicle.latest_lon === "number";
          if (!hasCoords) return null;

          const route = findRouteForVehicle(vehicle.route_name);
          const isActive = vehicle.status === "ACTIVE";
          const markerColor = isActive ? (route?.color ?? colors.primaryGreen) : colors.textMuted;

          return (
            <Marker
              key={vehicle.vehicle_id}
              coordinate={{
                latitude: vehicle.latest_lat!,
                longitude: vehicle.latest_lon!,
              }}
              tracksViewChanges={false}
            >
              <View style={[styles.vehicleMarker, { backgroundColor: markerColor }]}>
                <Text style={styles.vehicleMarkerText}>{route?.id ?? "?"}</Text>
              </View>
            </Marker>
          );
        })}
      </MapView>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={colors.primaryGreen} size="small" />
          <Text style={styles.loadingText}>Memuat rute trayek...</Text>
        </View>
      )}

      <View style={[styles.topBar, { paddingTop: Platform.OS === "ios" ? 56 : (RNStatusBar.currentHeight ?? 24) + 12 }]}>
        <Pressable style={styles.backButton} onPress={onBack} accessibilityRole="button" accessibilityLabel="Kembali">
          <Text style={styles.backIcon}>{"‹"}</Text>
        </Pressable>

        <View style={styles.infoPill}>
          <View style={styles.infoDot} />
          <Text style={styles.infoText}>{activeCount} aktif · {vehicles.length} terpantau</Text>
        </View>
      </View>

      <View style={styles.bottomControls}>
        <Pressable
          style={styles.controlButton}
          onPress={handleRefresh}
          accessibilityRole="button"
          accessibilityLabel="Segarkan"
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={colors.primaryGreen} />
          ) : (
            <Text style={styles.controlIcon}>⟳</Text>
          )}
        </Pressable>

        <Pressable style={styles.controlButton} onPress={recenter} accessibilityRole="button" accessibilityLabel="Ke posisi saya">
          <Text style={styles.controlIcon}>◎</Text>
        </Pressable>
      </View>

      <View style={styles.legend}>
        {routes.map((route) => (
          <View key={route.id} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: route.color }]} />
            <Text style={styles.legendText}>{route.id}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingOverlay: {
    position: "absolute",
    top: "50%",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  backIcon: {
    fontSize: 28,
    color: colors.textPrimary,
    lineHeight: 32,
    marginTop: -2,
  },
  infoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  infoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#27AE60",
  },
  infoText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  bottomControls: {
    position: "absolute",
    right: 16,
    bottom: 120,
    gap: 10,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.97)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  controlIcon: {
    fontSize: 22,
    color: colors.primaryGreen,
  },
  legend: {
    position: "absolute",
    left: 16,
    bottom: 36,
    flexDirection: "row",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  vehicleMarker: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  vehicleMarkerText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#fff",
  },
});
