<!--
SPDX-FileCopyrightText: 2026 André Fiedler
SPDX-License-Identifier: CC-BY-SA-4.0
-->

# PCB Styler

Browser-based KiCad PCB assembly-view renderer for `.kicad_pcb` files and KiCad project `.zip` archives.

## Features

- Client-side KiCad S-expression parsing for `.kicad_pcb` files through
  `@sunbox/kicad-toolkit`
- ZIP project loading with automatic board-file discovery
- PCB Styler project ZIP export/import with the PCB source and JSON settings
- Manual-style SVG PCB rendering with black board fill, grey pads, grey silkscreen, routed copper, vias, zones, and drill holes
- Front/back side switching with KiCad-style backside mirroring
- Per-layer visibility, fill color, fill transparency, border color, and border-thickness controls that apply to preview, SVG export, and transparent PNG export
- Right-side annotation sidebar for component highlights, movable text/number badges, and exports
- Click and hover component highlighting with a user-selectable highlight color
- Badges include configurable text/border color, scale, drop shadow, per-badge rotation, and automatic pill shapes for longer labels
- SVG, transparent-background PNG, and portable project ZIP export
- Early WebMCP tool registration for agent-assisted state inspection, styling, highlights, badges, SVG export, and transparent PNG export in supported browsers
- Integrated imprint footer with contact, version, GitHub, and Mastodon links
- Local Express dev server in `src/server.mjs`
- Node test suite for app controller, state, integration bridge, and structure
  checks; parser and renderer coverage lives in `@sunbox/kicad-toolkit`

## Project Structure

- `src/core/`: app state
- `src/ui/`: DOM view and app controls
- `@sunbox/kicad-toolkit`: KiCad parsing, project archive loading/export,
  geometry, palette normalization, and SVG rendering
- `src/AppController.mjs`: app orchestration and export flow
- `src/StaticDeployBuilder.mjs`: Apache/shared-hosting artifact builder
- `scripts/build-static-deploy.mjs`: static deployment build wrapper
- `api/`: deployable PHP metadata endpoint for shared hosting
- `tests/`: behavior and structure tests
- `docs/`: architecture, setup, testing, security, troubleshooting
- `spec/`: product scope and acceptance criteria

## Documentation

- [Getting Started](docs/getting-started.md)
- [Architecture](docs/architecture.md)
- [Testing](docs/testing.md)
- [WebMCP Integration](docs/webmcp.md)
- [Security](docs/security.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Specification](spec/web-app-specification.md)

## Start

```bash
npm install
npm start
```

Open [http://localhost:3001/](http://localhost:3001/).

## Test

```bash
npm test
```

## Deployment

```bash
npm run build:static
```

The static build writes `.deploy-src/` with versioned browser module URLs and
an Apache cache policy. The GitHub Actions FTP workflow deploys that artifact,
`api/`, `docs/`, root `package.json`, and production `node_modules/` to the
configured shared-hosting target using `FTP_SERVER`, `FTP_USERNAME`, and
`FTP_PASSWORD` secrets.

## Formatting

```bash
npm run format
```

## License

This project is available under two licensing options.

### 1. Open-source license

The software source code is licensed under the GNU Affero General Public
License v3.0 or later (`AGPL-3.0-or-later`).

You may use, modify, and distribute this project under the AGPL. If you
modify the software and make it available to users over a network, the AGPL
requires that those users can access the corresponding source code of the
modified version.

Project documentation and non-code media are licensed under Creative Commons
Attribution-ShareAlike 4.0 (`CC-BY-SA-4.0`) unless otherwise marked.

### 2. Commercial/proprietary license

For use in closed-source, proprietary, or otherwise AGPL-incompatible
products, a separate commercial license is required.

Commercial licensing contact: [mail@andrefiedler.de](mailto:mail@andrefiedler.de)

### Attribution / notices

Copyright (C) 2026 André Fiedler.

Copyright, license, attribution, and source-origin notices must be preserved
as required by the AGPL, CC-BY-SA-4.0, and the notice files in this
repository.
