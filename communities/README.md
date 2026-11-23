# Communities

`index.html` opens the same canvas and inspector as `../timeline/`, loading
`../timeline/app.js` and `../timeline/styles.css`. Its `data-explorer="community"`
attribute changes the first collection layer and filter label to Communities.
All blocker, mechanism, enabler, dependency and accessibility interactions remain
shared. Data comes from `../data/explorer-data.json`, generated from the Master workbook.

Choose an organic community group or the Community filter to retain that same group
and reveal its blocker cards directly below it. No Stage Gate-style community cards
are shown. Each member dot is also a keyboard-accessible shortcut to its blocker;
hover or focus identifies the blocker. Dependency lines carry moving dots while
keeping dashed dependency styling, and respect reduced-motion preferences.
Stakeholder intersects that membership. The counter reports matching blockers;
related blockers remain available as dependency context. An explicit empty state
allows the filters to be cleared. The critical-core visual treatment is retained.

Links support `#community=1`, optional `role`, and the same
`#blocker=1323&mech=assure` format as Timeline. Browser Back/Forward restores the
selection. The Timeline link preserves the active blocker and compatible role.
The main Explorer's `#communities` and legacy `#domains` entry points lead here
without a nested iframe or duplicate navigation header.

The former SVG renderer (`app.mjs` and its styles) and its utility modules are
retained for compatibility and reference; they are not loaded by this entry point.


Shared model checks:

```sh
node --test --test-isolation=none timeline/explore.test.mjs timeline/unlock.test.mjs communities/zoom.test.mjs
```

