import {
  CalendarDays,
  ClipboardList,
  Cog,
  Factory,
  FlaskConical,
  HardHat,
  LockKeyhole,
  MapPin,
  Paperclip,
  ShieldAlert,
  Users,
  Wrench,
} from "lucide-react";

/** One icon per domain thing, used everywhere it appears (menu, organisation setup, permit pages). */
export const DOMAIN_ICONS = {
  permit: ClipboardList,
  plant: Factory,
  location: MapPin,
  workstation: Cog,
  machinery: Wrench,
  schedule: CalendarDays,
  hazard: ShieldAlert,
  ppe: HardHat,
  lototo: LockKeyhole,
  gas: FlaskConical,
  people: Users,
  attachment: Paperclip,
} as const;
