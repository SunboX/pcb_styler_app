# Hovered Component Info Design

## Context

PCB Styler already supports component hover and click interactions through
delegated events on the rendered SVG. Rendered component elements expose
`data-footprint-id`, and some renderer paths also expose
`data-component-reference`. Hover state is stored as `hoveredFootprintId` and is
passed back into the renderer to draw a soft highlight.

## Goal

Show a fixed info panel in the right sidebar for the component currently under
the pointer. The panel should update as hover changes and return to an empty
state when no component is hovered.

## User Experience

The right sidebar will include a "Hovered component" control group near the
existing highlight controls. When no component is hovered, it will show
"Hover a component to inspect it." When a component is hovered, it will show the
component reference, footprint id, side, and any useful source metadata available
from the loaded board model.

The panel is fixed in the sidebar rather than floating near the cursor, so it
does not cover PCB artwork and remains predictable on dense boards.

## Architecture

`AppController` will resolve component information from the current board and
hovered footprint id. KiCad lookup will use `board.footprints`; Altium lookup
will use `board.pcb.components`. The resolved object will be included in public
state and passed to `AppView.render`.

`AppView` will own the DOM rendering for the sidebar panel. It will render an
empty state with no board or no hover, and a compact definition-style grid for a
hovered component. Rendering will use DOM APIs instead of string-concatenating
untrusted board fields.

The existing hover event path remains the source of truth. The feature will not
add a second hit-testing system.

## Data Fields

The first implementation will display these fields when available:

- Reference
- Footprint id
- Side
- Value or description
- Package or pattern
- Source format

Missing optional fields will be omitted. Unknown components will still show the
hovered footprint id so the UI remains useful if renderer metadata and board
data diverge.

## Error Handling

Malformed component data will be normalized to strings before rendering. Missing
or unknown fields will not throw. If the hovered id is empty, the panel returns
to its empty state.

## Testing

Tests will cover:

- KiCad hovered component lookup.
- Altium hovered component lookup.
- Unknown hovered ids falling back to footprint id only.
- View rendering for the empty and populated panel states.

The implementation will follow the existing test runner: `npm test`.
