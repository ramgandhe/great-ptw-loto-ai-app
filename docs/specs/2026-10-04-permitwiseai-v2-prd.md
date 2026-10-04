# PermitWiseAI v2: Product Requirements Document

| | |
|---|---|
| Version | 0.5 (approved) |
| Date | 2026-10-04 |
| Status | v0.4 approved by the owner on 2026-10-04 (D30). v0.5 amends it to separate the sign-in identity from optional contact details (D31), as both Phase 1a plan reviewers recommended (R3-SPEC-01). The owner approved v0.5 on 2026-10-04. History: three-reviewer review (45 findings applied); follow-up review (9 findings, 9 corrections and 31 amendments applied by vote); v0.3 review (3 findings, 3 corrections applied by vote) |
| Owner | Ram Gandhe |
| Sources | `PermitWiseAI.cloud-Notes2.odt` (the new thought process); `docs/specs/merged_prd.md` (v1 PRD); decisions D1–D24 (Appendix C); review log (Appendix D) |
| Replaces | `docs/specs/merged_prd.md` for everything this document covers. Where a v1 requirement is carried over, it is restated here with its v1 ID in brackets. |

---

## 1. Introduction

### 1.1 Purpose
This document defines PermitWiseAI v2: the Permit-to-Work (PTW) platform rebuilt around how real enterprises are organised. An organisation runs several legal entities, often across countries; each legal entity runs plants; people from several legal entities and from outside agencies work together in those plants; and each legal entity runs its own version of the permit workflow.

It states what the product must do, how far that departs from v1, and the order in which it is delivered.

### 1.2 Scope
**In scope (v2):**
- Organisations as tenants at their own address, with legal entities, departments, plants and places.
- People, their employers, their plants and their roles; agencies as their own tenants linked to clients.
- Roles that each legal entity can rename, change and add to, within fixed safety limits.
- Standard lists (hazards, permit types, PPE, gas-test values, safety checklists) from an industry library, inherited and reviewed.
- A visual workflow designer and the engine that runs permits through the designed workflow, with rule checks that stop an unsound workflow from going live.
- The permit lifecycle, including stop work, making safe, handover, and crews checking in daily.
- LOTOTO, SIMOPS, gas testing, multi-day permits, incidents and notifications, carried over and re-scoped.
- Personal and health data with a lawful basis, consent where needed, encryption, limited access and retention.
- Reporting, billing per plant, audit, web and mobile.

**Out of scope (v2):** see §20.

### 1.3 Audience
Product owner, designers, engineers, testers, and the reviewers of this document.

### 1.4 Assumptions and constraints
- Cloud-hosted SaaS; many tenants share one database, separated by isolation enforced in the database (§16).
- The v2 model is built fresh in the existing codebase. There is no data to migrate; the database is reset and demo data re-seeded (D4).
- The design system stays: design tokens, the four themes, density and strict styles, components and writing guidelines (§17).
- English only in v2, with every interface string in translation files (D13). The single exception is privacy notice and consent text, which may be translated (FR-PRV-001).
- No language model is used anywhere in v2 (D5).

### 1.5 Glossary
| Term | Meaning |
|---|---|
| Organisation | The customer tenant: a company or group, at `permitwiseai.cloud/<slug>`. |
| Agency | An outside firm, itself a tenant, that supplies crews to client organisations. |
| Legal entity | A company within an organisation or agency, with its own legal name and tax ID. Runs departments and, in an organisation, plants. May have a parent legal entity for reporting. |
| Plant | A physical site owned by one legal entity: address, type, time zone, status (Setting up, Live, Retired). |
| Live plant | A plant where permits can be raised (FR-PLC-006). |
| Place | Location, workstation or machine inside a plant. |
| Account | The platform sign-in identity, one per human (Keycloak). |
| Person | An account's record in one employing tenant, with one employer. One account may have person records in several tenants. |
| Crew-only person | A person record with no account (no sign-in identity, no sign-in) who can be put on crews and checked in. |
| Sign-in identity | The verified email address an account uses for one tenant. Every person record with an account has one. It is identity data that never relies on consent, and it is kept apart from optional contact details (FR-PPL-005). |
| Engagement | The link between a client organisation and an agency: plants, dates and work types the agency may work on. |
| Standard | The organisation's own version of the lists, SIMOPS rules and workflow, started from the platform library. |
| Workflow version | One saved, checked version of a legal entity's workflow. Each permit runs on exactly one. |
| Step | One unit of a workflow (for example "Approval"), of a fixed step type, with up to three ordered parts (Execution has none). |
| Rule check | A fixed, explainable check that a configuration is sound. A failing check blocks go-live. |
| Flag | A warning on the record, an item in the named people's work queues until someone with the right permission marks it reviewed with a comment, and a count on the legal-entity dashboard. |
| Making safe | Getting every crew member out and checked out and every isolation hold released, restored or transferred before a permit can end (FR-PTW-011). |
| Open close-out | A permit that has reached Isolation or Issue and whose making safe is not finished: status Issued, Active, Suspended, Expired, Execution completed or Pending closure, or any status while a make-safe task is open or the permit holds an isolation point. |
| Hold | A permit's reliance on an isolation point (FR-LTO-103). |
| Coordinator, Receiver, Approver, Safety officer, Executor | The permit roles (§5.2), shown in the interface by sentence-case names. |

---

## 2. Product overview

### 2.1 Business context
Organisations exist to deliver products or services. They break their purpose into goals, and run operations through business processes, which vary by country, law, size and site. Legal entities give the organisation a legal and governance structure; each has departments and owns plants. In a plant, people from several legal entities, departments and outside agencies work together.

Permit-to-work is one workflow inside each plant's wider business process: a fixed pattern of who tells whom, what is checked, in what order, who approves, and how fast. PermitWiseAI digitises that one workflow. The wider business processes stay in the customer's other systems (D15).

The same person can hold one role in the permit workflow and quite different roles elsewhere. They may also answer to someone other than their line manager while acting in a permit role.

### 2.2 Objectives
1. Model the customer as it is: organisation → legal entities → departments and plants, with people and agencies across them.
2. Let each legal entity run its own permit workflow, started from a sound default, without software changes.
3. Never let an unsound configuration go live: every role or workflow change passes the rule checks first, and fixed safety rules cannot be configured away.
4. Bring agencies onto the platform as participants, with one up-to-date record per worker.
5. Make site attendance, competence and making safe part of the permit: no unchecked, unbriefed or uncertified person on the work, and no permit ends with people or isolations left behind.
6. Protect personal and health data by design.
7. Give each level (plant, legal entity, parent, organisation) the reports it needs.
8. Keep v1's user experience: the same look, components and step-by-step permit wizard.

### 2.3 Design principles
Carried over from v1: **safety first**, **configurability**, **accountability**, **traceability**, **modularity**, **operational visibility**. Added in v2:
- **Checked before live.** Configuration is data, and data is checked. Nothing reaches a permit until the rule checks pass.
- **Fixed safety floor.** Some rules are never configurable: safety steps before Issue, stop work, making safe, segregation of duties, and admins never acting on permits.
- **Inherit, then review.** Changes from above (platform → organisation → legal entity) arrive as reviewable updates, never silently.
- **Least visibility.** People see what their role and place need: an agency sees only its assigned permits, a client sees only the permitted fields of agency staff, a platform admin sees no permit content.
- **Same experience.** New screens are built from the existing design system.

---

## 3. Structure and tenancy

### 3.1 Model
```text
Platform
└─ Organisation (tenant, /<slug>)                  Agency (tenant, /<slug>)
   ├─ Legal entity (optional reporting parent)      ├─ Legal entity
   │  ├─ Department                                 │  ├─ Department
   │  └─ Plant (time zone, status)                  │  └─ Staff (person records)
   │     └─ Location → Workstation → Machine        └─ Engagements with client organisations
   │                                  (+ LOTOTO procedures)
   └─ People (person records; employer: a legal entity of this organisation)
Accounts (one per human) hold person records in one or more tenants.
```

### 3.2 Requirements
**Organisation**
- **FR-ORG-001** An organisation is a tenant reachable at `permitwiseai.cloud/<slug>`. The slug is unique, lowercase, 3–40 characters (letters, digits, hyphens), and cannot be changed by the customer after creation.
- **FR-ORG-002** An organisation records its name, industry, logo, theme, billing details, default email server (optional), standard lists (§7), standard SIMOPS rules (§11.2) and standard workflow (§8).
- **FR-ORG-003** An organisation has one or more legal entities.

**Legal entity**
- **FR-LE-001** A legal entity records its legal name, short code (used in numbering), tax ID, country and registered address.
- **FR-LE-002** A legal entity may name one parent legal entity in the same organisation. The parent link is used for reporting roll-up only (§13); it never passes configuration (D11). Cycles are refused.
- **FR-LE-003** A legal entity holds its own: email server (optional), numbering patterns (§6.4), theme and logo, copies of the standard lists (§7), workflow (§8), SIMOPS rules (§11.2), and module switches for LOTOTO, SIMOPS and incidents.
- **FR-LE-004** Email is sent through the legal entity's server if set, otherwise the organisation's, otherwise the platform's (NFR-SEC-011 applies to customer servers).

**Departments, plants and places**
- **FR-PLC-001** A department belongs to one legal entity.
- **FR-PLC-002** A plant belongs to one legal entity and records its name, code, type, address, time zone, and an optional location point with a radius used for check-in (§10.3).
- **FR-PLC-003** A plant contains locations; a location contains workstations; a workstation contains machines. Each has a name and a code unique within its parent.
- **FR-PLC-004** Each machine may have LOTOTO procedures (§11.1).
- **FR-PLC-005** Records in use are retired, not deleted: a retired record stays on past permits and is not offered for new ones.
- **FR-PLC-006** A plant has a status: Setting up, Live or Retired. Permits can be raised only at Live plants. A plant goes from Setting up to Live only when rule check 3 (§9.1) passes for that plant. Adding a plant never changes the active workflow version or any other plant.

**People and accounts**
- **FR-PPL-001** A person record has exactly one employer: a legal entity of its organisation (as employee or contractor) or an agency. Only that employer's admins manage it.
- **FR-PPL-002** A person can be assigned to plants of any legal entity in the same organisation. Each assignment gives one or more roles, optionally limited to a department.
- **FR-PPL-003** A person record holds: name, photo, designation, sign-in identity (people with an account), optional contact details (for example phone), emergency contacts, blood group, health conditions, identity document (type, number, photo), hire details, employment history, reporting manager (information only, D6), skills, training records, site inductions, and certificates with expiry dates. Sensitive fields follow §12; blood group and health conditions need consent (FR-PRV-002).
- **FR-PPL-004** An account may hold person records in several tenants (for example a client's employee who is also an agency's staff). Leaving one employer ends that person record, not the account or its other person records.
- **FR-PPL-005** A person record with no account is a crew-only person: no sign-in identity and no sign-in. They can be put on crews, briefed and checked in by the receiver, and the receiver records their progress. A person record linked to an account always keeps its sign-in identity. Deleting optional contact details (FR-PRV-002) never removes the sign-in identity, never unlinks the account, and never changes the person's tenant access, roles or permit duties (D31).

---

## 4. Agencies

- **FR-AGY-001** An agency is its own tenant with legal entities, departments and staff (D1). It has no trial and no subscription (D8).
- **FR-AGY-002** The agency keeps its staff records, including identity, competencies, certificates and insurance. These records are the single source of truth for that worker across every client.
- **FR-AGY-003** A legal-entity admin of a client invites an agency to an **engagement**. The admin first searches agencies already on the platform (the search shows name and city only); picking one sends the invitation to that agency's admins. An invitation typed to an email address whose domain the agency has verified goes to that agency's admins and creates no new tenant; public mail domains (for example gmail.com) never match. An agency not on the platform is invited to join (§6.1).
- **FR-AGY-004** An engagement records: client organisation, client legal entity, agency, the plants covered, start and end dates, the types of work allowed, and the agency's staff nominated as receivers (supervisors). The agency accepts or declines. The agency admin nominates receivers when accepting and can change the list at any time; a change applies to permits not yet received. Both sides are notified 14 days and 1 day before the end date, and the client can extend it.
- **FR-AGY-005** Agency users always work from their own agency tenant (D16 isolation, NFR-SEC-002). Their work queue lists items from every active engagement in one list, each labelled with the client organisation and plant. The permit screen shows the client's name and logo. Agency users see only the client permits assigned to them (as nominated receiver or crew member), and the client plant and place names those permits reference.
- **FR-AGY-006** While an engagement is active, the client sees, for agency staff on its permits: name, photo, role on the permit, competencies and certificates relevant to the permit's work type, insurance validity, and the emergency subset under FR-PRV-006. The client reads these only through the column-limited path in NFR-SEC-002(b) and never sees the rest of the agency's staff records. After the engagement ends, the photo and emergency subset of agency staff on a permit stay available under the conditions in FR-PRV-006 (open close-out, or the post-incident window), through the same path.
- **FR-AGY-007** Agency staff can hold only the Receiver and Executor roles on a client's permits: Receiver by being nominated on the engagement, Executor by being added to a permit's crew. They need no plant assignment in the client organisation. Roles holdable by agency staff are limited by rule check §9.2-3.
- **FR-AGY-008** Ending an engagement:
  - When it ends (end date reached, or ended by the client), no new permits can be assigned to the agency. Its permits not yet issued return to Raise for a new crew lead, even if they hold isolation points: their holds stay with the permit and are re-verified in its Isolation step for the new crew lead (FR-WFE-006), or released or restored under FR-PTW-011 if the permit is cancelled.
  - On its permits that have reached Issue and have open close-out, no new check-ins are allowed. The agency's receiver and checked-in crew keep access to those permits only, for check-out, completion, isolation restoration and incident reporting (wind-down), until each permit is closed or the receiver duty is handed to an internal receiver (FR-PTW-013). The coordinator and safety officer are alerted until no such permit remains.
  - The client may instead choose **End now** (for example for misconduct or a compromised agency account): agency access ends at once and those permits are suspended. The coordinator assigns the receiver duty to an eligible internal receiver at the plant (one who holds the Receiver role there and is not barred by FR-ROL-005 or FR-ROL-009), under FR-PTW-013 with no acceptance by the outgoing agency receiver. Until one accepts, the receiver part of the make-safe task is offered to every internal Receiver holder at the plant as a pooled item (FR-WFE-002) and, after the Issue step's target, is flagged to the legal-entity admins, who can give the Receiver role to an internal person (FR-ROL-008).
  - The internal receiver completes the receiver part of making safe (FR-PTW-011): they record each agency crew member's whereabouts, check-out and lock-off as witness, as for crew-only people (FR-CRW-012); a lock whose owner is not present is removed only under FR-LTO-104. Restoration verification and closure acceptance stay with their own roles.
  - Actions the agency's devices queued for those permits are refused at sync and kept, unapplied, in a "Received after access ended" list on the permit (through NFR-SEC-002 d) for the coordinator and safety officer to review; none is applied automatically.
  - Records of work already done stay with the permits (FR-AGY-009).
- **FR-AGY-009** When an agency worker is named on a client permit, crew list, check-in, substitute or incident, the client tenant keeps a snapshot: name, agency name, role on the permit, the certificate and insurance IDs and validity dates that were checked, and check-in times. The snapshot belongs to the client legal entity, is kept for that entity's safety-record period (FR-PRV-009) and stays visible after the engagement ends. It never includes the emergency subset, identity documents or contact details.
- **FR-AGY-010** The agency tenant keeps its own attendance record for each worker: date, client organisation, plant name, permit number, check-in and check-out times. Agency reports (FR-RPT-006) use this record and need no access to client permits after the engagement ends. It also enforces one check-in at a time across clients (FR-CRW-007) without either client seeing the other's permit.

---

## 5. Roles and permissions

### 5.1 Admin roles
| Role | Scope |
|---|---|
| Platform admin | Verifies access requests and records the evidence; creates organisation and agency tenants; maintains the industry libraries, the platform default workflow and the plans. Sees tenant names, status, plans and usage only (§13.3). |
| TENANT_ORG_ADMIN (organisation admin) | The organisation: details, legal entities and their admins, billing, organisation email server, standard lists, standard SIMOPS rules and standard workflow; all reports and usage down to plant. |
| LEGAL_ORG_ADMIN (legal-entity admin) | One legal entity: departments, plants and places, lists, workflow, SIMOPS rules, numbering, theme, email server, people, agency engagements, role assignments; reports and usage for the entity and its child entities. |

Agencies use the same two admin roles inside their own tenant, for their own setup and staff. Admin roles are fixed: they are not shown in the role editor and carry no permit permissions (FR-ROL-007).

### 5.2 Permit roles (default set)
Held per plant, optionally per department (D2). Internal keys (for example `PTW_PERMIT_COORDINATOR`) never appear on screen; the interface shows sentence-case names ("Permit coordinator").

| Role | Was (v1) | Duties | Default permissions |
|---|---|---|---|
| Permit coordinator | Job issuer | Raises the permit: work, place, time, type; chooses an internal crew lead or an agency. Issues the permit after approval. Accepts substitutes, the day's progress and the closure. | raise permit, edit permit, fill check sheets, issue permit, accept substitute, accept day's progress, request extension, cancel permit (before Issue), acknowledge Low SIMOPS conflict, accept closure, hand over permit duty, report incident, view reports |
| Permit receiver | Job executor (site details); supervisor | Crew side: an internal crew lead or an agency supervisor. Accepts the permit for the crew, adds site details, names and briefs the crew, checks crew in and out, performs isolation, reports completion. | accept permit, add site details, manage crew, check crew in/out, fill check sheets, perform isolation, record progress, revalidate day, report completion, restore isolation, hand over permit duty, report incident |
| Permit approver | HOD | Approves, defers, sends back or rejects; decides continue or stop after a near miss. | approve, defer, send back, reject, resume, approve extension, renew permit, cancel permit, decide near miss, review SIMOPS conflict, report incident, view reports |
| Safety officer | Safety officer | Safety checks, gas tests, isolation and restoration verification, SIMOPS conflict review, incidents. | safety check, record gas test, verify isolation, verify restoration, revalidate day, resume, cancel permit, review SIMOPS conflict, investigate incident, close incident, report incident, view reports |
| Permit executor | Job executor (crew) | Works under the receiver; records progress and evidence. | record progress, report incident |

Per-permit **viewers** stay a list on each permit, not a role. Stop work is not a permission (FR-PTW-009).

### 5.3 Permissions and the role editor
- **FR-ROL-001** A role is a named set of permissions from this fixed list: raise permit; edit permit; accept permit; add site details; manage crew; check crew in/out; accept substitute; fill check sheets; safety check; record gas test; perform isolation; verify isolation; restore isolation; verify restoration; approve; defer; send back; reject; issue permit; record progress; accept day's progress; resume; revalidate day; request extension; approve extension; renew permit; cancel permit; report completion; accept closure; hand over permit duty; report incident; decide near miss; investigate incident; close incident; review SIMOPS conflict; acknowledge Low SIMOPS conflict; view reports.
- **FR-ROL-002** A legal-entity admin can rename a permit role, change its permissions, create a new role, or retire a role. The five default roles (§5.2) are created for each new legal entity. Each default role has a fixed key that survives renaming; organisation and platform workflows name roles only by these keys, and on receipt each key maps to the legal entity's role with that key. Retiring a role ends its assignments; the affected people are listed before the admin confirms.
- **FR-ROL-003** The permit form asks for named people only for the crew lead (an internal Receiver, or an agency), crew members (Executor) and substitutes. Each picker lists only people holding that role at the permit's plant (and department, if scoped) whose required certificates are valid that day (FR-ROL-009), or, for an agency, its nominated receivers and staff. Every other step goes to the pool of role holders under FR-WFE-002. Renamed and new roles appear automatically in pickers and pools.
- **FR-ROL-004** Role changes are saved as a draft and go live only when the role rule checks pass (§9.2).
- **FR-ROL-005** Segregation of duties, always enforced while a permit runs and compared by account, not by person record. On one permit, the same account cannot:
  - (a) raise and approve;
  - (b) approve and issue;
  - (c) act as coordinator (raise, issue, accept substitute, accept closure) and as receiver (accept permit, check crew in or out, report completion);
  - (d) perform the safety check and approve;
  - (e) perform and verify the same isolation point, restore and verify the restoration of the same point, or request the release of a hold and confirm the same release (FR-LTO-102, FR-LTO-103).

  An action taken on someone's behalf (FR-ROL-006) counts for both people. A step offered only to barred people escalates at once to its level 1 target, without waiting for the target time.
- **FR-ROL-006** [v1 FR-PTW-023] An approver may name a delegate holding the same permission at the same plant for a date range. Actions show as "approved by X on behalf of Y" and the delegation is audited.
- **FR-ROL-007** [v1 FR-ROL-003] Admin roles carry no permit permissions. An admin who receives an escalation or a blocked-permit flag can reassign the step (FR-WFE-010) or change role assignments, but never act on it. An admin can act on a permit step only through a permit role they hold at that plant. The API enforces this on every permit action.
- **FR-ROL-008** An admin cannot change their own plant role assignments. Another legal-entity admin of the same legal entity, or an organisation admin, makes the change.
- **FR-ROL-009** A role can list required certificates or competencies (for example "authorised gas tester" for a role that holds "record gas test"). Pickers and step offers include only holders whose required certificates are valid that day, and an action by a holder whose certificate has expired is refused.

### 5.4 Step needs
Each step part needs these permissions. Rule check 11 (§9.1) compares them with the role set for the part.

| Step | Part 1 needs | Part 2 needs | Part 3 needs |
|---|---|---|---|
| Raise | raise permit | — | — |
| Receive | accept permit, add site details, manage crew | — | — |
| Check sheets | fill check sheets (coordinator part) | fill check sheets (receiver part) | — |
| Safety check | safety check | — | — |
| Gas test | record gas test | — | — |
| Isolation | perform isolation | verify isolation | — |
| Approval | approve, send back, reject (defer offered only if held) | — | — |
| Issue | issue permit | check crew in/out | — |
| Execution | — (no parts: record progress, resume and other actions are checked per action) | — | — |
| Daily revalidation | revalidate day | safety check | — |
| Closure | report completion, restore isolation (also needed to request a hold's release) | verify restoration, verify isolation (applies whenever the permit held an isolation point) | accept closure |

---

## 6. Onboarding and setup

### 6.1 Access request and tenant creation
- **FR-ONB-001** Anyone may request access from the public site, giving: organisation or agency name, tenant type (organisation or agency), industry, their name, role and work email, country.
- **FR-ONB-002** The platform admin verifies the requester's authority (for example company domain, documents, a call) and records the method and evidence before approving or declining.
- **FR-ONB-003** On approval of an organisation: the tenant is created at its slug with the industry library (§7) and the platform default workflow (§8.5) as its standards; a 30-day trial starts; the requester is invited as organisation admin.
- **FR-ONB-004** On approval of an agency, or when an agency accepts a client's engagement invitation: the agency tenant is created and the requester is invited as its organisation admin. No trial or billing applies.

### 6.2 Setup checklists
- **FR-ONB-005** The organisation admin sees a setup checklist with progress: company details, logo and theme; email server (optional); review standard lists, SIMOPS rules and workflow; plan and billing (may wait until trial end); legal entities and their admins. The first legal entity is offered pre-filled from the organisation's details.
- **FR-ONB-006** The legal-entity admin sees a setup checklist: departments; plants, places, machines and LOTOTO procedures; review lists, workflow and SIMOPS rules; numbering; theme, logo, email server; lawful basis and consent wording (FR-PRV-001); people, plant assignments and roles, then invitations; agency engagements.
- **FR-ONB-007** A legal entity cannot raise permits until its go-live checks pass: at least one Live plant; an active workflow version; rule check 3 passing for every Live plant.
- **FR-ONB-008** The agency admin's checklist: company details, legal entity, departments, lawful basis and consent wording, staff with identity, certificates and insurance, then pending engagement invitations.

### 6.3 People and invitations
- **FR-ONB-009** People are created by their employer's admin, one at a time or by spreadsheet import with a row-level error report. The import never accepts fields that need consent (FR-PRV-002).
- **FR-ONB-010** A person given a sign-in email address receives an invitation; a person without one is a crew-only person (FR-PPL-005). On first sign-in the person reads the privacy notice and gives or withholds the consents their employer asks for (FR-PRV-001, 002).
- **FR-ONB-017** Removing a role assignment, a person or an engagement is never refused. If it leaves a role used by the active workflow with no holder at a Live plant, the admin is first warned ("This is the last Permit approver at Pune. New permits at Pune will be blocked until you assign another."). After the change, the plant shows "Not ready: no <role>", new permits there are refused with that reason, open steps that need the role escalate at once, and the legal-entity admin gets a work-queue item until it is fixed.
- **FR-ONB-019** An invitation is a single-use link that expires after 7 days; admins can resend an expired invitation. Accepting it links the person record to the account signed in when the link is opened, once that account has verified the invited email address. Matching an email address at sign-in never grants membership.

### 6.4 Numbering
- **FR-ONB-011** Each legal entity sets a numbering pattern for permits, LOTOTO, incidents and SIMOPS conflicts from tokens: `{LE}` legal-entity code, `{PLANT}` plant code, `{TYPE}` permit-type code, `{YYYY}`/`{YY}` year, `{SEQ:n}` sequence padded to n digits; plus fixed text. Example: `{LE}-{PLANT}-{TYPE}-{YYYY}-{SEQ:5}` → `ACM-PUN-HW-2026-00042`.
- **FR-ONB-012** The sequence resets yearly or never (admin's choice). Numbers are unique within the legal entity and are never reused.

### 6.5 Trial, read-only and suspension
- **FR-ONB-013** If the trial ends without a plan:
  - The organisation becomes read-only for 30 days. No permit can be raised or issued, and permits not yet issued can only be cancelled.
  - On permits with open close-out, every action needed to finish safely keeps working: stop work, check-in and check-out, daily revalidation, handover, progress, resume, isolation and restoration, gas tests, incidents and closure.
  - Every user sees a banner naming the read-only state and the date of the next change; admins also see "Choose a plan".
  - The organisation is not suspended while any permit has open close-out or any isolation is applied; read-only continues until those are closed, and admins are shown which permits are holding it.
  - Once suspended, only admins can sign in, to choose a plan or to export. During read-only and suspension, admins can export all permit, LOTOTO, SIMOPS, incident, audit and access-log records at any time.
  - Data is deleted 90 days after suspension, after a final export has been offered; from then on the organisation, as controller, keeps its safety records. This deletion is the only exception to FR-AUD-003 and FR-PRV-009.
  - Admins are emailed 7 days and 1 day before each change.

### 6.6 Sign-in, tenants and home
- **FR-ONB-014** `permitwiseai.cloud/<slug>` shows the organisation's branded sign-in (logo, name, theme), served by the identity provider (§18). There is no public content page.
- **FR-ONB-015** After sign-in, a person lands on their work queue (§13.1), shown with their own legal entity's logo and theme. A person whose employer is an agency sees the agency's.
- **FR-ONB-016** An account that holds person records in more than one tenant (FR-PPL-004) picks a tenant after sign-in and can switch without signing in again. The switcher shows each tenant's count of waiting work-queue items. Links in emails and notifications carry their tenant and open in it, switching if needed. Agency staff never switch into a client tenant; they see client permits from their agency tenant (FR-AGY-005). Signing in at the slug of a tenant the account has no person record in shows "You don't have access to <name>" and the account's own tenants; no data of that tenant is shown.
- **FR-ONB-018** The mobile app signs in by email, without a slug. An account with several tenants picks one after sign-in, and the device remembers the last choice. Each queued offline action keeps the tenant and account it was made in and syncs to that tenant, over a session for that tenant (NFR-SEC-006), whichever tenant is displayed; the server refuses one whose account or tenant does not match the session. Signing out with unsynced actions shows a warning that lists them, and they wait on the device for that account's next sign-in. An unsent stop work, check-out or lock-off for another tenant shows a persistent banner naming that tenant until it is sent; if that tenant's session cannot be refreshed, the banner asks the person to sign in to send it.
- **FR-ONB-020** The sign-in page at a slug does not reveal whether an email has an account or belongs to that organisation.

---

## 7. Standard lists and the industry library

- **FR-LST-001** The platform keeps a library of standard lists per industry: hazards (with risk level), permit types (with colour, code and risk level), PPE, gas-test parameters (with limits and validity period, FR-GAS-001), safety checklists, and check-sheet templates. Risk levels are Low, Medium or High. Each permit type and each hazard can set "isolation required" and "gas test required" (with the parameters to test); these are minimums for any permit that uses them.
- **FR-LST-002** A new organisation's standard lists start as a copy of its industry's library. The organisation admin can add, edit and retire items.
- **FR-LST-003** A new legal entity's lists start as a copy of the organisation standard. The legal-entity admin can add, edit and retire items.
- **FR-LST-004** Every copied list item and SIMOPS rule remembers its source item and version. When the source changes (platform library → organisation, or organisation standard → legal entity), the receiving admin sees "updates available". Nothing changes without that admin's choice (D9).
  - Differences are labelled Added, Changed or Retired at source. The admin can accept or decline each one, or everything shown under a filter (list, kind of change).
  - For a Changed item the admin has edited, the view shows the earlier source version, the admin's version and the new source version; accepting replaces the admin's version.
  - A permit type added by an update arrives retired; making it active runs the workflow checks and is refused while they fail.
  - Accepting a change to a permit type's or hazard's risk level, or to its isolation or gas minimums, runs the workflow checks against the active version and is refused while they would fail. A refused safety increase stays in "updates available" marked "Needs workflow change" and stays in the legal-entity admin's work queue until it is applied. A safety increase is never dropped silently.
- **FR-LST-005** A declined update is not offered again unless the source changes again.
- **FR-LST-006** Items in use are retired, never deleted (FR-PLC-005).

---

## 8. Workflow designer and engine

### 8.1 Levels
- **FR-WFD-001** Workflows exist at three levels (D3): the platform default; the organisation standard (started from the platform default, kept by the organisation admin); the legal-entity workflow (started from the organisation standard, kept by the legal-entity admin). Updates flow down as reviewable updates, as for lists (FR-LST-004). Accepting workflow updates never changes the active version: the accepted differences go into a new draft, which then passes through FR-WFD-014 to 016. At organisation and platform level, rule check 3 is skipped and rule check 11 runs against the default permissions (§5.2). A new legal entity's first workflow version is a copy of the organisation standard and is active from creation, without a dry run, because it has already passed every rule check except check 3 at organisation level; this is the only exception to FR-WFD-016 and FR-CHK-002. Its plants still go Live only through rule check 3 (FR-PLC-006).
- **FR-WFD-002** Within a legal entity, a step can apply to all permit types or only to chosen ones, and can be conditional on permit facts (§8.3). There are no plant-level workflows; "plant level" means a workflow runs in a plant. A permit follows the workflow of the legal entity that owns its plant.

### 8.2 Step types
- **FR-WFD-003** A workflow is built only from these step types. The platform knows how to run each one. Step types with more than one part (at most three) have a role for each part; parts run in the order listed, except the two Check sheets parts, which can be filled in either order; the step is done when every part that applies is done. Execution has no parts: actions inside it are checked per action against permissions (FR-CRW-005, FR-PTW-009). Needs per part are in §5.4.

| Step type | What happens | Default roles |
|---|---|---|
| Raise | Work, place, department, time, type, crew lead or agency | Coordinator |
| Receive | Accept the permit, add site details and crew | Receiver |
| Check sheets | Fill the check sheets that apply | Coordinator part, Receiver part |
| Safety check | Review hazards and controls on site | Safety officer |
| Gas test | Record readings against limits | Safety officer |
| Isolation | Perform and verify LOTOTO | Receiver performs, Safety officer verifies |
| Approval | Approve, defer, send back or reject | Approver |
| Issue | Issue to the receiver; crew briefing and check-in | Coordinator issues, Receiver checks in |
| Execution | Progress, evidence, resume after stop work | No parts: checked-in crew record progress; holders of "resume" resume after stop work |
| Daily revalidation | Multi-day, from the second date: daily checks before that date's check-in | Receiver part (revalidate day), then Safety officer part (safety check); check-in follows under FR-CRW-006 |
| Closure | Completion, restoration or release of holds, area inspection, closure | Part 1 Receiver reports completion and restores (or requests release of) each hold; part 2 Safety officer verifies the restoration or confirms the release (whenever the permit held an isolation point); part 3 Coordinator inspects the area and accepts closure |

### 8.3 What a legal entity can change
- **FR-WFD-004** Order of steps, within the fixed safety order (FR-WFE-001).
- **FR-WFD-005** Add or remove optional steps (everything except Raise, Receive, Approval, Issue, Execution, Closure), within rule check 9.
- **FR-WFD-006** Run steps in parallel. [v1 FR-PTW-016] A parallel group made only of Approval steps needs all of its steps, or the first response, as configured. A group that contains any other step type always needs all of its steps. [v1 FR-PTW-028] Any rejection in a group rejects the group.
- **FR-WFD-007** For each step (or each part of a two-part step): the role, and whether it is limited to the permit's department (D6).
- **FR-WFD-008** Conditions per step: permit types; [v1 FR-PTW-015, FR-PTW-017, FR-PTW-018] risk level (the highest of the permit type's risk level and the risk levels of the hazards chosen); isolation required; gas testing required; multi-day.
- **FR-WFD-009** [v1 FR-PTW-019] Target time per step (the step's KPI), with a reminder at a set share of the target (default 75%).
- **FR-WFD-010** [v1 FR-PTW-020, FR-PTW-022] Escalation per step: up to 3 levels, each "after N hours, go to role R at the same plant, or named person P". Level 1 may name the step's own role: it then releases the step from the person who took it and offers it again to every holder at the plant. After the last level the permit is flagged to the legal-entity admins as blocked.
  - An escalation notifies its target with a time-sensitive message [v1 FR-PTW-021].
  - A target is offered the step only if they hold every permission the step needs at the permit's plant and FR-ROL-005 does not bar them; otherwise (including every admin target, FR-ROL-007) they can reassign it (FR-WFE-010).
  - When agency staff hold the step, role targets are resolved among the client's people at the plant, and every level also notifies the agency's legal-entity admins.
- **FR-WFD-011** Message templates per step and event (assigned, due soon, overdue, escalated, done, sent back, rejected, stopped), for email and in-app, using placeholders from a fixed list (for example `{permit.number}`, `{permit.title}`, `{plant.name}`, `{step.name}`, `{due.time}`, `{link}`). The only personal-data placeholders are people's names; health, emergency, contact and identity fields are never placeholders. Escalation messages are visibly marked as time-sensitive.
- **FR-WFD-012** CC lists per step and event: roles, named people, and outside email addresses. Messages to outside addresses contain only the permit number, title, plant name, step and a link, and the link requires sign-in.
- **FR-WFD-013** Module switches: LOTOTO, SIMOPS and incidents on or off for the legal entity.

### 8.4 Engine behaviour
- **FR-WFE-001** Fixed safety order, never configurable: Raise first; Receive before Approval; every Check sheets, Safety check, Gas test and Isolation step that applies to the permit completes before Issue; Approval before Issue; Issue before Execution; Daily revalidation runs only inside Execution; Closure last. [v1 FR-PTW-030] No interface, including admin tools, can move a permit except along the workflow.
- **FR-WFE-002** Each pooled step is offered to the people holding its role at the permit's plant (and department, if scoped), excluding anyone FR-ROL-005 or FR-ROL-009 bars. Everyone in the pool is notified when the step opens, and the step stays in each person's work queue until one of them takes it. Whoever takes a step can release it to the pool with a comment. An action made offline on a step someone else took first is refused on sync with "Already done by <name> at <time>".
- **FR-WFE-003** Send back returns the permit to Raise or Receive with a mandatory comment and reason code; [v1 FR-PTW-024] reason codes are a list kept per legal entity. Reject ends the permit with a mandatory comment and reason code; FR-PTW-011 applies if it had reached Isolation or Issue.
- **FR-WFE-004** [v1 FR-PTW-025] Defer keeps the permit with the same approver and stops that step's clock until the coordinator supplies what was asked.
- **FR-WFE-005** [v1 FR-PTW-026] After send back, the permit restarts from the first approval step, unless the permit type is set to resume at the step that sent it back. This applies only when no scope field changed (FR-WFE-006).
- **FR-WFE-006** [v1 FR-PTW-027, strengthened] Before Issue, editing a scope field (permit type, hazards, place, machine, PPE, isolation and gas-test needs, start and end time, the agency, or a switch between internal crew and an agency) re-evaluates step conditions (FR-WFE-011), invalidates every completed step after Receive, and restarts from the first of them. Administrative fields (for example contact numbers) and a handover between receivers (FR-PTW-013) do not. After Issue, scope fields are locked: to change scope, the permit is suspended and sent back, or a new permit is raised. Extending the end time after Issue follows the extension flow ([v1 FR-MDP-009], request extension and approve extension), not this rule.
- **FR-WFE-007** [v1 FR-PTW-029] A later gate can always refuse a permit an earlier gate approved.
- **FR-WFE-008** Timers for reminders and escalations run in the plant's time zone, survive restarts, and run per tenant under NFR-SEC-008.
- **FR-WFE-009** Every step records who acted, on whose behalf, when, the decision, the comment, and the time against target.
- **FR-WFE-010** A legal-entity admin, and any escalation target, can reassign an open step to a named person who holds its role at the plant and is not barred by FR-ROL-005 or FR-ROL-009, with a comment. Reassigning never moves the permit along the workflow (FR-WFE-001).
- **FR-WFE-011** The engine works out which conditional steps apply from the permit's current facts (type, risk level, isolation, gas test, multi-day) each time a step completes and whenever one of those facts changes before Issue. A step that newly applies goes, in the version's order, before the next step not yet started, and always before Issue for Check sheets, Safety check, Gas test and Isolation. A completed step that no longer applies stays in the record. The permit page shows everyone on the permit the remaining route: steps still to come and the role or person holding each.

### 8.5 Platform default workflow
Raise → Receive → Check sheets → Safety check (+ Gas test when required) → Isolation (when required) → Approval → Issue (briefing and check-in) → Execution (with Daily revalidation when multi-day) → Closure.

Default targets: Receive 4 h; Check sheets 4 h; Safety check 2 h; Gas test 1 h; Isolation 4 h; Approval 2 h; Issue 1 h; Closure acceptance 4 h.

Default escalation: after the target, level 1 releases the step to its own role at the plant; after twice the target, level 2 flags the permit to the legal-entity admins as blocked, who can reassign the step (FR-WFE-010).

### 8.6 Versions and testing
- **FR-WFD-014** A workflow change creates a draft version. A legal entity has at most one draft. Rule checks run on every save and show problems beside the step concerned. An admin who opens the draft sees who last saved it and when; a save is refused if the draft changed after they opened it, and they are shown the newer version.
- **FR-WFD-015** A draft with no failing checks can be **tested**: a dry run with a sample permit (type, plant, risk, isolation and gas flags chosen by the admin) shows each step in order, who would be asked, when reminders and escalations would fire, and the exact messages, without sending anything or creating a permit. Any edit to a tested draft returns it to draft.
- **FR-WFD-016** A tested version can be made **active**. One version is active per legal entity. New permits use the active version; permits already raised finish on the version they started on. A new legal entity's first version is the exception in FR-WFD-001.
- **FR-WFD-017** Rolling back means making an earlier version active again; it passes the rule checks again first.
- **FR-WFD-018** The designer is a web screen: a step list in which each step can be moved with Move up and Move down buttons or by dragging; a parallel group shown as one indented card holding its steps and its rule (all, or first response); a side panel to edit the selected step; and a read-only flow diagram drawn as SVG with the design tokens, using no diagram library.

---

## 9. Rule checks ("self-analysing")

- **FR-CHK-001** Rule checks are fixed and explainable; each failure names the check, the item at fault and a plain-language fix. No language model is involved (D5).
- **FR-CHK-002** A failing check blocks go-live (activation of a workflow version, roles going live, a plant going Live, a legal entity raising its first permit). Warnings are shown but do not block. The only exception is a new legal entity's first workflow version (FR-WFD-001).

### 9.1 Workflow checks (block)
1. Every step can be reached from Raise, and Closure can be reached from every step.
2. The fixed safety order holds (FR-WFE-001).
3. Every step part has a role, and that role is held by at least one person at every Live plant of the legal entity (for department-scoped steps, in every department offered at that plant). For Receiver, receivers nominated on an active engagement covering the plant count; for Executor, any staff of such an agency count. At every Live plant, each pair in FR-ROL-005 can be filled by two different accounts. Execution has no parts; at every Live plant at least one internal (non-agency) account holds "resume", and at least one person holds "record progress".
4. No escalation level goes only to the person who has taken the step. An escalation to the step's own role is allowed at level 1 only.
5. No step in a parallel group depends on another step in the same group.
6. Every template uses only known placeholders, and no personal-data placeholder other than names (FR-WFD-011).
7. Every active permit type ends up with a complete workflow under every combination of conditions.
8. No Isolation step while LOTOTO is switched off; no SIMOPS review while SIMOPS is switched off.
9. For every active permit type and every combination of conditions: isolation required meets an Isolation step (LOTOTO on) or a Safety check step (LOTOTO off, FR-LTO-105); gas test required meets a Gas test step; multi-day meets a Daily revalidation step; risk level High meets a Safety check step. Each of these steps comes before Issue (Daily revalidation inside Execution).
10. Target times are positive; escalation times increase level by level.
11. Every permission a step part needs (§5.4) is held by the part's role.
12. Every parallel group set to "first response" contains only Approval steps.

### 9.2 Role checks (block)
1. A role used by a workflow step cannot be retired or lose the permission the step needs.
2. Every permission used by the active workflow belongs to at least one role.
3. A role that agency staff can hold (FR-AGY-007) contains none of: approve, defer, send back, reject, issue permit, safety check, verify isolation, verify restoration, accept substitute, accept day's progress, accept closure, decide near miss, review SIMOPS conflict, cancel permit.
4. No single role holds both sides of any FR-ROL-005 pair.

### 9.3 Warnings (do not block)
- Two roles with identical permissions (possible duplicate).
- A step whose role is held by only one person at a plant (no cover for absence).
- A step that never applies to any active permit type.
- A CC list containing an outside address.
- No holder of a role at a plant has a valid required certificate (FR-ROL-009).

---

## 10. Permit lifecycle

### 10.1 Raise and receive
- **FR-PTW-001** [v1 FR-PTW-001, 002, 003] The coordinator raises a permit with the step-by-step wizard (one step per screen, Back/Next, save draft): work (type, title, scope), place and time (Live plant, location, workstation, machine, department, start and end in the plant's time zone, one-tap time windows), and the crew lead: an internal person holding the Receiver role at the plant, or an agency engaged for that plant and work type. The department defaults to the coordinator's department at that plant; only departments whose department-scoped step roles are held at the plant are offered.
- **FR-PTW-002** If an agency is chosen, every receiver the agency nominated for the engagement is notified; the first to accept becomes the permit's receiver.
- **FR-PTW-003** The receiver accepts or declines with a reason. On accepting, the receiver adds site details (workstation, machine, hazards with controls, PPE, isolation and gas-test needs) and the crew. Needs that the permit type or a chosen hazard implies are pre-set and cannot be cleared. The receiver, coordinator and safety officer can add needs. Only the safety officer can clear a need that someone added, and must give a reason.
- **FR-PTW-004** Check sheets that apply to the permit type are filled by the coordinator and receiver. Answers the permit already gives (department, location, equipment, job description, dates, crew names and count) are filled from the permit, hidden, and kept in step with it.
- **FR-PTW-005** [v1 FR-SIM-016, FR-SIM-021] SIMOPS evaluation runs when Receive completes; on every change to place, machine, isolation points, hazards, permit type or times; on extension or renewal; at the start of each day of a multi-day permit; at Issue; and nightly, per tenant, for permits not yet Active. [v1 FR-SIM-015] While a Medium or High clash involving a permit is unresolved, that permit cannot be issued. [v1 FR-SIM-017] If the other permit is already Issued or Active, the newer permit is frozen at its current step.

### 10.2 Approval and issue
- **FR-PTW-006** The permit moves through the workflow version's steps (§8).
- **FR-PTW-007** At Issue, the coordinator issues the permit to the receiver; the crew is briefed (FR-CRW-012) and checked in (FR-CRW-001). Only then can execution start. Issue is refused unless FR-GAS-002 is met and no Medium or High SIMOPS clash is open.

### 10.3 Crew check-in, briefing and substitutes
- **FR-CRW-001** Each day of work, the receiver checks each crew member in and out on the permit in the mobile app. The time is recorded; a photo is optional. If the plant has a location point, only the distance from the plant and an in-radius or out-of-radius result are stored, never the device coordinates; an out-of-radius check-in is flagged, not refused.
- **FR-CRW-002** Offline check-in:
  - The mobile app keeps, for each permit the receiver holds, the crew list with each member's photo, the certificates and competencies the work type requires with their expiry dates, inductions, and the agency's insurance expiry, in the encrypted offline store (§18). It refreshes them whenever online and at least once at the start of each day of work, and wipes them when the permit closes.
  - Offline, check-in applies FR-CRW-003 and FR-CRW-011 to that copy, and refuses check-in unless the device holds that date's completed revalidation (from the second date, FR-CRW-006) and, where gas testing applies, an in-limit reading within its validity (FR-GAS-002), and refuses check-in after the permit's end time (FR-PTW-012). It records device time and location result. The server stores both device time and receipt time.
  - On sync, the server repeats every check. A check-in it refuses is marked "Refused on sync: <reason>" on the permit's attendance record, the receiver and coordinator are notified at once, and that person cannot record progress until it is resolved.
  - A check-in synced more than 2 hours after its device time is marked "Late sync" and flagged.
- **FR-CRW-003** A person cannot be checked in if any certificate or competency the permit's work type requires is missing or expired, or (for agency staff) the agency's insurance has expired.
- **FR-CRW-004** After Issue, the receiver can add a substitute for an absent crew member, or an extra crew member: for agency permits any staff of the same agency, for internal crews any holder of Executor at the plant. The FR-CRW-003 and FR-CRW-011 checks run before the request is sent. The request goes to holders of "accept substitute" at the plant as a work-queue item with a 30-minute target and the Issue step's escalation. Once it is accepted, the newcomer is briefed (FR-CRW-012) and then checked in.
- **FR-CRW-005** Only checked-in crew can record progress or evidence on the permit that day.
- **FR-CRW-006** A day is the calendar date in the plant's time zone.
  - On the date of Issue, the checks completed before Issue (safety check, gas test under FR-GAS-002, isolation verified, SIMOPS at Issue) count as that date's revalidation, and check-in follows Issue.
  - If no crew member is checked in by the end of the date of Issue, the issue lapses and the permit returns to Approved; the lapse applies only to a permit still Issued at the end of its date of Issue. The coordinator issues it again, after FR-GAS-002 is met and a holder of "verify isolation" confirms the isolations are intact. Checks made before Issue never count for a later date.
  - On every later date of a multi-day permit, the receiver and safety officer first complete the daily revalidation (conditions, isolations intact, gas test under FR-GAS-002, SIMOPS re-evaluated). Only then can the receiver check crew in, and each check-in is checked against that date's completed revalidation.
  - Each date's crew list and check-in record are attached to that date's revalidation record (on the date of Issue, the Issue record).
- **FR-CRW-007** A person can be checked in on only one permit at a time; for agency staff this is enforced through the agency's attendance record (FR-AGY-010), so neither client sees the other's permit. Each plant has a live headcount (who is checked in, on which permit, at which place) for its coordinators, safety officers and admins; on mobile it is available offline as of the last sync, holding name, permit and place only, in the encrypted store. At the permit's end time each day, anyone still checked in is flagged to the receiver, coordinator and safety officer.
- **FR-CRW-008** The receiver can check in all listed crew in one action, after unticking anyone absent. Each row shows the person's photo. Anyone who fails FR-CRW-003, lacks a valid induction (FR-CRW-011) or has no briefing acknowledgement (FR-CRW-012) is skipped and listed by name with the reason.
- **FR-CRW-009** A receiver can add a substitute offline. The substitute shows as "Waiting for coordinator" and cannot be checked in until the acceptance reaches the device.
- **FR-CRW-010** Progress and evidence recorded offline are accepted on sync if their device time is after the crew member's check-in for that day, whichever device recorded the check-in and in whatever order the two sync.
- **FR-CRW-011** A plant can require a site induction with a validity period, recorded per person. Check-in is refused without a valid induction for that plant.
- **FR-CRW-012** Before a person's first check-in on a permit (including substitutes and new crew on later days), the receiver briefs them on the permit's hazards, controls, PPE and isolations, and the person acknowledges the briefing in their own name: on their own device, or, for a crew-only person, on the receiver's device with their name and a tap or signature, recorded with the receiver as witness. Check-in is refused without that acknowledgement.

### 10.4 Execution, stop work, handover and closure
- **FR-PTW-008** [v1 FR-PTW-007 to 009] Checked-in crew record progress and evidence (photos, files) throughout execution.
- **FR-PTW-009** Stop work: any checked-in crew member, the receiver, the coordinator, the safety officer or the approver of a permit can stop work on it at any time. The permit becomes Suspended at once, and the permit's coordinator, receiver and safety officer are notified. Stop work is not a role-editor permission and cannot be removed. [v1 FR-ROL-002] The safety officer can also cancel the permit at any status before Closed; FR-PTW-011 then applies. A holder of "resume" can resume only after: the reason for stopping is answered (with an incident recorded where one occurred); a holder of "verify isolation" confirms the isolations are intact; where gas testing applies, a gas test passes within its validity (FR-GAS-002); SIMOPS is re-evaluated; and the crew is checked in again.
- **FR-PTW-010** [v1 FR-PTW-010 to 012] At completion the receiver reports the work done and confirms every crew member is out and checked out, guards and barriers are back, and tools and materials are removed; restoration is refused until then. Every isolation hold of the permit is released under FR-LTO-103: restored and the restoration verified where the permit was the last holder, otherwise released with the remaining holders confirmed. The coordinator inspects the area (work area clear, guards and barriers back in place, equipment safe to return to service), records the result and accepts closure. Closure is refused while any crew member is checked in or the permit still holds any isolation point. Closed permits stay available for reporting and audit.
- **FR-PTW-011** Making safe: once a permit has reached Isolation or Issue, it cannot become Closed, Rejected or Cancelled until (a) every crew member is checked out, or the receiver records where each one is, and (b) every isolation hold of the permit is released under FR-LTO-103, or, where no other permit holds the point, the hold is transferred to another open permit that takes it over, with the transfer verified by the safety officer. Reject, cancel and an accident stop work at once and block any further step; the permit gets a "Make safe" task for the receiver and coordinator, and its final status is set when that task is done.
- **FR-PTW-012** Expiry: a permit's work window ends at its approved end time, as extended or renewed.
  - From that time, whatever the permit's status (Approved, Issued, Active or Suspended), the server refuses issue and reissue, check-in, progress and resume, checking the end time on every such action, not only by a timer. An Issued or Active permit becomes Expired; an Approved or Suspended permit keeps its status, marked "Past end time".
  - For an action recorded offline, the end time is compared with the action's device time (NFR-OFF-001, FR-CRW-010): an action made before the end time and synced after it is accepted, and marked "Late sync" when FR-CRW-002 applies.
  - Only an approved extension or renewal ([v1 FR-MDP-009]) reopens the window; before Issue, a new end time is a scope edit under FR-WFE-006, which reruns the approval.
  - Check-out, making safe, release and restoration of holds, incidents, the extension request and closure stay available, and the coordinator and safety officer are alerted until it is closed.
- **FR-PTW-013** Handover: on a permit with open close-out, the person who holds the coordinator or receiver duty can hand it to another person who holds the same role at the plant (for an agency, another receiver nominated on the same engagement; the agency's access to the permit moves with the duty). The handover includes a note on the state of the work, the isolations and the crew. The incoming person must accept before the outgoing person is released; until then both are listed. A receiver handover also needs the coordinator's acceptance. When the holder is absent, the coordinator or a legal-entity admin can reassign the duty, giving a reason. Every handover is recorded on the permit and shown in the work queues of both people. A handover is administrative under FR-WFE-006 and never restarts approval. After End now, or when the outgoing holder has lost access, the outgoing acceptance is not needed.
- **FR-PTW-014** Cancel: the coordinator can cancel a permit before Issue. After Issue, only the approver or the safety officer can cancel it, and must give a reason. Cancelling follows FR-PTW-011.

### 10.5 Statuses
Permit statuses keep v1's names and colours where the meaning is unchanged: Draft, Pending approval, Deferred, Approved, Active, Suspended, Execution completed, Pending closure, Closed, Rejected, Cancelled, Expired. New in v2: **Awaiting receiver** (raised, not yet accepted) and **Issued** (issued, crew not yet checked in). New statuses use existing status colour families; no new design tokens are added. Expired follows FR-PTW-012.

---

## 11. Modules carried over

Each module keeps its v1 behaviour (v1 PRD §5.5–5.8, §6.2–6.4) except as stated, and is scoped to the legal entity and plant. LOTOTO, SIMOPS and incidents can each be switched off per legal entity; incident reporting itself (record, notify, stop work) is always available on a permit.

### 11.1 LOTOTO
- [v1 FR-LTO-001 to 014] carried over.
- **FR-LTO-101** LOTOTO procedures belong to a machine and are kept by the legal entity.
- **FR-LTO-102** Isolation is performed by holders of "perform isolation" and verified by holders of "verify isolation"; one account cannot both perform and verify the same isolation point, nor restore and verify the restoration of the same point. Offline, the device refuses a verify by the account that recorded the perform on the same point, and the server checks again at sync.
- **FR-LTO-103** An isolation point can be held by more than one open permit; each permit's reliance on it is a hold.
  - Every hold, including the first on a point, is granted by the server before the permit relies on the point. The server grants a hold atomically and refuses it while a restoration of that point is requested or in progress. Offline, the app records the isolation and try-out evidence, but the hold is not taken: the permit's Isolation step cannot complete, and the permit cannot be issued or check crew in, until the server confirms the hold. The performer records the hold (and the permit's personal locks, FR-LTO-104), and a holder of "verify isolation" verifies the point (try-out) for that permit. The High clash of [v1 FR-SIM-021] must be resolved first.
  - A permit releases its hold when its work on the point is done: the receiver requests the release, and a holder of "verify isolation" confirms the point stays isolated for the remaining holders.
  - A point can be physically restored only when no other permit holds it and no personal lock is on it. The server grants restoration atomically: a granted restoration request blocks new holds on the point until the restoration is verified or cancelled. The restoration screen lists any remaining holders and locks. Offline, the app shows "Connect to confirm no other holder before restoring" and records no restoration.
  - The last permit holding a point restores it, and the restoration is verified.
- **FR-LTO-104** A LOTOTO procedure can require personal locks. Each crew member records lock-on (with the lock number) at check-in and lock-off at check-out. Check-out is refused while that person's lock is on, and restoration is refused while any personal lock is on. Removing another person's lock needs the safety officer, a reason, and a record that the person was contacted or confirmed off site.
- **FR-LTO-105** While LOTOTO is off, the Safety check of an isolation-required permit records the outside isolation certificate number and who verified the isolation. Issue is refused without them.

### 11.2 SIMOPS
- [v1 FR-SIM-001 to 021] carried over, with HOD read as Approver and Job Issuer as Coordinator; triggers as in FR-PTW-005.
- **FR-SIM-101** Each legal entity keeps its SIMOPS rules, started from the organisation standard and updated as lists are (FR-LST-004): which work types may not run together in the same location or workstation, the hazard-interaction matrix and severities, minimum separation (distance between places, or time between permits), and the steps to resolve a clash (D15).
- **FR-SIM-102** Clashes are evaluated within a plant; plants never clash with each other.

### 11.3 Multi-day permits
- [v1 FR-MDP-001 to 009] carried over, with HOD read as Approver and Issuer as Coordinator.
- **FR-MDP-101** On every later date after the date of Issue, each day starts with the daily revalidation, then check-in (FR-CRW-006).

### 11.4 Incidents
- [v1 FR-INC-001 to 011] carried over, with HOD read as Approver. An accident stops work and starts making safe (FR-PTW-011).
- **FR-INC-101** An incident belongs to the legal entity of the plant where it happened. Agency staff involved are recorded by snapshot (FR-AGY-009) and linked to their agency record while the engagement is active.

### 11.5 Notifications
- [v1 FR-NOT-001 to 009] carried over.
- **FR-NOT-101** Permit-step messages use the step's templates and CC lists (FR-WFD-011, 012), sent through the email server chosen by FR-LE-004, and in-app.
- **FR-NOT-102** Each person can choose email, in-app, or both per event type, except escalations and safety-critical events (stop work, incident reported, SIMOPS High conflict, gas reading out of limits, refused check-in on sync), which always go by both.

### 11.6 Gas testing
- **FR-GAS-001** Each gas-test parameter in the lists carries limits and a validity period (defaults come from the industry library). A permit type can require continuous monitoring.
- **FR-GAS-002** Issue, the first check-in of each day and resume after a suspension are refused unless every required parameter has an in-limit reading, taken at the work place within its validity period. A reading outside its limits on an Issued or Active permit stops work at once (FR-PTW-009) and alerts the safety officer and coordinator.

---

## 12. People data and privacy

### 12.1 Lawful basis, notice and consent
- **FR-PRV-001** Each legal entity (or agency) records, for each data category (identity, sign-in identity, contact, emergency contacts, blood group, health conditions, employment history, check-in location result and photo), its purpose and lawful basis: legal obligation, employment, vital interest or medical emergency, or consent. Platform defaults: blood group and health conditions rely on consent; emergency contacts rely on employment and vital interest and never depend on consent; the sign-in identity relies on employment and never depends on consent, because sign-in, tenant access and the account identity used for segregation of duties (FR-ROL-005) need it (counsel confirms this basis, R4); viewing the emergency subset (FR-PRV-006) relies on vital interest or medical emergency. An admin may change a default only after recording the legal reason. The privacy notice and consent text are versioned; each version may have translations, and the person can read them in any language the legal entity provides (the only exception to D13). The notice names every role that can see the emergency subset.
- **FR-PRV-002** Data that relies on consent cannot be entered, imported or stored until consent is recorded: by the person in the app (web or mobile), or by their employer's admin, who attaches the signed consent form and records the wording version, date and method (required for crew-only people). Spreadsheet import rejects these fields. A person can withdraw consent at any time from their profile, as easily as they gave it (an admin can record a written withdrawal). On withdrawal, the data that relies on it is deleted within 24 hours, the employer's admin is told, and the emergency subset then shows emergency contacts only. Withdrawing consent for contact details deletes the optional contact details only: the sign-in identity, the account link, tenant access and permit duties are unaffected (FR-PPL-005). Without consent, everything else needed for permits still works.
- **FR-PRV-003** A person can view and download their own data.
- **FR-PRV-011** When the consent wording changes, people are asked again at their next sign-in; the earlier consent stands until they answer.

### 12.2 Access
- **FR-PRV-004** Fields listed in NFR-SEC-003 are encrypted at field level.
- **FR-PRV-005** Full record (all FR-PPL-003 fields): visible only to the person and to the legal-entity admins of the person's employer legal entity or agency. Organisation admins, parent-entity admins and support see it only if they also hold that role.
- **FR-PRV-005a** Assignment card (name, photo, employer, designation, role assignments, certificates and competencies with expiry): visible to admins of any legal entity with a plant the person is assigned to, to organisation admins, and to the coordinators and safety officers of permits the person is on. Reports that list people show assignment-card fields only.
- **FR-PRV-005b** Admins of a parent legal entity see their child entities' reports (FR-RPT-003), not their people.
- **FR-PRV-006** The emergency subset (blood group, emergency contacts, health conditions the person listed) is visible to the coordinator and safety officer of a permit for people on that permit, and to the receiver for crew checked in that day.
  - It is visible from the start of the permit's first Isolation step or its Issue, whichever comes first, while the permit has open close-out; and for 72 hours after an incident on that permit is reported, if it was reported while the permit had open close-out or within 24 hours of the permit closing, and then only for crew checked in on the day of the incident and anyone else on the permit recorded in the incident report as involved (for example an isolator hurt before Issue).
  - Offline, it may be cached for checked-in crew of permits where the user holds a role, only in the encrypted store. Consent-based fields (blood group, health conditions) in that copy expire 24 hours after the device's last sync, measured as time elapsed since that sync on the device's monotonic clock, not by the wall clock, and are deleted at once if the device restarts while offline; every sync applies withdrawals at once. Emergency contacts, which do not depend on consent, stay until the permit closes or the 7-day offline wipe (§18), whichever comes first. Offline views are logged at sync.
- **FR-PRV-007** For agency staff, the data stays in the agency tenant; the client sees only what FR-AGY-006 allows, through NFR-SEC-002(b).
- **FR-PRV-008** Every view of personal or health data is logged with who, when and why (the permit or screen), by the personal-data service in the same transaction (NFR-SEC-003).

### 12.3 Retention
- **FR-PRV-009** Defaults, changeable per legal entity or agency: health data deleted 30 days after the person leaves; contact and identity data deleted 12 months after leaving; names and roles on permit records, check-in records and audit actor IDs kept for the legal entity's safety-record period (default 10 years) as a legal obligation, then pseudonymised.
- **FR-PRV-010** Certificate expiry warnings go to the person and their employer's admin 30 days before expiry; expired certificates block check-in (FR-CRW-003) and role actions (FR-ROL-009).

### 12.4 Responsibilities and rights
- **FR-PRV-012** Each employer legal entity or agency is the controller (data fiduciary) for its people's data. The client legal entity is controller for snapshots (FR-AGY-009) and for emergency-subset views. PermitWiseAI is processor under a data processing agreement accepted at onboarding, which names the hosting region and lists sub-processors. The platform is controller only for access-request and account data.
- **FR-PRV-013** Each legal entity and agency records a grievance contact, shown in the notice. A person can request access, correction, erasure and consent withdrawal in the app. Requests go to the employer's admin, are tracked with a status, and must be answered within 30 days. Erasure is refused only for data retained under legal obligation (FR-PRV-009), and the reason is shown.
- **FR-PRV-014** The platform reports a suspected personal-data breach to every affected controller within 24 hours of discovery, giving the data categories, people and tenants affected, so that controllers can meet the GDPR and DPDP deadlines. The platform keeps a breach register.
- **FR-PRV-015** The data processing agreement names the hosting region. If it is outside the EU/EEA, EU customers sign the EU Standard Contractual Clauses, backed by a transfer impact assessment, before go-live. A DPIA covering health data, check-in location and cross-tenant agency sharing is completed before the Phase 3 pilot (§19).

---

## 13. Reporting

### 13.1 Work queue
- **FR-RPT-001** Every person's home is their work queue: steps waiting on them (with time against target), permits to receive, crew to check in, substitutes to accept, handovers to accept, flags, make-safe tasks, updates available and "Needs workflow change" items (admins), and certificates about to expire. For agency staff, items from every engagement appear in one list labelled with client and plant (FR-AGY-005).

### 13.2 Dashboards
- **FR-RPT-002** Legal-entity dashboard: permits by status, plant and type; step KPIs (time in step against target, breaches, escalations by step and role); incidents; LOTOTO; SIMOPS clashes; crew attendance with flags (late sync, out of radius, refused on sync); live headcount per plant; certificates expiring in 30 days; usage.
- **FR-RPT-003** A parent legal entity sees its child entities' dashboards rolled up (D11).
- **FR-RPT-004** The organisation dashboard covers all legal entities with drill-down legal entity → plant, plus usage and billing.
- **FR-RPT-005** Reports export to CSV and PDF.
- **FR-RPT-006** Agency admins see their crews' work across clients from the agency's own attendance record (FR-AGY-010): permits worked, attendance, and certificate expiries.

### 13.3 Platform and support access
- **FR-RPT-007** The platform admin sees tenants, trials, plans and usage, never permit content or personal data. Operators with database or backup access work under a break-glass procedure: access is time-limited, recorded with a reason, and shown in the affected tenant's support log. Encrypted fields stay unreadable to them (NFR-SEC-003).
- **FR-RPT-008** An organisation admin can grant named platform support staff read-only access to one legal entity, or to the whole organisation, for at most 7 days. Write access is a separate, explicit scope, limited to configuration and never permit steps. Support never sees encrypted fields or agency staff data, and must use MFA (NFR-SEC-009). The admin can revoke a grant at any time. Every read and action under a grant is logged and visible to the organisation admin and to the affected legal entities' admins.

---

## 14. Billing and subscription

- **FR-BIL-001** Organisations pay per billable plant in tiers (D8). A plant is billable in a month if any permit was raised or open in it that month.
- **FR-BIL-002** One invoice per organisation per period, in one currency, with usage (billable plants, permits raised, active users) broken down per legal entity and plant.
- **FR-BIL-003** 30-day trial for new organisations; expiry behaviour in FR-ONB-013.
- **FR-BIL-004** Agencies are free.
- **FR-BIL-005** Plan tiers, prices and currency are set by the platform admin; a plan change takes effect at the next period.

---

## 15. Audit

- **FR-AUD-001** Every permit action records who, on whose behalf, when, from which device, and what changed.
- **FR-AUD-002** Every change to lists, roles, role assignments, workflows, SIMOPS rules, numbering, email servers, engagements and settings records who, when, and the before and after values, subject to FR-AUD-005.
- **FR-AUD-003** Audit records cannot be edited or deleted through any interface. While the organisation is a customer, they outlive the records they describe for the safety-record period. On tenant deletion they are part of the final export (FR-ONB-013).
- **FR-AUD-004** Personal-data views are audited (FR-PRV-008); support access is audited (FR-RPT-008).
- **FR-AUD-005** Audit and access-log records store IDs, field names and values that are not personal. Contact, identity, health and employment-history values never reach audit; a change to one is recorded as "field X changed by Y at T". Secrets (email-server passwords, keys) are recorded as "changed", never as values. Safety values (gas readings, isolation points, hazards, controls, times, decisions) keep their full before and after values.
- **FR-AUD-006** The personal-data access log (FR-PRV-008) is readable only by the person it concerns and their employer's admins. It is kept for at least 1 year (default 3 years; changeable per legal entity or agency).

---

## 16. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-SEC-001 | Tenant isolation is enforced in the database (row-level security) on every tenant table, using the request's tenant, legal entities and account; an automated test suite proves cross-tenant reads and writes fail for every table. |
| NFR-SEC-001a | The API and workers connect as a dedicated login role that is NOSUPERUSER and NOBYPASSRLS and owns no table. Migrations run as a separate owner role that the API cannot assume. Every table in the application schema has ENABLE and FORCE ROW LEVEL SECURITY and at least one policy. Global tables (industry library, plans, platform default workflow) have a read-all policy and only the platform role can write to them. The API role has only INSERT and SELECT on audit and access-log tables. Keycloak uses its own database and role. Any reporting tool (Metabase) is removed or connects as a read-only role limited to views with no permit content or personal data. A CI schema test, run as the API role, fails if any application table lacks FORCE RLS or a policy, or if the API role is a superuser, has BYPASSRLS or owns a table. |
| NFR-SEC-002 | Data crosses tenants by exactly four paths, all enforced in the database. (a) Agency to client: an agency user's request tenant is always the agency. The user can read client permits, and the plant and place names they reference, through a policy that needs an active engagement (or the wind-down of FR-AGY-008) covering the permit's plant and the user's assignment to that permit (nominated receiver or crew member). Writes are limited to the step actions the user holds on that permit. (b) Client to agency staff: client requests have no policy on the agency's people, certificate or insurance tables. They read agency staff only through one security-barrier view or SECURITY DEFINER function, which returns the FR-AGY-006 columns for people on that client's permits under an active engagement. This path also returns the photo and emergency subset, whatever the engagement's state, under the conditions in FR-PRV-006 (open close-out, or the post-incident window), for the FR-PRV-006 recipients only; it never reopens other agency staff fields or any agency user's access. The function itself checks these conditions in the database. Only the personal-data service returns the emergency subset decrypted, under FR-PRV-006 conditions and with the agency's data key, and it logs each view in the agency's access log and in the client's audit. (c) Client check-out of agency workers: a client receiver's check-out of an agency worker (after End now, or a handover to an internal receiver) writes only the check-out time to that worker's agency attendance record, through one SECURITY DEFINER function that checks the worker is checked in on that client's permit and writes nothing else, and is logged in both tenants. (d) Late agency submissions: when an agency account's access to a client permit has ended (End now, wind-down finished, or the receiver duty handed over), one SECURITY DEFINER function, which inserts only into that permit's "Received after access ended" list and checks in the database that the account was assigned to that permit (nominated receiver or crew member) when its access ended, appends each action that account queued for that permit, unapplied; all other submissions are refused. Evidence files are uploaded only through presigned URLs that this function issues for that submission, with size and type limits (NFR-SEC-010). It grants no read of the client permit and no permit action; the agency device sees only "Delivered for review". Each submission is logged in both tenants. |
| NFR-SEC-003 | The application encrypts, with AES-256-GCM using the record ID as associated data: blood group, health conditions, emergency contacts, employment history, identity document numbers and email-server passwords. Each tenant has a data key, wrapped by a master key in a managed key service or HSM (never an environment variable, the database or its backups). The API can use the master key to unwrap data keys but cannot export it. Data keys rotate yearly and on suspected compromise, with re-encryption in the background. Rotating the master key needs no data re-encryption. Only one personal-data service decrypts; it checks FR-PRV-005 and FR-PRV-006 and writes the FR-PRV-008 log entry in the same transaction; if the log write fails, nothing is returned. |
| NFR-SEC-004 | All traffic uses TLS; database storage and backups are encrypted at rest. |
| NFR-SEC-005 | The API meets OWASP ASVS level 2; permission checks happen on the server for every request. |
| NFR-SEC-006 | The server chooses the active tenant from the account's verified person records (and, for agency staff, the engagements derived from them) and keeps it in the server session. It is never taken from a client-supplied header or body alone. A tenant switch (FR-ONB-016) creates a new session context, and the browser or app clears data it cached for the previous tenant. The mobile app may hold one server session per tenant at once, each validated against the account's person records; a background session only sends queued actions and reads their results, and caches nothing. Each queued action is sent only with its own tenant's session. |
| NFR-SEC-007 | The permission cache is keyed by account and active tenant. Role edits, assignment changes, an engagement ending, offboarding and a support grant expiring each invalidate the affected entries immediately. As a backstop, no entry lives longer than 5 minutes. |
| NFR-SEC-008 | Every request and every job runs its queries in a transaction that first sets `app.tenant_id`, `app.person_id`, `app.legal_entity_ids` and `app.acting_role` with `set_config(name, value, true)`; these settings last only for that transaction, session-level SET is forbidden and blocked by a lint rule, and policies read them with `current_setting(name, true)` and return no rows when one is missing (default deny). Job payloads carry the tenant ID and record IDs only, never names, contact details or health data. Jobs that span tenants (timer sweeps, nightly SIMOPS, billing usage, retention deletion, trial expiry) get tenant IDs from a single SECURITY DEFINER function and process each tenant under its own context; they never use a bypass role. Failed jobs are kept for at most 7 days. Result caches in Redis (dashboards, KPIs, reports) are keyed by tenant and by the viewer's legal-entity scope. |
| NFR-SEC-009 | Platform admins, support staff, organisation admins and legal-entity admins must use a second factor (TOTP or passkey). Anyone else can turn one on, and a legal entity can require it for its people. |
| NFR-SEC-010 | Files (identity-document photos, check-in photos, evidence, reports) are stored under a tenant and legal-entity key prefix. They are reached only through presigned URLs valid for at most 5 minutes, issued after the same permission and RLS check as the record they belong to. Identity-document and check-in photos are encrypted with the tenant's data key before upload; check-in photos are deleted 90 days after the permit closes unless attached to an incident. The isolation suite covers file access. |
| NFR-SEC-011 | Customer email servers: the host must resolve only to public addresses (no loopback, private or link-local address, and none of the platform's own service names), checked when the server is saved and on every connection. Only ports 25, 465, 587 and 2525 are allowed. TLS (implicit or STARTTLS) with certificate validation is required, and the connect timeout is 10 seconds. A test-send result shows only success or a generic class of failure, never the server's banner or response text. |
| NFR-PRF-001 | API p95 under 500 ms for permit reads and step actions; the work queue renders its first 50 items in under 2 s on a mid-range Android phone (4 GB RAM) over 1.6 Mbps down, 750 kbps up and a 150 ms round trip. Measured as the API database role with RLS on, against 50 tenants holding 2 million permits and 200,000 people in total, with 5 tenants at 200 concurrent users each and 20% of users being agency staff working client permits. |
| NFR-AVL-001 | 99.5% monthly availability; backups daily, restore tested monthly; recovery point 24 h, recovery time 4 h. |
| NFR-AVL-002 | Backups are kept for at most 35 days. A deletion ledger (record IDs and deletion time, no content) is re-applied after any restore, before the system reopens. |
| NFR-OFF-001 | Mobile site actions (check-in/out, briefing acknowledgement, daily revalidation (both parts), progress, evidence, stop work, isolation steps (evidence recorded offline; holds and restoration need a server confirmation, FR-LTO-103), gas readings) work offline and sync when the connection returns. Unsynced actions are never discarded. An action recorded offline on a permit that the server had already suspended, cancelled or expired at the action's device time is kept, marked, and flagged to the coordinator and safety officer at sync. |
| NFR-ACC-001 | Web and mobile meet WCAG 2.2 AA, including the contrast rules already enforced in the design tokens and SC 2.5.7 (dragging alternatives). |
| NFR-L10N-001 | All interface text comes from translation files; dates and times show in the plant's time zone with the zone named; metric units throughout (D13). |
| NFR-OBS-001 | Every request carries the tenant and account in structured logs (no personal data in log messages); timers and escalations are monitored. |
| NFR-TST-001 | Reminders, escalations, gas validity, trial and retention dates and certificate expiry all read the time from one clock that the test environment can move forward. Time-based acceptance criteria are run by moving it forward, not by waiting. |

---

## 17. User interface and experience

- **UX-001** Keep, unchanged: the design tokens (`frontend/src/styles/themes.css` and the mobile theme generated from it), the four themes (Hazard, Control room, Setu, Ledger Slate), light and dark modes, normal and compact density, standard and strict styles, the component kits (web and mobile), field styles, and the writing guidelines (plain words, sentence case, actions named by what they do).
- **UX-002** Each legal entity picks one of the four themes and uploads a logo; no custom colours.
- **UX-003** New screens (setup checklists, role editor, workflow designer, engagements, crew check-in, handover, live headcount, updates available, consent and privacy requests) are built from the existing components. The workflow designer's flow diagram is drawn as SVG from the design tokens (FR-WFD-018).
- **UX-004** The permit is filled in the step-by-step wizard (one step per screen, step bar, Back/Next, save draft), split by role: the coordinator's raise steps; the receiver's receive steps (site details, hazards, PPE, isolation and gas needs, crew); then check sheets, each part filled by its role. Each person edits only the steps their role fills and sees the others as read-only summaries.
- **UX-005** Mobile covers field work: raising and editing permits, receiving, crew briefing, check-in, substitutes and handover, live headcount, stop work, approvals, safety checks, gas tests, execution, LOTOTO, SIMOPS clashes, incidents, closure, tenant switching, consent, and the person's own profile and certificates. Setup, people and agency management, the workflow designer, rule checks, lists and billing are web only (D12).

---

## 18. Technical architecture

**Stack:** NestJS API, Next.js web, Expo (React Native) mobile, PostgreSQL, Keycloak 26 (own database), Redis with BullMQ, MinIO object storage, SMTP mail. Metabase (optional analytics) is removed or restricted under NFR-SEC-001a.

**Data model (new core):**
- `organisations` (tenant, slug, type organisation/agency, industry), `legal_entities` (parent for reporting), `departments` (legal entity), `plants` (legal entity, time zone, status, location point), `locations`, `workstations`, `machines`.
- `accounts` (one per human, linked to Keycloak), `people` (person records: tenant, employer, account optional), `plant_assignments` (person, plant, role, optional department), `roles` (legal entity, key, permission set).
- `engagements` (client organisation and legal entity, agency, plants, dates, work types, nominated receivers), agency attendance records, client-side worker snapshots.
- List items and SIMOPS rules with source lineage (source item, source version) for updates available.
- `workflow_versions` (legal entity, status draft/tested/active/retired, definition), each permit referencing its version; step instances with timers; handovers; make-safe tasks.
- Crew check-ins, briefing acknowledgements, inductions, substitutes, personal locks, shared isolation-point holds, gas readings with validity.
- Lawful-basis and consent records, privacy requests, personal-data access log, support-access grants, deletion ledger.

**Isolation:** see NFR-SEC-001, 001a, 002, 006–008. Every request and job sets a transaction-local context; policies default to deny; the API role owns no table and cannot bypass RLS. The agency path (NFR-SEC-002 a), the column-limited agency-staff function (NFR-SEC-002 b) the agency check-out function (NFR-SEC-002 c) and the late-submission function (NFR-SEC-002 d) are the only cross-tenant paths.

**Identity:** one Keycloak realm with Organizations. Web and mobile sign in with OpenID Connect authorisation code and PKCE through Keycloak's login pages (on mobile, through the system browser). The password grant is switched off for every client. The slug passes the organisation hint, and the login theme shows the organisation's logo, name and theme (D14). Keycloak authenticates only; roles and permissions come from the application database and are cached in Redis under NFR-SEC-007. The v1 hard-coded role checks (about 356 across API, web and mobile) are replaced by permission checks.

**Workflow engine:** an API service that interprets workflow versions, creates step instances, and schedules reminders and escalations as BullMQ jobs in the plant's time zone, under NFR-SEC-008.

**Rule checker:** a pure module in `packages/shared`, used by the API to block go-live and by the web designer for instant feedback, so both always agree.

**Personal-data service:** the only code that decrypts NFR-SEC-003 fields; it enforces FR-PRV-005/006 and writes the access log in the same transaction.

**Mail:** per-legal-entity and per-organisation email servers under NFR-SEC-011, credentials encrypted (NFR-SEC-003), with the platform server as fallback.

**Mobile:** the offline store is rebuilt, not reused. It is encrypted with a key held in the device keystore (SecureStore) and partitioned by account and tenant. Cached responses are wiped on sign-out and after 7 days without a sync (the app then locks until sign-in); unsynced queued actions are never wiped. On a tenant switch, cached responses for other tenants are removed; queued actions are kept and sent in the background whichever tenant is displayed, each over its own tenant session (NFR-SEC-006) and only under the account that recorded them. Each queued action records account, tenant and permit, and the server refuses one whose account or tenant does not match the session. Crew copies (FR-CRW-002), the headcount (FR-CRW-007) and the emergency subset (FR-PRV-006) are the only personal data cached, all wiped when the permit closes; consent-based fields also expire 24 hours after the last sync (FR-PRV-006).

---

## 19. Delivery

A fresh build of the new model in the existing codebase (D4). Each phase ends with its exit criteria met on the demo data. Every phase's exit criteria also include: the schema test (NFR-SEC-001a) and the isolation suite pass for every table added in that phase, including the agency path for any table that holds permit, crew or people data. If Phase 1 is too large for the team, it is split into 1a and 1b; security work is never moved later.

| Phase | Content | Exit criteria |
|---|---|---|
| 1. Foundation | Account and person model (FR-PPL-004); API database role and FORCE RLS (NFR-SEC-001a); transaction-local context for requests and jobs (NFR-SEC-006 to 008); key service and personal-data service with access log (NFR-SEC-003); lawful-basis and consent records (FR-PRV-001, 002, 011); audit writer (FR-AUD-001 to 003, 005); agency-path policy skeleton with a test fixture of one agency and one client (NFR-SEC-002); Keycloak Organizations with code flow and PKCE, slug sign-in, tenant switch, MFA for admins; mobile sign-in and tenant choice; people, roles and permissions | Isolation suite and schema test green; a person signs in at a slug on web and by email on mobile and sees only their tenant; the Keycloak spike items in R2 pass |
| 2. Setup | Access requests, organisation and legal-entity checklists, plants with status, places, industry library and updates available, numbering, email servers (NFR-SEC-011), themes and logos, consent at first sign-in, invitations; rule checker core (role checks and check 3) with the platform default workflow loaded as data and each new legal entity's first version active from creation (FR-WFD-001), so plants can go Live | A new organisation goes from request to a legal entity with a Live plant and people without database edits |
| 3. Workflow and pilot | Engine, designer, the remaining rule checks, dry run, versions; permit lifecycle on the engine reusing the v1 wizard, execution and closure screens; internal-crew briefing, check-in and check-out on mobile (online); stop work, making safe, handover, cancel, expiry; gas testing; certificate, competency and induction blocks for internal crews and role holders (FR-CRW-003, FR-ROL-009, FR-CRW-011); emergency subset on the permit, online (FR-PRV-006); basic incident report (record, notify, stop work) | A legal entity edits, tests and activates a workflow; an internal-crew permit runs end to end on web and mobile, including check-in, stop work and making safe; in-flight permits keep their version |
| 4. Agencies | Agency tenants, engagements, nominated receivers, wind-down and End now, snapshots, agency attendance, offline check-in and the rebuilt offline store, offline emergency-subset cache, substitutes, agency insurance blocks; daily revalidation from the second date (FR-CRW-006, FR-MDP-101) | An agency crew works a client permit for three days with a substitute on day 2 and an offline check-in on day 3 |
| 5. Modules | LOTOTO (shared points with holds, personal locks), SIMOPS rules and triggers, multi-day extension and renewal [v1 FR-MDP-009], full incident investigation, notifications re-scoped | v1 acceptance scenarios for each module pass on the new model |
| 6. Finish | Reporting tiers, live headcount dashboard, billing per plant, own-data download, privacy requests, retention jobs and deletion ledger, support access, break-glass, trial read-only and suspension (FR-ONB-013) | §21 acceptance criteria pass |

Each phase's exit is walked using only that phase and earlier ones, with no database edits and no skipped checks.

**Pilot.** The end of Phase 3 is the first pilot release: one organisation, internal crews, LOTOTO and SIMOPS switched off. Pilot permits end on the date they start (multi-day from Phase 4), and check-in, check-out and stop work need a connection (offline from Phase 4). The pilot includes stop work, making safe and the basic incident report. Isolation-required permits in the pilot record the outside isolation certificate at Safety check (FR-LTO-105). Before the pilot starts, the data processing agreement, grievance contact, breach process and DPIA (FR-PRV-012 to 015) are in place.

**v1 screens.** From Phase 1 until Phase 5, the v1 LOTOTO, SIMOPS, multi-day and full incident screens are unavailable because the database is reset. Demos in that window use the Phase 3 flow.

---

## 20. Out of scope for v2

- Any language model or AI feature (D5).
- Gate or access-control system integration for attendance (D10).
- Integration with HR, ERP or other business systems (D15).
- Languages other than English, except privacy notice and consent translations (D13, FR-PRV-001).
- Public landing pages or notice boards (D14).
- Plant-level workflow overrides (D3).
- BPMN or free-form workflow diagrams (D17).
- Migration of v1 data (D4).
- Agency subscriptions (D8).
- Data residency by country: v2 uses a single hosting region, named in the data processing agreement; transfers are covered by FR-PRV-015.

---

## 21. Acceptance criteria

v2 is complete when, on the demo data:
1. A platform admin approves an access request, and the organisation admin sets up two legal entities (one the reporting parent of the other), each with a Live plant, people and the default roles, without any database edits.
2. A legal entity changes its workflow (adds a gas test for hot work, sets a 2-hour approval target with two escalation levels), sees a failing rule check when a role has no holder and when a first-response group contains a gas test, fixes both, dry-runs it, and activates it; a permit raised before activation finishes on the old version. Escalation is verified by moving the test clock (NFR-TST-001).
3. A coordinator raises a hot-work permit for an engaged agency; an agency supervisor accepts it; the approval escalates after its target; the gas test is in limits; the permit is issued; the crew is briefed and checks in on mobile, offline; a substitute with an expired certificate is blocked and a valid one is accepted by the coordinator; a crew member stops work and the permit resumes after the re-checks; the permit closes only after everyone is checked out and isolations are restored.
4. The client never sees agency staff data beyond FR-AGY-006; the agency never sees a client permit outside its assignments; the isolation suite proves both, including a client user selecting every column of the agency staff tables directly and getting no rows, a pooled connection reused after a tenant-A request returning no tenant-A rows to a tenant-B request, a job without tenant context reading nothing, and the agency check-out function (NFR-SEC-002 c) writing only a check-out time for a worker checked in on that client's permit, and, after End now, an action queued on an agency device reaching the client permit's review list through path (d) while the agency's ordinary reads and writes on that permit fail and submissions for permits the account was never assigned to are refused.
5. A coordinator, safety officer and receiver see a crew member's emergency subset while the permit has open close-out and for 72 hours after an incident on it (including an isolator recorded as involved who was never checked in), and not otherwise; each view is in the access log; withdrawing consent removes blood group and health conditions within 24 hours while emergency contacts stay; ending the engagement during an incident response leaves the photo and emergency subset available to those recipients for the 72 hours, and nothing else of the agency's records; a device kept offline for more than 24 hours after a withdrawal shows no blood group or health conditions but still shows emergency contacts; a coordinator whose legal entity bases contact details on consent withdraws that consent, and their optional contact details disappear while their sign-in, tenant access, roles and permit actions continue (D31).
6. The organisation admin accepts one and declines one list update from the industry library; a legal-entity admin then receives only the accepted change as an update; a refused risk-level increase shows as "Needs workflow change".
7. Dashboards show step KPIs per legal entity and roll up to the parent entity and the organisation; usage on the invoice is broken down per legal entity and plant.
8. v1's LOTOTO, SIMOPS, multi-day and incident scenarios pass on the new model, and a shared isolation point cannot be restored while another permit relies on it; with two permits holding one point, the first closes by releasing its hold, and the point is restored only by the second; a hold recorded offline does not count until the server confirms it, and simultaneous requests for a hold and a restoration on one point never both succeed.
9. Every web route and mobile screen passes an automated axe-core scan with no serious or critical violations, in all four themes, light and dark. A lint rule fails the build on any colour, radius or font value outside the token files. The permit wizard, workflow designer, role editor and crew check-in pass a manual keyboard and screen-reader check, recorded in the test report.
10. An expired permit with checked-in crew and no isolation keeps every close-out action available to its receiver after its engagement ends and after the trial clock passes the read-only date, and the organisation is not suspended until it is closed.
11. The unmodified platform default workflow passes every rule check, and a permit closes with the receiver, safety officer and coordinator each completing their own closure part.
12. With the test clock, a noon-ending Issued permit and a noon-ending Suspended permit, at 14:00, refuse first check-in and resume until an extension is approved, while check-out and close-out actions keep working; a check-in recorded offline at 11:50 and synced at 12:30 is accepted, and one synced at 14:01 is accepted and marked "Late sync".

---

## 22. Risks and decisions still needed

| # | Item | Owner | Needed before |
|---|---|---|---|
| R1 | Row-level security adds query cost and complexity; a missed policy leaks data. Mitigation: NFR-SEC-001a (API role that neither owns tables nor bypasses RLS; FORCE RLS; schema test run as the API role); isolation suite in CI. | Engineering | Phase 1 |
| R2 | Keycloak Organizations is recent. Mitigation: the Phase 1 spike proves one account in two organisations, per-organisation branding on Keycloak's login page, the active organisation in the token, the mobile code flow, and two tenant sessions held at once on mobile. | Engineering | Phase 1 |
| R3 | The workflow designer can grow into a general process tool. Mitigation: fixed step types and fixed safety order (§8.2, FR-WFE-001). | Product | Phase 3 |
| R4 | Health data creates legal exposure in each country. Mitigation: lawful basis per data category (including the employment basis of the sign-in identity, D31), notice text and translations reviewed by counsel for India (DPDP Act 2023 and Rules 2025) and the EU (GDPR Art. 6 and 9) before the schema is built. | Product, legal | Phase 1 |
| R5 | Customer email servers fail or are misconfigured. Mitigation: NFR-SEC-011, a test-send on save, fallback to the platform server, failures shown to the admin. | Engineering | Phase 2 |
| R6 | Location checks can be spoofed; offline check-ins can be back-dated. Mitigation: flags, not refusals (FR-CRW-001, 002), visible in reports, with server receipt time stored. | Product | Phase 4 |
| R7 | Agency users reading client rows from their own tenant (FR-AGY-005, NFR-SEC-002 a) needs a cross-tenant policy branch, which is harder to prove safe than one tenant per session. One reviewer preferred one tenant per session; the majority chose this model for one queue across clients. Mitigation: the agency path is a separate, narrowly written policy set (engagement active AND assigned to the permit), with its own isolation tests in every phase; the other cross-tenant paths (NFR-SEC-002 b, c, d) are single SECURITY DEFINER functions covered by the same suite. | Engineering | Phase 1 |
| D-1 | Plan tiers and prices per billable plant. | Product | Phase 6 |
| D-2 | Data residency for customers who require in-country hosting (FR-PRV-015). | Product | Before the first such customer |
| D-3 | Industry libraries to ship at launch (which industries, which content). | Product | Phase 2 |

---

## 23. How far v2 departs from v1

### 23.1 Functional design
| Area | v1 | v2 | Change |
|---|---|---|---|
| Customer structure | One organisation per tenant; plants → departments → locations | Organisation → legal entities (reporting tree) → departments; legal entity → plants (status) → locations → workstations → machines | Rebuilt |
| Tenant address | None (tenant from sign-in) | `/<slug>` with branded sign-in, tenant switch | New |
| People | Employees, contractors, agencies as records in the tenant | Accounts with person records per tenant; one employer per record; plant assignments across legal entities; crew-only people; identity, health, training, inductions, certificates | Rebuilt |
| Agencies | Records kept by the client | Own tenants; engagements with lifecycle; client sees permitted fields only; snapshots; agency attendance | New |
| Roles | 8 fixed roles | Fixed admin roles plus 5 permit roles as editable permission sets, per plant and department, with safety limits and required certificates | Rebuilt |
| Permit roles | Job issuer, executor, HOD, safety officer | Coordinator, receiver, executor, approver, safety officer (receiver = crew side) | Changed |
| Standard lists | Per tenant, edited directly | Industry library → organisation standard → legal-entity copy with reviewable updates; isolation and gas minimums | Rebuilt |
| Workflow | Six-stage approval template per tenant with stage settings | Versioned workflows per legal entity from a fixed step palette, designer, rule checks, dry run, KPIs, escalation, fixed safety order | Rebuilt (v1 rules carried over) |
| Crew attendance | Not covered | Daily briefing, check-in/out, inductions, substitutes, live headcount, certificate blocks | New |
| Stop work, making safe, handover | Pause and cancel paths | Stop work for everyone, make-safe before any ending, explicit handover | New |
| Permit wizard | Step-by-step, issuer and executor parts | Same wizard, coordinator and receiver parts | Kept, adapted |
| LOTOTO, SIMOPS, multi-day, incidents, gas | Tenant-wide | Per legal entity and plant; shared isolation points and personal locks; SIMOPS rules editable; gas validity; switchable modules | Adapted |
| Privacy | Basic profile data | Lawful basis, consent and withdrawal, encryption, emergency subset, access log, retention, rights requests, breach process | New |
| Reporting | Role dashboards per tenant | Work queue; legal entity, parent roll-up, organisation drill-down; step KPIs; headcount | Rebuilt |
| Billing | One plan per tenant | Per billable plant, usage per legal entity and plant, agencies free, trial rules that never strand live work | Rebuilt |
| Onboarding | Tenant invite | Access request with recorded verification, setup checklists, go-live checks | Rebuilt |

**Overall:** large. What a permit, an isolation, a SIMOPS clash or an incident *is*, and how a person fills them in, stays. Who the customer is, who does what, how the process is defined, and the safety floor around it are new.

### 23.2 Technical architecture
| Area | v1 | v2 | Change |
|---|---|---|---|
| Tenant isolation | `tenant_id` filtered in application code | PostgreSQL row-level security on every table, transaction-local context, default deny, plus four cross-tenant paths (NFR-SEC-002) | Rebuilt |
| Database roles | API, Keycloak and Metabase share database `ptw_platform` as superuser `ptw` | Separate databases; the API uses a role that owns no tables and cannot bypass RLS | Rebuilt |
| Identity | Keycloak realm roles; tenant from a `tenant_id` token claim, otherwise looked up by invite email; password grant through the API | Keycloak Organizations; authorisation code with PKCE; one account across tenants; MFA for admins; roles from the application database | Rebuilt |
| Authorisation | ~356 hard-coded role checks | Permission checks against editable roles, cached per account and tenant | Rebuilt |
| Approval engine | Ordered stages with one approver role each | Interpreter over versioned definitions; two-part steps, parallel groups, conditions, multi-level escalation, templates | Rebuilt |
| Configuration checks | None | Rule checker shared by API and web | New |
| Data model core | organisations (1 per tenant), plants, departments, locations | organisations, legal_entities, departments, plants, places, accounts, people, assignments, roles, engagements, workflow_versions, lineage | Rebuilt |
| API modules (23) | — | 8 rewritten (organisation, workforce, auth, approval, master data, billing, platform, dashboards); the rest adapted to legal entity and plant scope | Mixed |
| Mail | One platform server | Per legal entity and organisation, SSRF-safe, encrypted credentials, fallback | Changed |
| Sensitive data | Not encrypted at field level | Per-tenant data keys under a managed master key; one personal-data service | New |
| Files | One bucket, presigned URLs | Tenant and legal-entity prefixes, 5-minute URLs after permission checks, sensitive photos encrypted | Changed |
| Offline store | Plain SQLite response cache and queue, not tied to account or tenant | Encrypted, partitioned by account and tenant, wiped on sign-out, tenant-tagged queue | Rebuilt |
| Database | v1 migrations | Reset; new migrations; demo re-seed | Reset |
| Kept as is | — | Design system, component kits, file storage service, job queue, deployment | Kept |

---

## Appendix A: v1 → v2 role mapping
| v1 | v2 |
|---|---|
| platform-admin | Platform admin |
| tenant-owner | Organisation admin (TENANT_ORG_ADMIN) |
| tenant-admin | Legal-entity admin (LEGAL_ORG_ADMIN) of each legal entity they administer |
| job-issuer | Permit coordinator |
| operator (job executor adding site details) | Permit receiver |
| operator (crew member) | Permit executor |
| hod (and supervisor) | Permit approver |
| safety-officer | Safety officer |
| viewer | Per-permit viewer list |

## Appendix B: Notes2 traceability
| Notes2 section | Covered in |
|---|---|
| Organisation; goals and business processes | §2.1, §2.2 |
| Legal entities and departments | §3 (FR-LE, FR-PLC-001), D11 |
| Plants, resources and workflow | §3 (FR-PLC), FR-PPL-002, §8.1 |
| Business processes and workflow | §2.1, §8 |
| Human resources and skills | FR-PPL-003, FR-ROL-009, §12, FR-CRW-003, FR-CRW-011 |
| Agencies and contract work | §4, §10.3, FR-PTW-013 |
| Tenant organisation | FR-ORG-001, §2.1, §8.1 |
| Tenant organisation onboarding | §6.1, §7, §14 |
| Setting up organisation | FR-ONB-005, §14 |
| Setting up legal entity | FR-ONB-006, FR-ONB-011, UX-002, FR-LE-003, FR-ONB-014 |
| Setting up human resources and agencies | FR-PPL, FR-ONB-009, FR-ONB-010, §4 |
| Setting up roles and responsibilities | §5, §9.2 |
| Setting up customised workflow | §8, §9 |
| Setting up plant, equipment, LOTOTO and SIMOPS | FR-PLC-003, 004, 006, §11.1, FR-SIM-101 |
| Tenant agencies; setting up agency | §4, FR-ONB-004, FR-ONB-008 |

## Appendix C: Decision log
| # | Decision |
|---|---|
| D1 | Agencies are their own tenants linked to clients by engagements. |
| D2 | Coordinator raises and issues; receiver is the crew side (crew lead or agency supervisor); executor is crew; approver was HOD. |
| D3 | Workflows: platform default → organisation standard → legal-entity workflow → permit-type variants; no plant overrides. |
| D4 | Fresh build in the same codebase; database reset; no migration. |
| D5 | No language model in v2; self-analysis is rule checks that block go-live. |
| D6 | Steps find people by role and place; escalation to a role or named person; HR reporting line is information only. |
| D7 | Personal and health data collected with safeguards: lawful basis, consent where needed, encryption, emergency subset, access log and retention (refined by review: §12). |
| D8 | Organisations pay per plant; agencies free. |
| D9 | Lists: industry library → organisation standard → legal-entity copy, with reviewable updates. |
| D10 | Daily crew check-in in the app; substitutes checked and accepted; expired certificates block. |
| D11 | Legal-entity tree for reporting only; configuration comes from the organisation standard. |
| D12 | Mobile for field work; setup, designer, lists and billing on web. |
| D13 | English only, translation-ready; plant time zones; metric; one currency per organisation (exception: privacy notice and consent translations). |
| D14 | Slug shows branded sign-in; home is the person's work queue. |
| D15 | PTW-only scope; identity documents on people; SIMOPS rules editable per legal entity. |
| D16 | Shared database with row-level security; Keycloak Organizations; roles in the application database. |
| D17 | Own step-based workflow engine with fixed step types, versions and dry run. |
| D18–D23 | Design sections 1–6 approved as written into §3–§19 and §23. |
| D24 | Owner accepted the v1 rules carried over, the self-review safety rules and the detail defaults in v0.1. |
| D27 | NI-04 decided: admins cannot close or otherwise act on a permit; they can only reassign steps (FR-ROL-007). |
| D28 | Post-incident emergency access covers crew checked in on the day of the incident and anyone on the permit recorded as involved in the incident (FR-PRV-006). |
| D30 | Owner approved PRD v0.4 as the basis for the implementation plan (2026-10-04). |
| D31 | Approved by the owner on 2026-10-04 (v0.5). The sign-in identity is separate from optional contact details. It relies on employment and never on consent. Withdrawing contact consent deletes optional contact details only, and never unlinks the account or removes tenant access, roles or permit duties (FR-PPL-003, FR-PPL-005, FR-ONB-010, FR-PRV-001, FR-PRV-002, criterion 5). Counsel confirms the basis (R4). |

## Appendix D: Review outcome
Three independent reviewers (PTW domain and process safety; architecture, security and privacy; UX, operations and delivery) raised 45 findings (16 blocker, 26 major, 3 minor). In a cross-vote, every finding had the agreement of all three reviewers, and all were applied in v0.2. Overlapping findings were merged in 11 clusters; two base-text choices were decided 2 to 1 (escalation default; agency users working from their own tenant, with the dissent recorded as R7). The full tally is in `.planning/2026-10-03-prd-restructure/review-log.md`.

A follow-up review of v0.2 found 9 interaction defects (6 high, 3 medium). The same three reviewers voted on the corrections (all 9 agreed 3 of 3) and on 31 consolidated amendments (30 agreed 3 of 3; one, the post-incident window in FR-PRV-006, 2 to 1; the owner then widened it to people recorded as involved, D28). The two either/or choices were decided 3 to 0: check-in follows daily revalidation per action, and an unissued agency permit returns to Raise keeping its holds. v0.3 applies all of them.

An independent review of v0.3 found 3 more defects (an offline hold the server cannot see, expiry not enforced for Issued and Suspended permits, and no path for queued agency actions after access ends). The three corrections were agreed 3 of 3, with amendments, and v0.4 applies them. Risk R8 is resolved by FR-LTO-103.

The Phase 1a plan reviews (third round, 2026-10-04) found that FR-PPL-005 tied crew-only status to having no email. Deleting contact details after a consent withdrawal would then have unlinked the account and removed the person's tenant access and permit duties, contradicting FR-PRV-002. Both reviewers recommended separating the sign-in identity from optional contact details, and v0.5 does that (D31, approved by the owner on 2026-10-04).
