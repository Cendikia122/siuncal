import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";

import { PublicVehicle } from "../../types";
import { LatLng, routes, findRouteForVehicle } from "../../data/routes";
import { fetchRoutePolyline, calcDistance, formatDistance } from "../../utils/directions";
import { colors } from "../../theme/colors";
import { BOGOR_REGION } from "../../config/maps";

type NearbyVehicle = PublicVehicle & { distance: number };

type Props = {
  vehicles: PublicVehicle[];
  onBack: () => void;
};

type RoutePolylines = Record<string, LatLng[]>;

export function NearbyAngkotScreen({ vehicles, onBack }: Props) {
  const mapRef = useRef<MapView>(null);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [nearby, setNearby] = useState<NearbyVehicle[]>([]);
  const [polylines, setPolylines] = useState<RoutePolylines>({});
  const [loadingMap, setLoadingMap] = useState(true);

  useEffect(() => {
    void getLocation();
    void loadPolylines();
  }, []);

  useEffect(() => {
    if (userLocation) computeNearby(userLocation);
  }, [userLocation, vehicles]);

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationError("Izin lokasi ditolak. Menampilkan pusat Bogor.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coord: LatLng = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setUserLocation(coord);
      mapRef.current?.animateToRegion(
        { ...coord, latitudeDelta: 0.04, longitudeDelta: 0.04 },
        600,
      );
    } catch {
      setLocationError("Gagal mendapatkan lokasi.");
    }
  };

  const loadPolylines = async () => {
    setLoadingMap(true);
    const results = await Promise.all(
      routes.map(async (route) => ({
        id: route.id,
        points: await fetchRoutePolyline(route),
      })),
    );
    const map: RoutePolylines = {};
    for (const { id, points } of results) map[id] = points;
    setPolylines(map);
    setLoadingMap(false);
  };

  const computeNearby = (loc: LatLng) => {
    const withDist = vehicles
      .filter((v) => typeof v.latest_lat === "number" && typeof v.latest_lon === "number")
      .map((v) => ({
        ...v,
        distance: calcDistance(loc, {
          latitude: v.latest_lat as number,
          longitude: v.latest_lon as number,
        }),
      }))
      .sort((a, b) => a.distance - b.distance);
    setNearby(withDist.slice(0, 10));
  };

  const activeUserLoc = userLocation ?? { latitude: BOGOR_REGION.latitude, longitude: BOGOR_REGION.longitude };

  return (
    <SafeAreaView style={styles.root}>
      <View style={[styles.header, { paddingTop: Platform.OS === "android" ? (RNStatusBar.currentHeight ?? 24) + 4 : 0 }]}>
        <Pressable style={styles.backButton} onPress={onBack} accessibilityRole="button">
          <Text style={styles.backIcon}>{"‹"}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Angkot Terdekat</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.mapContainer}>
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
                strokeWidth={3}
              />
            );
          })}

          {nearby.slice(0, 5).map((vehicle) => {
            const route = findRouteForVehicle(vehicle.route_name);
            const markerColor = vehicle.status === "ACTIVE" ? (route?.color ?? colors.primaryGreen) : colors.textMuted;
            return (
              <Marker
                key={vehicle.vehicle_id}
                coordinate={{
                  latitude: vehicle.latest_lat as number,
                  longitude: vehicle.latest_lon as number,
                }}
                tracksViewChanges={false}
              >
                <View style={[markerStyles.vehicleMarker, { backgroundColor: markerColor }]}>
                  <Text style={markerStyles.vehicleMarkerText}>{route?.id ?? "?"}</Text>
                </View>
              </Marker>
            );
          })}
        </MapView>

        {loadingMap && (
          <View style={styles.mapLoading}>
            <ActivityIndicator size="small" color={colors.primaryGreen} />
          </View>
        )}

        <View style={styles.locationPill}>
          <Text style={styles.locationPinEmoji}>📍</Text>
          <View>
            <Text style={styles.locationPillLabel}>Lokasi Anda</Text>
            <Text style={styles.locationPillValue}>
              {locationError ?? "Jawa Barat, Indonesia"}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.listContainer}>
        {nearby.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🚐</Text>
            <Text style={styles.emptyTitle}>Belum ada angkot terdekat</Text>
            <Text style={styles.emptyBody}>Data angkot akan muncul saat kendaraan aktif mengirim posisi GPS.</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.listContent}>
            {nearby.map((vehicle, idx) => {
              const route = findRouteForVehicle(vehicle.route_name);
              const markerColor = vehicle.status === "ACTIVE" ? (route?.color ?? colors.primaryGreen) : colors.textMuted;
              const lastStop = vehicle.route_name ?? "–";
              const etaMin = Math.max(1, Math.round(vehicle.distance / 250));

              return (
                <View key={vehicle.vehicle_id} style={styles.vehicleCard}>
                  <View style={[styles.routeBadge, { backgroundColor: markerColor }]}>
                    <Text style={styles.routeBadgeText}>{route?.id ?? "?"}</Text>
                  </View>

                  <View style={styles.vehicleInfo}>
                    <View style={styles.vehicleTopRow}>
                      <Text style={styles.vehicleEta}>
                        <Text style={styles.vehicleEtaNum}>{etaMin}</Text>
                        {" "}Menit
                      </Text>
                      <Text style={styles.vehicleTime}>{new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</Text>
                    </View>
                    <View style={styles.vehicleBottomRow}>
                      <Text style={styles.vehiclePlate}>🚐 {vehicle.vehicle_id}</Text>
                      <Text style={styles.vehicleRoute} numberOfLines={1}>
                        Tujuan akhir {route?.destination ?? lastStop}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.distancePill}>
                    <Text style={styles.distanceText}>{formatDistance(vehicle.distance)}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const markerStyles = StyleSheet.create({
  vehicleMarker: {
    width: 30,
    height: 30,
    borderRadius: 9,
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EAEAEA",
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
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
  },
  headerSpacer: {
    width: 40,
  },
  mapContainer: {
    height: "45%",
    position: "relative",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapLoading: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  locationPill: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderRadius: 16,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  locationPinEmoji: {
    fontSize: 22,
  },
  locationPillLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  locationPillValue: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  listContainer: {
    flex: 1,
    backgroundColor: "#F5F6FA",
  },
  listContent: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 32,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 19,
  },
  vehicleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  routeBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  routeBadgeText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#fff",
  },
  vehicleInfo: {
    flex: 1,
    gap: 5,
  },
  vehicleTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  vehicleEta: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  vehicleEtaNum: {
    fontSize: 22,
    fontWeight: "900",
    color: colors.textPrimary,
  },
  vehicleTime: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: "600",
  },
  vehicleBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  vehiclePlate: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  vehicleRoute: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  distancePill: {
    backgroundColor: colors.lightGreen,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.primaryGreen,
  },
});

