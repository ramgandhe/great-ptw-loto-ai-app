import { Shield } from "lucide-react";

export default function SafetyPage() {
  return (
    <main className="flex flex-1 flex-col gap-4 p-8">
      <div className="flex items-center gap-3">
        <Shield className="size-6" aria-hidden />
        <h1 className="text-2xl font-semibold">Safety</h1>
      </div>
      <p className="text-muted-foreground">
        Safety operations and permit workflows will be available in MS-02.
      </p>
    </main>
  );
}
