"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { AUTH_LINK, PasswordInput } from "@/components/auth/password-input";
import { BackLink } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { completePasswordReset } from "@/lib/auth/session";

function ResetContent() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await completePasswordReset(token, password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "We couldn't reach the server. Check your connection and try again.");
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink href="/login" label="Sign in" />
        <h1 className="font-heading text-3xl font-bold tracking-tight">This link is incomplete</h1>
        <p className="text-muted-foreground">Open the link from your email again, or ask for a new one.</p>
        <Link href="/forgot-password" className={AUTH_LINK}>
          Send me a new link
        </Link>
      </div>
    );
  }

  const expired = Boolean(error && /expired|already used/i.test(error));

  return (
    <div className="flex flex-col gap-7">
      <div>
        <BackLink href="/login" label="Sign in" />
        <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight">Choose a new password</h1>
        <p className="mt-1.5 text-muted-foreground">You will be signed in as soon as it is saved.</p>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="new-password" className="text-sm font-medium">
            New password
          </label>
          <PasswordInput id="new-password" value={password} onChange={setPassword} autoComplete="new-password" />
          <p className="text-xs text-muted-foreground">At least 8 characters. A short sentence is easy to remember and hard to guess.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirm-password" className="text-sm font-medium">
            Type it again
          </label>
          <PasswordInput
            id="confirm-password"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            invalid={confirm.length > 0 && confirm !== password}
          />
        </div>
        {error ? (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}{" "}
            {expired ? (
              <Link href="/forgot-password" className="font-semibold underline">
                Send me a new link
              </Link>
            ) : null}
          </p>
        ) : null}
        <Button type="submit" size="lg" disabled={busy} className="mt-1 h-11 w-full text-base">
          {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
          {busy ? "Saving…" : "Save password and sign in"}
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <ResetContent />
    </Suspense>
  );
}
