export const ISOLATION_METHODS = [
  { value: "lock_closed", label: "Lock closed" },
  { value: "lock_open", label: "Lock open" },
  { value: "remove", label: "Remove" },
  { value: "block", label: "Block" },
  { value: "disconnect", label: "Disconnect" },
  { value: "vent", label: "Vent" },
  { value: "drain", label: "Drain" },
  { value: "blind", label: "Blind" },
  { value: "tag_only", label: "Tag only (not lockable)" },
] as const;

export const PROOF_LABELS: Record<string, string> = {
  meter: "Meter",
  try_start: "Try-start",
  gauge: "Gauge and bleed",
  temperature: "Temperature",
  no_movement: "No movement",
  pin: "Pin or block",
  drained: "Drained and locked",
  blind: "Blind",
  survey: "Survey",
  source_removed: "Source removed",
  visual: "Visual check",
};

const PROOFS_FOR_ENERGY: Record<string, readonly string[]> = {
  electrical: ["meter", "try_start"],
  pressure: ["gauge", "try_start"],
  hydraulic: ["gauge", "try_start"],
  pneumatic: ["gauge", "try_start"],
  thermal: ["temperature"],
  mechanical: ["no_movement", "pin"],
  gravity: ["no_movement", "pin"],
  gravitational: ["no_movement", "pin"],
  stored_energy: ["no_movement", "pin"],
  chemical: ["drained", "blind"],
  radiation: ["survey", "source_removed"],
  other: ["visual"],
};

export function proofsForEnergy(energyType: string): { value: string; label: string }[] {
  const codes = PROOFS_FOR_ENERGY[energyType] ?? ["visual"];
  return codes.map((value) => ({ value, label: PROOF_LABELS[value] ?? value }));
}

export function energyLevelHint(energyType: string): string {
  switch (energyType) {
    case "electrical":
      return "415 V or 11 kV";
    case "pressure":
    case "hydraulic":
    case "pneumatic":
      return "16 bar, 80 psi, or 200 kPa";
    case "thermal":
      return "180 °C or 350 °F";
    case "mechanical":
    case "gravity":
    case "stored_energy":
      return "2 tonne, or a short description";
    case "chemical":
      return "What it is, and the hazard";
    case "radiation":
      return "The source, or a dose rate";
    default:
      return "The hazard at this device";
  }
}
