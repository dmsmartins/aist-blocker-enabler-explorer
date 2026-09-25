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

`campaign.mjs` includes every blocker that has a valid enabling relationship, and every distinct enabler linked to it. The current source yields 41 blockers and 109 unique enablers across 16 mini-maps. These counts are derived, never required. Each mini-map contains at most three blockers, retaining readable platform layouts.

Entrances may require an earlier source dependency to be opened; when no suitable earlier dependency exists, an exploration gate requires one path in the preceding mini-map. Requirements only point to earlier rooms, so source cycles cannot lock their own tools. All linked tools are collected before applying E or a linked mechanism ability at a blocker. This is a game collection rule, not a claim that all source enablers are necessary in real organisations. The source remains unchanged.

Animated dark portals stand on landings beyond blocker passages. Their shields remain solid until the host blocker and entry requirements are open, including against traversal abilities. Use E next to an open portal to travel; T locates portals without teleporting. Every additional room has a return portal to the first room. The central portal finishes a Stage Gate after all its playable blockers are open. The source-empty final gate remains a narrative handover.

Discovery uses a visible exclamation mark and queued bottom-centre text without pausing. Delivery shows a short nonmodal key animation and the source rationale, with Read full connection available. Neither discovery nor delivery cards repeat next-step instructions. The persistent guide and Help explain the full loop.

Original procedural ambient music and effects are available through Music. They start only after user interaction and pause during reading, pausing or tab hiding. No external recordings or network audio are used.

Restart clears game progress, retains the same seed and sound/motion preferences, and starts at Stage Gate 1. Cancel preserves the current state. Progress from older short journeys retains valid discoveries; completion is reconciled against all newly included challenges.

## Controls and accessibility

Arrows / A / D move; Space / W / Up jump; Down / S drop through a platform; E use; Q cycle individual capabilities; 1–6 use abilities; T locates portals; K knowledge; M map; P / Escape pause. Touch controls support simultaneous movement and jumping. Coyote time, buffered jumps, safe checkpoints and return shortcuts make exploration forgiving. Blur and hidden-page events pause play and release held controls.

Dialogs manage focus; text status complements the canvas; reduced-motion preferences disable decorative movement. Sound is generated locally only after a user gesture and is off by default. `aistScaleRunProgressV2` stores source-validated progress separately from Explorer bookmarks and maturity responses. Valid v1 completed gates migrate. Corrupt or unavailable storage does not prevent play.

Game progress is not a readiness assessment, a ranking of blockers, or a claim that one real-world enabling action is sufficient. Sequential chapters are a game convention.

The six real mechanism families unlock game abilities: Frame reveals temporary steps; Commit dashes; Equip boosts jumps or adds an air jump; Assure glides; Operate sprints; Learn recalls to the central portal. A linked ability at a fully equipped blocker also activates its passage. Traversal abilities supplement the reachable base routes, so their absence cannot create a dead end.

## Validation

Run `node play/engine.test.mjs`, `node play/campaign.test.mjs`, `node play/input.test.mjs`, `node play/learning.test.mjs`, and `node play/audio.test.mjs`. The full-campaign test visits all 41 source blockers, collects all 109 distinct enablers through normal movement, crosses opened routes, passes every mini-map entrance and completes the epilogue, with progress restored between rooms. It also checks lock/reset behavior, actual ability physics and physical portal travel. The suite checks 60 seeded journeys, immutable source mappings, every offered alternative, individual capability matching, cyclic and missing dependencies, changed source data, Gate 6 with future blockers, corrupt/blocked storage, restoration and checkpoint recovery. A deterministic pilot completes all six chapters and visits every offered capability using normal fixed-step movement, jump and drop inputs, without changing player positions or requiring falls. Unit tests separately place a player at a node to isolate activation rules.

Browser QA covers the desktop and mobile layouts, map/help panels, focus, controls, reduced motion, source links and console errors. The renderer keeps a useful world scale on narrow displays instead of shrinking the entire level.

Full screen expands the game and its reading panels. The button exits it again; Escape also exits. A viewport-filling fallback is available when native fullscreen is unavailable.
