<!--
SPDX-FileCopyrightText: 2026 André Fiedler
SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Getting Started

## Prerequisites

- Node.js 20+
- npm

## Install

```bash
npm install
```

## Start

```bash
npm start
```

Open [http://localhost:3001/](http://localhost:3001/).

## Workflow

1. Open a supported KiCad `.kicad_pcb` file, Altium `.PcbDoc` file, KiCad project ZIP, Altium ZIP containing `.PcbDoc`, or PCB Styler project ZIP.
2. When no board is open yet, use either the top Open button or the center drop prompt to choose a KiCad, Altium, or project ZIP file.
3. Choose `Manual` for the app's editable grey assembly palette with routing detail hidden by default, or `KiCad` for the KiCad-like dark canvas and full copper preview.
4. Switch between front and back as needed for KiCad boards.
5. Adjust layer visibility, fill color, fill transparency, border colors, and border thickness when the current render preset needs custom styling; the hidden manual routing layers can be re-enabled from the layer controls.
6. Use the right sidebar to toggle component highlights, edit badge callouts, and export the current view.
7. Hover a rendered component to inspect its details in the right sidebar, click it to toggle its persistent highlight, use the highlight color picker for the marked color, or clear all highlights from the right sidebar.
8. Add badges when callouts need explicit numbers or text, edit and rotate each badge in the right sidebar, adjust the shared badge text/border color, scale, and shadow controls, and drag badges directly on the PCB view to place them. Short badge labels stay circular; longer labels automatically become rounded pills.
9. Export the current KiCad or Altium view as SVG or transparent-background PNG, or export a Project ZIP that contains the active board source plus a JSON settings file.
10. Reopen a Project ZIP through the same Open Board or Project file button or drop zone to restore the PCB, side, render preset, layer styles, highlights, badges, and badge style for KiCad or Altium boards.
11. In a WebMCP-enabled browser, an agent can use the registered PCB Styler tools to inspect state, switch sides, change render presets, update layer styles, manage highlights and badges, and retrieve SVG or transparent PNG output.
12. Use the integrated imprint footer for responsible-party, contact, version, GitHub, and Mastodon information.

## Analytics

- The app loads the centralized cookieless tracker from `https://analytics.andrefiedler.de/tracker.js`.
- The public site key is `pcb_styler_app`.
- Register each deployed browser origin in the Analytics `analytics_sites` table or dashboard before expecting events. The production row should use the deployed app origin and public key `pcb_styler_app`.

```sql
INSERT INTO analytics_sites (name, allowed_origin, public_key, active, created_at)
VALUES ('PCB Styler', 'https://your-pcb-app-origin.example', 'pcb_styler_app', 1, UTC_TIMESTAMP());
```

## Test

```bash
npm test
```
