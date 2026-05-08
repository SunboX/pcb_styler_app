<!--
SPDX-FileCopyrightText: 2026 André Fiedler
SPDX-License-Identifier: CC-BY-SA-4.0
-->

# PCB Styler Specification

## 1. Goal

Build a local-first browser tool that clearly supports KiCad and Altium PCB
sources, opens direct board files or project ZIP archives for both EDA formats,
and renders a clean assembly/manual-style 2D board view matching the provided
Blinkenstar reference style where the source format supports that styling
model.

## 2. Functional Requirements

1. The app loads direct `.kicad_pcb` files.
2. The app loads direct Altium `.PcbDoc` files.
3. The app loads `.zip` archives and selects a KiCad `.kicad_pcb` entry or, when no KiCad board is present, the first Altium `.PcbDoc` entry inside the archive, ignoring macOS metadata folders.
4. When no board is open, the center viewer shows the board/project drop prompt.
5. The KiCad parser extracts board title, revision, outline primitives, footprints, pads, routed segments, vias, filled zones, silkscreen/fab drawings, text, and KiCad text justification.
6. The KiCad renderer draws the board as SVG with transparent page background, black PCB fill, grey board outline, grey pads, grey silkscreen, visible pad drill holes, and separately styleable routing/detail layers for routed copper, zones, vias, and via drill holes.
7. The Altium renderer draws recovered `.PcbDoc` board outline, placements, pads, vias, copper, and footprint primitives as a top-facing SVG composite.
8. The UI provides front and back side switching for KiCad boards, with the back side mirrored as viewed from the backside.
9. The UI provides a clean manual assembly render preset that hides KiCad routing/detail layers by default, a full-detail KiCad preview render preset, plus custom visibility, fill color, fill transparency, border color, and border-thickness controls for KiCad and Altium rendered layers, including separate pad drill hole and via drill hole controls.
10. The UI keeps annotation and export controls in a right sidebar separate from file, side, and layer controls.
11. The UI lets users click KiCad or Altium components to toggle persistent highlights, previews component hover with a softer highlight color, shows fixed right-sidebar information for the hovered component, and lets users change or clear the persistent highlight color.
12. The UI lets users add, edit, rotate, remove, and drag text/number badges on KiCad and Altium renders that use the current persistent highlight color for badge fill, expose configurable shared text/border color, scale, and drop shadow, and automatically render longer badge text as a rounded pill.
13. The UI provides SVG export.
14. The UI provides PNG export with a transparent background outside the rendered PCB.
15. The UI provides portable Project ZIP export containing the active KiCad `.kicad_pcb` source or Altium `.PcbDoc` source and a JSON settings file, and loading that ZIP restores the board plus saved UI settings, including render preset.
16. The UI shows active file name, footprint count, pad count, outline presence, and status, with file metadata placed below the layer controls in the left sidebar.
17. The UI provides an integrated imprint footer with responsible-party address, contact email, app version, GitHub, and Mastodon links.
18. In browsers that support the early WebMCP API, the app registers structured tools for reading PCB Styler state, changing side, render preset, and layer styles, managing highlights and badges, and retrieving the current SVG or transparent PNG without requiring DOM actuation.
19. Shared-hosting deployment publishes an Apache-ready static frontend artifact with versioned browser module URLs, no-store cache headers, and a PHP metadata fallback.

## 3. Non-Functional Requirements

1. Use modern JavaScript ESM modules.
2. Keep parsing and rendering client-side; no board file is uploaded to a server.
3. Keep each source file below 1000 LOC.
4. Use 4-space formatting with single quotes and no semicolons.
5. Include JSDoc for public and private methods.
6. Keep documentation in `docs/` and tests in `tests/`.

## 4. Architecture

1. `kicad-toolkit`: KiCad S-expression parsing, normalized board model extraction, direct board and ZIP board loading, coordinate transforms, stroke-font primitives, and base manual-style SVG rendering.
2. `altium-toolkit`: Altium `.PcbDoc` parsing from `ArrayBuffer` and deterministic PCB SVG rendering.
3. `src/core/BoardFileLoader.mjs`: file-type routing between KiCad and Altium toolkits, including ZIP-contained board discovery and app project settings extraction.
4. `src/core/ProjectArchive.mjs`: PCB Styler project ZIP export/import helpers.
5. `src/ui/BoardSvgRenderer.mjs`: renderer routing between KiCad and Altium SVG renderers.
6. `src/ui/PcbSvgRendererDecorator.mjs`: shared app-owned SVG decoration pipeline for render palette styling, component highlights, badge overlays, and SVG attribute helpers.
7. `src/ui/KicadPcbSvgRenderer.mjs` and `src/ui/AltiumPcbSvgRenderer.mjs`: thin wrapper renderers that call toolkit `PcbSvgRenderer` implementations and provide format-specific class mappings, component geometry, and insertion points to the shared decorator.
8. `src/core/AppState.mjs`: state container for loaded board, source bytes/text, side, render settings, highlights, badges, and status.
9. `src/ui/BadgeControls.mjs`: badge list, style controls, and SVG drag handling.
10. `src/ui/AppView.mjs`: DOM binding, display updates, SVG/PNG/project ZIP downloads.
11. `src/integrations/WebMcpBridge.mjs`: early WebMCP tool registration and lifecycle management.
12. `src/AppController.mjs`: state orchestration and user action flow.
13. `src/server.mjs`: local static/API server.
14. `src/StaticDeployBuilder.mjs` and `scripts/build-static-deploy.mjs`: static FTP deployment artifact builder.
15. `api/app-meta.php`: shared-hosting metadata endpoint for deployed app version.

## 5. Security / Privacy

1. Board files are parsed in the browser.
2. The local server only serves static assets, `/api/health`, and `/api/app-meta`.
3. The app does not make outbound network calls for uploaded board content.
4. ZIP archives are read in memory and only `.kicad_pcb` or `.PcbDoc` entries are interpreted as board content.
5. Project ZIP settings are parsed as JSON data and only applied to known state fields.
6. WebMCP tools are feature-detected, run only in the browser tab, and do not add server endpoints or bypass browser file permissions.

## 6. Acceptance Criteria

1. `npm install && npm start` serves the app locally.
2. Loading the provided Blinkenstar board or ZIP renders a black/grey manual PCB view focused on board shape, pads, pad drill holes, and silkscreen without routing clutter.
3. Loading a direct Altium `.PcbDoc` or a ZIP containing one renders an Altium PCB SVG view.
4. Switching front/back changes the visible KiCad side-specific pads, text, and drawings, and the back view matches KiCad's backside orientation for bottom footprint geometry and labels.
5. SVG export downloads the current rendered view.
6. PNG export downloads the current rendered view with transparent background outside the PCB.
7. Project ZIP export downloads an archive with `settings.json` and the active KiCad or Altium board source; reopening that archive restores the side, render preset, layer styles, highlights, badges, badge style, and board source.
8. Changing layer visibility, fill color, fill transparency, border color, or border thickness updates the live preview and exported SVG/PNG for KiCad and Altium boards, including re-enabling hidden manual routing/detail layers.
9. Highlights, badge controls, and export buttons are grouped in the right sidebar, while file loading, board metadata, side switching, and layer styling stay in the left sidebar.
10. Clicking a KiCad or Altium component toggles its persistent highlight, hovering a component previews a softer highlight and shows component details in the right sidebar, the highlight color control changes selected component rendering, and clearing highlights removes all persistent highlights.
11. Adding badges starts with label `1`, subsequent badges count upward, badge text is editable, badges can be rotated and dragged in the PCB view, longer badge text renders as a rounded pill, badge text/border color, scale, and drop shadow can be changed, and exported SVG/PNG include the configured badge appearance for KiCad and Altium boards.
12. The footer shows the imprint contact information and runtime version as part of the app chrome, and the top bar does not show a separate version badge.
13. When `navigator.modelContext.registerTool` is present, the app registers early WebMCP tools; when it is absent, startup continues without errors.
14. `npm run build:static` writes `.deploy-src/` with versioned frontend assets for the FTP workflow.
15. `npm test` passes.
