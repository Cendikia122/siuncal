# Product

## Register

product

## Users

Transit operators and Dishub Bogor (Dinas Perhubungan) staff monitoring the angkot (shared minivan taxi) fleet in Bogor. They work from command centers or offices, often across multiple screens, tracking live GPS positions, reviewing public incident reports, managing sanctions, and responding to alerts in real time. Primary task on any screen: spot what needs attention and act on it fast.

## Product Purpose

Sentra Angkot is the operator-side fleet monitoring dashboard for Bogor's public transportation network. It exists to give Dishub operators full situational awareness: live vehicle positions, public incident reports, anomaly detection, driver compliance, and geofence alerts. Success means an operator can triage an incident and take action in under 30 seconds.

## Brand Personality

Tepercaya, Responsif, Awas (Trustworthy, Responsive, Alert)

Voice: direct, precise, no fluff. Labels are operational terms. Copy is terse and scannable. Timestamps and coordinates are always exact — never rounded or estimated in display.

## Anti-references

- **Google Analytics / Looker Studio**: too chart-heavy, hero-metric templates, rainbow palettes. This is an operational tool, not a BI report.
- **Generic SaaS admin templates (AdminLTE, Material Dashboard)**: template look, cluttered sidebar, icon-label repetition, padded whitespace that wastes density.
- **Consumer dark-mode apps (Instagram, Twitter dark)**: social metaphors, round avatars, engagement-optimized spacing — wrong register entirely.

## Design Principles

1. **Hierarchy of urgency**: Critical alerts and anomalies must be visually unmissable at a glance. Everything else defers to them.
2. **Precision earns trust**: Exact coordinates, exact timestamps, exact counts. Never approximate, never round for aesthetics.
3. **Density with breath**: Pack information tightly, but give each data group its own breathing room. Cramped equals confusion.
4. **Dark is intentional**: Operators monitor screens for long shifts, often in dim rooms. Dark theme reduces eye strain and makes status colors pop.
5. **Act, don't just inform**: Every screen should have a clear next action. Data without affordance is dead weight.

## Accessibility & Inclusion

WCAG AA minimum. Status colors (critical/warning/normal) must never rely on hue alone — pair with icon or label. Support keyboard navigation for all interactive elements. No reliance on animation to convey state.

## Problem Checklist

Use this section to track operator-web product problems as actionable checklist items.

- Add new problems as `- [ ] Problem title — short acceptance criteria`.
- When a problem in this file is completed, update its checkbox to `- [x]`.
- Keep completed items in place and add brief evidence after the item, such as test command, file change, or verification date.
