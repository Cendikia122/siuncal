import { Locked1Stroke, User4Stroke } from "@lineiconshq/free-icons";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useState } from "react";

import { SentraIcon } from "../icons/SentraIcon";
import { mobileLogin } from "../../api";
import { colors } from "../../theme/colors";
import { radius } from "../../theme/layout";
import { Session } from "../../types";

type Props = {
  onLogin: (session: Session) => void;
};

export function LoginForm({ onLogin }: Props) {
  const [email, setEmail] = useState("warga@sentra.id");
  const [password, setPassword] = useState("password123");
  const [loading, setLoading] = useState(false);

  const login = async () => {
    setLoading(true);
    try {
      const session = await mobileLogin({ email: email.trim(), password });
      onLogin(session);
    } catch {
      Alert.alert("Login Gagal", "Pastikan API gateway aktif dan kredensial benar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.inputShell}>
        <SentraIcon icon={User4Stroke} color={colors.textMuted} size={18} />
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Email"
          placeholderTextColor={colors.textMuted}
          value={email}
          onChangeText={setEmail}
          style={styles.input}
        />
      </View>
      <View style={styles.inputShell}>
        <SentraIcon icon={Locked1Stroke} color={colors.textMuted} size={18} />
        <TextInput
          secureTextEntry
          placeholder="Password"
          placeholderTextColor={colors.textMuted}
          value={password}
          onChangeText={setPassword}
          style={styles.input}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [styles.button, { opacity: pressed || loading ? 0.82 : 1 }]}
        onPress={() => void login()}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{loading ? "Masuk..." : "Masuk sebagai Warga"}</Text>
      </Pressable>
      <Text style={styles.helper}>Demo: warga@sentra.id / password123</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 10,
  },
  inputShell: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: radius.row,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.pageBg,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    minHeight: 52,
    color: colors.textPrimary,
    fontSize: 15,
  },
  button: {
    minHeight: 50,
    borderRadius: radius.card,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryGreen,
    paddingHorizontal: 18,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "900",
    color: colors.surface,
  },
  helper: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
});
