<!--
SPDX-FileCopyrightText: 2026 André Fiedler
SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Architecture

PCB Styler supports KiCad and Altium as first-class board sources. Direct
KiCad `.kicad_pcb` files, direct Altium `.PcbDoc` files, ZIP archives
containing either board format, and PCB Styler project ZIP archives all enter
the same local browser pipeline.

## Runtime Modules

- `src/index.html`: static app shell with left setup sidebar, center viewer, right annotation/export sidebar, imprint footer, import map, and DOM anchors.
- `src/main.mjs`: bootstrap and dependency wiring.
- `src/AppController.mjs`: file loading, state updates, side switching, hovered component lookup, and export actions.
- `src/core/BoardFileLoader.mjs`: format-aware board loading for direct files and ZIP-contained boards.
- `src/core/AppState.mjs`: normalized state container with subscriptions.
- `kicad-toolkit`: KiCad S-expression parsing, board model extraction, direct `.kicad_pcb` and `.zip` loading, geometry helpers, stroke-font primitives, and base SVG rendering.
- `altium-toolkit`: Altium `.PcbDoc` parsing and deterministic PCB SVG rendering.
- `src/integrations/WebMcpBridge.mjs`: feature-detected early WebMCP tool registration.
- `src/ui/BadgeControls.mjs`: badge list, style controls, and SVG drag handling.
- `src/ui/BoardSvgRenderer.mjs`: format-aware renderer routing for KiCad and Altium PCB models.
- `src/ui/PcbSvgRendererDecorator.mjs`: shared app-owned SVG decoration pipeline for render palette styling, component highlights, badge overlays, and SVG attribute helpers.
- `src/ui/KicadPcbSvgRenderer.mjs` and `src/ui/AltiumPcbSvgRenderer.mjs`: thin format-specific wrappers that call toolkit `PcbSvgRenderer` implementations and provide class mappings, component geometry, and insertion points to the shared decorator.
- `src/ui/AppView.mjs`: DOM binding, status updates, fixed hovered component information, and SVG/PNG/project ZIP downloads.
- `src/server.mjs`: local static server, dependency serving, and metadata endpoints.
- `src/ServerAssetVersioner.mjs`: static asset URL rewriting for deploy artifacts.
- `src/StaticDeployBuilder.mjs`: Apache/shared-hosting artifact builder.
- `scripts/build-static-deploy.mjs`: CLI wrapper that writes `.deploy-src/`.
- `api/app-meta.php`: PHP fallback for deployed app version metadata.

## Data Flow

1. The user opens or drops files.
2. `AppView` passes the file list to `AppController`.
3. `BoardFileLoader` reads browser `File` objects into named byte entries, routes direct `.PcbDoc` files to `altium-toolkit`, extracts PCB Styler project settings with the app-local `ProjectArchive`, routes KiCad files and KiCad project ZIPs to `kicad-toolkit`, and falls back to `.PcbDoc` entries inside ZIP archives when no KiCad board is present.
4. `KicadProjectLoader` from `kicad-toolkit` reads either a direct `.kicad_pcb` file or the first board entry inside a `.zip`.
5. `AltiumParser` from `altium-toolkit/parser` reads Altium `.PcbDoc` bytes from direct files or ZIP entries and returns the normalized Altium PCB model.
6. `AppState` stores the active board, text or binary board source, source filename and format, selected side, render preset, render layer styles, highlighted footprints, hover footprint, highlight color, badges, badge style, and status.
7. `BoardSvgRenderer` routes KiCad models to the app-local `KicadPcbSvgRenderer`, which calls `kicad-toolkit`'s base `PcbSvgRenderer`, and routes Altium models to the app-local `AltiumPcbSvgRenderer`, which calls `altium-toolkit`'s base `PcbSvgRenderer`; both wrappers then pass toolkit SVG output through `PcbSvgRendererDecorator` with format-specific class and geometry adapters.
8. `AppController` derives compact hovered component information from the active board and hover footprint id, then `AppView` inserts the SVG, delegates component click/hover events from shared footprint hit areas, renders the right-sidebar hover info panel, converts badge drags to board coordinates, updates the footer version node, and handles SVG/transparent-PNG/project ZIP download creation.
9. `WebMcpBridge` registers agent-facing tools against `navigator.modelContext` when the early WebMCP API is available; tools call public controller methods that reuse the same state updates as UI actions.

## Rendering Model

The KiCad toolkit renderer keeps KiCad millimeter coordinates in SVG viewBox space. KiCad's positive Y direction matches SVG's positive Y direction, so the front view can preserve board orientation without flipping. The back view mirrors the complete scene horizontally around the board center to match KiCad backside exports. Front footprint-local pads, text, and drawings use the footprint `at` position and rotation directly. Back footprint-local coordinates use KiCad's mirrored bottom-side transform, so local geometry rotates opposite the footprint angle before the side-level render transform is applied. Text parsing also preserves KiCad left/right/top/bottom justification so labels are anchored at their source `at` point. Copper tracks, vias, and filled zone polygons are parsed as board-level primitives and layered below pads and text. The KiCad toolkit SVG carries layer, material, and pad metadata. The KiCad wrapper supplies SVG class rules, footprint hit-area geometry, and the optional KiCad preview preset to the shared decorator, which applies custom layer styling, selected and hovered component highlights, and badge overlays inside the toolkit-rendered scene.

Altium rendering uses `altium-toolkit`'s recovered `.PcbDoc` model and
deterministic top-facing PCB SVG renderer as the base markup. The app-local
Altium renderer scopes that output under `.altium-output`, applies the shared
render palette to recovered board, copper, pad, via, pad drill, via drill, and
component classes through the same shared decorator used by KiCad. The Altium wrapper
adds only the recovered component geometry and group annotation adapters needed
for hit areas and highlight overlays. Altium source bytes are retained in state
so portable PCB Styler project ZIP export can preserve the `.PcbDoc` alongside
the same JSON UI settings used for KiCad projects.

## Server Endpoints

- `GET /api/health`: liveness check.
- `GET /api/app-meta`: app metadata from `package.json`.
- `GET /api/app-meta.php`: compatibility alias.
- `/node_modules/...`: local development serving for browser ESM dependencies.

## Deployment Model

The FTP workflow runs `npm run build:static` before uploading frontend files.
That command copies `src/` into `.deploy-src/`, rewrites `index.html` to load
`/style.css?v=<package version>` and `/main.mjs?v=<package version>`, rewrites
local `.mjs` imports and known browser package imports with the same version
key, and emits a root `.htaccess` that applies no-store cache headers to
browser assets on Apache/shared-hosting.

The workflow uploads `.deploy-src/` to the document root, `api/` to `/api/`,
`docs/` to `/docs/`, root `package.json` for deployed version metadata, and
production `node_modules/` when dependency metadata changes.
