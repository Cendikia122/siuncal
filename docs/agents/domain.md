# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

This is a **multi-context** monorepo. A `CONTEXT-MAP.md` at the repo root points at one `CONTEXT.md` per context.

## Before exploring, read these

- **`CONTEXT-MAP.md`** at the repo root — it points at one `CONTEXT.md` per context. Read each one relevant to the topic.
- The per-context **`CONTEXT.md`** for the area you're working in (see layout below).
- **`docs/adr/`** — system-wide architectural decisions. Read ADRs that touch the area you're about to work in.
- Context-scoped decisions under `<context>/docs/adr/` when present.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The producer skill (`/grill-with-docs`) creates them lazily when terms or decisions actually get resolved.

## File structure

Contexts in this repo map to the monorepo's apps and services:

```
/
├── CONTEXT-MAP.md                     ← points at each context's CONTEXT.md
├── docs/adr/                          ← system-wide decisions
├── apps/
│   ├── operator-web/                  ← Next.js operator dashboard (frontend)
│   │   ├── CONTEXT.md
│   │   └── docs/adr/                  ← context-specific decisions
│   └── passenger-mobile/              ← Flutter passenger app
│       ├── CONTEXT.md
│       └── docs/adr/
└── services/                          ← backend
    ├── api-gateway/
    │   ├── CONTEXT.md
    │   └── docs/adr/
    ├── telemetry-ingestion/
    │   ├── CONTEXT.md
    │   └── docs/adr/
    ├── rules-engine/
    │   ├── CONTEXT.md
    │   └── docs/adr/
    └── notification-service/
        ├── CONTEXT.md
        └── docs/adr/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in the relevant `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/grill-with-docs`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_
