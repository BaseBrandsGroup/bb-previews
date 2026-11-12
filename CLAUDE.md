# bb-previews (Base Brands client preview hosting)

This repo hosts temporary previews of client pages (landing pages, calculators, funnels) on GitHub Pages so clients can approve them before they're built in Growth Engine (GHL).

## Rules
- One folder per client project, named `<client>-<project>` in lowercase with dashes (e.g. `frequency-10k-gap`).
- Each folder needs an `index.html`; that's the page the client opens.
- Every HTML page must have `<meta name="robots" content="noindex, nofollow">`. `robots.txt` blocks crawlers too. The root `index.html` stays a plain "use the link you were sent" page and must never list clients.
- The site is public to anyone with the link. Never commit client data, passwords, API keys, webhook URLs or anything that submits real form data.
- Remove a client's folder once their page is live in GHL.

## First-time setup (done 2026-11-11)
Already set up: repo `BaseBrandsGroup/bb-previews`, Pages live at https://basebrandsgroup.github.io/bb-previews/. `gh` is not installed on this Mac; GitHub access uses the `GITHUB_PERSONAL_ACCESS_TOKEN` from Claude's settings (the steps below were done through the GitHub API with that token instead).

1. `gh auth status` must show a logged-in account. If not, ask the user to run `gh auth login`.
2. From this folder: `git init -b main && git add . && git commit -m "Set up previews site"`
3. `gh repo create bb-previews --public --source=. --remote=origin --push`
4. Turn on Pages: `gh api -X POST repos/{owner}/bb-previews/pages -f "source[branch]=main" -f "source[path]=/"` (replace `{owner}` with the login from `gh api user -q .login`). If it says Pages already exists, that's fine.
5. Check: `gh api repos/{owner}/bb-previews/pages -q .html_url`, then give the user the preview link for each client folder: `https://<owner>.github.io/bb-previews/<folder>/`

## Adding or updating a preview
`scripts/add-preview.sh <slug> <file-or-folder> [more files...]`

It needs no `gh`: it pushes with `GITHUB_PERSONAL_ACCESS_TOKEN` if set, otherwise plain `git push`. It copies the files into the slug folder, adds `index.html` if missing, adds the noindex tag, commits, pushes and prints the link. Pages takes 1-2 minutes to update after a push.

## Password-locked previews
For anything that shouldn't be open to anyone with the link (scripts, unreleased graphics, client photos), lock the page:

`node tools/lock-preview.mjs <slug> <unlocked-page.html> "Client name" "subtitle"`

- It encrypts the whole page (AES-256-GCM, key from the password via PBKDF2) and writes `<slug>/index.html`. Embed images in the page as data URIs, so they're locked too; separate image files in the folder would be public.
- Passwords and salts live in `../bb-previews-private/previews.json`, outside the repo. Never commit them or print a password unless Fee asks.
- Re-running the command for the same slug keeps the same password.
- `assets/` holds the Base Brands logo and fonts used by the password page and branded hubs.
- First locked preview: `rb-reclaim-launch` (Recalibrated Bodies campaign hub, 2026-11-12).
