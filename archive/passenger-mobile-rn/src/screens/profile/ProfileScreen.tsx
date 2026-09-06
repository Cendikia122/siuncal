import {
  Bell1Stroke,
  Book1Stroke,
  CheckCircle1Stroke,
  Flag1Stroke,
  Shield2CheckStroke,
  User4Stroke,
} from "@lineiconshq/free-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { LoginForm } from "../../components/auth/LoginForm";
import { Screen } from "../../components/Screen";
import { SentraIcon } from "../../components/icons/SentraIcon";
import { cardBorderWidth, colors, shadows } from "../../theme/colors";
import { cardGap, radius } from "../../theme/layout";
import { ReportHistoryItem, Session } from "../../types";

type Props = {
  session: Session | null;
  onLogin: (session: Session) => void;
  onLogout: () => void;
  history: ReportHistoryItem[];
};

const menuItems = [
  { label: "Riwayat Laporan", icon: Flag1Stroke },
  { label: "Notifikasi Dishub", icon: Bell1Stroke },
  { label: "Kebijakan Privasi", icon: Shield2CheckStroke },
  { label: "Tentang Sentra Angkot", icon: Book1Stroke },
] as const;

export function ProfileScreen({ session, onLogin, onLogout, history }: Props) {
  if (!session) {
    return (
      <Screen>
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Profil</Text>
          <Text style={styles.pageSubtitle}>
            Masuk untuk melihat riwayat laporan dan status tracking warga.
          </Text>
        </View>
        <View style={[styles.card, shadows.card]}>
          <View style={styles.loginIconBox}>
            <SentraIcon icon={User4Stroke} color={colors.primaryGreen} size={28} />
          </View>
          <Text style={styles.loginTitle}>Masuk sebagai warga</Text>
          <Text style={styles.loginBody}>
            Akun dipakai untuk audit laporan. Tracking angkot publik tetap bisa dilihat tanpa login.
          </Text>
          <LoginForm onLogin={onLogin} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      {/* User card */}
      <View style={styles.userCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{session.userName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{session.userName}</Text>
          <Text style={styles.userMeta}>Warga Kota Bogor</Text>
        </View>
        <View style={styles.trackingChip}>
          <SentraIcon icon={CheckCircle1Stroke} color="#fff" size={14} />
          <Text style={styles.trackingText}>Aktif</Text>
        </View>
      </View>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <SummaryCard label="Total laporan" value={String(history.length)} />
        <SummaryCard label="Status akun" value="Aktif" />
      </View>

      {/* Menu */}
      <View style={[styles.menuGroup, shadows.card]}>
        {menuItems.map((item, idx) => (
          <Pressable
            key={item.label}
            accessibilityRole="button"
            style={[
              styles.menuItem,
              idx < menuItems.length - 1 && styles.menuItemBorder,
            ]}
          >
            <View style={styles.menuIconBox}>
              <SentraIcon icon={item.icon} color={colors.primaryGreen} size={18} />
            </View>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </View>


      {/* Logout */}
      <Pressable
        accessibilityRole="button"
        onPress={onLogout}
        style={[styles.logoutButton, shadows.card]}
      >
        <Text style={styles.logoutText}>Keluar</Text>
        <Text style={styles.versionText}>Versi 0.1.0</Text>
      </Pressable>
    </Screen>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={[styles.summaryCard, shadows.card]}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
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

  card: {
    borderRadius: radius.card,
    borderWidth: cardBorderWidth,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    paddingVertical: 16,
    paddingHorizontal: 14,
    gap: 12,
  },
  loginIconBox: {
    width: 52,
    height: 52,
    borderRadius: radius.badge,
    backgroundColor: colors.lightGreen,
    alignItems: "center",
    justifyContent: "center",
  },
  loginTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  loginBody: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },

  // User card
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.card,
    backgroundColor: colors.primaryGreen,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.badge,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.surface,
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  userName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.surface,
  },
  userMeta: {
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
  },
  trackingChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  trackingText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.surface,
    letterSpacing: 0.08 * 11,
  },

  // Summary
  summaryRow: {
    flexDirection: "row",
    gap: cardGap,
  },
  summaryCard: {
    flex: 1,
    borderRadius: radius.card,
    borderWidth: cardBorderWidth,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 3,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.primaryGreen,
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 0.08 * 11,
  },

  // Menu
  menuGroup: {
    borderRadius: radius.card,
    borderWidth: cardBorderWidth,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  menuItemBorder: {
    borderBottomWidth: cardBorderWidth,
    borderBottomColor: colors.cardBorder,
  },
  menuIconBox: {
    width: 34,
    height: 34,
    borderRadius: radius.badge,
    backgroundColor: colors.lightGreen,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  chevron: {
    fontSize: 18,
    color: colors.textMuted,
    fontWeight: "300",
  },

  // History
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
  historyCard: {
    borderRadius: radius.card,
    borderWidth: cardBorderWidth,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 4,
  },
  historyHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  historyPlate: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  statusPill: {
    borderRadius: radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  statusReview: {
    backgroundColor: colors.lightYellow,
  },
  statusFailed: {
    backgroundColor: colors.dangerLight,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textPrimary,
    letterSpacing: 0.08 * 11,
  },
  historyCategory: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  historyMessage: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },

  // Empty state
  emptyCard: {
    borderRadius: radius.card,
    borderWidth: cardBorderWidth,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    paddingVertical: 20,
    paddingHorizontal: 14,
    gap: 5,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  emptyBody: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },

  // Logout
  logoutButton: {
    borderRadius: radius.card,
    borderWidth: cardBorderWidth,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.danger,
  },
  versionText: {
    marginTop: 2,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 0.08 * 11,
  },
});
