# Issue tracker: Local Markdown

Issues and PRDs for this repo live as markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The PRD is `.scratch/<feature-slug>/PRD.md`
- Implementation issues are `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`
- Triage state is recorded as a `Status:` line near the top of each issue file (see `triage-labels.md` for the role strings)
- **Every issue MUST have a `Scope:` line** after `Type:`:
  - `fullstack` — one agent works backend + frontend together
  - `backend` — backend-only (Node services under `services/*`, API, tests)
  - `frontend` — frontend-only (`apps/operator-web` Next.js pages/components, or `apps/passenger-mobile` Flutter screens)
  - `parallel` — backend and frontend are independent and can be worked on concurrently by different agents
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/` (creating the directory if needed).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly.
