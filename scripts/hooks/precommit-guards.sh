#!/usr/bin/env bash
set -euo pipefail

if ! command -v git >/dev/null 2>&1; then
  echo "precommit guards: git is required."
  exit 1
fi

staged_files=()
while IFS= read -r file; do
  staged_files+=("$file")
done < <(git diff --cached --name-only --diff-filter=ACMR)

if ((${#staged_files[@]} == 0)); then
  exit 0
fi

echo "precommit guards: checking staged diff quality..."

if ! git diff --cached --check; then
  echo
  echo "precommit guards: fix whitespace issues or conflict markers above."
  exit 1
fi

tmp_conflicts="$(mktemp)"
tmp_secrets="$(mktemp)"
trap 'rm -f "$tmp_conflicts" "$tmp_secrets"' EXIT

if git grep --cached -n -E '^(<<<<<<<|=======|>>>>>>>)' -- "${staged_files[@]}" >"$tmp_conflicts"; then
  echo
  echo "precommit guards: unresolved merge markers found in staged files:"
  cat "$tmp_conflicts"
  exit 1
fi

if git grep --cached -n -E 'BEGIN [A-Z ]*PRIVATE KEY|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|xox[baprs]-[A-Za-z0-9-]{10,}' -- "${staged_files[@]}" >"$tmp_secrets"; then
  echo
  echo "precommit guards: possible secret-like content found in staged files:"
  cat "$tmp_secrets"
  echo
  echo "If this is intentional, remove or mask sensitive values before committing."
  exit 1
fi

echo "precommit guards: passed."
