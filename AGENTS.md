# AGENTS.md

## GitHub CLI (`gh`) Tips

### Sub-issues API endpoints are asymmetric

- **Add**: `POST /repos/{owner}/{repo}/issues/{issue_number}/sub_issues` (plural)
- **Remove**: `DELETE /repos/{owner}/{repo}/issues/{issue_number}/sub_issue` (singular)

### Integer fields in JSON bodies

`gh api -f` sends everything as strings, which fails for integer fields.
Use `--input` with raw JSON instead:

```bash
echo '{"sub_issue_id":4858005874}' | gh api repos/OWNER/REPO/issues/31/sub_issues --method POST --input -
```

### A sub-issue can only have one parent

To move a sub-issue between parents, remove it from the current parent first:

```bash
echo '{"sub_issue_id":ID}' | gh api repos/OWNER/REPO/issues/PARENT/sub_issue --method DELETE --input -
```

### Multi-line issue bodies with special characters

Backticks and other shell-sensitive characters in `gh issue create --body` cause
zsh errors. Use a heredoc:

```bash
gh issue create --repo OWNER/REPO --title "Title" --body "$(cat <<'EOF'
Body content with `backticks` and $variables
EOF
)" --label "priority: high"
```

## Regenerate API types

When the backend OpenAPI spec changes, regenerate the typed client:

```
npm run gen:api-types
