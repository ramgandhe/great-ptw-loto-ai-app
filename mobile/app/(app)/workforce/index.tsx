import { HubLinks } from "@/components/hub-links";
import { PageHeader, Screen } from "@/components/ui";
import { Award, BadgeCheck, UserRound, Users } from "@/components/ui/icons";

export default function WorkforceScreen() {
  return (
    <Screen>
      <PageHeader title="Workforce" description="People and their qualifications, kept on this phone for use offline." back={{ label: "Home", href: "/" }} />
      <HubLinks
        links={[
          { href: "/workforce/profile", label: "My profile", description: "Your details as recorded", icon: UserRound },
          { href: "/workforce/directory", label: "People", description: "Everyone in the workforce", icon: Users },
          { href: "/workforce/competencies", label: "Competencies", description: "Skills people are qualified for", icon: Award },
          { href: "/workforce/certifications", label: "Certifications", description: "Certificates and when they expire", icon: BadgeCheck },
        ]}
      />
    </Screen>
  );
}
