# Cypher XP (v1.5.0 — Foundry v14+)

GM-approved Development Track advancement module for the Cypher System, with
Cypher Taskbar and Cypher GM Taskbar integration.

## v1.5.0 — Full Debug Pass

Bugs and problems found in review, and their fixes:

1. **Missing Handlebars helpers.** Templates used `eq`/`gt`, which are not
   guaranteed in Foundry core. Safe fallbacks are now registered at init,
   only when not already present. Without this, tab content could fail to
   render entirely.
2. **GM icon invisible (root cause).** The integration required a guessed
   GM Taskbar root selector that matched nothing (confirmed by live
   diagnostics: `containerSelectorMatches: 0`). The launcher now scans the
   whole document for the Actor Visibility control, re-attaches via a
   throttled MutationObserver when the taskbar (re)renders, and falls back
   to a visible floating launcher instead of silently failing.
3. **Declared rules never enforced.** `oncePerTier` (Edge, Effort, off-list
   ability) and `maxTimes` (recovery improvement, 2 per career) existed in
   the catalog but were never checked. Now enforced at submission, including
   blocking duplicate pending requests for the same once-per-tier category.
4. **No XP affordability checks.** Players could stack pending requests
   exceeding their XP, and approval never re-checked. Submission now blocks
   when pending + new cost exceeds available XP; approval aborts with an
   error if the actor no longer has enough XP.
5. **Pool increase applied all +4 to one Pool.** Replaced with a proper
   distribution dialog (Might/Speed/Intellect/Additional, must total 4).
6. **Tier auto-advanced on approval without GM consent.** Approval now only
   flags "Tier Ready"; the GM clicks Advance on the dashboard and picks a
   Breakthrough Benefit. Hardened Potential applies +2 to the chosen Pool.
7. **Permanent assets were ledger-only.** They are now stored in a dedicated
   assets list with improvement history, shown in a new Assets tab.
8. **Duplicate windows.** Repeated clicks opened duplicate app instances;
   both apps are now singletons that focus the existing window.
9. **Stale UI.** Open windows now re-render on relevant `updateActor` events
   and clean up their hooks on close. The player widget re-attaches when a
   character is assigned after load (`updateUser` hook).
10. **Unthrottled MutationObserver.** Scans are throttled to 500ms.
11. **Fragmented hotfix CSS.** Merged into a single `styles/cypher-xp.css`;
    the manifest loads exactly one stylesheet.

## Still Pending (by design)

- Skill/Ability purchases are ledger-tracked; native embedded Item creation
  awaits confirmation of the Cypher System's Skill/Ability Item schema.
- Instant (non-polling) taskbar attachment requires the taskbar modules to
  fire `cypherTaskbar.rendered` / `cypherGmTaskbar.rendered` hooks; without
  them, the observer fallback handles attachment automatically.
- GM Intrusion recording requires `cypherGmTaskbar.intrusionAccepted` /
  `cypherGmTaskbar.intrusionRefused` hooks from the GM Taskbar.

## Confirmed Cypher System Fields Used

```
system.basic.xp
system.basic.tier
system.basic.effort
system.pools.<might|speed|intellect|additional>.value
system.pools.<...>.max
system.pools.<...>.edge
system.combat.recoveries.roll
system.combat.armor.costTotal
```

Never writes to `system.basic.advancement` (the system's native tracker).

## Install

Extract the ZIP into `FoundryVTT/Data/modules/` so the folder is
`Data/modules/cypher-xp/` (no version suffix), restart Foundry, enable
"Cypher XP" in Manage Modules, and reload the world.
