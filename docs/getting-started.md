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

1. Open a `.kicad_pcb` file or KiCad project `.zip`.
2. When no board is open yet, use either the top Open button or the center drop prompt to choose a board or project file.
3. Switch between front and back as needed.
4. Adjust layer visibility, fill color, fill transparency, border colors, and border thickness when the default manual-style palette needs to match a different document style.
5. Use the right sidebar to toggle component highlights, edit badge callouts, and export the current view.
6. Click a rendered component to toggle its persistent highlight, use the highlight color picker for the marked color, or clear all highlights from the right sidebar.
7. Add badges when callouts need explicit numbers or text, edit and rotate each badge in the right sidebar, adjust the shared badge text/border color, scale, and shadow controls, and drag badges directly on the PCB view to place them. Short badge labels stay circular; longer labels automatically become rounded pills.
8. Export the current view as SVG or transparent-background PNG, or export a Project ZIP that contains the active `.kicad_pcb` source plus a JSON settings file.
9. Reopen a Project ZIP through the same Open Board or Project file button or drop zone to restore the PCB, side, layer styles, highlights, badges, and badge style.
10. In a WebMCP-enabled browser, an agent can use the registered PCB Styler tools to inspect state, switch sides, update layer styles, manage highlights and badges, and retrieve SVG or transparent PNG output.
11. Use the integrated imprint footer for responsible-party, contact, version, GitHub, and Mastodon information.

## Test

```bash
npm test
```
