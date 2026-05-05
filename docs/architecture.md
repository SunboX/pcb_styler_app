<!--
SPDX-FileCopyrightText: 2026 André Fiedler
SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Architecture

## Runtime Modules

- `src/index.html`: static app shell with left setup sidebar, center viewer, right annotation/export sidebar, imprint footer, import map, and DOM anchors.
- `src/main.mjs`: bootstrap and dependency wiring.
- `src/AppController.mjs`: file loading, state updates, side switching, and export actions.
- `src/core/AppState.mjs`: normalized state container with subscriptions.
- `@sunbox/kicad-toolkit`: KiCad S-expression parsing, board model extraction, direct `.kicad_pcb` and `.zip` loading, portable project ZIP creation, geometry helpers, badge style normalization, render palette normalization, and SVG rendering.
- `src/integrations/WebMcpBridge.mjs`: feature-detected early WebMCP tool registration.
- `src/ui/BadgeControls.mjs`: badge list, style controls, and SVG drag handling.
- `src/ui/AppView.mjs`: DOM binding, status updates, and SVG/PNG/project ZIP downloads.
- `src/server.mjs`: local static server, dependency serving, and metadata endpoints.
- `src/ServerAssetVersioner.mjs`: static asset URL rewriting for deploy artifacts.
- `src/StaticDeployBuilder.mjs`: Apache/shared-hosting artifact builder.
- `scripts/build-static-deploy.mjs`: CLI wrapper that writes `.deploy-src/`.
- `api/app-meta.php`: PHP fallback for deployed app version metadata.

## Data Flow

1. The user opens or drops files.
2. `AppView` passes the file list to `AppController`.
3. `KicadProjectLoader` from `@sunbox/kicad-toolkit` reads either a direct `.kicad_pcb` file or the first board entry inside a `.zip`, and `ProjectArchive` extracts saved PCB Styler settings when the ZIP is an exported project.
4. `KicadPcbParser` from `@sunbox/kicad-toolkit` normalizes outlines, footprints, pads, drawings, and text.
5. `AppState` stores the active board, original board source text, source filename, selected side, render layer styles, highlighted footprints, hover footprint, highlight color, badges, badge style, and status.
6. `PcbSvgRenderer` from `@sunbox/kicad-toolkit` renders the current side, layer styles, component highlight state, and same-side styled badges as SVG.
7. `AppView` inserts the SVG, delegates component click/hover events from footprint hit areas, converts badge drags to board coordinates, updates the footer version node, and handles SVG/transparent-PNG/project ZIP download creation.
8. `WebMcpBridge` registers agent-facing tools against `navigator.modelContext` when the early WebMCP API is available; tools call public controller methods that reuse the same state updates as UI actions.

## Rendering Model

The toolkit renderer keeps KiCad millimeter coordinates in SVG viewBox space. KiCad's positive Y direction matches SVG's positive Y direction, so the front view can preserve board orientation without flipping. The back view mirrors the complete scene horizontally around the board center to match KiCad backside exports. Front footprint-local pads, text, and drawings use the footprint `at` position and rotation directly. Back footprint-local coordinates use KiCad's mirrored bottom-side transform, so local geometry rotates opposite the footprint angle before the side-level render transform is applied. Text parsing also preserves KiCad left/right/top/bottom justification so labels are anchored at their source `at` point. Copper tracks, vias, and filled zone polygons are parsed as board-level primitives and layered below pads and text.

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
