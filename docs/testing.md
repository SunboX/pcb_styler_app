<!--
SPDX-FileCopyrightText: 2026 André Fiedler
SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Testing

## Strategy

- Keep KiCad parser, ZIP loader, and base SVG renderer behavior covered in the
  sibling `kicad-toolkit` test suite.
- Keep PCB Styler project archive, shared palette, component highlight, and
  badge overlay behavior covered in this app test suite for KiCad and Altium.
- Keep the shared SVG decorator pipeline covered separately from the
  format-specific wrapper tests.
- Keep native Altium parser and renderer behavior covered in the
  `altium-toolkit` test suite.
- Unit-test PCB Styler's format routing for direct KiCad files, direct Altium
  `.PcbDoc` files, and ZIP-contained `.PcbDoc` files.
- Unit-test controller action flow with fake view, loader, renderer, highlights, and badge dependencies.
- Unit-test early WebMCP tool registration and controller action calls without requiring a WebMCP-enabled browser.
- Unit-test static deployment artifacts, FTP workflow shape, and PHP metadata fallback behavior.
- Validate project structure and source file length guardrails.

## Commands

```bash
npm test
```

## Current Coverage

- `tests/app-controller.test.mjs`: load, side switch, render preset, highlight, badge, export, and project import orchestration.
- `tests/altium-app-renderer.test.mjs`: app-owned Altium palette, highlight, and badge overlay rendering.
- `tests/app-state.test.mjs`: state update, source-byte storage, highlight semantics, badge normalization, and badge style normalization.
- `tests/board-toolkit.test.mjs`: KiCad/Altium loader routing, app project settings extraction, and renderer routing.
- `tests/kicad-app-renderer.test.mjs`: app-owned KiCad palette, clean manual defaults, KiCad preview preset, highlight, and badge overlay rendering.
- `tests/pcb-svg-renderer-decorator.test.mjs`: shared toolkit SVG decoration, highlight, badge insertion behavior, and SVG attribute/style removal helpers used by render presets.
- `tests/project-archive.test.mjs`: PCB Styler project archive export format for text and binary board sources.
- `tests/deploy-ftp-workflow.test.mjs`: GitHub Actions FTP target coverage.
- `tests/php-app-meta-endpoint.test.mjs`: PHP deployment metadata endpoint behavior.
- `tests/static-deploy-builder.test.mjs`: Apache/shared-hosting artifact cache-busting coverage.
- `tests/webmcp-bridge.test.mjs`: WebMCP tool registration, schema presence, execution routing, and no-op behavior without API support.
- `tests/project-structure.test.mjs`: required file presence.
- `tests/mjs-line-limit.test.mjs`: source file length guard.

The moved KiCad parser and renderer tests live in the sibling `kicad-toolkit`
repository under `tests/core/` and `tests/ui/`. Altium parser and renderer
coverage lives in the `altium-toolkit` repository.

## Rules

- Add or update tests for each feature and bug fix.
- Keep app assertions focused on user-visible outputs and app orchestration.
- Put parser and renderer behavior tests in the relevant toolkit repository.
