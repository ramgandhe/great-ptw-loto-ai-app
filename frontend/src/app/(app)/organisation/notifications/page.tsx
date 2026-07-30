import { EntityCrudPage } from "@/components/organisation/entity-crud-page";

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
      resource="notifications"
      fields={fields}
    />
  );
}
