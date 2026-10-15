import { EntityCrudPage } from "@/components/organisation/entity-crud-page";
import { SitePeople } from "@/components/organisation/site-people";

const fields = [
  { key: "name", label: "Site name", required: true },
  { key: "code", label: "Code", required: true },
  { key: "description", label: "Description", multiline: true },
  { key: "address", label: "Address", multiline: true },
];

export default function SitesPage() {
  return (
    <EntityCrudPage
      title="Sites"
      description="Physical sites. People who are not an owner or admin only see sites they belong to."
      resource="sites"
      fields={fields}
    >
      <SitePeople />
    </EntityCrudPage>
  );
}
