import { EntityCrudPage } from "@/components/organisation/entity-crud-page";
import { notificationPreferencesApi } from "@/lib/organisation/api";

const fields = [
  { key: "name", label: "Preference name", required: true },
  { key: "channel", label: "Channel" },
  { key: "eventType", label: "Event type" },
  { key: "description", label: "Notes", multiline: true },
];

export default function NotificationsPage() {
  return (
    <EntityCrudPage
      title="Notification preferences"
      description="Configure organisation notification channels and events."
      api={notificationPreferencesApi}
      fields={fields}
    />
  );
}
