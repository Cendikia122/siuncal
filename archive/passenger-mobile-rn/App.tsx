import * as Location from "expo-location";
import { StatusBar } from "expo-status-bar";
import * as TaskManager from "expo-task-manager";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet, View } from "react-native";

import { BottomTabBar, TabKey } from "./src/components/navigation/BottomTabBar";
import { colors } from "./src/theme/colors";
import { fetchPublicVehicles, sendPassengerTelemetry } from "./src/api";
import { HomeScreen } from "./src/screens/home/HomeScreen";
import { ProfileScreen } from "./src/screens/profile/ProfileScreen";
import { ReportScreen } from "./src/screens/report/ReportScreen";
import { AllBusMapScreen } from "./src/screens/map/AllBusMapScreen";
import { BusLaneScreen } from "./src/screens/buslane/BusLaneScreen";
import { NearbyAngkotScreen } from "./src/screens/nearby/NearbyAngkotScreen";
import { PublicVehicle, ReportHistoryItem, Session } from "./src/types";

type ModalScreen = "allbus" | "buslane" | "nearby" | null;

const PASSENGER_TASK = "sentra-passenger-location";

let activeTrackingSession: Pick<Session, "passengerTrackingToken" | "passengerTrackingSessionId"> | null = null;

TaskManager.defineTask(PASSENGER_TASK, async ({ data, error }: { data: unknown; error: unknown }) => {
  if (error || !activeTrackingSession) return;

  const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations ?? [];
  const latest = locations[locations.length - 1];
  if (!latest) return;

  await sendPassengerTelemetry({
    session: activeTrackingSession,
    lat: latest.coords.latitude,
    lon: latest.coords.longitude,
    accuracy: latest.coords.accuracy,
    timestamp: new Date(latest.timestamp).toISOString(),
    appState: "BACKGROUND",
  }).catch(() => undefined);
});

const startPassengerTracking = async (session: Session) => {
  activeTrackingSession = session;

  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== "granted") {
    throw new Error("Izin lokasi foreground ditolak.");
  }

  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== "granted") {
    throw new Error("Izin lokasi background ditolak.");
  }

  const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  await sendPassengerTelemetry({
    session,
    lat: current.coords.latitude,
    lon: current.coords.longitude,
    accuracy: current.coords.accuracy,
    timestamp: new Date(current.timestamp).toISOString(),
    appState: "FOREGROUND",
  });

  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(PASSENGER_TASK);
  if (alreadyStarted) {
    await Location.stopLocationUpdatesAsync(PASSENGER_TASK);
  }

  await Location.startLocationUpdatesAsync(PASSENGER_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 30_000,
    distanceInterval: 20,
    deferredUpdatesInterval: 30_000,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Sentra tracking aktif",
      notificationBody: "Lokasi Anda dikirim berkala ke dashboard operator Dishub.",
      notificationColor: colors.primaryGreen,
    },
  });
};

const stopPassengerTracking = async () => {
  activeTrackingSession = null;
  const started = await Location.hasStartedLocationUpdatesAsync(PASSENGER_TASK);
  if (started) {
    await Location.stopLocationUpdatesAsync(PASSENGER_TASK);
  }
};

export default function App() {
  const [tab, setTab] = useState<TabKey>("home");
  const [modal, setModal] = useState<ModalScreen>(null);
  const [vehicles, setVehicles] = useState<PublicVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [fallback, setFallback] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [history, setHistory] = useState<ReportHistoryItem[]>([]);

  const loadVehicles = async () => {
    setLoading(true);
    const result = await fetchPublicVehicles();
    setVehicles(result.vehicles);
    setFallback(result.usingFallback);
    setLoading(false);
  };

  useEffect(() => {
    void loadVehicles();
  }, []);

  useEffect(() => {
    if (!session) {
      void stopPassengerTracking().catch(() => undefined);
      return;
    }
    void startPassengerTracking(session).catch(() => undefined);
  }, [session]);

  if (modal === "allbus") {
    return (
      <AllBusMapScreen
        vehicles={vehicles}
        onBack={() => setModal(null)}
        onRefresh={loadVehicles}
      />
    );
  }

  if (modal === "buslane") {
    return <BusLaneScreen onBack={() => setModal(null)} />;
  }

  if (modal === "nearby") {
    return <NearbyAngkotScreen vehicles={vehicles} onBack={() => setModal(null)} />;
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: "padding", android: undefined })}
        style={styles.flex}
      >
        <View style={styles.flex}>
          {tab === "home" && (
            <HomeScreen
              vehicles={vehicles}
              loading={loading}
              fallback={fallback}
              session={session}
              onRefresh={loadVehicles}
              onGoReport={() => setTab("report")}
              onNavigate={(screen) => {
                if (screen === "report") {
                  setTab("report");
                } else {
                  setModal(screen as ModalScreen);
                }
              }}
            />
          )}
          {tab === "report" && (
            <ReportScreen
              session={session}
              onLogin={setSession}
              onSubmitted={(item) => setHistory((current) => [item, ...current])}
            />
          )}
          {tab === "profile" && (
            <ProfileScreen
              session={session}
              onLogin={setSession}
              onLogout={() => setSession(null)}
              history={history}
            />
          )}
          <BottomTabBar active={tab} onChange={setTab} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#fff",
  },
  flex: {
    flex: 1,
  },
});
