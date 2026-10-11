import { and, eq } from 'drizzle-orm';
import type { Database } from '../../database/database.module';
import { hazardCategories } from '../../database/schema';

/** Catalogue from docs/specs/ptw_hazards.md. */
export const DEFAULT_HAZARDS = [
  {
    "code": "HAZ-FIRE-001",
    "name": "Fire and Ignition",
    "category": "Fire and Explosion",
    "severity": "critical",
    "description": "Ignition of combustible or flammable materials due to flames, sparks, hot surfaces, or other ignition sources.\n\nRisks: Ignition of flammable vapours; Sparks reaching combustible materials; Inadequate separation of hot work from hazardous substances.",
    "consequences": [
      "Burns",
      "fire spread",
      "fatalities",
      "equipment damage",
      "production loss"
    ],
    "controls": [
      "Remove or protect combustible materials",
      "Verify flammable atmospheres are controlled where relevant",
      "Inspect the work area before starting",
      "Provide suitable firefighting equipment and a trained fire watch where required",
      "Monitor the area during work and for the site-defined period afterward"
    ],
    "permitTypeCodes": [
      "HOT",
      "COLD",
      "CSP",
      "WAH",
      "ELEC"
    ]
  },
  {
    "code": "HAZ-FIRE-002",
    "name": "Explosion / Flammable Atmosphere",
    "category": "Fire and Explosion",
    "severity": "critical",
    "description": "Presence or possible accumulation of flammable gases, vapours, mists, or combustible dust that can ignite or explode.\n\nRisks: Ignition by sparks, static discharge, electrical equipment, or hot work; Accumulation of flammable substances; Uncontrolled release of flammable materials.",
    "consequences": [
      "Blast injuries",
      "burns",
      "structural damage",
      "multiple fatalities"
    ],
    "controls": [
      "Identify flammable substances and potential release sources",
      "Isolate and eliminate leaks where practicable",
      "Conduct atmospheric testing using suitable calibrated equipment where required",
      "Maintain ventilation and monitor conditions as specified by the risk assessment",
      "Control ignition sources and use appropriately rated equipment in classified areas"
    ],
    "permitTypeCodes": [
      "HOT",
      "COLD",
      "CSP",
      "ELEC"
    ]
  },
  {
    "code": "HAZ-THERM-001",
    "name": "Hot Surfaces and Thermal Burns",
    "category": "Thermal",
    "severity": "high",
    "description": "Exposure to heated equipment, molten material, hot workpieces, steam, or other high-temperature surfaces.\n\nRisks: Accidental contact with hot surfaces; Hot material splashes; Unexpected release of steam or heat.",
    "consequences": [
      "Skin burns",
      "eye injuries",
      "serious tissue damage"
    ],
    "controls": [
      "Allow equipment to cool where possible",
      "Isolate heat and pressure sources before work",
      "Install barriers and warning signs",
      "Use task-appropriate thermal PPE",
      "Verify temperature before handling equipment or materials"
    ],
    "permitTypeCodes": [
      "HOT",
      "COLD",
      "CSP",
      "ELEC"
    ]
  },
  {
    "code": "HAZ-AIR-001",
    "name": "Smoke, Welding Fumes and Harmful Dust",
    "category": "Chemical / Airborne Exposure",
    "severity": "high",
    "description": "Generation or accumulation of welding fumes, grinding dust, airborne particulates, or harmful vapours during work.\n\nRisks: Inhalation of toxic substances; Exposure to metal fumes; Inadequate ventilation; Secondary exposure to nearby workers.",
    "consequences": [
      "Respiratory irritation",
      "occupational illness",
      "lung damage",
      "acute poisoning"
    ],
    "controls": [
      "Assess the materials and expected contaminants",
      "Use local exhaust ventilation or suitable extraction",
      "Provide suitable respiratory protection where required",
      "Prevent exposure to nearby personnel",
      "Apply atmospheric monitoring where the substances and task warrant it"
    ],
    "permitTypeCodes": [
      "HOT",
      "COLD",
      "CSP",
      "ELEC"
    ]
  },
  {
    "code": "HAZ-ELEC-001",
    "name": "Electric Shock and Electrocution",
    "category": "Electrical",
    "severity": "critical",
    "description": "Exposure to live electrical conductors, faulty equipment, damaged insulation, or unexpected energization.\n\nRisks: Direct or indirect electrical contact; Current passing through the body; Contact with energized metalwork.",
    "consequences": [
      "Electric shock",
      "electrical burns",
      "cardiac arrest",
      "electrocution"
    ],
    "controls": [
      "Isolate all relevant electrical supplies where required",
      "Apply lockout/tagout and verify absence of voltage using suitable equipment",
      "Restrict work to competent, authorized personnel",
      "Inspect tools, cables, and protective devices",
      "Apply approved energized-work procedures only where justified and permitted"
    ],
    "permitTypeCodes": [
      "HOT",
      "COLD",
      "CSP",
      "WAH",
      "ELEC"
    ]
  },
  {
    "code": "HAZ-ELEC-002",
    "name": "Arc Flash and Arc Blast",
    "category": "Electrical",
    "severity": "critical",
    "description": "Release of intense thermal energy, pressure, and debris from an electrical arc fault.\n\nRisks: Switching or testing faults; Short circuits; Accidental contact; Electrical equipment failure.",
    "consequences": [
      "Severe burns",
      "blast injuries",
      "hearing damage",
      "permanent disability",
      "fatalities"
    ],
    "controls": [
      "Assess arc-flash risk and incident energy where applicable",
      "De-energize equipment where practicable",
      "Establish approach boundaries and restrict access",
      "Use appropriately rated PPE and tools",
      "Follow approved switching and electrical-work procedures"
    ],
    "permitTypeCodes": [
      "HOT",
      "COLD",
      "ELEC"
    ]
  },
  {
    "code": "HAZ-ENERGY-001",
    "name": "Unexpected Energization / Stored Energy",
    "category": "Hazardous Energy",
    "severity": "critical",
    "description": "Unexpected startup, movement, release, or energization of equipment or systems during maintenance.\n\nRisks: Residual electrical charge; Rotating machinery; Springs; Hydraulic accumulators; Pneumatic pressure; Gravity; Remote startup.",
    "consequences": [
      "Crushing",
      "entanglement",
      "amputation",
      "electrocution",
      "fatalities"
    ],
    "controls": [
      "Identify all energy sources and isolation points",
      "Apply approved isolation and lockout/tagout procedures",
      "Release or restrain stored energy",
      "Verify the safe, zero-energy state before work",
      "Control the removal of locks and restoration of energy"
    ],
    "permitTypeCodes": [
      "HOT",
      "COLD",
      "CSP",
      "WAH",
      "ELEC",
      "EXC"
    ]
  },
  {
    "code": "HAZ-MECH-001",
    "name": "Mechanical Movement / Rotating Machinery",
    "category": "Mechanical",
    "severity": "high",
    "description": "Exposure to moving machinery, rotating components, pinch points, or mechanical forces.\n\nRisks: Entanglement; Trapping; Crushing; Contact with moving parts; Unexpected movement.",
    "consequences": [
      "Lacerations",
      "fractures",
      "amputations",
      "permanent disability",
      "fatalities"
    ],
    "controls": [
      "Isolate and secure machinery before intervention",
      "Verify that moving parts have stopped",
      "Guard exposed moving components",
      "Use suitable tools and safe work methods",
      "Prevent unauthorized startup"
    ],
    "permitTypeCodes": [
      "HOT",
      "COLD",
      "CSP",
      "ELEC"
    ]
  },
  {
    "code": "HAZ-ATM-001",
    "name": "Oxygen Deficiency",
    "category": "Atmospheric",
    "severity": "critical",
    "description": "An atmosphere with insufficient oxygen to safely support human life, potentially caused by displacement, consumption, or inerting.\n\nRisks: Entry into an oxygen-deficient space; Oxygen displacement by inert gases; Oxygen depletion from chemical or biological processes.",
    "consequences": [
      "Dizziness",
      "unconsciousness",
      "asphyxiation",
      "fatalities"
    ],
    "controls": [
      "Test the atmosphere before entry and as frequently as required",
      "Isolate inert-gas and other supply sources",
      "Provide suitable ventilation",
      "Use continuous monitoring where required by the assessment",
      "Establish rescue arrangements that do not rely on unprotected entry"
    ],
    "permitTypeCodes": [
      "HOT",
      "COLD",
      "CSP",
      "ELEC"
    ]
  },
  {
    "code": "HAZ-ATM-002",
    "name": "Toxic Gas / Harmful Atmosphere",
    "category": "Atmospheric / Chemical",
    "severity": "critical",
    "description": "Presence or potential release of toxic gases, vapours, or airborne contaminants.\n\nRisks: Exposure to toxic process gases; Exposure to cleaning chemicals; Exposure to decomposition products or harmful vapours.",
    "consequences": [
      "Poisoning",
      "respiratory failure",
      "permanent injury",
      "fatalities"
    ],
    "controls": [
      "Identify substances and their exposure limits",
      "Isolate release sources where possible",
      "Test for relevant contaminants using appropriate equipment",
      "Ventilate and monitor the atmosphere as required",
      "Provide suitable respiratory protection and emergency rescue arrangements"
    ],
    "permitTypeCodes": [
      "HOT",
      "COLD",
      "CSP",
      "ELEC"
    ]
  },
  {
    "code": "HAZ-ATM-003",
    "name": "Flammable Atmosphere in Confined Space",
    "category": "Atmospheric / Fire and Explosion",
    "severity": "critical",
    "description": "Accumulation of flammable gas, vapour, mist, or combustible dust in an enclosed or poorly ventilated area.\n\nRisks: Ignition from hot work; Electrical faults; Static electricity; Use of unsuitable tools.",
    "consequences": [
      "Explosion",
      "burns",
      "structural damage",
      "fatalities"
    ],
    "controls": [
      "Test the atmosphere before entry and hot work",
      "Eliminate ignition sources and control hazardous releases",
      "Apply required isolation, purging, and ventilation",
      "Use appropriately rated equipment",
      "Stop work and evacuate if conditions breach approved limits"
    ],
    "permitTypeCodes": [
      "HOT",
      "COLD",
      "CSP",
      "ELEC"
    ]
  },
  {
    "code": "HAZ-ENV-001",
    "name": "Heat Stress / Poor Ventilation",
    "category": "Environmental / Occupational Health",
    "severity": "high",
    "description": "Exposure to high temperatures, humidity, radiant heat, or inadequate ventilation during work.\n\nRisks: Heat accumulation; Strenuous activity; Restricted air movement; Dehydration.",
    "consequences": [
      "Heat exhaustion",
      "heatstroke",
      "impaired judgment",
      "collapse",
      "fatalities"
    ],
    "controls": [
      "Assess environmental and workload conditions",
      "Provide ventilation, hydration, and suitable rest periods",
      "Limit exposure and schedule work appropriately",
      "Monitor workers for symptoms",
      "Maintain communication and emergency arrangements"
    ],
    "permitTypeCodes": [
      "HOT",
      "COLD",
      "CSP",
      "WAH"
    ]
  },
  {
    "code": "HAZ-HEIGHT-001",
    "name": "Fall from Height",
    "category": "Work at Height",
    "severity": "critical",
    "description": "Exposure to unprotected edges, openings, fragile surfaces, or elevated work positions.\n\nRisks: Loss of balance; Ladder failure; Unsafe access; Failure of fall protection.",
    "consequences": [
      "Fractures",
      "head injuries",
      "permanent disability",
      "fatalities"
    ],
    "controls": [
      "Prioritize safe platforms and collective protection",
      "Inspect scaffolds and ladders",
      "Protect openings and edges",
      "Use suitable fall-arrest or restraint systems with appropriate anchorage",
      "Establish a rescue plan"
    ],
    "permitTypeCodes": [
      "HOT",
      "COLD",
      "WAH",
      "ELEC"
    ]
  },
  {
    "code": "HAZ-HEIGHT-002",
    "name": "Falling Objects",
    "category": "Work at Height / Dropped Objects",
    "severity": "high",
    "description": "Tools, materials, debris, or equipment falling from elevated work areas.\n\nRisks: Dropped tools; Unsecured materials; Dislodged components; Simultaneous work above and below.",
    "consequences": [
      "Head injuries",
      "fractures",
      "crushing injuries",
      "fatalities"
    ],
    "controls": [
      "Secure tools and materials",
      "Use tool lanyards where suitable",
      "Install toe boards or debris containment",
      "Establish exclusion zones",
      "Coordinate work at different elevations",
      "Require appropriate head protection"
    ],
    "permitTypeCodes": [
      "HOT",
      "COLD",
      "WAH",
      "ELEC"
    ]
  },
  {
    "code": "HAZ-STRUCT-001",
    "name": "Structural Instability / Platform Failure",
    "category": "Structural / Access",
    "severity": "critical",
    "description": "Failure or instability of scaffolds, temporary platforms, roofs, floors, supports, or structures.\n\nRisks: Overloading; Inadequate foundations; Damaged components; Unstable surfaces; Unauthorized modifications.",
    "consequences": [
      "Falls",
      "collapse",
      "crush injuries",
      "multiple fatalities"
    ],
    "controls": [
      "Verify load capacity and structural condition",
      "Inspect and approve temporary structures",
      "Prevent overloading",
      "Protect fragile surfaces",
      "Restrict access until the structure is confirmed safe"
    ],
    "permitTypeCodes": [
      "HOT",
      "COLD",
      "WAH",
      "EXC"
    ]
  },
  {
    "code": "HAZ-EXC-001",
    "name": "Excavation Collapse / Ground Failure",
    "category": "Excavation / Ground Stability",
    "severity": "critical",
    "description": "Collapse of excavation walls, trenches, embankments, or unstable ground.\n\nRisks: Unsupported excavation faces; Vibration; Water ingress; Nearby loads; Unsuitable soil conditions.",
    "consequences": [
      "Burial",
      "crushing",
      "suffocation",
      "serious injury",
      "fatalities"
    ],
    "controls": [
      "Assess ground conditions",
      "Provide suitable shoring, shielding, or sloping",
      "Inspect excavations",
      "Control water ingress and nearby loads",
      "Prevent entry into unsafe excavations",
      "Provide safe access and egress"
    ],
    "permitTypeCodes": [
      "EXC"
    ]
  },
  {
    "code": "HAZ-EXC-002",
    "name": "Underground Utilities / Buried Services",
    "category": "Excavation / Utilities",
    "severity": "critical",
    "description": "Contact with or damage to buried electrical cables, gas lines, pipelines, drains, or communication services.\n\nRisks: Excavating without verified service locations; Inaccurate drawings; Accidental penetration of buried infrastructure.",
    "consequences": [
      "Electrocution",
      "fire",
      "explosion",
      "flooding",
      "toxic releases",
      "service disruption"
    ],
    "controls": [
      "Review utility drawings",
      "Obtain required service-owner clearances",
      "Locate and mark services using suitable detection methods",
      "Use controlled digging methods near identified services",
      "Isolate services where necessary",
      "Stop work if unexpected services are discovered"
    ],
    "permitTypeCodes": [
      "HOT",
      "COLD",
      "ELEC",
      "EXC"
    ]
  },
  {
    "code": "HAZ-TRAFFIC-001",
    "name": "Mobile Plant / Vehicle Interaction",
    "category": "Vehicle / Equipment Movement",
    "severity": "high",
    "description": "Exposure to moving vehicles, excavators, loaders, cranes, or other mobile equipment around the work area.\n\nRisks: Blind spots; Reversing; Restricted visibility; Unstable ground; Pedestrian and vehicle route conflicts.",
    "consequences": [
      "Collision",
      "crushing",
      "run-over injuries",
      "fatalities"
    ],
    "controls": [
      "Establish traffic and pedestrian segregation",
      "Use competent operators and trained spotters where needed",
      "Define exclusion zones",
      "Verify ground bearing capacity",
      "Control reversing",
      "Use suitable barriers and warning systems"
    ],
    "permitTypeCodes": [
      "HOT",
      "COLD",
      "WAH",
      "EXC"
    ]
  },
  {
    "code": "HAZ-EXC-003",
    "name": "Water Ingress / Flooding / Engulfment",
    "category": "Excavation / Environmental",
    "severity": "high",
    "description": "Water, slurry, loose material, or other substances entering an excavation or work area and creating entrapment or engulfment hazards.\n\nRisks: Groundwater ingress; Damaged water services; Heavy rainfall; Unstable saturated soil; Nearby material release.",
    "consequences": [
      "Drowning",
      "burial",
      "collapse",
      "hypothermia",
      "fatalities"
    ],
    "controls": [
      "Assess water sources and weather",
      "Provide suitable drainage or pumping",
      "Monitor ground stability",
      "Protect against material ingress",
      "Maintain safe escape routes",
      "Stop work and evacuate when conditions become unsafe"
    ],
    "permitTypeCodes": [
      "CSP",
      "EXC"
    ]
  },
  {
    "code": "HAZ-CHEM-001",
    "name": "Hazardous Chemical Exposure",
    "category": "Chemical",
    "severity": "high",
    "description": "Contact with or exposure to corrosive, toxic, irritant, reactive, or otherwise hazardous substances.\n\nRisks: Splashing; Spills; Inhalation; Skin absorption; Incompatible chemical reactions.",
    "consequences": [
      "Chemical burns",
      "poisoning",
      "eye damage",
      "respiratory injury",
      "environmental contamination"
    ],
    "controls": [
      "Review safety data sheets",
      "Assess chemical compatibility",
      "Use suitable containment and ventilation",
      "Provide substance-specific PPE and eyewash or emergency showers where required",
      "Maintain spill-response arrangements"
    ],
    "permitTypeCodes": [
      "HOT",
      "COLD",
      "CSP",
      "ELEC",
      "EXC"
    ]
  },
  {
    "code": "HAZ-PRESS-001",
    "name": "Pressure Release / Stored Pressure",
    "category": "Pressure / Mechanical Energy",
    "severity": "critical",
    "description": "Uncontrolled release of pressurized gas, liquid, steam, or other stored pressure during work.\n\nRisks: Opening pressurized equipment; Failed hoses; Trapped pressure; Incorrect isolation; Pressure surges.",
    "consequences": [
      "Injection injuries",
      "impact injuries",
      "burns",
      "toxic exposure",
      "equipment damage",
      "fatalities"
    ],
    "controls": [
      "Identify pressure sources",
      "Isolate and depressurize equipment",
      "Drain or vent safely",
      "Verify zero pressure",
      "Secure hoses and fittings",
      "Use approved pressure limits and exclusion zones for testing"
    ],
    "permitTypeCodes": [
      "HOT",
      "COLD",
      "CSP",
      "ELEC",
      "EXC"
    ]
  },
  {
    "code": "HAZ-REL-001",
    "name": "Unexpected Material / Process Release",
    "category": "Process Safety / Release",
    "severity": "critical",
    "description": "Uncontrolled release of process fluids, gases, steam, dust, or other materials from equipment, piping, tanks, or nearby systems.\n\nRisks: Incomplete isolation; Leaking valves; Incorrect line identification; Residual material; Damage to adjacent equipment.",
    "consequences": [
      "Burns",
      "poisoning",
      "fire",
      "explosion",
      "environmental damage",
      "fatalities"
    ],
    "controls": [
      "Identify and isolate relevant sources",
      "Verify isolation effectiveness",
      "Drain, purge, or flush as appropriate",
      "Assess adjacent systems",
      "Establish release response and evacuation arrangements",
      "Stop work if isolation integrity is in doubt"
    ],
    "permitTypeCodes": [
      "HOT",
      "COLD",
      "CSP",
      "ELEC",
      "EXC"
    ]
  },
  {
    "code": "HAZ-PHYS-001",
    "name": "Noise and Vibration",
    "category": "Physical / Occupational Health",
    "severity": "medium",
    "description": "Exposure to high noise levels or mechanical vibration from tools, machinery, and surrounding operations.\n\nRisks: Excessive exposure duration; High-impact noise; Vibrating hand tools; Impaired communication.",
    "consequences": [
      "Hearing loss",
      "hand-arm vibration disorders",
      "fatigue",
      "missed warnings"
    ],
    "controls": [
      "Assess noise and vibration exposure",
      "Use quieter methods where practicable",
      "Maintain tools",
      "Limit exposure duration",
      "Provide suitable hearing protection",
      "Establish communication methods"
    ],
    "permitTypeCodes": [
      "HOT",
      "COLD",
      "WAH",
      "ELEC",
      "EXC"
    ]
  },
  {
    "code": "HAZ-PHYS-002",
    "name": "Slips, Trips and Same-Level Falls",
    "category": "Physical / Access",
    "severity": "medium",
    "description": "Unsafe walking or working surfaces caused by obstructions, spills, uneven ground, cables, or poor housekeeping.\n\nRisks: Slipping on wet surfaces; Tripping over tools or cables; Falling on uneven terrain.",
    "consequences": [
      "Sprains",
      "fractures",
      "cuts",
      "head injuries"
    ],
    "controls": [
      "Maintain housekeeping",
      "Remove obstructions",
      "Manage cables and hoses",
      "Control spills",
      "Provide suitable lighting and footwear",
      "Maintain safe access routes"
    ],
    "permitTypeCodes": [
      "HOT",
      "COLD",
      "CSP",
      "WAH",
      "ELEC",
      "EXC"
    ]
  },
  {
    "code": "HAZ-ENV-002",
    "name": "Adverse Weather / Environmental Conditions",
    "category": "Environmental",
    "severity": "high",
    "description": "Weather or environmental conditions that make work unsafe.\n\nRisks: High winds affecting elevated work or suspended loads; Lightning near exposed work; Heavy rain affecting excavations; Poor visibility; Extreme temperatures.",
    "consequences": [
      "Falls",
      "structural instability",
      "electrocution",
      "dropped loads",
      "heat illness",
      "flooding"
    ],
    "controls": [
      "Define task-specific weather limits",
      "Monitor forecasts and actual conditions",
      "Suspend work when limits are exceeded",
      "Secure materials and equipment",
      "Inspect affected work areas before restarting"
    ],
    "permitTypeCodes": [
      "HOT",
      "COLD",
      "WAH",
      "ELEC",
      "EXC"
    ]
  },
  {
    "code": "HAZ-ENV-003",
    "name": "Inadequate Lighting / Visibility",
    "category": "Environmental / Access",
    "severity": "medium",
    "description": "Insufficient lighting or visibility for safe access, inspection, tool use, or hazard identification.\n\nRisks: Missed hazards; Incorrect connections; Unsafe movement; Impaired communication.",
    "consequences": [
      "Falls",
      "contact injuries",
      "equipment damage",
      "incorrect safety-critical actions"
    ],
    "controls": [
      "Provide adequate task lighting",
      "Maintain emergency lighting where required",
      "Ensure lights are suitable for the hazardous area",
      "Keep access routes illuminated",
      "Provide backup lighting where loss of lighting would create danger"
    ],
    "permitTypeCodes": [
      "HOT",
      "COLD",
      "CSP",
      "WAH",
      "ELEC",
      "EXC"
    ]
  },
  {
    "code": "HAZ-ERG-001",
    "name": "Manual Handling / Ergonomic Strain",
    "category": "Ergonomic / Physical",
    "severity": "medium",
    "description": "Physical strain from lifting, carrying, pushing, pulling, repetitive movements, or awkward working postures.\n\nRisks: Heavy loads; Twisting; Overhead work; Repetitive tool use; Restricted access.",
    "consequences": [
      "Back injuries",
      "muscle strains",
      "joint injuries",
      "musculoskeletal disorders"
    ],
    "controls": [
      "Assess load weight, shape, and handling conditions",
      "Use mechanical aids or team lifting where appropriate",
      "Plan material movement and access",
      "Reduce repetitive and awkward movements",
      "Provide suitable training and rest arrangements"
    ],
    "permitTypeCodes": [
      "HOT",
      "COLD",
      "CSP",
      "WAH",
      "ELEC",
      "EXC"
    ]
  },
  {
    "code": "HAZ-SIMOPS-001",
    "name": "Simultaneous Operations (SIMOPS) / Work Interface",
    "category": "Work Coordination",
    "severity": "high",
    "description": "Interactions between concurrent jobs, equipment, personnel, or work areas that introduce additional hazards.\n\nRisks: Hot work near flammable releases; Overhead work above other workers; Excavation near vehicle routes; Conflicting isolations; Incompatible simultaneous activities.",
    "consequences": [
      "Fire",
      "explosion",
      "dropped-object injuries",
      "equipment damage",
      "multiple fatalities"
    ],
    "controls": [
      "Identify overlapping permits and nearby activities",
      "Conduct a SIMOPS assessment where required",
      "Coordinate work through the designated site authority",
      "Establish exclusion zones and work sequencing",
      "Suspend or prohibit incompatible work when risks cannot be adequately controlled"
    ],
    "permitTypeCodes": [
      "HOT",
      "COLD",
      "CSP",
      "WAH",
      "ELEC",
      "EXC"
    ]
  },
  {
    "code": "HAZ-HUMAN-001",
    "name": "Communication Failure / Inadequate Supervision",
    "category": "Human Factors / Work Coordination",
    "severity": "high",
    "description": "Failure to communicate work status, hazards, changes, isolation status, or emergency instructions to affected personnel.\n\nRisks: Misunderstood instructions; Unauthorized restart; Missed warnings; Inadequate handover; Loss of contact with confined-space workers.",
    "consequences": [
      "Unsafe actions",
      "delayed evacuation",
      "exposure to hazards",
      "serious injuries",
      "fatalities"
    ],
    "controls": [
      "Conduct a pre-job briefing or toolbox talk",
      "Confirm roles, responsibilities, and communication methods",
      "Maintain contact arrangements for confined-space work",
      "Record permit handovers and communicate status changes",
      "Stop work if essential communication or supervision is lost"
    ],
    "permitTypeCodes": [
      "HOT",
      "COLD",
      "CSP",
      "WAH",
      "ELEC",
      "EXC"
    ]
  },
  {
    "code": "HAZ-EMER-001",
    "name": "Inadequate Emergency Response / Rescue Arrangements",
    "category": "Emergency Preparedness",
    "severity": "critical",
    "description": "Inadequate preparation, equipment, personnel, or access to respond effectively to a foreseeable work-related emergency.\n\nRisks: Delayed rescue; Unavailable emergency equipment; Untrained responders; Inaccessible casualty locations; Unsafe rescue attempts.",
    "consequences": [
      "Escalation of injuries",
      "secondary casualties",
      "permanent disability",
      "fatalities"
    ],
    "controls": [
      "Define task-specific emergency and rescue arrangements",
      "Confirm trained responders and suitable equipment are available",
      "Maintain emergency access and reliable communication",
      "Verify rescue arrangements before high-risk work begins",
      "Ensure rescuers do not expose themselves to uncontrolled hazards"
    ],
    "permitTypeCodes": [
      "HOT",
      "COLD",
      "CSP",
      "WAH",
      "ELEC",
      "EXC"
    ]
  },
] as const;

const HAZARD_ALIASES: Record<string, string> = {
  FIRE: 'HAZ-FIRE-002',
  ELECTRICAL: 'HAZ-ELEC-001',
  CHEMICAL: 'HAZ-CHEM-001',
  FALL: 'HAZ-HEIGHT-001',
  'CONFINED-SPACE': 'HAZ-ATM-003',
  MECHANICAL: 'HAZ-MECH-001',
};

/** Empty list means the hazard is offered on every permit type. */
export function hazardFitsPermitType(
  permitTypeCodes: readonly string[] | null | undefined,
  permitTypeCode: string | null | undefined,
): boolean {
  if (!permitTypeCodes?.length) {
    return true;
  }
  if (!permitTypeCode) {
    return true;
  }
  return permitTypeCodes.includes(permitTypeCode);
}

type HazardDb = Pick<Database, 'insert' | 'select' | 'update'>;

export async function ensureDefaultHazards(
  db: HazardDb,
  tenantId: string,
  actorId: string,
): Promise<{ created: number; updated: number }> {
  const existing = await db.select().from(hazardCategories).where(eq(hazardCategories.tenantId, tenantId));
  let created = 0;
  let updated = 0;

  for (const hazard of DEFAULT_HAZARDS) {
    const byCode = existing.find((row) => row.code === hazard.code);
    if (byCode) {
      continue;
    }
    const aliasCode = Object.entries(HAZARD_ALIASES).find(([, canonical]) => canonical === hazard.code)?.[0];
    const byAlias = aliasCode ? existing.find((row) => row.code === aliasCode) : undefined;
    const values = {
      code: hazard.code,
      name: hazard.name,
      category: hazard.category,
      description: hazard.description,
      severity: hazard.severity,
      consequences: [...hazard.consequences],
      controls: [...hazard.controls],
      permitTypeCodes: [...hazard.permitTypeCodes],
      isActive: true,
      updatedBy: actorId,
      updatedAt: new Date(),
    };
    if (byAlias) {
      await db
        .update(hazardCategories)
        .set(values)
        .where(and(eq(hazardCategories.id, byAlias.id), eq(hazardCategories.tenantId, tenantId)));
      byAlias.code = hazard.code;
      updated += 1;
      continue;
    }
    const [row] = await db
      .insert(hazardCategories)
      .values({
        tenantId,
        ...values,
        createdBy: actorId,
      })
      .returning();
    existing.push(row);
    created += 1;
  }

  return { created, updated };
}
