# **IMPLEMENTATION PLAN**

# **1\. Introduction**

## **1.1 Purpose**

The purpose of this Implementation Plan is to define the execution strategy for the development and delivery of the cloud-based Software-as-a-Service (SaaS) Permit-to-Work (PTW) platform. It translates the business and functional requirements defined in the Product Requirements Document (PRD) into an actionable development roadmap by organising work into milestones, sprints and implementation activities.

The document provides a structured framework for software engineers, architects, UI/UX designers, quality assurance engineers, DevOps engineers and project managers responsible for delivering the platform. It establishes how each functional requirement will be implemented, the sequence in which features will be developed, the technologies used, the dependencies between work items, and the criteria used to verify successful implementation.

Unlike the PRD, which defines business functionality, this document focuses on implementation planning, engineering execution, requirement traceability and delivery management.

---

## **1.2 Scope**

This Implementation Plan covers the complete implementation of the Permit-to-Work platform across web and mobile applications.

The document includes:

* Project implementation strategy.  
* Development methodology.  
* Technology stack.  
* System implementation architecture.  
* Milestone planning.  
* Sprint planning.  
* Functional requirement allocation.  
* User stories and use cases.  
* Functional implementation criteria.  
* Backend implementation tasks.  
* Frontend implementation tasks.  
* Mobile implementation tasks.  
* Database implementation tasks.  
* Infrastructure implementation tasks.  
* API implementation planning.  
* Security implementation.  
* Quality assurance planning.  
* Positive and negative test cases.  
* Acceptance criteria.  
* Requirement traceability.

Technical implementation details such as database schema definitions, API specifications, class diagrams and sequence diagrams are outside the scope of this document and are addressed separately within the Software Requirements Specification (SRS) and Software Design Document (SDD).

---

## **1.3 Intended Audience**

This document is intended for stakeholders directly involved in the implementation of the platform, including:

* Product Managers responsible for implementation planning and delivery.  
* Solution Architects responsible for technical oversight.  
* Backend Engineers implementing business logic and APIs.  
* Frontend Engineers implementing the web application.  
* Mobile Engineers implementing the React Native application.  
* Database Engineers responsible for PostgreSQL schema design and optimisation.  
* DevOps Engineers responsible for infrastructure, deployment and monitoring.  
* Quality Assurance Engineers responsible for functional verification and testing.  
* UI/UX Designers supporting implementation of user interfaces.  
* Project Managers responsible for sprint planning, dependency management and release coordination.

---

## **1.4 Document Relationship**

This Implementation Plan forms part of the overall project documentation and should be read alongside the associated engineering documents.

| Document | Purpose |
| ----- | ----- |
| Product Requirements Document (PRD) | Defines business objectives, modules, workflows and functional requirements. |
| Implementation Plan | Defines how the product will be implemented and delivered. |
| Software Requirements Specification (SRS) | Defines detailed technical specifications including APIs, database design and architecture. |
| Software Design Document (SDD) | Defines component-level design and implementation patterns. |
| Test Specification | Defines detailed testing procedures and verification activities. |

---

## **1.5 Implementation Objectives**

The implementation of the Permit-to-Work platform aims to achieve the following objectives:

* Deliver all functional requirements defined in the PRD through an incremental milestone-based development approach.  
* Establish a scalable, secure and maintainable enterprise application architecture using modern web and mobile technologies.  
* Deliver production-ready software through iterative sprint-based development.  
* Ensure complete traceability between functional requirements, implementation activities and verification artefacts.  
* Integrate web, mobile and backend platforms into a unified operational environment.  
* Maintain consistent engineering standards across frontend, backend, database and infrastructure components.  
* Ensure all platform functionality satisfies defined acceptance criteria before release.  
* Deliver a production-ready SaaS platform suitable for deployment across multiple tenant organisations.

---

## **1.6 Development Methodology**

Development will follow an Agile methodology using time-boxed sprints grouped into implementation milestones. Each milestone represents a significant functional increment of the platform, while individual sprints deliver cohesive sets of related functionality.

Implementation activities within each sprint will be organised across parallel engineering workstreams, including:

* Backend Development  
* Frontend Development  
* Mobile Development  
* Database Development  
* Infrastructure & DevOps  
* Quality Assurance

Every sprint will conclude only after all allocated functional requirements have been implemented, verified against their acceptance criteria, and validated through the defined test cases.

---

## **1.7 Requirement Traceability Strategy**

To ensure complete implementation traceability, every functional requirement defined in the PRD shall be linked to corresponding implementation artefacts using a standardised identifier structure.

| Artefact | Identifier Format | Example |
| ----- | ----- | ----- |
| Milestone | MS-XX | MS-02 |
| Sprint | SP-XX.XX | SP-02.01 |
| Functional Requirement | FR-XXX-XXX | FR-PTW-001 |
| User Story | US-XXX-XXX | US-PTW-001 |
| Use Case | UC-XXX-XXX | UC-PTW-001 |
| Backend Task | BE-XXX-XXX | BE-PTW-001 |
| Frontend Task | FE-XXX-XXX | FE-PTW-001 |
| Mobile Task | MOB-XXX-XXX | MOB-PTW-001 |
| Database Task | DB-XXX-XXX | DB-PTW-001 |
| API | API-XXX-XXX | API-PTW-001 |
| Test Case | TC-XXX-XXX | TC-PTW-001 |
| Negative Test Case | NTC-XXX-XXX | NTC-PTW-001 |
| Acceptance Criterion | AC-XXX-XXX | AC-PTW-001 |
| Negative Acceptance Criterion | NAC-XXX-XXX | NAC-PTW-001 |

This traceability model enables every functional requirement to be tracked from implementation planning through development, testing and final acceptance.

---

# **2\. Implementation Architecture**

## **2.1 Architecture Overview**

The Permit-to-Work platform will be implemented as a modular, cloud-native Software-as-a-Service (SaaS) application designed to support secure multi-tenant operations across web and mobile platforms. The implementation architecture separates presentation, business logic, data management, identity management, background processing and storage into distinct layers to improve maintainability, scalability and fault isolation.

The platform consists of three primary application layers:

* **Presentation Layer**, comprising the web application developed using Next.js and the mobile application developed using React Native.  
* **Application Layer**, comprising RESTful backend services implemented using NestJS that encapsulate business logic, workflow orchestration and domain services.  
* **Data & Infrastructure Layer**, comprising PostgreSQL, Redis, BullMQ, MinIO, Keycloak and monitoring services that collectively provide persistence, caching, background processing, object storage, authentication and observability.

Each layer communicates through clearly defined interfaces to minimise coupling between components and allow independent evolution of frontend, backend and infrastructure services.

The architecture has been designed to support future expansion through additional modules, integrations and tenant-specific configuration without requiring fundamental changes to the underlying platform.

---

## **2.2 Architectural Principles**

The implementation shall follow the following architectural principles throughout development.

### **Modular Design**

The platform shall be organised into independent feature modules corresponding to the functional modules defined in the Product Requirements Document. Each module shall encapsulate its own controllers, services, repositories, validation logic and domain models while remaining interoperable with other platform modules.

---

### **Separation of Concerns**

Presentation, business logic, persistence and infrastructure responsibilities shall remain isolated within their respective application layers. Business rules shall reside exclusively within backend services, while frontend and mobile applications shall focus on user interaction and presentation.

---

### **API-First Development**

All operational functionality shall be exposed through versioned REST APIs implemented within NestJS. Both the web application and mobile application shall consume the same API layer to ensure consistent business behaviour across platforms.

---

### **Security by Design**

Authentication and authorisation shall be enforced before access to protected resources. Identity management, role assignment and access control shall be centralised through Keycloak, while application services shall enforce role-based permissions through backend guards and policy validation.

---

### **Offline Capability**

The mobile application shall support offline operation for selected workflows through local SQLite storage. Data created while offline shall synchronise with backend services once network connectivity becomes available.

---

### **Scalability**

Infrastructure components shall be designed to support horizontal application scaling. Stateless backend services, distributed caching and background job processing shall enable the platform to accommodate increasing organisational usage without requiring architectural changes.

---

### **Observability**

Application logging, monitoring and operational metrics shall be integrated into the implementation from the outset to support troubleshooting, performance analysis and production monitoring.

---

## **2.3 Technology Stack**

| Layer | Technology | Purpose |
| ----- | ----- | ----- |
| Web Application | Next.js (React, TypeScript) | Web frontend |
| Mobile Application | React Native | Mobile application |
| Styling | Tailwind CSS | Responsive styling |
| UI Components | Shadcn UI, ui.watermelon.sh | User interface components |
| Animation | Framer Motion | User interaction and transitions |
| Icons | Lucide Icons | Iconography |
| Charts | Recharts | Dashboards and analytics |
| Backend | NestJS | Business logic and REST APIs |
| Language | TypeScript | Shared programming language |
| Database | PostgreSQL | Primary relational database |
| ORM | Drizzle ORM | Database access and migrations |
| Cache | Redis | Caching and temporary data storage |
| Background Processing | BullMQ | Asynchronous job processing |
| Object Storage | MinIO | File and document storage |
| Authentication | Keycloak | Identity and access management |
| Logging | Grafana Loki | Centralised application logging |
| Analytics | Metabase | Reporting and business intelligence |
| Mobile Database | SQLite | Offline mobile persistence |

---

## **2.4 Application Layer Responsibilities**

### **Web Application (Next.js)**

The web application provides the primary interface for administrative users, permit issuers, supervisors, safety officers and department heads. It is responsible for rendering user interfaces, consuming backend APIs, validating client-side input where appropriate and presenting operational data through dashboards, reports and workflow screens.

The web application shall remain stateless, with all business decisions delegated to backend services.

---

### **Mobile Application (React Native)**

The mobile application provides field users with access to operational workflows, including permit execution, LOTOTO procedures, inspections, incident reporting and daily progress updates.

To support environments with intermittent connectivity, the application shall maintain a local SQLite database for offline operation and synchronise locally stored changes with backend services when network access is restored.

---

### **Backend Services (NestJS)**

Backend services implement all platform business logic, workflow orchestration, validation rules and security enforcement.

Responsibilities include:

* Permit lifecycle management  
* Workflow execution  
* Business rule validation  
* Role-based access enforcement  
* Notification generation  
* Audit logging  
* Background job scheduling  
* Integration with infrastructure services

The backend shall expose versioned REST APIs consumed by both web and mobile applications.

---

## **2.5 Data & Infrastructure Layer**

### **PostgreSQL**

PostgreSQL serves as the system of record for all operational and organisational data. It stores tenant information, user records, permits, workflows, audit logs, incidents, LOTOTO records, SIMOPS conflicts and reporting data.

---

### **Drizzle ORM**

Drizzle ORM provides type-safe interaction with PostgreSQL and manages schema migrations, entity relationships and database versioning.

---

### **Redis**

Redis shall provide high-performance in-memory caching for frequently accessed reference data, session-related information where required and temporary application state to reduce database load.

---

### **BullMQ**

BullMQ shall manage asynchronous processing tasks, including notification dispatch, scheduled reminders, permit expiry checks, background report generation and other long-running operations.

---

### **MinIO**

MinIO shall store uploaded files, including permit attachments, photographs, supporting evidence, inspection records and incident documentation. Only object references and metadata shall be maintained within PostgreSQL.

---

### **Keycloak**

Keycloak provides centralised authentication, identity management and role-based access control. Application services shall rely on validated identity tokens and assigned organisational roles to determine user permissions.

---

### **Grafana Loki**

Grafana Loki shall collect and centralise structured application logs generated by frontend, backend and infrastructure components to support operational monitoring and troubleshooting.

---

### **Metabase**

Metabase shall provide business intelligence and operational reporting capabilities by querying analytical datasets derived from the platform's operational database.

---

## **2.6 High-Level Module Architecture**

The platform implementation shall be organised into feature-oriented modules aligned with the business capabilities defined in the Product Requirements Document. Each module shall encapsulate its own presentation components, application services, persistence logic and associated domain models while exposing only the interfaces required for interaction with other modules.

The primary implementation modules are:

* Organisation Management  
* Workforce Management  
* Master Data Management  
* Permit-to-Work Management  
* LOTOTO  
* SIMOPS  
* Multi-Day Permit Management  
* Incident Management  
* Notification Management  
* Dashboards & Analytics  
* Billing & Subscription Management

Although developed as independent feature modules, these components operate together through shared authentication, common infrastructure services and a unified data model to deliver a cohesive enterprise platform.

---

# **3\. Development Standards & Engineering Conventions**

## **3.1 Purpose**

This section establishes the engineering standards, implementation conventions and development practices that shall be followed throughout the implementation of the Permit-to-Work platform. These standards ensure consistency across frontend, backend, mobile, database and infrastructure development while promoting maintainability, scalability, security and code quality.

All implementation activities described in subsequent milestones and sprints shall comply with the standards defined in this section unless explicitly stated otherwise.

---

## **3.2 Development Methodology**

The platform shall be implemented using an Agile development methodology based on iterative, milestone-driven delivery. Each milestone represents a major functional increment of the platform and is divided into multiple sprints, with each sprint delivering a cohesive set of related capabilities.

Implementation activities within each sprint shall be organised into parallel workstreams to enable concurrent development across engineering disciplines.

The primary workstreams are:

* Backend Development  
* Frontend Development  
* Mobile Development  
* Database Development  
* Infrastructure & DevOps  
* Quality Assurance

Each sprint shall conclude only after all allocated functional requirements have been implemented, validated against their acceptance criteria and verified through the associated test cases.

---

# **3.3 Repository Structure**

Development shall be organised using a modular repository structure that separates platform components while encouraging code reuse and maintainability.

The primary repositories comprise:

* Web Application  
* Mobile Application  
* Backend Services  
* Shared Libraries  
* Infrastructure Configuration  
* Documentation

Each repository shall maintain independent build configurations, dependency management and testing pipelines while adhering to shared coding standards and versioning practices.

---

# **3.4 Module Organisation**

The backend implementation shall follow a feature-oriented modular architecture.

Each functional module shall encapsulate all implementation artefacts related to a specific business capability, including:

* Controllers  
* Services  
* Data Transfer Objects (DTOs)  
* Validation  
* Guards  
* Repositories  
* Database Models  
* Background Jobs  
* Event Handlers  
* Unit Tests

Modules shall communicate through well-defined service interfaces rather than direct implementation dependencies.

This approach supports maintainability, independent testing and future extensibility.

---

# **3.5 Coding Standards**

Implementation shall comply with the following coding principles:

### **General**

* TypeScript shall be used throughout the platform.  
* Strong typing shall be enforced.  
* Code duplication shall be minimised.  
* Functions shall perform a single responsibility.  
* Business logic shall remain independent of presentation logic.  
* Shared functionality shall be extracted into reusable components or services.

### **Backend**

Backend services shall:

* Follow NestJS dependency injection principles.  
* Separate controllers from business logic.  
* Validate all incoming requests.  
* Return consistent API responses.  
* Avoid direct database access from controllers.

### **Frontend**

Frontend implementation shall:

* Build reusable UI components.  
* Separate presentation from business logic.  
* Maintain responsive layouts.  
* Support accessibility standards.  
* Provide consistent user interactions.

### **Mobile**

Mobile implementation shall:

* Support offline-first workflows where applicable.  
* Minimise unnecessary network requests.  
* Synchronise data reliably after connectivity is restored.  
* Maintain consistency with web platform behaviour.

---

# **3.6 API Standards**

All platform functionality shall be exposed through versioned REST APIs.

API implementations shall adhere to the following principles:

* Resource-oriented endpoint design.  
* Consistent request and response formats.  
* Standard HTTP status codes.  
* Centralised exception handling.  
* Pagination for large datasets.  
* Filtering and sorting where applicable.  
* Comprehensive input validation.  
* Structured error responses.

API documentation shall be generated and maintained throughout implementation.

---

# **3.7 Database Standards**

Database implementation shall follow relational database design principles.

The implementation shall ensure:

* Data normalisation where appropriate.  
* Primary and foreign key constraints.  
* Referential integrity.  
* Optimised indexing strategies.  
* Audit columns for operational entities.  
* Migration-based schema management.  
* Soft deletion where required by business workflows.

Database changes shall be implemented through controlled migration scripts to maintain schema consistency across environments.

---

# **3.8 Security Standards**

Security shall be incorporated throughout implementation rather than introduced as a post-development activity.

Implementation shall include:

* Centralised authentication through Keycloak.  
* Role-Based Access Control (RBAC).  
* Route-level authorisation.  
* Input validation.  
* Secure file upload validation.  
* Protection against common web vulnerabilities.  
* Audit logging of security-sensitive operations.  
* Secure management of secrets and configuration.

All protected resources shall enforce authentication before business logic execution.

---

# **3.9 Logging & Monitoring Standards**

Application observability shall be implemented across all platform components.

Logging shall capture:

* Authentication events.  
* Permit lifecycle events.  
* Approval decisions.  
* LOTOTO activities.  
* Incident management activities.  
* Background job execution.  
* API failures.  
* Validation errors.  
* System exceptions.

Logs shall support operational troubleshooting, compliance auditing and performance monitoring.

---

# **3.10 Quality Assurance Standards**

Quality assurance activities shall be integrated throughout implementation rather than performed solely at project completion.

Every functional implementation shall be verified through:

* Unit Testing  
* Integration Testing  
* API Testing  
* User Interface Testing  
* Mobile Application Testing  
* Functional Testing  
* Regression Testing  
* User Acceptance Testing

Each implemented requirement shall demonstrate successful execution of all defined acceptance criteria prior to release.

---

# **3.11 Definition of Done**

A functional requirement shall be considered complete only when all of the following conditions have been satisfied:

* Implementation completed across all applicable application layers.  
* Database changes successfully migrated.  
* APIs implemented and verified.  
* User interfaces completed.  
* Mobile functionality implemented where required.  
* Security requirements satisfied.  
* Audit logging implemented.  
* Positive test cases passed.  
* Negative test cases passed.  
* Acceptance criteria satisfied.  
* Documentation updated.  
* Code reviewed and approved.

Only functionality satisfying the Definition of Done shall be eligible for inclusion in a production release.

---

# **3.12 Requirement Allocation Strategy**

Functional requirements defined in the Product Requirements Document shall be grouped into implementation sprints according to business capability rather than treated as isolated work items.

Each sprint shall deliver a complete, testable feature by combining related functional requirements into a cohesive implementation increment.

For every functional requirement, the implementation plan shall define:

* Associated milestone and sprint.  
* User story.  
* Use case.  
* Functional criteria.  
* Backend implementation tasks.  
* Frontend implementation tasks.  
* Mobile implementation tasks.  
* Database implementation tasks.  
* Infrastructure implementation tasks.  
* Positive test cases.  
* Negative use cases.  
* Negative test cases.  
* Acceptance criteria.  
* Requirement traceability.

This allocation strategy ensures that each sprint produces demonstrable business value while maintaining complete traceability from implementation through testing and acceptance.

---

# **4\. Project Roadmap & Milestone Planning**

## **4.1 Implementation Strategy**

The Permit-to-Work platform shall be implemented using an incremental, milestone-based delivery model. Each milestone introduces a complete set of related business capabilities that build upon previously implemented functionality, ensuring that foundational platform services are established before dependent operational modules are developed.

Rather than implementing individual functional requirements in isolation, related requirements shall be grouped into cohesive implementation increments that deliver complete, testable business functionality. This approach reduces integration complexity, facilitates continuous validation and allows engineering teams to demonstrate meaningful progress at the conclusion of each milestone.

The implementation sequence has been designed to minimise technical dependencies while enabling parallel development across backend, frontend, mobile, database and infrastructure workstreams.

---

# **4.2 Implementation Philosophy**

The implementation shall follow the principle of **Foundation → Core Operations → Safety Systems → Operational Intelligence → Platform Services**.

Development begins by establishing the foundational platform capabilities required by all subsequent modules, including organisation management, workforce administration, authentication, master data and infrastructure services.

Once the platform foundation has been completed, development progresses to the core Permit-to-Work lifecycle, which serves as the central business workflow of the application. Safety-related modules such as Lock Out Tag Out (LOTOTO), Simultaneous Operations (SIMOPS) and Multi-Day Permit Management are implemented after the permit lifecycle because they depend upon active permit data and workflow states.

Operational support modules, including Incident Management, Notifications and Dashboards, are subsequently integrated to enhance visibility, communication and organisational oversight. The final implementation milestone focuses on commercial platform capabilities, production hardening and deployment readiness.

This staged approach ensures that each milestone delivers usable business functionality while reducing implementation risk and maintaining clear dependency boundaries.

---

# **4.3 Milestone Overview**

The implementation is divided into eight major milestones.

| Milestone | Name | Primary Outcome |
| ----- | ----- | ----- |
| MS-01 | Platform Foundation | Establish tenant management, organisation structure, workforce management, master data and core infrastructure. |
| MS-02 | Permit-to-Work Core | Implement the complete permit lifecycle from creation through closure. |
| MS-03 | Lock Out Tag Out (LOTOTO) | Implement hazardous energy isolation workflows integrated with permits. |
| MS-04 | Simultaneous Operations (SIMOPS) | Detect, review and manage operational conflicts across permits. |
| MS-05 | Multi-Day Permit Management | Support long-duration permits with daily progress tracking and safety revalidation. |
| MS-06 | Incident Management | Record, investigate and resolve incidents, unsafe conditions and near misses. |
| MS-07 | Notifications, Dashboards & Analytics | Deliver operational notifications, role-based dashboards and analytical reporting. |
| MS-08 | Billing, Platform Hardening & Production Release | Complete subscription management, production readiness, security hardening and deployment. |

Each milestone represents a production-quality increment and concludes with integration testing against all implemented functionality.

---

# **4.4 Milestone Dependency Model**

The milestones are arranged according to functional and technical dependencies.

MS-01

Platform Foundation

        │

        ▼

MS-02

Permit-to-Work Core

        │

 ┌──────┼────────┐

 ▼      ▼        ▼

MS-03  MS-04   MS-05

LOTOTO SIMOPS Multi-Day Permit

        │

        ▼

MS-06

Incident Management

        │

        ▼

MS-07

Notifications

Dashboards

Analytics

        │

        ▼

MS-08

Billing

Production Readiness

Release

The Platform Foundation provides the organisational data, authentication framework and master data required by all operational modules. Permit-to-Work Core establishes the primary workflow upon which LOTOTO, SIMOPS and Multi-Day Permit Management depend. Incident Management integrates with these operational workflows to capture safety events. Notifications and analytics consolidate information generated throughout the platform, while the final milestone prepares the system for production deployment.

---

# **4.5 Milestone Objectives**

## **MS-01 – Platform Foundation**

**Objective**

Establish the core platform infrastructure, organisational configuration, workforce administration, master data management and security framework required to support all subsequent business functionality.

**Primary Modules**

* Organisation Management  
* Workforce Management  
* Master Data Management

**Functional Requirements**

* FR-ORG-001 → FR-ORG-011  
* FR-WFM-001 → FR-WFM-008  
* FR-MDM-001 → FR-MDM-007

**Technology Focus**

* Next.js project setup  
* NestJS application bootstrap  
* PostgreSQL configuration  
* Drizzle ORM integration  
* Keycloak integration  
* Redis deployment  
* MinIO configuration  
* Core UI framework  
* Authentication  
* Tenant isolation

---

## **MS-02 – Permit-to-Work Core**

**Objective**

Implement the complete digital Permit-to-Work lifecycle, including permit creation, approval, execution, monitoring and closure.

**Primary Modules**

* Permit Management

**Functional Requirements**

* FR-PTW-001 → FR-PTW-012

**Technology Focus**

* Workflow engine  
* Approval routing  
* File attachments  
* Audit logging  
* API implementation  
* Mobile permit workflows

---

## **MS-03 – Lock Out Tag Out (LOTOTO)**

**Objective**

Implement machine-specific hazardous energy isolation workflows integrated directly into permit execution.

**Primary Modules**

* LOTOTO

**Functional Requirements**

* FR-LTO-001 → FR-LTO-014

**Technology Focus**

* Isolation workflow  
* Evidence uploads  
* Machine state management  
* Sequential execution  
* Restoration workflow

---

## **MS-04 – Simultaneous Operations (SIMOPS)**

**Objective**

Identify, review and resolve hazardous conflicts between overlapping operational activities.

**Primary Modules**

* SIMOPS

**Functional Requirements**

* FR-SIM-001 → FR-SIM-010

**Technology Focus**

* Conflict detection engine  
* Schedule comparison  
* Hazard analysis  
* Notification integration

---

## **MS-05 – Multi-Day Permit Management**

**Objective**

Support permits extending across multiple operational days while maintaining continuous visibility and daily safety validation.

**Primary Modules**

* Multi-Day Permit Management

**Functional Requirements**

* FR-MDP-001 → FR-MDP-008

**Technology Focus**

* Daily progress  
* Revalidation workflows  
* Offline mobile synchronisation  
* Historical tracking

---

## **MS-06 – Incident Management**

**Objective**

Provide comprehensive reporting, investigation and resolution capabilities for incidents, near misses and unsafe conditions occurring during operational activities.

**Primary Modules**

* Incident Management

**Functional Requirements**

* FR-INC-001 → FR-INC-010

**Technology Focus**

* Incident workflows  
* Evidence management  
* Investigation tracking  
* Corrective actions

---

## **MS-07 – Notifications, Dashboards & Analytics**

**Objective**

Deliver operational awareness through automated notifications, real-time dashboards and analytical reporting.

**Primary Modules**

* Notifications  
* Dashboards  
* Analytics

**Functional Requirements**

* FR-NOT-001 → FR-NOT-009  
* FR-DAS-001 → FR-DAS-009

**Technology Focus**

* BullMQ processing  
* Recharts dashboards  
* Metabase integration  
* Redis optimisation  
* Reporting APIs

---

## **MS-08 – Billing, Platform Hardening & Production Release**

**Objective**

Complete commercial platform functionality and prepare the system for production deployment through security hardening, performance optimisation and release validation.

**Primary Modules**

* Billing & Subscription Management

**Functional Requirements**

* FR-BIL-001 → FR-BIL-006

**Technology Focus**

* Subscription management  
* Performance optimisation  
* Security review  
* Production deployment  
* Monitoring configuration  
* Backup strategy

---

# **4.6 Sprint Distribution**

Each milestone is divided into focused implementation sprints that deliver cohesive business capabilities.

| Milestone | Estimated Sprints |
| ----- | ----- |
| MS-01 – Platform Foundation | 5 |
| MS-02 – Permit-to-Work Core | 4 |
| MS-03 – LOTOTO | 3 |
| MS-04 – SIMOPS | 2 |
| MS-05 – Multi-Day Permit | 2 |
| MS-06 – Incident Management | 3 |
| MS-07 – Notifications, Dashboards & Analytics | 4 |
| MS-08 – Billing, Hardening & Production Release | 3 |

**Total Estimated Sprints: 26**

This distribution provides a balance between feature scope and delivery cadence while ensuring each sprint produces a meaningful, testable increment of functionality.

---

# **4.7 Engineering Workstreams**

Within every sprint, work shall proceed concurrently across the following engineering workstreams:

* **Backend Development:** NestJS modules, controllers, services, validation, business logic and APIs.  
* **Frontend Development:** Next.js pages, reusable UI components, forms, dashboards and client-side validation.  
* **Mobile Development:** React Native screens, offline data handling, synchronisation and field workflows.  
* **Database Development:** PostgreSQL schema design, Drizzle migrations, indexing and data integrity.  
* **Infrastructure & Platform Engineering:** Keycloak, Redis, BullMQ, MinIO, logging, monitoring and deployment configuration.  
* **Quality Assurance:** Unit, integration, API, UI and end-to-end testing, including positive, negative and regression test execution.

Each workstream contributes to the implementation of the same sprint objectives, ensuring that features are delivered as complete vertical slices rather than isolated technical components.

---

# **5\. Milestone 1 – Platform Foundation**

## **5.1 Milestone Overview**

### **Milestone ID**

**MS-01**

### **Milestone Name**

**Platform Foundation**

### **Objective**

The Platform Foundation milestone establishes the core infrastructure and organisational capabilities upon which all subsequent modules depend. This milestone delivers the essential services required to support secure multi-tenant operation, organisational administration, workforce management and master data configuration.

Completion of this milestone provides a fully operational platform foundation capable of authenticating users, managing organisational structures, configuring operational reference data and supporting role-based access control. Although operational permit workflows are not yet implemented, the platform will be capable of onboarding organisations and preparing them for Permit-to-Work operations.

---

## **5.2 Business Goals**

The primary goals of this milestone are to:

* Establish secure multi-tenant platform infrastructure.  
* Enable organisation onboarding.  
* Configure organisational hierarchy.  
* Manage workforce records.  
* Configure operational master data.  
* Implement authentication and role-based authorisation.  
* Provide reusable platform services required by future milestones.  
* Deliver a stable engineering foundation for operational modules.

---

## **5.3 Functional Requirements**

This milestone implements the following functional requirements defined within the Product Requirements Document.

### **Organisation Management**

* FR-ORG-001  
* FR-ORG-002  
* FR-ORG-003  
* FR-ORG-004  
* FR-ORG-005  
* FR-ORG-006  
* FR-ORG-007  
* FR-ORG-008  
* FR-ORG-009  
* FR-ORG-010  
* FR-ORG-011

### **Workforce Management**

* FR-WFM-001  
* FR-WFM-002  
* FR-WFM-003  
* FR-WFM-004  
* FR-WFM-005  
* FR-WFM-006  
* FR-WFM-007  
* FR-WFM-008

### **Master Data Management**

* FR-MDM-001  
* FR-MDM-002  
* FR-MDM-003  
* FR-MDM-004  
* FR-MDM-005  
* FR-MDM-006  
* FR-MDM-007

---

# **5.4 Milestone Deliverables**

Upon successful completion of this milestone, the following capabilities shall be available.

## **Platform Infrastructure**

* Keycloak authentication  
* Tenant isolation  
* User authentication  
* Role-based access control  
* Audit logging framework  
* Redis integration  
* BullMQ configuration  
* MinIO integration  
* Logging infrastructure  
* API versioning

---

## **Organisation Administration**

* Organisation onboarding  
* Plant management  
* Department management  
* Location management  
* Workstation management  
* Machinery management  
* Approval workflow configuration  
* Safety checklist configuration  
* PPE configuration  
* Notification preference configuration

---

## **Workforce Management**

* Employee management  
* Contractor management  
* Agency management  
* User management  
* Role assignment  
* Competency management  
* Certification management

---

## **Master Data**

* Permit Types  
* Hazard Categories  
* PPE Catalogue  
* Machinery Catalogue  
* Workstation Catalogue  
* Safety Checklists  
* Bulk Import

---

# **5.5 Sprint Breakdown**

MS-01 is divided into five implementation sprints.

| Sprint | Name | Primary Objective |
| ----- | ----- | ----- |
| SP-01.01 | Platform Infrastructure | Establish core infrastructure, authentication and project setup |
| SP-01.02 | Organisation Management | Implement tenant and organisational hierarchy |
| SP-01.03 | Workforce Management | Implement employee, contractor and user management |
| SP-01.04 | Master Data Management | Implement configurable operational reference data |
| SP-01.05 | Platform Integration | Integrate modules, validate security and prepare foundation for PTW |

Each sprint delivers a complete increment of platform capability while preparing dependencies for subsequent milestones.

---

# **5.6 Sprint Dependency**

SP-01.01

Infrastructure

        │

        ▼

SP-01.02

Organisation

        │

        ▼

SP-01.03

Workforce

        │

        ▼

SP-01.04

Master Data

        │

        ▼

SP-01.05

Integration

The completion of each sprint establishes prerequisite functionality required by the next sprint. For example, organisational entities created in SP-01.02 are required before workforce records can be assigned in SP-01.03, and master data configured in SP-01.04 becomes available for operational modules introduced in later milestones.

---

# **5.7 Technology Allocation**

| Layer | Responsibilities during MS-01 |
| ----- | ----- |
| **Next.js** | Authentication screens, organisation setup, administration pages, reusable layouts |
| **NestJS** | Authentication integration, organisation services, workforce services, master data APIs |
| **PostgreSQL** | Tenant data, organisational hierarchy, workforce records, master data |
| **Drizzle ORM** | Database schema, migrations, repository layer |
| **Keycloak** | Authentication, identity management, RBAC |
| **Redis** | Cache configuration and shared lookup data |
| **BullMQ** | Infrastructure for background processing (no business jobs yet) |
| **MinIO** | Object storage setup for future document uploads |
| **React Native** | Login, user profile and foundational application shell |
| **Grafana Loki** | Centralised application logging |
| **Metabase** | Initial analytical data source configuration |

---

# **5.8 Exit Criteria**

MS-01 shall be considered complete when:

* All allocated functional requirements have been implemented.  
* Multi-tenant organisation management is operational.  
* Workforce administration is functional.  
* Master data can be created, modified and maintained.  
* Authentication and role-based access control are fully integrated.  
* Backend APIs for foundation modules are complete.  
* Web administration interfaces are operational.  
* Mobile authentication is functional.  
* Core infrastructure services are configured.  
* Positive and negative test cases have passed.  
* All acceptance criteria have been satisfied.

---

Perfect. I completely agree with this approach. **SP-01.01 is an engineering sprint**, not a business feature sprint. So instead of inventing user stories and use cases, we'll focus on engineering objectives, deliverables, infrastructure, and technical verification.

This is exactly how implementation plans are written in industry.

---

# **5.9 Sprint SP-01.01 – Platform Infrastructure**

## **Sprint Information**

| Attribute | Value |
| ----- | ----- |
| Sprint ID | SP-01.01 |
| Sprint Name | Platform Infrastructure |
| Milestone | MS-01 – Platform Foundation |
| Duration | 2 Weeks (Estimated) |
| Sprint Type | Foundation Sprint |
| Priority | Critical |
| Dependencies | None |

---

# **5.9.1 Sprint Objective**

The objective of this sprint is to establish the foundational infrastructure required to support all subsequent development activities. This sprint focuses on configuring the core application architecture, development environment, authentication framework, infrastructure services and shared engineering components.

Unlike later implementation sprints, SP-01.01 does not introduce end-user business functionality. Instead, it provides the technical foundation upon which all functional modules will be implemented.

---

# **5.9.2 Sprint Deliverables**

By the end of this sprint, the following deliverables shall be completed:

### **Project Foundation**

* Next.js web application initialised  
* NestJS backend application initialised  
* React Native mobile application initialised  
* Shared TypeScript configuration  
* Environment configuration  
* Repository structure established

---

### **Identity & Security**

* Keycloak server configured  
* Development realm created  
* Client applications registered  
* Role definitions created  
* Authentication integrated  
* JWT validation configured  
* RBAC middleware implemented

---

### **Database**

* PostgreSQL database provisioned  
* Drizzle ORM configured  
* Initial migration framework established  
* Database connection management  
* Seed framework

---

### **Infrastructure**

* Redis configured  
* BullMQ configured  
* MinIO configured  
* Loki configured  
* Metabase configured

---

### **Shared Services**

* Logging service  
* Exception handling  
* Validation framework  
* API response wrapper  
* Configuration service

---

### **CI/CD Foundation**

* Repository branching model  
* Linting  
* Formatting  
* Unit testing framework  
* Build pipelines

---

# **5.9.3 Engineering Work Breakdown**

## **Backend**

### **Tasks**

| Task ID | Description |
| ----- | ----- |
| BE-INF-001 | Initialise NestJS application |
| BE-INF-002 | Configure module architecture |
| BE-INF-003 | Configure dependency injection |
| BE-INF-004 | Global validation pipes |
| BE-INF-005 | Global exception filters |
| BE-INF-006 | Response interceptor |
| BE-INF-007 | Request logging |
| BE-INF-008 | Environment configuration |
| BE-INF-009 | API versioning |
| BE-INF-010 | Health check endpoint |

---

## **Frontend**

### **Tasks**

| Task ID | Description |
| ----- | ----- |
| FE-INF-001 | Initialise Next.js project |
| FE-INF-002 | Configure Tailwind CSS |
| FE-INF-003 | Install Shadcn UI |
| FE-INF-004 | Configure ui.watermelon.sh components |
| FE-INF-005 | Configure Lucide icons |
| FE-INF-006 | Configure Framer Motion |
| FE-INF-007 | Authentication layout |
| FE-INF-008 | Shared navigation layout |
| FE-INF-009 | Theme configuration |

---

## **Mobile**

### **Tasks**

| Task ID | Description |
| ----- | ----- |
| MOB-INF-001 | Initialise React Native project |
| MOB-INF-002 | Configure SQLite |
| MOB-INF-003 | Configure authentication flow |
| MOB-INF-004 | Configure navigation |
| MOB-INF-005 | Shared UI theme |
| MOB-INF-006 | API client |
| MOB-INF-007 | Offline storage layer |

---

## **Database**

### **Tasks**

| Task ID | Description |
| ----- | ----- |
| DB-INF-001 | PostgreSQL instance |
| DB-INF-002 | Configure Drizzle ORM |
| DB-INF-003 | Migration framework |
| DB-INF-004 | Seed framework |
| DB-INF-005 | UUID strategy |
| DB-INF-006 | Audit column template |
| DB-INF-007 | Base schema |

---

## **Infrastructure**

### **Tasks**

| Task ID | Description |
| ----- | ----- |
| INF-001 | Configure Redis |
| INF-002 | Configure BullMQ |
| INF-003 | Configure MinIO |
| INF-004 | Configure Keycloak |
| INF-005 | Configure Loki |
| INF-006 | Configure Metabase |
| INF-007 | Environment secrets |
| INF-008 | Docker Compose for local development |

---

# **5.9.4 Technical Components**

The sprint establishes the following reusable platform components:

### **Authentication Module**

Responsibilities

* Login  
* Logout  
* Token validation  
* Refresh token handling  
* Role extraction  
* Session validation

---

### **Configuration Module**

Responsibilities

* Environment variables  
* Feature flags  
* External service configuration

---

### **Logging Module**

Responsibilities

* Request logging  
* Error logging  
* Audit logging foundation  
* Performance logging

---

### **Exception Module**

Responsibilities

* Global exception handling  
* Standard API errors  
* Validation responses  
* HTTP status mapping

---

### **Storage Module**

Responsibilities

* MinIO abstraction  
* File upload service  
* File retrieval service  
* Bucket management

---

### **Queue Module**

Responsibilities

* Queue registration  
* Worker registration  
* Retry policies  
* Dead-letter queue configuration

---

# **5.9.5 API Foundation**

The following infrastructure endpoints shall be implemented:

| Endpoint | Method | Purpose |
| ----- | ----- | ----- |
| `/api/v1/health` | GET | Service health |
| `/api/v1/auth/profile` | GET | Current authenticated user |
| `/api/v1/auth/logout` | POST | Logout |
| `/api/v1/system/config` | GET | Client configuration |
| `/api/v1/system/version` | GET | Version information |

These endpoints provide operational functionality required before business modules are introduced.

---

# **5.9.6 Security Implementation**

The following security measures shall be implemented during this sprint:

* Keycloak integration  
* JWT validation  
* Role extraction  
* Route protection  
* Secure environment configuration  
* API authentication middleware  
* CORS configuration  
* Helmet security headers  
* Rate limiting  
* Request validation

---

# **5.9.7 Quality Assurance Activities**

The following verification activities shall be performed:

### **Backend**

* Module bootstrapping verification  
* Authentication verification  
* API availability  
* Validation framework testing

---

### **Frontend**

* Build verification  
* Authentication routing  
* Responsive layout verification  
* Theme consistency

---

### **Mobile**

* Application launch  
* Authentication flow  
* SQLite initialisation  
* API connectivity

---

### **Infrastructure**

* Database connectivity  
* Redis connectivity  
* MinIO accessibility  
* BullMQ connectivity  
* Loki logging verification  
* Metabase connectivity

---

# **5.9.8 Risks**

| Risk | Impact | Mitigation |
| ----- | ----- | ----- |
| Keycloak integration delays | High | Prototype authentication early |
| Docker configuration inconsistencies | Medium | Maintain version-controlled environment definitions |
| Service startup dependencies | Medium | Define health checks and startup order |
| Environment variable misconfiguration | Medium | Validate configuration during application startup |

---

# **5.9.9 Acceptance Criteria**

### **AC-INF-001**

All platform services initialise successfully without runtime errors.

### **AC-INF-002**

Web, backend and mobile applications communicate successfully with the configured development environment.

### **AC-INF-003**

Authentication through Keycloak is operational for all client applications.

### **AC-INF-004**

All infrastructure services (PostgreSQL, Redis, BullMQ, MinIO, Loki and Metabase) are reachable and functioning correctly.

### **AC-INF-005**

The backend exposes the foundational API endpoints and returns responses in the standard application format.

### **AC-INF-006**

The project structure, repository conventions and shared engineering components are fully established for subsequent feature development.

---

# **5.9.10 Definition of Done**

The sprint shall be considered complete when:

* All engineering tasks have been completed.  
* Infrastructure services are operational.  
* Authentication is fully integrated.  
* Local development environment can be provisioned consistently.  
* Build pipelines execute successfully.  
* Unit testing framework is operational.  
* Code quality checks pass.  
* API documentation is available for infrastructure endpoints.  
* All acceptance criteria have been satisfied.  
* No critical defects prevent the commencement of feature development.

---

# **5.10 Sprint SP-01.02 – Organisation Management**

## **5.10.1 Sprint Overview**

| Attribute | Value |
| ----- | ----- |
| Sprint ID | SP-01.02 |
| Sprint Name | Organisation Management |
| Milestone | MS-01 – Platform Foundation |
| Sprint Type | Feature Sprint |
| Priority | Critical |
| Estimated Duration | 2 Weeks |
| Dependencies | SP-01.01 – Platform Infrastructure |

---

# **5.10.2 Functional Requirements Covered**

This sprint implements the Organisation Management module by delivering the functional requirements related to organisation onboarding, tenant isolation, organisational hierarchy and operational configuration.

| Functional Requirement | Description |
| ----- | ----- |
| FR-ORG-001 | Organisation registration |
| FR-ORG-002 | Tenant isolation |
| FR-ORG-003 | Plant management |
| FR-ORG-004 | Department management |
| FR-ORG-005 | Operational locations |
| FR-ORG-006 | Workstations & machinery hierarchy |
| FR-ORG-007 | Approval workflow configuration |
| FR-ORG-008 | Permit template configuration |
| FR-ORG-009 | Safety checklist configuration |
| FR-ORG-010 | PPE configuration |
| FR-ORG-011 | Notification preferences |

---

# **5.10.3 Sprint Objectives**

The objective of this sprint is to establish the organisational structure required for every tenant using the platform.

Upon completion, an administrator shall be able to:

* Register and configure an organisation.  
* Define the operational hierarchy.  
* Configure organisational settings.  
* Configure approval workflows.  
* Configure permit templates.  
* Configure safety checklists.  
* Configure PPE requirements.  
* Configure notification preferences.

This sprint provides the organisational data required by Workforce Management and all operational modules introduced in later milestones.

---

# **5.10.4 Dependencies**

This sprint depends on the successful completion of:

| Sprint | Dependency |
| ----- | ----- |
| SP-01.01 | Authentication |
| SP-01.01 | Keycloak integration |
| SP-01.01 | PostgreSQL |
| SP-01.01 | Drizzle ORM |
| SP-01.01 | API framework |
| SP-01.01 | RBAC |

Subsequent sprints depending on this sprint include:

* SP-01.03 Workforce Management  
* SP-01.04 Master Data  
* SP-02 Permit-to-Work  
* SP-03 LOTOTO  
* SP-04 SIMOPS

---

# **5.10.5 User Stories**

---

### **US-ORG-001**

**As a System Administrator, I want to register a new organisation so that it can begin using the Permit-to-Work platform.**

---

### **US-ORG-002**

**As a System Administrator, I want to define plants, departments and operational locations so that permits can be associated with the correct operational hierarchy.**

---

### **US-ORG-003**

**As a System Administrator, I want to configure permit approval workflows so that hazardous work follows organisation-specific approval processes.**

---

### **US-ORG-004**

**As a System Administrator, I want to configure permit templates, safety checklists and PPE requirements so that operational consistency is maintained across all permits.**

---

### **US-ORG-005**

**As a System Administrator, I want to configure notification preferences so that organisational communication follows operational requirements.**

---

# **5.10.6 Use Cases**

---

## **UC-ORG-001**

### **Organisation Registration**

**Primary Actor**

System Administrator

---

### **Preconditions**

* User is authenticated.  
* User has Administrator role.  
* Tenant does not already exist.

---

### **Trigger**

Administrator selects **Create Organisation**.

---

### **Main Flow**

1. Administrator enters organisation information.  
2. System validates required fields.  
3. Administrator configures organisation settings.  
4. System creates tenant.  
5. Default organisational data is initialised.  
6. Audit record is generated.  
7. Organisation becomes active.

---

### **Alternative Flow**

If organisation data is imported from an external source:

* Administrator uploads configuration.  
* System validates imported data.  
* Organisation hierarchy is created automatically.

---

### **Exception Flow**

If organisation name already exists:

* Registration is rejected.  
* Administrator receives validation error.

---

### **Postconditions**

* Organisation exists.  
* Tenant created.  
* Default configuration available.

---

## **UC-ORG-002**

### **Configure Organisational Hierarchy**

**Primary Actor**

System Administrator

**Main Flow**

1. Select organisation.  
2. Create plant.  
3. Create departments.  
4. Create locations.  
5. Assign workstations.  
6. Register machinery.  
7. Save hierarchy.

**Postconditions**

Complete operational hierarchy exists.

---

## **UC-ORG-003**

### **Configure Approval Workflow**

**Primary Actor**

System Administrator

**Main Flow**

1. Select permit type.  
2. Configure approval stages.  
3. Assign organisational roles.  
4. Define approval sequence.  
5. Save workflow.

---

## **UC-ORG-004**

### **Configure Operational Templates**

**Primary Actor**

System Administrator

**Main Flow**

1. Create permit template.  
2. Configure checklist.  
3. Configure PPE.  
4. Configure mandatory fields.  
5. Publish template.

---

# **5.10.7 Functional Criteria**

| ID | Functional Criterion |
| ----- | ----- |
| FC-ORG-001 | Organisation names shall be unique. |
| FC-ORG-002 | Each organisation shall maintain isolated data. |
| FC-ORG-003 | Departments must belong to a plant. |
| FC-ORG-004 | Locations must belong to a department. |
| FC-ORG-005 | Workstations belong to locations. |
| FC-ORG-006 | Machines belong to workstations. |
| FC-ORG-007 | Approval workflows must contain at least one approver. |
| FC-ORG-008 | Permit templates require mandatory fields before publication. |
| FC-ORG-009 | Safety checklists may be reused across templates. |
| FC-ORG-010 | Notification preferences are organisation-specific. |

---

# **5.10.8 Backend Implementation (NestJS)**

### **Modules**

* Organisation Module  
* Plant Module  
* Department Module  
* Location Module  
* Workstation Module  
* Machinery Module  
* Workflow Configuration Module

### **Controllers**

* OrganisationController  
* PlantController  
* DepartmentController  
* LocationController  
* WorkstationController  
* MachineryController

### **Services**

* OrganisationService  
* PlantService  
* DepartmentService  
* LocationService  
* WorkstationService  
* MachineryService  
* WorkflowConfigurationService

### **DTOs**

* CreateOrganisationDto  
* UpdateOrganisationDto  
* CreatePlantDto  
* CreateDepartmentDto  
* CreateLocationDto  
* CreateWorkstationDto  
* CreateMachineDto

### **Validation**

* Duplicate organisation check  
* Duplicate hierarchy validation  
* Parent-child relationship validation  
* Tenant validation

---

# **5.10.9 Frontend Implementation (Next.js)**

Pages:

* Organisation Dashboard  
* Organisation Profile  
* Plants  
* Departments  
* Locations  
* Workstations  
* Machinery  
* Approval Workflow Configuration  
* Permit Template Configuration  
* Safety Checklist Configuration  
* Notification Preferences

Reusable Components:

* Data Table  
* Tree View  
* Hierarchy Explorer  
* Create/Edit Dialog  
* Confirmation Dialog  
* Search  
* Filters  
* Pagination  
* Breadcrumb Navigation

---

# **5.10.10 Mobile Implementation (React Native)**

Although administration is primarily web-based, mobile support shall include:

* Organisation Profile (Read-only)  
* Plant Directory  
* Department Directory  
* Location Directory

Offline caching shall be provided for organisational reference data to support subsequent operational workflows.

---

# **5.10.11 Database Implementation**

Core entities include:

* organisations  
* plants  
* departments  
* locations  
* workstations  
* machinery  
* approval\_workflows  
* permit\_templates  
* safety\_checklists  
* ppe\_catalogue  
* notification\_preferences

Implementation activities include:

* Drizzle schema definitions  
* Foreign key relationships  
* Index creation  
* Migration scripts  
* Seed data for default configuration

---

# **5.10.12 Infrastructure Dependencies**

* Keycloak role mapping  
* Redis caching for reference data  
* MinIO (reserved for future organisation branding assets and documents)  
* Audit logging via Grafana Loki  
* BullMQ reserved for future asynchronous configuration tasks

---

# **5.10.13 API Endpoints**

| Method | Endpoint | Purpose |
| ----- | ----- | ----- |
| POST | `/api/v1/organisations` | Create organisation |
| GET | `/api/v1/organisations` | List organisations |
| GET | `/api/v1/organisations/{id}` | Get organisation |
| PATCH | `/api/v1/organisations/{id}` | Update organisation |
| DELETE | `/api/v1/organisations/{id}` | Archive organisation |
| GET | `/api/v1/plants` | List plants |
| POST | `/api/v1/plants` | Create plant |
| GET | `/api/v1/departments` | List departments |
| POST | `/api/v1/departments` | Create department |
| GET | `/api/v1/locations` | List locations |
| POST | `/api/v1/locations` | Create location |

*(Additional CRUD endpoints follow the same RESTful pattern for workstations, machinery, templates and workflow configuration.)*

---

# **5.10.14 Positive Use Cases**

* Register organisation successfully.  
* Create organisational hierarchy.  
* Configure approval workflow.  
* Publish permit template.  
* Configure PPE catalogue.  
* Configure safety checklist.  
* Save notification preferences.

---

# **5.10.15 Negative Use Cases**

* Duplicate organisation registration.  
* Invalid hierarchy (department without plant).  
* Delete organisation with active dependencies.  
* Publish incomplete permit template.  
* Configure workflow with no approvers.  
* Assign duplicate hierarchy names within the same parent.

---

# **5.10.16 Positive Test Cases**

| ID | Description |
| ----- | ----- |
| TC-ORG-001 | Register organisation successfully |
| TC-ORG-002 | Create plant |
| TC-ORG-003 | Create department |
| TC-ORG-004 | Create location |
| TC-ORG-005 | Configure approval workflow |
| TC-ORG-006 | Publish permit template |
| TC-ORG-007 | Configure notification preferences |

---

# **5.10.17 Negative Test Cases**

| ID | Description |
| ----- | ----- |
| NTC-ORG-001 | Duplicate organisation name |
| NTC-ORG-002 | Invalid parent hierarchy |
| NTC-ORG-003 | Missing mandatory fields |
| NTC-ORG-004 | Unauthorised access |
| NTC-ORG-005 | Invalid workflow configuration |
| NTC-ORG-006 | Invalid template publication |

---

# **5.10.18 Acceptance Criteria**

* Organisation can be created and managed.  
* Tenant isolation is enforced.  
* Organisational hierarchy is maintained correctly.  
* Approval workflows can be configured.  
* Permit templates can be published.  
* Safety checklists and PPE catalogues are configurable.  
* Notification preferences are organisation-specific.  
* Audit logs are generated for administrative changes.

---

# **5.10.19 Negative Acceptance Criteria**

* The system shall not permit duplicate organisation names within the same tenant scope.  
* The system shall not allow orphaned hierarchy records (e.g., a department without a plant).  
* The system shall not publish permit templates that fail validation.  
* The system shall not allow users without the appropriate administrative role to modify organisational data.  
* The system shall not allow deletion of organisational entities that are referenced by active operational records unless the business rules explicitly permit archival.

---

# **5.10.20 Definition of Done**

This sprint is complete when:

* All FR-ORG-001 to FR-ORG-011 requirements are implemented.  
* Web administration interfaces are operational.  
* Organisation APIs pass functional and integration tests.  
* Database schema and migrations are reviewed and applied successfully.  
* Role-based access controls are enforced and verified.  
* Positive and negative test cases pass.  
* Acceptance criteria are satisfied.  
* The Organisation Management module is ready to support Workforce Management in SP-01.03.

---

# **5.11 Sprint SP-01.03 – Workforce Management**

## **5.11.1 Sprint Overview**

| Attribute | Value |
| ----- | ----- |
| Sprint ID | SP-01.03 |
| Sprint Name | Workforce Management |
| Milestone | MS-01 – Platform Foundation |
| Sprint Type | Feature Sprint |
| Priority | Critical |
| Estimated Duration | 2 Weeks |
| Dependencies | SP-01.01 – Platform Infrastructure, SP-01.02 – Organisation Management |

---

# **5.11.2 Functional Requirements Covered**

This sprint implements the Workforce Management module by delivering functionality related to employee administration, contractor management, agency management, user accounts, organisational roles and competency records.

| Functional Requirement | Description |
| ----- | ----- |
| FR-WFM-001 | Employee registration |
| FR-WFM-002 | Contractor registration |
| FR-WFM-003 | Agency association |
| FR-WFM-004 | Role assignment |
| FR-WFM-005 | Organisational responsibilities |
| FR-WFM-006 | Department assignment |
| FR-WFM-007 | Competency & certification management |
| FR-WFM-008 | Workforce activation & deactivation |

---

# **5.11.3 Sprint Objectives**

The objective of this sprint is to establish a complete workforce management system that enables organisations to manage all personnel participating in Permit-to-Work activities.

Upon completion, administrators shall be able to:

* Register employees.  
* Register contractors.  
* Register contractor agencies.  
* Assign organisational roles.  
* Assign operational responsibilities.  
* Track competencies and certifications.  
* Activate and deactivate workforce records.

The workforce data created in this sprint will be consumed by Permit-to-Work, LOTOTO, SIMOPS and Incident Management.

---

# **5.11.4 Dependencies**

This sprint depends on:

| Sprint | Dependency |
| ----- | ----- |
| SP-01.01 | Authentication & RBAC |
| SP-01.02 | Organisation hierarchy |
| SP-01.02 | Plants |
| SP-01.02 | Departments |
| SP-01.02 | Locations |

Subsequent dependent sprints include:

* SP-02.01 Permit Creation  
* SP-02.02 Permit Approval  
* SP-03 LOTOTO  
* SP-05 Multi-Day Permit  
* SP-06 Incident Management

---

# **5.11.5 User Stories**

---

### **US-WFM-001**

**As a System Administrator, I want to register employees so that they can participate in operational workflows.**

---

### **US-WFM-002**

**As a System Administrator, I want to register contractors and agencies so that external personnel can safely participate in hazardous work.**

---

### **US-WFM-003**

**As a System Administrator, I want to assign organisational roles so that each user receives appropriate permissions.**

---

### **US-WFM-004**

**As a System Administrator, I want to manage competency records and certifications so that only qualified personnel perform hazardous work.**

---

### **US-WFM-005**

**As a System Administrator, I want to activate or deactivate workforce records without deleting historical operational data.**

---

# **5.11.6 Use Cases**

---

## **UC-WFM-001**

### **Register Employee**

**Primary Actor**

System Administrator

#### **Preconditions**

* Administrator authenticated.  
* Organisation exists.  
* Department exists.

#### **Main Flow**

1. Select Employee Management.  
2. Click **Register Employee**.  
3. Enter employee details.  
4. Assign department.  
5. Assign organisational role.  
6. Save employee.  
7. System creates user profile.  
8. Audit record generated.

#### **Postconditions**

Employee becomes available throughout the platform.

---

## **UC-WFM-002**

### **Register Contractor**

**Primary Actor**

System Administrator

#### **Main Flow**

1. Select Contractor Management.  
2. Enter contractor details.  
3. Select agency.  
4. Upload competency information.  
5. Save contractor.

---

## **UC-WFM-003**

### **Assign Organisational Role**

#### **Main Flow**

1. Open workforce profile.  
2. Select organisational role.  
3. Assign operational responsibility.  
4. Save changes.

---

## **UC-WFM-004**

### **Update Competency Record**

#### **Main Flow**

1. Select employee.  
2. Open competency profile.  
3. Add certification.  
4. Enter expiry date.  
5. Upload supporting evidence.  
6. Save record.

---

## **UC-WFM-005**

### **Deactivate Workforce Record**

#### **Main Flow**

1. Open workforce profile.  
2. Select **Deactivate**.  
3. Enter reason.  
4. Confirm action.  
5. System disables future assignment.

Historical records remain unchanged.

---

# **5.11.7 Functional Criteria**

| ID | Functional Criterion |
| ----- | ----- |
| FC-WFM-001 | Every employee belongs to one organisation. |
| FC-WFM-002 | Employees shall belong to a department. |
| FC-WFM-003 | Contractors may belong to an agency. |
| FC-WFM-004 | Every user shall have at least one organisational role. |
| FC-WFM-005 | Certifications may include expiry dates. |
| FC-WFM-006 | Deactivated users cannot be assigned to new permits. |
| FC-WFM-007 | Historical assignments remain unchanged after deactivation. |
| FC-WFM-008 | Competency records support multiple certifications. |

---

# **5.11.8 Backend Implementation (NestJS)**

### **Modules**

* Employee Module  
* Contractor Module  
* Agency Module  
* User Module  
* Role Module  
* Competency Module

### **Controllers**

* EmployeeController  
* ContractorController  
* AgencyController  
* UserController  
* CompetencyController

### **Services**

* EmployeeService  
* ContractorService  
* AgencyService  
* UserService  
* RoleAssignmentService  
* CompetencyService

### **DTOs**

* CreateEmployeeDto  
* UpdateEmployeeDto  
* CreateContractorDto  
* CreateAgencyDto  
* AssignRoleDto  
* CompetencyDto

### **Validation**

* Duplicate employee validation  
* Duplicate contractor validation  
* Department validation  
* Agency validation  
* Certification validation

---

# **5.11.9 Frontend Implementation (Next.js)**

Pages

* Employee Management  
* Contractor Management  
* Agency Management  
* Workforce Directory  
* User Roles  
* Competencies  
* Certifications

Reusable Components

* Workforce Table  
* Employee Card  
* Contractor Card  
* Competency Timeline  
* Certification Upload  
* Status Badge  
* Search  
* Filters  
* Pagination  
* Confirmation Dialog

---

# **5.11.10 Mobile Implementation (React Native)**

Screens

* My Profile  
* Workforce Directory  
* Competencies  
* Certifications

Capabilities

* View assigned role  
* View competency records  
* Offline workforce directory  
* Local synchronisation

---

# **5.11.11 Database Implementation**

Tables

* employees  
* contractors  
* agencies  
* users  
* roles  
* user\_roles  
* competencies  
* certifications

Implementation Activities

* Foreign key constraints  
* Drizzle schema  
* UUID generation  
* Soft delete  
* Audit fields  
* Migration scripts

---

# **5.11.12 Infrastructure Dependencies**

* Keycloak user provisioning  
* Redis caching  
* MinIO storage for certification documents  
* BullMQ background reminders for certification expiry  
* Grafana Loki audit logging

---

# **5.11.13 API Endpoints**

| Method | Endpoint | Purpose |
| ----- | ----- | ----- |
| POST | `/api/v1/employees` | Create employee |
| GET | `/api/v1/employees` | List employees |
| PATCH | `/api/v1/employees/{id}` | Update employee |
| DELETE | `/api/v1/employees/{id}` | Archive employee |
| POST | `/api/v1/contractors` | Register contractor |
| GET | `/api/v1/contractors` | List contractors |
| POST | `/api/v1/agencies` | Register agency |
| GET | `/api/v1/agencies` | List agencies |
| POST | `/api/v1/users/{id}/roles` | Assign role |
| POST | `/api/v1/competencies` | Create competency |

---

# **5.11.14 Positive Use Cases**

* Register employee.  
* Register contractor.  
* Register agency.  
* Assign organisational role.  
* Upload certification.  
* Activate workforce record.  
* Deactivate workforce record.

---

# **5.11.15 Negative Use Cases**

* Register duplicate employee.  
* Assign invalid department.  
* Assign inactive role.  
* Upload expired certification.  
* Delete workforce member with active permits.  
* Register contractor without required information.

---

# **5.11.16 Positive Test Cases**

| ID | Description |
| ----- | ----- |
| TC-WFM-001 | Register employee |
| TC-WFM-002 | Register contractor |
| TC-WFM-003 | Register agency |
| TC-WFM-004 | Assign role |
| TC-WFM-005 | Upload certification |
| TC-WFM-006 | Deactivate workforce record |

---

# **5.11.17 Negative Test Cases**

| ID | Description |
| ----- | ----- |
| NTC-WFM-001 | Duplicate employee |
| NTC-WFM-002 | Missing mandatory fields |
| NTC-WFM-003 | Invalid department |
| NTC-WFM-004 | Invalid certification |
| NTC-WFM-005 | Unauthorised role assignment |
| NTC-WFM-006 | Assign deactivated employee to permit |

---

# **5.11.18 Acceptance Criteria**

* Employees can be registered and managed.  
* Contractors and agencies can be managed.  
* Organisational roles are configurable.  
* Competencies and certifications are maintained.  
* Workforce activation and deactivation functions correctly.  
* Audit logs capture workforce changes.  
* Workforce records integrate with organisational hierarchy.

---

# **5.11.19 Negative Acceptance Criteria**

* The system shall not allow duplicate workforce records within the same organisation.  
* The system shall not allow assignment of inactive or deactivated personnel to future operational activities.  
* The system shall not allow users to assign roles beyond their administrative permissions.  
* The system shall not delete workforce records that are referenced by historical permits or incidents.  
* The system shall not accept invalid or incomplete certification data.

---

# **5.11.20 Definition of Done**

This sprint is complete when:

* All FR-WFM-001 to FR-WFM-008 requirements are implemented.  
* Workforce administration is fully operational.  
* Employee, contractor and agency management interfaces are complete.  
* Workforce APIs pass functional and integration testing.  
* Competency and certification records are operational.  
* Role assignments integrate correctly with Keycloak and platform RBAC.  
* Positive and negative test cases pass.  
* Acceptance criteria are satisfied.

---

---

# **5.12 Sprint SP-01.04 – Master Data Management**

## **5.12.1 Sprint Overview**

| Attribute | Value |
| ----- | ----- |
| Sprint ID | SP-01.04 |
| Sprint Name | Master Data Management |
| Milestone | MS-01 – Platform Foundation |
| Sprint Type | Feature Sprint |
| Priority | Critical |
| Estimated Duration | 2 Weeks |
| Dependencies | SP-01.01 – Platform Infrastructure, SP-01.02 – Organisation Management, SP-01.03 – Workforce Management |

---

# **5.12.2 Functional Requirements Covered**

This sprint implements the Master Data Management module by delivering configurable operational reference data that will be consumed throughout the Permit-to-Work platform.

| Functional Requirement | Description |
| ----- | ----- |
| FR-MDM-001 | Permit Type Management |
| FR-MDM-002 | PPE Catalogue Management |
| FR-MDM-003 | Machinery Catalogue Management |
| FR-MDM-004 | Workstation Catalogue Management |
| FR-MDM-005 | Hazard Classification Management |
| FR-MDM-006 | Safety Checklist Management |
| FR-MDM-007 | Bulk Import of Master Data |

---

# **5.12.3 Sprint Objectives**

The objective of this sprint is to establish a centralised repository of operational reference data that supports consistency across all platform modules.

Upon completion, administrators shall be able to:

* Create and manage permit types.  
* Configure PPE catalogues.  
* Maintain machinery catalogues.  
* Maintain workstation catalogues.  
* Configure hazard classifications.  
* Configure reusable safety checklists.  
* Import master data in bulk.

The master data configured in this sprint shall be referenced by Permit-to-Work, LOTOTO, SIMOPS, Incident Management and Reporting.

---

# **5.12.4 Dependencies**

This sprint depends on:

| Sprint | Dependency |
| ----- | ----- |
| SP-01.01 | Authentication & Infrastructure |
| SP-01.02 | Organisation Management |
| SP-01.03 | Workforce Management |

Subsequent dependent sprints include:

* SP-02.01 Permit Creation  
* SP-03.01 LOTOTO Configuration  
* SP-04.01 SIMOPS  
* SP-06.01 Incident Recording

---

# **5.12.5 User Stories**

---

### **US-MDM-001**

**As a System Administrator, I want to configure permit types so that organisations can standardise hazardous work categories.**

---

### **US-MDM-002**

**As a System Administrator, I want to maintain a PPE catalogue so that appropriate protective equipment can be selected during permit creation.**

---

### **US-MDM-003**

**As a System Administrator, I want to maintain machinery and workstation catalogues so that permits reference valid operational assets.**

---

### **US-MDM-004**

**As a System Administrator, I want to configure hazard classifications and reusable safety checklists so that safety assessments remain consistent across permits.**

---

### **US-MDM-005**

**As a System Administrator, I want to import master data in bulk so that existing organisational information can be migrated efficiently into the platform.**

---

# **5.12.6 Use Cases**

---

## **UC-MDM-001**

### **Create Permit Type**

**Primary Actor**

System Administrator

#### **Preconditions**

* Administrator authenticated.  
* Organisation exists.

#### **Main Flow**

1. Open Permit Types.  
2. Select **Create Permit Type**.  
3. Enter permit type details.  
4. Configure default attributes.  
5. Save permit type.  
6. Audit record generated.

#### **Postconditions**

Permit type becomes available for Permit-to-Work creation.

---

## **UC-MDM-002**

### **Configure PPE Catalogue**

#### **Main Flow**

1. Open PPE Catalogue.  
2. Add PPE item.  
3. Specify category.  
4. Save catalogue entry.

#### **Postconditions**

PPE item becomes selectable throughout the platform.

---

## **UC-MDM-003**

### **Configure Hazard Classification**

#### **Main Flow**

1. Open Hazard Classifications.  
2. Create hazard category.  
3. Define description and severity.  
4. Save configuration.

---

## **UC-MDM-004**

### **Create Safety Checklist**

#### **Main Flow**

1. Select Safety Checklists.  
2. Create checklist.  
3. Add checklist items.  
4. Mark mandatory items.  
5. Publish checklist.

---

## **UC-MDM-005**

### **Bulk Import Master Data**

#### **Main Flow**

1. Download import template.  
2. Populate template.  
3. Upload file.  
4. Validate records.  
5. Display validation summary.  
6. Import valid records.  
7. Generate import report.

---

# **5.12.7 Functional Criteria**

| ID | Functional Criterion |
| ----- | ----- |
| FC-MDM-001 | Permit types shall be unique within an organisation. |
| FC-MDM-002 | PPE items shall support categorisation. |
| FC-MDM-003 | Machinery shall belong to a workstation. |
| FC-MDM-004 | Hazard classifications shall be reusable. |
| FC-MDM-005 | Safety checklists shall support mandatory and optional items. |
| FC-MDM-006 | Bulk imports shall validate all records before processing. |
| FC-MDM-007 | Failed records shall not prevent valid records from being imported when partial import is enabled. |

---

# **5.12.8 Backend Implementation (NestJS)**

### **Modules**

* Permit Type Module  
* PPE Module  
* Machinery Module  
* Workstation Catalogue Module  
* Hazard Module  
* Safety Checklist Module  
* Bulk Import Module

### **Controllers**

* PermitTypeController  
* PPEController  
* MachineryController  
* WorkstationController  
* HazardController  
* ChecklistController  
* ImportController

### **Services**

* PermitTypeService  
* PPEService  
* MachineryService  
* WorkstationService  
* HazardService  
* ChecklistService  
* ImportService

### **DTOs**

* CreatePermitTypeDto  
* CreatePPEDto  
* CreateMachineryDto  
* CreateHazardDto  
* CreateChecklistDto  
* BulkImportDto

### **Validation**

* Duplicate master data validation  
* Reference integrity validation  
* Import file validation  
* Mandatory field validation  
* File format validation

---

# **5.12.9 Frontend Implementation (Next.js)**

Pages

* Permit Types  
* PPE Catalogue  
* Machinery Catalogue  
* Workstation Catalogue  
* Hazard Classifications  
* Safety Checklists  
* Bulk Import Centre

Reusable Components

* Master Data Table  
* Import Wizard  
* Validation Summary  
* File Upload  
* Search  
* Filters  
* Category Tree  
* Preview Dialog  
* Import History

---

# **5.12.10 Mobile Implementation (React Native)**

Screens

* Permit Types (Read-only)  
* PPE Catalogue  
* Hazard Catalogue  
* Safety Checklists

Capabilities

* Offline caching  
* Automatic synchronisation  
* Reference data refresh

---

# **5.12.11 Database Implementation**

Tables

* permit\_types  
* ppe\_catalogue  
* machinery\_catalogue  
* workstation\_catalogue  
* hazard\_categories  
* safety\_checklists  
* safety\_checklist\_items  
* import\_jobs  
* import\_job\_results

Implementation Activities

* Drizzle schema definitions  
* Foreign key constraints  
* Import transaction support  
* Audit fields  
* Migration scripts  
* Seed data

---

# **5.12.12 Infrastructure Dependencies**

* Redis caching for frequently accessed master data  
* BullMQ processing for asynchronous bulk imports  
* MinIO storage for import files  
* Grafana Loki logging of import operations  
* Keycloak administrator permissions

---

# **5.12.13 API Endpoints**

| Method | Endpoint | Purpose |
| ----- | ----- | ----- |
| POST | `/api/v1/permit-types` | Create permit type |
| GET | `/api/v1/permit-types` | List permit types |
| POST | `/api/v1/ppe` | Create PPE item |
| GET | `/api/v1/ppe` | List PPE catalogue |
| POST | `/api/v1/hazards` | Create hazard category |
| GET | `/api/v1/hazards` | List hazard categories |
| POST | `/api/v1/checklists` | Create safety checklist |
| GET | `/api/v1/checklists` | List safety checklists |
| POST | `/api/v1/imports/master-data` | Upload import file |
| GET | `/api/v1/imports/{id}` | Import status |

---

# **5.12.14 Positive Use Cases**

* Create permit type.  
* Configure PPE catalogue.  
* Register machinery.  
* Register workstation.  
* Create hazard category.  
* Publish safety checklist.  
* Successfully import master data.

---

# **5.12.15 Negative Use Cases**

* Duplicate permit type.  
* Duplicate hazard category.  
* Invalid PPE category.  
* Invalid machinery reference.  
* Publish empty checklist.  
* Upload unsupported import file.  
* Import records with invalid references.

---

# **5.12.16 Positive Test Cases**

| ID | Description |
| ----- | ----- |
| TC-MDM-001 | Create permit type |
| TC-MDM-002 | Create PPE item |
| TC-MDM-003 | Register machinery |
| TC-MDM-004 | Create hazard category |
| TC-MDM-005 | Publish checklist |
| TC-MDM-006 | Successful bulk import |

---

# **5.12.17 Negative Test Cases**

| ID | Description |
| ----- | ----- |
| NTC-MDM-001 | Duplicate permit type |
| NTC-MDM-002 | Invalid PPE category |
| NTC-MDM-003 | Invalid workstation reference |
| NTC-MDM-004 | Empty checklist |
| NTC-MDM-005 | Invalid import file |
| NTC-MDM-006 | Missing mandatory import fields |

---

# **5.12.18 Acceptance Criteria**

* Permit types can be created and maintained.  
* PPE catalogue is configurable.  
* Machinery and workstation catalogues are operational.  
* Hazard classifications are reusable across modules.  
* Safety checklists support reusable templates.  
* Bulk import validates and processes master data successfully.  
* Audit logs are generated for all master data changes.

---

# **5.12.19 Negative Acceptance Criteria**

* The system shall not permit duplicate master data within the same organisation.  
* The system shall not publish incomplete safety checklists.  
* The system shall not import invalid records without reporting validation failures.  
* The system shall not allow unauthorised users to modify master data.  
* The system shall not create orphaned reference records.

---

# **5.12.20 Definition of Done**

This sprint is complete when:

* All FR-MDM-001 to FR-MDM-007 requirements are implemented.  
* Master data administration is fully operational.  
* Bulk import functionality validates and imports data successfully.  
* Master data APIs pass functional and integration testing.  
* Reference data is synchronised to web and mobile applications.  
* Positive and negative test cases pass.  
* Acceptance criteria are satisfied.

---

# **5.13 Sprint SP-01.05 – Foundation Integration**

## **5.13.1 Sprint Overview**

| Attribute | Value |
| ----- | ----- |
| Sprint ID | SP-01.05 |
| Sprint Name | Foundation Integration |
| Milestone | MS-01 – Platform Foundation |
| Sprint Type | Integration Sprint |
| Priority | Critical |
| Estimated Duration | 1 Week |
| Dependencies | SP-01.02, SP-01.03, SP-01.04 |

---

# **5.13.2 Sprint Objectives**

The objective of this sprint is to integrate all platform foundation modules into a unified administrative platform and verify that they operate together as a single system.

Unlike previous sprints, this sprint introduces minimal new functionality. Instead, it validates interoperability between Organisation Management, Workforce Management and Master Data while ensuring that authentication, authorisation, data isolation and shared infrastructure services function correctly across the platform.

Completion of this sprint establishes the implementation baseline required before development of the Permit-to-Work module begins.

---

# **5.13.3 Integrated Modules**

The following modules shall be integrated during this sprint:

* Organisation Management  
* Workforce Management  
* Master Data Management  
* Authentication & Authorisation  
* Audit Logging  
* Configuration Management  
* Shared UI Components  
* Shared API Infrastructure

---

# **5.13.4 Integration Activities**

### **Organisation Integration**

* Verify organisational hierarchy relationships.  
* Validate tenant isolation.  
* Verify organisation configuration.  
* Confirm approval workflow configuration.  
* Validate notification preferences.

---

### **Workforce Integration**

* Verify employee assignment to organisational hierarchy.  
* Validate contractor-agency relationships.  
* Verify role assignment.  
* Confirm competency records.  
* Validate activation and deactivation workflows.

---

### **Master Data Integration**

* Verify permit types.  
* Verify machinery catalogue.  
* Verify workstation catalogue.  
* Verify PPE catalogue.  
* Verify safety checklist availability.  
* Verify hazard classifications.

---

### **Platform Integration**

* Validate authentication across all modules.  
* Validate RBAC.  
* Validate audit logging.  
* Validate API consistency.  
* Validate frontend navigation.  
* Validate mobile synchronisation.

---

# **5.13.5 Backend Integration**

### **Activities**

* Cross-module service integration.  
* Shared validation verification.  
* Audit logging verification.  
* Permission verification.  
* Shared exception handling.  
* Shared response format verification.

---

# **5.13.6 Frontend Integration**

### **Activities**

* Navigation validation.  
* Shared layout verification.  
* Shared components verification.  
* Breadcrumb navigation.  
* Search consistency.  
* Filter consistency.  
* Theme consistency.  
* Responsive behaviour verification.

---

# **5.13.7 Mobile Integration**

### **Activities**

* Authentication validation.  
* Offline cache verification.  
* Reference data synchronisation.  
* Shared navigation validation.  
* API integration verification.

---

# **5.13.8 Database Integration**

### **Activities**

* Verify foreign key relationships.  
* Verify tenant isolation.  
* Validate migration execution.  
* Validate seed data.  
* Verify audit fields.  
* Validate indexes.

---

# **5.13.9 Infrastructure Verification**

### **Services**

* PostgreSQL  
* Redis  
* BullMQ  
* MinIO  
* Keycloak  
* Grafana Loki  
* Metabase

### **Activities**

* Service connectivity.  
* Configuration validation.  
* Environment verification.  
* Logging verification.  
* Monitoring verification.  
* Queue verification.

---

# **5.13.10 Integration Test Scenarios**

### **Positive Scenarios**

* Administrator logs in successfully.  
* Organisation created successfully.  
* Workforce assigned correctly.  
* Master data available throughout the platform.  
* RBAC enforced correctly.  
* Audit logs generated.  
* Mobile synchronises organisational data.  
* API responses remain consistent across modules.

---

### **Negative Scenarios**

* Cross-tenant data access attempt.  
* Invalid role access.  
* Missing reference data.  
* Invalid organisation hierarchy.  
* Authentication failure.  
* Service unavailable.  
* Invalid API requests.

---

# **5.13.11 Acceptance Criteria**

* Organisation, Workforce and Master Data modules operate as an integrated platform.  
* Shared authentication is operational across web and mobile applications.  
* Tenant isolation is verified.  
* Shared API conventions are implemented consistently.  
* Audit logging captures cross-module activities.  
* Shared UI components function consistently.  
* Infrastructure services operate without integration failures.  
* Platform foundation supports implementation of Permit-to-Work functionality.

---

# **5.13.12 Definition of Done**

The Platform Foundation milestone shall be considered complete when:

* All functional requirements allocated to MS-01 have been implemented.  
* Cross-module integration is verified.  
* Security validation passes.  
* Integration testing is complete.  
* No critical defects remain.  
* Platform foundation is approved for development of MS-02 – Permit-to-Work Core.

---

# **6\. Milestone 2 – Permit-to-Work Core**

## **6.1 Milestone Overview**

### **Milestone ID**

**MS-02**

### **Milestone Name**

**Permit-to-Work Core**

### **Objective**

The Permit-to-Work Core milestone implements the primary business workflow of the platform by digitising the complete permit lifecycle from creation through approval, execution and closure.

This milestone transforms the platform from an administrative configuration system into an operational Permit-to-Work solution capable of managing hazardous work in accordance with organisational safety procedures.

The milestone introduces the central workflow upon which LOTOTO, SIMOPS, Multi-Day Permit Management and Incident Management depend.

---

## **6.2 Business Goals**

The primary goals of this milestone are to:

* Enable digital creation of Permit-to-Work requests.  
* Implement configurable approval workflows.  
* Support permit execution and work progress updates.  
* Enable evidence collection during execution.  
* Support permit verification and closure.  
* Maintain complete auditability throughout the permit lifecycle.  
* Establish the core operational workflow for all subsequent safety modules.

---

## **6.3 Functional Requirements**

This milestone implements the following functional requirements from the Product Requirements Document:

### **Permit Creation**

* FR-PTW-001  
* FR-PTW-002  
* FR-PTW-003

### **Permit Approval**

* FR-PTW-004  
* FR-PTW-005  
* FR-PTW-006

### **Permit Execution**

* FR-PTW-007  
* FR-PTW-008  
* FR-PTW-009

### **Permit Completion**

* FR-PTW-010  
* FR-PTW-011  
* FR-PTW-012

---

## **6.4 Milestone Deliverables**

Upon completion of MS-02, the platform shall support:

### **Permit Creation**

* Create permit requests  
* Save draft permits  
* Configure work scope  
* Assign work locations  
* Select permit types  
* Assign executors  
* Upload supporting documents

---

### **Permit Approval**

* Multi-level approval workflow  
* Approval comments  
* Rejection workflow  
* Deferred approvals  
* Approval history

---

### **Permit Execution**

* Activate approved permits  
* Record work progress  
* Upload execution evidence  
* View active permits  
* Monitor permit status

---

### **Permit Closure**

* Completion verification  
* Final inspection  
* Permit closure  
* Historical archive  
* Audit history

---

## **6.5 Sprint Breakdown**

| Sprint | Sprint Name | Primary Deliverable |
| ----- | ----- | ----- |
| SP-02.01 | Permit Creation | Digital permit request management |
| SP-02.02 | Permit Approval | Configurable approval workflow |
| SP-02.03 | Permit Execution | Active permit management |
| SP-02.04 | Permit Closure | Verification, closure and audit |

---

## **6.6 Technology Allocation**

| Layer | Responsibilities |
| ----- | ----- |
| **Next.js** | Permit creation, approval, execution and closure interfaces |
| **NestJS** | Permit lifecycle services, workflow engine and business rules |
| **PostgreSQL** | Permit records, workflow history, attachments and audit trail |
| **Drizzle ORM** | Permit schema and migrations |
| **Keycloak** | Role-based access for issuers, approvers and executors |
| **Redis** | Caching of frequently accessed permit data |
| **BullMQ** | Background jobs for notifications, reminders and permit expiry |
| **MinIO** | Storage of permit attachments and supporting evidence |
| **React Native** | Permit execution, work progress and evidence capture |
| **Grafana Loki** | Permit lifecycle logging |
| **Metabase** | Operational reporting dataset preparation |

---

## **6.7 Exit Criteria**

MS-02 shall be considered complete when:

* All FR-PTW-001 to FR-PTW-012 requirements are implemented.  
* The complete permit lifecycle operates successfully from creation to closure.  
* Workflow routing and approvals function according to configured organisational rules.  
* Web and mobile applications support their respective operational responsibilities.  
* Supporting evidence is captured and linked to permits.  
* Audit history is maintained for all permit lifecycle events.  
* Positive and negative test cases pass.  
* The Permit-to-Work module is ready for integration with LOTOTO in MS-03.

---

# **6.8 Sprint SP-02.01 – Permit Creation**

## **6.8.1 Sprint Overview**

| Attribute | Value |
| ----- | ----- |
| Sprint ID | SP-02.01 |
| Sprint Name | Permit Creation |
| Milestone | MS-02 – Permit-to-Work Core |
| Sprint Type | Feature Sprint |
| Priority | Critical |
| Estimated Duration | 3 Weeks |
| Dependencies | MS-01 – Platform Foundation |

---

# **6.8.2 Functional Requirements Covered**

This sprint implements the creation of Permit-to-Work requests by providing administrators and Job Issuers with the ability to initiate hazardous work through configurable permit templates.

| Functional Requirement | Description |
| ----- | ----- |
| FR-PTW-001 | Create Permit-to-Work request |
| FR-PTW-002 | Capture permit information |
| FR-PTW-003 | Support configurable permit types |

---

# **6.8.3 Sprint Objectives**

The objective of this sprint is to implement the initial stage of the Permit-to-Work lifecycle by enabling authorised users to create complete permit requests.

Upon completion of this sprint, Job Issuers shall be able to:

* Create new permit requests.  
* Save permit drafts.  
* Select permit types.  
* Select operational locations.  
* Assign executors.  
* Define work scope.  
* Record hazards.  
* Select required PPE.  
* Attach supporting documents.  
* Submit permits for approval.

The sprint also establishes the initial permit workflow state that will be consumed during the Permit Approval sprint.

---

# **6.8.4 Dependencies**

This sprint depends on the successful completion of:

| Sprint | Dependency |
| ----- | ----- |
| SP-01.02 | Organisation Management |
| SP-01.03 | Workforce Management |
| SP-01.04 | Master Data Management |
| SP-01.05 | Foundation Integration |

Subsequent dependent sprints include:

* SP-02.02 Permit Approval  
* SP-03.01 LOTOTO Configuration  
* SP-04.01 SIMOPS Detection  
* SP-05.01 Multi-Day Permit  
* SP-06.01 Incident Recording

---

# **6.8.5 User Stories**

---

### **US-PTW-001**

**As a Job Issuer, I want to create a Permit-to-Work request so that hazardous work can be formally initiated.**

---

### **US-PTW-002**

**As a Job Issuer, I want to save an incomplete permit as a draft so that I can complete it later.**

---

### **US-PTW-003**

**As a Job Issuer, I want to attach supporting documents to a permit so that approvers have sufficient operational information before making approval decisions.**

---

### **US-PTW-004**

**As a Job Issuer, I want the system to validate mandatory information before submission so that incomplete permits cannot enter the approval workflow.**

---

# **6.8.6 Use Cases**

---

## **UC-PTW-001**

### **Create Permit Request**

**Primary Actor**

Job Issuer

---

### **Preconditions**

* User is authenticated.  
* User has Job Issuer permissions.  
* Organisation exists.  
* Organisation hierarchy has been configured.  
* Permit types are available.  
* Required master data exists.

---

### **Trigger**

User selects **Create Permit**.

---

### **Main Flow**

1. Select permit type.  
2. Enter permit title.  
3. Define work scope.  
4. Select plant.  
5. Select department.  
6. Select operational location.  
7. Select workstation or machinery where applicable.  
8. Specify planned start and end date/time.  
9. Assign Job Executor(s).  
10. Identify hazards.  
11. Select required PPE.  
12. Attach supporting documents.  
13. Review permit details.  
14. Save draft or submit permit.  
15. System validates all required information.  
16. Permit is assigned a unique reference number.  
17. Audit log is generated.  
18. Permit status is set to **Pending Approval** when submitted.

---

### **Alternative Flow**

User chooses **Save Draft**.

The system:

* stores the permit with Draft status,  
* allows future editing,  
* does not trigger the approval workflow.

---

### **Exception Flow**

Validation fails.

The system:

* highlights invalid fields,  
* prevents submission,  
* preserves entered information.

---

### **Postconditions**

* Draft permit exists, or  
* Permit enters approval workflow.

---

## **UC-PTW-002**

### **Save Draft Permit**

**Primary Actor**

Job Issuer

**Main Flow**

1. Enter partial permit information.  
2. Select **Save Draft**.  
3. System stores entered information.  
4. Draft becomes editable.

---

## **UC-PTW-003**

### **Upload Supporting Documents**

**Primary Actor**

Job Issuer

**Main Flow**

1. Select upload.  
2. Choose document.  
3. Validate file.  
4. Upload to MinIO.  
5. Associate uploaded document with permit.

---

# **6.8.7 Functional Criteria**

| ID | Functional Criterion |
| ----- | ----- |
| FC-PTW-001 | Every permit shall belong to one organisation. |
| FC-PTW-002 | Permit type is mandatory. |
| FC-PTW-003 | Work location is mandatory. |
| FC-PTW-004 | Planned execution dates are mandatory. |
| FC-PTW-005 | At least one Job Executor shall be assigned before submission. |
| FC-PTW-006 | Hazards shall be recorded. |
| FC-PTW-007 | Required PPE shall be selected. |
| FC-PTW-008 | Supporting documents are optional unless required by the selected permit type. |
| FC-PTW-009 | Draft permits remain editable. |
| FC-PTW-010 | Submitted permits become read-only for the Job Issuer until returned or rejected. |

---

# **6.8.8 Backend Implementation (NestJS)**

### **Modules**

* Permit Module  
* Draft Module  
* Attachment Module

### **Controllers**

* PermitController  
* DraftController  
* AttachmentController

### **Services**

* PermitService  
* DraftService  
* AttachmentService  
* PermitValidationService

### **DTOs**

* CreatePermitDto  
* UpdatePermitDto  
* SaveDraftDto  
* UploadAttachmentDto

### **Validation**

* Mandatory field validation  
* Date validation  
* Executor validation  
* PPE validation  
* Hazard validation  
* File validation  
* Duplicate submission prevention

---

# **6.8.9 Frontend Implementation (Next.js)**

Pages

* Permit Dashboard  
* Create Permit  
* Edit Draft  
* Draft Permits  
* Permit Preview

Components

* Permit Wizard  
* Step Navigation  
* Permit Summary  
* Hazard Selector  
* PPE Selector  
* Executor Selector  
* Location Selector  
* Attachment Upload  
* Draft Banner  
* Validation Summary

---

# **6.8.10 Mobile Implementation (React Native)**

Screens

* Create Permit  
* Draft Permits  
* My Submitted Permits

Capabilities

* Offline draft creation  
* Attachment upload queue  
* Automatic synchronisation  
* Draft editing

---

# **6.8.11 Database Implementation**

Tables

* permits  
* permit\_drafts  
* permit\_attachments  
* permit\_hazards  
* permit\_ppe  
* permit\_executors

Implementation Activities

* Permit reference generation  
* Status management  
* Foreign key constraints  
* Attachment metadata  
* Audit fields  
* Migration scripts

---

# **6.8.12 Infrastructure Dependencies**

* Keycloak role validation  
* Redis caching of reference data  
* BullMQ draft clean-up and future notification jobs  
* MinIO storage for attachments  
* Grafana Loki logging of permit creation events

---

# **6.8.13 API Endpoints**

| Method | Endpoint | Purpose |
| ----- | ----- | ----- |
| POST | `/api/v1/permits` | Create permit |
| GET | `/api/v1/permits` | List permits |
| GET | `/api/v1/permits/{id}` | View permit |
| PATCH | `/api/v1/permits/{id}` | Update draft |
| POST | `/api/v1/permits/{id}/submit` | Submit permit |
| POST | `/api/v1/permits/{id}/attachments` | Upload attachment |
| DELETE | `/api/v1/permits/{id}/attachments/{attachmentId}` | Remove attachment |

---

# **6.8.14 Positive Use Cases**

* Create permit successfully.  
* Save draft.  
* Edit draft.  
* Upload supporting documents.  
* Submit permit.  
* Create different permit types.

---

# **6.8.15 Negative Use Cases**

* Submit without permit type.  
* Submit without executor.  
* Submit with invalid dates.  
* Upload unsupported file type.  
* Submit permit after session expiry.  
* Edit submitted permit without appropriate permissions.

---

# **6.8.16 Positive Test Cases**

| ID | Description |
| ----- | ----- |
| TC-PTW-001 | Create permit |
| TC-PTW-002 | Save draft |
| TC-PTW-003 | Edit draft |
| TC-PTW-004 | Submit permit |
| TC-PTW-005 | Upload attachment |
| TC-PTW-006 | Create permit with different permit types |

---

# **6.8.17 Negative Test Cases**

| ID | Description |
| ----- | ----- |
| NTC-PTW-001 | Missing permit type |
| NTC-PTW-002 | Missing executor |
| NTC-PTW-003 | Invalid execution dates |
| NTC-PTW-004 | Unsupported attachment |
| NTC-PTW-005 | Unauthorised permit creation |
| NTC-PTW-006 | Submit incomplete permit |

---

# **6.8.18 Acceptance Criteria**

* Job Issuers can create permits.  
* Draft permits can be saved and edited.  
* Permit validation enforces all mandatory information.  
* Supporting documents are stored successfully.  
* Submitted permits receive a unique reference number.  
* Submitted permits enter the approval workflow with a **Pending Approval** status.  
* Audit logs are generated for all creation and submission events.

---

# **6.8.19 Negative Acceptance Criteria**

* The system shall not allow permit submission when mandatory information is missing.  
* The system shall not allow unauthorised users to create or submit permits.  
* The system shall not permit invalid execution dates.  
* The system shall not accept unsupported attachment formats or files exceeding configured limits.  
* The system shall not permit modification of submitted permits unless returned by the approval workflow or explicitly editable under organisational rules.

---

# **6.8.20 Definition of Done**

This sprint is complete when:

* All FR-PTW-001 to FR-PTW-003 requirements are implemented.  
* Draft and submission workflows are operational.  
* Permit creation APIs pass functional and integration testing.  
* Web and mobile permit creation interfaces are complete.  
* Attachments are stored and retrieved successfully.  
* Positive and negative test cases pass.  
* Acceptance criteria are satisfied.

---

# **6.9 Sprint SP-02.02 – Permit Approval**

## **6.9.1 Sprint Overview**

| Attribute | Value |
| ----- | ----- |
| Sprint ID | SP-02.02 |
| Sprint Name | Permit Approval |
| Milestone | MS-02 – Permit-to-Work Core |
| Sprint Type | Feature Sprint |
| Priority | Critical |
| Estimated Duration | 2 Weeks |
| Dependencies | SP-02.01 – Permit Creation |

---

# **6.9.2 Functional Requirements Covered**

This sprint implements the configurable approval workflow that evaluates Permit-to-Work requests before hazardous work may commence.

| Functional Requirement | Description |
| ----- | ----- |
| FR-PTW-004 | Configurable approval workflow |
| FR-PTW-005 | Approve, reject or defer permits |
| FR-PTW-006 | Approval comments |

---

# **6.9.3 Sprint Objectives**

The objective of this sprint is to implement a configurable approval workflow that routes permit requests through authorised reviewers before execution.

Upon completion of this sprint:

* Submitted permits shall enter the approval workflow.  
* Approvers shall review assigned permits.  
* Approvers shall approve, reject or defer permits.  
* Approval comments shall be recorded.  
* Complete approval history shall be maintained.  
* Approved permits shall transition to the execution phase.

---

# **6.9.4 Dependencies**

This sprint depends on:

| Sprint | Dependency |
| ----- | ----- |
| SP-01.02 | Organisation Management |
| SP-01.03 | Workforce Management |
| SP-01.04 | Master Data Management |
| SP-02.01 | Permit Creation |

Subsequent dependent sprints:

* SP-02.03 Permit Execution  
* SP-03 LOTOTO  
* SP-04 SIMOPS

---

# **6.9.5 User Stories**

---

### **US-PTW-005**

**As a Safety Officer, I want to review permit requests so that hazardous work satisfies organisational safety requirements before execution.**

---

### **US-PTW-006**

**As a Head of Department, I want to approve or reject permits so that only authorised work proceeds.**

---

### **US-PTW-007**

**As an Approver, I want to defer permits requiring clarification so that incomplete requests can be corrected without rejection.**

---

### **US-PTW-008**

**As a Job Issuer, I want to view the approval status of submitted permits so that I know when work can begin.**

---

# **6.9.6 Use Cases**

---

## **UC-PTW-004**

### **Review Permit**

**Primary Actor**

Safety Officer / Head of Department

#### **Preconditions**

* Permit status is **Pending Approval**.  
* User is assigned as an approver.  
* User is authenticated.

#### **Main Flow**

1. Open Approval Queue.  
2. Select permit.  
3. Review permit information.  
4. Review hazards.  
5. Review PPE.  
6. Review attachments.  
7. Review assigned personnel.  
8. Decide approval outcome.

---

## **UC-PTW-005**

### **Approve Permit**

#### **Main Flow**

1. Review permit.  
2. Enter approval comments (if required).  
3. Select **Approve**.  
4. System records approval.  
5. Workflow advances to the next approval stage or marks the permit **Approved** if all approvals are complete.  
6. Audit record generated.  
7. Notifications issued to relevant users.

#### **Postconditions**

Permit status becomes:

* **Approved**, or  
* progresses to the next configured approval stage.

---

## **UC-PTW-006**

### **Reject Permit**

#### **Main Flow**

1. Review permit.  
2. Enter mandatory rejection reason.  
3. Select **Reject**.  
4. System records rejection.  
5. Permit status becomes **Rejected**.  
6. Job Issuer notified.

---

## **UC-PTW-007**

### **Defer Permit**

#### **Main Flow**

1. Review permit.  
2. Enter clarification request.  
3. Select **Defer**.  
4. Permit status becomes **Deferred**.  
5. Job Issuer receives requested changes.  
6. Permit may be resubmitted after modification.

---

# **6.9.7 Business Rules**

| ID | Business Rule |
| ----- | ----- |
| BR-PTW-001 | A permit cannot enter execution until all mandatory approval stages are completed. |
| BR-PTW-002 | Rejection reason is mandatory when rejecting a permit. |
| BR-PTW-003 | Deferred permits remain editable by the Job Issuer. |
| BR-PTW-004 | Every approval action shall generate an audit record. |
| BR-PTW-005 | Workflow sequence shall follow the organisation's configured approval hierarchy. |
| BR-PTW-006 | Only authorised approvers may perform approval actions. |

---

# **6.9.8 Functional Criteria**

| ID | Functional Criterion |
| ----- | ----- |
| FC-PTW-011 | Approval workflow shall support multiple approval stages. |
| FC-PTW-012 | Approval comments shall be permanently stored. |
| FC-PTW-013 | Approval history shall be immutable. |
| FC-PTW-014 | Permit status shall update automatically after each approval action. |
| FC-PTW-015 | Workflow notifications shall be generated automatically. |
| FC-PTW-016 | Only users assigned to the current approval stage may approve the permit. |

---

# **6.9.9 Backend Implementation (NestJS)**

### **Modules**

* Approval Module  
* Workflow Module  
* Approval History Module

### **Controllers**

* ApprovalController  
* WorkflowController

### **Services**

* ApprovalService  
* WorkflowEngineService  
* ApprovalHistoryService  
* NotificationService

### **DTOs**

* ApprovePermitDto  
* RejectPermitDto  
* DeferPermitDto  
* ApprovalCommentDto

### **Validation**

* Current approval stage validation  
* User permission validation  
* Workflow state validation  
* Mandatory comment validation  
* Duplicate approval prevention

---

# **6.9.10 Frontend Implementation (Next.js)**

Pages

* Approval Queue  
* Permit Review  
* Approval History  
* Deferred Permits

Components

* Workflow Timeline  
* Approval Card  
* Approval Action Dialog  
* Rejection Dialog  
* Defer Dialog  
* Comment Panel  
* Status Badge  
* Approval Progress Indicator

---

# **6.9.11 Mobile Implementation (React Native)**

Screens

* Pending Approvals  
* Permit Review  
* Approval History

Capabilities

* Review permit details  
* Approve, reject or defer permits  
* Add approval comments  
* Receive push notifications for assigned approvals

---

# **6.9.12 Database Implementation**

Tables

* permit\_approvals  
* approval\_history  
* workflow\_steps  
* workflow\_assignments

Implementation Activities

* Workflow sequencing  
* Approval timestamps  
* Immutable history records  
* Audit field updates  
* Migration scripts

---

# **6.9.13 Infrastructure Dependencies**

* BullMQ for approval notifications and reminders  
* Redis caching for approval queues  
* MinIO access for reviewing attachments  
* Keycloak role validation  
* Grafana Loki logging for approval events

---

# **6.9.14 API Endpoints**

| Method | Endpoint | Purpose |
| ----- | ----- | ----- |
| GET | `/api/v1/approvals` | List pending approvals |
| GET | `/api/v1/approvals/{permitId}` | Review permit |
| POST | `/api/v1/approvals/{permitId}/approve` | Approve permit |
| POST | `/api/v1/approvals/{permitId}/reject` | Reject permit |
| POST | `/api/v1/approvals/{permitId}/defer` | Defer permit |
| GET | `/api/v1/approvals/{permitId}/history` | View approval history |

---

# **6.9.15 Positive Use Cases**

* Approve permit.  
* Reject permit.  
* Defer permit.  
* View approval history.  
* Progress through multiple approval stages.  
* Receive approval notifications.

---

# **6.9.16 Negative Use Cases**

* Approve without permission.  
* Approve already approved permit.  
* Reject without reason.  
* Skip approval stage.  
* Modify approval history.  
* Approve expired permit.

---

# **6.9.17 Positive Test Cases**

| ID | Description |
| ----- | ----- |
| TC-PTW-007 | Approve permit |
| TC-PTW-008 | Reject permit |
| TC-PTW-009 | Defer permit |
| TC-PTW-010 | Multi-stage approval |
| TC-PTW-011 | Approval history |
| TC-PTW-012 | Notification generation |

---

# **6.9.18 Negative Test Cases**

| ID | Description |
| ----- | ----- |
| NTC-PTW-007 | Unauthorised approval |
| NTC-PTW-008 | Reject without reason |
| NTC-PTW-009 | Duplicate approval |
| NTC-PTW-010 | Invalid workflow stage |
| NTC-PTW-011 | Modify approval history |
| NTC-PTW-012 | Approve expired permit |

---

# **6.9.19 Acceptance Criteria**

* Multi-stage approval workflows function correctly.  
* Approvers can approve, reject and defer permits.  
* Approval comments are recorded.  
* Approval history is immutable.  
* Workflow progression follows configured organisational rules.  
* Notifications are generated after approval actions.  
* Approved permits become available for execution.

---

# **6.9.20 Negative Acceptance Criteria**

* The system shall not permit approval by unauthorised users.  
* The system shall not allow approval stages to be skipped.  
* The system shall not permit rejection without a mandatory reason.  
* The system shall not allow modification of completed approval history.  
* The system shall not transition a permit to **Approved** until all mandatory approval stages have been completed.

---

# **6.9.21 Definition of Done**

This sprint is complete when:

* All FR-PTW-004 to FR-PTW-006 requirements are implemented.  
* Multi-stage approval workflows are operational.  
* Approval actions update permit status correctly.  
* Approval APIs pass functional and integration testing.  
* Web and mobile approval interfaces are complete.  
* Approval history and audit logging are functioning correctly.  
* Positive and negative test cases pass.  
* Acceptance criteria are satisfied.

---

# **6.10 Sprint SP-02.03 – Permit Execution**

## **6.10.1 Sprint Overview**

| Attribute | Value |
| ----- | ----- |
| Sprint ID | SP-02.03 |
| Sprint Name | Permit Execution |
| Milestone | MS-02 – Permit-to-Work Core |
| Sprint Type | Feature Sprint |
| Priority | Critical |
| Estimated Duration | 3 Weeks |
| Dependencies | SP-02.01 – Permit Creation, SP-02.02 – Permit Approval |

---

# **6.10.2 Functional Requirements Covered**

This sprint implements the execution phase of the Permit-to-Work lifecycle, enabling authorised personnel to commence approved work, monitor execution and record operational progress.

| Functional Requirement | Description |
| ----- | ----- |
| FR-PTW-007 | Permit activation |
| FR-PTW-008 | Work execution & progress tracking |
| FR-PTW-009 | Evidence capture during execution |

---

# **6.10.3 Sprint Objectives**

The objective of this sprint is to enable the controlled execution of approved permits while maintaining operational visibility, accountability and traceability throughout the work lifecycle.

Upon completion of this sprint:

* Approved permits can be activated.  
* Work execution can be started.  
* Progress updates can be recorded.  
* Supporting evidence can be uploaded.  
* Supervisors can monitor active work.  
* Permit status is updated throughout execution.

---

# **6.10.4 Dependencies**

This sprint depends on:

| Sprint | Dependency |
| ----- | ----- |
| SP-02.01 | Permit Creation |
| SP-02.02 | Permit Approval |
| SP-01.03 | Workforce Management |
| SP-01.04 | Master Data |

Subsequent dependent sprints include:

* SP-02.04 Permit Closure  
* SP-03 LOTOTO  
* SP-04 SIMOPS  
* SP-05 Multi-Day Permit  
* SP-06 Incident Management

---

# **6.10.5 User Stories**

---

### **US-PTW-009**

**As a Job Executor, I want to activate an approved permit so that hazardous work can officially commence.**

---

### **US-PTW-010**

**As a Job Executor, I want to record work progress so that supervisors can monitor ongoing activities.**

---

### **US-PTW-011**

**As a Job Executor, I want to upload photographs and supporting evidence during execution so that completed work can be verified.**

---

### **US-PTW-012**

**As a Supervisor, I want to monitor active permits so that I can identify delays, risks or operational issues.**

---

# **6.10.6 Use Cases**

---

## **UC-PTW-008**

### **Activate Permit**

**Primary Actor**

Job Executor

#### **Preconditions**

* Permit status is **Approved**.  
* User is assigned as Job Executor.  
* Permit has not expired.

#### **Main Flow**

1. Open assigned permit.  
2. Review permit conditions.  
3. Confirm readiness.  
4. Select **Start Work**.  
5. System records start time.  
6. Permit status changes to **Active**.  
7. Audit record generated.  
8. Notifications issued.

#### **Postconditions**

Permit enters the Active state.

---

## **UC-PTW-009**

### **Record Progress Update**

#### **Main Flow**

1. Open active permit.  
2. Select **Add Progress Update**.  
3. Enter work summary.  
4. Upload photographs if required.  
5. Save progress update.  
6. System timestamps the update.  
7. Supervisors can immediately view progress.

---

## **UC-PTW-010**

### **Upload Execution Evidence**

#### **Main Flow**

1. Select **Upload Evidence**.  
2. Capture or upload image/document.  
3. Enter optional comments.  
4. Upload file.  
5. System stores evidence in MinIO.  
6. Evidence linked to permit.

---

## **UC-PTW-011**

### **Suspend Active Work**

#### **Main Flow**

1. Open active permit.  
2. Select **Suspend Work**.  
3. Enter suspension reason.  
4. Confirm action.  
5. Permit status changes to **Suspended**.  
6. Supervisor notified.

---

# **6.10.7 Business Rules**

| ID | Business Rule |
| ----- | ----- |
| BR-PTW-007 | Only approved permits may be activated. |
| BR-PTW-008 | Only assigned Job Executors may update execution progress. |
| BR-PTW-009 | Every progress update shall be timestamped. |
| BR-PTW-010 | Evidence shall remain permanently linked to the permit. |
| BR-PTW-011 | Suspended permits shall not resume until authorised by organisational procedures. |
| BR-PTW-012 | All execution activities shall generate audit records. |

---

# **6.10.8 Functional Criteria**

| ID | Functional Criterion |
| ----- | ----- |
| FC-PTW-017 | Permit activation shall record the actual start time. |
| FC-PTW-018 | Progress updates shall support text and attachments. |
| FC-PTW-019 | Multiple evidence files may be uploaded. |
| FC-PTW-020 | Active permit status shall update in real time. |
| FC-PTW-021 | Suspended permits shall display suspension details. |
| FC-PTW-022 | Execution history shall be immutable. |

---

# **6.10.9 Backend Implementation (NestJS)**

### **Modules**

* Execution Module  
* Progress Module  
* Evidence Module

### **Controllers**

* ExecutionController  
* ProgressController  
* EvidenceController

### **Services**

* ExecutionService  
* ProgressService  
* EvidenceService  
* StatusTransitionService

### **DTOs**

* ActivatePermitDto  
* ProgressUpdateDto  
* UploadEvidenceDto  
* SuspendPermitDto

### **Validation**

* Permit status validation  
* Assignment validation  
* File validation  
* Status transition validation  
* Timestamp validation

---

# **6.10.10 Frontend Implementation (Next.js)**

Pages

* Active Permits  
* Permit Execution  
* Progress Timeline  
* Evidence Gallery

Components

* Status Timeline  
* Progress Feed  
* Evidence Upload  
* Camera Upload  
* Activity Log  
* Permit Status Card  
* Supervisor Dashboard Widget  
* Suspension Dialog

---

# **6.10.11 Mobile Implementation (React Native)**

Screens

* Active Permits  
* Execute Permit  
* Progress Updates  
* Camera Upload  
* Evidence Gallery

Capabilities

* Offline progress recording  
* Camera integration  
* Attachment synchronisation  
* GPS capture (optional if enabled)  
* Background upload queue

---

# **6.10.12 Database Implementation**

Tables

* permit\_execution  
* permit\_progress  
* permit\_evidence  
* permit\_status\_history

Implementation Activities

* Execution timestamps  
* Status history  
* Attachment metadata  
* Progress records  
* Migration scripts

---

# **6.10.13 Infrastructure Dependencies**

* Redis for active permit cache  
* BullMQ for progress notifications and reminder jobs  
* MinIO for evidence storage  
* Keycloak role validation  
* Grafana Loki logging for execution activities

---

# **6.10.14 API Endpoints**

| Method | Endpoint | Purpose |
| ----- | ----- | ----- |
| POST | `/api/v1/permits/{id}/activate` | Activate permit |
| POST | `/api/v1/permits/{id}/progress` | Add progress update |
| GET | `/api/v1/permits/{id}/progress` | View progress history |
| POST | `/api/v1/permits/{id}/evidence` | Upload execution evidence |
| GET | `/api/v1/permits/{id}/evidence` | View evidence |
| POST | `/api/v1/permits/{id}/suspend` | Suspend permit |
| POST | `/api/v1/permits/{id}/resume` | Resume permit |

---

# **6.10.15 Positive Use Cases**

* Activate approved permit.  
* Record work progress.  
* Upload photographs.  
* Upload documents.  
* Suspend work.  
* Resume work.  
* Supervisor monitors active work.

---

# **6.10.16 Negative Use Cases**

* Activate unapproved permit.  
* Upload unsupported evidence.  
* Record progress after permit expiry.  
* Suspend completed permit.  
* Resume unauthorised permit.  
* Upload oversized attachments.

---

# **6.10.17 Positive Test Cases**

| ID | Description |
| ----- | ----- |
| TC-PTW-013 | Activate permit |
| TC-PTW-014 | Record progress |
| TC-PTW-015 | Upload evidence |
| TC-PTW-016 | Suspend permit |
| TC-PTW-017 | Resume permit |
| TC-PTW-018 | Supervisor views active permit |

---

# **6.10.18 Negative Test Cases**

| ID | Description |
| ----- | ----- |
| NTC-PTW-013 | Activate without approval |
| NTC-PTW-014 | Invalid attachment |
| NTC-PTW-015 | Progress after closure |
| NTC-PTW-016 | Suspend closed permit |
| NTC-PTW-017 | Resume without permission |
| NTC-PTW-018 | Upload oversized evidence |

---

# **6.10.19 Acceptance Criteria**

* Approved permits can be activated.  
* Progress updates are recorded successfully.  
* Evidence uploads are linked to permits.  
* Supervisors can monitor active permits.  
* Permit status changes are tracked.  
* Execution activities generate audit logs.  
* Mobile execution supports offline operation where applicable.

---

# **6.10.20 Negative Acceptance Criteria**

* The system shall not allow execution of permits that have not completed the approval workflow.  
* The system shall not allow unauthorised users to activate or update permits.  
* The system shall not accept unsupported or invalid evidence uploads.  
* The system shall not allow status transitions that violate the defined permit lifecycle.  
* The system shall not allow modification or deletion of historical execution records.

---

# **6.10.21 Definition of Done**

This sprint is complete when:

* All FR-PTW-007 to FR-PTW-009 requirements are implemented.  
* Permit activation and execution workflows are operational.  
* Progress tracking and evidence management are functional.  
* Execution APIs pass functional and integration testing.  
* Web and mobile execution interfaces are complete.  
* Positive and negative test cases pass.  
* Acceptance criteria are satisfied.

---

# **6.11 Sprint SP-02.04 – Permit Closure**

## **6.11.1 Sprint Overview**

| Attribute | Value |
| ----- | ----- |
| Sprint ID | SP-02.04 |
| Sprint Name | Permit Closure |
| Milestone | MS-02 – Permit-to-Work Core |
| Sprint Type | Feature Sprint |
| Priority | Critical |
| Estimated Duration | 2 Weeks |
| Dependencies | SP-02.03 – Permit Execution |

---

# **6.11.2 Functional Requirements Covered**

This sprint implements the final stage of the Permit-to-Work lifecycle by enabling verification, closure and archival of completed permits.

| Functional Requirement | Description |
| ----- | ----- |
| FR-PTW-010 | Permit completion verification |
| FR-PTW-011 | Permit closure |
| FR-PTW-012 | Historical records and audit trail |

---

# **6.11.3 Sprint Objectives**

The objective of this sprint is to ensure that hazardous work is formally completed, verified and archived before the permit lifecycle is concluded.

Upon completion of this sprint:

* Completed work can be verified.  
* Supervisors can perform final inspections.  
* Permits can be closed.  
* Permit history becomes read-only.  
* Historical records remain searchable.  
* Complete audit history is preserved.

Completion of this sprint marks the completion of the core Permit-to-Work lifecycle.

---

# **6.11.4 Dependencies**

This sprint depends on:

| Sprint | Dependency |
| ----- | ----- |
| SP-02.01 | Permit Creation |
| SP-02.02 | Permit Approval |
| SP-02.03 | Permit Execution |

Subsequent dependent sprints:

* SP-03.01 LOTOTO  
* SP-04.01 SIMOPS  
* SP-05.01 Multi-Day Permit  
* SP-06.01 Incident Management

---

# **6.11.5 User Stories**

---

### **US-PTW-013**

**As a Supervisor, I want to verify completed work before closing a permit so that hazardous work has been completed safely.**

---

### **US-PTW-014**

**As a Safety Officer, I want to review execution history and evidence before approving permit closure so that safety compliance is maintained.**

---

### **US-PTW-015**

**As a Job Issuer, I want completed permits archived automatically so that historical information remains available for audits and reporting.**

---

### **US-PTW-016**

**As an Auditor, I want to access historical permit records so that operational compliance can be reviewed at any time.**

---

# **6.11.6 Use Cases**

---

## **UC-PTW-012**

### **Verify Completed Work**

**Primary Actor**

Supervisor

#### **Preconditions**

* Permit status is **Active**.  
* Work has been completed.  
* All execution updates have been submitted.

#### **Main Flow**

1. Open active permit.  
2. Review execution history.  
3. Review uploaded evidence.  
4. Perform final inspection.  
5. Record verification comments.  
6. Confirm work completion.

---

## **UC-PTW-013**

### **Close Permit**

#### **Main Flow**

1. Open verified permit.  
2. Confirm closure.  
3. System validates closure requirements.  
4. Permit status changes to **Closed**.  
5. Actual completion time recorded.  
6. Audit record generated.  
7. Permit archived.

#### **Postconditions**

Permit becomes read-only.

---

## **UC-PTW-014**

### **View Historical Permit**

#### **Main Flow**

1. Open permit archive.  
2. Search permit.  
3. View permit details.  
4. View approval history.  
5. View execution history.  
6. View attachments.  
7. Export if authorised.

---

# **6.11.7 Business Rules**

| ID | Business Rule |
| ----- | ----- |
| BR-PTW-013 | Only Active permits may be closed. |
| BR-PTW-014 | Closure requires supervisor verification. |
| BR-PTW-015 | Closed permits become read-only. |
| BR-PTW-016 | Historical records shall not be deleted. |
| BR-PTW-017 | Complete audit history shall remain permanently associated with the permit. |
| BR-PTW-018 | Closure time shall be recorded automatically. |

---

# **6.11.8 Functional Criteria**

| ID | Functional Criterion |
| ----- | ----- |
| FC-PTW-023 | Closure requires successful verification. |
| FC-PTW-024 | Closure records actual completion time. |
| FC-PTW-025 | Closed permits remain searchable. |
| FC-PTW-026 | Historical attachments remain accessible. |
| FC-PTW-027 | Audit history remains immutable. |
| FC-PTW-028 | Archived permits support reporting and analytics. |

---

# **6.11.9 Backend Implementation (NestJS)**

### **Modules**

* Closure Module  
* Archive Module  
* History Module

### **Controllers**

* ClosureController  
* ArchiveController

### **Services**

* ClosureService  
* ArchiveService  
* HistoryService  
* VerificationService

### **DTOs**

* ClosePermitDto  
* VerificationDto  
* ArchiveSearchDto

### **Validation**

* Permit status validation  
* Verification validation  
* Completion validation  
* Role validation  
* Archive permission validation

---

# **6.11.10 Frontend Implementation (Next.js)**

Pages

* Permit Verification  
* Permit Closure  
* Permit Archive  
* Historical Permit Viewer

Components

* Verification Checklist  
* Closure Dialog  
* History Timeline  
* Audit Timeline  
* Evidence Gallery  
* Search Filters  
* Export Dialog  
* Read-only Permit Viewer

---

# **6.11.11 Mobile Implementation (React Native)**

Screens

* Permit Verification  
* Permit Summary  
* Historical Permit

Capabilities

* Complete final inspection  
* View execution history  
* View evidence  
* Submit closure verification  
* Offline inspection synchronisation

---

# **6.11.12 Database Implementation**

Tables

* permit\_closures  
* permit\_archive  
* permit\_verifications  
* audit\_history

Implementation Activities

* Archive indexing  
* Read-only enforcement  
* Audit persistence  
* Historical optimisation  
* Migration scripts

---

# **6.11.13 Infrastructure Dependencies**

* Redis caching for archived permit searches  
* BullMQ archival and reporting jobs  
* MinIO long-term attachment storage  
* Keycloak role validation  
* Grafana Loki logging of closure activities

---

# **6.11.14 API Endpoints**

| Method | Endpoint | Purpose |
| ----- | ----- | ----- |
| POST | `/api/v1/permits/{id}/verify` | Verify completed work |
| POST | `/api/v1/permits/{id}/close` | Close permit |
| GET | `/api/v1/permits/archive` | List archived permits |
| GET | `/api/v1/permits/archive/{id}` | View archived permit |
| GET | `/api/v1/permits/{id}/history` | View complete history |
| GET | `/api/v1/permits/{id}/audit` | View audit log |

---

# **6.11.15 Positive Use Cases**

* Verify completed work.  
* Close permit.  
* Search historical permits.  
* View complete audit history.  
* Export permit history.  
* Retrieve archived attachments.

---

# **6.11.16 Negative Use Cases**

* Close permit without verification.  
* Close already closed permit.  
* Modify archived permit.  
* Delete historical records.  
* Access archive without permission.  
* Export restricted permits.

---

# **6.11.17 Positive Test Cases**

| ID | Description |
| ----- | ----- |
| TC-PTW-019 | Verify permit |
| TC-PTW-020 | Close permit |
| TC-PTW-021 | Search archive |
| TC-PTW-022 | View history |
| TC-PTW-023 | Export historical permit |
| TC-PTW-024 | Audit history verification |

---

# **6.11.18 Negative Test Cases**

| ID | Description |
| ----- | ----- |
| NTC-PTW-019 | Close without verification |
| NTC-PTW-020 | Close already closed permit |
| NTC-PTW-021 | Modify archived permit |
| NTC-PTW-022 | Delete historical records |
| NTC-PTW-023 | Unauthorised archive access |
| NTC-PTW-024 | Invalid archive search request |

---

# **6.11.19 Acceptance Criteria**

* Supervisors can verify completed work.  
* Permits can be closed after successful verification.  
* Closed permits become read-only.  
* Historical permits remain searchable.  
* Complete audit history is preserved.  
* Archived attachments remain accessible.  
* Historical permit data supports reporting requirements.

---

# **6.11.20 Negative Acceptance Criteria**

* The system shall not permit closure without successful verification.  
* The system shall not allow modification of archived permits.  
* The system shall not permit deletion of historical permit records.  
* The system shall not allow unauthorised access to archived permits.  
* The system shall not allow reopening of closed permits unless explicitly permitted by organisational policy.

---

# **6.11.21 Definition of Done**

This sprint is complete when:

* All FR-PTW-010 to FR-PTW-012 requirements are implemented.  
* Permit verification and closure workflows are operational.  
* Historical archive and audit functionality are complete.  
* Closure APIs pass functional and integration testing.  
* Web and mobile closure interfaces are complete.  
* Positive and negative test cases pass.  
* Acceptance criteria are satisfied.

---

# **6.12.4 Integration Activities**

The following integration activities shall be completed to validate interoperability between the Permit-to-Work module and the foundational platform modules implemented during MS-01.

### **Organisation Management Integration**

* Verify permits are associated with the correct organisation.  
* Verify plant, department and location selection.  
* Validate workstation and machinery associations.  
* Verify tenant isolation across permit records.

---

### **Workforce Management Integration**

* Verify Job Issuer assignment.  
* Verify Job Executor assignment.  
* Verify Supervisor assignment.  
* Verify Safety Officer assignment.  
* Validate role-based workflow transitions.  
* Verify competency validation before assignment where applicable.

---

### **Master Data Integration**

* Verify permit type selection.  
* Verify hazard catalogue integration.  
* Verify PPE catalogue integration.  
* Verify safety checklist integration.  
* Verify machinery catalogue integration.

---

### **Authentication & RBAC Integration**

* Verify authenticated permit creation.  
* Verify role-based approval permissions.  
* Verify execution permissions.  
* Verify closure permissions.  
* Verify unauthorised users cannot access restricted operations.

---

### **Attachment Management Integration**

* Verify upload during permit creation.  
* Verify upload during execution.  
* Verify attachment retrieval.  
* Verify attachment deletion permissions.  
* Verify attachment availability after permit closure.

---

### **Audit Logging Integration**

Verify audit records for:

* Permit creation.  
* Draft updates.  
* Permit submission.  
* Approval actions.  
* Permit activation.  
* Progress updates.  
* Evidence uploads.  
* Permit suspension.  
* Permit resumption.  
* Permit verification.  
* Permit closure.

---

### **Notification Integration**

Verify notification generation for:

* Permit submission.  
* Approval assignment.  
* Permit approval.  
* Permit rejection.  
* Permit deferment.  
* Permit activation.  
* Permit suspension.  
* Permit completion.  
* Permit closure.

---

# **6.12.5 Integration Test Cases**

| Test Case ID | Description |
| ----- | ----- |
| ITC-PTW-001 | Create permit and verify organisation mapping |
| ITC-PTW-002 | Verify organisational hierarchy selection |
| ITC-PTW-003 | Verify workforce assignment |
| ITC-PTW-004 | Verify permit type integration |
| ITC-PTW-005 | Verify approval workflow |
| ITC-PTW-006 | Verify permit activation |
| ITC-PTW-007 | Verify execution workflow |
| ITC-PTW-008 | Verify evidence upload |
| ITC-PTW-009 | Verify permit closure |
| ITC-PTW-010 | Verify historical archive |
| ITC-PTW-011 | Verify audit history |
| ITC-PTW-012 | Verify role-based permissions |
| ITC-PTW-013 | Verify notification generation |
| ITC-PTW-014 | Verify attachment retrieval |
| ITC-PTW-015 | Verify cross-module data consistency |

---

# **6.12.6 End-to-End Workflow Validation**

The following operational workflow shall be executed successfully during milestone integration testing.

### **Workflow**

1. Job Issuer logs into the platform.  
2. Job Issuer creates a new Permit-to-Work request.  
3. Permit is saved as a draft.  
4. Draft permit is updated.  
5. Permit is submitted.  
6. Approval workflow is initiated.  
7. Assigned approver reviews permit.  
8. Approver approves permit.  
9. Permit status changes to **Approved**.  
10. Job Executor activates the permit.  
11. Work execution begins.  
12. Progress updates are recorded.  
13. Supporting evidence is uploaded.  
14. Supervisor performs final verification.  
15. Permit is closed.  
16. Permit is archived.  
17. Historical permit remains searchable.  
18. Complete audit history is available.

---

# **6.12.7 Milestone Acceptance Criteria**

MS-02 shall be considered complete when:

* All FR-PTW-001 to FR-PTW-012 functional requirements have been implemented.  
* Permit creation operates successfully.  
* Draft management functions correctly.  
* Configurable approval workflows are operational.  
* Multi-stage approvals execute correctly.  
* Permit execution supports work progress tracking.  
* Evidence uploads function correctly.  
* Permit verification is operational.  
* Permit closure functions correctly.  
* Historical archive is available.  
* Audit history is complete.  
* Role-based permissions are enforced throughout the lifecycle.  
* Workflow state transitions comply with defined business rules.  
* Web application supports the complete permit lifecycle.  
* Mobile application supports all assigned operational workflows.  
* Backend APIs satisfy all functional requirements.  
* Positive test cases pass.  
* Negative test cases pass.  
* Integration test cases pass.

---

# **6.12.8 Milestone Exit Criteria**

MS-02 shall be considered successfully completed when:

* No Critical severity defects remain open.  
* No High severity defects prevent operational use.  
* End-to-end Permit-to-Work workflow validation is complete.  
* Integration with Organisation Management is verified.  
* Integration with Workforce Management is verified.  
* Integration with Master Data Management is verified.  
* Authentication and authorisation are verified.  
* Audit logging is verified.  
* Attachment management is verified.  
* Notification generation is verified.  
* Historical archive is operational.  
* Platform is ready for implementation of LOTOTO.

---

# **6.12.9 Milestone Definition of Done**

The Permit-to-Work Core milestone shall be considered complete when:

* All planned sprints have been completed.  
* All allocated functional requirements have been implemented.  
* All sprint Definition of Done criteria have been satisfied.  
* All integration activities have been completed.  
* All integration test cases have passed.  
* End-to-end workflow validation has passed.  
* Acceptance criteria have been satisfied.  
* Exit criteria have been satisfied.  
* Documentation has been updated.  
* The milestone has been approved for progression to MS-03.

---

# **7\. Milestone 3 – Lock Out Tag Out (LOTOTO)**

## **7.1 Milestone Overview**

### **Milestone ID**

**MS-03**

### **Milestone Name**

**Lock Out Tag Out (LOTOTO)**

### **Objective**

The Lock Out Tag Out (LOTOTO) milestone implements the hazardous energy isolation workflow required to safely isolate equipment before hazardous work is performed. This milestone extends the Permit-to-Work lifecycle by ensuring that machinery and energy sources are isolated, verified and restored using a structured, auditable process.

The implementation introduces lock management, tag management, isolation point verification, restoration procedures and complete traceability of all isolation activities.

Completion of this milestone enables organisations to control hazardous energy sources and ensure that work cannot commence until all required isolation procedures have been completed.

---

## **7.2 Business Goals**

The primary goals of this milestone are to:

* Digitise Lock Out Tag Out procedures.  
* Associate LOTOTO plans with permits.  
* Register and manage isolation points.  
* Support lock and tag assignment.  
* Verify hazardous energy isolation.  
* Record restoration activities.  
* Maintain complete auditability of all isolation operations.  
* Prevent hazardous work from commencing until isolation requirements have been satisfied.

---

## **7.3 Functional Requirements**

This milestone implements the following functional requirements defined within the Product Requirements Document.

### **LOTOTO Configuration**

* FR-LTO-001  
* FR-LTO-002  
* FR-LTO-003  
* FR-LTO-004  
* FR-LTO-005

### **Isolation Execution**

* FR-LTO-006  
* FR-LTO-007  
* FR-LTO-008  
* FR-LTO-009  
* FR-LTO-010  
* FR-LTO-011

### **Restoration & History**

* FR-LTO-012  
* FR-LTO-013  
* FR-LTO-014

---

## **7.4 Milestone Deliverables**

Upon completion of this milestone, the platform shall support:

### **LOTOTO Planning**

* Create LOTOTO plans.  
* Associate plans with permits.  
* Configure isolation sequences.  
* Register isolation points.  
* Assign responsible personnel.

### **Isolation Execution**

* Apply locks.  
* Apply tags.  
* Verify isolation.  
* Record isolation evidence.  
* Monitor isolation status.

### **Equipment Restoration**

* Remove locks.  
* Remove tags.  
* Restore equipment.  
* Record restoration evidence.  
* Complete restoration workflow.

### **Audit & History**

* Isolation history.  
* Restoration history.  
* Lock history.  
* Tag history.  
* Complete audit trail.

---

## **7.5 Sprint Breakdown**

| Sprint | Sprint Name | Primary Deliverable |
| ----- | ----- | ----- |
| SP-03.01 | LOTOTO Configuration | LOTOTO planning and configuration |
| SP-03.02 | Isolation Execution | Hazardous energy isolation workflow |
| SP-03.03 | Restoration & History | Equipment restoration and historical records |

---

# **7.6 Technology Allocation**

| Layer | Responsibilities |
| ----- | ----- |
| **Next.js** | LOTOTO planning, isolation management, restoration workflows, monitoring dashboards |
| **NestJS** | LOTOTO business logic, isolation workflow engine, validation and audit services |
| **PostgreSQL** | Isolation plans, lock records, tag records, verification history and restoration records |
| **Drizzle ORM** | Database schema and migrations |
| **Keycloak** | Role-based access for Isolation Officers, Supervisors and Safety Officers |
| **Redis** | Cache frequently accessed equipment and isolation data |
| **BullMQ** | Isolation reminders, overdue restoration notifications and background processing |
| **MinIO** | Storage of isolation evidence, photographs and supporting documentation |
| **React Native** | Isolation execution, evidence capture and restoration verification |
| **Grafana Loki** | Logging of all LOTOTO activities |
| **Metabase** | Operational reporting and LOTOTO analytics |

---

# **7.7 Exit Criteria**

MS-03 shall be considered complete when:

* All FR-LTO-001 to FR-LTO-014 requirements have been implemented.  
* LOTOTO plans can be created and associated with permits.  
* Isolation procedures function correctly.  
* Lock and tag workflows are operational.  
* Restoration procedures complete successfully.  
* Historical LOTOTO records are available.  
* Positive and negative test cases pass.  
* The module is ready for integration with SIMOPS.

---

# **7.8 Sprint SP-03.01 – LOTOTO Configuration**

## **7.8.1 Sprint Overview**

| Attribute | Value |
| ----- | ----- |
| Sprint ID | SP-03.01 |
| Sprint Name | LOTOTO Configuration |
| Milestone | MS-03 – Lock Out Tag Out |
| Sprint Type | Feature Sprint |
| Priority | Critical |
| Estimated Duration | 2 Weeks |
| Dependencies | MS-02 – Permit-to-Work Core |

---

# **7.8.2 Functional Requirements Covered**

This sprint establishes the planning and configuration required before hazardous energy isolation can be performed.

| Functional Requirement | Description |
| ----- | ----- |
| FR-LTO-001 | Create LOTOTO plan |
| FR-LTO-002 | Associate LOTOTO with permit |
| FR-LTO-003 | Configure isolation points |
| FR-LTO-004 | Assign responsible personnel |
| FR-LTO-005 | Configure isolation sequence |

---

# **7.8.3 Sprint Objectives**

The objective of this sprint is to enable organisations to define structured LOTOTO plans before hazardous work begins.

Upon completion:

* LOTOTO plans can be created.  
* Isolation points can be configured.  
* Locks and tags can be planned.  
* Isolation Officers can be assigned.  
* Plans can be linked to permits.  
* Isolation sequence can be defined.

---

# **7.8.4 Dependencies**

This sprint depends on:

| Sprint | Dependency |
| ----- | ----- |
| SP-02.01 | Permit Creation |
| SP-02.02 | Permit Approval |
| SP-01.02 | Organisation Management |
| SP-01.04 | Master Data Management |

Subsequent dependent sprints:

* SP-03.02 Isolation Execution  
* SP-04 SIMOPS

---

# **7.8.5 User Stories**

---

### **US-LTO-001**

**As an Isolation Officer, I want to create a LOTOTO plan so that hazardous energy sources are identified before work begins.**

---

### **US-LTO-002**

**As an Isolation Officer, I want to define isolation points and equipment so that every hazardous energy source is safely isolated.**

---

### **US-LTO-003**

**As a Supervisor, I want to assign authorised personnel to LOTOTO activities so that responsibilities are clearly defined.**

---

### **US-LTO-004**

**As a Safety Officer, I want LOTOTO plans linked to permits so that work cannot commence without completing the required isolation procedures.**

---

# **7.8.6 Use Cases**

---

## **UC-LTO-001**

### **Create LOTOTO Plan**

**Primary Actor**

Isolation Officer

#### **Preconditions**

* Permit exists.  
* User is authorised.  
* Equipment exists.

#### **Main Flow**

1. Select permit.  
2. Create LOTOTO plan.  
3. Enter isolation description.  
4. Save plan.  
5. Plan linked to permit.

---

## **UC-LTO-002**

### **Configure Isolation Points**

#### **Main Flow**

1. Select LOTOTO plan.  
2. Select equipment.  
3. Define energy sources.  
4. Add isolation points.  
5. Save configuration.

---

## **UC-LTO-003**

### **Assign Isolation Personnel**

#### **Main Flow**

1. Select LOTOTO plan.  
2. Assign Isolation Officer.  
3. Assign verifier.  
4. Save assignments.

---

## **UC-LTO-004**

### **Configure Isolation Sequence**

#### **Main Flow**

1. Select isolation points.  
2. Define execution order.  
3. Define verification requirements.  
4. Save sequence.

---

# **7.8.7 Business Rules**

| ID | Business Rule |
| ----- | ----- |
| BR-LTO-001 | Every LOTOTO plan shall belong to a permit. |
| BR-LTO-002 | Every isolation point shall belong to equipment. |
| BR-LTO-003 | Isolation sequence shall be completed in the configured order. |
| BR-LTO-004 | Only authorised personnel may modify LOTOTO plans. |
| BR-LTO-005 | Every modification shall generate an audit record. |

---

# **7.8.8 Functional Criteria**

| ID | Functional Criterion |
| ----- | ----- |
| FC-LTO-001 | Multiple isolation points shall be supported. |
| FC-LTO-002 | Multiple energy sources may be assigned. |
| FC-LTO-003 | Plans support multiple assigned personnel. |
| FC-LTO-004 | Isolation sequence shall be configurable. |
| FC-LTO-005 | LOTOTO plans remain editable until execution begins. |

---

# **7.8.9 Backend Implementation (NestJS)**

### **Modules**

* LOTOTO Plan Module  
* Isolation Point Module  
* Equipment Module

### **Controllers**

* LOTOTOController  
* IsolationController  
* EquipmentController

### **Services**

* LOTOTOService  
* IsolationService  
* EquipmentService  
* SequenceService

### **DTOs**

* CreateLOTOTOPlanDto  
* IsolationPointDto  
* AssignmentDto  
* IsolationSequenceDto

### **Validation**

* Permit validation  
* Equipment validation  
* Isolation point validation  
* Duplicate isolation validation  
* Assignment validation

---

# **7.8.10 Frontend Implementation (Next.js)**

Pages

* LOTOTO Plans  
* Isolation Points  
* Equipment Selection  
* Personnel Assignment

Components

* Equipment Tree  
* Isolation Diagram  
* Sequence Builder  
* Assignment Dialog  
* Validation Summary  
* Plan Overview

---

# **7.8.11 Mobile Implementation (React Native)**

Screens

* LOTOTO Plan  
* Isolation Point List  
* Assigned Equipment

Capabilities

* View assigned plans  
* Offline reference data  
* Synchronisation

---

# **7.8.12 Database Implementation**

Tables

* lototo\_plans  
* isolation\_points  
* equipment\_energy\_sources  
* lototo\_assignments  
* isolation\_sequences

Implementation Activities

* Schema creation  
* Foreign keys  
* Audit fields  
* Migration scripts

---

# **7.8.13 Infrastructure Dependencies**

* Redis caching  
* Keycloak role validation  
* BullMQ planning notifications  
* Grafana Loki logging

---

# **7.8.14 API Endpoints**

| Method | Endpoint | Purpose |
| ----- | ----- | ----- |
| POST | `/api/v1/lototo/plans` | Create LOTOTO plan |
| GET | `/api/v1/lototo/plans` | List LOTOTO plans |
| POST | `/api/v1/lototo/plans/{id}/isolation-points` | Add isolation point |
| POST | `/api/v1/lototo/plans/{id}/assignments` | Assign personnel |
| POST | `/api/v1/lototo/plans/{id}/sequence` | Configure sequence |

---

# **7.8.15 Positive Use Cases**

* Create LOTOTO plan.  
* Configure isolation points.  
* Assign personnel.  
* Configure isolation sequence.  
* Associate LOTOTO with permit.

---

# **7.8.16 Negative Use Cases**

* Create LOTOTO without permit.  
* Duplicate isolation point.  
* Invalid equipment.  
* Unauthorised assignment.  
* Invalid execution sequence.

---

# **7.8.17 Positive Test Cases**

| ID | Description |
| ----- | ----- |
| TC-LTO-001 | Create LOTOTO plan |
| TC-LTO-002 | Configure isolation points |
| TC-LTO-003 | Assign personnel |
| TC-LTO-004 | Configure isolation sequence |
| TC-LTO-005 | Associate with permit |

---

# **7.8.18 Negative Test Cases**

| ID | Description |
| ----- | ----- |
| NTC-LTO-001 | Missing permit |
| NTC-LTO-002 | Invalid equipment |
| NTC-LTO-003 | Duplicate isolation point |
| NTC-LTO-004 | Invalid assignment |
| NTC-LTO-005 | Invalid sequence |

---

# **7.8.19 Acceptance Criteria**

* LOTOTO plans can be created.  
* Plans can be associated with permits.  
* Isolation points can be configured.  
* Personnel assignments function correctly.  
* Isolation sequence is configurable.  
* Audit logs are generated.

---

# **7.8.20 Negative Acceptance Criteria**

* The system shall not create a LOTOTO plan without an associated permit.  
* The system shall not allow duplicate isolation points for the same equipment unless explicitly configured.  
* The system shall not permit unauthorised users to modify LOTOTO plans.  
* The system shall not allow execution sequences with missing mandatory isolation steps.  
* The system shall not allow modification of LOTOTO plans after execution has commenced.

---

# **7.8.21 Definition of Done**

This sprint is complete when:

* All FR-LTO-001 to FR-LTO-005 requirements are implemented.  
* LOTOTO planning is operational.  
* Isolation configuration is complete.  
* APIs pass functional and integration testing.  
* Web and mobile interfaces are complete.  
* Positive and negative test cases pass.  
* Acceptance criteria are satisfied.

---

# **7.9 Sprint SP-03.02 – Isolation Execution**

## **7.9.1 Sprint Overview**

| Attribute | Value |
| ----- | ----- |
| Sprint ID | SP-03.02 |
| Sprint Name | Isolation Execution |
| Milestone | MS-03 – Lock Out Tag Out |
| Sprint Type | Feature Sprint |
| Priority | Critical |
| Estimated Duration | 3 Weeks |
| Dependencies | SP-03.01 – LOTOTO Configuration |

---

# **7.9.2 Functional Requirements Covered**

This sprint implements the execution of the Lock Out Tag Out procedure by ensuring hazardous energy sources are isolated, verified and documented before work begins.

| Functional Requirement | Description |
| ----- | ----- |
| FR-LTO-006 | Execute isolation procedure |
| FR-LTO-007 | Apply locks |
| FR-LTO-008 | Apply tags |
| FR-LTO-009 | Verify isolation |
| FR-LTO-010 | Capture isolation evidence |
| FR-LTO-011 | Commence work after successful isolation |

---

# **7.9.3 Sprint Objectives**

The objective of this sprint is to digitise the hazardous energy isolation process and ensure that work cannot commence until all required isolation procedures have been successfully completed and verified.

Upon completion:

* Isolation procedures can be executed.  
* Locks and tags can be applied.  
* Isolation verification is completed.  
* Evidence is captured.  
* Permit execution is enabled only after successful verification.  
* Complete audit history is maintained.

---

# **7.9.4 Dependencies**

This sprint depends on:

| Sprint | Dependency |
| ----- | ----- |
| SP-03.01 | LOTOTO Configuration |
| SP-02.02 | Permit Approval |
| SP-02.03 | Permit Execution |

Subsequent dependent sprints:

* SP-03.03 Restoration & History  
* SP-05 Multi-Day Permit  
* SP-06 Incident Management

---

# **7.9.5 User Stories**

---

### **US-LTO-005**

**As an Isolation Officer, I want to execute the approved isolation sequence so that hazardous energy sources are safely isolated before work begins.**

---

### **US-LTO-006**

**As an Isolation Officer, I want to apply locks and tags to each isolation point so that equipment cannot be energised accidentally.**

---

### **US-LTO-007**

**As a Safety Officer, I want to verify every isolation step before authorising work so that hazardous work is performed safely.**

---

### **US-LTO-008**

**As a Job Executor, I want the permit to become executable only after isolation has been verified so that work begins under safe conditions.**

---

# **7.9.6 Use Cases**

---

## **UC-LTO-005**

### **Execute Isolation Procedure**

**Primary Actor**

Isolation Officer

#### **Preconditions**

* Permit status is **Approved**.  
* LOTOTO plan exists.  
* Isolation sequence configured.

#### **Main Flow**

1. Open assigned LOTOTO plan.  
2. Start isolation procedure.  
3. Follow configured sequence.  
4. Complete each isolation step.  
5. Record completion.  
6. Continue until all isolation points are complete.

---

## **UC-LTO-006**

### **Apply Lock and Tag**

#### **Main Flow**

1. Select isolation point.  
2. Apply physical lock.  
3. Apply identification tag.  
4. Record lock ID.  
5. Record tag ID.  
6. Upload evidence.  
7. Save record.

---

## **UC-LTO-007**

### **Verify Isolation**

#### **Main Flow**

1. Review completed isolation steps.  
2. Inspect lock placement.  
3. Inspect tag placement.  
4. Verify energy isolation.  
5. Record verification.  
6. Approve isolation.

---

## **UC-LTO-008**

### **Authorise Work Commencement**

#### **Main Flow**

1. Confirm all isolation points verified.  
2. Confirm verification complete.  
3. System enables permit execution.  
4. Notify Job Executor.

---

# **7.9.7 Business Rules**

| ID | Business Rule |
| ----- | ----- |
| BR-LTO-006 | Isolation steps shall follow the configured sequence. |
| BR-LTO-007 | Work cannot begin until every isolation point has been verified. |
| BR-LTO-008 | Every applied lock shall have a unique identifier. |
| BR-LTO-009 | Every applied tag shall have a unique identifier. |
| BR-LTO-010 | Isolation evidence shall be recorded for every completed step where required by organisational policy. |
| BR-LTO-011 | All isolation activities shall generate audit records. |

---

# **7.9.8 Functional Criteria**

| ID | Functional Criterion |
| ----- | ----- |
| FC-LTO-006 | Isolation steps shall be completed sequentially. |
| FC-LTO-007 | Lock identifiers shall be unique. |
| FC-LTO-008 | Tag identifiers shall be unique. |
| FC-LTO-009 | Evidence uploads shall support multiple files. |
| FC-LTO-010 | Permit execution shall remain disabled until isolation verification is complete. |
| FC-LTO-011 | Isolation history shall be immutable. |

---

# **7.9.9 Backend Implementation (NestJS)**

### **Modules**

* Isolation Execution Module  
* Lock Management Module  
* Tag Management Module  
* Verification Module

### **Controllers**

* IsolationExecutionController  
* LockController  
* TagController  
* VerificationController

### **Services**

* IsolationExecutionService  
* LockService  
* TagService  
* VerificationService  
* StatusValidationService

### **DTOs**

* ExecuteIsolationDto  
* ApplyLockDto  
* ApplyTagDto  
* VerifyIsolationDto  
* UploadEvidenceDto

### **Validation**

* Sequence validation  
* Duplicate lock validation  
* Duplicate tag validation  
* Verification validation  
* Evidence validation

---

# **7.9.10 Frontend Implementation (Next.js)**

Pages

* Active LOTOTO  
* Isolation Execution  
* Verification  
* Lock Register  
* Tag Register

Components

* Isolation Checklist  
* Sequential Progress Indicator  
* Lock Register Table  
* Tag Register Table  
* Evidence Upload  
* Verification Dialog  
* Completion Summary

---

# **7.9.11 Mobile Implementation (React Native)**

Screens

* Execute LOTOTO  
* Lock Application  
* Tag Application  
* Verification  
* Evidence Capture

Capabilities

* Offline execution  
* Camera integration  
* QR/Barcode scanning for lock and tag IDs (if supported)  
* Background synchronisation  
* Evidence upload queue

---

# **7.9.12 Database Implementation**

Tables

* isolation\_execution  
* applied\_locks  
* applied\_tags  
* isolation\_verifications  
* isolation\_evidence

Implementation Activities

* Execution timestamps  
* Lock registry  
* Tag registry  
* Verification records  
* Migration scripts

---

# **7.9.13 Infrastructure Dependencies**

* Redis for active isolation sessions  
* BullMQ for isolation reminders  
* MinIO for evidence storage  
* Keycloak role validation  
* Grafana Loki logging of isolation events

---

# **7.9.14 API Endpoints**

| Method | Endpoint | Purpose |
| ----- | ----- | ----- |
| POST | `/api/v1/lototo/{id}/execute` | Start isolation procedure |
| POST | `/api/v1/lototo/{id}/locks` | Apply lock |
| POST | `/api/v1/lototo/{id}/tags` | Apply tag |
| POST | `/api/v1/lototo/{id}/verify` | Verify isolation |
| POST | `/api/v1/lototo/{id}/evidence` | Upload evidence |
| GET | `/api/v1/lototo/{id}/status` | View isolation status |

---

# **7.9.15 Positive Use Cases**

* Execute isolation sequence.  
* Apply lock.  
* Apply tag.  
* Verify isolation.  
* Upload evidence.  
* Authorise work commencement.

---

# **7.9.16 Negative Use Cases**

* Skip isolation step.  
* Apply duplicate lock ID.  
* Apply duplicate tag ID.  
* Verify incomplete isolation.  
* Start work before verification.  
* Upload invalid evidence.

---

# **7.9.17 Positive Test Cases**

| ID | Description |
| ----- | ----- |
| TC-LTO-006 | Execute isolation sequence |
| TC-LTO-007 | Apply lock |
| TC-LTO-008 | Apply tag |
| TC-LTO-009 | Verify isolation |
| TC-LTO-010 | Upload evidence |
| TC-LTO-011 | Enable permit execution after verification |

---

# **7.9.18 Negative Test Cases**

| ID | Description |
| ----- | ----- |
| NTC-LTO-006 | Skip isolation step |
| NTC-LTO-007 | Duplicate lock identifier |
| NTC-LTO-008 | Duplicate tag identifier |
| NTC-LTO-009 | Verify incomplete isolation |
| NTC-LTO-010 | Start work before verification |
| NTC-LTO-011 | Invalid evidence upload |

---

# **7.9.19 Acceptance Criteria**

* Isolation procedures execute according to the configured sequence.  
* Locks and tags are recorded successfully.  
* Isolation verification is completed before work begins.  
* Evidence is associated with isolation records.  
* Permit execution is enabled only after successful verification.  
* Audit logs are generated for all isolation activities.

---

# **7.9.20 Negative Acceptance Criteria**

* The system shall not allow execution steps to be skipped.  
* The system shall not permit duplicate lock or tag identifiers.  
* The system shall not allow verification of incomplete isolation procedures.  
* The system shall not enable permit execution before successful isolation verification.  
* The system shall not allow modification of completed isolation records except through authorised corrective procedures.

---

# **7.9.21 Definition of Done**

This sprint is complete when:

* All FR-LTO-006 to FR-LTO-011 requirements are implemented.  
* Isolation execution workflows are operational.  
* Lock and tag management functions correctly.  
* Verification procedures are operational.  
* APIs pass functional and integration testing.  
* Web and mobile execution interfaces are complete.  
* Positive and negative test cases pass.  
* Acceptance criteria are satisfied.

---

# **7.10 Sprint SP-03.03 – Restoration & History**

## **7.10.1 Sprint Overview**

| Attribute | Value |
| ----- | ----- |
| Sprint ID | SP-03.03 |
| Sprint Name | Restoration & History |
| Milestone | MS-03 – Lock Out Tag Out |
| Sprint Type | Feature Sprint |
| Priority | Critical |
| Estimated Duration | 2 Weeks |
| Dependencies | SP-03.02 – Isolation Execution |

---

# **7.10.2 Functional Requirements Covered**

This sprint implements the restoration of equipment following completion of hazardous work and maintains a permanent historical record of all LOTOTO activities.

| Functional Requirement | Description |
| ----- | ----- |
| FR-LTO-012 | Equipment restoration |
| FR-LTO-013 | Restoration verification |
| FR-LTO-014 | Historical LOTOTO records |

---

# **7.10 Sprint SP-03.03 – Restoration & History**

## **7.10.1 Sprint Overview**

| Attribute | Value |
| ----- | ----- |
| Sprint ID | SP-03.03 |
| Sprint Name | Restoration & History |
| Milestone | MS-03 – Lock Out Tag Out |
| Sprint Type | Feature Sprint |
| Priority | Critical |
| Estimated Duration | 2 Weeks |
| Dependencies | SP-03.02 – Isolation Execution |

---

# **7.10.2 Functional Requirements Covered**

This sprint implements the restoration of equipment following completion of hazardous work and maintains a permanent historical record of all LOTOTO activities.

| Functional Requirement | Description |
| ----- | ----- |
| FR-LTO-012 | Equipment restoration |
| FR-LTO-013 | Restoration verification |
| FR-LTO-014 | Historical LOTOTO records |

---

# **7.10.3 Sprint Objectives**

The objective of this sprint is to ensure equipment is safely restored to its normal operating state after hazardous work has been completed and verified.

Upon completion:

* Locks can be removed.  
* Tags can be removed.  
* Equipment restoration can be recorded.  
* Restoration can be verified.  
* Complete LOTOTO history is permanently retained.  
* Associated permits can proceed to closure.

---

# **7.10.4 Dependencies**

This sprint depends on:

| Sprint | Dependency |
| ----- | ----- |
| SP-03.01 | LOTOTO Configuration |
| SP-03.02 | Isolation Execution |
| SP-02.03 | Permit Execution |

Subsequent dependent sprints:

* SP-02.04 Permit Closure  
* SP-04.01 SIMOPS  
* SP-06.01 Incident Management

---

# **7.10.5 User Stories**

---

### **US-LTO-009**

**As an Isolation Officer, I want to remove locks and tags after work has been completed so that equipment can safely return to service.**

---

### **US-LTO-010**

**As a Supervisor, I want to verify equipment restoration before the permit is closed so that operations can safely resume.**

---

### **US-LTO-011**

**As a Safety Officer, I want a complete historical record of all LOTOTO activities so that regulatory audits and investigations can be performed.**

---

### **US-LTO-012**

**As an Auditor, I want to review historical LOTOTO records so that compliance with hazardous energy isolation procedures can be verified.**

---

# **7.10.6 Use Cases**

---

## **UC-LTO-009**

### **Restore Equipment**

**Primary Actor**

Isolation Officer

#### **Preconditions**

* Hazardous work completed.  
* Permit execution completed.  
* All personnel have vacated the work area.  
* Equipment ready for restoration.

#### **Main Flow**

1. Open active LOTOTO record.  
2. Begin restoration procedure.  
3. Follow configured restoration sequence.  
4. Remove locks.  
5. Remove tags.  
6. Restore energy sources.  
7. Record restoration completion.  
8. Save restoration record.

#### **Postconditions**

Equipment restored to operational state.

---

## **UC-LTO-010**

### **Verify Restoration**

**Primary Actor**

Supervisor

#### **Main Flow**

1. Review restoration activities.  
2. Inspect equipment.  
3. Verify all locks removed.  
4. Verify all tags removed.  
5. Confirm equipment operational.  
6. Record verification.  
7. Approve restoration.

---

## **UC-LTO-011**

### **View LOTOTO History**

**Primary Actor**

Authorised User

#### **Main Flow**

1. Open LOTOTO History.  
2. Search by permit, equipment or date.  
3. View restoration details.  
4. View isolation history.  
5. View evidence.  
6. Export historical record where authorised.

---

# **7.10.7 Business Rules**

| ID | Business Rule |
| ----- | ----- |
| BR-LTO-012 | Restoration shall follow the reverse order of the approved isolation sequence unless organisational procedures specify otherwise. |
| BR-LTO-013 | Locks and tags shall only be removed by authorised personnel. |
| BR-LTO-014 | Restoration verification is mandatory before equipment is returned to service. |
| BR-LTO-015 | Historical LOTOTO records shall remain immutable. |
| BR-LTO-016 | Completion of LOTOTO shall update the associated permit status for subsequent closure activities. |

---

# **7.10.8 Functional Criteria**

| ID | Functional Criterion |
| ----- | ----- |
| FC-LTO-012 | Restoration activities shall record timestamps. |
| FC-LTO-013 | Lock removal shall be recorded individually. |
| FC-LTO-014 | Tag removal shall be recorded individually. |
| FC-LTO-015 | Restoration verification shall be mandatory. |
| FC-LTO-016 | Historical LOTOTO records shall remain searchable. |
| FC-LTO-017 | Restoration evidence shall remain permanently associated with the LOTOTO record. |

---

# **7.10.9 Backend Implementation (NestJS)**

### **Modules**

* Restoration Module  
* Restoration Verification Module  
* LOTOTO History Module

### **Controllers**

* RestorationController  
* LOTOTOHistoryController

### **Services**

* RestorationService  
* VerificationService  
* HistoryService  
* ArchiveService

### **DTOs**

* RestoreEquipmentDto  
* RemoveLockDto  
* RemoveTagDto  
* RestorationVerificationDto

### **Validation**

* Lock ownership validation  
* Tag ownership validation  
* Restoration sequence validation  
* Verification validation  
* Historical integrity validation

---

# **7.10.10 Frontend Implementation (Next.js)**

Pages

* Equipment Restoration  
* Restoration Verification  
* LOTOTO History  
* Restoration Summary

Components

* Restoration Checklist  
* Lock Removal Register  
* Tag Removal Register  
* Restoration Timeline  
* Equipment Status Card  
* Historical Timeline  
* Export Dialog

---

# **7.10.11 Mobile Implementation (React Native)**

Screens

* Restore Equipment  
* Remove Locks  
* Remove Tags  
* Restoration Verification  
* LOTOTO History

Capabilities

* Offline restoration recording  
* Evidence capture  
* QR/Barcode verification (if enabled)  
* Background synchronisation

---

# **7.10.12 Database Implementation**

Tables

* equipment\_restorations  
* lock\_removals  
* tag\_removals  
* restoration\_verifications  
* lototo\_history

Implementation Activities

* Restoration timestamps  
* Verification records  
* Historical indexing  
* Audit fields  
* Migration scripts

---

# **7.10.13 Infrastructure Dependencies**

* Redis for historical cache  
* BullMQ restoration notifications  
* MinIO restoration evidence storage  
* Keycloak role validation  
* Grafana Loki restoration logging

---

# **7.10.14 API Endpoints**

| Method | Endpoint | Purpose |
| ----- | ----- | ----- |
| POST | `/api/v1/lototo/{id}/restore` | Restore equipment |
| POST | `/api/v1/lototo/{id}/remove-lock` | Record lock removal |
| POST | `/api/v1/lototo/{id}/remove-tag` | Record tag removal |
| POST | `/api/v1/lototo/{id}/verify-restoration` | Verify restoration |
| GET | `/api/v1/lototo/history` | List LOTOTO history |
| GET | `/api/v1/lototo/history/{id}` | View LOTOTO record |

---

# **7.10.15 Positive Use Cases**

* Restore equipment.  
* Remove locks.  
* Remove tags.  
* Verify restoration.  
* View historical LOTOTO records.  
* Export LOTOTO history.

---

# **7.10.16 Negative Use Cases**

* Restore equipment before work completion.  
* Remove another user's lock.  
* Remove another user's tag.  
* Skip restoration verification.  
* Modify historical LOTOTO records.  
* Access LOTOTO history without permission.

---

# **7.10.17 Positive Test Cases**

| ID | Description |
| ----- | ----- |
| TC-LTO-012 | Restore equipment |
| TC-LTO-013 | Remove lock |
| TC-LTO-014 | Remove tag |
| TC-LTO-015 | Verify restoration |
| TC-LTO-016 | View LOTOTO history |
| TC-LTO-017 | Export LOTOTO history |

---

# **7.10.18 Negative Test Cases**

| ID | Description |
| ----- | ----- |
| NTC-LTO-012 | Restore before work completion |
| NTC-LTO-013 | Remove unauthorised lock |
| NTC-LTO-014 | Remove unauthorised tag |
| NTC-LTO-015 | Skip restoration verification |
| NTC-LTO-016 | Modify history |
| NTC-LTO-017 | Unauthorised history access |

---

# **7.10.19 Acceptance Criteria**

* Equipment restoration follows the approved procedure.  
* Locks and tags are removed successfully.  
* Restoration verification is completed.  
* Historical LOTOTO records remain searchable.  
* Audit logs are generated for all restoration activities.  
* Associated permits are available for closure upon successful completion of restoration.

---

# **7.10.20 Negative Acceptance Criteria**

* The system shall not allow restoration before hazardous work has been completed.  
* The system shall not permit unauthorised users to remove locks or tags.  
* The system shall not allow equipment to return to service without restoration verification.  
* The system shall not allow modification or deletion of historical LOTOTO records.  
* The system shall not allow closure of LOTOTO records with incomplete restoration activities.

---

# **7.10.21 Definition of Done**

This sprint is complete when:

* All FR-LTO-012 to FR-LTO-014 requirements are implemented.  
* Equipment restoration workflows are operational.  
* Restoration verification is functional.  
* Historical LOTOTO records are available.  
* APIs pass functional and integration testing.  
* Web and mobile restoration interfaces are complete.  
* Positive and negative test cases pass.  
* Acceptance criteria are satisfied.

---

# **7.11 Milestone 3 Integration**

## **7.11.1 Integrated Modules**

The following modules shall be fully integrated at the conclusion of MS-03:

* Organisation Management  
* Workforce Management  
* Master Data Management  
* Permit-to-Work  
* LOTOTO Planning  
* Isolation Execution  
* Restoration Management  
* Authentication & RBAC  
* Notifications  
* Audit Logging  
* Attachment Management

---

## **7.11.2 Integration Activities**

### **Permit-to-Work Integration**

* Verify LOTOTO plans are associated with permits.  
* Verify permit status reflects LOTOTO progress.  
* Verify work cannot commence until isolation verification is complete.  
* Verify permit closure depends on LOTOTO completion.

---

### **Organisation & Workforce Integration**

* Verify assigned Isolation Officers.  
* Verify Supervisor assignments.  
* Verify Safety Officer permissions.  
* Verify organisational hierarchy mapping.

---

### **Master Data Integration**

* Verify equipment catalogue.  
* Verify workstation catalogue.  
* Verify machinery references.  
* Verify energy source mapping.

---

### **Authentication & RBAC Integration**

* Verify role-based LOTOTO permissions.  
* Verify isolation execution permissions.  
* Verify restoration permissions.  
* Verify history access permissions.

---

### **Attachment Management Integration**

* Verify isolation evidence uploads.  
* Verify restoration evidence uploads.  
* Verify historical evidence retrieval.

---

### **Audit Logging Integration**

Verify audit records for:

* LOTOTO plan creation.  
* Isolation execution.  
* Lock application.  
* Tag application.  
* Isolation verification.  
* Restoration.  
* Lock removal.  
* Tag removal.  
* Restoration verification.  
* LOTOTO completion.

---

### **Notification Integration**

Verify notifications for:

* LOTOTO assignment.  
* Isolation completion.  
* Verification requests.  
* Restoration requests.  
* LOTOTO completion.

---

# **7.11.3 Integration Test Cases**

| Test Case ID | Description |
| ----- | ----- |
| ITC-LTO-001 | Create LOTOTO plan |
| ITC-LTO-002 | Associate plan with permit |
| ITC-LTO-003 | Execute isolation |
| ITC-LTO-004 | Apply locks and tags |
| ITC-LTO-005 | Verify isolation |
| ITC-LTO-006 | Start permit execution after verification |
| ITC-LTO-007 | Restore equipment |
| ITC-LTO-008 | Verify restoration |
| ITC-LTO-009 | Close LOTOTO record |
| ITC-LTO-010 | View historical LOTOTO records |
| ITC-LTO-011 | Verify audit history |
| ITC-LTO-012 | Verify notification generation |

---

# **7.11.4 End-to-End Workflow Validation**

The following operational workflow shall be executed successfully during milestone integration testing.

1. Permit is created.  
2. Permit is approved.  
3. LOTOTO plan is created.  
4. Isolation points are configured.  
5. Personnel are assigned.  
6. Isolation sequence is executed.  
7. Locks are applied.  
8. Tags are applied.  
9. Isolation is verified.  
10. Permit execution begins.  
11. Hazardous work is completed.  
12. Restoration procedure begins.  
13. Locks are removed.  
14. Tags are removed.  
15. Equipment is restored.  
16. Restoration is verified.  
17. LOTOTO record is completed.  
18. Permit proceeds to closure.  
19. Historical records remain available.

---

# **7.11.5 Milestone Acceptance Criteria**

MS-03 shall be considered complete when:

* All FR-LTO-001 to FR-LTO-014 functional requirements have been implemented.  
* LOTOTO plans can be created and managed.  
* Isolation procedures execute successfully.  
* Lock and tag management functions correctly.  
* Restoration procedures are operational.  
* Historical LOTOTO records remain available.  
* Integration with the Permit-to-Work lifecycle is verified.  
* Positive test cases pass.  
* Negative test cases pass.  
* Integration test cases pass.

---

# **7.11.6 Milestone Exit Criteria**

MS-03 shall be considered successfully completed when:

* No Critical severity defects remain open.  
* No High severity defects prevent operational use.  
* Isolation workflows operate correctly.  
* Restoration workflows operate correctly.  
* Audit logging is verified.  
* Notification generation is verified.  
* Historical records are available.  
* Platform is ready for implementation of SIMOPS (MS-04).

---

# **7.11.7 Milestone Definition of Done**

The LOTOTO milestone shall be considered complete when:

* All planned sprints have been completed.  
* All allocated functional requirements have been implemented.  
* All sprint Definition of Done criteria have been satisfied.  
* All integration activities have been completed.  
* All integration test cases have passed.  
* End-to-end workflow validation has passed.  
* Acceptance criteria have been satisfied.  
* Exit criteria have been satisfied.  
* Documentation has been updated.  
* The milestone has been approved for progression to MS-04.

---

# **8\. Milestone 4 – Simultaneous Operations (SIMOPS)**

## **8.1 Milestone Overview**

### **Milestone ID**

**MS-04**

### **Milestone Name**

**Simultaneous Operations (SIMOPS)**

### **Objective**

The Simultaneous Operations (SIMOPS) milestone introduces the capability to identify, assess and manage conflicts arising from multiple hazardous work activities occurring concurrently within the same operational area.

This milestone extends the Permit-to-Work platform by continuously evaluating active permits for spatial, temporal and operational conflicts, enabling organisations to proactively prevent unsafe interactions between concurrent work activities.

Upon completion, the platform shall support automated conflict detection, conflict assessment, mitigation workflows and operational coordination before hazardous work proceeds.

---

## **8.2 Business Goals**

The primary goals of this milestone are to:

* Detect conflicting hazardous work activities.  
* Identify overlapping work locations.  
* Detect conflicting permit types.  
* Assess operational risk.  
* Notify affected personnel.  
* Coordinate simultaneous operations.  
* Prevent unsafe work commencement.  
* Maintain a complete audit trail of SIMOPS decisions.

---

## **8.3 Functional Requirements**

This milestone implements the following functional requirements defined within the Product Requirements Document.

### **Conflict Detection**

* FR-SIM-001  
* FR-SIM-002  
* FR-SIM-003  
* FR-SIM-004

### **Conflict Resolution**

* FR-SIM-005  
* FR-SIM-006  
* FR-SIM-007  
* FR-SIM-008  
* FR-SIM-009  
* FR-SIM-010

---

## **8.4 Milestone Deliverables**

Upon completion of this milestone, the platform shall support:

### **Conflict Detection**

* Automatic permit conflict detection.  
* Location overlap detection.  
* Time overlap detection.  
* Hazard conflict analysis.  
* Equipment conflict detection.

---

### **Conflict Resolution**

* Conflict review.  
* Risk assessment.  
* Mitigation planning.  
* Approval of concurrent work.  
* Conflict rejection.  
* Operational coordination.

---

### **Notifications**

* Conflict alerts.  
* Supervisor notifications.  
* Safety Officer notifications.  
* Escalation notifications.

---

### **Audit & Reporting**

* Conflict history.  
* Resolution history.  
* Risk assessment history.  
* Complete audit trail.

---

## **8.5 Sprint Breakdown**

| Sprint | Sprint Name | Primary Deliverable |
| ----- | ----- | ----- |
| SP-04.01 | Conflict Detection | Automatic SIMOPS conflict identification |
| SP-04.02 | Conflict Resolution | Conflict assessment, mitigation and approval |

---

## **8.6 Technology Allocation**

| Layer | Responsibilities |
| ----- | ----- |
| **Next.js** | SIMOPS dashboard, conflict review, mitigation planning |
| **NestJS** | Conflict detection engine, risk assessment and workflow management |
| **PostgreSQL** | Conflict records, assessments, mitigation plans and audit history |
| **Drizzle ORM** | Schema definitions and migrations |
| **Keycloak** | Role-based access for Safety Officers and Supervisors |
| **Redis** | Cache active permits for conflict evaluation |
| **BullMQ** | Background conflict detection and notification processing |
| **MinIO** | Store supporting documents and mitigation evidence |
| **React Native** | Conflict notifications and field review |
| **Grafana Loki** | Operational logging |
| **Metabase** | SIMOPS analytics and reporting |

---

## **8.7 Exit Criteria**

MS-04 shall be considered complete when:

* All FR-SIM-001 to FR-SIM-010 requirements have been implemented.  
* Conflict detection functions correctly.  
* Conflict resolution workflows are operational.  
* Risk assessments are completed successfully.  
* Notifications are generated appropriately.  
* Positive and negative test cases pass.  
* Platform is ready for implementation of Multi-Day Permit Management.

---

# **8.8 Sprint SP-04.01 – Conflict Detection**

## **8.8.1 Sprint Overview**

| Attribute | Value |
| ----- | ----- |
| Sprint ID | SP-04.01 |
| Sprint Name | Conflict Detection |
| Milestone | MS-04 – Simultaneous Operations |
| Sprint Type | Feature Sprint |
| Priority | Critical |
| Estimated Duration | 2 Weeks |
| Dependencies | MS-03 – LOTOTO |

---

# **8.8.2 Functional Requirements Covered**

This sprint implements automated identification of conflicting hazardous work activities across active permits.

| Functional Requirement | Description |
| ----- | ----- |
| FR-SIM-001 | Detect overlapping work locations |
| FR-SIM-002 | Detect conflicting permit types |
| FR-SIM-003 | Detect equipment conflicts |
| FR-SIM-004 | Generate SIMOPS conflict alerts |

---

# **8.8.3 Sprint Objectives**

The objective of this sprint is to automatically identify simultaneous operations that may introduce unacceptable operational risk.

Upon completion:

* Active permits are continuously analysed.  
* Location conflicts are detected.  
* Equipment conflicts are detected.  
* Time overlaps are identified.  
* Conflict alerts are generated.  
* Conflicts are queued for assessment.

---

# **8.8.4 Dependencies**

This sprint depends on:

| Sprint | Dependency |
| ----- | ----- |
| SP-02.01 | Permit Creation |
| SP-02.02 | Permit Approval |
| SP-02.03 | Permit Execution |
| SP-03.03 | Restoration & History |

Subsequent dependent sprint:

* SP-04.02 Conflict Resolution

---

# **8.8.5 User Stories**

### **US-SIM-001**

**As a Safety Officer, I want the system to automatically detect conflicting work activities so that operational risks are identified before incidents occur.**

---

### **US-SIM-002**

**As a Supervisor, I want to receive alerts when permits overlap so that corrective action can be taken immediately.**

---

### **US-SIM-003**

**As a Permit Issuer, I want to know if my permit conflicts with existing work before execution begins.**

---

# **8.8.6 Use Cases**

## **UC-SIM-001**

### **Detect Permit Conflict**

**Primary Actor**

System

#### **Preconditions**

* Multiple active permits exist.  
* Permit locations are configured.

#### **Main Flow**

1. Monitor active permits.  
2. Compare operational locations.  
3. Compare execution schedules.  
4. Compare permit types.  
5. Compare equipment usage.  
6. Identify conflicts.  
7. Generate conflict record.  
8. Notify responsible personnel.

---

## **UC-SIM-002**

### **Generate Conflict Alert**

#### **Main Flow**

1. Detect conflict.  
2. Calculate conflict severity.  
3. Assign priority.  
4. Notify Safety Officer.  
5. Add conflict to review queue.

---

# **8.8.7 Business Rules**

| ID | Business Rule |
| ----- | ----- |
| BR-SIM-001 | Active permits shall be evaluated continuously for conflicts. |
| BR-SIM-002 | A conflict may involve multiple permits. |
| BR-SIM-003 | Conflict severity shall be calculated according to organisational rules. |
| BR-SIM-004 | Every detected conflict shall generate an audit record. |
| BR-SIM-005 | Conflict alerts shall be delivered to authorised personnel only. |

---

# **8.8.8 Functional Criteria**

| ID | Functional Criterion |
| ----- | ----- |
| FC-SIM-001 | Detect location overlap. |
| FC-SIM-002 | Detect schedule overlap. |
| FC-SIM-003 | Detect equipment conflicts. |
| FC-SIM-004 | Detect conflicting permit types. |
| FC-SIM-005 | Assign conflict priority automatically. |
| FC-SIM-006 | Generate notifications automatically. |

---

# **8.8.9 Backend Implementation (NestJS)**

### **Modules**

* SIMOPS Module  
* Conflict Detection Module  
* Conflict Analysis Module

### **Controllers**

* SIMOPSController  
* ConflictController

### **Services**

* ConflictDetectionService  
* ConflictAnalysisService  
* RiskCalculationService

### **DTOs**

* ConflictSearchDto  
* ConflictAnalysisDto

### **Validation**

* Permit validation  
* Time overlap validation  
* Location validation  
* Equipment validation

---

# **8.8.10 Frontend Implementation (Next.js)**

Pages

* SIMOPS Dashboard  
* Active Conflicts  
* Conflict Details

Components

* Conflict Matrix  
* Conflict Severity Badge  
* Timeline View  
* Map View (if location mapping is implemented)  
* Conflict Summary Cards  
* Search & Filters

---

# **8.8.11 Mobile Implementation (React Native)**

Screens

* Active Conflicts  
* Conflict Details

Capabilities

* Push notifications  
* Conflict acknowledgement  
* Read-only permit comparison

---

# **8.8.12 Database Implementation**

Tables

* simops\_conflicts  
* conflict\_participants  
* conflict\_alerts

Implementation Activities

* Conflict indexing  
* Severity calculation fields  
* Audit fields  
* Migration scripts

---

# **8.8.13 Infrastructure Dependencies**

* Redis for active permit caching  
* BullMQ conflict detection jobs  
* Keycloak permission validation  
* Grafana Loki logging  
* Metabase reporting integration

---

# **8.8.14 API Endpoints**

| Method | Endpoint | Purpose |
| ----- | ----- | ----- |
| GET | `/api/v1/simops/conflicts` | List conflicts |
| GET | `/api/v1/simops/conflicts/{id}` | View conflict |
| POST | `/api/v1/simops/analyse` | Trigger conflict analysis |
| GET | `/api/v1/simops/alerts` | View alerts |

---

# **8.8.15 Positive Use Cases**

* Detect location conflict.  
* Detect equipment conflict.  
* Detect permit overlap.  
* Generate conflict alert.  
* Assign conflict priority.

---

# **8.8.16 Negative Use Cases**

* Analyse inactive permits.  
* Duplicate conflict generation.  
* Invalid conflict calculation.  
* Notify unauthorised users.  
* Generate false conflict due to invalid reference data.

---

# **8.8.17 Positive Test Cases**

| ID | Description |
| ----- | ----- |
| TC-SIM-001 | Detect overlapping permits |
| TC-SIM-002 | Detect equipment conflict |
| TC-SIM-003 | Generate conflict alert |
| TC-SIM-004 | Assign conflict priority |
| TC-SIM-005 | Audit logging |

---

# **8.8.18 Negative Test Cases**

| ID | Description |
| ----- | ----- |
| NTC-SIM-001 | Duplicate conflict |
| NTC-SIM-002 | Invalid location data |
| NTC-SIM-003 | Notify unauthorised user |
| NTC-SIM-004 | Analyse inactive permit |
| NTC-SIM-005 | Invalid severity calculation |

---

# **8.8.19 Acceptance Criteria**

* Conflicts are detected automatically.  
* Location, equipment and schedule conflicts are identified.  
* Conflict alerts are generated.  
* Conflict priorities are assigned.  
* Audit logs are created.

---

# **8.8.20 Negative Acceptance Criteria**

* The system shall not analyse closed permits.  
* The system shall not generate duplicate conflict records for the same event.  
* The system shall not notify users without the required permissions.  
* The system shall not allow invalid conflict calculations.  
* The system shall not omit audit records for detected conflicts.

---

# **8.9 Sprint SP-04.02 – Conflict Resolution**

## **8.9.1 Sprint Overview**

| Attribute | Value |
| ----- | ----- |
| Sprint ID | SP-04.02 |
| Sprint Name | Conflict Resolution |
| Milestone | MS-04 – Simultaneous Operations |
| Sprint Type | Feature Sprint |
| Priority | Critical |
| Estimated Duration | 2 Weeks |
| Dependencies | SP-04.01 – Conflict Detection |

---

# **8.9.2 Functional Requirements Covered**

This sprint implements the review, assessment and resolution of identified SIMOPS conflicts before hazardous work proceeds.

| Functional Requirement | Description |
| ----- | ----- |
| FR-SIM-005 | Conflict assessment |
| FR-SIM-006 | Risk mitigation planning |
| FR-SIM-007 | Conflict approval workflow |
| FR-SIM-008 | Conflict rejection |
| FR-SIM-009 | Notifications and escalation |
| FR-SIM-010 | Conflict history |

---

# **8.9.3 Sprint Objectives**

The objective of this sprint is to ensure all identified simultaneous operation conflicts are assessed, mitigated and resolved through a controlled workflow before work is permitted to continue.

Upon completion:

* Conflicts can be assessed.  
* Risk mitigation measures can be defined.  
* Conflicts can be approved or rejected.  
* Escalations can be initiated.  
* Historical conflict records are retained.  
* Operational work proceeds only after conflict resolution.

---

# **8.9.4 Dependencies**

This sprint depends on:

| Sprint | Dependency |
| ----- | ----- |
| SP-04.01 | Conflict Detection |
| SP-02.03 | Permit Execution |
| SP-02.04 | Permit Closure |

Subsequent dependent sprints:

* SP-05.01 Multi-Day Permit Management  
* SP-06.01 Incident Management

---

# **8.9.5 User Stories**

---

### **US-SIM-004**

**As a Safety Officer, I want to assess detected conflicts so that the operational risks are understood before work proceeds.**

---

### **US-SIM-005**

**As a Supervisor, I want to define mitigation measures for conflicting work so that simultaneous activities can be performed safely where appropriate.**

---

### **US-SIM-006**

**As an Operations Manager, I want to approve or reject conflict resolution plans so that operational safety is maintained.**

---

### **US-SIM-007**

**As an Auditor, I want to review historical conflict resolutions so that organisational compliance can be demonstrated.**

---

# **8.9.6 Use Cases**

---

## **UC-SIM-003**

### **Assess Conflict**

**Primary Actor**

Safety Officer

#### **Preconditions**

* Conflict has been detected.  
* Conflict record exists.  
* User is authorised.

#### **Main Flow**

1. Open conflict record.  
2. Review affected permits.  
3. Review operational risks.  
4. Assess conflict severity.  
5. Record assessment.  
6. Save assessment.

---

## **UC-SIM-004**

### **Define Mitigation Plan**

#### **Main Flow**

1. Open conflict assessment.  
2. Identify mitigation measures.  
3. Assign responsible personnel.  
4. Specify implementation timeline.  
5. Save mitigation plan.

---

## **UC-SIM-005**

### **Approve Conflict Resolution**

#### **Main Flow**

1. Review mitigation plan.  
2. Verify operational safety.  
3. Select **Approve**.  
4. Record approval comments.  
5. Notify affected personnel.  
6. Permit execution continues.

---

## **UC-SIM-006**

### **Reject Conflict Resolution**

#### **Main Flow**

1. Review mitigation plan.  
2. Select **Reject**.  
3. Record rejection reason.  
4. Notify affected personnel.  
5. Suspend affected permits if required.

---

# **8.9.7 Business Rules**

| ID | Business Rule |
| ----- | ----- |
| BR-SIM-006 | Every detected conflict shall be assessed before work proceeds. |
| BR-SIM-007 | High-risk conflicts require mandatory approval from the Safety Officer. |
| BR-SIM-008 | Mitigation plans shall be documented before approval. |
| BR-SIM-009 | Rejected conflicts shall prevent affected permits from progressing. |
| BR-SIM-010 | All conflict decisions shall generate audit records. |
| BR-SIM-011 | Historical conflict records shall remain immutable. |

---

# **8.9.8 Functional Criteria**

| ID | Functional Criterion |
| ----- | ----- |
| FC-SIM-007 | Risk assessments shall support configurable severity levels. |
| FC-SIM-008 | Multiple mitigation actions may be assigned to a conflict. |
| FC-SIM-009 | Approval comments shall be permanently recorded. |
| FC-SIM-010 | Conflict status shall update automatically after each workflow action. |
| FC-SIM-011 | Historical conflict records shall remain searchable. |
| FC-SIM-012 | Notifications shall be generated for all workflow decisions. |

---

# **8.9.9 Backend Implementation (NestJS)**

### **Modules**

* Conflict Resolution Module  
* Risk Assessment Module  
* Mitigation Module  
* Escalation Module

### **Controllers**

* ConflictResolutionController  
* RiskAssessmentController  
* MitigationController

### **Services**

* ConflictResolutionService  
* RiskAssessmentService  
* MitigationService  
* EscalationService  
* NotificationService

### **DTOs**

* ConflictAssessmentDto  
* MitigationPlanDto  
* ApproveConflictDto  
* RejectConflictDto

### **Validation**

* Conflict status validation  
* Approval permission validation  
* Mitigation validation  
* Escalation validation  
* Workflow validation

---

# **8.9.10 Frontend Implementation (Next.js)**

Pages

* Conflict Assessment  
* Mitigation Plans  
* Conflict Approval Queue  
* Conflict History

Components

* Risk Matrix  
* Mitigation Checklist  
* Conflict Timeline  
* Approval Dialog  
* Escalation Dialog  
* Conflict Summary  
* Activity Timeline

---

# **8.9.11 Mobile Implementation (React Native)**

Screens

* Conflict Review  
* Risk Assessment  
* Conflict Resolution

Capabilities

* Receive conflict notifications  
* Review mitigation plans  
* Approve or reject conflicts  
* View conflict history

---

# **8.9.12 Database Implementation**

Tables

* conflict\_assessments  
* mitigation\_plans  
* conflict\_resolutions  
* conflict\_history

Implementation Activities

* Assessment records  
* Approval history  
* Workflow status  
* Historical indexing  
* Migration scripts

---

# **8.9.13 Infrastructure Dependencies**

* Redis for conflict queue caching  
* BullMQ escalation notifications  
* MinIO mitigation evidence storage  
* Keycloak role validation  
* Grafana Loki logging

---

# **8.9.14 API Endpoints**

| Method | Endpoint | Purpose |
| ----- | ----- | ----- |
| POST | `/api/v1/simops/conflicts/{id}/assess` | Assess conflict |
| POST | `/api/v1/simops/conflicts/{id}/mitigation` | Create mitigation plan |
| POST | `/api/v1/simops/conflicts/{id}/approve` | Approve conflict |
| POST | `/api/v1/simops/conflicts/{id}/reject` | Reject conflict |
| GET | `/api/v1/simops/history` | View conflict history |
| GET | `/api/v1/simops/history/{id}` | View conflict record |

---

# **8.9.15 Positive Use Cases**

* Assess conflict.  
* Create mitigation plan.  
* Approve conflict.  
* Reject conflict.  
* Escalate conflict.  
* View conflict history.

---

# **8.9.16 Negative Use Cases**

* Approve without assessment.  
* Approve without mitigation plan.  
* Reject without reason.  
* Modify completed conflict record.  
* Resolve already closed conflict.  
* Access conflict history without permission.

---

# **8.9.17 Positive Test Cases**

| ID | Description |
| ----- | ----- |
| TC-SIM-006 | Assess conflict |
| TC-SIM-007 | Create mitigation plan |
| TC-SIM-008 | Approve conflict |
| TC-SIM-009 | Reject conflict |
| TC-SIM-010 | Escalate conflict |
| TC-SIM-011 | View conflict history |

---

# **8.9.18 Negative Test Cases**

| ID | Description |
| ----- | ----- |
| NTC-SIM-006 | Approve without assessment |
| NTC-SIM-007 | Missing mitigation plan |
| NTC-SIM-008 | Reject without reason |
| NTC-SIM-009 | Modify historical conflict |
| NTC-SIM-010 | Resolve closed conflict |
| NTC-SIM-011 | Unauthorised history access |

---

# **8.9.19 Acceptance Criteria**

* Conflict assessments are completed successfully.  
* Mitigation plans can be created and assigned.  
* Conflicts can be approved or rejected.  
* Escalations function correctly.  
* Historical conflict records remain available.  
* Audit logs are generated for all workflow activities.

---

# **8.9.20 Negative Acceptance Criteria**

* The system shall not permit conflict approval before assessment is completed.  
* The system shall not permit approval without an approved mitigation plan where required.  
* The system shall not allow unauthorised users to resolve conflicts.  
* The system shall not allow modification of completed conflict records.  
* The system shall not allow affected permits to continue when conflicts remain unresolved.

---

# **8.9.21 Definition of Done**

This sprint is complete when:

* All FR-SIM-005 to FR-SIM-010 requirements are implemented.  
* Conflict assessment workflows are operational.  
* Mitigation planning functions correctly.  
* Approval and rejection workflows are operational.  
* APIs pass functional and integration testing.  
* Web and mobile interfaces are complete.  
* Positive and negative test cases pass.  
* Acceptance criteria are satisfied.

---

# **8.10 Milestone 4 Integration**

## **8.10.1 Integrated Modules**

The following modules shall be fully integrated at the conclusion of MS-04:

* Organisation Management  
* Workforce Management  
* Master Data Management  
* Permit-to-Work  
* LOTOTO  
* SIMOPS Conflict Detection  
* SIMOPS Conflict Resolution  
* Authentication & RBAC  
* Notifications  
* Audit Logging  
* Attachment Management

---

## **8.10.2 Integration Activities**

### **Permit-to-Work Integration**

* Verify conflict detection for active permits.  
* Verify permit suspension during unresolved conflicts.  
* Verify permit continuation after conflict approval.  
* Verify permit closure following resolved conflicts.

---

### **LOTOTO Integration**

* Verify conflict detection considers active LOTOTO activities.  
* Verify isolation status influences conflict analysis.  
* Verify restoration updates remove resolved equipment conflicts.

---

### **Organisation & Workforce Integration**

* Verify organisational hierarchy mapping.  
* Verify assigned Safety Officers.  
* Verify Supervisor permissions.  
* Verify role-based conflict management.

---

### **Master Data Integration**

* Verify equipment catalogue references.  
* Verify permit type rules.  
* Verify hazard classifications.  
* Verify location mapping.

---

### **Authentication & RBAC Integration**

* Verify conflict review permissions.  
* Verify approval permissions.  
* Verify historical record access.  
* Verify unauthorised access restrictions.

---

### **Notification Integration**

Verify notifications for:

* Conflict detected.  
* Conflict assigned.  
* Mitigation required.  
* Conflict approved.  
* Conflict rejected.  
* Conflict escalated.  
* Conflict resolved.

---

### **Audit Logging Integration**

Verify audit records for:

* Conflict detection.  
* Risk assessment.  
* Mitigation creation.  
* Approval.  
* Rejection.  
* Escalation.  
* Resolution.

---

# **8.10.3 Integration Test Cases**

| Test Case ID | Description |
| ----- | ----- |
| ITC-SIM-001 | Detect permit conflict |
| ITC-SIM-002 | Assess conflict |
| ITC-SIM-003 | Create mitigation plan |
| ITC-SIM-004 | Approve conflict |
| ITC-SIM-005 | Reject conflict |
| ITC-SIM-006 | Suspend affected permit |
| ITC-SIM-007 | Resume permit after approval |
| ITC-SIM-008 | Verify notifications |
| ITC-SIM-009 | Verify audit history |
| ITC-SIM-010 | Verify historical conflict records |

---

# **8.10.4 End-to-End Workflow Validation**

The following operational workflow shall be executed successfully during milestone integration testing.

1. Permit is created.  
2. Permit is approved.  
3. LOTOTO activities are completed where applicable.  
4. Permit enters execution.  
5. SIMOPS engine detects overlapping hazardous work.  
6. Conflict alert is generated.  
7. Safety Officer reviews the conflict.  
8. Risk assessment is completed.  
9. Mitigation plan is created.  
10. Conflict is approved or rejected.  
11. Affected permits are updated.  
12. Notifications are issued.  
13. Hazardous work proceeds safely after approval.  
14. Conflict history is archived.

---

# **8.10.5 Milestone Acceptance Criteria**

MS-04 shall be considered complete when:

* All FR-SIM-001 to FR-SIM-010 functional requirements have been implemented.  
* Conflict detection identifies simultaneous operational risks accurately.  
* Risk assessments and mitigation plans function correctly.  
* Approval and rejection workflows operate successfully.  
* Notifications and escalations are generated appropriately.  
* Historical conflict records remain available.  
* Integration with Permit-to-Work and LOTOTO is verified.  
* Positive test cases pass.  
* Negative test cases pass.  
* Integration test cases pass.

---

# **8.10.6 Milestone Exit Criteria**

MS-04 shall be considered successfully completed when:

* No Critical severity defects remain open.  
* No High severity defects prevent operational use.  
* Conflict detection and resolution workflows are operational.  
* Audit logging is verified.  
* Notification generation is verified.  
* Historical conflict records are available.  
* Platform is ready for implementation of Multi-Day Permit Management (MS-05).

---

# **8.10.7 Milestone Definition of Done**

The SIMOPS milestone shall be considered complete when:

* All planned sprints have been completed.  
* All allocated functional requirements have been implemented.  
* All sprint Definition of Done criteria have been satisfied.  
* All integration activities have been completed.  
* All integration test cases have passed.  
* End-to-end workflow validation has passed.  
* Acceptance criteria have been satisfied.  
* Exit criteria have been satisfied.  
* Documentation has been updated.  
* The milestone has been approved for progression to MS-05.

---

# **9\. Milestone 5 – Multi-Day Permit Management**

## **9.1 Milestone Overview**

### **Milestone ID**

**MS-05**

### **Milestone Name**

**Multi-Day Permit Management**

### **Objective**

The Multi-Day Permit Management milestone extends the Permit-to-Work lifecycle by supporting hazardous work activities that span multiple days while ensuring daily verification of safety conditions before work recommences.

Rather than requiring permits to be recreated each day, the platform shall enable controlled continuation of work through structured daily revalidation, progress monitoring, extension management and suspension workflows.

This milestone ensures that permits remain valid only while safety conditions continue to satisfy organisational requirements.

---

## **9.2 Business Goals**

The primary goals of this milestone are to:

* Support permits spanning multiple working days.  
* Record daily work progress.  
* Perform mandatory daily revalidation.  
* Support permit continuation.  
* Manage permit extensions.  
* Suspend permits when conditions change.  
* Maintain complete historical records.  
* Preserve auditability throughout the permit lifecycle.

---

## **9.3 Functional Requirements**

This milestone implements the following functional requirements defined within the Product Requirements Document.

### **Daily Progress**

* FR-MDP-001  
* FR-MDP-002  
* FR-MDP-003  
* FR-MDP-004

### **Daily Revalidation**

* FR-MDP-005  
* FR-MDP-006  
* FR-MDP-007  
* FR-MDP-008

---

## **9.4 Milestone Deliverables**

Upon completion of this milestone, the platform shall support:

### **Daily Operations**

* Daily progress recording.  
* Daily safety review.  
* Daily work summary.  
* Shift handover records.

---

### **Permit Continuation**

* Daily revalidation.  
* Continue permit.  
* Suspend permit.  
* Cancel permit.  
* Extend permit duration.

---

### **Monitoring**

* Daily activity history.  
* Extension history.  
* Revalidation history.  
* Complete audit trail.

---

## **9.5 Sprint Breakdown**

| Sprint | Sprint Name | Primary Deliverable |
| ----- | ----- | ----- |
| SP-05.01 | Daily Progress | Daily work tracking and monitoring |
| SP-05.02 | Daily Revalidation | Permit continuation and extension management |

---

## **9.6 Technology Allocation**

| Layer | Responsibilities |
| ----- | ----- |
| **Next.js** | Daily progress dashboard, revalidation workflows and permit extension management |
| **NestJS** | Daily validation engine, continuation workflow and business rules |
| **PostgreSQL** | Daily records, revalidation history, extension records and audit logs |
| **Drizzle ORM** | Schema definitions and migrations |
| **Keycloak** | Role-based access for Supervisors, Safety Officers and Job Issuers |
| **Redis** | Cache active multi-day permits |
| **BullMQ** | Daily reminder jobs, expiry notifications and revalidation scheduling |
| **MinIO** | Store daily evidence and supporting documents |
| **React Native** | Daily progress updates, inspections and field revalidation |
| **Grafana Loki** | Logging of all multi-day permit activities |
| **Metabase** | Daily operational reporting |

---

## **9.7 Exit Criteria**

MS-05 shall be considered complete when:

* All FR-MDP-001 to FR-MDP-008 requirements have been implemented.  
* Daily progress recording functions correctly.  
* Daily revalidation workflows are operational.  
* Permit continuation and extension workflows function correctly.  
* Positive and negative test cases pass.  
* Platform is ready for implementation of Incident Management.

---

# **9.8 Sprint SP-05.01 – Daily Progress**

## **9.8.1 Sprint Overview**

| Attribute | Value |
| ----- | ----- |
| Sprint ID | SP-05.01 |
| Sprint Name | Daily Progress |
| Milestone | MS-05 – Multi-Day Permit Management |
| Sprint Type | Feature Sprint |
| Priority | High |
| Estimated Duration | 2 Weeks |
| Dependencies | MS-02 – Permit-to-Work Core |

---

# **9.8.2 Functional Requirements Covered**

This sprint implements daily monitoring of ongoing hazardous work for permits spanning multiple working days.

| Functional Requirement | Description |
| ----- | ----- |
| FR-MDP-001 | Daily progress recording |
| FR-MDP-002 | Daily work summary |
| FR-MDP-003 | Shift handover |
| FR-MDP-004 | Daily activity history |

---

# **9.8.3 Sprint Objectives**

The objective of this sprint is to provide operational visibility into the daily execution of long-running hazardous work.

Upon completion:

* Daily work progress can be recorded.  
* Daily work summaries are maintained.  
* Shift handovers are documented.  
* Supervisors can monitor daily activities.  
* Historical progress records remain available.

---

# **9.8.4 Dependencies**

This sprint depends on:

| Sprint | Dependency |
| ----- | ----- |
| SP-02.03 | Permit Execution |
| SP-02.04 | Permit Closure |

Subsequent dependent sprint:

* SP-05.02 Daily Revalidation

---

# **9.8.5 User Stories**

### **US-MDP-001**

**As a Job Executor, I want to record daily work progress so that ongoing hazardous work is documented accurately.**

---

### **US-MDP-002**

**As a Supervisor, I want to review daily work summaries so that I can monitor progress and identify operational issues.**

---

### **US-MDP-003**

**As a Shift Supervisor, I want to document shift handovers so that incoming personnel understand the current work status.**

---

### **US-MDP-004**

**As a Safety Officer, I want historical daily activity records so that compliance can be demonstrated during audits.**

---

# **9.8.6 Use Cases**

## **UC-MDP-001**

### **Record Daily Progress**

**Primary Actor**

Job Executor

#### **Preconditions**

* Permit is Active.  
* Current workday has commenced.

#### **Main Flow**

1. Open active permit.  
2. Select **Daily Progress**.  
3. Enter work completed.  
4. Record outstanding activities.  
5. Upload photographs if required.  
6. Save progress.

---

## **UC-MDP-002**

### **Complete Shift Handover**

#### **Main Flow**

1. Open handover form.  
2. Record completed activities.  
3. Record outstanding work.  
4. Record safety observations.  
5. Assign incoming personnel.  
6. Save handover.

---

## **UC-MDP-003**

### **Review Daily History**

#### **Main Flow**

1. Open permit.  
2. Select Daily History.  
3. Review previous progress.  
4. View uploaded evidence.  
5. Export records if authorised.

---

# **9.8.7 Business Rules**

| ID | Business Rule |
| ----- | ----- |
| BR-MDP-001 | Daily progress shall be recorded once per operational day. |
| BR-MDP-002 | Shift handover shall be completed before responsibility changes. |
| BR-MDP-003 | Daily entries shall remain immutable after submission. |
| BR-MDP-004 | Daily activity history shall remain permanently associated with the permit. |
| BR-MDP-005 | All daily updates shall generate audit records. |

---

# **9.8.8 Functional Criteria**

| ID | Functional Criterion |
| ----- | ----- |
| FC-MDP-001 | Daily progress supports text and attachments. |
| FC-MDP-002 | Multiple daily entries shall be supported across the permit lifecycle. |
| FC-MDP-003 | Shift handover supports personnel assignment. |
| FC-MDP-004 | Daily history shall remain searchable. |
| FC-MDP-005 | Historical daily records shall remain read-only after submission. |

---

# **9.8.9 Backend Implementation (NestJS)**

### **Modules**

* Daily Progress Module  
* Shift Handover Module  
* Daily History Module

### **Controllers**

* DailyProgressController  
* ShiftHandoverController

### **Services**

* DailyProgressService  
* ShiftHandoverService  
* DailyHistoryService

### **DTOs**

* DailyProgressDto  
* ShiftHandoverDto  
* DailySummaryDto

### **Validation**

* Active permit validation  
* Duplicate daily entry validation  
* Handover validation  
* Attachment validation

---

# **9.8.10 Frontend Implementation (Next.js)**

Pages

* Daily Progress  
* Shift Handover  
* Daily History

Components

* Daily Progress Form  
* Work Summary Card  
* Handover Form  
* Timeline  
* Evidence Viewer  
* Activity Feed

---

# **9.8.11 Mobile Implementation (React Native)**

Screens

* Daily Progress  
* Shift Handover  
* Daily History

Capabilities

* Offline progress recording  
* Camera uploads  
* Background synchronisation  
* Daily notifications

---

# **9.8.12 Database Implementation**

Tables

* permit\_daily\_progress  
* shift\_handovers  
* daily\_activity\_history

Implementation Activities

* Daily timestamps  
* Handover records  
* Historical indexing  
* Migration scripts

---

# **9.8.13 Infrastructure Dependencies**

* Redis caching  
* BullMQ daily reminder jobs  
* MinIO evidence storage  
* Keycloak role validation  
* Grafana Loki logging

---

# **9.8.14 API Endpoints**

| Method | Endpoint | Purpose |
| ----- | ----- | ----- |
| POST | `/api/v1/permits/{id}/daily-progress` | Record daily progress |
| GET | `/api/v1/permits/{id}/daily-progress` | View daily history |
| POST | `/api/v1/permits/{id}/handover` | Complete shift handover |
| GET | `/api/v1/permits/{id}/handover` | View handover history |

---

# **9.8.15 Positive Use Cases**

* Record daily progress.  
* Upload daily evidence.  
* Complete shift handover.  
* Review daily history.  
* Export daily records.

---

# **9.8.16 Negative Use Cases**

* Record duplicate daily entry.  
* Complete handover for inactive permit.  
* Modify submitted daily record.  
* Upload invalid attachment.  
* Access another organisation's daily records.

---

# **9.8.17 Positive Test Cases**

| ID | Description |
| ----- | ----- |
| TC-MDP-001 | Record daily progress |
| TC-MDP-002 | Upload daily evidence |
| TC-MDP-003 | Complete shift handover |
| TC-MDP-004 | View daily history |
| TC-MDP-005 | Export daily records |

---

# **9.8.18 Negative Test Cases**

| ID | Description |
| ----- | ----- |
| NTC-MDP-001 | Duplicate daily progress |
| NTC-MDP-002 | Invalid handover |
| NTC-MDP-003 | Modify historical record |
| NTC-MDP-004 | Invalid attachment |
| NTC-MDP-005 | Unauthorised record access |

---

# **9.8.19 Acceptance Criteria**

* Daily progress can be recorded.  
* Shift handovers function correctly.  
* Historical records remain available.  
* Audit logs are generated.  
* Daily evidence is retained successfully.

---

# **9.8.20 Negative Acceptance Criteria**

* The system shall not permit multiple daily progress entries for the same permit on the same operational day unless organisational policy explicitly allows multiple shifts.  
* The system shall not allow modification of submitted daily records.  
* The system shall not allow handover for inactive or closed permits.  
* The system shall not permit unauthorised access to daily history.  
* The system shall not accept invalid evidence uploads.

---

# **9.8.21 Definition of Done**

This sprint is complete when:

* All FR-MDP-001 to FR-MDP-004 requirements are implemented.  
* Daily progress recording workflows are operational.  
* Shift handover functionality is complete.  
* Historical daily activity records are available.  
* APIs pass functional and integration testing.  
* Web and mobile interfaces are complete.  
* Positive and negative test cases pass.  
* Acceptance criteria are satisfied.

---

# **9.9 Sprint SP-05.02 – Daily Revalidation**

## **9.9.1 Sprint Overview**

| Attribute | Value |
| ----- | ----- |
| Sprint ID | SP-05.02 |
| Sprint Name | Daily Revalidation |
| Milestone | MS-05 – Multi-Day Permit Management |
| Sprint Type | Feature Sprint |
| Priority | Critical |
| Estimated Duration | 2 Weeks |
| Dependencies | SP-05.01 – Daily Progress |

---

# **9.9.2 Functional Requirements Covered**

This sprint implements the daily safety verification process required before work on a multi-day permit can continue.

| Functional Requirement | Description |
| ----- | ----- |
| FR-MDP-005 | Daily permit revalidation |
| FR-MDP-006 | Permit continuation |
| FR-MDP-007 | Permit suspension |
| FR-MDP-008 | Permit extension |

---

# **9.9.3 Sprint Objectives**

The objective of this sprint is to ensure that hazardous work continues only after safety conditions have been reassessed and approved at the beginning of each operational day.

Upon completion:

* Daily revalidation can be performed.  
* Safety conditions can be reassessed.  
* Permits can be continued.  
* Permits can be suspended.  
* Permit duration can be extended where authorised.  
* Complete revalidation history is maintained.

---

# **9.9.4 Dependencies**

This sprint depends on:

| Sprint | Dependency |
| ----- | ----- |
| SP-05.01 | Daily Progress |
| SP-02.03 | Permit Execution |
| SP-02.04 | Permit Closure |

Subsequent dependent sprint:

* SP-06.01 Incident Management

---

# **9.9.5 User Stories**

---

### **US-MDP-005**

**As a Safety Officer, I want to perform daily permit revalidation so that work only continues when conditions remain safe.**

---

### **US-MDP-006**

**As a Supervisor, I want to continue a permit after successful revalidation so that work can proceed without issuing a new permit.**

---

### **US-MDP-007**

**As a Supervisor, I want to suspend a permit when safety conditions change so that hazardous work stops immediately.**

---

### **US-MDP-008**

**As a Head of Department, I want to approve permit extensions when additional working days are required.**

---

# **9.9.6 Use Cases**

---

## **UC-MDP-004**

### **Perform Daily Revalidation**

**Primary Actor**

Safety Officer

#### **Preconditions**

* Permit is Active.  
* Permit spans multiple operational days.  
* Current operational day has commenced.

#### **Main Flow**

1. Open active permit.  
2. Review previous day's activities.  
3. Inspect work area.  
4. Review hazards.  
5. Verify PPE requirements.  
6. Confirm environmental conditions.  
7. Record inspection findings.  
8. Complete revalidation.

#### **Postconditions**

Permit becomes eligible for continuation.

---

## **UC-MDP-005**

### **Continue Permit**

#### **Main Flow**

1. Review completed revalidation.  
2. Select **Continue Permit**.  
3. System records continuation.  
4. Permit remains Active.  
5. Work resumes.

---

## **UC-MDP-006**

### **Suspend Permit**

#### **Main Flow**

1. Open permit.  
2. Select **Suspend Permit**.  
3. Record suspension reason.  
4. Confirm suspension.  
5. Notify affected personnel.

---

## **UC-MDP-007**

### **Extend Permit**

#### **Main Flow**

1. Select **Request Extension**.  
2. Enter extension period.  
3. Enter justification.  
4. Submit request.  
5. Head of Department reviews request.  
6. Approve or reject extension.  
7. Update permit expiry.

---

# **9.9.7 Business Rules**

| ID | Business Rule |
| ----- | ----- |
| BR-MDP-006 | Daily revalidation shall be completed before work recommences each day. |
| BR-MDP-007 | Failed revalidation shall automatically suspend the permit. |
| BR-MDP-008 | Permit extensions require approval from the authorised approver. |
| BR-MDP-009 | Every revalidation activity shall generate an audit record. |
| BR-MDP-010 | Revalidation history shall remain permanently associated with the permit. |
| BR-MDP-011 | Suspended permits shall not continue until successful revalidation has been completed. |

---

# **9.9.8 Functional Criteria**

| ID | Functional Criterion |
| ----- | ----- |
| FC-MDP-006 | Revalidation shall support configurable inspection checklists. |
| FC-MDP-007 | Permit continuation shall only be available after successful revalidation. |
| FC-MDP-008 | Suspension reasons shall be mandatory. |
| FC-MDP-009 | Extension requests shall support approval workflows. |
| FC-MDP-010 | Daily revalidation history shall remain searchable. |
| FC-MDP-011 | Extension history shall remain immutable. |

---

# **9.9.9 Backend Implementation (NestJS)**

### **Modules**

* Revalidation Module  
* Permit Continuation Module  
* Permit Extension Module

### **Controllers**

* RevalidationController  
* PermitContinuationController  
* PermitExtensionController

### **Services**

* RevalidationService  
* ContinuationService  
* ExtensionService  
* SuspensionService

### **DTOs**

* RevalidationDto  
* ContinuePermitDto  
* SuspendPermitDto  
* PermitExtensionDto

### **Validation**

* Permit status validation  
* Revalidation checklist validation  
* Extension validation  
* Approval validation  
* Suspension validation

---

# **9.9.10 Frontend Implementation (Next.js)**

Pages

* Daily Revalidation  
* Permit Continuation  
* Permit Extension  
* Revalidation History

Components

* Inspection Checklist  
* Continuation Dialog  
* Suspension Dialog  
* Extension Request Form  
* Approval Timeline  
* Revalidation Summary

---

# **9.9.11 Mobile Implementation (React Native)**

Screens

* Daily Inspection  
* Permit Continuation  
* Permit Suspension  
* Extension Request

Capabilities

* Offline inspections  
* Camera evidence capture  
* Digital signatures  
* Synchronisation of inspection records

---

# **9.9.12 Database Implementation**

Tables

* permit\_revalidations  
* permit\_extensions  
* permit\_suspensions  
* revalidation\_history

Implementation Activities

* Revalidation timestamps  
* Extension approval records  
* Suspension history  
* Historical indexing  
* Migration scripts

---

# **9.9.13 Infrastructure Dependencies**

* Redis for active permit caching  
* BullMQ daily reminder and extension approval jobs  
* MinIO storage for inspection evidence  
* Keycloak role validation  
* Grafana Loki logging

---

# **9.9.14 API Endpoints**

| Method | Endpoint | Purpose |
| ----- | ----- | ----- |
| POST | `/api/v1/permits/{id}/revalidate` | Complete daily revalidation |
| POST | `/api/v1/permits/{id}/continue` | Continue permit |
| POST | `/api/v1/permits/{id}/suspend` | Suspend permit |
| POST | `/api/v1/permits/{id}/extensions` | Request extension |
| POST | `/api/v1/extensions/{id}/approve` | Approve extension |
| POST | `/api/v1/extensions/{id}/reject` | Reject extension |

---

# **9.9.15 Positive Use Cases**

* Complete daily revalidation.  
* Continue permit.  
* Suspend permit.  
* Request extension.  
* Approve extension.  
* View revalidation history.

---

# **9.9.16 Negative Use Cases**

* Continue permit without revalidation.  
* Submit incomplete inspection.  
* Suspend permit without reason.  
* Approve unauthorised extension.  
* Continue suspended permit.  
* Modify completed revalidation records.

---

# **9.9.17 Positive Test Cases**

| ID | Description |
| ----- | ----- |
| TC-MDP-006 | Complete daily revalidation |
| TC-MDP-007 | Continue permit |
| TC-MDP-008 | Suspend permit |
| TC-MDP-009 | Request extension |
| TC-MDP-010 | Approve extension |
| TC-MDP-011 | View revalidation history |

---

# **9.9.18 Negative Test Cases**

| ID | Description |
| ----- | ----- |
| NTC-MDP-006 | Continue without revalidation |
| NTC-MDP-007 | Incomplete inspection |
| NTC-MDP-008 | Missing suspension reason |
| NTC-MDP-009 | Unauthorised extension approval |
| NTC-MDP-010 | Modify historical revalidation |
| NTC-MDP-011 | Continue suspended permit |

---

# **9.9.19 Acceptance Criteria**

* Daily revalidation is completed before work recommences.  
* Permit continuation functions correctly.  
* Permit suspension is operational.  
* Permit extensions follow the approval workflow.  
* Revalidation history remains available.  
* Audit logs are generated for all revalidation activities.

---

# **9.9.20 Negative Acceptance Criteria**

* The system shall not permit continuation without successful daily revalidation.  
* The system shall not allow suspension without a recorded reason.  
* The system shall not permit unauthorised users to approve permit extensions.  
* The system shall not allow modification of completed revalidation records.  
* The system shall not permit work to recommence while a permit remains suspended.

---

# **9.9.21 Definition of Done**

This sprint is complete when:

* All FR-MDP-005 to FR-MDP-008 requirements are implemented.  
* Daily revalidation workflows are operational.  
* Permit continuation, suspension and extension workflows function correctly.  
* APIs pass functional and integration testing.  
* Web and mobile interfaces are complete.  
* Positive and negative test cases pass.  
* Acceptance criteria are satisfied.

---

# **9.10 Milestone 5 Integration**

## **9.10.1 Integrated Modules**

The following modules shall be fully integrated at the conclusion of MS-05:

* Organisation Management  
* Workforce Management  
* Master Data Management  
* Permit-to-Work  
* LOTOTO  
* SIMOPS  
* Multi-Day Permit Management  
* Authentication & RBAC  
* Notifications  
* Audit Logging  
* Attachment Management

---

## **9.10.2 Integration Activities**

### **Permit-to-Work Integration**

* Verify multi-day permit creation.  
* Verify permit continuation after successful revalidation.  
* Verify suspension and resumption workflows.  
* Verify permit closure after successful completion.

---

### **LOTOTO Integration**

* Verify active isolation remains valid across multiple working days.  
* Verify daily revalidation includes LOTOTO status checks.  
* Verify restoration requirements before permit closure.

---

### **SIMOPS Integration**

* Verify conflict detection after daily continuation.  
* Verify active conflicts suspend permit continuation.  
* Verify resolved conflicts allow work to recommence.

---

### **Workforce Integration**

* Verify shift handovers.  
* Verify personnel reassignment.  
* Verify competency validation across multiple days.

---

### **Notification Integration**

Verify notifications for:

* Daily revalidation due.  
* Permit continued.  
* Permit suspended.  
* Extension requested.  
* Extension approved.  
* Extension rejected.

---

### **Audit Logging Integration**

Verify audit records for:

* Daily progress.  
* Shift handover.  
* Daily revalidation.  
* Permit continuation.  
* Permit suspension.  
* Permit extension.  
* Approval decisions.

---

# **9.10.3 Integration Test Cases**

| Test Case ID | Description |
| ----- | ----- |
| ITC-MDP-001 | Record daily progress |
| ITC-MDP-002 | Complete shift handover |
| ITC-MDP-003 | Complete daily revalidation |
| ITC-MDP-004 | Continue permit |
| ITC-MDP-005 | Suspend permit |
| ITC-MDP-006 | Request extension |
| ITC-MDP-007 | Approve extension |
| ITC-MDP-008 | Verify notifications |
| ITC-MDP-009 | Verify audit history |
| ITC-MDP-010 | Complete multi-day permit lifecycle |

---

# **9.10.4 End-to-End Workflow Validation**

The following operational workflow shall be executed successfully during milestone integration testing.

1. Multi-day permit is approved.  
2. Day 1 work is completed.  
3. Daily progress is recorded.  
4. Shift handover is completed.  
5. Work pauses.  
6. Day 2 begins.  
7. Daily revalidation is performed.  
8. Permit continuation is approved.  
9. Work resumes.  
10. Additional days follow the same workflow.  
11. Permit extension is requested where required.  
12. Extension is approved.  
13. Hazardous work is completed.  
14. Final permit closure is completed.  
15. Complete multi-day history is retained.

---

# **9.10.5 Milestone Acceptance Criteria**

MS-05 shall be considered complete when:

* All FR-MDP-001 to FR-MDP-008 functional requirements have been implemented.  
* Daily progress and shift handovers operate correctly.  
* Daily revalidation is enforced before continuation.  
* Permit suspension and extension workflows function correctly.  
* Integration with Permit-to-Work, LOTOTO and SIMOPS is verified.  
* Positive test cases pass.  
* Negative test cases pass.  
* Integration test cases pass.

---

# **9.10.6 Milestone Exit Criteria**

MS-05 shall be considered successfully completed when:

* No Critical severity defects remain open.  
* No High severity defects prevent operational use.  
* Multi-day permit workflows are operational.  
* Audit logging is verified.  
* Notification generation is verified.  
* Historical records are available.  
* Platform is ready for implementation of Incident Management (MS-06).

---

# **9.10.7 Milestone Definition of Done**

The Multi-Day Permit Management milestone shall be considered complete when:

* All planned sprints have been completed.  
* All allocated functional requirements have been implemented.  
* All sprint Definition of Done criteria have been satisfied.  
* All integration activities have been completed.  
* All integration test cases have passed.  
* End-to-end workflow validation has passed.  
* Acceptance criteria have been satisfied.  
* Exit criteria have been satisfied.  
* Documentation has been updated.  
* The milestone has been approved for progression to MS-06.

---

# **10\. Milestone 6 – Incident Management**

## **10.1 Milestone Overview**

### **Milestone ID**

**MS-06**

### **Milestone Name**

**Incident Management**

### **Objective**

The Incident Management milestone introduces a structured workflow for recording, investigating, managing and resolving workplace incidents, near misses and unsafe conditions associated with hazardous work activities.

This milestone extends the Permit-to-Work platform beyond work execution by enabling organisations to respond effectively to operational incidents, perform root cause investigations, implement corrective actions and maintain comprehensive incident records for regulatory compliance and continuous improvement.

Upon completion, the platform shall provide a complete incident lifecycle integrated with permits, personnel, equipment and operational history.

---

## **10.2 Business Goals**

The primary goals of this milestone are to:

* Digitise incident reporting.  
* Record near misses and unsafe conditions.  
* Conduct structured investigations.  
* Identify root causes.  
* Assign corrective and preventive actions.  
* Track action completion.  
* Maintain regulatory compliance.  
* Preserve complete incident history.

---

## **10.3 Functional Requirements**

This milestone implements the following functional requirements defined within the Product Requirements Document.

### **Incident Recording**

* FR-INC-001  
* FR-INC-002  
* FR-INC-003  
* FR-INC-004

### **Investigation**

* FR-INC-005  
* FR-INC-006  
* FR-INC-007  
* FR-INC-008

### **Incident Closure**

* FR-INC-009  
* FR-INC-010

---

## **10.4 Milestone Deliverables**

Upon completion of this milestone, the platform shall support:

### **Incident Reporting**

* Incident reporting.  
* Near miss reporting.  
* Unsafe condition reporting.  
* Evidence collection.  
* Incident categorisation.

---

### **Investigation**

* Investigation assignment.  
* Root cause analysis.  
* Corrective action management.  
* Preventive action management.  
* Investigation history.

---

### **Closure**

* Incident verification.  
* Corrective action completion.  
* Incident closure.  
* Historical archive.  
* Audit trail.

---

## **10.5 Sprint Breakdown**

| Sprint | Sprint Name | Primary Deliverable |
| ----- | ----- | ----- |
| SP-06.01 | Incident Recording | Incident reporting and evidence collection |
| SP-06.02 | Investigation | Investigation and corrective action management |
| SP-06.03 | Incident Closure | Incident verification and closure |

---

## **10.6 Technology Allocation**

| Layer | Responsibilities |
| ----- | ----- |
| **Next.js** | Incident reporting, investigation workspace and corrective action management |
| **NestJS** | Incident workflow engine, investigation services and action tracking |
| **PostgreSQL** | Incident records, investigations, corrective actions and audit history |
| **Drizzle ORM** | Database schema and migrations |
| **Keycloak** | Role-based access for reporters, investigators and Safety Officers |
| **Redis** | Cache active investigations |
| **BullMQ** | Notifications, reminders and overdue corrective action jobs |
| **MinIO** | Incident photographs, evidence and investigation documents |
| **React Native** | Mobile incident reporting and field investigation |
| **Grafana Loki** | Incident audit logging |
| **Metabase** | Incident analytics and reporting |

---

## **10.7 Exit Criteria**

MS-06 shall be considered complete when:

* All FR-INC-001 to FR-INC-010 requirements have been implemented.  
* Incident reporting operates successfully.  
* Investigation workflows are operational.  
* Corrective action tracking functions correctly.  
* Incident closure is operational.  
* Positive and negative test cases pass.  
* Platform is ready for Notifications, Dashboards & Analytics.

---

# **10.8 Sprint SP-06.01 – Incident Recording**

## **10.8.1 Sprint Overview**

| Attribute | Value |
| ----- | ----- |
| Sprint ID | SP-06.01 |
| Sprint Name | Incident Recording |
| Milestone | MS-06 – Incident Management |
| Sprint Type | Feature Sprint |
| Priority | Critical |
| Estimated Duration | 2 Weeks |
| Dependencies | MS-05 – Multi-Day Permit Management |

---

# **10.8.2 Functional Requirements Covered**

This sprint implements the reporting of workplace incidents, near misses and unsafe conditions.

| Functional Requirement | Description |
| ----- | ----- |
| FR-INC-001 | Record incident |
| FR-INC-002 | Record near miss |
| FR-INC-003 | Record unsafe condition |
| FR-INC-004 | Capture incident evidence |

---

# **10.8.3 Sprint Objectives**

The objective of this sprint is to provide a structured mechanism for recording operational incidents immediately after they occur.

Upon completion:

* Incidents can be reported.  
* Near misses can be recorded.  
* Unsafe conditions can be reported.  
* Evidence can be uploaded.  
* Incidents can be linked to permits and equipment.  
* Notifications are generated automatically.

---

# **10.8.4 Dependencies**

This sprint depends on:

| Sprint | Dependency |
| ----- | ----- |
| SP-02.03 | Permit Execution |
| SP-03.03 | LOTOTO Restoration |
| SP-04.02 | SIMOPS Conflict Resolution |
| SP-05.02 | Daily Revalidation |

Subsequent dependent sprints:

* SP-06.02 Investigation

---

# **10.8.5 User Stories**

### **US-INC-001**

**As a Worker, I want to report an incident immediately so that appropriate action can be taken.**

---

### **US-INC-002**

**As a Worker, I want to report a near miss so that future incidents can be prevented.**

---

### **US-INC-003**

**As a Supervisor, I want to report unsafe conditions so that hazards can be eliminated before work continues.**

---

### **US-INC-004**

**As a Safety Officer, I want incidents linked to permits and equipment so that investigations have complete operational context.**

---

# **10.8.6 Use Cases**

## **UC-INC-001**

### **Report Incident**

**Primary Actor**

Worker

#### **Preconditions**

* User is authenticated.  
* User has reporting permissions.

#### **Main Flow**

1. Open Incident Reporting.  
2. Select incident type.  
3. Enter incident details.  
4. Select permit.  
5. Select equipment.  
6. Upload evidence.  
7. Submit report.  
8. Incident reference generated.  
9. Safety Officer notified.

---

## **UC-INC-002**

### **Report Near Miss**

#### **Main Flow**

1. Open reporting page.  
2. Select Near Miss.  
3. Record event.  
4. Upload evidence.  
5. Submit report.

---

## **UC-INC-003**

### **Report Unsafe Condition**

#### **Main Flow**

1. Select Unsafe Condition.  
2. Record location.  
3. Record description.  
4. Upload photographs.  
5. Submit report.

---

# **10.8.7 Business Rules**

| ID | Business Rule |
| ----- | ----- |
| BR-INC-001 | Every incident shall receive a unique reference number. |
| BR-INC-002 | Incidents may be linked to permits, personnel and equipment. |
| BR-INC-003 | Evidence shall remain permanently associated with the incident. |
| BR-INC-004 | Every submitted incident shall notify the Safety Officer. |
| BR-INC-005 | Incident records shall generate audit logs automatically. |

---

# **10.8.8 Functional Criteria**

| ID | Functional Criterion |
| ----- | ----- |
| FC-INC-001 | Multiple incident categories shall be supported. |
| FC-INC-002 | Multiple evidence files may be uploaded. |
| FC-INC-003 | Permit association shall be optional where appropriate. |
| FC-INC-004 | Equipment association shall support multiple assets. |
| FC-INC-005 | Incident history shall remain immutable. |

---

# **10.8.9 Backend Implementation (NestJS)**

### **Modules**

* Incident Module  
* Evidence Module  
* Notification Module

### **Controllers**

* IncidentController  
* IncidentEvidenceController

### **Services**

* IncidentService  
* IncidentEvidenceService  
* IncidentNotificationService

### **DTOs**

* CreateIncidentDto  
* NearMissDto  
* UnsafeConditionDto  
* UploadIncidentEvidenceDto

### **Validation**

* Incident validation  
* Attachment validation  
* Permit validation  
* Equipment validation

---

# **10.8.10 Frontend Implementation (Next.js)**

Pages

* Incident Reporting  
* Near Miss Reporting  
* Unsafe Condition Reporting  
* Incident Dashboard

Components

* Incident Form  
* Evidence Upload  
* Incident Category Selector  
* Permit Selector  
* Equipment Selector  
* Incident Summary

---

# **10.8.11 Mobile Implementation (React Native)**

Screens

* Report Incident  
* Report Near Miss  
* Report Unsafe Condition

Capabilities

* Offline reporting  
* Camera integration  
* GPS capture (optional)  
* Background synchronisation

---

# **10.8.12 Database Implementation**

Tables

* incidents  
* incident\_evidence  
* incident\_equipment  
* incident\_permits

Implementation Activities

* Incident numbering  
* Foreign keys  
* Audit fields  
* Migration scripts

---

# **10.8.13 Infrastructure Dependencies**

* Redis caching  
* BullMQ incident notifications  
* MinIO evidence storage  
* Keycloak role validation  
* Grafana Loki logging

---

# **10.8.14 API Endpoints**

| Method | Endpoint | Purpose |
| ----- | ----- | ----- |
| POST | `/api/v1/incidents` | Create incident |
| GET | `/api/v1/incidents` | List incidents |
| GET | `/api/v1/incidents/{id}` | View incident |
| POST | `/api/v1/incidents/{id}/evidence` | Upload evidence |
| PATCH | `/api/v1/incidents/{id}` | Update incident |
| POST | `/api/v1/incidents/{id}/submit` | Submit incident report |

---

# **10.8.15 Positive Use Cases**

* Report incident.  
* Report near miss.  
* Report unsafe condition.  
* Upload evidence.  
* Associate permit.  
* Associate equipment.

---

# **10.8.16 Negative Use Cases**

* Submit incomplete incident.  
* Upload invalid evidence.  
* Associate invalid permit.  
* Submit duplicate incident.  
* Access restricted incident.

---

# **10.8.17 Positive Test Cases**

| ID | Description |
| ----- | ----- |
| TC-INC-001 | Report incident |
| TC-INC-002 | Report near miss |
| TC-INC-003 | Report unsafe condition |
| TC-INC-004 | Upload evidence |
| TC-INC-005 | Associate permit |

---

# **10.8.18 Negative Test Cases**

| ID | Description |
| ----- | ----- |
| NTC-INC-001 | Missing mandatory information |
| NTC-INC-002 | Invalid attachment |
| NTC-INC-003 | Duplicate incident |
| NTC-INC-004 | Invalid permit reference |
| NTC-INC-005 | Unauthorised access |

---

# **10.8.19 Acceptance Criteria**

* Incidents can be reported successfully.  
* Near misses and unsafe conditions can be recorded.  
* Evidence uploads function correctly.  
* Permit and equipment associations are operational.  
* Notifications are generated automatically.  
* Audit logs are maintained.

---

# **10.8.20 Negative Acceptance Criteria**

* The system shall not allow incomplete incident reports to be submitted.  
* The system shall not accept invalid evidence uploads.  
* The system shall not allow duplicate incident submissions where duplicate detection rules apply.  
* The system shall not allow unauthorised users to access restricted incident records.  
* The system shall not allow deletion of submitted incident records.

---

# **10.8.21 Definition of Done**

This sprint is complete when:

* All FR-INC-001 to FR-INC-004 requirements are implemented.  
* Incident reporting workflows are operational.  
* Evidence management functions correctly.  
* APIs pass functional and integration testing.  
* Web and mobile interfaces are complete.  
* Positive and negative test cases pass.  
* Acceptance criteria are satisfied.

---

# **10.9 Sprint SP-06.02 – Investigation**

## **10.9.1 Sprint Overview**

| Attribute | Value |
| ----- | ----- |
| Sprint ID | SP-06.02 |
| Sprint Name | Investigation |
| Milestone | MS-06 – Incident Management |
| Sprint Type | Feature Sprint |
| Priority | Critical |
| Estimated Duration | 3 Weeks |
| Dependencies | SP-06.01 – Incident Recording |

---

# **10.9.2 Functional Requirements Covered**

This sprint implements the investigation workflow, root cause analysis and corrective action management for reported incidents.

| Functional Requirement | Description |
| ----- | ----- |
| FR-INC-005 | Assign investigation |
| FR-INC-006 | Root cause analysis |
| FR-INC-007 | Corrective action management |
| FR-INC-008 | Preventive action management |

---

# **10.9.3 Sprint Objectives**

The objective of this sprint is to ensure every reported incident is investigated using a structured workflow that identifies contributing factors, determines root causes and assigns corrective and preventive actions.

Upon completion:

* Investigations can be assigned.  
* Root cause analyses can be completed.  
* Corrective actions can be assigned.  
* Preventive actions can be tracked.  
* Investigation history is maintained.  
* Investigation progress is visible to authorised users.

---

# **10.9.4 Dependencies**

This sprint depends on:

| Sprint | Dependency |
| ----- | ----- |
| SP-06.01 | Incident Recording |
| SP-02.04 | Permit Closure |
| SP-03.03 | Restoration & History |

Subsequent dependent sprint:

* SP-06.03 Incident Closure

---

# **10.9.5 User Stories**

---

### **US-INC-005**

**As a Safety Officer, I want to assign investigators so that reported incidents are reviewed promptly.**

---

### **US-INC-006**

**As an Investigator, I want to document root causes so that appropriate corrective actions can be identified.**

---

### **US-INC-007**

**As a Supervisor, I want to assign corrective actions to responsible personnel so that identified risks are eliminated.**

---

### **US-INC-008**

**As a Safety Manager, I want to monitor investigation progress so that investigations are completed within organisational timelines.**

---

# **10.9.6 Use Cases**

---

## **UC-INC-004**

### **Assign Investigation**

**Primary Actor**

Safety Officer

#### **Preconditions**

* Incident has been submitted.  
* Incident status is **Open**.

#### **Main Flow**

1. Open incident.  
2. Select investigator.  
3. Set investigation priority.  
4. Assign due date.  
5. Save assignment.  
6. Notify investigator.

---

## **UC-INC-005**

### **Perform Root Cause Analysis**

#### **Main Flow**

1. Review incident details.  
2. Review evidence.  
3. Interview personnel.  
4. Record findings.  
5. Identify root cause.  
6. Save investigation.

---

## **UC-INC-006**

### **Create Corrective Action**

#### **Main Flow**

1. Select investigation.  
2. Create corrective action.  
3. Assign responsible person.  
4. Set due date.  
5. Save action.  
6. Notify assignee.

---

## **UC-INC-007**

### **Create Preventive Action**

#### **Main Flow**

1. Open investigation.  
2. Record preventive recommendation.  
3. Assign responsible owner.  
4. Save recommendation.  
5. Monitor implementation.

---

# **10.9.7 Business Rules**

| ID | Business Rule |
| ----- | ----- |
| BR-INC-006 | Every submitted incident shall be assigned to an investigator. |
| BR-INC-007 | Root cause analysis shall be completed before incident closure. |
| BR-INC-008 | Corrective actions shall be assigned to responsible personnel. |
| BR-INC-009 | Preventive actions shall remain trackable until completion. |
| BR-INC-010 | Investigation activities shall generate audit records. |
| BR-INC-011 | Investigation history shall remain immutable. |

---

# **10.9.8 Functional Criteria**

| ID | Functional Criterion |
| ----- | ----- |
| FC-INC-006 | Multiple investigators may be assigned where required. |
| FC-INC-007 | Root cause analysis shall support configurable methodologies. |
| FC-INC-008 | Multiple corrective actions may be assigned. |
| FC-INC-009 | Preventive actions shall support progress tracking. |
| FC-INC-010 | Investigation history shall remain searchable. |
| FC-INC-011 | Notifications shall be generated for assignments and overdue actions. |

---

# **10.9.9 Backend Implementation (NestJS)**

### **Modules**

* Investigation Module  
* Root Cause Analysis Module  
* Corrective Action Module  
* Preventive Action Module

### **Controllers**

* InvestigationController  
* CorrectiveActionController

### **Services**

* InvestigationService  
* RootCauseService  
* CorrectiveActionService  
* PreventiveActionService  
* ActionTrackingService

### **DTOs**

* AssignInvestigationDto  
* RootCauseAnalysisDto  
* CorrectiveActionDto  
* PreventiveActionDto

### **Validation**

* Investigator assignment validation  
* Root cause validation  
* Due date validation  
* Action ownership validation  
* Investigation status validation

---

# **10.9.10 Frontend Implementation (Next.js)**

Pages

* Investigation Dashboard  
* Root Cause Analysis  
* Corrective Actions  
* Preventive Actions

Components

* Investigation Timeline  
* Root Cause Editor  
* Corrective Action List  
* Preventive Action List  
* Due Date Tracker  
* Progress Summary  
* Activity Feed

---

# **10.9.11 Mobile Implementation (React Native)**

Screens

* Investigation Details  
* Corrective Actions  
* Preventive Actions

Capabilities

* Investigation updates  
* Corrective action completion  
* Evidence viewing  
* Push notifications

---

# **10.9.12 Database Implementation**

Tables

* investigations  
* root\_causes  
* corrective\_actions  
* preventive\_actions  
* investigation\_history

Implementation Activities

* Investigation assignment records  
* Action tracking  
* Historical indexing  
* Audit fields  
* Migration scripts

---

# **10.9.13 Infrastructure Dependencies**

* Redis for investigation queues  
* BullMQ assignment reminders and overdue action jobs  
* MinIO investigation evidence storage  
* Keycloak role validation  
* Grafana Loki investigation logging

---

# **10.9.14 API Endpoints**

| Method | Endpoint | Purpose |
| ----- | ----- | ----- |
| POST | `/api/v1/incidents/{id}/assign` | Assign investigation |
| POST | `/api/v1/incidents/{id}/root-cause` | Record root cause |
| POST | `/api/v1/incidents/{id}/corrective-actions` | Create corrective action |
| POST | `/api/v1/incidents/{id}/preventive-actions` | Create preventive action |
| GET | `/api/v1/incidents/{id}/investigation` | View investigation |
| PATCH | `/api/v1/corrective-actions/{id}` | Update corrective action |

---

# **10.9.15 Positive Use Cases**

* Assign investigator.  
* Complete root cause analysis.  
* Create corrective action.  
* Create preventive action.  
* Update investigation progress.  
* Monitor overdue actions.

---

# **10.9.16 Negative Use Cases**

* Assign invalid investigator.  
* Close investigation without root cause.  
* Create corrective action without owner.  
* Set invalid due date.  
* Modify completed investigation.  
* Access restricted investigation.

---

# **10.9.17 Positive Test Cases**

| ID | Description |
| ----- | ----- |
| TC-INC-006 | Assign investigation |
| TC-INC-007 | Record root cause |
| TC-INC-008 | Create corrective action |
| TC-INC-009 | Create preventive action |
| TC-INC-010 | Track investigation progress |
| TC-INC-011 | Monitor overdue actions |

---

# **10.9.18 Negative Test Cases**

| ID | Description |
| ----- | ----- |
| NTC-INC-006 | Invalid investigator assignment |
| NTC-INC-007 | Missing root cause |
| NTC-INC-008 | Missing corrective action owner |
| NTC-INC-009 | Invalid due date |
| NTC-INC-010 | Modify completed investigation |
| NTC-INC-011 | Unauthorised investigation access |

---

# **10.9.19 Acceptance Criteria**

* Investigations can be assigned successfully.  
* Root cause analyses can be completed.  
* Corrective and preventive actions can be assigned.  
* Investigation progress is tracked.  
* Notifications are generated.  
* Audit logs are maintained.

---

# **10.9.20 Negative Acceptance Criteria**

* The system shall not allow incident closure before root cause analysis is completed.  
* The system shall not allow corrective actions without assigned owners.  
* The system shall not allow unauthorised users to modify investigations.  
* The system shall not allow modification of completed investigations.  
* The system shall not allow invalid investigation due dates.

---

# **10.9.21 Definition of Done**

This sprint is complete when:

* All FR-INC-005 to FR-INC-008 requirements are implemented.  
* Investigation workflows are operational.  
* Root cause analysis functions correctly.  
* Corrective and preventive action management is operational.  
* APIs pass functional and integration testing.  
* Web and mobile interfaces are complete.  
* Positive and negative test cases pass.  
* Acceptance criteria are satisfied.

---

# **10.10 Sprint SP-06.03 – Incident Closure**

## **10.10.1 Sprint Overview**

| Attribute | Value |
| ----- | ----- |
| Sprint ID | SP-06.03 |
| Sprint Name | Incident Closure |
| Milestone | MS-06 – Incident Management |
| Sprint Type | Feature Sprint |
| Priority | High |
| Estimated Duration | 2 Weeks |
| Dependencies | SP-06.02 – Investigation |

---

# **10.10.2 Functional Requirements Covered**

This sprint implements the verification, closure and archival of completed incident investigations.

| Functional Requirement | Description |
| ----- | ----- |
| FR-INC-009 | Incident verification |
| FR-INC-010 | Incident closure |

---

# **10.10 Sprint SP-06.03 – Incident Closure**

## **10.10.1 Sprint Overview**

| Attribute | Value |
| ----- | ----- |
| Sprint ID | SP-06.03 |
| Sprint Name | Incident Closure |
| Milestone | MS-06 – Incident Management |
| Sprint Type | Feature Sprint |
| Priority | High |
| Estimated Duration | 2 Weeks |
| Dependencies | SP-06.02 – Investigation |

---

# **10.10.2 Functional Requirements Covered**

This sprint implements the verification, closure and archival of completed incident investigations.

| Functional Requirement | Description |
| ----- | ----- |
| FR-INC-009 | Incident verification |
| FR-INC-010 | Incident closure |

---

# **10.10.3 Sprint Objectives**

The objective of this sprint is to verify that all investigation activities, corrective actions and preventive actions have been completed before an incident is formally closed.

Upon completion:

* Investigations can be verified.  
* Corrective actions are confirmed complete.  
* Preventive actions are reviewed.  
* Incidents can be closed.  
* Historical incident records are archived.  
* Complete audit history is preserved.

---

# **10.10.4 Dependencies**

This sprint depends on:

| Sprint | Dependency |
| ----- | ----- |
| SP-06.01 | Incident Recording |
| SP-06.02 | Investigation |

Subsequent dependent milestone:

* MS-07 Notifications, Dashboards & Analytics

---

# **10.10.5 User Stories**

---

### **US-INC-009**

**As a Safety Manager, I want to verify completed investigations so that incidents are only closed after all required actions have been completed.**

---

### **US-INC-010**

**As a Supervisor, I want incidents to be formally closed so that operational records remain complete and accurate.**

---

### **US-INC-011**

**As an Auditor, I want access to historical incident records so that regulatory compliance can be demonstrated.**

---

### **US-INC-012**

**As a Compliance Officer, I want completed investigations archived so that future audits and trend analysis can be performed.**

---

# **10.10.6 Use Cases**

---

## **UC-INC-008**

### **Verify Investigation**

**Primary Actor**

Safety Manager

#### **Preconditions**

* Investigation completed.  
* Root cause identified.  
* Corrective actions completed.  
* Preventive actions reviewed.

#### **Main Flow**

1. Open completed investigation.  
2. Review investigation findings.  
3. Review corrective actions.  
4. Review preventive actions.  
5. Verify completion.  
6. Record verification comments.  
7. Save verification.

---

## **UC-INC-009**

### **Close Incident**

#### **Main Flow**

1. Open verified investigation.  
2. Select **Close Incident**.  
3. Confirm closure.  
4. System validates completion requirements.  
5. Incident status changes to **Closed**.  
6. Audit record generated.  
7. Incident archived.

---

## **UC-INC-010**

### **View Historical Incident**

#### **Main Flow**

1. Open Incident Archive.  
2. Search incident.  
3. View investigation.  
4. View corrective actions.  
5. View evidence.  
6. Export report where authorised.

---

# **10.10.7 Business Rules**

| ID | Business Rule |
| ----- | ----- |
| BR-INC-012 | Incidents shall not be closed until all mandatory corrective actions are completed. |
| BR-INC-013 | Incident verification is mandatory before closure. |
| BR-INC-014 | Closed incident records shall become read-only. |
| BR-INC-015 | Historical incident records shall remain permanently available. |
| BR-INC-016 | Every closure activity shall generate an audit record. |

---

# **10.10.8 Functional Criteria**

| ID | Functional Criterion |
| ----- | ----- |
| FC-INC-012 | Verification shall record reviewer details and timestamps. |
| FC-INC-013 | Incident closure shall validate outstanding corrective actions automatically. |
| FC-INC-014 | Historical records shall support search and filtering. |
| FC-INC-015 | Historical evidence shall remain accessible. |
| FC-INC-016 | Incident archives shall support reporting and analytics. |

---

# **10.10.9 Backend Implementation (NestJS)**

### **Modules**

* Incident Closure Module  
* Verification Module  
* Incident Archive Module

### **Controllers**

* IncidentClosureController  
* IncidentArchiveController

### **Services**

* IncidentClosureService  
* VerificationService  
* IncidentArchiveService

### **DTOs**

* VerifyIncidentDto  
* CloseIncidentDto  
* IncidentArchiveSearchDto

### **Validation**

* Investigation completion validation  
* Corrective action validation  
* Verification validation  
* Archive permission validation

---

# **10.10.10 Frontend Implementation (Next.js)**

Pages

* Incident Verification  
* Incident Closure  
* Incident Archive  
* Historical Incident Viewer

Components

* Investigation Summary  
* Corrective Action Summary  
* Closure Dialog  
* Archive Search  
* Historical Timeline  
* Evidence Viewer

---

# **10.10.11 Mobile Implementation (React Native)**

Screens

* Incident Verification  
* Incident Summary  
* Historical Incidents

Capabilities

* Review investigation  
* Verify corrective actions  
* View historical incidents  
* Offline synchronisation

---

# **10.10.12 Database Implementation**

Tables

* incident\_closures  
* incident\_verifications  
* incident\_archive

Implementation Activities

* Archive indexing  
* Historical optimisation  
* Verification records  
* Migration scripts

---

# **10.10.13 Infrastructure Dependencies**

* Redis archive caching  
* BullMQ closure notifications  
* MinIO historical evidence storage  
* Keycloak permission validation  
* Grafana Loki logging

---

# **10.10.14 API Endpoints**

| Method | Endpoint | Purpose |
| ----- | ----- | ----- |
| POST | `/api/v1/incidents/{id}/verify` | Verify investigation |
| POST | `/api/v1/incidents/{id}/close` | Close incident |
| GET | `/api/v1/incidents/archive` | List archived incidents |
| GET | `/api/v1/incidents/archive/{id}` | View archived incident |
| GET | `/api/v1/incidents/{id}/history` | View complete incident history |

---

# **10.10.15 Positive Use Cases**

* Verify completed investigation.  
* Close incident.  
* Search incident archive.  
* View historical incident.  
* Export investigation report.

---

# **10.10.16 Negative Use Cases**

* Close incident with outstanding corrective actions.  
* Verify incomplete investigation.  
* Modify archived incident.  
* Delete historical incident.  
* Access archive without permission.

---

# **10.10.17 Positive Test Cases**

| ID | Description |
| ----- | ----- |
| TC-INC-012 | Verify investigation |
| TC-INC-013 | Close incident |
| TC-INC-014 | Search incident archive |
| TC-INC-015 | View historical incident |
| TC-INC-016 | Export investigation report |

---

# **10.10.18 Negative Test Cases**

| ID | Description |
| ----- | ----- |
| NTC-INC-012 | Close with incomplete corrective actions |
| NTC-INC-013 | Verify incomplete investigation |
| NTC-INC-014 | Modify archived incident |
| NTC-INC-015 | Delete historical incident |
| NTC-INC-016 | Unauthorised archive access |

---

# **10.10.19 Acceptance Criteria**

* Investigations can be verified successfully.  
* Incidents can be closed after all mandatory activities are completed.  
* Historical incident records remain available.  
* Audit logs are generated for all closure activities.  
* Historical evidence remains accessible.

---

# **10.10.20 Negative Acceptance Criteria**

* The system shall not permit incident closure before all mandatory corrective actions are completed.  
* The system shall not permit incident verification for incomplete investigations.  
* The system shall not allow modification or deletion of archived incident records.  
* The system shall not permit unauthorised users to access historical incident records.  
* The system shall not permit reopening of archived incidents except through authorised administrative procedures.

---

# **10.10.21 Definition of Done**

This sprint is complete when:

* All FR-INC-009 to FR-INC-010 requirements are implemented.  
* Incident verification and closure workflows are operational.  
* Historical incident archives are available.  
* APIs pass functional and integration testing.  
* Web and mobile interfaces are complete.  
* Positive and negative test cases pass.  
* Acceptance criteria are satisfied.

---

# **10.11 Milestone 6 Integration**

## **10.11.1 Integrated Modules**

The following modules shall be fully integrated at the conclusion of MS-06:

* Organisation Management  
* Workforce Management  
* Master Data Management  
* Permit-to-Work  
* LOTOTO  
* SIMOPS  
* Multi-Day Permit Management  
* Incident Management  
* Authentication & RBAC  
* Notifications  
* Audit Logging  
* Attachment Management

---

## **10.11.2 Integration Activities**

### **Permit-to-Work Integration**

* Verify incidents can be linked to permits.  
* Verify permit history references related incidents.  
* Verify incident status is reflected within permit records where applicable.

---

### **LOTOTO Integration**

* Verify incidents can reference LOTOTO activities.  
* Verify isolation history is accessible during investigations.  
* Verify restoration records are available to investigators.

---

### **SIMOPS Integration**

* Verify incidents can reference SIMOPS conflicts.  
* Verify conflict history is available during investigation.  
* Verify conflict records support root cause analysis.

---

### **Multi-Day Permit Integration**

* Verify incidents can reference daily progress records.  
* Verify revalidation history is available during investigations.  
* Verify extension history is retained.

---

### **Workforce Integration**

* Verify investigator assignments.  
* Verify responsible action owners.  
* Verify organisational hierarchy.  
* Verify competency records.

---

### **Notification Integration**

Verify notifications for:

* Incident reported.  
* Investigation assigned.  
* Corrective action assigned.  
* Corrective action overdue.  
* Incident verified.  
* Incident closed.

---

### **Audit Logging Integration**

Verify audit records for:

* Incident creation.  
* Investigation assignment.  
* Root cause analysis.  
* Corrective actions.  
* Preventive actions.  
* Incident verification.  
* Incident closure.

---

# **10.11.3 Integration Test Cases**

| Test Case ID | Description |
| ----- | ----- |
| ITC-INC-001 | Report incident |
| ITC-INC-002 | Assign investigation |
| ITC-INC-003 | Complete root cause analysis |
| ITC-INC-004 | Create corrective action |
| ITC-INC-005 | Complete corrective action |
| ITC-INC-006 | Verify investigation |
| ITC-INC-007 | Close incident |
| ITC-INC-008 | Verify notifications |
| ITC-INC-009 | Verify audit history |
| ITC-INC-010 | Verify historical archive |

---

# **10.11.4 End-to-End Workflow Validation**

The following operational workflow shall be executed successfully during milestone integration testing.

1. Incident occurs during hazardous work.  
2. Worker reports incident.  
3. Evidence is uploaded.  
4. Safety Officer reviews incident.  
5. Investigator is assigned.  
6. Root cause analysis is completed.  
7. Corrective actions are assigned.  
8. Preventive actions are assigned.  
9. Responsible personnel complete assigned actions.  
10. Investigation is verified.  
11. Incident is closed.  
12. Historical records remain available.  
13. Incident analytics include the completed investigation.

---

# **10.11.5 Milestone Acceptance Criteria**

MS-06 shall be considered complete when:

* All FR-INC-001 to FR-INC-010 functional requirements have been implemented.  
* Incident reporting functions correctly.  
* Investigation workflows operate successfully.  
* Corrective and preventive action management is operational.  
* Incident closure and archival function correctly.  
* Integration with Permit-to-Work, LOTOTO, SIMOPS and Multi-Day Permit Management is verified.  
* Positive test cases pass.  
* Negative test cases pass.  
* Integration test cases pass.

---

# **10.11.6 Milestone Exit Criteria**

MS-06 shall be considered successfully completed when:

* No Critical severity defects remain open.  
* No High severity defects prevent operational use.  
* Incident management workflows are operational.  
* Audit logging is verified.  
* Notification generation is verified.  
* Historical incident records are available.  
* Platform is ready for implementation of Notifications, Dashboards & Analytics (MS-07).

---

# **10.11.7 Milestone Definition of Done**

The Incident Management milestone shall be considered complete when:

* All planned sprints have been completed.  
* All allocated functional requirements have been implemented.  
* All sprint Definition of Done criteria have been satisfied.  
* All integration activities have been completed.  
* All integration test cases have passed.  
* End-to-end workflow validation has passed.  
* Acceptance criteria have been satisfied.  
* Exit criteria have been satisfied.  
* Documentation has been updated.  
* The milestone has been approved for progression to MS-07.

---

# **11\. Milestone 7 – Notifications, Dashboards & Analytics**

## **11.1 Milestone Overview**

### **Milestone ID**

**MS-07**

### **Milestone Name**

**Notifications, Dashboards & Analytics**

### **Objective**

The Notifications, Dashboards & Analytics milestone provides operational visibility across the Permit-to-Work platform by delivering real-time notifications, configurable dashboards and analytical reporting.

This milestone consolidates operational data generated throughout the Permit-to-Work lifecycle into actionable insights that support supervisors, safety officers and management in monitoring work activities, identifying trends and making informed operational decisions.

Upon completion, the platform shall provide configurable dashboards, automated notifications, operational KPIs and comprehensive reporting capabilities.

---

## **11.2 Business Goals**

The primary goals of this milestone are to:

* Deliver real-time operational notifications.  
* Provide role-based dashboards.  
* Support operational reporting.  
* Display safety KPIs.  
* Monitor permit performance.  
* Analyse incident and compliance trends.  
* Improve operational visibility.  
* Support data-driven decision making.

---

## **11.3 Functional Requirements**

This milestone implements the following functional requirements defined within the Product Requirements Document.

### **Notifications**

* FR-NTF-001  
* FR-NTF-002  
* FR-NTF-003  
* FR-NTF-004

### **Dashboards & Reporting**

* FR-DSH-001  
* FR-DSH-002  
* FR-DSH-003  
* FR-DSH-004  
* FR-DSH-005  
* FR-DSH-006

---

## **11.4 Milestone Deliverables**

Upon completion of this milestone, the platform shall support:

### **Notifications**

* In-app notifications.  
* Task reminders.  
* Escalation notifications.  
* System announcements.  
* Notification history.

---

### **Dashboards**

* Personal dashboard.  
* Supervisor dashboard.  
* Safety dashboard.  
* Management dashboard.  
* Operational summaries.

---

### **Analytics & Reporting**

* Permit analytics.  
* Incident analytics.  
* LOTOTO analytics.  
* SIMOPS analytics.  
* Workforce analytics.  
* Exportable reports.

---

## **11.5 Sprint Breakdown**

| Sprint | Sprint Name | Primary Deliverable |
| ----- | ----- | ----- |
| SP-07.01 | Notifications | Notification engine and delivery |
| SP-07.02 | Dashboards & Analytics | Operational dashboards and reporting |

---

## **11.6 Technology Allocation**

| Layer | Responsibilities |
| ----- | ----- |
| **Next.js** | Dashboards, notification centre and reporting interface |
| **NestJS** | Notification engine, reporting APIs and analytics services |
| **PostgreSQL** | Notification records, dashboard data and report metadata |
| **Drizzle ORM** | Schema management and migrations |
| **Keycloak** | Role-based dashboard access |
| **Redis** | Notification queues and dashboard caching |
| **BullMQ** | Background notification delivery and scheduled report generation |
| **Metabase** | Business intelligence dashboards and analytics |
| **Recharts** | Interactive charts and visualisations |
| **React Native** | Mobile notifications and dashboards |
| **Grafana Loki** | Operational monitoring and log analytics |

---

## **11.7 Exit Criteria**

MS-07 shall be considered complete when:

* All FR-NTF-001 to FR-NTF-004 requirements have been implemented.  
* All FR-DSH-001 to FR-DSH-006 requirements have been implemented.  
* Notifications are delivered successfully.  
* Dashboards display operational data correctly.  
* Reports are generated successfully.  
* Positive and negative test cases pass.  
* Platform is ready for production deployment.

---

# **11.8 Sprint SP-07.01 – Notifications**

## **11.8.1 Sprint Overview**

| Attribute | Value |
| ----- | ----- |
| Sprint ID | SP-07.01 |
| Sprint Name | Notifications |
| Milestone | MS-07 – Notifications, Dashboards & Analytics |
| Sprint Type | Feature Sprint |
| Priority | High |
| Estimated Duration | 2 Weeks |
| Dependencies | MS-06 – Incident Management |

---

# **11.8.2 Functional Requirements Covered**

This sprint implements the platform-wide notification engine responsible for informing users about operational events and workflow actions.

| Functional Requirement | Description |
| ----- | ----- |
| FR-NTF-001 | In-app notifications |
| FR-NTF-002 | Task reminders |
| FR-NTF-003 | Escalation notifications |
| FR-NTF-004 | Notification history |

---

# **11.8.3 Sprint Objectives**

The objective of this sprint is to ensure users receive timely notifications regarding work assignments, approvals, incidents, safety events and operational reminders.

Upon completion:

* Notifications are generated automatically.  
* Reminder jobs execute successfully.  
* Escalation workflows operate correctly.  
* Notification history is retained.  
* Users can review notification status.

---

# **11.8.4 Dependencies**

This sprint depends on all previous functional milestones, including:

| Sprint | Dependency |
| ----- | ----- |
| SP-02.02 | Permit Approval |
| SP-03.02 | Isolation Execution |
| SP-04.02 | Conflict Resolution |
| SP-05.02 | Daily Revalidation |
| SP-06.03 | Incident Closure |

Subsequent dependent sprint:

* SP-07.02 Dashboards & Analytics

---

# **11.8.5 User Stories**

---

### **US-NTF-001**

**As a User, I want to receive notifications for assigned tasks so that I can respond promptly.**

---

### **US-NTF-002**

**As a Supervisor, I want reminders for pending approvals and overdue activities so that operational delays are minimised.**

---

### **US-NTF-003**

**As a Safety Officer, I want escalation notifications for critical events so that immediate action can be taken.**

---

### **US-NTF-004**

**As an Auditor, I want notification history retained so that operational communications can be reviewed.**

---

# **11.8.6 Use Cases**

## **UC-NTF-001**

### **Generate Notification**

**Primary Actor**

System

#### **Preconditions**

* Triggering business event occurs.

#### **Main Flow**

1. Detect event.  
2. Determine recipients.  
3. Generate notification.  
4. Save notification.  
5. Deliver notification.  
6. Record delivery status.

---

## **UC-NTF-002**

### **View Notifications**

#### **Main Flow**

1. Open Notification Centre.  
2. View unread notifications.  
3. Mark notification as read.  
4. View notification details.

---

## **UC-NTF-003**

### **Escalate Overdue Activity**

#### **Main Flow**

1. Detect overdue activity.  
2. Generate escalation.  
3. Notify supervisor.  
4. Notify Safety Officer where required.  
5. Record escalation history.

---

# **11.8.7 Business Rules**

| ID | Business Rule |
| ----- | ----- |
| BR-NTF-001 | Notifications shall be generated automatically by workflow events. |
| BR-NTF-002 | Notifications shall only be delivered to authorised users. |
| BR-NTF-003 | Escalations shall follow configured organisational rules. |
| BR-NTF-004 | Notification history shall remain immutable. |
| BR-NTF-005 | Failed deliveries shall be logged for retry processing. |

---

# **11.8.8 Functional Criteria**

| ID | Functional Criterion |
| ----- | ----- |
| FC-NTF-001 | Multiple recipients shall be supported. |
| FC-NTF-002 | Notifications shall support priority levels. |
| FC-NTF-003 | Reminder schedules shall be configurable. |
| FC-NTF-004 | Delivery status shall be tracked. |
| FC-NTF-005 | Notification history shall remain searchable. |

---

# **11.8.9 Backend Implementation (NestJS)**

### **Modules**

* Notification Module  
* Reminder Module  
* Escalation Module

### **Controllers**

* NotificationController

### **Services**

* NotificationService  
* ReminderService  
* EscalationService  
* DeliveryService

### **DTOs**

* NotificationDto  
* ReminderDto  
* EscalationDto

### **Validation**

* Recipient validation  
* Permission validation  
* Notification priority validation  
* Delivery validation

---

# **11.8.10 Frontend Implementation (Next.js)**

Pages

* Notification Centre  
* Notification History

Components

* Notification Bell  
* Notification List  
* Notification Badge  
* Reminder Panel  
* Notification Filters

---

# **11.8.11 Mobile Implementation (React Native)**

Screens

* Notifications  
* Notification Details

Capabilities

* Push notifications  
* Read/unread management  
* Offline synchronisation

---

# **11.8.12 Database Implementation**

Tables

* notifications  
* notification\_recipients  
* notification\_history

Implementation Activities

* Delivery tracking  
* Read status  
* Retry queue metadata  
* Migration scripts

---

# **11.8.13 Infrastructure Dependencies**

* Redis notification queues  
* BullMQ scheduled reminders  
* Keycloak recipient validation  
* Grafana Loki delivery logging

---

# **11.8.14 API Endpoints**

| Method | Endpoint | Purpose |
| ----- | ----- | ----- |
| GET | `/api/v1/notifications` | List notifications |
| GET | `/api/v1/notifications/{id}` | View notification |
| PATCH | `/api/v1/notifications/{id}/read` | Mark notification as read |
| POST | `/api/v1/notifications/test` | Test notification delivery |

---

# **11.8.15 Positive Use Cases**

* Generate notification.  
* Deliver reminder.  
* Escalate overdue activity.  
* View notification history.  
* Mark notification as read.

---

# **11.8.16 Negative Use Cases**

* Notify invalid recipient.  
* Duplicate notification.  
* Failed delivery.  
* Unauthorised notification access.  
* Invalid escalation rule.

---

# **11.8.17 Positive Test Cases**

| ID | Description |
| ----- | ----- |
| TC-NTF-001 | Generate notification |
| TC-NTF-002 | Deliver reminder |
| TC-NTF-003 | Escalate overdue activity |
| TC-NTF-004 | View notification history |
| TC-NTF-005 | Mark notification as read |

---

# **11.8.18 Negative Test Cases**

| ID | Description |
| ----- | ----- |
| NTC-NTF-001 | Invalid recipient |
| NTC-NTF-002 | Duplicate notification |
| NTC-NTF-003 | Failed delivery |
| NTC-NTF-004 | Unauthorised notification access |
| NTC-NTF-005 | Invalid escalation rule |

---

# **11.8.19 Acceptance Criteria**

* Notifications are generated automatically.  
* Reminders are delivered successfully.  
* Escalations function correctly.  
* Notification history remains available.  
* Delivery status is tracked.

---

# **11.8.20 Negative Acceptance Criteria**

* The system shall not deliver notifications to unauthorised users.  
* The system shall not generate duplicate notifications for the same event.  
* The system shall not lose notification history.  
* The system shall not suppress mandatory escalation notifications.  
* The system shall not mark notifications as delivered when delivery has failed.

---

# **11.8.21 Definition of Done**

This sprint is complete when:

* All FR-NTF-001 to FR-NTF-004 requirements are implemented.  
* Notification workflows are operational.  
* Reminder and escalation services function correctly.  
* APIs pass functional and integration testing.  
* Web and mobile interfaces are complete.  
* Positive and negative test cases pass.  
* Acceptance criteria are satisfied.

---

# **11.9 Sprint SP-07.02 – Dashboards & Analytics**

## **11.9.1 Sprint Overview**

| Attribute | Value |
| ----- | ----- |
| Sprint ID | SP-07.02 |
| Sprint Name | Dashboards & Analytics |
| Milestone | MS-07 – Notifications, Dashboards & Analytics |
| Sprint Type | Feature Sprint |
| Priority | High |
| Estimated Duration | 3 Weeks |
| Dependencies | SP-07.01 – Notifications |

---

# **11.9.2 Functional Requirements Covered**

This sprint implements operational dashboards, KPI visualisations and analytical reporting across the Permit-to-Work platform.

| Functional Requirement | Description |
| ----- | ----- |
| FR-DSH-001 | Personal dashboard |
| FR-DSH-002 | Supervisor dashboard |
| FR-DSH-003 | Safety dashboard |
| FR-DSH-004 | Operational analytics |
| FR-DSH-005 | Report generation |
| FR-DSH-006 | KPI monitoring |

---

# **11.9.3 Sprint Objectives**

The objective of this sprint is to provide real-time operational visibility through configurable dashboards and analytical reporting that support day-to-day operations and management decision-making.

Upon completion:

* Role-based dashboards are available.  
* Operational KPIs are displayed.  
* Reports can be generated.  
* Historical trends are visualised.  
* Dashboard data refreshes automatically.  
* Analytical reports support exports.

---

# **11.9.4 Dependencies**

This sprint depends on:

| Sprint | Dependency |
| ----- | ----- |
| SP-02.04 | Permit Closure |
| SP-03.03 | Restoration & History |
| SP-04.02 | Conflict Resolution |
| SP-05.02 | Daily Revalidation |
| SP-06.03 | Incident Closure |
| SP-07.01 | Notifications |

This is the final implementation sprint.

---

# **11.9.5 User Stories**

---

### **US-DSH-001**

**As a Worker, I want a personalised dashboard so that I can quickly view my assigned permits, tasks and notifications.**

---

### **US-DSH-002**

**As a Supervisor, I want operational dashboards so that I can monitor ongoing work, approvals and outstanding activities.**

---

### **US-DSH-003**

**As a Safety Officer, I want safety analytics so that I can identify trends, monitor compliance and improve operational safety.**

---

### **US-DSH-004**

**As a Manager, I want executive dashboards and reports so that I can monitor organisational performance and make informed decisions.**

---

# **11.9.6 Use Cases**

---

## **UC-DSH-001**

### **View Personal Dashboard**

**Primary Actor**

Authenticated User

#### **Preconditions**

* User is authenticated.

#### **Main Flow**

1. User logs in.  
2. Open Dashboard.  
3. System loads assigned work.  
4. Display active permits.  
5. Display pending tasks.  
6. Display notifications.  
7. Display upcoming deadlines.

---

## **UC-DSH-002**

### **View Safety Dashboard**

#### **Main Flow**

1. Open Safety Dashboard.  
2. View active permits.  
3. View incidents.  
4. View LOTOTO status.  
5. View SIMOPS conflicts.  
6. View compliance indicators.  
7. View operational KPIs.

---

## **UC-DSH-003**

### **Generate Report**

#### **Main Flow**

1. Select report.  
2. Apply filters.  
3. Select date range.  
4. Generate report.  
5. View report.  
6. Export report.

---

## **UC-DSH-004**

### **Monitor Operational KPIs**

#### **Main Flow**

1. Open KPI Dashboard.  
2. Review current metrics.  
3. Compare historical trends.  
4. Identify exceptions.  
5. Drill down into supporting records.

---

# **11.9.7 Business Rules**

| ID | Business Rule |
| ----- | ----- |
| BR-DSH-001 | Dashboard content shall be role-based. |
| BR-DSH-002 | Dashboard data shall display only authorised information. |
| BR-DSH-003 | Reports shall support configurable filtering. |
| BR-DSH-004 | KPI calculations shall be generated from operational data. |
| BR-DSH-005 | Dashboard access shall generate audit records where required. |
| BR-DSH-006 | Historical analytics shall remain available for authorised users. |

---

# **11.9.8 Functional Criteria**

| ID | Functional Criterion |
| ----- | ----- |
| FC-DSH-001 | Dashboards shall refresh automatically. |
| FC-DSH-002 | Charts shall support interactive filtering. |
| FC-DSH-003 | Reports shall support PDF and spreadsheet export. |
| FC-DSH-004 | KPI widgets shall support configurable time periods. |
| FC-DSH-005 | Dashboard layout shall adapt to user roles. |
| FC-DSH-006 | Historical analytics shall support trend comparisons. |

---

# **11.9.9 Backend Implementation (NestJS)**

### **Modules**

* Dashboard Module  
* Analytics Module  
* Reporting Module  
* KPI Module

### **Controllers**

* DashboardController  
* ReportingController  
* AnalyticsController

### **Services**

* DashboardService  
* ReportingService  
* AnalyticsService  
* KPIService

### **DTOs**

* DashboardFilterDto  
* ReportRequestDto  
* KPIFilterDto

### **Validation**

* User permission validation  
* Report parameter validation  
* Export validation  
* Dashboard filter validation

---

# **11.9.10 Frontend Implementation (Next.js)**

Pages

* Personal Dashboard  
* Supervisor Dashboard  
* Safety Dashboard  
* Management Dashboard  
* Reports  
* Analytics

Components

* KPI Cards  
* Activity Timeline  
* Permit Summary Cards  
* Incident Summary Cards  
* Recharts Visualisations  
* Filters  
* Export Dialog  
* Trend Graphs  
* Dashboard Widgets  
* Data Tables

---

# **11.9.11 Mobile Implementation (React Native)**

Screens

* Personal Dashboard  
* Notifications  
* KPI Summary  
* Assigned Tasks

Capabilities

* Dashboard overview  
* Mobile KPI widgets  
* Report viewing  
* Offline dashboard cache  
* Push notification integration

---

# **11.9.12 Database Implementation**

Tables

* dashboard\_preferences  
* report\_exports  
* analytics\_snapshots  
* kpi\_cache

Implementation Activities

* Dashboard preference storage  
* KPI aggregation  
* Report metadata  
* Cached analytics  
* Migration scripts

---

# **11.9.13 Infrastructure Dependencies**

* Redis dashboard caching  
* BullMQ scheduled report generation  
* Metabase analytics integration  
* Recharts visualisation layer  
* Keycloak permission validation  
* Grafana Loki operational metrics

---

# **11.9.14 API Endpoints**

| Method | Endpoint | Purpose |
| ----- | ----- | ----- |
| GET | `/api/v1/dashboard` | Load dashboard |
| GET | `/api/v1/dashboard/kpis` | Retrieve KPIs |
| GET | `/api/v1/reports` | List reports |
| POST | `/api/v1/reports/generate` | Generate report |
| GET | `/api/v1/analytics` | View analytics |
| GET | `/api/v1/analytics/trends` | View trend analysis |

---

# **11.9.15 Positive Use Cases**

* View personal dashboard.  
* View supervisor dashboard.  
* Generate reports.  
* View operational KPIs.  
* Filter analytics.  
* Export reports.

---

# **11.9.16 Negative Use Cases**

* Access restricted dashboard.  
* Generate report with invalid filters.  
* Export unauthorised report.  
* View restricted KPI data.  
* Access another organisation's analytics.  
* Request unavailable historical period.

---

# **11.9.17 Positive Test Cases**

| ID | Description |
| ----- | ----- |
| TC-DSH-001 | Load personal dashboard |
| TC-DSH-002 | View supervisor dashboard |
| TC-DSH-003 | Generate report |
| TC-DSH-004 | Export report |
| TC-DSH-005 | Display KPI dashboard |
| TC-DSH-006 | Filter analytics |

---

# **11.9.18 Negative Test Cases**

| ID | Description |
| ----- | ----- |
| NTC-DSH-001 | Unauthorised dashboard access |
| NTC-DSH-002 | Invalid report filters |
| NTC-DSH-003 | Export without permission |
| NTC-DSH-004 | Invalid KPI request |
| NTC-DSH-005 | Cross-organisation data access |
| NTC-DSH-006 | Invalid date range |

---

# **11.9.19 Acceptance Criteria**

* Role-based dashboards display correctly.  
* KPI calculations are accurate.  
* Reports generate successfully.  
* Analytics visualisations function correctly.  
* Export functionality operates successfully.  
* Dashboard data refreshes automatically.

---

# **11.9.20 Negative Acceptance Criteria**

* The system shall not display data outside the user's authorised scope.  
* The system shall not generate reports with invalid filter parameters.  
* The system shall not permit unauthorised report exports.  
* The system shall not expose cross-tenant analytical data.  
* The system shall not display inaccurate KPI calculations.

---

# **11.9.21 Definition of Done**

This sprint is complete when:

* All FR-DSH-001 to FR-DSH-006 requirements are implemented.  
* Dashboard functionality is operational.  
* Reporting and analytics services function correctly.  
* APIs pass functional and integration testing.  
* Web and mobile interfaces are complete.  
* Positive and negative test cases pass.  
* Acceptance criteria are satisfied.

---

# **11.10 Milestone 7 Integration**

## **11.10.1 Integrated Modules**

The following modules shall be fully integrated at the conclusion of MS-07:

* Organisation Management  
* Workforce Management  
* Master Data Management  
* Permit-to-Work  
* LOTOTO  
* SIMOPS  
* Multi-Day Permit Management  
* Incident Management  
* Notifications  
* Dashboards  
* Analytics  
* Authentication & RBAC  
* Audit Logging  
* Attachment Management

---

## **11.10.2 Integration Activities**

### **Platform-wide Integration**

* Verify dashboard data aggregation from all modules.  
* Verify notification triggers across all workflows.  
* Verify KPI calculations.  
* Verify report generation.  
* Verify historical analytics.

### **Permit-to-Work Integration**

* Verify permit KPIs.  
* Verify approval metrics.  
* Verify execution metrics.  
* Verify closure statistics.

### **LOTOTO Integration**

* Verify isolation statistics.  
* Verify restoration metrics.  
* Verify historical trend analysis.

### **SIMOPS Integration**

* Verify conflict metrics.  
* Verify mitigation statistics.  
* Verify resolution KPIs.

### **Incident Management Integration**

* Verify incident trends.  
* Verify corrective action metrics.  
* Verify investigation KPIs.

### **Authentication & RBAC Integration**

* Verify role-based dashboards.  
* Verify report permissions.  
* Verify analytical data permissions.

### **Audit Logging Integration**

Verify audit records for:

* Dashboard access.  
* Report generation.  
* Report export.  
* Notification delivery.  
* KPI refresh.  
* Analytics generation.

---

# **11.10.3 Integration Test Cases**

| Test Case ID | Description |
| ----- | ----- |
| ITC-DSH-001 | Load personal dashboard |
| ITC-DSH-002 | Load supervisor dashboard |
| ITC-DSH-003 | Generate operational report |
| ITC-DSH-004 | Export report |
| ITC-DSH-005 | Verify KPI calculations |
| ITC-DSH-006 | Verify analytics |
| ITC-DSH-007 | Verify notification delivery |
| ITC-DSH-008 | Verify dashboard permissions |
| ITC-DSH-009 | Verify historical reporting |
| ITC-DSH-010 | Verify cross-module analytics |

---

# **11.10.4 End-to-End Workflow Validation**

The following operational workflow shall be executed successfully during final system integration testing.

1. User authenticates.  
2. Dashboard loads personalised information.  
3. User creates and completes a Permit-to-Work lifecycle.  
4. LOTOTO activities are completed.  
5. SIMOPS conflicts are detected and resolved.  
6. Multi-day permit activities are completed where applicable.  
7. Incident is reported and managed where required.  
8. Notifications are delivered throughout each workflow.  
9. Operational KPIs update automatically.  
10. Reports are generated successfully.  
11. Historical analytics reflect completed operational activities.  
12. Audit history is available across the platform.

---

# **11.10.5 Milestone Acceptance Criteria**

MS-07 shall be considered complete when:

* All FR-NTF-001 to FR-NTF-004 functional requirements have been implemented.  
* All FR-DSH-001 to FR-DSH-006 functional requirements have been implemented.  
* Notifications are generated and delivered successfully.  
* Dashboards display accurate operational information.  
* KPI calculations are correct.  
* Reports generate successfully.  
* Analytics visualisations function correctly.  
* Integration across all previous milestones is verified.  
* Positive test cases pass.  
* Negative test cases pass.  
* Integration test cases pass.

---

# **11.10.6 Milestone Exit Criteria**

MS-07 shall be considered successfully completed when:

* No Critical severity defects remain open.  
* No High severity defects prevent production deployment.  
* All platform modules are fully integrated.  
* Dashboard and reporting performance meets defined requirements.  
* Notification delivery is verified.  
* Audit logging is verified.  
* Production deployment readiness review has been completed.

---

# **11.10.7 Milestone Definition of Done**

The Notifications, Dashboards & Analytics milestone shall be considered complete when:

* All planned sprints have been completed.  
* All allocated functional requirements have been implemented.  
* All sprint Definition of Done criteria have been satisfied.  
* All integration activities have been completed.  
* All integration test cases have passed.  
* End-to-end workflow validation has passed.  
* Acceptance criteria have been satisfied.  
* Exit criteria have been satisfied.  
* Documentation has been updated.  
* The implementation plan has been completed and approved for production deployment.

---

# **12\. User Interface & Frontend Implementation Strategy**

## **12.1 Purpose**

The User Interface & Frontend Implementation Strategy defines the architectural approach for implementing the web and mobile user interfaces of the Enterprise Permit-to-Work Platform. It establishes the standards, technologies and design principles that ensure consistency, usability, accessibility and maintainability across all functional modules.

This strategy translates the approved design system into reusable frontend components, layouts and interaction patterns that will be implemented throughout the software development lifecycle. It ensures that all screens developed during the implementation remain consistent with the approved visual language, user experience principles and enterprise design standards.

---

## **12.2 Objectives**

The objectives of the User Interface implementation strategy are to:

* Deliver a consistent user experience across all platform modules.  
* Maintain visual consistency through a reusable design system.  
* Support responsive web and mobile interfaces.  
* Improve operational efficiency through intuitive workflows.  
* Minimise user training through predictable interaction patterns.  
* Ensure accessibility compliance.  
* Support organisation-specific branding.  
* Enable rapid development through reusable components.  
* Reduce frontend maintenance through standardised implementation.  
* Provide a scalable interface architecture for future platform enhancements.

---

## **12.3 Design Philosophy**

The Permit-to-Work Platform follows a user-centred design philosophy focused on operational efficiency, safety and clarity. Unlike traditional enterprise applications that prioritise information density alone, the interface is designed to support users operating in industrial environments where speed, accuracy and situational awareness are critical.

The interface implementation is guided by the following principles:

### **Safety-First Design**

Safety-critical information shall receive the highest visual priority. Permit status, isolation state, incidents, conflicts and emergency notifications shall remain immediately visible without requiring unnecessary navigation.

---

### **Progressive Disclosure**

Information shall be presented progressively to reduce cognitive overload. Advanced configuration options, secondary information and administrative functions shall only be displayed when relevant to the user's current task.

---

### **Consistency**

All modules shall reuse common layouts, navigation patterns, interaction behaviours and visual components to minimise the learning curve and provide a predictable user experience.

---

### **Role-Oriented Interfaces**

The interface shall adapt to the responsibilities of each user role. Workers, supervisors, approvers, safety officers and administrators shall only be presented with information and actions relevant to their responsibilities.

---

### **Mobile-First Field Operations**

Interfaces intended for field personnel shall prioritise touch interaction, simplified workflows and offline capability while maintaining feature parity with the web application where appropriate.

---

### **Enterprise Scalability**

The design system shall support future functional modules without requiring significant redesign or deviation from established visual standards.

---

## **12.4 Design System Overview**

The platform utilises a centralised design system that defines the visual language, interaction patterns and reusable interface components used throughout the application. The design system ensures consistency across the web application, mobile application and future platform extensions.

The design system consists of:

* Theme architecture  
* Typography system  
* Colour system  
* Spacing system  
* Iconography  
* Component library  
* Motion system  
* Responsive layout framework  
* Accessibility standards  
* Interaction guidelines

All interface components implemented during development shall conform to this design system unless formally approved through the design governance process.

---

## **12.5 Theme Architecture**

The platform supports multiple interface themes to accommodate different operational environments, organisational preferences and user personas. Rather than implementing isolated user interfaces, all themes share a common component architecture and design token system while varying typography, colour palettes, spacing and visual emphasis.

Theme selection is performed through a centralised theme engine that applies predefined design tokens across the entire application, enabling organisations to customise the visual presentation without modifying functional behaviour.

| Theme | Primary Usage | Design Characteristics |
| ----- | ----- | ----- |
| Hazard | Field operations and site personnel | High contrast, glanceable information, wearable-inspired interface |
| Control Room | Supervisors, HODs and operations centres | Dense dashboards, structured layouts and administrative focus |
| Setu | Workforce onboarding and self-service | Friendly visual language, guided workflows and simplified interactions |
| Ledger Slate | Reporting, finance and administrative operations | Professional documentation-oriented interface with emphasis on analytical data |

Each theme supports both Light and Dark modes while maintaining functional consistency across all application modules.

---

# **12.6 Design Tokens**

The platform shall implement a centralised design token architecture that separates visual styling from application logic. Design tokens provide a consistent source of truth for colours, typography, spacing, elevation, motion and component styling across the web and mobile applications.

Rather than defining styling individually within components, all interface elements shall consume predefined design tokens. This approach enables consistent branding, simplifies theme customisation and reduces frontend maintenance.

The design token architecture shall support runtime theme switching without requiring component modification, ensuring that the same functional interface can adopt multiple visual identities while preserving behaviour and usability.

The primary categories of design tokens include:

* Colour tokens  
* Typography tokens  
* Spacing tokens  
* Border radius tokens  
* Elevation tokens  
* Motion tokens  
* Layering (Z-index) tokens  
* Component state tokens  
* Permit status tokens

---

## **12.6.1 Colour System**

The colour system utilises semantic colour tokens rather than hard-coded colour values. Components reference semantic meanings such as Primary, Success or Warning instead of individual hexadecimal values.

This abstraction enables organisations to customise branding while preserving interface consistency and accessibility.

The primary colour categories include:

| Category | Purpose |
| ----- | ----- |
| Primary | Primary actions and emphasis |
| Secondary | Supporting actions |
| Success | Successful operations |
| Warning | Cautionary information |
| Danger | Critical safety events and destructive actions |
| Information | Informational messages |
| Background | Application surfaces |
| Text | Typography hierarchy |
| Border | Component separation |
| Overlay | Dialogs and modal backgrounds |

Permit lifecycle colours shall remain consistent throughout the application to ensure immediate visual recognition of operational status.

---

## **12.6.2 Typography System**

Typography provides a clear visual hierarchy while maintaining readability across desktop, tablet and mobile devices.

The design system separates display typography from body typography, allowing each theme to establish its own visual identity while preserving information hierarchy.

Typography tokens define:

* Display headings  
* Section headings  
* Page titles  
* Body text  
* Labels  
* Helper text  
* Captions  
* Monospaced operational identifiers

Permit identifiers, equipment identifiers, audit entries and system-generated references shall utilise monospaced typography to improve readability and distinguish operational data from descriptive text.

---

## **12.6.3 Spacing System**

The interface follows a consistent spacing scale based on a standardised grid system.

Spacing tokens define:

* Internal component padding  
* Margins  
* Grid spacing  
* Section spacing  
* Form spacing  
* Card spacing  
* Dashboard layouts

Consistent spacing improves readability, simplifies responsive behaviour and enables predictable component composition throughout the platform.

The spacing system shall be applied uniformly across all reusable components and layouts.

---

## **12.6.4 Border Radius**

Border radius tokens define the visual character of interface components while maintaining consistency across themes.

The design system supports configurable corner radii that range from minimal enterprise styling to softer worker-oriented interfaces.

Border radius tokens shall be applied consistently to:

* Buttons  
* Input fields  
* Cards  
* Modals  
* Tables  
* Dropdowns  
* Navigation elements  
* Dashboard widgets

---

## **12.6.5 Elevation & Shadows**

Elevation communicates component hierarchy and interaction state.

Shadow tokens define:

* Surface elevation  
* Floating menus  
* Dropdowns  
* Modals  
* Notifications  
* Interactive focus states

Elevation shall be used sparingly to preserve clarity while maintaining sufficient visual separation between interface layers.

---

## **12.6.6 Motion Tokens**

Motion tokens define the timing and easing characteristics of interface animations.

Animations shall communicate state changes rather than provide decorative effects.

Motion tokens define:

* Fast transitions  
* Standard transitions  
* Emphasised transitions  
* Loading animations  
* Hover interactions  
* Page transitions

All animations shall respect reduced-motion accessibility preferences where supported.

---

## **12.6.7 Layering Strategy**

The interface defines standard layering tokens to ensure consistent rendering order across interactive components.

Layer categories include:

* Navigation  
* Dropdown menus  
* Tooltips  
* Modal dialogs  
* Toast notifications  
* Side drawers  
* Emergency overlays

This standardised layering model prevents visual conflicts between independently developed modules.

---

# **12.7 Frontend Technology Stack**

The frontend implementation is based on a modern React ecosystem designed to support enterprise scalability, maintainability and high-performance user experiences.

The selected technologies have been chosen to maximise component reuse, simplify state management and support responsive web and mobile applications.

| Technology | Primary Responsibility |
| ----- | ----- |
| Next.js | Web application framework and routing |
| React | Component architecture |
| TypeScript | Type safety and maintainability |
| Tailwind CSS | Utility-first styling |
| Shadcn/UI | Reusable accessible components |
| ui.watermelon.sh | Enterprise interface blocks and layouts |
| Framer Motion | Motion and interaction animations |
| Lucide Icons | Iconography |
| Recharts | Dashboards and analytical visualisations |

The frontend architecture emphasises modularity, allowing functional modules to reuse common components rather than implementing independent user interface patterns.

---

# **12.8 Component Architecture**

The platform adopts a reusable component architecture to maximise consistency and minimise implementation effort.

Components shall be categorised according to their level of reuse and functional responsibility.

### **Foundation Components**

Foundation components provide the lowest level building blocks used throughout the application.

Examples include:

* Buttons  
* Inputs  
* Labels  
* Icons  
* Typography  
* Dividers  
* Badges

---

### **Composite Components**

Composite components combine multiple foundation components into reusable functional elements.

Examples include:

* Permit Cards  
* Worker Cards  
* KPI Cards  
* Approval Cards  
* Status Chips  
* Timelines  
* Progress Indicators  
* Alerts

---

### **Layout Components**

Layout components provide consistent page structures.

Examples include:

* Dashboard Layout  
* Workspace Layout  
* Form Layout  
* Sidebar  
* Header  
* Footer  
* Navigation Shell  
* Split View

---

### **Module Components**

Module components implement functionality specific to individual business modules.

Examples include:

* Permit Form  
* Approval Workflow  
* Isolation Checklist  
* Incident Timeline  
* Conflict Matrix  
* Dashboard Widgets

---

### **Page Templates**

Page templates combine layouts and module components into complete application screens.

Examples include:

* Login  
* Dashboard  
* Permit Workspace  
* Incident Workspace  
* Organisation Management  
* Analytics

All page templates shall reuse existing components wherever possible rather than introducing bespoke layouts.

---

# **12.9 Layout Strategy**

The interface utilises a modular layout system designed to accommodate complex enterprise workflows while remaining adaptable across desktop, tablet and mobile devices.

The primary layout patterns include:

| Layout | Purpose |
| ----- | ----- |
| Dashboard Layout | Operational summaries and KPIs |
| Workspace Layout | Permit processing and workflows |
| Form Layout | Data entry and configuration |
| Detail Layout | Viewing operational records |
| Split Layout | Simultaneous viewing and editing |
| Mobile Layout | Field operations |

Layouts shall remain consistent across functional modules to minimise user retraining and improve navigation efficiency.

---

# **12.10 Navigation Strategy**

Navigation shall prioritise rapid access to operational tasks while maintaining a clear information hierarchy.

The navigation system consists of:

* Primary sidebar navigation  
* Contextual navigation  
* Breadcrumb navigation  
* Tab navigation  
* Mobile bottom navigation  
* Quick actions  
* Global search  
* Notification centre

Navigation elements shall adapt according to user role while preserving a consistent interaction model across all modules.

---

# **12.11 Responsive Design Strategy**

The platform shall adopt a responsive design approach that delivers a consistent user experience across desktop, tablet and mobile devices while optimising workflows for each form factor.

Rather than scaling desktop interfaces to smaller screens, layouts shall adapt to the available screen space by reorganising content, navigation and interaction patterns to maintain usability and operational efficiency.

Responsive behaviour shall be implemented using a mobile-first approach where practical while ensuring desktop interfaces remain optimised for information-dense operational environments.

---

## **12.11.1 Desktop Experience**

The desktop interface is intended for supervisors, permit approvers, administrators and safety personnel performing extended operational tasks.

Desktop layouts shall prioritise:

* Information density.  
* Multi-panel workspaces.  
* Large operational dashboards.  
* Advanced filtering.  
* Simultaneous data comparison.  
* Efficient keyboard interaction.  
* Multi-column forms.

Desktop implementations shall maximise available screen space while maintaining readability and clear visual hierarchy.

---

## **12.11.2 Tablet Experience**

Tablet interfaces support supervisors and inspectors operating within industrial facilities.

Tablet layouts shall provide:

* Simplified navigation.  
* Responsive dashboards.  
* Touch-optimised controls.  
* Single-column forms where appropriate.  
* Reduced secondary navigation.  
* Optimised inspection workflows.

---

## **12.11.3 Mobile Experience**

Mobile interfaces are intended primarily for field personnel performing operational activities.

The mobile experience shall prioritise:

* Task completion.  
* Large touch targets.  
* Reduced typing.  
* Camera integration.  
* Offline capability.  
* Immediate access to assigned work.  
* Simplified workflows.

Complex administrative functions shall remain available through the web application while mobile interfaces focus on operational activities.

---

## **12.11.4 Responsive Behaviour**

Responsive layouts shall adapt dynamically based on available viewport dimensions.

Examples include:

* Sidebar collapse.  
* Card stacking.  
* Responsive tables.  
* Adaptive navigation.  
* Flexible dashboard widgets.  
* Dynamic spacing.  
* Simplified page headers.

Responsive behaviour shall remain consistent throughout all functional modules.

---

# **12.12 Accessibility Strategy**

Accessibility is considered a core implementation requirement rather than an optional enhancement. The user interface shall be developed to support users with diverse accessibility requirements while maintaining operational efficiency in industrial environments.

The platform shall align with recognised accessibility standards and implement inclusive interaction patterns wherever practical.

---

## **12.12.1 Accessibility Objectives**

The accessibility implementation aims to:

* Improve usability for all users.  
* Support keyboard-only operation.  
* Improve screen reader compatibility.  
* Maintain sufficient colour contrast.  
* Reduce cognitive complexity.  
* Support reduced motion preferences.  
* Ensure accessible form interactions.

---

## **12.12.2 Keyboard Accessibility**

All interactive functionality shall remain fully accessible using keyboard navigation.

Keyboard interaction shall support:

* Sequential focus order.  
* Visible focus indicators.  
* Shortcut navigation.  
* Dialog navigation.  
* Table navigation.  
* Form completion.  
* Action confirmation.

No functionality shall depend exclusively on mouse interaction.

---

## **12.12.3 Screen Reader Support**

Interactive components shall provide meaningful semantic information through accessible HTML and ARIA attributes where required.

Examples include:

* Navigation landmarks.  
* Form labels.  
* Error messages.  
* Dialog announcements.  
* Status updates.  
* Loading indicators.  
* Notification announcements.

---

## **12.12.4 Colour Accessibility**

Colour shall never be the sole indicator of operational state.

Critical safety information shall combine:

* Colour.  
* Icons.  
* Labels.  
* Status text.  
* Visual indicators.

This approach improves usability for users with colour vision deficiencies while maintaining clear operational communication.

---

## **12.12.5 Reduced Motion**

Users preferring reduced motion shall receive simplified animations without affecting application functionality.

Where reduced motion is enabled:

* Decorative animations shall be removed.  
* Transition duration shall be minimised.  
* Essential feedback animations shall remain.  
* Navigation behaviour shall remain predictable.

---

# **12.13 Interaction & Animation Strategy**

The platform utilises motion to reinforce user actions, communicate application state and improve perceived responsiveness. Animations shall remain purposeful, subtle and consistent with enterprise software expectations.

Animation shall never delay task completion or distract users from safety-critical operations.

---

## **12.13.1 Animation Principles**

Motion shall:

* Provide visual continuity.  
* Confirm completed actions.  
* Improve orientation.  
* Communicate loading states.  
* Highlight important changes.

Motion shall not:

* Delay user interaction.  
* Obscure information.  
* Introduce unnecessary visual effects.  
* Reduce readability.

---

## **12.13.2 Framer Motion Implementation**

Framer Motion shall be used for:

* Page transitions.  
* Drawer animations.  
* Modal transitions.  
* Expandable sections.  
* Toast notifications.  
* Dashboard widget transitions.  
* Skeleton loading states.  
* Micro-interactions.

Animation durations shall remain consistent throughout the platform using predefined motion tokens.

---

## **12.13.3 Loading States**

Every asynchronous operation shall provide appropriate visual feedback.

Loading indicators include:

* Skeleton screens.  
* Inline progress indicators.  
* Button loading states.  
* Table placeholders.  
* Dashboard loading cards.  
* Upload progress indicators.

Loading behaviour shall accurately represent application state without misleading the user.

---

## **12.13.4 Feedback Patterns**

User actions shall receive immediate visual feedback.

Examples include:

* Successful save confirmation.  
* Validation feedback.  
* Warning messages.  
* Error notifications.  
* Approval confirmations.  
* Workflow completion indicators.

Feedback shall remain consistent throughout every module.

---

# **12.14 State Management Strategy**

The frontend architecture separates server state from local interface state to improve maintainability, scalability and performance.

State management shall minimise unnecessary re-rendering while ensuring data consistency across the application.

---

## **12.14.1 Server State**

Server state includes information retrieved from backend services.

Examples include:

* Permits.  
* Organisations.  
* Workforce.  
* Incidents.  
* Notifications.  
* Reports.  
* Dashboard metrics.

Server state shall support:

* Background refresh.  
* Cache invalidation.  
* Optimistic updates.  
* Error recovery.

---

## **12.14.2 Client State**

Client state includes temporary interface information.

Examples include:

* Selected tabs.  
* Open dialogs.  
* Wizard progress.  
* Expanded sections.  
* Search filters.  
* Current theme.  
* Sidebar state.

Client state shall remain isolated from backend business logic.

---

## **12.14.3 Form State**

Complex operational forms shall maintain independent form state supporting:

* Validation.  
* Draft saving.  
* Partial completion.  
* Error highlighting.  
* Dynamic sections.  
* Conditional fields.

Form implementation shall minimise data loss during long operational workflows.

---

# **12.15 Data Visualisation Strategy**

Operational dashboards utilise visual analytics to improve situational awareness and support management decision-making.

Visualisations shall prioritise clarity, consistency and operational relevance rather than decorative presentation.

---

## **12.15.1 Dashboard Components**

Dashboards shall utilise reusable visualisation components including:

* KPI Cards.  
* Line Charts.  
* Bar Charts.  
* Area Charts.  
* Pie Charts.  
* Trend Indicators.  
* Status Distribution Charts.  
* Timeline Views.  
* Heatmaps (future enhancement).

Visualisations shall be implemented using Recharts to maintain consistency across analytical modules.

---

## **12.15.2 Dashboard Design Principles**

Analytical dashboards shall:

* Display the most important KPIs first.  
* Support filtering.  
* Support drill-down interactions.  
* Update automatically.  
* Present historical trends.  
* Remain responsive across devices.

All dashboard widgets shall reuse standardised chart components and interaction patterns.

---

# **12.16 Design Prototype Alignment**

The approved user interface prototype serves as the authoritative reference for frontend implementation. Development activities shall align with the established layouts, navigation patterns, interaction behaviours and visual language defined within the approved prototype.

Reusable components shall be implemented in a manner that preserves the consistency of the approved design while supporting future extensibility.

Any deviation from the approved design system, interaction model or component behaviour shall undergo formal design review prior to implementation. This ensures that incremental feature development does not introduce inconsistent user experiences or compromise the overall usability of the platform.

---

# **12.17 UI Quality Assurance**

Frontend implementation shall undergo dedicated user interface validation in addition to functional testing.

UI validation shall include:

* Visual regression testing.  
* Responsive testing.  
* Cross-browser testing.  
* Accessibility validation.  
* Component testing.  
* Interaction testing.  
* Theme validation.  
* Dark mode validation.  
* Mobile usability testing.  
* Design system compliance review.

---

# **12.18 User Interface Acceptance Criteria**

The User Interface implementation shall be considered complete when:

* All approved interface themes have been implemented successfully.  
* The design system is consistently applied across all functional modules.  
* Responsive layouts operate correctly on supported devices.  
* Navigation remains consistent throughout the platform.  
* Accessibility requirements have been satisfied.  
* Theme switching functions correctly.  
* Reusable components conform to established implementation standards.  
* Dashboard visualisations display correctly and accurately.  
* Mobile interfaces support field operations effectively.  
* Visual regression testing confirms consistency with the approved prototype.  
* User interface performance meets defined response and rendering requirements.  
* Business stakeholders formally approve the implemented user interface prior to production deployment.

---

# **13\. Security Implementation Strategy**

## **13.1 Purpose**

The Security Implementation Strategy defines the technical controls, architectural principles and implementation standards required to protect the Enterprise Permit-to-Work Platform from unauthorised access, data compromise and operational misuse.

Rather than functioning as a standalone security module, security is implemented as a cross-cutting concern that is integrated into every application layer, including the frontend, backend, mobile application, APIs, database, infrastructure and operational processes.

The strategy adopts a defence-in-depth approach in which multiple complementary security controls operate together to reduce risk while maintaining usability and operational efficiency.

---

## **13.2 Security Objectives**

The objectives of the security implementation are to:

* Protect organisational data from unauthorised access.  
* Enforce strict role-based permissions.  
* Isolate tenant data within the multi-tenant architecture.  
* Secure communications between platform components.  
* Maintain complete auditability of security-sensitive operations.  
* Protect uploaded documents and operational evidence.  
* Prevent common web application vulnerabilities.  
* Ensure compliance with recognised security best practices.  
* Support secure future platform expansion.

---

## **13.3 Security Architecture**

Security shall be implemented using multiple independent security layers to minimise the impact of individual vulnerabilities.

The platform security architecture consists of:

* Identity Management  
* Authentication  
* Authorisation  
* API Security  
* Application Security  
* Database Security  
* File Storage Security  
* Infrastructure Security  
* Audit Logging  
* Monitoring & Incident Detection

Each security layer shall operate independently while contributing to the overall protection of the platform.

---

## **13.4 Identity & Authentication**

User authentication shall be centrally managed using Keycloak, providing enterprise-grade identity management across the web application, mobile application and backend services.

Authentication shall utilise industry-standard OpenID Connect (OIDC) and OAuth 2.0 protocols to establish secure user sessions and issue signed access tokens.

Authentication capabilities include:

* Username and password authentication.  
* Single Sign-On (SSO) support.  
* Session management.  
* Token-based authentication.  
* Secure logout.  
* Password policy enforcement.  
* Account lockout protection.  
* Session expiration management.

The platform shall never implement custom authentication logic where equivalent functionality is provided by Keycloak.

---

## **13.5 Session Management**

Authenticated sessions shall be managed using short-lived access tokens and renewable refresh tokens.

Session management shall support:

* Access token expiration.  
* Refresh token rotation.  
* Secure logout.  
* Session invalidation.  
* Concurrent session management.  
* Automatic session timeout.

Inactive sessions shall expire automatically after the configured inactivity period.

---

## **13.6 Role-Based Access Control (RBAC)**

Authorisation shall be implemented using a Role-Based Access Control model.

Every authenticated user shall be assigned one or more organisational roles that determine the operations they are permitted to perform.

Role evaluation shall occur for every protected request.

Typical platform roles include:

* Platform Administrator  
* Organisation Administrator  
* Safety Manager  
* Safety Officer  
* Head of Department  
* Permit Approver  
* Supervisor  
* Job Issuer  
* Job Executor  
* Auditor  
* Viewer

Permissions shall be evaluated using the principle of least privilege, granting users only the access required to perform their responsibilities.

---

## **13.7 Permission Model**

Permissions shall be evaluated at multiple levels.

| Permission Level | Description |
| ----- | ----- |
| Module Level | Access to application modules |
| Resource Level | Access to specific business objects |
| Operation Level | Create, Read, Update, Delete and Approve operations |
| Organisation Level | Tenant-specific data access |
| Administrative Level | Platform configuration and administration |

Permission evaluation shall occur on both the frontend and backend to prevent unauthorised access through direct API requests.

---

## **13.8 Multi-Tenant Security**

The platform implements logical tenant isolation to ensure complete separation of organisational data.

Tenant isolation shall apply to:

* Organisations.  
* Users.  
* Permits.  
* Workforce records.  
* Incidents.  
* Documents.  
* Notifications.  
* Reports.  
* Audit logs.

All backend queries shall automatically scope results to the authenticated user's organisation.

Cross-tenant data access shall be prohibited unless explicitly supported through controlled administrative functionality.

---

## **13.9 API Security**

All backend APIs shall implement multiple security controls.

API security measures include:

* HTTPS enforcement.  
* JWT validation.  
* Keycloak authentication.  
* RBAC validation.  
* DTO validation.  
* Request sanitisation.  
* Rate limiting.  
* Request size validation.  
* Content-type validation.  
* Secure error handling.

Every protected endpoint shall validate authentication before processing business logic.

---

## **13.10 Input Validation**

All user input shall undergo server-side validation before processing.

Validation shall include:

* Required field validation.  
* Type validation.  
* Length validation.  
* Format validation.  
* Enumeration validation.  
* Date validation.  
* File validation.  
* Business rule validation.

Client-side validation shall improve user experience but shall never replace backend validation.

---

## **13.11 File Security**

Operational evidence, permit attachments and uploaded documentation shall be securely stored within MinIO object storage.

File security controls include:

* MIME type validation.  
* File extension validation.  
* File size limits.  
* Tenant-specific storage segregation.  
* Immutable storage references.  
* Secure object naming.  
* Controlled download permissions.

Uploaded files shall never be directly accessible without successful authorisation.

---

## **13.12 Database Security**

Sensitive operational data shall be protected using multiple database security controls.

These include:

* Principle of least privilege.  
* Secure database credentials.  
* Connection encryption.  
* Prepared statements.  
* Parameterised queries.  
* Foreign key enforcement.  
* Audit fields.  
* Soft deletion.  
* Transaction management.

Direct database access shall be restricted to authorised infrastructure personnel.

---

## **13.13 Audit Logging**

Security-sensitive activities shall generate immutable audit records.

Examples include:

* User login.  
* Failed authentication.  
* Role changes.  
* Permission changes.  
* Permit approval.  
* Permit closure.  
* Incident closure.  
* Administrative configuration changes.  
* Document uploads.  
* User management.

Audit records shall include:

* User.  
* Timestamp.  
* Organisation.  
* IP address (where applicable).  
* Operation performed.  
* Previous value.  
* New value.

Audit records shall remain immutable following creation.

---

## **13.14 Secure Communication**

All communication between platform components shall occur over encrypted channels.

Secure communication applies to:

* Browser ↔ Backend.  
* Mobile ↔ Backend.  
* Backend ↔ PostgreSQL.  
* Backend ↔ Redis.  
* Backend ↔ MinIO.  
* Backend ↔ Keycloak.  
* Backend ↔ Metabase.

Unencrypted communication shall not be permitted within production environments.

---

## **13.15 Security Monitoring**

Security events shall be continuously monitored to support operational awareness and incident response.

Examples include:

* Authentication failures.  
* Permission violations.  
* Suspicious request patterns.  
* Excessive failed logins.  
* Token validation failures.  
* API abuse.  
* Administrative actions.

Security logs shall be collected through Grafana Loki for centralised monitoring and analysis.

---

## **13.16 Security Testing**

Security verification shall be performed throughout implementation.

Testing activities include:

* Authentication testing.  
* Authorisation testing.  
* Tenant isolation testing.  
* Session management testing.  
* API security testing.  
* File upload validation.  
* Input validation testing.  
* Penetration testing.  
* Vulnerability scanning.  
* OWASP Top 10 verification.

Security testing shall be incorporated into both sprint-level verification and production readiness activities.

---

## **13.17 Security Acceptance Criteria**

The security implementation shall be considered complete when:

* Authentication is successfully managed through Keycloak.  
* Role-based permissions are enforced consistently across the platform.  
* Tenant isolation prevents unauthorised cross-organisational data access.  
* All protected APIs require valid authentication and authorisation.  
* Uploaded files are securely stored and access-controlled.  
* Audit logs are generated for all security-sensitive operations.  
* Security monitoring is operational.  
* Security testing confirms protection against common application vulnerabilities.  
* No Critical or High severity security defects remain unresolved prior to production deployment.  
* The platform satisfies the organisation's approved security and compliance requirements.

---

---

# **14\. Performance & Scalability Strategy**

## **14.1 Purpose**

The Performance & Scalability Strategy defines the implementation approach for ensuring that the Enterprise Permit-to-Work Platform maintains consistent responsiveness, reliability and scalability under varying operational workloads.

Performance is treated as a fundamental architectural requirement rather than an optimisation performed after feature implementation. Every application layer—including the frontend, backend, database, background processing infrastructure and mobile application—shall incorporate performance optimisation techniques throughout the development lifecycle.

The strategy also establishes the foundation for horizontal scalability, enabling the platform to support increasing numbers of organisations, users and operational activities without significant architectural modification.

---

## **14.2 Performance Objectives**

The objectives of the performance implementation are to:

* Deliver responsive user interfaces.  
* Minimise application response times.  
* Optimise database performance.  
* Reduce unnecessary network traffic.  
* Improve dashboard rendering performance.  
* Support concurrent enterprise users.  
* Enable efficient background processing.  
* Improve mobile responsiveness.  
* Support future horizontal scaling.  
* Maintain consistent application performance during peak operational periods.

---

## **14.3 Performance Architecture**

Performance optimisation shall be implemented across multiple architectural layers.

The performance architecture consists of:

* Frontend optimisation.  
* Backend optimisation.  
* Database optimisation.  
* Caching.  
* Background processing.  
* Storage optimisation.  
* Mobile optimisation.  
* Monitoring.  
* Performance testing.

Each layer contributes independently to overall platform responsiveness.

---

# **14.4 Frontend Performance Strategy**

The frontend shall be optimised to minimise rendering time, reduce network requests and improve perceived application responsiveness.

Optimisation techniques include:

* Server-side rendering where appropriate.  
* Dynamic imports.  
* Route-based code splitting.  
* Component lazy loading.  
* Bundle optimisation.  
* Image optimisation.  
* Memoisation.  
* Virtualised rendering for large datasets.  
* Efficient state management.

Frontend performance shall prioritise rapid interaction over unnecessary visual complexity.

---

## **14.4.1 Next.js Optimisation**

The web application shall utilise Next.js features to improve application performance.

Implementation includes:

* App Router.  
* Route-level code splitting.  
* Dynamic imports.  
* Static asset optimisation.  
* Server Components where appropriate.  
* Incremental rendering strategies.  
* Asset preloading.  
* Font optimisation.

Only components requiring client-side interactivity shall be implemented as Client Components.

---

## **14.4.2 Component Optimisation**

Reusable interface components shall minimise unnecessary rendering.

Optimisation techniques include:

* Memoised components.  
* Stable properties.  
* Lazy rendering.  
* Conditional rendering.  
* Virtual scrolling.  
* Pagination.  
* Skeleton loading.

Large dashboard pages shall avoid rendering inactive interface sections until required.

---

## **14.4.3 Asset Optimisation**

Application assets shall be optimised before deployment.

This includes:

* Image optimisation.  
* SVG icon usage.  
* Font optimisation.  
* CSS optimisation.  
* JavaScript minification.  
* Compression.  
* Browser caching.

Large assets shall not delay application startup.

---

# **14.5 Backend Performance Strategy**

Backend services shall prioritise efficient request processing and predictable response times.

Performance improvements include:

* Lightweight controllers.  
* Efficient service composition.  
* Asynchronous processing.  
* Validation optimisation.  
* Dependency injection.  
* Connection reuse.  
* Query optimisation.  
* Response compression.

Business logic shall remain isolated from infrastructure concerns to simplify future optimisation.

---

## **14.5.1 Request Processing**

API request processing shall minimise latency.

Implementation includes:

* Validation before business logic.  
* Early request rejection.  
* Efficient DTO mapping.  
* Service reuse.  
* Exception filtering.  
* Response serialisation.

Controllers shall remain lightweight, delegating business logic to application services.

---

## **14.5.2 Background Processing**

Long-running operations shall execute asynchronously using BullMQ.

Examples include:

* Notification delivery.  
* Dashboard aggregation.  
* Analytics generation.  
* Report generation.  
* Audit processing.  
* Scheduled reminders.  
* Daily revalidation jobs.

Users shall receive immediate responses while background jobs continue independently.

---

# **14.6 Database Performance Strategy**

PostgreSQL shall be configured to support enterprise-scale transactional workloads.

Database optimisation includes:

* Normalised schemas.  
* Appropriate indexing.  
* Efficient joins.  
* Query optimisation.  
* Connection pooling.  
* Transaction optimisation.  
* Pagination.  
* Historical indexing.

Database design shall balance transactional integrity with operational performance.

---

## **14.6.1 Indexing Strategy**

Indexes shall be created for frequently accessed data.

Typical indexed fields include:

* Permit number.  
* Organisation identifier.  
* User identifier.  
* Permit status.  
* Incident status.  
* Approval status.  
* Equipment identifier.  
* Created date.  
* Updated date.

Composite indexes shall be used where query patterns justify additional optimisation.

---

## **14.6.2 Query Optimisation**

Database queries shall minimise unnecessary processing.

Implementation includes:

* Selecting required columns only.  
* Avoiding unnecessary joins.  
* Efficient filtering.  
* Pagination.  
* Batch operations.  
* Prepared statements.

Long-running analytical queries shall be isolated from operational transactions where appropriate.

---

# **14.7 Caching Strategy**

Redis shall provide distributed caching to reduce database load and improve response times.

Caching shall only be applied to data where temporary staleness does not compromise operational correctness.

Typical cached data includes:

* Organisation configuration.  
* User permissions.  
* Dashboard summaries.  
* Lookup tables.  
* Reference data.  
* Notification counts.  
* Frequently accessed metadata.

Cache invalidation shall occur automatically following relevant data modifications.

---

## **14.7.1 Cache Management**

Caching implementation shall define:

* Cache keys.  
* Expiration policies.  
* Automatic invalidation.  
* Cache warming.  
* Cache monitoring.

Cache entries shall not replace authoritative database records.

---

# **14.8 Background Job Strategy**

BullMQ shall manage asynchronous workloads independently of user interactions.

Job categories include:

* Notification delivery.  
* Reminder generation.  
* Daily revalidation scheduling.  
* Report exports.  
* Dashboard aggregation.  
* Analytics refresh.  
* Cleanup operations.

Retry policies shall be configured for transient failures.

Failed jobs shall be routed to dead-letter queues for administrative review.

---

# **14.9 Object Storage Performance**

MinIO shall manage uploaded operational documents efficiently.

Optimisation techniques include:

* Object streaming.  
* Multipart uploads.  
* Secure object retrieval.  
* Metadata indexing.  
* Efficient download handling.

Large file uploads shall not block normal application operation.

---

# **14.10 Mobile Performance Strategy**

Mobile applications shall remain responsive under varying network conditions.

Performance techniques include:

* SQLite local storage.  
* Offline-first operation.  
* Incremental synchronisation.  
* Batch uploads.  
* Image compression.  
* Cached reference data.  
* Deferred synchronisation.

Field personnel shall be able to continue critical operational activities during temporary network interruptions.

---

# **14.11 Dashboard Performance**

Operational dashboards aggregate information from multiple business modules.

Dashboard optimisation shall include:

* Cached KPI calculations.  
* Incremental refresh.  
* Lazy widget loading.  
* Efficient chart rendering.  
* Background aggregation.  
* Cached analytical datasets.

Dashboard rendering shall prioritise critical operational information before secondary analytics.

---

# **14.12 Scalability Strategy**

The platform architecture supports horizontal scalability through stateless application services and independently scalable infrastructure components.

Scalable platform components include:

* Web application instances.  
* Backend API instances.  
* Background worker instances.  
* Redis.  
* PostgreSQL read replicas (future enhancement).  
* Object storage.  
* Monitoring services.

Infrastructure scaling shall not require changes to application business logic.

---

# **14.13 Performance Monitoring**

Application performance shall be continuously monitored throughout development and production.

Monitoring includes:

* API response times.  
* Database query duration.  
* Cache utilisation.  
* Queue processing time.  
* Background job success rate.  
* Dashboard rendering time.  
* Mobile synchronisation duration.  
* Error rates.  
* Infrastructure resource utilisation.

Grafana Loki and associated monitoring tools shall provide operational visibility into application performance.

---

# **14.14 Performance Testing**

Performance validation shall be conducted throughout implementation.

Testing activities include:

* Load testing.  
* Stress testing.  
* Spike testing.  
* Endurance testing.  
* Database benchmarking.  
* API benchmarking.  
* Dashboard performance testing.  
* Mobile synchronisation testing.

Performance testing shall be repeated following significant architectural changes.

---

# **14.15 Performance Acceptance Criteria**

The performance implementation shall be considered complete when:

* Frontend interfaces respond consistently under expected operational workloads.  
* Backend APIs maintain acceptable response times during concurrent usage.  
* Database queries execute efficiently using the defined indexing strategy.  
* Redis caching reduces repeated database access for frequently requested data.  
* Background processing completes asynchronously without degrading user interactions.  
* Dashboard rendering remains responsive during high operational activity.  
* Mobile applications maintain acceptable performance in both online and offline scenarios.  
* Performance monitoring is operational across all application layers.  
* Performance testing confirms that the platform satisfies defined scalability and responsiveness objectives.  
* No Critical or High severity performance defects remain unresolved prior to production deployment.

---

---

# **15\. Testing Strategy**

## **15.1 Purpose**

The Testing Strategy defines the quality assurance approach for validating the Enterprise Permit-to-Work Platform throughout the software development lifecycle. It establishes the testing activities, environments, responsibilities and acceptance processes required to ensure that all functional and non-functional requirements are implemented correctly before production deployment.

Testing shall be integrated into every implementation milestone rather than performed as a standalone activity at the conclusion of development. Each sprint shall include planning, execution and verification of testing activities appropriate to the implemented functionality.

The strategy adopts a shift-left testing approach, promoting early defect identification and continuous validation to reduce implementation risk and improve software quality.

---

## **15.2 Testing Objectives**

The objectives of the testing strategy are to:

* Verify implementation of all functional requirements.  
* Validate business workflows across all platform modules.  
* Ensure platform stability following incremental development.  
* Detect defects as early as possible.  
* Verify integration between application modules.  
* Validate security controls.  
* Confirm acceptable application performance.  
* Ensure accessibility compliance.  
* Verify compatibility across supported devices and browsers.  
* Support successful production deployment.

---

## **15.3 Testing Principles**

The platform testing strategy is based upon the following principles:

* Testing shall begin during implementation rather than after development.  
* Every functional requirement shall be traceable to one or more test cases.  
* Automated testing shall be preferred where practical.  
* Manual testing shall focus on usability and exploratory validation.  
* Regression testing shall accompany every release.  
* Production deployments shall only occur after successful completion of defined exit criteria.

---

# **15.4 Testing Lifecycle**

Testing activities shall occur throughout the software development lifecycle.

The testing lifecycle consists of:

1. Unit Testing  
2. Component Testing  
3. API Testing  
4. Integration Testing  
5. System Testing  
6. Regression Testing  
7. User Acceptance Testing  
8. Production Validation

Each testing stage provides increasing confidence that implemented functionality satisfies business and technical requirements.

---

# **15.5 Testing Levels**

## **15.5.1 Unit Testing**

Unit testing validates individual classes, services and reusable functions in isolation.

Unit testing shall verify:

* Business logic.  
* Validation logic.  
* Utility functions.  
* Service methods.  
* Helper classes.  
* Data transformations.

Developers shall create and maintain unit tests for all newly implemented functionality.

---

## **15.5.2 Component Testing**

Component testing validates reusable frontend interface components independently from complete application workflows.

Examples include:

* Buttons.  
* Forms.  
* Tables.  
* Cards.  
* Timelines.  
* Charts.  
* Dialogs.  
* Navigation components.

Each reusable component shall behave consistently regardless of the consuming application module.

---

## **15.5.3 API Testing**

API testing validates backend endpoints independently of the frontend application.

Testing shall verify:

* Authentication.  
* Authorisation.  
* Validation.  
* Business rules.  
* Response structures.  
* Error handling.  
* Status codes.

Every public API endpoint shall include positive and negative test scenarios.

---

## **15.5.4 Integration Testing**

Integration testing validates communication between application modules.

Integration scenarios include:

* Permit-to-Work ↔ Workforce  
* Permit ↔ LOTOTO  
* Permit ↔ SIMOPS  
* Permit ↔ Incident Management  
* Notifications ↔ Platform modules  
* Dashboards ↔ Operational data  
* Backend ↔ Database  
* Backend ↔ Redis  
* Backend ↔ MinIO  
* Backend ↔ Keycloak

Integration testing ensures modules interact correctly after independent implementation.

---

## **15.5.5 System Testing**

System testing validates complete end-to-end operational workflows.

Examples include:

* Complete Permit lifecycle.  
* Complete LOTOTO lifecycle.  
* SIMOPS conflict resolution.  
* Multi-day permit continuation.  
* Incident investigation.  
* Dashboard reporting.

System testing shall verify that integrated platform behaviour satisfies business requirements.

---

## **15.5.6 Regression Testing**

Regression testing ensures previously implemented functionality continues to operate following new feature development.

Regression testing shall occur:

* After every sprint.  
* Before milestone acceptance.  
* Before production deployment.  
* After major defect resolution.

Regression suites shall expand progressively throughout the implementation lifecycle.

---

## **15.5.7 User Acceptance Testing**

User Acceptance Testing (UAT) validates the platform from a business perspective.

Business representatives shall verify:

* Operational workflows.  
* Business rules.  
* User experience.  
* Reporting.  
* Notifications.  
* Dashboard behaviour.

Successful completion of UAT is required before production deployment.

---

# **15.6 Test Environments**

Testing activities shall utilise dedicated environments appropriate to each implementation stage.

| Environment | Purpose |
| ----- | ----- |
| Development | Developer verification |
| Integration | Cross-module testing |
| QA | Functional verification |
| UAT | Business validation |
| Production | Live operational environment |

Each environment shall maintain independent configuration, data and infrastructure.

---

# **15.7 Test Data Management**

Testing requires controlled datasets representing realistic operational scenarios.

Test data shall include:

* Organisations.  
* Users.  
* Workforce records.  
* Permits.  
* Equipment.  
* Incidents.  
* Isolation points.  
* Notifications.  
* Reports.

Sensitive production data shall not be used directly within non-production environments unless appropriately anonymised.

---

# **15.8 Test Case Management**

Every functional requirement shall maintain traceability throughout implementation.

Test artefacts shall include:

* Test plans.  
* Test cases.  
* Test scripts.  
* Expected results.  
* Execution evidence.  
* Defect references.

Sprint-specific test cases defined within this implementation plan shall form the basis of detailed QA execution.

---

# **15.9 Defect Management**

All identified defects shall be recorded, prioritised and tracked until resolution.

Defect lifecycle stages include:

1. New  
2. Assigned  
3. In Progress  
4. Ready for Testing  
5. Verified  
6. Closed  
7. Reopened (if required)

Defects shall be classified according to severity and business impact.

---

## **15.9.1 Defect Severity**

| Severity | Description |
| ----- | ----- |
| Critical | Prevents core platform operation |
| High | Major functionality unavailable or incorrect |
| Medium | Functionality partially affected |
| Low | Minor defect with limited operational impact |

Critical and High severity defects shall be resolved before production deployment.

---

# **15.10 Entry & Exit Criteria**

## **15.10.1 Entry Criteria**

Testing may commence when:

* Development is complete.  
* Code review is approved.  
* Build succeeds.  
* Required test data is available.  
* Environment is operational.

---

## **15.10.2 Exit Criteria**

Testing shall be considered complete when:

* Planned test cases have been executed.  
* Critical defects are resolved.  
* High severity defects are resolved.  
* Acceptance criteria are satisfied.  
* Test evidence has been documented.  
* Stakeholder approval has been obtained where required.

---

# **15.11 Test Automation Strategy**

Automated testing shall be incorporated throughout the implementation lifecycle to improve consistency and reduce repetitive manual verification.

Automation shall focus on stable, repeatable functionality.

Automation shall include:

* Backend unit tests.  
* Frontend component tests.  
* API tests.  
* Integration tests.  
* End-to-end workflow tests.  
* Regression suites.

Manual testing shall complement automation for usability, exploratory testing and business validation.

---

# **15.12 Performance Testing**

Performance testing validates platform responsiveness under expected operational workloads.

Performance testing activities include:

* Load testing.  
* Stress testing.  
* Spike testing.  
* Endurance testing.  
* Database benchmarking.  
* Dashboard rendering.  
* Mobile synchronisation.

Performance testing shall verify compliance with the Performance & Scalability Strategy.

---

# **15.13 Security Testing**

Security testing validates implementation of the Security Strategy.

Activities include:

* Authentication testing.  
* Authorisation testing.  
* Tenant isolation verification.  
* API security testing.  
* Session management validation.  
* File upload validation.  
* Penetration testing.  
* Vulnerability scanning.  
* OWASP Top 10 verification.

---

# **15.14 Accessibility Testing**

Accessibility validation shall ensure compliance with established accessibility standards.

Testing shall verify:

* Keyboard navigation.  
* Screen reader compatibility.  
* Focus indicators.  
* Colour contrast.  
* Form accessibility.  
* Error messaging.  
* Reduced motion support.

---

# **15.15 Compatibility Testing**

Compatibility testing validates consistent behaviour across supported environments.

Testing shall include:

### **Browsers**

* Google Chrome  
* Microsoft Edge  
* Mozilla Firefox  
* Apple Safari

### **Devices**

* Desktop  
* Tablet  
* Mobile

### **Operating Systems**

* Windows  
* macOS  
* Android  
* iOS

---

# **15.16 Mobile Application Testing**

Mobile-specific testing shall verify:

* Offline functionality.  
* Data synchronisation.  
* Camera integration.  
* Attachment uploads.  
* Notification delivery.  
* Device orientation.  
* Background synchronisation.  
* Local SQLite storage.

Testing shall be performed across representative Android and iOS devices.

---

# **15.17 Test Reporting**

Test execution shall produce structured reporting including:

* Executed test cases.  
* Passed test cases.  
* Failed test cases.  
* Defect summaries.  
* Severity distribution.  
* Regression status.  
* Sprint quality metrics.  
* Milestone quality summaries.

Test reports shall support milestone acceptance and production readiness decisions.

---

# **15.18 Quality Metrics**

The implementation shall monitor quality using measurable indicators including:

* Requirement coverage.  
* Test coverage.  
* Defect density.  
* Defect leakage.  
* Regression success rate.  
* Automation coverage.  
* Mean defect resolution time.  
* Sprint acceptance rate.  
* Milestone acceptance rate.

Quality metrics shall be reviewed throughout implementation to support continuous improvement.

---

# **15.19 Testing Responsibilities**

| Team | Responsibility |
| ----- | ----- |
| Developers | Unit testing, component testing and defect resolution |
| QA Engineers | Functional, integration, regression and system testing |
| Product Owner | Acceptance verification and requirement clarification |
| Business Stakeholders | User Acceptance Testing |
| DevOps Engineers | Test environments and deployment support |
| Project Manager | Testing coordination and milestone quality monitoring |

---

# **15.20 Testing Acceptance Criteria**

The testing strategy shall be considered successfully implemented when:

* Every functional requirement is traceable to one or more executed test cases.  
* Unit, component, API, integration and system testing have been completed successfully.  
* Regression testing confirms that previously implemented functionality remains operational.  
* User Acceptance Testing has been successfully completed.  
* Security, performance and accessibility testing satisfy defined quality objectives.  
* All planned testing environments operate correctly.  
* Critical and High severity defects have been resolved prior to production deployment.  
* Test reporting provides complete traceability between requirements, implementation and verification.  
* Business stakeholders approve the platform for production readiness.  
* The platform satisfies the defined quality objectives for enterprise deployment.

---

---

# **16\. DevOps & Deployment Strategy**

## **16.1 Purpose**

The DevOps & Deployment Strategy defines the approach for building, testing, deploying and operating the Enterprise Permit-to-Work Platform across all environments. It establishes the processes, infrastructure and automation required to ensure reliable software delivery while maintaining security, consistency and operational stability.

The strategy adopts Continuous Integration (CI) and Continuous Delivery (CD) practices to enable repeatable deployments, minimise manual intervention and reduce deployment risk throughout the implementation lifecycle.

Deployment activities shall be automated wherever practical to improve consistency and reduce operational errors.

---

## **16.2 DevOps Objectives**

The objectives of the DevOps strategy are to:

* Automate application builds.  
* Standardise deployment processes.  
* Maintain consistent environments.  
* Reduce deployment risk.  
* Improve release frequency.  
* Enable rapid rollback.  
* Support infrastructure scalability.  
* Improve operational visibility.  
* Ensure deployment repeatability.  
* Minimise production downtime.

---

## **16.3 DevOps Architecture**

The DevOps implementation consists of the following major components:

* Source Control  
* Continuous Integration  
* Continuous Delivery  
* Infrastructure Management  
* Containerisation  
* Database Migration  
* Monitoring  
* Logging  
* Backup & Recovery  
* Release Management

Each component contributes to a repeatable and reliable software delivery pipeline.

---

# **16.4 Environment Strategy**

The platform shall utilise multiple environments to support progressive software validation before production deployment.

Each environment shall remain logically isolated with independent configuration, infrastructure and data.

| Environment | Purpose |
| ----- | ----- |
| Local Development | Developer implementation and debugging |
| Development | Team integration and feature validation |
| Quality Assurance (QA) | Functional verification |
| User Acceptance Testing (UAT) | Business validation |
| Production | Live operational environment |

Configuration values shall differ between environments while application code remains identical.

---

## **16.4.1 Local Development Environment**

Developers shall implement and verify functionality locally before committing code.

The local environment includes:

* Next.js application.  
* NestJS API.  
* PostgreSQL.  
* Redis.  
* MinIO.  
* Keycloak.  
* BullMQ workers.  
* SQLite (mobile).  
* Local environment variables.

Local development shall support rapid iteration without affecting shared environments.

---

## **16.4.2 Shared Environments**

Development, QA and UAT environments shall mirror production architecture wherever practical.

Each shared environment shall provide:

* Independent databases.  
* Independent object storage.  
* Independent authentication.  
* Independent logging.  
* Independent monitoring.  
* Environment-specific configuration.

This reduces the likelihood of environment-specific defects reaching production.

---

# **16.5 Source Control Strategy**

All source code shall be managed using Git.

The repository shall maintain complete version history for:

* Frontend.  
* Backend.  
* Mobile application.  
* Infrastructure.  
* Database migrations.  
* Documentation.

Every change shall be traceable to a corresponding implementation task or defect.

---

## **16.5.1 Branching Strategy**

The project shall adopt a structured branching model.

| Branch | Purpose |
| ----- | ----- |
| main | Production-ready code |
| develop | Active development |
| feature/\* | New functionality |
| release/\* | Release preparation |
| hotfix/\* | Production defect resolution |

Feature branches shall remain short-lived and merged following successful review.

---

## **16.5.2 Code Review**

Every code contribution shall undergo peer review before integration.

Reviews shall verify:

* Coding standards.  
* Architecture compliance.  
* Business logic.  
* Security.  
* Performance considerations.  
* Test coverage.  
* Documentation updates.

No code shall be merged directly into protected branches without review approval.

---

# **16.6 Continuous Integration Strategy**

Continuous Integration shall automatically validate every code change.

The CI pipeline shall perform:

* Dependency installation.  
* Static analysis.  
* Code formatting verification.  
* Type checking.  
* Unit testing.  
* Build verification.  
* Security scanning.  
* Test report generation.

Pipeline failures shall prevent integration until issues are resolved.

---

# **16.7 Continuous Delivery Strategy**

Continuous Delivery automates deployment to controlled environments following successful CI validation.

Deployment stages include:

1. Build application.  
2. Execute automated tests.  
3. Build deployment artefacts.  
4. Execute database migrations.  
5. Deploy application.  
6. Execute smoke tests.  
7. Notify stakeholders.

Production deployments shall require formal approval before execution.

---

# **16.8 Application Build Strategy**

Application builds shall be reproducible across all environments.

Build activities include:

### **Frontend**

* Install dependencies.  
* Compile TypeScript.  
* Build Next.js application.  
* Optimise static assets.

---

### **Backend**

* Install dependencies.  
* Compile NestJS application.  
* Generate production build.  
* Validate configuration.

---

### **Mobile**

* Compile React Native application.  
* Generate Android build.  
* Generate iOS build.  
* Validate release configuration.

---

# **16.9 Database Migration Strategy**

Database schema changes shall be managed using Drizzle ORM migrations.

Migration activities include:

* Version-controlled migrations.  
* Forward-only schema evolution.  
* Rollback planning.  
* Migration validation.  
* Environment synchronisation.

Database modifications shall never be performed manually within production environments except through approved operational procedures.

---

## **16.9.1 Migration Workflow**

Schema modifications shall follow the sequence:

1. Create migration.  
2. Review migration.  
3. Execute in Development.  
4. Validate in QA.  
5. Execute in UAT.  
6. Execute in Production.

Migration history shall remain permanently version controlled.

---

# **16.10 Infrastructure Deployment**

Infrastructure components shall be deployed independently while operating as a unified platform.

Core infrastructure includes:

* PostgreSQL.  
* Redis.  
* BullMQ.  
* MinIO.  
* Keycloak.  
* Grafana Loki.  
* Metabase.

Infrastructure changes shall follow controlled deployment procedures equivalent to application deployments.

---

# **16.11 Configuration Management**

Application configuration shall remain external to application code.

Configuration includes:

* Database connections.  
* Authentication.  
* Storage.  
* Notification settings.  
* Logging.  
* Queue configuration.  
* Environment variables.

Configuration values shall be environment-specific and securely managed.

---

# **16.12 Monitoring & Observability**

Operational visibility shall be maintained through centralised monitoring.

Monitoring shall include:

* Application availability.  
* API response times.  
* Queue health.  
* Database health.  
* Cache utilisation.  
* Storage capacity.  
* Authentication events.  
* Error rates.

Application logs shall be collected centrally using Grafana Loki.

---

# **16.13 Logging Strategy**

Structured logging shall be implemented throughout the platform.

Application logs shall include:

* Timestamp.  
* Request identifier.  
* User identifier (where appropriate).  
* Organisation identifier.  
* Service name.  
* Severity.  
* Error details.  
* Processing duration.

Sensitive information shall not be written to application logs.

---

# **16.14 Backup & Recovery**

Operational continuity requires reliable backup procedures.

Backup activities include:

* PostgreSQL database backups.  
* MinIO object storage backups.  
* Configuration backups.  
* Authentication configuration backups.

Backup verification shall be performed periodically to confirm recoverability.

---

# **16.15 Deployment Validation**

Every deployment shall undergo automated validation before being considered successful.

Validation includes:

* Service availability.  
* Database connectivity.  
* Authentication.  
* Queue processing.  
* Object storage.  
* Dashboard loading.  
* API health.  
* Notification processing.

Deployment shall automatically halt if validation fails.

---

# **16.16 Rollback Strategy**

Deployment failures shall support controlled rollback procedures.

Rollback activities include:

* Restore previous application version.  
* Restore previous configuration.  
* Revert infrastructure changes where required.  
* Execute database rollback procedures where applicable.  
* Verify operational health.

Rollback decisions shall prioritise platform availability and data integrity.

---

# **16.17 Release Management**

Software releases shall follow a controlled progression through each environment.

Release stages include:

* Development Release.  
* QA Release.  
* UAT Release.  
* Production Release.

Each release shall satisfy defined quality gates before progressing to the next environment.

---

## **16.17.1 Release Approval**

Production releases shall require approval following verification of:

* Functional testing.  
* Regression testing.  
* Security testing.  
* Performance testing.  
* User Acceptance Testing.  
* Deployment readiness.

No production release shall proceed without successful completion of the defined approval process.

---

# **16.18 DevOps Responsibilities**

| Team | Responsibility |
| ----- | ----- |
| Developers | Build quality, unit testing and deployment support |
| DevOps Engineers | CI/CD, infrastructure, deployment and monitoring |
| Database Administrators | Database migrations and optimisation |
| QA Engineers | Deployment validation and smoke testing |
| Project Manager | Release planning and deployment coordination |
| Product Owner | Production release approval |

---

# **16.19 DevOps Acceptance Criteria**

The DevOps implementation shall be considered complete when:

* Source code is managed through version-controlled repositories.  
* Continuous Integration automatically validates application changes.  
* Continuous Delivery supports repeatable deployments across all environments.  
* Database migrations are version-controlled and reproducible.  
* Infrastructure components are consistently deployed and monitored.  
* Centralised logging and operational monitoring are operational.  
* Backup and recovery procedures have been validated.  
* Rollback procedures have been verified.  
* Release management processes support controlled production deployments.  
* Deployment activities satisfy the platform's operational reliability and availability objectives.

---

---

# **17\. Configuration Strategy**

## **17.1 Purpose**

The Configuration Strategy defines how organisational settings, business rules, workflow behaviour and platform options are managed throughout the Enterprise Permit-to-Work Platform. It establishes a structured approach to application configuration that enables organisations to tailor platform behaviour without modifying application source code.

Configuration shall be implemented as a first-class capability rather than embedded directly within application logic. This approach improves maintainability, supports multi-tenancy and enables future platform enhancements while reducing implementation complexity.

The platform shall distinguish between configurable business behaviour and fixed application functionality to ensure operational flexibility without compromising system integrity.

---

## **17.2 Configuration Objectives**

The objectives of the configuration strategy are to:

* Support organisation-specific business rules.  
* Minimise code-level customisation.  
* Maintain consistent configuration management.  
* Enable tenant-specific branding.  
* Support configurable workflows.  
* Simplify platform administration.  
* Improve deployment consistency.  
* Enable future feature expansion.  
* Preserve auditability of configuration changes.  
* Reduce implementation risk.

---

## **17.3 Configuration Architecture**

Platform configuration shall be organised into independent configuration domains.

Configuration domains include:

* Platform Configuration.  
* Organisation Configuration.  
* User Configuration.  
* Workflow Configuration.  
* Permit Configuration.  
* LOTOTO Configuration.  
* SIMOPS Configuration.  
* Incident Configuration.  
* Notification Configuration.  
* Dashboard Configuration.  
* Environment Configuration.

Each configuration domain shall operate independently while contributing to the overall behaviour of the platform.

---

# **17.4 Platform Configuration**

Platform-wide configuration defines behaviour common to all organisations.

Examples include:

* System time zone defaults.  
* Global security policies.  
* Password policies.  
* Session timeout values.  
* Audit retention periods.  
* Default notification settings.  
* Supported languages.  
* Feature availability.  
* System maintenance windows.

Platform configuration shall only be modifiable by authorised platform administrators.

---

# **17.5 Organisation Configuration**

Each organisation shall maintain independent configuration within the shared multi-tenant platform.

Organisation configuration includes:

* Organisation profile.  
* Company branding.  
* Logo.  
* Theme selection.  
* Time zone.  
* Working calendar.  
* Shift schedules.  
* Business units.  
* Operational sites.  
* Departments.

Organisation-specific configuration shall remain isolated from other tenants.

---

## **17.5.1 Branding Configuration**

The platform supports organisation-specific branding without requiring application modification.

Branding options include:

* Logo.  
* Organisation name.  
* Accent colours.  
* Interface theme.  
* Light and dark mode preference.  
* Login branding.  
* Dashboard branding.

Branding configuration shall not alter platform functionality.

---

# **17.6 User Configuration**

Individual users may configure selected interface preferences.

Examples include:

* Preferred language.  
* Theme preference.  
* Dashboard layout.  
* Notification preferences.  
* Default landing page.  
* Accessibility preferences.  
* Time display format.

User preferences shall remain separate from organisation-wide configuration.

---

# **17.7 Workflow Configuration**

Permit workflows shall be configurable to accommodate organisational procedures.

Workflow configuration includes:

* Approval hierarchy.  
* Approval sequence.  
* Mandatory approvers.  
* Escalation rules.  
* Revalidation rules.  
* Extension approval.  
* Closure requirements.  
* Workflow notifications.

Workflow modifications shall automatically apply to future operational records while preserving historical workflow integrity.

---

## **17.7.1 Approval Configuration**

Approval workflows may be configured according to organisational requirements.

Configurable elements include:

* Number of approval stages.  
* Required approver roles.  
* Sequential approvals.  
* Parallel approvals.  
* Escalation time.  
* Approval delegation.  
* Automatic reminders.

Approval configuration shall support complex enterprise approval hierarchies.

---

# **17.8 Permit Configuration**

Permit behaviour shall be configurable without modifying application code.

Permit configuration includes:

* Permit categories.  
* Permit templates.  
* Permit numbering.  
* Validity periods.  
* Mandatory fields.  
* Required attachments.  
* Risk assessment requirements.  
* Permit extension rules.

Permit templates shall simplify creation while maintaining organisational compliance.

---

# **17.9 LOTOTO Configuration**

Hazardous energy isolation procedures may vary between organisations.

LOTOTO configuration includes:

* Isolation categories.  
* Equipment classifications.  
* Lock types.  
* Tag types.  
* Verification requirements.  
* Restoration approval requirements.  
* Isolation numbering.  
* Energy source categories.

Configuration changes shall not affect previously completed LOTOTO records.

---

# **17.10 SIMOPS Configuration**

SIMOPS conflict detection shall support organisation-specific operational requirements.

Configuration options include:

* Conflict categories.  
* Hazard combinations.  
* Conflict severity.  
* Automatic conflict detection.  
* Manual conflict review.  
* Conflict escalation.  
* Resolution workflow.

SIMOPS configuration shall remain fully auditable.

---

# **17.11 Incident Configuration**

Incident Management shall support configurable organisational procedures.

Configuration includes:

* Incident categories.  
* Severity classifications.  
* Investigation templates.  
* Root cause methodologies.  
* Corrective action templates.  
* Preventive action templates.  
* Investigation approval workflow.

Configuration shall support future regulatory or organisational changes.

---

# **17.12 Notification Configuration**

Notification behaviour shall be configurable at both organisation and user levels.

Configuration options include:

* Notification types.  
* Reminder schedules.  
* Escalation timing.  
* Recipient groups.  
* Delivery channels.  
* Priority levels.  
* Digest frequency.

Notification configuration shall integrate with the BullMQ scheduling infrastructure.

---

# **17.13 Dashboard Configuration**

Dashboards shall support configurable layouts and organisational preferences.

Configuration includes:

* Default dashboards.  
* Widget visibility.  
* KPI selection.  
* Chart preferences.  
* Report filters.  
* Dashboard refresh intervals.  
* Homepage configuration.

Role-based dashboards shall remain configurable while preserving security restrictions.

---

# **17.14 Feature Flags**

Feature flags provide controlled enablement of platform functionality without requiring software redeployment.

Typical use cases include:

* Beta features.  
* Organisation-specific functionality.  
* Gradual feature rollout.  
* Controlled production releases.  
* Temporary feature disablement.  
* Experimental functionality.

Feature flags shall be centrally managed and fully auditable.

---

# **17.15 Environment Configuration**

Application behaviour varies between deployment environments through external configuration.

Environment-specific configuration includes:

* Database connections.  
* Redis configuration.  
* Storage endpoints.  
* Authentication providers.  
* Queue configuration.  
* Logging levels.  
* Monitoring endpoints.  
* API base URLs.

Environment configuration shall remain external to application source code.

---

# **17.16 Configuration Validation**

All configuration changes shall undergo validation before becoming active.

Validation includes:

* Required fields.  
* Data types.  
* Value ranges.  
* Business rule validation.  
* Dependency validation.  
* Permission validation.

Invalid configuration changes shall be rejected before persistence.

---

# **17.17 Configuration Versioning**

Configuration changes shall be version-controlled to support traceability and operational governance.

Versioning capabilities include:

* Configuration history.  
* Previous values.  
* Change timestamps.  
* User responsible for the change.  
* Configuration comparison.  
* Configuration restoration where appropriate.

Configuration history shall remain permanently available for audit purposes.

---

# **17.18 Configuration Audit Logging**

Every configuration modification shall generate an audit record.

Audit records shall include:

* Configuration domain.  
* Previous value.  
* Updated value.  
* User.  
* Organisation.  
* Timestamp.  
* Reason for change (where required).

Configuration audit records shall remain immutable following creation.

---

# **17.19 Configuration Governance**

Configuration shall only be modified by authorised personnel according to their assigned permissions.

Governance principles include:

* Least privilege access.  
* Approval for high-impact configuration changes.  
* Separation of administrative responsibilities.  
* Configuration review procedures.  
* Change traceability.

Configuration governance ensures operational consistency while reducing the risk of accidental or unauthorised changes.

---

# **17.20 Configuration Acceptance Criteria**

The configuration strategy shall be considered complete when:

* Platform behaviour is configurable without source code modification where appropriate.  
* Organisation-specific settings remain isolated within the multi-tenant architecture.  
* Workflow configuration supports enterprise operational requirements.  
* Permit, LOTOTO, SIMOPS and Incident Management modules support configurable business rules.  
* User preferences are maintained independently of organisational settings.  
* Configuration changes are validated before activation.  
* Configuration history and audit logs provide complete traceability.  
* Environment-specific settings remain external to application code.  
* Feature flags support controlled feature rollout.  
* Configuration governance supports secure and maintainable platform administration.

---

---

# **18\. Operational Support & Maintenance Strategy**

## **18.1 Purpose**

The Operational Support & Maintenance Strategy defines the processes, responsibilities and operational procedures required to ensure the continued reliability, availability and maintainability of the Enterprise Permit-to-Work Platform following production deployment.

Operational support extends beyond software development and focuses on maintaining platform stability, resolving operational issues, monitoring system health and delivering controlled software updates throughout the application's operational lifecycle.

The strategy establishes structured operational governance to ensure that the platform remains secure, available and capable of supporting critical industrial safety workflows.

---

## **18.2 Operational Objectives**

The objectives of the operational support strategy are to:

* Maintain high platform availability.  
* Provide structured operational support.  
* Resolve incidents efficiently.  
* Minimise operational downtime.  
* Support continuous platform improvement.  
* Ensure reliable monitoring.  
* Protect operational data.  
* Maintain system security.  
* Support controlled software releases.  
* Ensure long-term platform sustainability.

---

## **18.3 Operational Support Model**

Operational support shall follow a tiered support model that assigns responsibilities according to technical complexity.

The support model consists of:

* First-Line Support (L1)  
* Second-Line Support (L2)  
* Third-Line Support (L3)  
* Infrastructure Support  
* Product Engineering

Each support level shall operate according to defined responsibilities and escalation procedures.

---

# **18.4 Support Responsibilities**

## **18.4.1 First-Line Support (L1)**

First-Line Support provides the initial point of contact for operational users.

Typical responsibilities include:

* User assistance.  
* Password reset requests.  
* Basic troubleshooting.  
* Incident logging.  
* User guidance.  
* Request categorisation.  
* Escalation where required.

L1 support shall not perform application modifications or infrastructure changes.

---

## **18.4.2 Second-Line Support (L2)**

Second-Line Support provides technical investigation of operational issues.

Responsibilities include:

* Functional troubleshooting.  
* Configuration verification.  
* Workflow validation.  
* User permission verification.  
* Data investigation.  
* Application diagnostics.  
* Defect identification.

L2 support shall escalate confirmed software defects to the engineering team.

---

## **18.4.3 Third-Line Support (L3)**

Third-Line Support consists of software engineers responsible for application-level issue resolution.

Responsibilities include:

* Defect analysis.  
* Code corrections.  
* Performance investigation.  
* Database investigation.  
* API diagnostics.  
* Deployment support.  
* Technical problem resolution.

L3 support shall coordinate with DevOps where infrastructure-related issues are identified.

---

## **18.4.4 Infrastructure Support**

Infrastructure Support maintains platform availability and operational health.

Responsibilities include:

* Server monitoring.  
* Database administration.  
* Storage management.  
* Queue management.  
* Authentication infrastructure.  
* Backup verification.  
* Disaster recovery.

Infrastructure support shall continuously monitor production environments.

---

# **18.5 Incident Management**

Operational incidents shall follow a structured lifecycle to ensure consistent handling and timely resolution.

The incident lifecycle consists of:

1. Incident identification.  
2. Incident logging.  
3. Classification.  
4. Investigation.  
5. Resolution.  
6. Verification.  
7. Closure.  
8. Post-incident review.

Every production incident shall receive a unique reference number for traceability.

---

## **18.5.1 Incident Classification**

Operational incidents shall be prioritised according to business impact.

| Priority | Description |
| ----- | ----- |
| Critical | Complete platform outage or major safety-impacting failure |
| High | Significant functional degradation affecting operational workflows |
| Medium | Partial functionality unavailable with acceptable workarounds |
| Low | Minor operational issue with limited business impact |

Incident priority shall determine the response and escalation process.

---

# **18.6 Problem Management**

Problem Management focuses on identifying and eliminating the root causes of recurring operational incidents.

Activities include:

* Root cause analysis.  
* Trend identification.  
* Permanent corrective actions.  
* Preventive improvements.  
* Knowledge base updates.  
* Process improvements.

Problem management aims to reduce recurring operational disruptions rather than simply resolving individual incidents.

---

# **18.7 Change Management**

All production changes shall follow a controlled change management process.

Change categories include:

* Standard changes.  
* Normal changes.  
* Emergency changes.

Typical changes include:

* Feature releases.  
* Configuration updates.  
* Infrastructure modifications.  
* Database migrations.  
* Security updates.  
* Performance improvements.

Each production change shall be documented, reviewed and approved prior to implementation.

---

# **18.8 Release Management**

Application releases shall follow a controlled release process to minimise operational risk.

Release activities include:

* Release planning.  
* Build verification.  
* Deployment approval.  
* Production deployment.  
* Smoke testing.  
* Operational verification.  
* Release documentation.

Production releases shall occur during approved maintenance windows unless emergency deployment procedures are invoked.

---

# **18.9 Maintenance Windows**

Routine maintenance activities shall be scheduled during predefined maintenance windows to minimise disruption to operational users.

Maintenance activities include:

* Infrastructure updates.  
* Database optimisation.  
* Security patching.  
* Platform upgrades.  
* Configuration updates.  
* Performance optimisation.

Users shall receive advance notification of planned maintenance where appropriate.

---

# **18.10 Monitoring Strategy**

Continuous monitoring shall provide operational visibility into application health and infrastructure performance.

Monitoring shall include:

* Application availability.  
* API response times.  
* Database health.  
* Queue processing.  
* Redis performance.  
* MinIO storage.  
* Authentication services.  
* Background jobs.  
* Notification delivery.  
* Dashboard performance.

Monitoring shall support proactive identification of operational issues before they significantly impact users.

---

# **18.11 Logging Strategy**

Operational logging provides the information required to diagnose issues and investigate production behaviour.

Application logs shall include:

* Timestamp.  
* Request identifier.  
* Service name.  
* User identifier (where appropriate).  
* Organisation identifier.  
* Log severity.  
* Processing duration.  
* Error information.

Logs shall be centrally collected and retained according to organisational retention policies.

---

# **18.12 Backup & Recovery Operations**

Operational continuity depends upon reliable backup and recovery procedures.

Routine operational activities include:

* Database backups.  
* Object storage backups.  
* Configuration backups.  
* Authentication configuration backups.  
* Backup verification.  
* Recovery testing.

Backup schedules shall be automated wherever practical.

Recovery procedures shall be validated periodically to ensure backup integrity.

---

# **18.13 Disaster Recovery**

Disaster Recovery procedures define the activities required to restore platform operation following significant service disruption.

Recovery planning includes:

* Infrastructure restoration.  
* Database restoration.  
* Storage restoration.  
* Configuration recovery.  
* Authentication recovery.  
* Service validation.  
* Operational verification.

Disaster recovery procedures shall be documented and periodically exercised to verify readiness.

---

# **18.14 Operational Documentation**

Operational documentation shall remain current throughout the platform lifecycle.

Documentation includes:

* Deployment procedures.  
* Recovery procedures.  
* Configuration guides.  
* Support procedures.  
* Runbooks.  
* Troubleshooting guides.  
* Release documentation.  
* Operational checklists.

Documentation updates shall accompany significant platform changes.

---

# **18.15 Knowledge Management**

Operational knowledge shall be captured to improve support efficiency and reduce recurring issues.

Knowledge management includes:

* Frequently encountered issues.  
* Resolution procedures.  
* Configuration guidance.  
* Operational best practices.  
* Troubleshooting articles.  
* Platform FAQs.

Knowledge resources shall be reviewed and updated regularly.

---

# **18.16 Operational Metrics**

Operational performance shall be measured using defined service indicators.

Typical operational metrics include:

* Platform availability.  
* Incident volume.  
* Incident resolution time.  
* Mean Time to Detect (MTTD).  
* Mean Time to Resolve (MTTR).  
* Deployment success rate.  
* Failed deployment rate.  
* Backup success rate.  
* System utilisation.  
* Queue processing performance.

Operational metrics shall support continuous improvement activities.

---

# **18.17 Operational Handover**

Following successful production deployment, responsibility for ongoing platform operation shall transition from the implementation team to the operational support team.

The operational handover shall include:

* System documentation.  
* Infrastructure documentation.  
* Configuration documentation.  
* Support procedures.  
* Monitoring configuration.  
* Backup procedures.  
* Known issues.  
* Release history.  
* Administrative credentials (managed securely).  
* Knowledge transfer sessions.

The handover shall only be considered complete once the operational team has confirmed readiness to assume responsibility.

---

# **18.18 Continuous Improvement**

The platform shall support continual operational improvement through structured review of performance, incidents and user feedback.

Improvement activities include:

* Operational reviews.  
* Incident trend analysis.  
* Performance optimisation.  
* Security enhancements.  
* User feedback analysis.  
* Infrastructure optimisation.  
* Process refinement.  
* Feature enhancement planning.

Continuous improvement ensures that the platform remains effective as organisational requirements evolve.

---

# **18.19 Operational Acceptance Criteria**

The operational support and maintenance strategy shall be considered complete when:

* A structured multi-level support model has been established.  
* Incident, problem and change management processes are documented and operational.  
* Monitoring, logging and alerting provide comprehensive operational visibility.  
* Backup and disaster recovery procedures have been validated.  
* Maintenance and release processes support reliable production operation.  
* Operational documentation and runbooks are complete and accessible.  
* Knowledge management processes support efficient issue resolution.  
* Operational metrics are defined and regularly reviewed.  
* Formal operational handover has been completed successfully.  
* The platform demonstrates readiness for long-term production support and continuous improvement.

---

---

# **19\. Production Readiness & Go-Live**

## **19.1 Purpose**

The Production Readiness & Go-Live Strategy defines the activities, validation procedures and acceptance criteria required to transition the Enterprise Permit-to-Work Platform from implementation into live production operation.

This phase represents the final stage of the implementation lifecycle and ensures that all functional modules, infrastructure components and operational processes have been fully validated before the platform becomes available to production users.

The objective of this phase is to minimise deployment risk, ensure operational continuity and establish confidence that the platform can safely support enterprise Permit-to-Work operations.

---

## **19.2 Go-Live Objectives**

The objectives of production readiness are to:

* Verify completion of all implementation activities.  
* Validate production infrastructure.  
* Confirm application stability.  
* Complete business acceptance.  
* Verify operational support readiness.  
* Confirm deployment procedures.  
* Ensure monitoring is operational.  
* Validate backup and recovery.  
* Prepare production users.  
* Support a successful production launch.

---

## **19.3 Production Readiness Assessment**

Prior to production deployment, the implementation team shall conduct a comprehensive readiness assessment.

The assessment shall verify:

* Functional readiness.  
* Technical readiness.  
* Operational readiness.  
* Security readiness.  
* Performance readiness.  
* Infrastructure readiness.  
* Business readiness.

The platform shall only proceed to production following successful completion of all readiness activities.

---

# **19.4 Functional Readiness**

Functional readiness confirms that all planned software functionality has been successfully implemented and verified.

Validation includes:

* Completion of all implementation milestones.  
* Completion of all planned sprints.  
* Functional requirement verification.  
* Regression testing.  
* Integration testing.  
* User Acceptance Testing.  
* Defect verification.

No planned functionality shall remain incomplete at the time of production deployment unless formally approved for exclusion.

---

# **19.5 Technical Readiness**

Technical readiness verifies that the application architecture is prepared for production operation.

Verification activities include:

* Application builds.  
* Production configuration.  
* Database migrations.  
* Queue configuration.  
* Object storage configuration.  
* Authentication configuration.  
* Monitoring configuration.  
* Logging configuration.

Technical validation shall confirm that production infrastructure reflects the approved deployment architecture.

---

# **19.6 Infrastructure Readiness**

Infrastructure components shall be validated prior to deployment.

Infrastructure verification includes:

* PostgreSQL availability.  
* Redis availability.  
* BullMQ workers.  
* MinIO object storage.  
* Keycloak authentication.  
* Grafana Loki logging.  
* Metabase analytics.  
* Network connectivity.  
* Storage capacity.  
* Backup configuration.

Infrastructure readiness shall be confirmed before application deployment begins.

---

# **19.7 Security Readiness**

Security validation confirms that production security controls have been correctly implemented.

Activities include:

* Authentication verification.  
* Role validation.  
* Tenant isolation verification.  
* HTTPS verification.  
* Secret management.  
* API security validation.  
* Security configuration review.  
* Vulnerability assessment.  
* Audit logging verification.

Security readiness shall satisfy the Security Implementation Strategy before production deployment proceeds.

---

# **19.8 Performance Readiness**

Performance readiness validates that the production environment satisfies operational performance expectations.

Validation includes:

* API response times.  
* Dashboard rendering.  
* Database performance.  
* Queue throughput.  
* Cache utilisation.  
* Mobile synchronisation.  
* Concurrent user testing.  
* Load testing verification.

Performance validation shall confirm that production resources support anticipated operational demand.

---

# **19.9 Operational Readiness**

Operational readiness confirms that ongoing support processes have been established.

Operational verification includes:

* Monitoring.  
* Alerting.  
* Backup procedures.  
* Recovery procedures.  
* Operational documentation.  
* Runbooks.  
* Support procedures.  
* Escalation processes.

Operational teams shall confirm readiness before production launch.

---

# **19.10 User Acceptance Verification**

Business stakeholders shall verify that the implemented platform satisfies agreed business requirements.

User Acceptance activities include:

* Business workflow validation.  
* Permit lifecycle verification.  
* LOTOTO verification.  
* SIMOPS verification.  
* Incident Management verification.  
* Dashboard verification.  
* Notification verification.  
* Reporting verification.

Formal business approval shall be obtained before production deployment.

---

# **19.11 Go-Live Checklist**

The following activities shall be completed before production deployment.

### **Application**

* Production frontend deployed.  
* Production backend deployed.  
* Mobile application released.  
* Production configuration applied.  
* Environment variables verified.

---

### **Infrastructure**

* PostgreSQL operational.  
* Redis operational.  
* BullMQ operational.  
* MinIO operational.  
* Keycloak operational.  
* Grafana Loki operational.  
* Metabase operational.

---

### **Security**

* HTTPS enabled.  
* Authentication verified.  
* RBAC validated.  
* Secrets configured.  
* Audit logging enabled.

---

### **Data**

* Master data imported.  
* Organisation data configured.  
* User accounts created.  
* Roles assigned.  
* Permit templates configured.  
* Workflow configuration completed.

---

### **Operations**

* Monitoring enabled.  
* Alerts enabled.  
* Backup verified.  
* Documentation available.  
* Support team notified.

---

# **19.12 Production Deployment Activities**

Production deployment shall follow a controlled sequence.

1. Infrastructure verification.  
2. Backup existing production environment (where applicable).  
3. Deploy backend services.  
4. Execute database migrations.  
5. Deploy frontend application.  
6. Deploy mobile application updates.  
7. Configure environment variables.  
8. Validate infrastructure.  
9. Execute smoke testing.  
10. Enable production access.

Deployment shall be coordinated by the implementation and operations teams.

---

# **19.13 Smoke Testing**

Immediately following deployment, smoke testing shall verify critical platform functionality.

Smoke testing includes:

* User authentication.  
* Dashboard loading.  
* Permit creation.  
* Permit approval.  
* Permit execution.  
* Permit closure.  
* Notification delivery.  
* File uploads.  
* Report generation.  
* Mobile synchronisation.

Successful completion of smoke testing confirms that the platform is operational.

---

# **19.14 Hypercare Period**

Following production deployment, the platform shall enter a Hypercare period during which implementation and operational teams jointly monitor production behaviour.

Hypercare activities include:

* Increased monitoring.  
* Daily operational reviews.  
* Rapid incident response.  
* User support.  
* Performance monitoring.  
* Defect prioritisation.  
* Deployment verification.

The duration of the Hypercare period shall be determined according to project requirements and organisational governance.

---

# **19.15 Go-Live Risks**

Typical production deployment risks include:

| Risk | Mitigation |
| ----- | ----- |
| Deployment failure | Verified rollback procedures |
| Configuration errors | Configuration validation checklist |
| Database migration issues | Tested migration process |
| Performance degradation | Pre-production performance testing |
| Authentication failures | Production authentication verification |
| Notification failures | End-to-end notification testing |
| User readiness | Training and documentation |
| Infrastructure failure | Monitoring and backup procedures |

All identified risks shall have defined mitigation actions before production deployment.

---

# **19.16 Rollback Readiness**

Rollback capability shall remain available throughout production deployment.

Rollback preparation includes:

* Previous application version.  
* Previous configuration.  
* Database recovery plan.  
* Infrastructure rollback.  
* Deployment verification.  
* Operational communication procedures.

Rollback shall prioritise restoration of operational availability while preserving data integrity.

---

# **19.17 Go-Live Success Criteria**

Production deployment shall be considered successful when:

* All production services are operational.  
* Critical business workflows execute successfully.  
* Authentication and authorisation function correctly.  
* Notifications are delivered successfully.  
* Dashboards display operational information correctly.  
* Reports generate successfully.  
* Monitoring and alerting are operational.  
* Backup procedures are verified.  
* Smoke testing completes successfully.  
* Business stakeholders approve production operation.

---

# **19.18 Production Acceptance Criteria**

The platform shall be considered ready for operational use when:

* All implementation milestones have been successfully completed.  
* All sprint deliverables satisfy their respective Definition of Done.  
* Functional, integration, performance and security testing have been successfully completed.  
* User Acceptance Testing has been formally approved.  
* Production infrastructure has been validated.  
* Operational support processes are established.  
* Monitoring, logging and backup procedures are operational.  
* Production deployment has completed successfully.  
* No Critical or High severity defects remain unresolved.  
* Formal approval for production operation has been granted by authorised stakeholders.

---

# **20\. Appendices**

## **20.1 Glossary**

| Term | Description |
| ----- | ----- |
| PTW | Permit-to-Work |
| LOTOTO | Lock Out Tag Out |
| SIMOPS | Simultaneous Operations |
| RBAC | Role-Based Access Control |
| KPI | Key Performance Indicator |
| UAT | User Acceptance Testing |
| CI/CD | Continuous Integration / Continuous Delivery |
| DTO | Data Transfer Object |
| API | Application Programming Interface |
| JWT | JSON Web Token |
| OIDC | OpenID Connect |

---

## **20.2 Technology Stack Summary**

### **Frontend**

* Next.js  
* React  
* TypeScript  
* Tailwind CSS  
* Shadcn/UI  
* ui.watermelon.sh Components & Blocks  
* Framer Motion  
* Lucide Icons  
* Recharts

### **Mobile**

* React Native  
* SQLite

### **Backend**

* NestJS  
* TypeScript

### **Database**

* PostgreSQL  
* Drizzle ORM  
* Redis

### **Storage**

* MinIO

### **Authentication**

* Keycloak

### **Background Processing**

* BullMQ

### **Monitoring & Analytics**

* Grafana Loki  
* Metabase

---

## **20.3 Module Summary**

The implementation delivers the following functional modules:

* Organisation Management  
* Workforce Management  
* Master Data Management  
* Permit-to-Work  
* Lock Out Tag Out (LOTOTO)  
* Simultaneous Operations (SIMOPS)  
* Multi-Day Permit Management  
* Incident Management  
* Notifications  
* Dashboards & Analytics  
* Administrative Portal  
* Mobile Application  
* Audit & Reporting Framework

---

## **20.4 Implementation Statistics**

| Item | Quantity |
| ----- | ----- |
| Milestones | 8 |
| Development Sprints | 21 |
| Functional Modules | 13 |
| User Stories | 70+ |
| Use Cases | 60+ |
| Business Rules | 90+ |
| Functional Criteria | 90+ |
| API Endpoints | 100+ |
| Positive Test Cases | 100+ |
| Negative Test Cases | 100+ |
| Integration Test Cases | 70+ |
| Supported Platforms | 3 (Web, Mobile, Backend) |

---

## **20.5 Document References**

This implementation plan should be read in conjunction with the following project documentation:

* Product Requirements Document (PRD)  
* Software Requirements Specification (SRS)  
* System Architecture Document  
* Database Design Specification  
* UI/UX Design System  
* API Specification  
* Deployment Guide  
* User Guide  
* Administrator Guide  
* Test Plan

---

# **21\. Conclusion**

This Implementation Plan defines the structured approach for delivering the Enterprise Permit-to-Work Platform from project initiation through production deployment. It establishes the implementation strategy, technical standards, governance model, milestone structure, sprint planning, testing approach and operational processes required to deliver a secure, scalable and maintainable enterprise software solution.

The implementation has been organised into a series of incremental milestones, each delivering a defined set of business capabilities while maintaining traceability between functional requirements, implementation activities, testing and acceptance criteria. This phased approach enables continuous validation throughout the development lifecycle, reduces implementation risk and provides measurable progress towards the successful delivery of the platform.

In addition to defining the implementation of core functional modules, this document establishes the engineering practices that govern frontend development, backend services, security, performance optimisation, quality assurance, DevOps, configuration management, operational support and production deployment. Collectively, these implementation strategies provide a consistent framework for developing, validating and maintaining the platform throughout its operational lifecycle.

Successful execution of this Implementation Plan will result in a comprehensive cloud-native Permit-to-Work platform supporting Organisation Management, Workforce Management, Master Data Management, Permit-to-Work, Lock Out Tag Out (LOTOTO), Simultaneous Operations (SIMOPS), Multi-Day Permit Management, Incident Management, Notifications and Dashboards & Analytics across both web and mobile applications.

By combining a modular system architecture with an Agile, milestone-driven delivery model, the implementation promotes scalability, maintainability and adaptability while supporting the evolving operational and regulatory requirements of industrial organisations. The completed platform will provide a secure, configurable and auditable digital Permit-to-Work solution capable of improving operational efficiency, strengthening safety governance and supporting enterprise-scale deployment across multiple organisations and operational sites.

This Implementation Plan serves as the authoritative reference for the execution of the project and shall guide implementation activities, quality assurance, deployment and operational readiness throughout the software development lifecycle. Completion of the activities defined within this document signifies that the platform has been implemented in accordance with the approved business, functional and technical requirements and is prepared to support safe, reliable and efficient operational use.

