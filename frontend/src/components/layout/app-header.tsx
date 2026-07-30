import { ThemeSettings } from "@/components/theme/theme-settings";

export function AppHeader() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border px-6">
      <p className="text-sm text-muted-foreground">Platform Foundation</p>
      <ThemeSettings />
    </header>
  );
}
