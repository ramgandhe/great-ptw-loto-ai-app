import { Button } from "@/components/ui/button";
import { Icon, ShieldCheck } from "@/components/icons";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <Icon icon={ShieldCheck} size="lg" className="text-primary" aria-label="Safety" />
      <h1 className="text-2xl font-semibold">Permit-to-Work Platform</h1>
      <p className="text-neutral-600 dark:text-neutral-400">Web application foundation (SP-01.01)</p>
      <Button>Get started</Button>
    </main>
  );
}
