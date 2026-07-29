import { EntityCrudPage } from "@/components/organisation/entity-crud-page";
import { locationsApi } from "@/lib/organisation/api";

const fields = [
  { key: "name", label: "Location name", required: true },
  { key: "code", label: "Code" },
  { key: "plantId", label: "Plant ID" },
  { key: "description", label: "Description", multiline: true },
];

export default function LocationsPage() {
  return (
    <EntityCrudPage
      title="Locations"
      description="Manage operational work locations."
      api={locationsApi}
      fields={fields}
    />
  );
}
