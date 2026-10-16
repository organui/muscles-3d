# OrganUI Muscles development

This explorer follows organui/heart-3d, the reference explorer: keep `src/framing.ts` identical to its copies in the other explorers, and change shared tree behaviour upstream in the OrganUI registry, then reinstall.

- Work in this standalone repository. It has its own dependencies, configuration, and Git history. Keep the sibling OrganUI monorepo independent.
- Use Bun for dependency installation and scripts; commit the text lockfile.
- Favor a small, runnable application. Extract abstractions when actual repeated use justifies them.
- Use real anatomy assets whose redistribution terms have been checked. Record model provenance and attribution separately from the code license.
- Document which content and labels have been reviewed. Do not imply clinical validation or physiological accuracy that has not been established.
- Provide clear loading, unavailable-model, and WebGL failure states. Keep anatomy information reachable through ordinary interface controls.
- Before delivery, run the applicable build, type checks, and meaningful interaction checks. Inspect the actual 3D rendering in a browser on desktop and mobile layouts.
- Keep the README's status and run instructions consistent with what has actually been implemented and verified.
- `src/anatomy.ts` lists every muscle with its source STL files and their parts-list labels; `bun run prepare:model` refuses to run if a label differs from the pinned parts list. Regenerate the GLB rather than editing it.
