# PRODUCT REQUIREMENTS DOCUMENT (PRD)

## 1. Introduction

### 1.1 Purpose
The purpose of this Product Requirements Document (PRD) is to define the functional requirements, operational capabilities and business expectations of the cloud-based Software-as-a-Service (SaaS) Permit-to-Work (PTW) platform.

This document serves as the primary reference for stakeholders involved in the planning, design, development, testing and deployment of the platform. It establishes a common understanding of the product's expected functionality by describing the features, modules, workflows and user interactions required to support the safe planning, authorization, execution and monitoring of hazardous work.

The PRD focuses on **what the product must deliver** from a functional and business perspective. It does not define technical implementation decisions such as architecture, database schema, APIs or technology stack, which are documented separately.

### 1.2 Product Scope
The Permit-to-Work platform is an enterprise cloud-based SaaS application developed to digitize and centralize hazardous work management across industrial organizations. It replaces paper-based permits and disconnected software systems with a single integrated platform capable of managing the complete lifecycle of hazardous work.

The platform combines organization administration, workforce management, Permit-to-Work, Lock Out Tag Out (LOTOTO), Simultaneous Operations (SIMOPS), incident management, dashboards, reporting, notifications and subscription management within a unified operational environment.

Designed around a secure multi-tenant architecture, the platform enables multiple organizations to operate independently while sharing the same cloud infrastructure. Every organization is able to configure its operational hierarchy, approval workflows, permit templates, user responsibilities, safety procedures and organizational settings without modifying the core application.

The platform supports both web and mobile applications, allowing office personnel and field workers to perform their responsibilities from any operational location.

### 1.3 Intended Audience
This document is intended for all stakeholders involved in the product lifecycle, including:

- Product Managers responsible for product planning and feature definition.
- Business Analysts responsible for validating operational requirements.
- Software Architects responsible for translating requirements into technical solutions.
- Developers implementing platform functionality.
- Quality Assurance Engineers responsible for testing and verification.
- UI/UX Designers responsible for designing user experiences.
- Project Managers coordinating product delivery.
- Client stakeholders responsible for validating business requirements.

### 1.4 Assumptions and Constraints
The following assumptions apply throughout this document:

- The platform operates as a cloud-hosted Software-as-a-Service (SaaS) application.
- Multiple organizations operate independently within the same cloud infrastructure through logical tenant isolation.
- Each organization independently configures its operational hierarchy, permit workflows and organizational settings.
- All users authenticate using individual user accounts.
- Web and mobile applications provide access to the same operational workflows.
- Technical implementation details are outside the scope of this document.


## 2. Product Overview

### 2.1 Business Context
Industrial organizations perform numerous maintenance, inspection, repair and construction activities that involve hazardous equipment, high-risk environments and strict operational procedures. These activities require careful planning, coordinated execution and formal authorization to ensure personnel safety, equipment protection and regulatory compliance.

Traditional Permit-to-Work processes often rely on paper documentation or fragmented digital systems that make collaboration difficult, delay approvals and reduce operational visibility. As organizations grow across multiple departments and facilities, maintaining consistency, accountability and traceability becomes increasingly challenging.

The Permit-to-Work platform addresses these challenges by providing a centralized operational environment where every stage of hazardous work can be managed digitally. Rather than functioning as a standalone permit application, the platform connects people, processes and operational data within a unified workflow that improves communication, increases transparency and strengthens workplace safety.

### 2.2 Product Objectives
The platform has been designed to achieve the following objectives:

- Digitize the complete Permit-to-Work lifecycle.
- Improve workplace safety through standardized operational workflows.
- Reduce manual paperwork and administrative overhead.
- Shorten permit approval cycles.
- Improve communication between departments involved in hazardous work.
- Increase operational visibility across ongoing activities.
- Support configurable business processes without software customization.
- Maintain complete accountability through comprehensive audit history.
- Provide role-specific dashboards and operational analytics.
- Enable organizations to manage hazardous work through a single integrated platform.

### 2.3 Core Product Capabilities
The platform provides the following integrated capabilities:

**Organization Administration**
Management of organizational hierarchy, departments, locations, workstations, machinery, users and operational configuration.

**Workforce Management**
Administration of employees, contractors, agencies, user accounts and organizational responsibilities.

**Permit-to-Work Management**
Digital management of hazardous work permits from creation through approval, execution, monitoring and closure.

**Lock Out Tag Out (LOTOTO)**
Machine-specific energy isolation procedures with sequential verification, evidence capture and restoration.

**Simultaneous Operations (SIMOPS)**
Automatic identification and management of operational conflicts caused by overlapping hazardous work activities.

**Multi-Day Permit Management**
Support for hazardous work extending across multiple operational days through daily progress tracking and safety revalidation.

**Incident Management**
Recording, investigation and resolution of incidents, unsafe conditions and near misses.

**Notifications**
Automated communication of operational events including approvals, rejections, safety inspections, incidents and permit expiry.

**Dashboards and Reporting**
Role-specific dashboards supported by operational reports and analytical insights into permit activity, safety performance and organizational trends.

**Billing and Subscription Management**
Administration of organizational subscriptions, module enablement and platform usage.

### 2.4 Design Principles
The platform has been designed around the following principles:

**Safety First**
Operational workflows prioritize workplace safety before productivity by ensuring hazardous work cannot proceed until mandatory safety requirements have been satisfied.

**Configurability**
Organizations should configure the platform to reflect their existing operational procedures rather than modifying established business practices to accommodate software limitations.

**Accountability**
Every operational activity, approval, inspection and decision is associated with an authenticated user, creating clear ownership and responsibility throughout the permit lifecycle.

**Traceability**
Permits, personnel, machinery, locations, inspections, incidents and supporting evidence remain connected throughout execution, providing complete operational history for auditing and compliance.

**Modularity**
The platform is organized into functional modules that operate together as a unified solution while remaining independently configurable according to organizational requirements.

**Operational Visibility**
Real-time dashboards, reporting and notifications provide stakeholders with continuous visibility into permit activity, work progress, operational risks and safety performance.


## 3. Stakeholders & User Roles

The platform supports multiple user groups that collectively participate in the planning, approval, execution, monitoring and completion of hazardous work. Every user is assigned one or more organizational roles that determine their responsibilities and level of access within the system. Access is governed through Role-Based Access Control (RBAC), ensuring users interact only with information and actions relevant to their responsibilities.

### 3.1 System Administrator

**Role Purpose**
The System Administrator is responsible for establishing and maintaining the organization's operational environment. This role oversees the platform configuration, organizational hierarchy, workforce administration and subscription management while ensuring that the system accurately reflects the organization's operational structure and safety policies.

Unlike operational roles, the Administrator does not participate in the approval or execution of permits. Instead, the role focuses on configuring and maintaining the platform so that operational workflows can function correctly.

**Primary Responsibilities**
The System Administrator is responsible for:
- Configuring organizational information.
- Managing plants, departments and operational locations.
- Registering workstations and machinery.
- Managing employee, contractor and agency records.
- Creating and maintaining user accounts.
- Assigning organizational roles and responsibilities.
- Configuring permit templates.
- Defining approval workflows.
- Maintaining master data.
- Configuring safety checklists and PPE requirements.
- Monitoring subscription usage.
- Managing platform modules.
- Reviewing audit logs and organization-wide reports.

**Platform Interaction**
The Administrator primarily interacts with configuration and administration modules rather than day-to-day operational workflows.

**Success Criteria**
The Administrator successfully fulfills the role when:
- Organizational data remains accurate.
- Users have appropriate access.
- Operational workflows function without configuration issues.
- Master data remains up to date.
- Organizations can operate without administrative bottlenecks.

**Authority Boundaries**
- Master data, user/role management, system config, SLA/escalation-timer config, user activation/deactivation
- **Explicitly Cannot:** Participate in any live approval or execution workflow — read-only visibility into permit stages, for audit/compliance/troubleshooting only.

### 3.2 Job Issuer

**Role Purpose**
The Job Issuer initiates hazardous work by creating Permit-to-Work requests. This role is responsible for ensuring that all operational, safety and scheduling information required for permit approval is complete before submission.

The Job Issuer acts as the primary coordinator between maintenance teams, safety personnel and departmental management throughout the permit lifecycle.

**Primary Responsibilities**
The Job Issuer is responsible for:
- Creating permit requests.
- Defining the scope of work.
- Selecting permit types.
- Identifying work locations.
- Selecting machinery involved.
- Assigning permit executors.
- Recording hazards.
- Identifying required PPE.
- Uploading supporting documents.
- Submitting permits for approval.
- Monitoring approval progress.
- Responding to rejected permits.
- Requesting permit extensions when necessary.

**Platform Interaction**
The Job Issuer primarily interacts with:
- Permit Management
- Notifications
- Dashboard
- Reporting

**Success Criteria**
The Job Issuer successfully fulfills the role when:
- Permits are submitted accurately.
- Approval delays are minimized.
- Work begins without unnecessary administrative delays.
- Permit rejection rates remain low.

**Authority Boundaries**
- No independent approve/reject authority for the permit itself.
- Creates permits; approves/rejects **daily progress reports** and **worker check-outs** during execution; gives final **task-completion** approval (distinct from permit closure); initiates renewal.
- **Explicitly Cannot:** Cannot approve/reject the permit itself at creation (HOD's authority); cannot give final closure sign-off (HOD's authority).

### 3.3 Job Executor

**Role Purpose**
The Job Executor performs the hazardous work authorized through the Permit-to-Work process. This role represents field personnel responsible for executing maintenance, repair or construction activities while complying with all approved safety procedures.

**Primary Responsibilities**
The Job Executor is responsible for:
- Reviewing assigned permits.
- Performing approved work.
- Executing LOTOTO procedures.
- Recording daily work progress.
- Uploading photographs and supporting evidence.
- Reporting delays.
- Recording unsafe conditions.
- Reporting incidents.
- Requesting work completion.

**Platform Interaction**
The Job Executor primarily interacts with:
- Assigned Permits
- LOTOTO
- Daily Progress
- Incident Reporting
- Notifications

**Success Criteria**
The Job Executor successfully fulfills the role when:
- Assigned work is completed safely.
- Progress updates remain current.
- Required evidence is uploaded.
- Safety procedures are consistently followed.

**Authority Boundaries**
- No sign-off authority. 
- Enters worker/machinery details at creation; performs physical LOTOTO isolation/de-isolation with photo evidence; logs progress; raises near-miss/accident reports; requests pauses.
- **Explicitly Cannot:** Edits and logs feed into Issuer/HOD approvals — executor cannot independently close or approve anything.

### 3.4 Supervisor

**Role Purpose**
The Supervisor provides operational oversight during hazardous work execution. This role ensures that work is progressing according to approved procedures while coordinating field activities between maintenance personnel and operational departments.

**Primary Responsibilities**
The Supervisor is responsible for:
- Monitoring ongoing work.
- Coordinating field operations.
- Reviewing operational progress.
- Assisting with issue resolution.
- Ensuring adherence to approved procedures.
- Supporting communication between operational teams.

**Platform Interaction**
The Supervisor primarily interacts with:
- Operational Dashboards
- Permit Monitoring
- Work Progress
- Notifications

**Success Criteria**
The Supervisor successfully fulfills the role when:
- Work progresses according to schedule.
- Operational issues are resolved promptly.
- Communication between teams remains effective.

**Authority Boundaries**
- No independent authority. 
- Delegated day-to-day oversight of Executor team; may **co-sign** checklists (LOTOTO, daily progress) as a secondary verification layer.
- **Explicitly Cannot:** Every action is in support of an Issuer/HOD/Safety Officer decision — a Supervisor co-sign is corroborating evidence, not a substitute approval.

### 3.5 Safety Officer

**Role Purpose**
The Safety Officer ensures that hazardous work complies with organizational safety requirements before, during and after execution. This role acts as the primary guardian of workplace safety throughout the permit lifecycle.

**Primary Responsibilities**
The Safety Officer is responsible for:
- Reviewing permit requests.
- Conducting worksite inspections.
- Verifying hazards.
- Confirming PPE requirements.
- Approving LOTOTO procedures.
- Performing safety verification.
- Reviewing supporting evidence.
- Recording incidents.
- Investigating unsafe conditions.
- Performing completion inspections.

**Platform Interaction**
The Safety Officer primarily interacts with:
- Permit Management
- LOTOTO
- SIMOPS
- Incident Management
- Dashboards
- Reporting

**Success Criteria**
The Safety Officer successfully fulfills the role when:
- Safety compliance remains high.
- Hazard identification is accurate.
- LOTOTO verification is completed correctly.
- Incidents are recorded and investigated promptly.

**Authority Boundaries**
- **Yes — independent gate, can override HOD.**
- Site-readiness review after HOD's initial approval: barricading, signage, ventilation, fire safety, general hazards, PPE compliance, pre-work LOTOTO checklist.
- **Explicitly Cannot:** N/A (A Safety Officer rejection cancels the permit **even if HOD already approved it** — this is not a conflict, it's by design).

### 3.6 Head of Department (HOD)

**Role Purpose**
The Head of Department provides departmental authorization for hazardous work. This role evaluates operational readiness, authorizes work execution and performs final permit closure after successful completion.

The HOD represents the final decision-making authority within the permit approval workflow.

**Primary Responsibilities**
The Head of Department is responsible for:
- Reviewing permit requests.
- Evaluating operational risks.
- Approving or rejecting hazardous work.
- Authorizing permit extensions.
- Resolving escalated issues.
- Reviewing completed work.
- Closing permits.

**Platform Interaction**
The Head of Department primarily interacts with:
- Permit Approvals
- Department Dashboards
- SIMOPS
- Reports
- Notifications

**Success Criteria**
The Head of Department successfully fulfills the role when:
- Work is authorized appropriately.
- Departmental operations remain uninterrupted.
- Safety risks are minimized.
- Permits are closed in a timely manner.

**Authority Boundaries**
- **Yes — two distinct gates.**
- (1) Initial review: risk factor, manpower adequacy, task priority — approve/reject/resend; (2) decision authority on near-miss escalations (continue/stop) and accidents (terminate/cancel/revoke); (3) final closure sign-off after Issuer's task-completion approval; (4) renewal approval.

### 3.7 Role Authority Enforcement Rules
- **FR-ROL-001** The platform shall enforce that HOD initial-review approval and HOD final-closure approval are recorded as two distinct, separately timestamped decisions on the permit's audit history, even though both are performed by the same role.
- **FR-ROL-002** The platform shall allow a Safety Officer rejection to cancel a permit regardless of its current approval state, provided the permit has not yet reached "Closed." This is a hard override, not routed through a re-review queue.
- **FR-ROL-003** Administrator accounts shall be technically prevented (not just UI-hidden) from taking approve/reject/close actions on any permit — enforced by role-permission checks at the API layer, since Administrators are the role most likely to also hold elevated system access, making this an easy control to accidentally bypass.
- **FR-ROL-004** Supervisor co-signatures shall be stored as a separate audit record linked to (not overwriting) the Executor's own entry, so that discrepancies between a Supervisor's co-sign and an Executor's original entry remain visible rather than silently reconciled.


## 4. Product Modules

The Permit-to-Work platform consists of multiple integrated modules that together manage the complete lifecycle of hazardous work. Although each module performs a distinct operational function, all modules operate within a unified environment, sharing organizational data, user information, audit history and reporting capabilities.

The modular architecture allows organizations to configure platform functionality according to operational requirements while maintaining a consistent user experience across all areas of the application.

### 4.1 Organization Management
**Purpose**
Organization Management establishes the operational structure of every organization using the platform.

This module enables administrators to configure plants, departments, locations, workstations, machinery and organization-specific settings before operational activities begin.

**Objectives**
- Support organization onboarding.
- Maintain organizational hierarchy.
- Configure operational settings.
- Support organization-specific workflows.
- Provide centralized administration.

**Primary Features**
- Organization registration
- Plant management
- Department management
- Location management
- Workstation management
- Machinery management
- Organizational configuration
- Branding
- Workflow configuration

**Primary Users**
- Administrator

### 4.2 Workforce Management
**Purpose**
The Workforce Management module manages every individual interacting with the platform, including employees, contractors and external agencies.

**Objectives**
- Centralize workforce information.
- Manage user accounts.
- Assign organizational responsibilities.
- Maintain contractor information.
- Support secure authentication.

**Primary Features**
- Employee management
- Contractor management
- Agency management
- User accounts
- Role assignment
- Competency records
- Certification tracking

**Primary Users**
- Administrator

### 4.3 Master Data Management
**Purpose**
The Master Data Management module provides centralized operational reference information shared throughout the platform.

**Objectives**
- Eliminate duplicate operational data.
- Standardize organizational configuration.
- Improve consistency across permits.
- Simplify administration.

**Primary Features**
- Permit types
- PPE catalogues
- Hazard categories
- Safety checklists
- Energy sources
- Machinery catalogues
- Workstation catalogue

**Primary Users**
- Administrator

### 4.4 Permit-to-Work Management
**Purpose**
Permit-to-Work Management serves as the core operational module of the platform, coordinating every stage of hazardous work from initiation through completion.

**Objectives**
- Digitize hazardous work authorization.
- Improve approval efficiency.
- Reduce administrative effort.
- Improve permit visibility.
- Maintain operational traceability.

**Primary Features**
- Permit creation
- Permit approval
- Permit execution
- Permit monitoring
- Permit extension
- Permit renewal
- Permit closure
- Audit history

**Primary Users**
- Job Issuer
- Safety Officer
- HOD
- Job Executor

### 4.5 Lock Out Tag Out (LOTOTO)
**Purpose**
The Lock Out Tag Out (LOTOTO) module manages the safe isolation and restoration of hazardous energy sources associated with maintenance and operational activities. It ensures that equipment is placed into a verified safe state before work begins and is only returned to service after all work has been completed.

The module is tightly integrated with the Permit-to-Work process, ensuring that required isolation activities become an integral part of the overall permit lifecycle rather than a separate administrative process.

**Objectives**
- Prevent accidental equipment energization.
- Standardize energy isolation procedures.
- Improve safety compliance during maintenance.
- Digitally record isolation activities.
- Maintain complete execution history.

**Primary Features**
- Workstation and machine-specific LOTOTO records.
- Multiple energy source management.
- Step-by-step isolation procedures.
- Sequential lock and unlock workflows.
- Try-out verification.
- Evidence capture for critical activities.
- Restoration verification.
- Complete execution history linked to permits.

**Primary Users**
- Job Executor
- Safety Officer
- Supervisor

### 4.6 Simultaneous Operations (SIMOPS)
**Purpose**
The SIMOPS module identifies hazardous interactions between multiple work activities occurring within the same operational area during overlapping time periods.

Rather than relying on manual coordination, the module continuously evaluates permit schedules and work locations to detect operational conflicts before work begins.

**Objectives**
- Improve operational coordination.
- Reduce risks caused by overlapping hazardous work.
- Increase visibility across departments.
- Support safer planning decisions.

**Primary Features**
- Automatic conflict detection.
- Location-based comparison.
- Schedule overlap analysis.
- Hazard comparison.
- Conflict notifications.
- Conflict review and resolution.
- Operational visibility through dashboards.

**Primary Users**
- Safety Officer
- Head of Department
- Job Issuer

### 4.7 Multi-Day Permit Management
**Purpose**
Some maintenance and construction activities cannot be completed within a single operational shift. The Multi-Day Permit module supports long-duration work while ensuring that safety conditions are reassessed before work resumes each day.

**Objectives**
- Support long-duration hazardous work.
- Maintain daily operational visibility.
- Ensure continued safety verification.
- Record daily execution history.

**Primary Features**
- Daily progress updates.
- Daily safety revalidation.
- Progress tracking.
- Daily evidence upload.
- Work continuation approval.
- Historical progress records.

**Primary Users**
- Job Executor
- Safety Officer
- Job Issuer
- HOD

### 4.8 Incident Management
**Purpose**
The Incident Management module enables organizations to record, investigate and resolve operational incidents, unsafe conditions and near misses occurring during hazardous work.

The module contributes to continuous safety improvement by ensuring every event is documented, investigated and linked to relevant operational activities where applicable.

**Objectives**
- Improve incident reporting.
- Standardize investigations.
- Record corrective actions.
- Improve organizational learning.
- Support compliance reporting.

**Primary Features**
- Incident reporting.
- Near miss reporting.
- Unsafe condition reporting.
- Investigation records.
- Corrective actions.
- Evidence management.
- Incident closure.
- Historical reporting.

**Primary Users**
- Safety Officer
- Job Executor
- Supervisor
- HOD

### 4.9 Notification Management
**Purpose**
The Notification module provides timely communication throughout the Permit-to-Work lifecycle by automatically informing stakeholders of operational events requiring attention.

Rather than requiring users to manually monitor permit progress, the system proactively communicates significant workflow changes.

**Objectives**
- Reduce approval delays.
- Improve communication.
- Increase operational awareness.
- Ensure timely response to safety events.

**Primary Features**
- Permit notifications.
- Approval alerts.
- Rejection alerts.
- Permit expiry reminders.
- SIMOPS conflict alerts.
- LOTOTO notifications.
- Incident notifications.
- Daily revalidation reminders.
- Subscription reminders.

**Primary Users**
All platform users.

### 4.10 Dashboards & Analytics
**Purpose**
The Dashboards and Analytics module provides operational insight into ongoing work, organizational performance and safety compliance through role-specific dashboards and analytical reports.

**Objectives**
- Improve operational visibility.
- Support informed decision-making.
- Monitor organizational performance.
- Identify operational trends.
- Measure safety compliance.

**Primary Features**
- Role-specific dashboards.
- Permit summaries.
- Approval monitoring.
- Incident statistics.
- SIMOPS reporting.
- LOTOTO compliance.
- Operational analytics.
- Exportable reports.

**Primary Users**
All platform users according to role.

### 4.11 Billing & Subscription Management
**Purpose**
The Billing and Subscription module supports the commercial operation of the SaaS platform by managing organizational subscriptions, enabled modules and platform usage.

**Objectives**
- Manage subscriptions.
- Control module availability.
- Monitor platform usage.
- Support subscription renewals.

**Primary Features**
- Subscription plans.
- Module enablement.
- Usage monitoring.
- Renewal tracking.
- Billing history.
- Organization licensing.

**Primary Users**
- Administrator


## 5. Functional Requirements

This section defines the functional capabilities that the platform shall provide. Requirements are organized according to their respective functional modules and represent the expected behaviour of the system from a business perspective.

### 5.1 Organization Management

**Organization Registration**
- **FR-ORG-001** The platform shall allow new organizations to register and create independent tenant environments.
- **FR-ORG-002** Each organization shall maintain complete isolation of operational data from every other organization.

**Organizational Hierarchy**
- **FR-ORG-003** The platform shall allow administrators to create and manage plants.
- **FR-ORG-004** The platform shall allow departments to be associated with individual plants.
- **FR-ORG-005** Departments shall contain one or more operational locations.
- **FR-ORG-006** Locations shall contain one or more workstations or machines.

**Organization Configuration**
- **FR-ORG-007** Organizations shall configure approval workflows.
- **FR-ORG-008** Organizations shall configure permit templates.
- **FR-ORG-009** Organizations shall configure safety checklists.
- **FR-ORG-010** Organizations shall configure required PPE.
- **FR-ORG-011** Organizations shall configure notification preferences.

### 5.2 Workforce Management

**User Administration**
- **FR-WFM-001** The platform shall support employee registration.
- **FR-WFM-002** The platform shall support contractor registration.
- **FR-WFM-003** Contractors shall be associated with external agencies where applicable.
- **FR-WFM-004** The platform shall support role assignment for every user.
- **FR-WFM-005** A user may hold one or more organizational responsibilities based on administrative configuration.

**Workforce Records**
- **FR-WFM-006** Employee records shall maintain department assignments.
- **FR-WFM-007** Contractor records shall maintain competency and certification information.
- **FR-WFM-008** The platform shall support activation and deactivation of workforce records.

### 5.3 Master Data Management

**Master Data**
- **FR-MDM-001** The platform shall manage permit types.
- **FR-MDM-002** The platform shall manage PPE catalogues.
- **FR-MDM-003** The platform shall manage machinery.
- **FR-MDM-004** The platform shall manage workstations.
- **FR-MDM-005** The platform shall manage hazard classifications.
- **FR-MDM-006** The platform shall manage safety checklists.
- **FR-MDM-007** The platform shall support bulk import of master data.

### 5.4 Permit-to-Work Management

**Permit Creation**
- **FR-PTW-001** The platform shall allow Job Issuers to create Permit-to-Work requests.
- **FR-PTW-002** Permit requests shall capture all information required to define the planned hazardous work.
- **FR-PTW-003** The platform shall support multiple configurable permit types.

**Permit Approval**
- **FR-PTW-004** The platform shall support configurable approval workflows.
- **FR-PTW-005** Authorized approvers shall approve, reject or defer permits.
- **FR-PTW-006** Approval decisions shall include comments where required.
- **FR-PTW-013** The platform shall allow administrators to define approval workflow templates composed of one or more ordered stages.
- **FR-PTW-014** Each stage shall specify its approver(s) by role and organizational scope (e.g., “Safety Officer — same department as work location”), not by named individual, so templates remain valid as staff change.
- **FR-PTW-015** The platform shall support conditional stages that are automatically included or skipped based on permit attributes (e.g., a LOTOTO stage is auto-included only if the permit involves energy isolation; a senior-management stage is auto-included only if permit risk level = High).
- **FR-PTW-016** The platform shall support parallel stages with configurable quorum (all-must-approve vs. first-response-wins).
- **FR-PTW-017** Each permit type shall carry a configurable risk classification (e.g., Low / Medium / High) derived from hazard selection, PPE requirements, and work type.
- **FR-PTW-018** Approval templates shall support risk-based branching — e.g., High-risk permits require an additional HOD-level or cross-department review stage that Medium/Low-risk permits skip.
- **FR-PTW-019** Each approval stage shall have a configurable response SLA (e.g., 2 hours, 1 business day).
- **FR-PTW-020** If an approver does not respond within the SLA, the platform shall automatically escalate to a configured fallback (e.g., the approver's manager, or any other user holding the same role in the department).
- **FR-PTW-021** Escalation shall trigger a notification distinct from the original approval request, flagged as time-sensitive.
- **FR-PTW-022** The number of escalation levels and the fallback chain shall be configurable per workflow template, with a maximum of 3 escalation levels before the permit is automatically flagged to the Administrator as blocked.
- **FR-PTW-023** The platform shall support designation of a temporary delegate by any approver, valid for a defined date range, with the delegation itself recorded in audit history and visible to auditors as “approved by X on behalf of Y.”
- **FR-PTW-024** A rejected permit shall return to the Job Issuer with a mandatory comment explaining the rejection reason (free text plus a structured reason-code dropdown, e.g., “Incomplete hazard information,” “PPE mismatch,” “Scheduling conflict”).
- **FR-PTW-025** A deferred permit shall remain pending with the same approver but shall not count against that approver's SLA clock until the deferral condition (e.g., “pending additional documentation”) is resolved by the Job Issuer.
- **FR-PTW-026** A resubmitted permit (after rejection) shall restart the approval workflow from Stage 1 by default, but administrators may configure specific permit types to resume from the stage that rejected it, if only minor edits are required.
- **FR-PTW-027** Any edit to core scope-of-work fields (hazards, machinery, PPE, location) after Stage 1 approval shall automatically invalidate all subsequent approvals and restart the workflow. Edits to administrative fields only (e.g., contact phone number) shall not.
- **FR-PTW-028** Any single rejection within a parallel stage shall reject the stage as a whole and return the permit to the Job Issuer; a partial approval state shall not be treated as ambiguous — reject takes precedence over approve.
- **FR-PTW-029** Where two stages are sequential rather than parallel (as in the default HOD → Safety Officer template), a later-stage rejection shall override an earlier-stage approval — e.g., the Safety Officer can reject a permit at the site-readiness gate even though HOD already approved it at the initial review gate. This is a general principle that downstream gates always retain veto power over upstream approvals.
- **FR-PTW-030** The platform shall enforce that state transitions only occur through the paths defined below; no direct transition (e.g., Draft → Active) shall be permitted through any interface, including administrative tools, without passing through the required approval states.
  - Draft: Being composed by Job Issuer -> Submitted
  - Submitted: Entered Stage 1 -> Under Review, Rejected
  - Under Review: At an intermediate stage -> Under Review (next stage), Approved, Rejected, Deferred
  - Deferred: Awaiting additional info -> Under Review
  - Rejected: Returned to Job Issuer -> Draft (resubmission)
  - Approved: All stages cleared -> Active (post-LOTOTO if required)
  - Active: Work in progress -> Pending Closure, Suspended (incident)
  - Pending Closure: Awaiting HOD sign-off -> Closed
  - Closed: Terminal -> — (Archived)
  - Expired: SLA/validity window lapsed without closure -> Draft (renewal)

**Permit Execution**
- **FR-PTW-007** Approved permits shall be assigned for execution.
- **FR-PTW-008** Permit execution shall support work progress updates.
- **FR-PTW-009** Supporting evidence shall be uploadable throughout execution.

**Permit Completion**
- **FR-PTW-010** Completed work shall undergo safety verification prior to closure.
- **FR-PTW-011** Authorized personnel shall perform final permit closure.
- **FR-PTW-012** Completed permits shall remain available for reporting and auditing.

### 5.5 Lock Out Tag Out (LOTOTO)

**Module Overview**
The LOTOTO module manages the safe isolation of hazardous energy sources before work begins and the controlled restoration of equipment after work has been completed. The module operates as an extension of the Permit-to-Work process and ensures that hazardous work cannot commence until all required isolation procedures have been successfully completed and verified.

**LOTOTO Record Management**
- **FR-LTO-001** The platform shall allow the creation of one or more LOTOTO records associated with a Permit-to-Work.
- **FR-LTO-002** Each LOTOTO record shall be linked to a specific workstation or machine.
- **FR-LTO-003** The platform shall support multiple LOTOTO records within a single permit where multiple machines or energy sources are involved.

**Energy Isolation**
- **FR-LTO-004** The platform shall allow users to define all energy sources associated with a machine or workstation.
- **FR-LTO-005** The platform shall support configurable isolation procedures for different equipment types.
- **FR-LTO-006** The platform shall record the lockout method applied to each energy source.
- **FR-LTO-007** The platform shall support verification of successful energy isolation before work begins.

**Execution**
- **FR-LTO-008** The platform shall guide users through the approved isolation procedure in the defined sequence.
- **FR-LTO-009** The platform shall allow evidence to be attached to isolation activities.
- **FR-LTO-010** The platform shall record the personnel responsible for each isolation activity.
- **FR-LTO-011** The platform shall record timestamps for all isolation activities.

**Restoration**
- **FR-LTO-012** The platform shall support controlled restoration procedures following work completion.
- **FR-LTO-013** The restoration process shall be recorded as part of the permit history.
- **FR-LTO-014** The platform shall maintain a complete execution history for every LOTOTO activity.

### 5.6 Simultaneous Operations (SIMOPS)

**Module Overview**
The SIMOPS module assists organizations in identifying and managing hazardous interactions between multiple work activities occurring within the same operational area during overlapping time periods. The objective is to improve operational coordination and reduce risks associated with concurrent hazardous work.

**Conflict Detection**
- **FR-SIM-001** The platform shall evaluate permits for potential operational conflicts.
- **FR-SIM-002** Conflict evaluation shall consider work location.
- **FR-SIM-003** Conflict evaluation shall consider planned execution schedules.
- **FR-SIM-004** The platform shall identify overlapping hazardous work activities.
- **FR-SIM-011** Location overlap shall be evaluated at the workstation/machine level as the default granularity, not the department or plant level — two permits in the same department but on different machines are not automatically a conflict, unless a hazard-adjacency rule applies.
- **FR-SIM-012** The platform shall support an optional adjacency radius/zone configuration per location, so that organizations can flag machines or workstations as “operationally adjacent” (e.g., shared ventilation, shared electrical bus) even when they are logically distinct records.
- **FR-SIM-013** Schedule overlap shall be evaluated as any intersection between two permits' planned start/end windows, including multi-day permits' full date range, not just their originally submitted dates.
- **FR-SIM-014** The platform shall maintain a configurable hazard-interaction matrix (e.g., Hot Work × Confined Space = High severity conflict; Hot Work × Routine Inspection = Low severity) used to auto-classify detected conflicts by severity.
- **FR-SIM-015** Conflict severity shall determine routing: Low-severity conflicts may be auto-acknowledged by the Job Issuer; Medium/High-severity conflicts shall require Safety Officer or HOD review before either permit may proceed.
- **FR-SIM-016** Conflict evaluation shall run automatically at each of the following trigger points:
  - On permit submission (initial creation)
  - On any edit to location, machinery, schedule, or hazard fields of an existing active/approved permit
  - On permit extension or multi-day continuation
  - On a nightly batch re-evaluation of all upcoming approved-but-not-yet-active permits
- **FR-SIM-017** Newly detected conflicts against an already-approved or already-active permit shall notify both permits' Job Issuers and freeze the newer permit at its current stage until the conflict is resolved; the older permit shall not be retroactively disrupted unless explicitly determined by resolving authority.
- **FR-SIM-021** SIMOPS evaluation shall cross-reference active LOTOTO records; if two permits reference the same energy source, this shall be classified as an automatic High-severity conflict regardless of the hazard-interaction matrix.

**Conflict Management**
- **FR-SIM-005** Detected conflicts shall be presented to the responsible users for review.
- **FR-SIM-006** The platform shall allow authorized personnel to review identified conflicts.
- **FR-SIM-007** Conflict reviews shall become part of the permit history.
- **FR-SIM-008** Resolved conflicts shall remain available for reporting and auditing.
- **FR-SIM-018** Conflict resolution authority defaults to the Safety Officer or HOD of the department where the conflicting activity is occurring; if the two permits belong to different departments, both departments' resolving authorities shall be notified and resolution requires joint acknowledgment.
- **FR-SIM-019** Unresolved cross-department conflicts exceeding a configurable timeout (default 4 hours for High severity) shall auto-escalate to a designated site-level Safety Officer or an Administrator-configured “conflict arbiter” role.
- **FR-SIM-020** Every conflict — detection, severity classification, reviewing parties, and final resolution decision — shall be permanently recorded and linked to both permits' audit histories, independent of which permit is later closed first.

**Notifications**
- **FR-SIM-009** The platform shall notify relevant stakeholders whenever a conflict is detected.
- **FR-SIM-010** The platform shall notify stakeholders when conflict resolution has been completed.

### 5.7 Multi-Day Permit Management

**Module Overview**
The Multi-Day Permit module supports hazardous work extending across multiple operational days while maintaining continuous operational visibility and daily safety verification.

**Daily Progress**
- **FR-MDP-001** The platform shall support daily progress updates for active permits.
- **FR-MDP-002** Daily progress records shall remain associated with the original permit.
- **FR-MDP-003** Users shall record completed work for each execution day.
- **FR-MDP-004** Users shall record pending work where applicable.

**Daily Revalidation & Renewal**
- **FR-MDP-005** The platform shall support daily safety revalidation.
- **FR-MDP-006** Daily observations shall be recorded before work continues.
- **FR-MDP-007** Supporting evidence shall be attachable to daily progress records.
- **FR-MDP-008** Historical progress records shall remain permanently available.
- **FR-MDP-009** The platform shall run a validity check against the permit's approved date range at each day-transition:
  - `> 48 hours remaining` → no action; automatic recheck after 24 hours.
  - `< 48 hours remaining` → Issuer is notified to reapply/renew.
  - `Expired` → renewal flow triggers: template is copied from the original permit, only the fields requiring update are editable (not a full re-creation), sent for HOD approval → Accepted rejoins the active workflow; Rejected terminates as “permit rejected.”

### 5.8 Incident Management

**Module Overview**
The Incident Management module enables organizations to capture, investigate and resolve incidents, near misses and unsafe conditions that occur throughout operational activities.

**Incident Recording**
- **FR-INC-001** The platform shall support incident reporting.
- **FR-INC-002** The platform shall support near miss reporting.
- **FR-INC-003** The platform shall support unsafe condition reporting.
- **FR-INC-004** Incident records may optionally reference permits.
- **FR-INC-011** The platform shall distinguish near-miss events (which route to an HOD continue/stop decision) from accident events (which trigger automatic task termination and permit cancellation) as two structurally different severity paths, not two labels on the same workflow.

**Investigation**
- **FR-INC-005** The platform shall support investigation activities.
- **FR-INC-006** The platform shall record identified causes.
- **FR-INC-007** The platform shall record corrective actions.
- **FR-INC-008** Supporting evidence shall be associated with incident records.

**Closure**
- **FR-INC-009** The platform shall support incident closure.
- **FR-INC-010** Closed incidents shall remain available for reporting and historical analysis.

### 5.9 Notification Management

**Module Overview**
The Notification module communicates operational events requiring user attention throughout the permit lifecycle.

**Functional Requirements**
- **FR-NOT-001** The platform shall notify users when permits are submitted.
- **FR-NOT-002** The platform shall notify users when permits are approved.
- **FR-NOT-003** The platform shall notify users when permits are rejected.
- **FR-NOT-004** The platform shall notify users when permits are deferred.
- **FR-NOT-005** The platform shall notify users before permit expiry.
- **FR-NOT-006** The platform shall notify users when incidents are reported.
- **FR-NOT-007** The platform shall notify users when SIMOPS conflicts are detected.
- **FR-NOT-008** The platform shall notify users regarding LOTOTO verification activities.
- **FR-NOT-009** The platform shall maintain a notification history for each user.

### 5.10 Dashboards & Analytics

**Module Overview**
The Dashboards and Analytics module provides users with operational visibility appropriate to their responsibilities while supporting organizational reporting and performance monitoring.

**Functional Requirements**
- **FR-DAS-001** The platform shall provide role-specific dashboards.
- **FR-DAS-002** Dashboards shall display operational information relevant to the authenticated user.
- **FR-DAS-003** The platform shall support permit reporting.
- **FR-DAS-004** The platform shall support incident reporting.
- **FR-DAS-005** The platform shall support SIMOPS reporting.
- **FR-DAS-006** The platform shall support LOTOTO reporting.
- **FR-DAS-007** The platform shall support organizational analytics.
- **FR-DAS-008** Reports shall support filtering using operational criteria.
- **FR-DAS-009** Reports shall support export for business use.

### 5.11 Billing & Subscription Management

**Module Overview**
The Billing and Subscription module manages commercial access to the SaaS platform by controlling organizational subscriptions and enabled functionality.

**Functional Requirements**
- **FR-BIL-001** The platform shall support organizational subscription plans.
- **FR-BIL-002** The platform shall manage enabled platform modules.
- **FR-BIL-003** The platform shall monitor organizational usage.
- **FR-BIL-004** The platform shall maintain billing history.
- **FR-BIL-005** The platform shall notify administrators regarding subscription renewal.
- **FR-BIL-006** The platform shall allow administrators to view current subscription information.


## 6. Business Workflows

The Permit-to-Work platform supports a structured operational workflow that coordinates multiple users and functional modules throughout the lifecycle of hazardous work. Each workflow is designed to ensure that work progresses through clearly defined stages while maintaining safety, accountability and operational visibility.

### 6.1 Permit Lifecycle Workflow

**Phase 1: Creation**
1. **Issuer** initiates permit creation.
2. **Creator** (may be the same person as Issuer, or a delegated creator role) enters core permit fields: permit type, work description, location/zone, date and time.
3. **HOD is notified** that a permit is being created (early awareness, not yet an approval action).
4. **Executor** completes/enters operational details: worker names, ages, roles, machinery/equipment IDs and details.
5. **SIMOPS check runs automatically:**
   - **Fail:** routed to HOD as an automatic rejection.
   - **Pass:** proceeds to HOD review.

**Phase 2: Approval**
6. **HOD reviews the permit:** risk factor, in-charge details, task priority.
   - **Resend:** returned to Executor to correct/change details (loops back to step 4).
   - **Reject:** permit cancelled, reason logged, terminal for this submission.
   - **Accept:** proceeds to Safety Officer.
7. **Safety Officer reviews site conditions:**
   - **Reject:** permit cancelled, details logged, terminal — even though HOD already approved.
   - **Accept:** proceeds to LOTOTO check.
8. **Is (opening) LOTOTO required?**
   - **Yes:** Executor uploads LOTOTO checklist, photo proof, and locking/unlocking log as evidence before work may begin.
   - **No:** proceeds directly to Execution.

**Phase 3: Execution**
9. **Executor begins work.** A continuous loop runs: progress updates (photo proof, task description with time log) until one of the following interrupts it:
   - **Pause requested:** Issuer is re-notified → work resumes once cleared → loop continues.
   - **Near-miss reported:** HOD notified, decides: Continue (loop resumes) or Stop (incident logged).
   - **Accident reported:** task is automatically terminated → permit cancelled → reports sent to external authorities (accident report: description, personnel involved; permit may be revoked). This path bypasses the Continue/Stop decision entirely.

**Phase 4: Completion & Multi-Day**
10. When the Executor marks the task complete for the day:
    - **More than one day of work remaining?**
      - **Yes:** daily progress report submitted → workers check out → Issuer approves the day's progress → permit updates to the next day → validity check runs.
      - **No (final day):** daily progress report completed → is closing LOTOTO required?
        - **Yes:** Executor uploads closing LOTOTO de-isolation evidence (task completion, LOTOTO verified, area clear) → Issuer approval → HOD approval.
        - **No:** skips directly to Issuer approval → HOD approval.
    - **HOD approval:** Accepted → permit closed. Rejected → permit rejected, sent back (recheck loop).

**Summary State Diagram**
```text
Creation → SIMOPS gate → HOD review ⇄ (Resend) → Safety Officer gate → LOTOTO?
  → Execution loop [Progress / Pause / Near-miss / Accident]
  → Daily close → (multi-day? loop with validity check)
  → Final day → Closing LOTOTO? → Issuer approval → HOD approval → Closed
```

### 6.2 LOTOTO Workflow
Where hazardous energy isolation is required, LOTOTO activities are initiated after permit approval and before work execution. Isolation procedures are performed against the affected workstations or machines, verified by authorized personnel and documented with supporting evidence where required. Once work has been completed, restoration procedures are carried out and recorded before the permit progresses towards closure.

### 6.3 SIMOPS Workflow
Whenever a permit is created or modified, the platform evaluates planned work activities against other active or pending permits. Where overlapping work activities are identified, a SIMOPS conflict is generated for review. Authorized personnel assess the conflict and determine whether work may proceed, requires modification or must be rescheduled before execution begins.

### 6.4 Incident Management Workflow
Incidents, near misses and unsafe conditions may be reported at any stage of the permit lifecycle. Reported incidents undergo investigation, corrective action and closure while remaining linked to associated permits, personnel, machinery and operational locations where applicable.

### 6.5 Reporting Workflow
Operational information collected throughout the platform is consolidated into dashboards and reports that provide visibility into permit activity, LOTOTO compliance, incident trends, approval performance and overall safety metrics. Reports support operational monitoring, management decision-making and regulatory compliance.


## 7. Acceptance Criteria

The product shall be considered functionally complete when it enables organizations to:

- Configure organizational structures, users and operational settings.
- Digitally manage the complete Permit-to-Work lifecycle.
- Perform machine-specific LOTOTO procedures.
- Detect and manage SIMOPS conflicts.
- Support multi-day hazardous work with daily progress tracking.
- Record and investigate incidents and unsafe conditions.
- Deliver automated notifications throughout operational workflows.
- Provide role-specific dashboards and analytical reporting.
- Manage organizational subscriptions and module access.
- Maintain complete auditability and operational traceability across all platform activities.
