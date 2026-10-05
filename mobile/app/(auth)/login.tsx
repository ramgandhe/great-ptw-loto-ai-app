import { useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import { AppText, Banner, BrandMark, Button, Screen, TextField } from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "@/providers/theme-provider";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const { tokens } = useTheme();
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

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen contentStyle={{ flexGrow: 1, gap: tokens.space[6] }}>
        <BrandMark />
        <View style={{ flex: 1, justifyContent: "center", gap: tokens.space[5], paddingBottom: tokens.space[10] }}>
          <View style={{ gap: tokens.space[2] }}>
            <AppText variant="display" style={{ fontSize: tokens.text.xxxl, lineHeight: tokens.text.xxxl * 1.1 }}>
              {newPasswordStep ? "Set your own password" : "Sign in"}
            </AppText>
            <AppText variant="body" tone="secondary" style={{ fontSize: tokens.text.md }}>
              {newPasswordStep ? "You signed in with a temporary password. Choose your own to continue." : "Use the work email your organisation registered."}
            </AppText>
          </View>

          {newPasswordStep ? (
            <>
              <View style={{ alignSelf: "flex-start", paddingHorizontal: tokens.space[3], paddingVertical: tokens.space[2], borderRadius: tokens.radii.sm, backgroundColor: tokens.colors.muted }}>
                <AppText variant="caption" tone="secondary">
                  Signing in as <AppText variant="caption" weight="semibold">{email.trim()}</AppText>
                </AppText>
              </View>
              <TextField
                label="New password"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                hint="At least 8 characters. A short sentence is easy to remember and hard to guess."
              />
              <TextField
                label="Type it again"
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                error={confirm.length > 0 && confirm !== newPassword ? "The two new passwords do not match." : null}
                onSubmitEditing={submit}
              />
            </>
          ) : (
            <>
              <TextField
                label="Work email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoComplete="email"
                textContentType="username"
                returnKeyType="next"
              />
              <TextField
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="current-password"
                textContentType="password"
                onSubmitEditing={submit}
              />
            </>
          )}

          {error ? <Banner tone="danger">{error}</Banner> : null}

          <Button label={newPasswordStep ? "Save password and sign in" : "Sign in"} onPress={submit} loading={busy} size="lg" full />
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}
