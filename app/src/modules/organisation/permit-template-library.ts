/**
 * Permit template form definitions, and the reference set transcribed from the
 * Fresenius Kabi Ranjangaon safe work permit pack (SOP/ES/023-F1 to F9).
 */

export const TEMPLATE_FIELD_TYPES = [
  'check', // Yes / No / Not applicable
  'text',
  'textarea',
  'number',
  'date',
  'time',
  'select',
  'multiselect',
  'signature', // name, date, time and signature
] as const;
export type TemplateFieldType = (typeof TEMPLATE_FIELD_TYPES)[number];

/** Permit details a field can start from, so people do not type what the permit already holds. */
export const TEMPLATE_PREFILL_SOURCES = [
  'department',
  'location',
  'equipment',
  'job-description',
  'valid-from',
  'valid-to',
  'crew-names',
  'crew-count',
] as const;
export type TemplatePrefillSource = (typeof TEMPLATE_PREFILL_SOURCES)[number];

export const TEMPLATE_KINDS = ['permit', 'check-sheet'] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

export type TemplateField = {
  id: string;
  label: string;
  type: TemplateFieldType;
  required?: boolean;
  help?: string;
  unit?: string;
  options?: string[];
  prefill?: TemplatePrefillSource;
};

export type TemplateSection = { id: string; title: string; fields: TemplateField[] };

export type TemplateConfig = {
  kind: TemplateKind;
  /** Document or format number the form comes from. */
  reference?: string;
  /** Statement the signatories agree to. */
  declaration?: string;
  sections: TemplateSection[];
};

export type ReferenceTemplate = {
  code: string;
  name: string;
  description: string;
  /** Permit type codes this template applies to; ['*'] links every permit type. */
  permitTypeCodes: string[];
  config: TemplateConfig;
};

type FieldSpec = string | [label: string, type: TemplateFieldType, extra?: Partial<TemplateField>];

function section(id: string, title: string, fields: FieldSpec[]): TemplateSection {
  return {
    id,
    title,
    fields: fields.map((spec, index) => {
      const [label, type, extra] = typeof spec === 'string' ? [spec, 'check' as const, {}] : spec;
      // Every row on the paper check sheets must be ticked Yes, No or N/A, so checks are required.
      return { id: `${id}-${index + 1}`, label, type, ...(type === 'check' ? { required: true } : {}), ...extra };
    }),
  };
}

const DECLARATION =
  'I/We agree to follow all the applicable safety precautions mentioned above and assure that they will be followed during the entire course of the work.';

function signOff(precautionsLabel = 'Special precautions, if any'): TemplateSection {
  return section('sign-off', 'Sign-off', [
    ['Contractor', 'signature', { required: true }],
    ['Job issued by', 'signature', { required: true }],
    [precautionsLabel, 'textarea'],
  ]);
}

const PPE = (items: string[]) => section('ppe', 'Personal protective equipment required', items);

export const REFERENCE_TEMPLATES: ReferenceTemplate[] = [
  {
    code: 'SOP-ES-023-F1',
    name: 'Safe work permit',
    description:
      'Master permit for any job. Valid for up to 7 days when the job issuer signs daily, and only until 16:30 unless the Head / Shift In-charge (Engineering) sanctions an extension. The check sheet for each type of work ticked must be attached. Distribution: pink copy to contractor, yellow to EHS, white to issuing department.',
    permitTypeCodes: ['*'],
    config: {
      kind: 'permit',
      reference: 'SOP/ES/023-F1',
      sections: [
        section('permit', 'Permit details', [
          ['Issuing department', 'text', { required: true, prefill: 'department' }],
          ['Permit issued to (contractor firm)', 'text', { required: true, help: 'M/s …' }],
          ['Contractor supervisor', 'signature', { required: true }],
          ['Supervisor contact number', 'text'],
          [
            'Persons covered',
            'textarea',
            {
              required: true,
              help: 'Names of everyone on the job. All must be covered by group insurance and the Workmen’s Compensation policy.',
              prefill: 'crew-names',
            },
          ],
          ['Number of persons', 'number', { required: true, prefill: 'crew-count' }],
        ]),
        section('validity', 'Validity', [
          ['Valid from', 'date', { required: true, prefill: 'valid-from' }],
          ['Valid to', 'date', { required: true, help: 'At most 7 days after the start date.', prefill: 'valid-to' }],
          ['Daily issuer signature', 'signature', { help: 'The job issuer signs on each working day.' }],
        ]),
        section('job', 'Job to be carried out', [
          ['Equipment name', 'text', { prefill: 'equipment' }],
          ['Equipment number', 'text'],
          ['Location', 'text', { required: true, prefill: 'location' }],
          ['Description of the job', 'textarea', { required: true, prefill: 'job-description' }],
        ]),
        section('work-type', 'Type of work', [
          [
            'Types of work to be carried out',
            'multiselect',
            {
              required: true,
              help: 'Attach the check sheet for every type ticked.',
              options: [
                'Normal jobs or cold work at floor level',
                'Electrical work in HT/LT above 24 volts',
                'Working at height, fragile roof and ceiling',
                'Hot work (welding and gas cutting)',
                'Confined space entry',
                'Excavation and civil work',
                'Work in hazardous area, tank cleaning',
                'Machine / equipment shifting',
                'EOT crane work',
              ],
            },
          ],
          ['Remarks', 'textarea'],
        ]),
        section('precautions', 'Safety precautions (any type of work)', [
          'All concerned area personnel notified about the nature of work',
          'Surrounding area cleaned of oil and slippery floor',
          ['Special precautions', 'textarea'],
          ['Area concerned personnel', 'signature'],
        ]),
        section('authorisation', 'Authorisation', [
          ['Job issued by', 'signature', { required: true }],
          ['HOD of job issuer', 'signature', { required: true }],
          [
            'Job authorised by',
            'signature',
            { required: true, help: 'In the absence of the Safety Officer, the Factory Manager or Shift In-charge can authorise.' },
          ],
        ]),
        section('extension', 'Extension beyond 16:30', [
          ['Person supervising during the extension', 'text'],
          ['Extension permitted up to', 'number', { unit: 'hrs' }],
          ['Emergency contact number', 'text'],
          ['Shift in-charge', 'signature'],
          ['Area concerned personnel', 'signature'],
        ]),
        section('completion', 'Completion', [['Job completion accepted by', 'signature', { required: true }]]),
      ],
    },
  },
  {
    code: 'SOP-ES-023-F2',
    name: 'Check sheet: electrical work',
    description: 'Electrical work in HT/LT above 24 volts.',
    permitTypeCodes: ['ELECTRICAL'],
    config: {
      kind: 'check-sheet',
      reference: 'SOP/ES/023-F2',
      declaration: DECLARATION,
      sections: [
        section('checks', 'Electrical work in HT/LT above 24 volts', [
          'Electrical equipment de-energised and fuses removed',
          'Lock out / tag out (LOTO) applied',
          ['Person applying LOTO', 'text', { help: 'If lock out / tag out is applied.' }],
          'All portable tools connected with plug and earthing',
          'Portable tools are double insulated',
          'Portable tools fitted with operating switch',
          'Ladder with proper supports is being used',
        ]),
        PPE(['Electric shock proof safety shoes', 'Helmet', 'Earplugs', 'Dust respirator', 'Electrically tested hand gloves', 'Safety belt']),
        signOff(),
      ],
    },
  },
  {
    code: 'SOP-ES-023-F3',
    name: 'Check sheet: work at height and fragile roof',
    description: 'Working at heights above 2 metres, including roof sheds and fragile roofs.',
    permitTypeCodes: ['WORKING-AT-HEIGHT'],
    config: {
      kind: 'check-sheet',
      reference: 'SOP/ES/023-F3',
      declaration: DECLARATION,
      sections: [
        section('checks', 'Working at heights above 2 metres', [
          'Ladder with proper supports is being used',
          'Scaffolding is being used',
          'Attendant provided during the course of work',
          ['Name of attendant', 'text'],
          'Roof ladder used for working on roof sheds and fragile roofs',
          'Safety belt used and properly secured during work',
          'Safety shoes used',
          'Helmet used during work',
          'Area barricaded / cordoned against unauthorised entry',
          'Safety net provided and used',
        ]),
        PPE(['Safety shoes', 'Helmet', 'Earplugs', 'Dust respirator', 'Safety belt']),
        section('fitness', 'Fitness', ['Person working is medically fit to work at height']),
        signOff(),
      ],
    },
  },
  {
    code: 'SOP-ES-023-F4',
    name: 'Check sheet: hot work',
    description: 'Hot work such as welding and gas cutting, including fire watch during and after the work.',
    permitTypeCodes: ['HOT-WORK'],
    config: {
      kind: 'check-sheet',
      reference: 'SOP/ES/023-F4',
      declaration: DECLARATION,
      sections: [
        section('isolation', 'Hot work: welding and gas cutting', [
          'Electrical equipment de-energised and fuses removed',
          'Pipeline / tank drained if hot work is in tanks',
          'Tank / pipeline valve closed and blanked',
        ]),
        PPE(['Goggles', 'Welding glass', 'Hand gloves', 'Safety belt', 'Safety shoes', 'Helmet', 'Earplugs', 'Dust respirator']),
        section('fire', 'Fire precautions', [
          'Fire extinguisher kept near the hot job',
          'Water bucket kept near the hot job',
          'Area barricaded / cordoned against unauthorised access',
          'Surroundings free from oil, cotton and combustible material up to 11 metres',
          'All open tanks covered with MS sheet',
          'All fans and blowers near the area kept off',
          'Fire fighter / security person present when working in hazardous areas',
          'Proper means of escape available',
        ]),
        section('fire-watch', 'Fire watch during and after the work, including breaks', [
          [
            'Fire watch: continuously for one hour',
            'signature',
            { required: true, help: 'Areas where sparks and heat may spread are inspected during the watch and found safe.' },
          ],
          ['Fire watch: three hours after completion', 'signature', { required: true }],
        ]),
        signOff(),
      ],
    },
  },
  {
    code: 'SOP-ES-023-F5',
    name: 'Check sheet: confined space entry',
    description: 'Entry into a confined space, with site preparation, pre-entry gas testing and rescue arrangements.',
    permitTypeCodes: ['CONFINED-SPACE', 'CONFINED'],
    config: {
      kind: 'check-sheet',
      reference: 'SOP/ES/023-F5',
      declaration: DECLARATION,
      sections: [
        section('entry', 'Entry details', [
          ['Date of entry', 'date', { required: true }],
          ['Time of entry', 'time', { required: true }],
          ['Date of completion', 'date'],
          ['Time of completion', 'time'],
          ['Site location (identity)', 'text', { required: true, prefill: 'location' }],
          ['Purpose of entry into the space', 'textarea', { required: true }],
        ]),
        section('preparation', 'A. Site preparation', [
          'Work area isolated with signs / barriers',
          'All power sources tagged / locked / tried',
          'All input and discharge lines capped / plugged',
          'Contents drained / flushed / neutralised',
          'Space cleaned of contaminant / purged',
          'Space ventilated before entering',
        ]),
        section('atmosphere', 'B. Atmospheric testing (pre-entry)', [
          'All test equipment calibrated',
          ['Oxygen content', 'number', { required: true, unit: '%' }],
          ['Reading time', 'time', { required: true }],
          ['Tested by (initials)', 'text', { required: true }],
          ['Flammable concentration', 'number', { unit: '% LEL' }],
          ['Toxic concentration', 'number', { unit: 'ppm' }],
          ['Toxic contaminant', 'number', { unit: 'PEL' }],
          ['Temperature inside the space', 'number', { unit: '°C' }],
        ]),
        section('communication', 'C. Communication', [
          ['Nearest phone number', 'text'],
          ['Extension number', 'text'],
          ['Mobile number', 'text', { required: true }],
          ['Emergency / rescue equipment required', 'textarea'],
        ]),
        section('equipment', 'D. Safety equipment required for entry', [
          [
            'Equipment required',
            'multiselect',
            {
              options: [
                'Respirator',
                'Lifeline',
                'Gloves',
                'Protective clothing',
                'Fire extinguisher',
                'SCBA',
                'Escape harness',
                'Tripod escape unit',
                'Air ventilation pump',
              ],
            },
          ],
          'Additional requirements',
          'Portable atmospheric monitor required',
        ]),
        section('hot-work', 'E. Hot work', [
          ['Hot work to be performed inside the space', 'check', { help: 'If yes, a hot work check sheet is also needed.' }],
          ['Type of hot work', 'text'],
        ]),
        signOff(),
      ],
    },
  },
  {
    code: 'SOP-ES-023-F6',
    name: 'Check sheet: excavation and civil work',
    description: 'Excavation and civil jobs near buried services.',
    permitTypeCodes: ['EXCAVATION'],
    config: {
      kind: 'check-sheet',
      reference: 'SOP/ES/023-F6',
      declaration: DECLARATION,
      sections: [
        section('excavation', 'Excavation work', [
          'Exact route of excavation explained to everyone working',
          'Area barricaded / cordoned against unauthorised access',
          'Area marked for electrical cables on the route of excavation',
          'Electrical equipment de-energised and fuses removed',
          'Pipeline layout available and given to people working',
          'Electrical cable route diagram available and given',
          'Information about hazards given to people working',
          'Restriction on use of sharp sickles given',
          'People are wearing insulated shoes',
          'Proper means of escape available',
        ]),
        section('civil', 'Civil work', [
          'Exact work content explained to everyone working',
          'Area barricaded / cordoned against unauthorised access',
          'Area marked for electrical cables on the route of civil work',
          'Electrical equipment de-energised and fuses removed',
          'Pipeline layout available and given to people working',
          'Electrical cable route diagram available and given',
          'Information about hazards given to people working',
        ]),
        signOff(),
      ],
    },
  },
  {
    code: 'SOP-ES-023-F7',
    name: 'Check sheet: work in hazardous area',
    description: 'Hazardous material handling and tank cleaning.',
    permitTypeCodes: ['HAZARDOUS-AREA'],
    config: {
      kind: 'check-sheet',
      reference: 'SOP/ES/023-F7',
      declaration: DECLARATION,
      sections: [
        section('work', 'Work in hazardous area', [
          ['Type of work', 'multiselect', { required: true, options: ['Hazardous handling', 'Tank cleaning'] }],
          'Proper handling equipment available',
          'Properly trained and experienced people put on the job',
        ]),
        PPE([
          'Goggles',
          'Hand gloves',
          'Safety shoes',
          'Helmet',
          'Cartridge filter respirator',
          'Vapour / mist respirator',
          'Dust respirator',
          'Eye washer or eye fountain',
        ]),
        section('controls', 'Controls', [
          'Fire extinguisher kept near the work area',
          'Water bucket kept near the hot job',
          'Area barricaded / cordoned against unauthorised access',
          'Surroundings free from oil, cotton and combustible material',
          'Tanks emptied and washed before work starts',
          'Earthing provided to discharge static electricity',
          'Fire fighter / security person present when working in hazardous areas',
          'Proper means of escape available',
          'Electrical equipment de-energised and fuses removed',
        ]),
        signOff(),
      ],
    },
  },
  {
    code: 'SOP-ES-023-F8',
    name: 'Check sheet: machine / equipment shifting',
    description: 'Moving machines and equipment, including supervision and load handling.',
    permitTypeCodes: ['EQUIPMENT-SHIFTING'],
    config: {
      kind: 'check-sheet',
      reference: 'SOP/ES/023-F8',
      declaration: DECLARATION,
      sections: [
        section('checks', 'Machine / equipment shifting', [
          'All employees told the do’s and don’ts in a language they understand, through a toolbox talk',
          'Everyone warned not to go below the load while equipment / machine is being shifted',
          'Pipes and rollers placed using tong holders, not by hand, to avoid running nip',
          'Equipment / material shifted with certified equipment and tools, made empty and as light as practicable, with toppling prevention',
          'Strict and continuous supervision by the contractor and job executor; the supervisor does not leave the work, including for lunch',
          'Electrical connections to welding transformer and hand tools taken from switch boards with enough load capacity',
          'Equipment to be shifted electrically isolated and freed from its foundation bolts before work starts',
          'Fuses removed and warning board “Man at work, do not start” put up',
          'When working at height, one person deputed to keep people away from the area below',
          'Equipment pulled rather than pushed unless pushing is essential and unavoidable',
        ]),
        section('supervision', 'Supervision', [
          ['Supervision provided', 'select', { required: true, options: ['Continuous', 'Intermittent'] }],
          ['Supervisor allocated', 'text', { required: true }],
        ]),
        PPE(['Safety shoes', 'Helmet', 'Earplugs', 'Dust respirator', 'Safety belt']),
        signOff(),
      ],
    },
  },
  {
    code: 'SOP-ES-023-F9',
    name: 'Check sheet: EOT crane work',
    description: 'Maintenance on electric overhead travelling cranes, usually at height.',
    permitTypeCodes: ['LIFTING'],
    config: {
      kind: 'check-sheet',
      reference: 'SOP/ES/023-F9',
      declaration: DECLARATION,
      sections: [
        section('checks', 'EOT crane work', [
          'Equipment electrically isolated and LOTO procedure followed before starting',
          'Safety belt and helmet worn, and safety belt hooks anchored to ladder rungs before climbing',
          'Life line (safety belt rope) fixed to a rigid support before working at height',
          'Only skilled and experienced people work at height; no freshers',
          'Drinking water kept available; no one fasting goes to work at height',
          'Person working is medically fit to work at height',
          'Area below barricaded and monitored by a deputed person to prevent injury from falling tools / objects',
          'Rigid supports / cross members used at seven feet when working below the carriage, to arrest an accidental fall of the cage',
          'TVS / high tensile / Allen bolts with spring washers or lock nuts used for every job',
          'Work executor instructed not to leave the site until the work is complete; strict supervision provided',
          ['Persons delegated for supervision', 'text', { required: true }],
        ]),
        signOff('Special precautions recommended by HOD / HSE'),
      ],
    },
  },
];
