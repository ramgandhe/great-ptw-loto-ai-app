import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "@/providers/theme-provider";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const { tokens } = useTheme();
  const c = tokens.colors;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  // First sign-in with a temporary password asks for the person's own before going in.
  const [newPasswordStep, setNewPasswordStep] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    if (!newPasswordStep && (!email.trim() || !password)) {
      setError("Enter your email and password.");
      return;
    }
    if (newPasswordStep && newPassword !== confirm) {
      setError("The two new passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await signIn(email.trim(), password, newPasswordStep ? newPassword : undefined);
    } catch (err) {
      if (err instanceof ApiError && err.code === "PASSWORD_CHANGE_REQUIRED") setNewPasswordStep(true);
      else setError(err instanceof ApiError ? err.message : "We couldn't reach the server. Check your connection and try again.");
      setBusy(false);
    }
  }

  const input = [styles.input, { borderColor: c.border, color: c.foreground, borderRadius: tokens.radius }];
  const label = [styles.label, { color: c.foreground }];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={[styles.container, { padding: tokens.spacing.lg }]} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={[styles.title, { color: c.foreground, fontSize: tokens.typography.title }]}>
          {newPasswordStep ? "Set your own password" : "Sign in"}
        </Text>
        <Text style={{ color: c.mutedForeground, fontSize: tokens.typography.body }}>
          {newPasswordStep
            ? "You signed in with a temporary password. Choose your own to continue."
            : "Use the work email your organisation registered."}
        </Text>

        {newPasswordStep ? (
          <>
            <Text style={{ color: c.foreground }}>Signing in as {email.trim()}</Text>
            <View style={styles.field}>
              <Text style={label}>New password</Text>
              <TextInput style={input} value={newPassword} onChangeText={setNewPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" accessibilityLabel="New password" />
              <Text style={{ color: c.mutedForeground, fontSize: 12 }}>At least 8 characters. A short sentence is easy to remember and hard to guess.</Text>
            </View>
            <View style={styles.field}>
              <Text style={label}>Type it again</Text>
              <TextInput style={input} value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" textContentType="newPassword" accessibilityLabel="Type it again" onSubmitEditing={submit} />
            </View>
          </>
        ) : (
          <>
            <View style={styles.field}>
              <Text style={label}>Email</Text>
              <TextInput
                style={input}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoComplete="email"
                textContentType="username"
                accessibilityLabel="Email"
              />
            </View>
            <View style={styles.field}>
              <Text style={label}>Password</Text>
              <TextInput style={input} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" accessibilityLabel="Password" onSubmitEditing={submit} />
            </View>
          </>
        )}

        {error ? (
          <Text accessibilityRole="alert" style={[styles.error, { color: c.danger, backgroundColor: c.dangerBg, borderRadius: tokens.radius }]}>
            {error}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          style={[styles.button, { backgroundColor: c.primary, borderRadius: tokens.radius, opacity: busy ? 0.7 : 1 }]}
          disabled={busy}
          onPress={submit}
        >
          {busy ? (
            <ActivityIndicator color={c.primaryForeground} />
          ) : (
            <Text style={[styles.buttonText, { color: c.primaryForeground }]}>{newPasswordStep ? "Save password and sign in" : "Sign in"}</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: "center", gap: 12 },
  title: { fontWeight: "600" },
  field: { gap: 6 },
  label: { fontWeight: "500" },
  input: { borderWidth: 1, padding: 10, minHeight: 44 },
  error: { padding: 10 },
  button: { marginTop: 8, padding: 12, alignItems: "center", minHeight: 44, justifyContent: "center" },
  buttonText: { fontWeight: "500" },
});
