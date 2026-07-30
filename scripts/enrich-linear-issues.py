#!/usr/bin/env python3
"""Generate enriched issue descriptions and sprint assignments for incomplete Linear issues."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

ISSUES_FILE = Path(
    "/Users/ravikantmishra/.cursor/projects/Users-ravikantmishra-Desktop-PTW-FINAL-great-ptw-loto-ai-app/agent-tools/ee597f9f-7c73-4423-a1a6-27cd152e854a.txt"
)
OUT_DIR = Path(__file__).resolve().parent.parent / "docs" / "sprints"
MANIFEST = Path(__file__).resolve().parent.parent / "data" / "processed" / "linear-issue-updates.json"

PTW_SPRINT_ORDER = [
    "SP-03.01",
    "SP-03.02",
    "SP-03.03",
    "SP-04.01",
    "SP-04.02",
    "SP-05.01",
    "SP-05.02",
    "SP-06.01",
    "SP-06.02",
    "SP-06.03",
    "SP-07.01",
    "SP-07.02",
    "SP-08.01",
    "SP-08.02",
    "SP-08.03",
]

LAYER_PRIORITY = {"DB": 1, "INF": 1, "BE": 2, "FE": 3, "MOB": 3, "SP": 1}


@dataclass
class Issue:
    id: str
    identifier: str
    title: str
    description: str
    status: str
    project: str
    url: str
    labels: list[str]
    priority_name: str
    priority_value: int | None
    sprint_code: str | None
    layer: str | None
    is_parent: bool
    github_issue: int | None


def load_issues() -> list[Issue]:
    data = json.loads(ISSUES_FILE.read_text())
    result: list[Issue] = []
    for raw in data["issues"]:
        if raw.get("status") in ("Done", "Canceled", "Cancelled", "Duplicate"):
            continue
        project = raw.get("project")
        project_name = project.get("name") if isinstance(project, dict) else (project or "none")
        priority = raw.get("priority") or {}
        priority_name = priority.get("name") if isinstance(priority, dict) else "No priority"
        priority_value = priority.get("value") if isinstance(priority, dict) else None
        title = raw.get("title", "")
        sprint_match = re.search(r"(SP-\d+\.\d+)", title)
        sprint_code = sprint_match.group(1) if sprint_match else None
        layer_match = re.search(r"\b(DB|INF|BE|FE|MOB)-SP-", title)
        layer = layer_match.group(1) if layer_match else ("SP" if title.startswith("SP-") else None)
        is_parent = bool(re.match(r"^SP-\d+\.\d+ —", title))
        gh = None
        for att in raw.get("attachments") or []:
            m = re.search(r"github\.com/.+/issues/(\d+)", att.get("url", ""))
            if m:
                gh = int(m.group(1))
        issue_id = raw.get("id") or raw.get("identifier") or ""
        identifier = raw.get("identifier") or issue_id
        result.append(
            Issue(
                id=issue_id,
                identifier=identifier,
                title=title,
                description=raw.get("description") or "",
                status=raw.get("status", ""),
                project=project_name,
                url=raw.get("url", ""),
                labels=list(raw.get("labels") or []),
                priority_name=priority_name,
                priority_value=priority_value,
                sprint_code=sprint_code,
                layer=layer,
                is_parent=is_parent,
                github_issue=gh,
            )
        )
    return result


def sprint_number(code: str | None) -> int:
    if not code or code not in PTW_SPRINT_ORDER:
        return 99
    return PTW_SPRINT_ORDER.index(code) + 1


def compute_priority(issue: Issue) -> tuple[int, str]:
    if issue.project != "great-ptw-loto-ai-app":
        current = issue.priority_value or 3
        return current, issue.priority_name
    if issue.is_parent:
        return 1, "Urgent"
    layer = issue.layer or "BE"
    value = LAYER_PRIORITY.get(layer, 3)
    names = {1: "Urgent", 2: "High", 3: "Medium", 4: "Low"}
    return value, names[value]


def layer_context(layer: str | None, title: str) -> dict[str, str]:
    module = title.split("—")[-1].strip() if "—" in title else title
    contexts = {
        "DB": {
            "summary": f"Database schema, migrations, constraints and tenant-scoped data model for {module}.",
            "positive": "\n".join(
                [
                    "- Migration applies cleanly on empty and existing databases",
                    "- Foreign keys, unique constraints and indexes enforce data integrity",
                    "- Tenant isolation verified — no cross-tenant reads/writes",
                    "- Seed data loads without violating constraints",
                    "- Rollback/migration idempotency validated",
                ]
            ),
            "negative": "\n".join(
                [
                    "- Migration fails on duplicate or invalid legacy data",
                    "- Cross-tenant reference allowed by schema",
                    "- Required audit/immutable fields can be updated or deleted",
                    "- Migration breaks existing permit lifecycle queries",
                ]
            ),
            "acceptance": "\n".join(
                [
                    "- Drizzle schema and migration committed",
                    "- Constraints match PRD workflow rules",
                    "- Integration tests cover tenant scoping",
                    "- CI migration step passes",
                ]
            ),
            "dod": "\n".join(
                [
                    "- `npm run db:migrate -w api` succeeds in CI",
                    "- Schema reviewed for safety-critical invariants",
                    "- No raw SQL unless justified",
                    "- Documentation updated if ERD changed",
                ]
            ),
        },
        "INF": {
            "summary": f"Infrastructure, Docker, CI/CD and environment configuration for {module}.",
            "positive": "\n".join(
                [
                    "- `docker compose up` starts all required services healthy",
                    "- CI pipeline runs lint, test, migrate and build",
                    "- Environment variables documented and validated at startup",
                    "- Redis/MinIO/Keycloak integrations reachable from API",
                ]
            ),
            "negative": "\n".join(
                [
                    "- Service starts without health checks passing",
                    "- Secrets committed to repository",
                    "- CI passes without database migration verification",
                    "- Local and CI environments diverge silently",
                ]
            ),
            "acceptance": "\n".join(
                [
                    "- Infrastructure changes merged with compose/CI updates",
                    "- Health endpoints green for dependent services",
                    "- Rollback path documented",
                ]
            ),
            "dod": "\n".join(
                [
                    "- CI green on PR",
                    "- README/deployment docs updated",
                    "- No hardcoded credentials",
                ]
            ),
        },
        "BE": {
            "summary": f"NestJS API implementation, validation, RBAC and audit logging for {module}.",
            "positive": "\n".join(
                [
                    "- Endpoints return correct data for authorised tenant/user",
                    "- RBAC enforced server-side on every protected route",
                    "- Invalid workflow transitions rejected with clear errors",
                    "- Audit events recorded for safety-critical actions",
                    "- Integration tests pass against PostgreSQL",
                ]
            ),
            "negative": "\n".join(
                [
                    "- Unauthenticated access to protected endpoints",
                    "- Cross-tenant data leakage via missing scoping",
                    "- Invalid state transition accepted",
                    "- Business logic in controller instead of service",
                ]
            ),
            "acceptance": "\n".join(
                [
                    "- API contract matches docs/api-reference.md",
                    "- DTO validation with class-validator",
                    "- Unit + integration tests added",
                    "- Error responses follow standard envelope",
                ]
            ),
            "dod": "\n".join(
                [
                    "- `npm run test -w api` passes",
                    "- `npm run build -w api` passes",
                    "- No bypass of Keycloak/RBAC",
                    "- PR reviewed and merged",
                ]
            ),
        },
        "FE": {
            "summary": f"Next.js UI for {module} using design system tokens and accessible states.",
            "positive": "\n".join(
                [
                    "- UI renders loading, empty, success and error states",
                    "- Works across themes, light/dark and responsive breakpoints",
                    "- API errors surfaced without losing form data",
                    "- Safety-critical actions require confirmation",
                    "- Navigation and RBAC-gated routes behave correctly",
                ]
            ),
            "negative": "\n".join(
                [
                    "- Hardcoded colours bypassing design tokens",
                    "- Status communicated by colour alone",
                    "- Client trusts frontend permissions without server enforcement",
                    "- Broken layout on tablet/mobile",
                ]
            ),
            "acceptance": "\n".join(
                [
                    "- Pages wired to API client",
                    "- TypeScript lint/build passes",
                    "- Matches approved UI patterns",
                ]
            ),
            "dod": "\n".join(
                [
                    "- `npm run build -w web` passes",
                    "- Manual smoke test documented",
                    "- Accessible labels/icons for status",
                ]
            ),
        },
        "MOB": {
            "summary": f"React Native (Expo) mobile flows for {module} with offline-safe behaviour.",
            "positive": "\n".join(
                [
                    "- Core workflow usable offline with queued sync",
                    "- Auth tokens stored securely",
                    "- Offline changes reconcile without data loss",
                    "- UI reflects connectivity state clearly",
                ]
            ),
            "negative": "\n".join(
                [
                    "- Authoritative data stored only in SQLite",
                    "- Sync overwrites newer local changes silently",
                    "- Crash on network loss mid-submit",
                ]
            ),
            "acceptance": "\n".join(
                [
                    "- Mobile screens implemented for sprint scope",
                    "- Offline queue + sync tested",
                    "- TypeScript lint passes",
                ]
            ),
            "dod": "\n".join(
                [
                    "- Expo app runs on iOS/Android simulator",
                    "- Offline scenario manually verified",
                    "- No secrets in mobile bundle",
                ]
            ),
        },
        "SP": {
            "summary": f"Sprint delivery unit covering end-to-end capability for {module}.",
            "positive": "\n".join(
                [
                    "- All child issues (DB/INF/BE/FE/MOB) completed",
                    "- End-to-end workflow demonstrated across web and API",
                    "- Regression suite passes for prior milestones",
                ]
            ),
            "negative": "\n".join(
                [
                    "- Partial delivery merged without integration proof",
                    "- Critical defects deferred without approval",
                    "- Cross-module regressions in permit lifecycle",
                ]
            ),
            "acceptance": "\n".join(
                [
                    "- Sprint objective met per Implementation Plan",
                    "- Demo recorded or documented",
                    "- Stakeholder sign-off captured",
                ]
            ),
            "dod": "\n".join(
                [
                    "- All child issues Done",
                    "- CI green on main",
                    "- Release notes updated",
                ]
            ),
        },
    }
    return contexts.get(layer or "BE", contexts["BE"])


def enrich_description(issue: Issue) -> str:
    ctx = layer_context(issue.layer, issue.title)
    sprint_num = sprint_number(issue.sprint_code)
    priority_value, priority_name = compute_priority(issue)
    existing = issue.description.strip()

    header = f"""## Issue summary

{ctx['summary']}

**Project:** {issue.project}
**Sprint:** {issue.sprint_code or 'Unassigned'} (Execution order: {sprint_num if sprint_num < 99 else 'TBD'})
**Layer:** {issue.layer or 'Cross-cutting'}
**Priority:** {priority_name} ({priority_value})

## Positive test cases

{ctx['positive']}

## Negative test cases

{ctx['negative']}

## Acceptance criteria

{ctx['acceptance']}

## Definition of Done

{ctx['dod']}
"""

    if existing:
        if "## Issue summary" in existing:
            return existing
        return f"{header}\n---\n\n## Existing notes\n\n{existing}"
    return header


def build_manifest(issues: list[Issue]) -> list[dict]:
    updates = []
    for issue in sorted(
        issues,
        key=lambda i: (
            0 if i.project == "great-ptw-loto-ai-app" else 1,
            sprint_number(i.sprint_code),
            LAYER_PRIORITY.get(i.layer or "BE", 3),
            i.title,
        ),
    ):
        priority_value, priority_name = compute_priority(issue)
        sprint_num = sprint_number(issue.sprint_code)
        sprint_label = f"ptw-s{sprint_num:02d}" if sprint_num < 99 else "Backlog"
        labels = list(issue.labels)
        updates.append(
            {
                "id": issue.id,
                "identifier": issue.identifier,
                "title": issue.title,
                "project": issue.project,
                "sprint_code": issue.sprint_code,
                "sprint_number": sprint_num if sprint_num < 99 else None,
                "sprint_label": sprint_label,
                "layer": issue.layer,
                "priority": priority_value,
                "priority_name": priority_name,
                "labels": labels,
                "description": enrich_description(issue),
                "github_issue": issue.github_issue,
                "linear_url": issue.url,
            }
        )
    return updates


def write_sprint_plan(updates: list[dict]) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ptw = [u for u in updates if u["project"] == "great-ptw-loto-ai-app"]
    lines = [
        "# PTW Sprint Plan",
        "",
        "Execution order based on milestone dependency and safety-critical path.",
        "",
        "| Sprint | Code | Parent issue | Priority layers |",
        "| --- | --- | --- | --- |",
    ]
    parents = {u["sprint_code"]: u for u in ptw if u["layer"] == "SP"}
    for idx, code in enumerate(PTW_SPRINT_ORDER, start=1):
        parent = parents.get(code)
        children = [u for u in ptw if u["sprint_code"] == code and u["layer"] != "SP"]
        layer_order = ", ".join(sorted({c["layer"] for c in children}, key=lambda x: LAYER_PRIORITY.get(x, 3)))
        parent_link = parent["linear_url"] if parent else "—"
        lines.append(f"| Sprint {idx} | {code} | {parent_link} | {layer_order or '—'} |")

    lines.extend(["", "## Sprint backlog", ""])
    for code in PTW_SPRINT_ORDER:
        sprint_idx = PTW_SPRINT_ORDER.index(code) + 1
        sprint_issues = [u for u in ptw if u["sprint_code"] == code]
        if not sprint_issues:
            continue
        lines.append(f"### Sprint {sprint_idx} — {code}")
        lines.append("")
        for u in sorted(sprint_issues, key=lambda x: (LAYER_PRIORITY.get(x["layer"] or "BE", 3), x["title"])):
            gh = f" (GitHub #{u['github_issue']})" if u["github_issue"] else ""
            lines.append(
                f"- **{u['priority_name']}** [{u['title']}]({u['linear_url']}){gh}"
            )
        lines.append("")

    (OUT_DIR / "SPRINT_PLAN.md").write_text("\n".join(lines) + "\n")

    for code in PTW_SPRINT_ORDER:
        sprint_idx = PTW_SPRINT_ORDER.index(code) + 1
        sprint_issues = [u for u in ptw if u["sprint_code"] == code]
        if not sprint_issues:
            continue
        body = [f"# Sprint {sprint_idx} — {code}", ""]
        for u in sorted(sprint_issues, key=lambda x: (LAYER_PRIORITY.get(x["layer"] or "BE", 3), x["title"])):
            body.append(f"## {u['title']}")
            body.append("")
            body.append(u["description"])
            body.append("")
        slug = code.lower().replace(".", "-")
        (OUT_DIR / f"{slug}.md").write_text("\n".join(body) + "\n")


def main() -> None:
    issues = load_issues()
    updates = build_manifest(issues)
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(updates, indent=2))
    write_sprint_plan(updates)
    print(f"Generated {len(updates)} issue updates")
    print(f"Manifest: {MANIFEST}")
    print(f"Sprint plan: {OUT_DIR / 'SPRINT_PLAN.md'}")


if __name__ == "__main__":
    main()
