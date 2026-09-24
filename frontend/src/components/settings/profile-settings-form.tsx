"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { updateProfile, uploadProfileAvatar } from "@/lib/auth/api";
import { useAuthProfile } from "@/lib/auth/auth-profile-context";
import { Button } from "@/components/ui/button";

export function ProfileSettingsForm() {
  const { profile, refreshProfile } = useAuthProfile();
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.displayName ?? "");
  }, [profile?.displayName]);

  const previewName =
    displayName.trim() ||
    profile?.displayName ||
    (profile?.firstName && profile?.lastName
      ? `${profile.firstName} ${profile.lastName}`
      : profile?.username) ||
    "Signed in";

  async function handleSaveName(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await updateProfile({ displayName: displayName.trim() });
      await refreshProfile();
      setMessage("Display name saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save display name");
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setUploading(true);
    setError(null);
    setMessage(null);
    try {
      await uploadProfileAvatar(file);
      await refreshProfile();
      setMessage("Profile picture updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to upload profile picture");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-sm font-semibold">Profile Settings</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Set your display name and profile picture. These appear in the header for now.
      </p>

      <div className="mt-4 flex items-center gap-4">
        {profile?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.avatarUrl}
            alt=""
            className="size-16 rounded-full object-cover border border-border"
          />
        ) : (
          <div
            className="flex size-16 items-center justify-center rounded-full border border-border bg-muted text-sm font-medium"
            aria-hidden
          >
            {previewName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{previewName}</p>
          <p className="truncate text-xs text-muted-foreground">{profile?.email ?? profile?.username}</p>
        </div>
      </div>

      <form className="mt-4 grid max-w-md gap-3" onSubmit={handleSaveName}>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Display name</span>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-3"
            placeholder="How your name should appear"
            maxLength={255}
          />
        </label>
        <div>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save display name"}
          </Button>
        </div>
      </form>

      <div className="mt-4 grid max-w-md gap-2">
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">Profile picture</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading}
            onChange={handleAvatarChange}
            className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5"
          />
        </label>
        <p className="text-xs text-muted-foreground">JPEG, PNG, or WebP. Max 2 MB.</p>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {message ? <p className="mt-3 text-sm text-muted-foreground">{message}</p> : null}
    </section>
  );
}
