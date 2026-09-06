import {
  Book1Stroke,
  Bus1Stroke,
  Camera1Stroke,
  Flag1Stroke,
  MapMarker1Stroke,
  Message2QuestionStroke,
  Route1Stroke,
  Shield2CheckStroke,
} from "@lineiconshq/free-icons";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { SentraIcon } from "../../components/icons/SentraIcon";
import { cardBorderWidth, colors, shadows } from "../../theme/colors";
import { cardGap, radius, screenPadding, sectionGap } from "../../theme/layout";
import { PublicVehicle, Session } from "../../types";

type AppScreen = "allbus" | "buslane" | "nearby" | "report";

type Props = {
  vehicles: PublicVehicle[];
  loading: boolean;
  fallback: boolean;
  session: Session | null;
  onRefresh: () => Promise<void>;
  onGoReport: () => void;
  onNavigate: (screen: AppScreen) => void;
};

const quickActions = [
  { label: "Semua Angkot", icon: Bus1Stroke, screen: "allbus" as AppScreen },
  { label: "Info Trayek", icon: Route1Stroke, screen: "buslane" as AppScreen },
  { label: "Terdekat", icon: MapMarker1Stroke, screen: "nearby" as AppScreen },
  { label: "Laporan", icon: Shield2CheckStroke, screen: "report" as AppScreen },
] as const;

const guideItems = [
  {
    title: "Butuh bantuan? Cek FAQ",
    body: "Temukan jawaban terbaik atas pertanyaan Anda",
    icon: Message2QuestionStroke,
  },
  {
    title: "Beri kami masukan",
    body: "Kami mendengarkan masukan Anda untuk layanan lebih baik",
    icon: Flag1Stroke,
  },
  {
    title: "Peta Trayek Offline",
    body: "Lihat dan unduh peta trayek tanpa jaringan",
    icon: Book1Stroke,
  },
] as const;

export function HomeScreen({
  vehicles,
  session,
  onGoReport,
  onNavigate,
}: Props) {
  const activeCount = vehicles.filter((v) => v.status === "ACTIVE").length;

  const handleQuickAction = (screen: AppScreen) => {
    if (screen === "report") {
      onGoReport();
    } else {
      onNavigate(screen);
    }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoBox}>
          <SentraIcon icon={Bus1Stroke} color="#fff" size={20} />
        </View>
        <View style={styles.logoTextWrap}>
          <Text style={styles.logoText}>SENTRA</Text>
          <Text style={styles.logoSub}>Angkot Bogor</Text>
        </View>
        <View style={styles.userChip}>
          <Text style={styles.userChipText}>
            {session ? session.userName.split(" ")[0] : "Tamu"}
          </Text>
        </View>
      </View>

      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Halo, mau ke mana hari ini?</Text>
        <Text style={styles.heroSubtitle}>
          Pilih tujuan Anda — kami bantu rekomendasikan rute angkot terbaik.
        </Text>
      </View>

      {/* Quick Actions Grid */}
      <View style={styles.quickGrid}>
        {quickActions.map((item) => (
          <Pressable
            key={item.label}
            accessibilityRole="button"
            onPress={() => handleQuickAction(item.screen)}
            style={({ pressed }) => [styles.quickTile, pressed && styles.quickTilePressed]}
          >
            <View style={styles.quickIconBox}>
              <SentraIcon icon={item.icon} color={colors.primaryGreen} size={26} />
            </View>
            <Text style={styles.quickLabel}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Live Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, shadows.card]}>
          <Text style={styles.statNum}>{activeCount}</Text>
          <Text style={styles.statLabel}>Aktif sekarang</Text>
        </View>
        <View style={[styles.statCard, shadows.card]}>
          <Text style={styles.statNum}>5</Text>
          <Text style={styles.statLabel}>Trayek beroperasi</Text>
        </View>
      </View>

      {/* Promo CTA */}
      <Pressable
        accessibilityRole="button"
        onPress={() => onNavigate("allbus")}
        style={({ pressed }) => [styles.promoBanner, pressed && { opacity: 0.92 }]}
      >
        <View style={styles.promoContent}>
          <Text style={styles.promoLabel}>Pantau langsung</Text>
          <Text style={styles.promoTitle}>Lacak Angkot{"\n"}Real-time</Text>
          <Text style={styles.promoBody}>
            Posisi angkot, estimasi tiba, dan info trayek aktif.
          </Text>
        </View>
        <View style={styles.promoArrow}>
          <Text style={styles.promoArrowText}>›</Text>
        </View>
      </Pressable>

      {/* Guide Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Info & Panduan</Text>
        <View style={styles.cardList}>
          {guideItems.map((item, idx) => (
            <Pressable
              key={item.title}
              accessibilityRole="button"
              onPress={idx === 1 ? onGoReport : undefined}
              style={({ pressed }) => [styles.guideCard, pressed && styles.guideCardPressed, shadows.card]}
            >
              <View style={styles.guideIconBox}>
                <SentraIcon icon={item.icon} color={colors.primaryGreen} size={20} />
              </View>
              <View style={styles.guideText}>
                <Text style={styles.guideTitle}>{item.title}</Text>
                <Text style={styles.guideBody}>{item.body}</Text>
              </View>
              <Text style={styles.guideChevron}>›</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Report CTA */}
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [styles.reportCta, pressed && { opacity: 0.92 }]}
        onPress={onGoReport}
      >
        <View style={styles.reportCtaIcon}>
          <SentraIcon icon={Camera1Stroke} color="#fff" size={20} />
        </View>
        <View style={styles.reportCtaText}>
          <Text style={styles.reportCtaTitle}>Ada kejadian di angkot?</Text>
          <Text style={styles.reportCtaBody}>Kirim laporan ke Dishub Bogor</Text>
        </View>
        <Text style={styles.reportCtaChevron}>›</Text>
      </Pressable>

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  content: {
    gap: sectionGap,
    paddingHorizontal: screenPadding,
    paddingTop: 16,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoBox: {
    width: 40,
    height: 40,
    borderRadius: radius.card,
    backgroundColor: colors.primaryGreen,
    alignItems: "center",
    justifyContent: "center",
  },
  logoTextWrap: {
    flex: 1,
  },
  logoText: {
    fontSize: 15,
    fontWeight: "900",
    color: colors.textPrimary,
    letterSpacing: 1.2,
  },
  logoSub: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.textSecondary,
    marginTop: 1,
  },
  userChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: cardBorderWidth,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
  },
  userChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textPrimary,
  },

  // Hero
  hero: {
    gap: 5,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.textPrimary,
    lineHeight: 30,
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },

  // Quick Actions
  quickGrid: {
    flexDirection: "row",
    gap: cardGap,
  },
  quickTile: {
    flex: 1,
    alignItems: "center",
    gap: 9,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: cardBorderWidth,
    borderColor: colors.cardBorder,
  },
  quickTilePressed: {
    backgroundColor: colors.lightGreen,
  },
  quickIconBox: {
    width: 56,
    height: 56,
    borderRadius: radius.card,
    backgroundColor: colors.lightGreen,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textPrimary,
    textAlign: "center",
    lineHeight: 15,
    letterSpacing: 0.08 * 11,
  },

  // Stats Row
  statsRow: {
    flexDirection: "row",
    gap: cardGap,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: cardBorderWidth,
    borderColor: colors.cardBorder,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 2,
  },
  statNum: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.primaryGreen,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 0.08 * 11,
  },

  // Promo Banner
  promoBanner: {
    borderRadius: radius.card,
    backgroundColor: colors.primaryGreen,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  promoContent: {
    flex: 1,
    gap: 4,
  },
  promoLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255,255,255,0.70)",
    letterSpacing: 0.08 * 10,
    textTransform: "uppercase",
  },
  promoTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
    lineHeight: 25,
  },
  promoBody: {
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(255,255,255,0.75)",
  },
  promoArrow: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  promoArrowText: {
    fontSize: 22,
    color: "#fff",
    fontWeight: "300",
    marginTop: -2,
  },

  // Guide Section
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
  guideCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: cardBorderWidth,
    borderColor: colors.cardBorder,
  },
  guideCardPressed: {
    backgroundColor: "#F8F9FB",
  },
  guideIconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.badge,
    backgroundColor: colors.lightGreen,
    alignItems: "center",
    justifyContent: "center",
  },
  guideText: {
    flex: 1,
    gap: 3,
  },
  guideTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  guideBody: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  guideChevron: {
    fontSize: 20,
    color: colors.textMuted,
    fontWeight: "300",
  },

  // Report CTA
  reportCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.card,
    backgroundColor: colors.darkGreen,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  reportCtaIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.badge,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  reportCtaText: {
    flex: 1,
    gap: 2,
  },
  reportCtaTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  reportCtaBody: {
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
  },
  reportCtaChevron: {
    fontSize: 22,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "300",
  },

  bottomPad: {
    height: 8,
  },
});
