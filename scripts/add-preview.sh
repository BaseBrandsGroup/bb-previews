#!/usr/bin/env bash
# Add (or update) a client preview and publish it to GitHub Pages.
# Usage: scripts/add-preview.sh <slug> <file-or-folder> [more files...]
#   slug: lowercase-with-dashes, e.g. frequency-10k-gap
#   The first .html file becomes index.html if the folder has no index.html.
set -euo pipefail
cd "$(dirname "$0")/.."

slug="${1:-}"; shift || true
if [[ -z "$slug" || $# -eq 0 ]]; then
  echo "Usage: scripts/add-preview.sh <slug> <file-or-folder> [more files...]"; exit 1
fi
if [[ ! "$slug" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
  echo "Slug must be lowercase letters, numbers and dashes"; exit 1
fi

mkdir -p "$slug"
for src in "$@"; do
  if [[ -d "$src" ]]; then cp -R "$src"/. "$slug"/; else cp "$src" "$slug"/; fi
done

# Make sure there's an index.html
if [[ ! -f "$slug/index.html" ]]; then
  first=$(ls "$slug"/*.html 2>/dev/null | head -1 || true)
  [[ -n "$first" ]] && cp "$first" "$slug/index.html"
fi

# Keep every page out of search engines
for f in "$slug"/*.html; do
  [[ -f "$f" ]] || continue
  grep -q 'name="robots"' "$f" || perl -0pi -e 's#<head>#<head>\n<meta name="robots" content="noindex, nofollow">#i' "$f"
done

git add "$slug"
if git diff --cached --quiet; then echo "No changes to publish."; else
  git commit -m "Preview: $slug"
  # Use the GitHub token saved in Claude's settings if there is one (gh isn't needed)
  if [[ -n "${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ]]; then
    auth=$(printf 'x-access-token:%s' "$GITHUB_PERSONAL_ACCESS_TOKEN" | base64 | tr -d '\n')
    git -c http.extraheader="Authorization: Basic $auth" push
  else
    git push
  fi
fi

# Work out the GitHub account from the repo address, e.g. github.com/BaseBrandsGroup/bb-previews
owner=$(git remote get-url origin | sed -E 's#.*github\.com[:/]([^/]+)/.*#\1#' | tr '[:upper:]' '[:lower:]')
echo ""
echo "Live in 1-2 minutes at: https://$owner.github.io/bb-previews/$slug/"
