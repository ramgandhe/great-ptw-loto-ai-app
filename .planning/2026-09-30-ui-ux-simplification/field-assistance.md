# Field-by-Field Entry Reduction

## What “smart” means in this change

**Deterministic assistance, not generative AI.** S2/S3 will reuse known relationships, previous factual values, validated defaults and tenant-authorized lookup data. Each derived value shows its source and remains editable where the actor has permission. No model/provider, retrieval pipeline, prompt infrastructure or AI hazard inference is included in S0–S7. The inspected runtime sources contain no identified AI integration; the repository name and stale code-style rule do not establish one.

Work-description-to-hazard/PPE recommendations would be a separate proposed feature requiring curated safety knowledge, evaluation cases, provenance, provider/data controls and accountable human confirmation. This plan does not claim to deliver it. No extra AI slice is necessary to achieve the agreed entry/navigation improvements.

## Permit — S2

| Field | Today | Revised behavior | Boundary |
|---|---|---|---|
| Work scope | Typed narrative | First input: “Describe the work”; keep original text | Never fabricate task details. |
| Title | Second typed input | Editable suggestion from the first nonempty sentence/line of scope, limited to 255 characters; show “From work description” | Once manually edited, stop replacing it. Show full scope alongside the short title in review. |
| Permit type | Existing type buttons | Retain explicit single choice next to scope | Never infer type from description. |
| Plant/location | Two existing dropdowns | Choose a location labelled `Plant / Location`; derive its actual plant ID | Offer explicit plant filter for large catalogues; if relationships are missing, require a choice. |
| Department | Existing dropdown | Filter to selected plant; select explicitly when multiple remain; show one eligible department as a visible default | Location and department are sibling records; do not invent a location→department relationship. Benchmark assumes multiple choices. |
| Schedule | Existing date/time controls and presets | Put existing presets beside the work context; show concrete dates and organisation timezone | No automatic authorization window or hidden date rollover. Custom scheduling remains available. |
| Primary executor | Existing native select | Searchable authorized people picker with department and role labels; recent compatible selections appear first | No default assignment to another person. No extra search query needed when the desired person is visible. |
| Workstation/machinery | Existing selectors | Filter by chosen location/workstation; show the full path and retain a still-compatible selection | Changing parent visibly clears incompatible children and invalidates dependent safety selections. |
| Hazards/PPE | Existing catalogue selectors, optional hazard description, quantity default 1 | Searchable catalogue choices; prior permit selections appear as labelled candidates when copying; individual accept/remove; expose quantity and optional notes after selection | Candidates are not verified controls. No description-based generation or copied safety answers. Keep quantity 1 as the existing editable default, not proof of adequacy. |
| LOTOTO plan / gas parameters | Existing configured selections and requirement switches | Show applicable configured choices in equipment/workstation context; derive catalogue names, units and configured limits | Requirement decisions, readings and verifications stay explicit; never default “safe” or invent measurements. |
| Viewers / extra crew / safety officers | Existing add-row person selectors | Collapsed optional participants area; select existing people once | Reveal required role gaps immediately. Never hide mandatory fields as optional. |
| Form factual fields | Existing template `prefill` mapping | Preserve mappings for department, place, equipment, scope, dates and crew; show source and stale-value notice if context changes | Fill blanks only; do not overwrite edited answers. Do not fill unrelated unconfigured fields. |
| Check questions | Yes/No/N/A plus section-level All yes | Individual answers or explicit confirmation of the displayed unanswered checks in one section | No hidden-section answers, overwritten No/N/A, signatures or readings in a batch. See concurrency-review.md. |
| Signature | Existing “Me, now” plus editable fields | Keep explicit actor action and visible signed identity/time | No background signing or impersonation; confirmation belongs to the authenticated actor. |
| Attachments | File picker | Keep optional action beside related evidence; reuse permit ID | Upload success and draft save are distinct; failures remain visible. |

For a fresh routine issuer handoff, the planned typed-field reduction is **2→1**. Custom titles, unusual schedules, comments and template-specific questions may require additional entry; they are counted separately, not hidden in the benchmark.

## Site hierarchy — S3

| Field | Today | Revised behavior |
|---|---|---|
| Plant, department, location, workstation names | Four necessary typed names | Still four names. The system cannot know the organisation's new names. |
| Codes | Already suggested from name on blur | Retain existing generator and make the suggestion visible; override when needed. Do not claim new typing savings here. |
| Department's plant / location's plant | Repeated dropdown selection | Carry the selected/just-created plant into both child forms; display its name beside the form. |
| Workstation's location | Dropdown selection | Carry the selected/just-created location. |
| Descriptions | Optional textareas always shown | “Add description” disclosure; retain required business data and saved values. |
| Equipment code/name | Typed name and generated/edited code | Retain generator; flag a matching normalized code in loaded tenant data before save; show server collision errors inline. |

Department and location are parallel children of plant. The setup sketch must not imply a false department→location hierarchy. Add child actions retain context; they do not create missing records automatically.

## People — S3

| Field | Today | Revised behavior |
|---|---|---|
| New person's name/email | Both required text inputs | Still required. Use email input/autofill semantics and retain input on failure. |
| Existing authorised account | Workforce create already reuses Keycloak login by email, but asks for name again | Offer “Use existing account” lookup; select an authorized tenant account, prefill its name/email visibly, and use existing provisioning semantics. No fuzzy identity join. |
| Department | Existing dropdown | Carry explicit directory/site filter context; otherwise choose once. |
| Phone | Optional phone entry; existing country-code default | Keep optional; disclose under contact details without losing an existing number. Do not infer a country solely from location/IP. |
| Employee/contractor/agency | Different record types and entry pages | Add-person panel exposes employee/contractor choice; selected list determines the initial type. Agencies remain a separate organisation/contact record. |
| Login and roles | Backend creates/reuses login; roles have separate administration | Show actual provisioning result and contextual role/capability links. Do not silently grant broader roles. |
| Possible duplicates | Save-time errors and list search | Check normalized email against authorized loaded records; link to the exact match. Same normalized name + department is a warning only. Recheck server-side on save; do not auto-merge or reveal other tenants. |

New-person benchmark remains **2→2** typed fields. Existing-account reuse has a separate target of zero retyped identity fields after account selection; it must not be used to inflate savings for a genuinely new person.

## Native — S6

Replace investigator and corrective-action owner UUID inputs with authorized person selection; show location names instead of raw IDs. Preserve custom numeric readings and explicit safety choices. Carry record/date context from the current task, expose cached-data age, and label queued writes **Pending server confirmation**. Native form responses must match web before claiming parity.
