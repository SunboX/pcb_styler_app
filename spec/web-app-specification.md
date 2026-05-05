<!--
SPDX-FileCopyrightText: 2026 André Fiedler
SPDX-License-Identifier: CC-BY-SA-4.0
-->

# PCB Styler Specification

## 1. Goal

Build a local-first browser tool that opens KiCad PCB files and renders a clean assembly/manual-style 2D board view matching the provided Blinkenstar reference style.

## 2. Functional Requirements

1. The app loads direct `.kicad_pcb` files.
2. The app loads `.zip` archives and selects the first `.kicad_pcb` entry inside the archive, ignoring macOS metadata folders.
3. When no board is open, the center viewer shows the board/project drop prompt.
4. The parser extracts board title, revision, outline primitives, footprints, pads, routed segments, vias, filled zones, silkscreen/fab drawings, text, and KiCad text justification.
5. The renderer draws the board as SVG with transparent page background, black PCB fill, grey board outline, grey pads, grey routed copper, grey silkscreen, and dark drill holes.
6. The UI provides front and back side switching, with the back side mirrored as viewed from the backside.
7. The UI provides custom visibility, fill color, fill transparency, border color, and border-thickness controls for rendered layers.
8. The UI keeps annotation and export controls in a right sidebar separate from file, side, and layer controls.
9. The UI lets users click components to toggle persistent highlights, previews component hover with a softer highlight color, and lets users change or clear the persistent highlight color.
10. The UI lets users add, edit, rotate, remove, and drag text/number badges that use the current persistent highlight color for badge fill, expose configurable shared text/border color, scale, and drop shadow, and automatically render longer badge text as a rounded pill.
11. The UI provides SVG export.
12. The UI provides PNG export with a transparent background outside the rendered PCB.
13. The UI provides portable Project ZIP export containing the active `.kicad_pcb` source and a JSON settings file, and loading that ZIP restores the board plus saved UI settings.
14. The UI shows active file name, footprint count, pad count, outline presence, and status, with file metadata placed below the layer controls in the left sidebar.
15. The UI provides an integrated imprint footer with responsible-party address, contact email, app version, GitHub, and Mastodon links.
16. In browsers that support the early WebMCP API, the app registers structured tools for reading PCB Styler state, changing side and layer styles, managing highlights and badges, and retrieving the current SVG or transparent PNG without requiring DOM actuation.
17. Shared-hosting deployment publishes an Apache-ready static frontend artifact with versioned browser module URLs, no-store cache headers, and a PHP metadata fallback.

## 3. Non-Functional Requirements

1. Use modern JavaScript ESM modules.
2. Keep parsing and rendering client-side; no board file is uploaded to a server.
3. Keep each source file below 1000 LOC.
4. Use 4-space formatting with single quotes and no semicolons.
5. Include JSDoc for public and private methods.
6. Keep documentation in `docs/` and tests in `tests/`.

## 4. Architecture

1. `@sunbox/kicad-toolkit`: KiCad S-expression parsing, normalized board model extraction, direct board and ZIP project loading, project ZIP export/import helpers, coordinate transforms, render layer style normalization, badge style normalization, and manual-style SVG rendering.
2. `src/core/AppState.mjs`: state container for loaded board, side, render settings, highlights, badges, and status.
3. `src/ui/BadgeControls.mjs`: badge list, style controls, and SVG drag handling.
4. `src/ui/AppView.mjs`: DOM binding, display updates, SVG/PNG/project ZIP downloads.
5. `src/integrations/WebMcpBridge.mjs`: early WebMCP tool registration and lifecycle management.
6. `src/AppController.mjs`: state orchestration and user action flow.
7. `src/server.mjs`: local static/API server.
8. `src/StaticDeployBuilder.mjs` and `scripts/build-static-deploy.mjs`: static FTP deployment artifact builder.
9. `api/app-meta.php`: shared-hosting metadata endpoint for deployed app version.

## 5. Security / Privacy

1. Board files are parsed in the browser.
2. The local server only serves static assets, `/api/health`, and `/api/app-meta`.
3. The app does not make outbound network calls for uploaded board content.
4. ZIP archives are read in memory and only `.kicad_pcb` entries are interpreted as board content.
5. Project ZIP settings are parsed as JSON data and only applied to known state fields.
6. WebMCP tools are feature-detected, run only in the browser tab, and do not add server endpoints or bypass browser file permissions.

## 6. Acceptance Criteria

1. `npm install && npm start` serves the app locally.
2. Loading the provided Blinkenstar board or ZIP renders a black/grey PCB view.
3. Switching front/back changes the visible side-specific pads, text, and drawings, and the back view matches KiCad's backside orientation for bottom footprint geometry and labels.
4. SVG export downloads the current rendered view.
5. PNG export downloads the current rendered view with transparent background outside the PCB.
6. Project ZIP export downloads an archive with `settings.json` and the active board source; reopening that archive restores the side, layer styles, highlights, badges, badge style, and board source.
7. Changing layer visibility, fill color, fill transparency, border color, or border thickness updates the live preview and exported SVG/PNG.
8. Highlights, badge controls, and export buttons are grouped in the right sidebar, while file loading, board metadata, side switching, and layer styling stay in the left sidebar.
9. Clicking a component toggles its persistent highlight, hovering a component previews a softer highlight, the highlight color control changes selected component rendering, and clearing highlights removes all persistent highlights.
10. Adding badges starts with label `1`, subsequent badges count upward, badge text is editable, badges can be rotated and dragged in the PCB view, longer badge text renders as a rounded pill, badge text/border color, scale, and drop shadow can be changed, and exported SVG/PNG include the configured badge appearance.
11. The footer shows the imprint contact information and runtime version as part of the app chrome, and the top bar does not show a separate version badge.
12. When `navigator.modelContext.registerTool` is present, the app registers early WebMCP tools; when it is absent, startup continues without errors.
13. `npm run build:static` writes `.deploy-src/` with versioned frontend assets for the FTP workflow.
14. `npm test` passes.
