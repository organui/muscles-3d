# Anatomy-tree registry integration

The anatomy panel uses the OrganUI registry item `anatomy-tree`, installed with the shadcn CLI. The installed source is tracked in version control; runtime and ordinary setup never contact a registry.

## Exact installation

Installed on 2026-10-16:

```sh
REGISTRY_URL=http://127.0.0.1:4412 bunx shadcn@4.21.0 add http://127.0.0.1:4412/anatomy-tree.json -y -o
```

The build sandbox's network policy blocked `organui.com` and `ui.shadcn.com`. The item was therefore served from a local static server (`python3 -m http.server 4412`) holding the registry output built with `bun run build` in `packages/registry` of the OrganUI repository at `master` commit **42dc34f** (organui PR #12, merged), plus shadcn's `colors/neutral.json` fetched from the shadcn GitHub repository. The built item is byte-identical to the one the heart explorer installed, and the CLI reported the tracked file as identical. With network access, the equivalent public command is `bunx shadcn@4.21.0 add https://organui.com/r/anatomy-tree.json -y -o`.

| Artifact                                     | SHA-256                                                            |
| -------------------------------------------- | ------------------------------------------------------------------ |
| Served `anatomy-tree.json`                   | `719c1547afb1453e809ee1b2fca0dc99858083aa3ff712477a493c77e8f5f389` |
| Embedded `files[0].content`                  | `14709d69270066ebb4677e736d71fa59c2ec9cf9c1f0e1a6a8236795633944cd` |
| Tracked `src/components/ui/anatomy-tree.tsx` | `3d5554cdc179f1ad778fd6321cc1414c293c4cca0535efd9aab679c686893538` |

The item declares `@base-ui/react@^1.8.0`. The CLI wrote `^1.8.0` to `package.json`; it was changed back to the exact `1.8.0` to match this repository's exact pins, and `bun install` left the text `bun.lock` unchanged. Tailwind CSS and `@tailwindcss/vite` are pinned at 4.1.18, matching the other explorers.

## Installed-source differences

The only difference from the published source is that the CLI removed the `"use client"` directive (and the blank line after it) for this non-RSC Vite target (`components.json` sets `"rsc": false`). No behaviour, markup, API, state, or class names changed. The file is listed in `.prettierignore` and must not be hand-edited, so its checksum stays verifiable. The consumer was set up before installing (`components.json`, `@/* -> src/*` alias in `tsconfig.json` and `vite.config.ts`, Tailwind 4 in `src/styles.css`), so the file landed in `src/components/ui/` directly.

## API used

- `data`: fifteen region rows (`selectable: false`), each with its muscle leaves (`color` set to the structure's mesh colour);
- `selectedId` / `onSelectionChange`: the app's single controlled selection;
- `visibility` / `onVisibilityChange`: a map keyed by leaf IDs, where a missing entry means visible;
- `defaultExpandedIds`: none. With 177 muscles the tree opens as a list of regions; a selection made in 3D or by the tour expands its region through the component's reveal;
- `label="Muscle anatomy"` and `className="registry-tree"`.

Search and expansion stay internal to the component. The component's built-in reveal expands a collapsed group and scrolls the row into view when the selection changes to a row that is not shown, for example after a 3D pick or a tour step.

## Application adapter

Scene-specific logic lives in `src/anatomy-adapter.ts`, built from the existing `structures` and `groups` in `src/anatomy.ts`:

| Tree ID                | Scene leaves (GLB `structureId`)                                                  |
| ---------------------- | --------------------------------------------------------------------------------- |
| `group-face-and-scalp` | 20 facial and scalp muscles, from `frontalis` to `mentalis`                       |
| `group-chewing`        | `masseter`, `temporalis`, `medial-pterygoid`, `lateral-pterygoid`                 |
| `group-neck`           | 17 muscles, from `platysma` to `rectus-capitis-lateralis`                         |
| `group-back`           | 22 muscles, from `trapezius` to the suboccipital muscles                          |
| `group-chest`          | 9 muscles, including the intercostals and `diaphragm`                             |
| `group-abdomen`        | 7 structures, including `linea-alba` and `quadratus-lumborum`                     |
| `group-pelvic-floor`   | the three parts of the levator ani, `coccygeus`, `external-anal-sphincter`        |
| `group-shoulder`       | `deltoid` and the five scapular muscles                                           |
| `group-upper-arm`      | `biceps-brachii`, `brachialis`, `coracobrachialis`, `triceps-brachii`, `anconeus` |
| `group-forearm`        | 19 flexors, extensors, pronators and the supinator                                |
| `group-hand`           | 10 thenar, hypothenar, lumbrical and interosseous structures                      |
| `group-hip`            | 12 muscles, from `iliacus` to `obturator-externus`                                |
| `group-thigh`          | 14 muscles: quadriceps, adductors, hamstrings, `sartorius`, `gracilis`            |
| `group-lower-leg`      | 14 structures, including `calcaneal-tendon`                                       |
| `group-foot`           | 13 intrinsic foot muscles                                                         |

Regions are interface groupings only and do not claim anatomical containment. Every leaf ID is exactly one application structure ID and one GLB node.

Leaves carry `color` from `structures` in `src/anatomy.ts`, the same value the renderer applies to the mesh material; group rows set `selectable: false`. The adapter provides `anatomyTree`, `sceneIdsForNode`, `normalizeVisibility`, `visibilityFromHidden` / `hiddenFromVisibility` (the app keeps its existing `hidden` set and converts at the boundary), `isStructureId`, and `assertAnatomyMapping`, which runs at import and throws on missing, unknown, or duplicate leaves. `src/anatomy-adapter.test.ts` covers these with `bun test`.

## Decisions

- **Group rows do not select.** The renderer's emphasis, the details card, and the selection chip all describe exactly one structure, so multi-structure selection would not fit cleanly. Group rows are `selectable: false`: clicking the label or pressing Enter expands or collapses them, they carry no `aria-selected`, and the selection is unchanged. They still toggle the visibility of all their structures (showing `Mixed` when partly hidden). `onSelectionChange` keeps only a one-line guard that ignores IDs that are not structures.
- **Colour swatches**: each structure row shows the component's swatch in the structure's mesh colour, matching the 3D model.
- **Visibility** stays the app's `hidden` set. Tree changes, the detail-card Hide/Show, Isolate, Restore all, the guided tour, and Reset all write that one set.
- **Reset** increments the tree's React `key`, remounting it to clear its internal search and expansion along with selection, visibility, tour, and camera.
- **Search** matches row labels only (the component's behaviour). FMA IDs remain visible in the details card. Search is not cleared on 3D selection or tour steps, because the component does not expose its query; Reset clears it.
- **Hidden structures are not pickable.** `src/picking.ts` already ignores intersections with invisible meshes or their descendants, so hidden foreground anatomy neither selects itself nor blocks visible surfaces behind it. Hidden structures remain selectable through the tree.
- **Reveal**: the component's reveal handles selection changes. One narrow app effect remains: when the panel opens, the app scrolls an already-selected row into the tree's own scroll area. A selection made while the panel is closed happens while the tree is `display: none`, so the component's reveal has nothing to scroll then and does not run again on open. This effect only adjusts the tree's `scrollTop` and never moves the page.
- **Camera, beyond the heart explorer:** a whole body needs panning and close zoom, so both are on; panning, like rotating, changes the view label to "Custom view". Named views frame the whole body with the shared `fitDistance` rule; **Zoom to** and tour stops apply the same rule to one structure's points.
- Unchanged: selected structure glows in its colour at 0.35 emissive with others ghosted; clicking a structure does not change the view label to "Custom view"; panel closed by default and opened from the header; focus moves into the panel and returns to the toggle on Escape/close; chip name opens the panel; toolbar order is view menu, zoom in, zoom out, reset. `src/framing.ts` was not touched.

## Theme setup

`src/styles.css` imports Tailwind CSS 4 and defines shadcn tokens (`--background`, `--foreground`, `--muted`, `--muted-foreground`, `--accent`, `--border`, `--input`, `--ring`) from the explorer's existing warm neutral palette. The app's own muted text colour was renamed from `--muted` to `--muted-ink` because shadcn uses `--muted` as a background colour.

As in the kidney explorer, the app's global resets moved into `@layer base` after Tailwind preflight, so registry utility classes still win. Preflight changes that would otherwise alter the rest of the app are reverted in that layer: `html` line-height `normal`, heading size/weight and `dialog` margin reverted to browser defaults, and `svg` back to inline display. Closed-panel, selection-chip, and About-dialog screenshots are pixel-identical to the build before this change. Unlayered `.registry-tree` rules fit the component into the panel: no card frame, the previous search-field look with a search glyph, the previous row and hover tints, pill-shaped visibility buttons (dashed when hidden or mixed), and an internally scrolling row area.

## Friction and observations

No registry defect blocked the integration and the component was not modified. Resolved by organui PR #12: group rows no longer need app-side handling of group selection callbacks (`selectable: false`), colour dots are available again (`color`), and remount/scroll workarounds for revealing a selection are no longer needed (built-in reveal).

1. The CLI loosened the exact dependency pin to `^1.8.0`; consumers with exact pins need to restore them.
2. Search and expansion are internal. Clearing them needs a remount (Reset does this). A selection hidden by an active search query is not revealed, because reveal only expands ancestors.
3. The search box has no placeholder or icon prop, so the visible label and the CSS search glyph carry that role.
4. Resolved upstream in organui PR #12 commit b8e6451: the built-in reveal now scrolls only the tree's own scrolling container, so a 3D pick on a phone no longer jumps the page down to the tree. On phones the panel sits below the model, so the revealed row is in view once the user scrolls to the panel.
5. Reveal runs only when `selectedId` changes, so a selection made while the tree is hidden is not scrolled into view when it is shown again (see Reveal above).

Screen-reader testing of the tree was not done.
