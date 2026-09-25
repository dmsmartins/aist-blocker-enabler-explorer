# Scale Run

A dependency-free Canvas platformer served at `play/` on the existing GitHub Pages site.

Run the repository's static server and open `/play/`. No build step, backend, account, external engine, analytics or new data source is needed.

- `engine.mjs`: data selection, level layout, collisions, movement, collection and progression.
- `game.mjs`: input, Canvas rendering, UI, knowledge dialogs and local progress.
- `style.css`: responsive layout, touch controls and reduced-motion support.

The game reads `../data/explorer-data.json`, selecting up to three distinct blockers per Stage Gate and one valid linked enabler per blocker. Selection favours a variety of mechanisms and is deterministic for a given dataset. Text and relationship rationales are taken directly from that file; source IDs remain internal. The knowledge dialog links to the exact blocker–enabler connection in the Explorer.

Frame reveals a route, Commit connects it, Equip builds it, Assure protects it, Operate stabilises it, and Learn adapts it. These are visual game metaphors, not a scoring model or a claim of sufficient real-world mitigation. The barriers all require the specific linked enabler before the player can activate a crossing. Jumping alone cannot bypass them.

The current Gate 6 has no mapped blockers. Its three handover signals are explicitly illustrative and do not add invented blockers or enablers to the source data. If valid blockers are added to this gate, it automatically uses the same challenge-selection rules as the other gates.

Controls: arrows/A/D to move, Space/Up/W to jump, E to activate, P/Escape to pause. Multi-touch controls support holding movement and jumping together. Losing focus pauses play. Falling returns to a checkpoint without losing acquired enablers. Restart affects only the current run. `aistScaleRunProgressV1` stores completed gates locally, separate from the Explorer's bookmarks and maturity assessment. The game remains playable if browser storage is unavailable.

Game completion is not an AIST maturity or readiness assessment. No real blockers are marked resolved in the Explorer.

## Validation

Run `node play/engine.test.mjs` from the repository root. This simulates every level through normal inputs, checking that collectibles and exits are reachable without falls, barriers cannot be skipped without an enabler, checkpoint recovery preserves collected enablers, and every selected connection exists in the source dataset.
