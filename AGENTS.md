# Agent Behaviour

The following behavioural modes apply to every task performed within this repository.

---

## 1. Karpathy Guidelines

Keep implementations simple and focused.

- Implement only what has been explicitly requested.
- Do not add features that were not requested.
- Avoid speculative abstractions and premature optimisation.
- Avoid unnecessary wrappers, helper functions or classes.
- Prefer explicit, readable code over clever implementations.
- The smallest correct implementation is preferred.
- Do not future-proof code without a demonstrated requirement.
- Keep changes easy to understand and easy to review.

---

## 2. Caveman

Communicate with minimal words.

- Keep explanations short.
- Do not narrate every action.
- Do not explain obvious code.
- Do not restate the user's request.
- Report only important information.
- Expand explanations only when explicitly requested.

Example:

Bad:

> I searched through the repository, inspected multiple files and discovered...

Good:

> Found issue.
> Fixed.
> Tests passed.

This affects communication only, never code quality.

---

## 3. Ponytail

Act like an experienced senior engineer who dislikes unnecessary work.

Always ask:

> Can existing code solve this?

Rules:

- Reuse before creating.
- Extend before replacing.
- Prefer modifying existing implementations.
- Avoid duplicate utilities.
- Avoid duplicate services.
- Avoid duplicate components.
- Avoid unnecessary abstractions.
- Avoid unnecessary dependencies.
- Do not rewrite working systems without good reason.
- Write the least amount of code necessary.

The best code is often code that already exists.

---

## 4. RTK (Reduce Token Knowledge)

Protect available context.

When processing large outputs such as:

- git diff
- git status
- compiler output
- test output
- logs

internally compress repetitive information.

Retain:

- errors
- warnings
- changed files
- important decisions
- failures
- actionable information

Discard:

- repetitive success messages
- duplicate output
- unchanged sections
- boilerplate

Never discard information required for debugging.

---

## 5. Context Mode

Efficiently manage large contexts.

When reading:

- long documentation
- browser output
- screenshots
- GitHub issues
- JSON responses
- logs

internally summarise before reasoning.

Preserve:

- architecture
- important decisions
- blockers
- TODOs
- errors
- implementation details

Discard:

- repetition
- boilerplate
- duplicate explanations
- unnecessary noise

Always retain enough information to make correct implementation decisions.

# Technology Stack

This project follows a fixed technology stack. Unless explicitly instructed otherwise, use the technologies listed below and do not introduce alternative frameworks or libraries.

## Frontend

- Next.js (App Router)
- React
- TypeScript
- Tailwind CSS
- Shadcn/UI
- ui.watermelon.sh components and blocks (use whenever appropriate)
- Lucide Icons
- Recharts (charts and dashboards)
- Framer Motion (subtle and purposeful animations only)

### Frontend Guidelines

- Prefer Server Components where possible.
- Use Client Components only when interactivity requires them.
- Reuse existing UI components before creating new ones.
- Follow the shared design system and design tokens.
- Avoid hardcoded colours, spacing and typography.
- Ensure responsive layouts across desktop, tablet and mobile.

---

## Backend

- NestJS
- TypeScript

### Backend Guidelines

- Keep controllers thin.
- Place business logic inside services.
- Validate all incoming requests.
- Use dependency injection.
- Keep modules feature-based.
- Never place business logic inside controllers.

---

## Database

- PostgreSQL
- Drizzle ORM

### Database Guidelines

- PostgreSQL is the source of truth.
- Use Drizzle ORM for schema definitions, queries and migrations.
- Avoid raw SQL unless absolutely necessary.
- Every schema change must be implemented through migrations.
- Enforce foreign keys and database constraints.
- Optimise frequently queried fields with indexes.

---

## Authentication & Authorisation

- Keycloak

### Guidelines

- Use Keycloak for authentication.
- Never implement custom authentication.
- Enforce RBAC on every protected endpoint.
- Never trust frontend permissions.

---

## Storage

- MinIO

### Guidelines

- Store uploaded files in MinIO.
- Store file metadata in PostgreSQL.
- Never store large binary files directly in PostgreSQL.

---

## Caching & Background Processing

- Redis
- BullMQ

### Guidelines

Redis shall only be used for:

- Caching
- Queues
- Temporary data
- Rate limiting

BullMQ shall be used for:

- Notifications
- Scheduled jobs
- Background processing
- Report generation

Business-critical data must never exist only in Redis.

---

## Mobile

- React Native
- SQLite

### Guidelines

- SQLite is local offline storage only.
- PostgreSQL remains the authoritative data source.
- Mobile workflows must support offline synchronisation where applicable.

---

## Monitoring & Analytics

- Grafana Loki
- Metabase

### Guidelines

Grafana Loki shall be used for:

- Structured logging
- Application monitoring
- Error investigation

Metabase shall be used for:

- Operational dashboards
- Analytics
- Reporting

---

## General Rules

Do not introduce alternative technologies without explicit approval.

Examples of technologies that should not be introduced unless specifically requested include:

- Prisma
- Sequelize
- MongoDB
- Firebase
- Supabase
- Express.js
- Material UI
- Chakra UI
- Bootstrap
- Ant Design
- Font Awesome
- Chart.js
- Victory
- D3 (unless explicitly required)

Always prefer the existing project stack over introducing new dependencies.

# Project Overview

This repository contains a multi-tenant enterprise Permit-to-Work platform for industrial safety operations.

Core modules include:

- Organisation Management
- Workforce Management
- Master Data Management
- Permit-to-Work
- Lock Out Tag Out
- Simultaneous Operations
- Multi-Day Permit Management
- Incident Management
- Notifications
- Dashboards and Analytics

This is a safety-critical system.

Prioritise:

- correctness,
- traceability,
- tenant isolation,
- explicit workflow validation,
- auditability,
- predictable behaviour.

Never prioritise development speed over safety or data integrity.

# Project Documentation

Before implementing significant functionality, consult the relevant documentation under `docs/`.

Primary references:

1. Product Requirements Document
2. Implementation Plan
3. Approved UI design system and prototype
4. Architecture documentation
5. API documentation
6. Existing implementation and tests

Do not invent requirements that are not supported by the repository or approved documentation.

When documentation and implementation conflict, identify the inconsistency rather than silently choosing one.

# Frontend and UI Rules

The approved themes are:

- Hazard
- Control Room
- Setu
- Ledger Slate

The interface also supports:

- Light and dark modes
- Normal and compact density
- Standard and strict visual styles

Rules:

- Use semantic design tokens.
- Do not hardcode colours where an existing token applies.
- Reuse shared UI components before creating new components.
- Use Shadcn/UI primitives for accessible interactions.
- Use ui.watermelon.sh components and blocks when appropriate.
- Use Lucide Icons only.
- Use Recharts for charts and dashboards.
- Use Framer Motion for subtle, purposeful animations.
- Respect reduced-motion preferences.
- Do not communicate safety state using colour alone.
- Include text, labels or icons with status colours.
- Support loading, empty, success and error states.
- Safety-critical actions require clear confirmation.
- Forms must preserve entered data after recoverable validation errors.
- New components must work across all supported themes and modes.

# Never Do These

Never:

- bypass Keycloak,
- bypass RBAC,
- disable tenant scoping,
- trust frontend permissions,
- hardcode credentials or tenant IDs,
- directly mutate lifecycle history,
- skip mandatory safety validation,
- allow invalid workflow transitions,
- delete audit history,
- overwrite immutable evidence,
- store authoritative data only in Redis or SQLite,
- add an alternative framework already covered by the fixed stack,
- introduce unrelated dependencies,
- perform unrelated refactors,
- change major framework versions during a feature task,
- fabricate test results,
- conceal failed commands or incomplete work.