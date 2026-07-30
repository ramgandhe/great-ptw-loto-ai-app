#!/usr/bin/env python3
"""Apply enriched issue updates to Linear via GraphQL API.

Usage:
  export LINEAR_API_KEY=lin_api_...
  python3 scripts/apply-linear-updates.py

Reads: data/processed/linear-issue-updates.json
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

MANIFEST = Path(__file__).resolve().parent.parent / "data" / "processed" / "linear-issue-updates.json"
API_URL = "https://api.linear.app/graphql"

MUTATION = """
mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) {
  issueUpdate(id: $id, input: $input) {
    success
    issue { id identifier title }
  }
}
"""


def request(api_key: str, query: str, variables: dict) -> dict:
    payload = json.dumps({"query": query, "variables": variables}).encode()
    req = urllib.request.Request(
        API_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": api_key,
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        body = json.loads(resp.read().decode())
    if body.get("errors"):
        raise RuntimeError(json.dumps(body["errors"], indent=2))
    return body["data"]


def main() -> int:
    api_key = os.environ.get("LINEAR_API_KEY", "").strip()
    if not api_key:
        print("Set LINEAR_API_KEY (Linear → Settings → API → Personal API keys)", file=sys.stderr)
        return 1

    updates = json.loads(MANIFEST.read_text())
    ok = 0
    failed: list[str] = []

    for entry in updates:
        issue_id = entry["id"]
        input_payload = {
            "description": entry["description"],
            "priority": entry["priority"],
        }
        try:
            data = request(api_key, MUTATION, {"id": issue_id, "input": input_payload})
            if not data["issueUpdate"]["success"]:
                failed.append(f"{issue_id}: update returned success=false")
                continue
            ok += 1
            print(f"OK {issue_id} — {entry['title'][:60]}")
            time.sleep(0.15)
        except (urllib.error.HTTPError, RuntimeError, KeyError) as exc:
            failed.append(f"{issue_id}: {exc}")

    print(f"\nUpdated {ok}/{len(updates)} issues")
    if failed:
        print("Failures:")
        for line in failed:
            print(" ", line)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
