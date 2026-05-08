<!--
SPDX-FileCopyrightText: 2026 André Fiedler
SPDX-License-Identifier: CC-BY-SA-4.0
-->

# Security

## Local-First Defaults

- Board files are read in the browser through the File API.
- ZIP archives are decompressed in browser memory with `fflate`.
- Project ZIP exports are generated in browser memory and contain the current KiCad or Altium board source plus JSON settings.
- Early WebMCP tools are registered only when `navigator.modelContext` is available. They run in the visible browser tab, reuse local UI state, and do not add server-side access to board files.
- No board content is posted to the local server.
- The server exposes only static assets and app metadata endpoints.

## Input Handling

- The loader accepts direct `.kicad_pcb` files, direct Altium `.PcbDoc`
  files, KiCad `.zip` archives, Altium `.PcbDoc` entries inside `.zip`
  archives, and PCB Styler project `.zip` archives.
- ZIP metadata folders such as `__MACOSX/` are ignored.
- Parser errors are surfaced as status text rather than executed or injected as code.

## Secrets

- Do not place secrets in frontend code.
- Keep `.env` and deployment credentials out of the repository if future server-side features are added.
