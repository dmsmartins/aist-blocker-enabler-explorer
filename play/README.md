# Scale Run

An atmospheric, dependency-free Canvas exploration game at `play/`. Serve this repository with any static HTTP server and visit `/play/`. No build, backend, account, tracking or third-party game engine is required.

## Architecture

- `data.mjs` validates live `../data/explorer-data.json`, indexes authoritative relationships, detects strongly connected dependency components, and selects a seeded, diverse journey.
- `world-builder.mjs` creates a central hub, vertical spine and four reusable branching layouts with independently reachable capability routes. It validates reachability before play.
- `engine.mjs` owns fixed-step physics, checkpoints, individual capabilities, activation, source dependency support and progression. It has no browser dependency.
- `renderer.mjs` draws the soft atmospheric islands, eight blocker archetypes, mechanism transformations and the evolving luminous player.
- `input.mjs`, `audio.mjs`, `storage.mjs` isolate multi-input controls, optional generated sound and versioned progress reconciliation.
- `ui.mjs` presents verbatim knowledge, the map, recaps and exact Explorer links. `game.mjs` coordinates these pieces.

## Knowledge and play

The source remains unchanged. Larger gates offer four or five selected blockers; smaller gates include all eligible blockers. Each encounter offers up to three distinct linked enablers, favouring different mechanism families. The complete source relationship set is available in the knowledge panel. A capability can activate a challenge only when that exact enabler is linked to it. Matching a mechanism alone is insufficient.

Frame reveals, Commit connects, Equip builds, Assure protects, Operate stabilises, and Learn adapts. Each changes the crossing visually and geometrically. Source dependencies produce local supporting routes and visible connections, including support carried from earlier chapters. Cycles are nonlocking dependency knots; nonselected source blockers appear as echoes. Opening one challenge never automatically opens another.

The current final gate has no mapped blockers. Its handover signals are explicitly narrative metaphors. Adding valid source challenges automatically replaces the narrative fallback with normal encounters. No specific blocker or enabler ID is required. A new seed after completion offers another journey.

The luminous sphere acquires geometry as mechanism families are discovered, gradually echoing the Explorer logo. The official Stage Gate labels remain visible alongside artistic aliases defined in `config.mjs`.

Restart is available in the game header, including on mobile. After confirmation it returns to Stage Gate 1, clears only Scale Run progress and keeps the same challenges and sound/motion preferences. Cancelling resumes the previous state. The ending also offers a new seeded path.

## Controls and accessibility

Arrows / A / D move; Space / W / Up jump; Down / S drop through a platform; E use; Q cycle individual capabilities; 1–6 open a mechanism family; K knowledge; M map; P / Escape pause. Touch controls support simultaneous movement and jumping. Coyote time, buffered jumps, safe checkpoints and return shortcuts make exploration forgiving. Blur and hidden-page events pause play and release held controls.

Dialogs manage focus; text status complements the canvas; reduced-motion preferences disable decorative movement. Sound is generated locally only after a user gesture and is off by default. `aistScaleRunProgressV2` stores source-validated progress separately from Explorer bookmarks and maturity responses. Valid v1 completed gates migrate. Corrupt or unavailable storage does not prevent play.

Game progress is not a readiness assessment, a ranking of blockers, or a claim that one real-world enabling action is sufficient. Sequential chapters are a game convention.

## Validation

Run `node play/engine.test.mjs` and `node play/input.test.mjs`. The suite checks 60 seeded journeys, immutable source mappings, every offered alternative, individual capability matching, cyclic and missing dependencies, changed source data, Gate 6 with future blockers, corrupt/blocked storage, restoration and checkpoint recovery. A deterministic pilot completes all six chapters and visits every offered capability using normal fixed-step movement, jump and drop inputs, without changing player positions or requiring falls. Unit tests separately place a player at a node to isolate activation rules.

Browser QA covers the desktop and mobile layouts, map/help panels, focus, controls, reduced motion, source links and console errors. The renderer keeps a useful world scale on narrow displays instead of shrinking the entire level.
