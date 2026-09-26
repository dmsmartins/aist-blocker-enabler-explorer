# Scale Run

An atmospheric, dependency-free Canvas exploration game at `play/`. Serve this repository with any static HTTP server and visit `/play/`. No build, backend, account, tracking or third-party game engine is required.

## Architecture

- `data.mjs` validates live `../data/explorer-data.json`, indexes authoritative relationships, detects strongly connected dependency components, and selects a seeded, diverse journey.
- `world-builder.mjs` creates a central hub, vertical spine and four reusable branching layouts with independently reachable capability routes. It validates reachability before play.
- `engine.mjs` owns fixed-step physics, checkpoints, individual capabilities, activation, source dependency support and progression. It has no browser dependency.
- `renderer.mjs` draws the soft atmospheric islands, eight blocker archetypes, mechanism transformations and the evolving luminous player.
- `input.mjs`, `audio.mjs`, `storage.mjs` isolate multi-input controls, optional generated sound and versioned progress reconciliation.
- `ui.mjs` presents verbatim knowledge, the map, recaps and exact Explorer links. `game.mjs` coordinates these pieces.

## Worlds, knowledge and play

The campaign preserves all 41 playable source blockers and 109 distinct linked enablers. Six Stage Gates now contain 27 regions (3 / 5 / 4 / 7 / 5 / 3). `world-design.mjs` controls game-only encounter ordering, internal complexity metadata, growing physical spans, landmarks and encounter signatures. These properties never modify the Explorer data or rank real-world blocker importance.

The first two encounters keep local capability gardens; later encounters distribute capabilities across regions. A world-level fixed-point validator checks that available passages and collectible tools can unlock every required region and blocker without prerequisite cycles. Generation then validates round-trip platform routes. All linked tools are still collected as a game convention, not a claim about necessary real-world interventions.

Worlds use distinct branch, loop and hub graphs. Physical vortex portals remain the only inter-region travel controls. Some entrances require an earlier encounter; opened blocker passages add shortcuts, favouring actual source dependency links when available. Gate 5 also gains adaptive support paths, and Gates 3–5 include forgiving moving spans with static alternatives. Broad checkpoints preserve pickups and reduce repeated traversal after falls. Gate 6 spreads three narrative handover signals through a quiet larger environment and requires all three before completing.

The world atlas opens with M or Map. The camera pulls out before the schematic overview appears. It shows the current region, known passages, sealed entrances and shortcuts. Only entered regions reveal their local platform topology and name; actual encounter and capability markers use stored discovery. Selecting a region inspects its map without moving the player. Frame temporarily reveals additional region outlines. Reduced-motion preferences suppress the camera transition and decorative motion.

Encounter signatures combine a muted accent, pulse and a small geometry with dot count. They repeat on the blocker, associated capabilities, discovered map markers and dependency traces. Mechanism family symbols and colours remain separate and unchanged. Discovery notices stay nonmodal at the bottom; delivery retains a short assembly and source explanation without next-step instructions or literal key icons.

## Controls and accessibility

Arrows / A / D move; Space / W / Up jump; Down / S drop; E use; Q cycle capabilities; 1–6 use abilities; T locate passages; K knowledge; M world atlas; P / Escape pause. Mobile thumb controls stay over the map in normal and fullscreen play, supporting simultaneous movement and jumping and sliding between direction arrows. Full screen uses native support or a viewport fallback; Escape exits. Music remains optional and pauses during reading or interruptions.

Existing discoveries, valid applied relationships, completion and preferences are retained. Region discovery uses a new layout namespace so old mini-map indexes do not reveal the new geography. Restart clears game progress but retains preferences. Storage failures allow continued play. Game state is separate from Explorer bookmarks and assessments.

## Validation

Run `node play/worlds.test.mjs` for the full campaign physics traversal through every region, capability collection, inter-region returns, all six exits, persistence and reset. Its pilot uses normal direction, jump, drop and physical portal activation. Unit placements are confined to separate isolated checks.

Run `node play/campaign.test.mjs` for source-linked abilities, closed portal collision, map discovery, moving spans and adaptive paths. Existing `engine.test.mjs`, `input.test.mjs`, `learning.test.mjs`, and `audio.test.mjs` retain legacy movement, touch cancellation, source correspondence, nonmodal learning and audio checks. The generator also validates multiple seeds and monotonically increasing internal encounter complexity. No source JSON is changed.
