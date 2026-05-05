<!--
SPDX-FileCopyrightText: 2026 André Fiedler
SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Testing

## Strategy

- Keep KiCad parser, ZIP loader, project archive, and SVG renderer behavior
  covered in the sibling `@sunbox/kicad-toolkit` test suite.
- Unit-test controller action flow with fake view, loader, renderer, highlights, and badge dependencies.
- Unit-test early WebMCP tool registration and controller action calls without requiring a WebMCP-enabled browser.
- Validate project structure and source file length guardrails.

## Commands

```bash
npm test
```

## Current Coverage

- `tests/app-controller.test.mjs`: load, side switch, highlight, badge, export, and project import orchestration.
- `tests/app-state.test.mjs`: state update, highlight semantics, badge normalization, and badge style normalization.
- `tests/webmcp-bridge.test.mjs`: WebMCP tool registration, schema presence, execution routing, and no-op behavior without API support.
- `tests/project-structure.test.mjs`: required file presence.
- `tests/mjs-line-limit.test.mjs`: source file length guard.

The moved parser and renderer tests live in the sibling `kicad-toolkit`
repository under `tests/core/` and `tests/ui/`.

## Rules

- Add or update tests for each feature and bug fix.
- Keep app assertions focused on user-visible outputs and app orchestration.
- Put parser and renderer behavior tests in `@sunbox/kicad-toolkit`.
