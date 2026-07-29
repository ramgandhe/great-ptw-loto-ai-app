import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <main className="flex flex-1 flex-col gap-4 p-8">
      <div className="flex items-center gap-3">
        <Settings className="size-6" aria-hidden />
        <h1 className="text-2xl font-semibold">Settings</h1>
      </div>
      <p className="text-muted-foreground">
        Platform configuration and user preferences will be available in a future sprint.
      </p>
    </main>
  );
}
