import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import {
  Camera1Stroke,
  CheckCircle1Stroke,
  Flag1Stroke,
  MapMarker5Stroke,
  Shield2CheckStroke,
  Upload1Stroke,
} from "@lineiconshq/free-icons";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMemo, useState } from "react";

import { LoginForm } from "../../components/auth/LoginForm";
import { SentraIcon } from "../../components/icons/SentraIcon";
import { reportCategories } from "../../data/reportCategories";
import { normalizePlate } from "../../format";
import { submitPublicReport } from "../../api";
import { cardBorderWidth, colors, shadows } from "../../theme/colors";
import { cardGap, radius, screenPadding, sectionGap } from "../../theme/layout";
import { ReportAttachment, ReportCategory, ReportHistoryItem, Session } from "../../types";

type Props = {
  session: Session | null;
  onLogin: (session: Session) => void;
  onSubmitted: (item: ReportHistoryItem) => void;
};

const CATEGORY_PLACEHOLDER = "Silahkan pilih apa yang mau dilaporkan";

const CATEGORY_COLOR: Record<ReportCategory, string> = {
  NGETEM: "#E67E22",
  RECKLESS_DRIVING: "#C0392B",
  SECURITY: "#7D3C98",
  SERVICE: "#2980B9",
  OTHER: "#95A5A6",
};

export function ReportScreen({ session, onLogin, onSubmitted }: Props) {
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [plateNo, setPlateNo] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<ReportAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const plate = useMemo(() => normalizePlate(plateNo), [plateNo]);
  const selectedCategory = category ? reportCategories.find((c) => c.key === category) ?? null : null;

  const hasCategory = Boolean(category);
  const hasPlate = plate.length > 0;
  const hasDesc = description.trim().length >= 10;
  const hasLocation = Boolean(location);
  const hasPhoto = attachments.length > 0;
  const canSubmit = Boolean(session) && hasCategory && hasPlate && hasDesc && hasLocation && hasPhoto && !submitting;

  const getLocation = async () => {
    setLocationError(null);
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      setLocationError("Izin lokasi ditolak.");
      return;
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setLocation(loc);
  };

  const addPhoto = async (source: "camera" | "library") => {
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });

    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setAttachments((prev) =>
      [
        {
          uri: asset.uri,
          fileName: asset.fileName ?? `sentra-${Date.now()}.jpg`,
          contentType: asset.mimeType ?? "image/jpeg",
          ...(typeof asset.fileSize === "number" ? { fileSize: asset.fileSize } : {}),
        },
        ...prev,
      ].slice(0, 3)
    );
  };

  const submit = async () => {
    if (!session || !category || !location || !attachments.length || !plate.length) return;
    setSubmitting(true);
    const submittedAt = new Date().toISOString();
    const localBase = { id: `local-${Date.now()}`, plateNo: plate, category, submittedAt };

    try {
      const response = await submitPublicReport(
        {
          plateNo: plate,
          category,
          description,
          lat: location.coords.latitude,
          lon: location.coords.longitude,
          reportedAt: submittedAt,
          attachments,
          ...(typeof location.coords.accuracy === "number" ? { accuracyM: location.coords.accuracy } : {}),
        },
        session
      );
      onSubmitted({
        ...localBase,
        id: response.public_report_id ?? localBase.id,
        status: "PENDING_REVIEW",
        message: "Laporan masuk antrean review Dishub.",
      });
      setCategory(null);
      setPlateNo("");
      setDescription("");
      setAttachments([]);
      setLocation(null);
      Alert.alert("Laporan Terkirim", "Dishub akan meninjau laporan Anda sebelum menjadi incident.");
    } catch (error) {
      onSubmitted({
        ...localBase,
        status: "FAILED",
        message: error instanceof Error ? `Belum terkirim: ${error.message}` : "Endpoint belum aktif.",
      });
      Alert.alert("Belum Terkirim", "Form valid, tetapi endpoint submit belum aktif atau koneksi gagal.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Login gate ──────────────────────────────────────────────────────────────
  if (!session) {
    return (
      <View style={styles.root}>
        <View style={styles.loginContainer}>
          <View style={styles.loginIconBox}>
            <SentraIcon icon={Shield2CheckStroke} color={colors.primaryGreen} size={32} />
          </View>
          <Text style={styles.loginTitle}>Masuk untuk membuat laporan</Text>
          <Text style={styles.loginBody}>
            Tracking angkot tetap tersedia tanpa login. Laporan wajib login agar dapat diaudit Dishub.
          </Text>
          <LoginForm onLogin={onLogin} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      {/* Scrollable form content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Page title */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Buat Laporan</Text>
          <Text style={styles.pageSubtitle}>
            Laporan masuk review Dishub sebelum menjadi incident resmi.
          </Text>
        </View>

        {/* ── Category dropdown ──────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Kategori</Text>

          {/* Trigger */}
          <Pressable
            accessibilityRole="button"
            onPress={() => setDropdownOpen((v) => !v)}
            style={[styles.dropdownTrigger, dropdownOpen && styles.dropdownTriggerOpen]}
          >
            <View
              style={[
                styles.categoryDot,
                { backgroundColor: category ? CATEGORY_COLOR[category] : colors.textMuted },
              ]}
            />
            <View style={styles.dropdownTriggerBody}>
              <Text style={[styles.dropdownTriggerLabel, !selectedCategory && styles.dropdownPlaceholder]}>
                {selectedCategory?.label ?? CATEGORY_PLACEHOLDER}
              </Text>
              {selectedCategory ? (
                <Text style={styles.dropdownTriggerHint} numberOfLines={1}>
                  {selectedCategory.hint}
                </Text>
              ) : null}
            </View>
            <Text style={[styles.dropdownChevron, dropdownOpen && styles.dropdownChevronOpen]}>
              {"›"}
            </Text>
          </Pressable>

          {/* Options list */}
          {dropdownOpen ? (
            <View style={styles.dropdownList}>
              {!selectedCategory ? (
                <View style={[styles.dropdownItem, styles.dropdownPlaceholderItem, styles.dropdownItemBorder]}>
                  <View style={[styles.categoryDot, { backgroundColor: colors.textMuted }]} />
                  <Text style={styles.dropdownPlaceholderText}>{CATEGORY_PLACEHOLDER}</Text>
                </View>
              ) : null}
              {reportCategories.map((item, idx) => {
                const active = category === item.key;
                const isLast = idx === reportCategories.length - 1;
                return (
                  <Pressable
                    key={item.key}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    onPress={() => {
                      setCategory(item.key);
                      setDropdownOpen(false);
                    }}
                    style={[
                      styles.dropdownItem,
                      active && styles.dropdownItemActive,
                      !isLast && styles.dropdownItemBorder,
                    ]}
                  >
                    <View style={[styles.categoryDot, { backgroundColor: CATEGORY_COLOR[item.key] ?? colors.primaryGreen }]} />
                    <View style={styles.dropdownItemBody}>
                      <Text style={[styles.dropdownItemLabel, active && styles.dropdownItemLabelActive]}>
                        {item.label}
                      </Text>
                      <Text style={styles.dropdownItemHint}>{item.hint}</Text>
                    </View>
                    {active ? (
                      <SentraIcon icon={CheckCircle1Stroke} color={colors.primaryGreen} size={18} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>

        <View style={[styles.stepCard, shadows.card]}>
          <View style={styles.stepHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>2</Text>
            </View>
            <SentraIcon icon={Camera1Stroke} color={colors.primaryGreen} size={20} />
            <Text style={styles.stepTitle}>Bukti kejadian</Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.evidenceFieldLabel}>Plat nomor angkot</Text>
            <TextInput
              autoCapitalize="characters"
              placeholder="Contoh: F 1234 BO"
              placeholderTextColor={colors.textMuted}
              value={plateNo}
              onChangeText={setPlateNo}
              style={styles.evidenceInput}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.evidenceFieldLabel}>Deskripsi kejadian</Text>
            <TextInput
              multiline
              placeholder="Ceritakan kejadian secara singkat dan jelas."
              placeholderTextColor={colors.textMuted}
              value={description}
              onChangeText={setDescription}
              style={[styles.evidenceInput, styles.evidenceTextArea]}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.evidenceFieldLabel}>Lokasi kejadian</Text>
            <Pressable
              accessibilityRole="button"
              style={[styles.outlineActionButton, hasLocation && styles.outlineActionButtonDone]}
              onPress={() => void getLocation()}
            >
              <SentraIcon
                icon={MapMarker5Stroke}
                color={colors.primaryGreen}
                size={20}
              />
              <Text style={styles.outlineActionText}>
                {hasLocation ? "Lokasi Aktif" : "Aktifkan Lokasi"}
              </Text>
            </Pressable>
            {locationError ? <Text style={styles.errorText}>{locationError}</Text> : null}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.evidenceFieldLabel}>Foto bukti</Text>
            <View style={styles.photoActionRow}>
              <Pressable
                accessibilityRole="button"
                style={styles.outlineActionButton}
                onPress={() => void addPhoto("camera")}
              >
                <SentraIcon icon={Camera1Stroke} color={colors.primaryGreen} size={20} />
                <Text style={styles.outlineActionText}>
                  {hasPhoto ? `${attachments.length} Foto` : "Ambil Foto"}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={styles.outlineActionButton}
                onPress={() => void addPhoto("library")}
              >
                <SentraIcon icon={Upload1Stroke} color={colors.primaryGreen} size={20} />
                <Text style={styles.outlineActionText}>Pilih Foto</Text>
              </Pressable>
            </View>
            <Text style={styles.evidenceHelper}>Minimal satu foto diperlukan untuk mengirim laporan.</Text>
          </View>

          {attachments.length > 0 ? (
            <View style={styles.thumbRow}>
              {attachments.map((a) => (
                <Image key={a.uri} source={{ uri: a.uri }} style={styles.thumb} />
              ))}
            </View>
          ) : null}
        </View>

        <View style={[styles.stepCard, shadows.card]}>
          <View style={styles.stepHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>3</Text>
            </View>
            <SentraIcon icon={CheckCircle1Stroke} color={colors.primaryGreen} size={20} />
            <Text style={styles.stepTitle}>Kirim untuk review Dishub</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit }}
            disabled={!canSubmit}
            onPress={() => void submit()}
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          >
            <SentraIcon icon={Flag1Stroke} color="#fff" size={18} />
            <Text style={styles.submitText}>
              {submitting ? "Mengirim..." : "Kirim Laporan"}
            </Text>
          </Pressable>
          <Text style={styles.submitHelper}>
            Lengkapi kategori, plat, deskripsi minimal 10 karakter, lokasi aktif, dan foto bukti.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },

  // Login gate
  loginContainer: {
    flex: 1,
    padding: screenPadding,
    paddingTop: 32,
    gap: 14,
  },
  loginIconBox: {
    width: 56,
    height: 56,
    borderRadius: radius.badge,
    backgroundColor: colors.lightGreen,
    alignItems: "center",
    justifyContent: "center",
  },
  loginTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.textPrimary,
    lineHeight: 28,
  },
  loginBody: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: screenPadding,
    paddingTop: 16,
    paddingBottom: 16,
    gap: sectionGap,
  },

  // Page header
  pageHeader: {
    gap: 4,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  pageSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },

  // Section
  section: {
    gap: cardGap,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: 0.08 * 11,
    textTransform: "uppercase",
  },

  // Category dropdown
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },

  // Dropdown trigger
  dropdownTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: cardBorderWidth,
    borderColor: colors.cardBorder,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  dropdownTriggerOpen: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
  },
  dropdownTriggerBody: {
    flex: 1,
    gap: 2,
  },
  dropdownTriggerLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  dropdownPlaceholder: {
    color: colors.textMuted,
    fontWeight: "500",
  },
  dropdownTriggerHint: {
    fontSize: 12,
    color: colors.textMuted,
  },
  dropdownChevron: {
    fontSize: 20,
    color: colors.textMuted,
    fontWeight: "300",
    transform: [{ rotate: "0deg" }],
  },
  dropdownChevronOpen: {
    transform: [{ rotate: "90deg" }],
  },

  // Dropdown list
  dropdownList: {
    backgroundColor: colors.surface,
    borderWidth: cardBorderWidth,
    borderColor: colors.cardBorder,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
    borderRadius: radius.card,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    overflow: "hidden",
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
  },
  dropdownItemActive: {
    backgroundColor: colors.lightGreen,
  },
  dropdownPlaceholderItem: {
    backgroundColor: colors.surfaceAlt,
  },
  dropdownPlaceholderText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    color: colors.textMuted,
  },
  dropdownItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  dropdownItemBody: {
    flex: 1,
    gap: 2,
  },
  dropdownItemLabel: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.textPrimary,
  },
  dropdownItemLabelActive: {
    fontWeight: "700",
    color: colors.darkGreen,
  },
  dropdownItemHint: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },

  stepCard: {
    gap: 18,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: cardBorderWidth,
    borderColor: colors.cardBorder,
    padding: 14,
  },
  stepHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepBadge: {
    width: 32,
    height: 32,
    borderRadius: radius.badge,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryGreen,
  },
  stepBadgeText: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.surface,
  },
  stepTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  fieldGroup: {
    gap: 8,
  },
  evidenceFieldLabel: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  evidenceInput: {
    minHeight: 58,
    borderRadius: radius.card,
    borderWidth: cardBorderWidth,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.textPrimary,
  },
  evidenceTextArea: {
    minHeight: 122,
    paddingTop: 14,
  },
  outlineActionButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.primaryGreen,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 12,
  },
  outlineActionButtonDone: {
    backgroundColor: colors.lightGreen,
  },
  outlineActionText: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.primaryGreen,
  },
  photoActionRow: {
    flexDirection: "row",
    gap: cardGap,
  },
  evidenceHelper: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  errorText: {
    fontSize: 13,
    color: colors.danger,
    paddingHorizontal: 2,
  },
  thumbRow: {
    flexDirection: "row",
    gap: cardGap,
  },
  thumb: {
    width: 76,
    height: 76,
    borderRadius: radius.row,
    backgroundColor: colors.border,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: radius.card,
    backgroundColor: colors.primaryGreen,
  },
  submitButtonDisabled: {
    backgroundColor: colors.textMuted,
  },
  submitText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  submitHelper: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
});
