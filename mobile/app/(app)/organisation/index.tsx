import { HubLinks } from "@/components/hub-links";
import { PageHeader, Screen } from "@/components/ui";
import { Building2, Factory, Layers, MapPin } from "@/components/ui/icons";

export default function OrganisationScreen() {
  return (
    <Screen>
      <PageHeader title="Organisation" description="Reference lists, kept on this phone for use offline. Changes are made on the web." back={{ label: "Home", href: "/" }} />
      <HubLinks
        links={[
          { href: "/organisation/profile", label: "Profile", description: "Name and registration", icon: Building2 },
          { href: "/organisation/plants", label: "Plants", description: "Sites of the organisation", icon: Factory },
          { href: "/organisation/departments", label: "Departments", description: "Teams within each plant", icon: Layers },
          { href: "/organisation/locations", label: "Locations", description: "Where work happens", icon: MapPin },
        ]}
      />
    </Screen>
  );
}
