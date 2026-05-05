<!--
SPDX-FileCopyrightText: 2026 André Fiedler
SPDX-License-Identifier: CC-BY-SA-4.0
-->

# WebMCP Integration

PCB Styler includes an early WebMCP integration for browsers that expose `navigator.modelContext`. The integration is feature-detected at startup and does nothing in browsers where the API is unavailable.

The app uses the imperative WebMCP shape from the proposal: `navigator.modelContext.registerTool(tool, { signal })`. Tool definitions include `name`, `description`, `inputSchema`, optional `annotations`, and an `execute` callback wired to the same controller actions as the human UI.

## Registered Tools

- `pcb_styler_get_state`: returns board metadata, side, layer styles, highlighted footprints, highlight color, badges, badge style, and available footprint ids.
- `pcb_styler_set_side`: switches between front and back.
- `pcb_styler_set_layer_style`: updates layer visibility, fill color, fill opacity, border color, or border width.
- `pcb_styler_set_highlight_color`: changes the persistent highlight color.
- `pcb_styler_toggle_component_highlight`: toggles a footprint highlight by id.
- `pcb_styler_clear_highlights`: removes all persistent highlights.
- `pcb_styler_add_badge`: creates a badge on the current side.
- `pcb_styler_update_badge`: updates badge text, position, or rotation.
- `pcb_styler_remove_badge`: removes a badge by id.
- `pcb_styler_export_svg`: returns the current SVG text without triggering a download.
- `pcb_styler_export_png`: returns the current transparent PNG as a data URL without triggering a download.

## Privacy and Safety

WebMCP tools run in the loaded browser tab and reuse the same local client-side state as the UI. They do not upload board files and do not add any server endpoint. File opening still requires the existing browser file picker or drop flow, because page JavaScript cannot arbitrarily read local files.

State-changing tools update the visible UI, which keeps the user in the loop. The SVG export tool returns text to the caller, and the PNG export tool returns a `data:image/png` URL. Neither export tool starts a browser download.
