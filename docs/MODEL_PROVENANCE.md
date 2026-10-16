# Model provenance and preparation

## Exact source and terms

The runtime model is a curated subset of **BodyParts3D 3.0** (release 20110915, `BodyParts3D_3.0_obj_95`). The meshes were taken on **2026-10-16** from the binary STL conversions published in [Kevin-Mattheus-Moerman/BodyParts3D](https://github.com/Kevin-Mattheus-Moerman/BodyParts3D) at commit `f0eeb6e843380cfe6b83797cf8c3e1af74de5e61`, which converted the official OBJ release to STL without changing geometry and names each file by its FMA concept (four extensor carpi ulnaris files are named by BP ID).

That copy states the data license as **Creative Commons Attribution-Share Alike 2.1 Japan**, the license BodyParts3D originally carried. A snapshot of its license text is preserved in [model-source/mirror-LICENSE_content.txt](model-source/mirror-LICENSE_content.txt) (SHA-256 `0e26340c8fadac4a0478d23dd12f4cb20b4043c436d0ab95eacb062391a7ec84`). Required credit:

> BodyParts3D, © The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan.

`public/models/muscles.glb` is an adaptation of that data and is distributed under the same CC BY-SA 2.1 Japan license. The MIT code license does not cover the model or its screenshots.

### Why this source

The heart, brain, liver and kidney explorers use BodyParts3D 4.0 downloaded directly from the [official DBCLS archive](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html), whose current license page grants CC BY 4.0. The environment this explorer was built in could not reach that archive. The BodyParts3D 4.3 GitHub copy used by the lungs and pancreas explorers has none of the limb, back or abdominal wall muscles (it has the intercostals and some head and throat muscles, such as the eye, pharyngeal and soft-palate muscles), so this explorer uses the 3.0 STL copy, like the spleen and bladder explorers. Following the heart explorer's rule of relying on the terms attached to the copy actually downloaded, it uses the share-alike license.

Authoritative sources:

- [Official archive download page](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html) and [license page](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html)
- [STL copy used](https://github.com/Kevin-Mattheus-Moerman/BodyParts3D)
- Mitsuhashi et al. (2009), [doi:10.1093/nar/gkn613](https://doi.org/10.1093/nar/gkn613)

## What the model contains

177 structures from 428 source meshes, grouped in 15 regions. The regions are interface groupings for browsing, not anatomical containment.

| Region         | Structures | Source meshes | Source triangles | Runtime triangles |
| -------------- | ---------: | ------------: | ---------------: | ----------------: |
| Face and scalp |         20 |            40 |        1,075,136 |            12,866 |
| Chewing        |          4 |            12 |          285,254 |             3,626 |
| Neck           |         17 |            40 |          660,650 |            11,950 |
| Back           |         22 |            70 |        3,020,744 |            54,104 |
| Chest          |          9 |            18 |        3,171,522 |            69,748 |
| Abdomen        |          7 |            13 |        2,715,730 |            32,634 |
| Pelvic floor   |          5 |             9 |          142,130 |             2,302 |
| Shoulder       |          6 |            16 |          423,604 |             7,488 |
| Upper arm      |          5 |            16 |          445,806 |             8,898 |
| Forearm        |         19 |            46 |        1,536,542 |            17,906 |
| Hand           |         10 |            24 |          177,028 |             5,946 |
| Hip            |         12 |            24 |          721,182 |            15,672 |
| Thigh          |         14 |            30 |        1,584,462 |            30,440 |
| Lower leg      |         14 |            30 |        1,396,662 |            17,348 |
| Foot           |         13 |            40 |          406,686 |            10,796 |
| **Total**      |    **177** |       **428** |   **17,763,138** |       **301,724** |

Every source mesh, its parts-list label, its owning structure, its triangle counts and its SHA-256 are listed in [selected-parts.tsv](model-source/selected-parts.tsv). In `src/anatomy.ts` each structure lists its source files and their labels; the preparation script refuses to run if a label differs from the pinned parts list or a file is used twice or not at all.

Each structure combines the left and right muscle and, where the source splits a muscle into heads or parts (for example the clavicular, acromial and spinal parts of the deltoid, or the three heads of the triceps), all of them. A structure's FMA ID is the generic concept for the whole muscle when the parts list has one; for sets that it lists only by side or level (rotatores, interspinales, intertransversarii, levatores costarum, lumbricals and interossei) the details card says "Several FMA concepts". The external, internal and innermost intercostals are each one source mesh covering both sides.

Not included: bones, ligaments, fascia and most tendons (only the calcaneal tendon, the linea alba and the epicranial aponeurosis are shown), and muscles the 3.0 STL copy has no geometry for, among them the eye muscles and levator palpebrae, the auricular muscles, the tongue, palate, pharynx and larynx, the perineal muscles and the palmaris brevis. The model is an adult male reference, not a patient-specific or universal anatomy.

## Reproduce the runtime asset

The 5.6 MB `public/models/muscles.glb` is included in the checkout. Ordinary setup does not download any source files. To regenerate it:

```sh
bun install --frozen-lockfile
bun run prepare:model
bun run verify:model
```

The script downloads the pinned parts list and 428 STL files in [model-inputs.json](../scripts/model-inputs.json) (about 890 MB) into the ignored `.asset-cache/` only when they are absent, and checks every SHA-256 **before** conversion. The URLs name the mirror commit, and the hashes pin the content: if a file changes, preparation stops until the new data and its license are reviewed.

Steps:

1. Read the parts list and check each source file's label.
2. Read each binary STL, check its size against its triangle count, and weld vertices that share an exact position so the mesh is indexed.
3. Simplify each mesh with meshoptimizer 1.1.1 (`simplify`, `ErrorAbsolute`) so no surface moves more than **0.8 mm** from the source, keeping at least 240 triangles (or all of them, if fewer), then drop unused vertices. This reduces 17.8 million source triangles to about 302,000. The achieved error per mesh is in the manifest.
4. Merge each structure's simplified meshes. Center the whole selection on its source bounding box; transform `(x,y,z)` to `(x,z,-y)` and multiply by `0.004`. This is a display scale, not a measurement calibration. The exact center and bounds are in the manifest.
5. Recompute vertex normals and assign illustrative colors (pale for the three tendinous structures).
6. Store the stable structure ID, FMA ID and source files on each GLB node, export GLB, and write the input/output manifest.

`bun run verify:model` decodes the runtime, verifies its checksum, checks every structure's FMA and source list, ensures geometry is finite and indices are valid, and reports the geometry counts.

## Anatomy text and review

Descriptions are original one- or two-sentence summaries of each muscle's position and main action, informed by the US National Cancer Institute's [SEER Training muscular system pages](https://training.seer.cancer.gov/anatomy/muscular/) and standard anatomical texts, written on 2026-10-16. No third-party text or illustrations are redistributed.

Completed: source label checks, geometry inspection in the browser, and interface checks. **Not completed: review by a clinical anatomy expert.** The app, README and model dialog say so. This is an educational interface demonstration, not a diagnostic, treatment or measurement tool.
