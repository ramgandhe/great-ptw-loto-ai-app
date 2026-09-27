import { DashboardNotificationsPanel } from "@/components/dashboards/dashboard-notifications-panel";

export default function NotificationsPage() {
  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:p-8">
      <div>
        <h1 id="messages-heading" className="font-heading text-3xl font-bold tracking-tight">
          Messages
        </h1>
        <p className="mt-1 text-muted-foreground">Approvals, clashes, reminders and incidents. Repeats are grouped; open one to go to its record.</p>
      </div>
      <DashboardNotificationsPanel limit={Infinity} inbox />
    </main>
  );
}
