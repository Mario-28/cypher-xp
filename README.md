# Cypher XP (v1.12.0 — Foundry v14+)

GM-approved Development Track advancement module for the Cypher System, with
Cypher Taskbar and Cypher GM Taskbar integration.

## New in v1.12.0 — Combined Party Charts in the GM Dashboard

The GM Dashboard gains a **Chart** tab in first position (before Party), and
unlike the player-side charts these are **combined — every actor on the same
chart**, aggregated from all player-owned PCs' transaction ledgers:

- **Party stat cards:** Party Current XP, Total Earned, From GM Intrusions,
  Spent on Development, Spent on Immediate, Spent on Player Intrusions.
- **Party XP Gained per Session** — all actors' earnings summed per date.
- **Per-Actor Comparison** — the centerpiece: a grouped bar chart with every
  actor side by side, four colored series each (XP Earned, From Intrusions,
  Spent on Development, Spent on Immediate) plus a legend. One glance shows
  who is earning, who is spending, and who is hoarding.
- **Development Progress per Actor** — lifetime Progress per character.
- **Party Development Progress per Session** — combined Progress per date.
- **Party Development Spending by Category** — one donut for the whole party
  (skills / core / abilities / assets) with legend and percentages.
- **Party Sessions table** — per-date earned, spent, net, Progress,
  intrusion XP, and immediate spending across the whole party.

The Chart tab is the dashboard's default view. Empty states cover "no PCs"
and "no activity yet" separately.

## Carried over

- v1.11.0: player Chart tab with per-session tracking, category donut,
  session table, and the Log Immediate Spend button + `api.logSpend` /
  `cypher-xp.logSpend` hook for other modules.
- v1.10.0: player-side launcher button with flyout, status readout, badges.
- v1.9.1: floating rules button in the top-right corner of module windows.
- v1.9.0: Experience Rules panel with parchment formatting.
- v1.8.0: fancy hover tooltips on every Develop tab listing.
- v1.7.2: both-axis overflow detection with themed sliders.
- v1.7.0: native Skill/Ability Item automation on approval.
- v1.6.0: draggable, position-persistent icons.
- v1.5.0: full debug pass.

## Install

Extract the ZIP into `FoundryVTT/Data/modules/` so the folder is
`Data/modules/cypher-xp/` (no version suffix), restart Foundry, enable
"Cypher XP" in Manage Modules, and reload the world.
