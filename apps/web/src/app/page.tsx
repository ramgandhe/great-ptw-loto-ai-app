import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">Permit-to-Work Platform</h1>
      <p className="text-neutral-600 dark:text-neutral-400">Web application foundation (SP-01.01)</p>
      <Button>Get started</Button>
    </main>
  );
}
