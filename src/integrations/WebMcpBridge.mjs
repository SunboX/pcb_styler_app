// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: AGPL-3.0-or-later

const layerKeys = [
    'board',
    'edgeCuts',
    'pads',
    'traces',
    'zones',
    'vias',
    'drills',
    'silkscreen'
]

/**
 * Registers PCB Styler actions with the early WebMCP browser API.
 */
export class WebMcpBridge {
    /** @type {{ registerTool?: (tool: object, options?: { signal?: AbortSignal }) => void } | null} */
    #modelContext

    /** @type {object} */
    #controller

    /** @type {AbortController | null} */
    #abortController

    /**
     * @param {{ modelContext?: { registerTool?: (tool: object, options?: { signal?: AbortSignal }) => void } | null, controller: object }} dependencies
     */
    constructor(dependencies) {
        const browserModelContext =
            typeof navigator === 'undefined' ? null : navigator.modelContext
        this.#modelContext =
            'modelContext' in dependencies
                ? dependencies.modelContext
                : browserModelContext
        this.#controller = dependencies.controller
        this.#abortController = null
    }

    /**
     * Registers the current tool set.
     * @returns {{ supported: boolean, toolNames: string[] }}
     */
    register() {
        if (typeof this.#modelContext?.registerTool !== 'function') {
            return { supported: false, toolNames: [] }
        }

        this.dispose()
        this.#abortController = new AbortController()
        const tools = createTools(this.#controller)
        for (const tool of tools) {
            this.#modelContext.registerTool(tool, {
                signal: this.#abortController.signal
            })
        }

        return {
            supported: true,
            toolNames: tools.map((tool) => tool.name)
        }
    }

    /**
     * Unregisters tools registered by this bridge.
     * @returns {void}
     */
    dispose() {
        this.#abortController?.abort()
        this.#abortController = null
    }
}

/**
 * Creates the WebMCP tool descriptors.
 * @param {object} controller
 * @returns {object[]}
 */
function createTools(controller) {
    return [
        {
            name: 'pcb_styler_get_state',
            description:
                'Return the current PCB Styler board, layer, highlight, and badge state without changing the UI.',
            inputSchema: emptyObjectSchema(),
            annotations: { readOnlyHint: true },
            execute: () => controller.getPublicState()
        },
        {
            name: 'pcb_styler_set_side',
            description: 'Switch the PCB view to the front or back side.',
            inputSchema: {
                type: 'object',
                properties: {
                    side: {
                        type: 'string',
                        enum: ['front', 'back'],
                        description: 'The board side to display.'
                    }
                },
                required: ['side']
            },
            execute: (input) =>
                controller.setSide(String(objectInput(input).side || 'front'))
        },
        {
            name: 'pcb_styler_set_layer_style',
            description:
                'Update visibility, fill color, fill transparency, border color, or border width for one PCB render layer.',
            inputSchema: {
                type: 'object',
                properties: {
                    layer: {
                        type: 'string',
                        enum: layerKeys,
                        description: 'The render layer to update.'
                    },
                    visible: {
                        type: 'boolean',
                        description: 'Whether the layer is visible.'
                    },
                    fillColor: {
                        type: 'string',
                        description: 'Hex fill color such as #cfd1d4.'
                    },
                    fillOpacity: {
                        type: 'number',
                        minimum: 0,
                        maximum: 1,
                        description: 'Layer fill opacity from 0 to 1.'
                    },
                    borderColor: {
                        type: 'string',
                        description: 'Hex border color such as #50545f.'
                    },
                    borderWidth: {
                        type: 'number',
                        minimum: 0,
                        description:
                            'Optional border width in KiCad millimeters.'
                    }
                },
                required: ['layer']
            },
            execute: (input) => {
                const data = objectInput(input)
                return controller.setLayerStyle(
                    String(data.layer || ''),
                    layerPatch(data)
                )
            }
        },
        {
            name: 'pcb_styler_set_highlight_color',
            description:
                'Change the persistent component highlight and badge fill color.',
            inputSchema: {
                type: 'object',
                properties: {
                    color: {
                        type: 'string',
                        description: 'Hex highlight color such as #ff3b2b.'
                    }
                },
                required: ['color']
            },
            execute: (input) =>
                controller.setHighlightColor(
                    String(objectInput(input).color || '')
                )
        },
        {
            name: 'pcb_styler_toggle_component_highlight',
            description:
                'Toggle persistent highlighting for a component footprint by footprint id.',
            inputSchema: {
                type: 'object',
                properties: {
                    footprintId: {
                        type: 'string',
                        description:
                            'The footprint id from pcb_styler_get_state.'
                    }
                },
                required: ['footprintId']
            },
            execute: (input) =>
                controller.toggleFootprintHighlight(
                    String(objectInput(input).footprintId || '')
                )
        },
        {
            name: 'pcb_styler_clear_highlights',
            description: 'Remove all persistent component highlights.',
            inputSchema: emptyObjectSchema(),
            execute: () => controller.clearHighlights()
        },
        {
            name: 'pcb_styler_add_badge',
            description:
                'Add a badge callout on the current board side, optionally with text, position, and rotation.',
            inputSchema: badgeInputSchema(false),
            execute: (input) => controller.addBadge(objectInput(input))
        },
        {
            name: 'pcb_styler_update_badge',
            description:
                'Update an existing badge callout text, position, or rotation.',
            inputSchema: badgeInputSchema(true),
            execute: (input) => {
                const data = objectInput(input)
                return controller.updateBadge(
                    String(data.id || ''),
                    badgePatch(data)
                )
            }
        },
        {
            name: 'pcb_styler_remove_badge',
            description: 'Remove one badge callout by id.',
            inputSchema: {
                type: 'object',
                properties: {
                    id: {
                        type: 'string',
                        description: 'The badge id from pcb_styler_get_state.'
                    }
                },
                required: ['id']
            },
            execute: (input) =>
                controller.removeBadge(String(objectInput(input).id || ''))
        },
        {
            name: 'pcb_styler_export_svg',
            description:
                'Return the current PCB rendering as SVG text without triggering a browser download.',
            inputSchema: emptyObjectSchema(),
            annotations: { readOnlyHint: true },
            execute: () => controller.exportSvgForAgent()
        },
        {
            name: 'pcb_styler_export_png',
            description:
                'Return the current transparent PNG rendering as a data URL without triggering a browser download.',
            inputSchema: emptyObjectSchema(),
            annotations: { readOnlyHint: true },
            execute: () => controller.exportPngForAgent()
        }
    ]
}

/**
 * Returns an empty object schema.
 * @returns {object}
 */
function emptyObjectSchema() {
    return {
        type: 'object',
        properties: {}
    }
}

/**
 * Builds the badge input schema.
 * @param {boolean} requireId
 * @returns {object}
 */
function badgeInputSchema(requireId) {
    const properties = {
        id: {
            type: 'string',
            description: 'The badge id from pcb_styler_get_state.'
        },
        text: {
            type: 'string',
            description: 'Badge label text or number.'
        },
        x: {
            type: 'number',
            description: 'Badge center X coordinate in board millimeters.'
        },
        y: {
            type: 'number',
            description: 'Badge center Y coordinate in board millimeters.'
        },
        rotation: {
            type: 'number',
            description: 'Badge rotation in degrees.'
        }
    }
    return {
        type: 'object',
        properties,
        required: requireId ? ['id'] : []
    }
}

/**
 * Coerces unknown tool input to an object.
 * @param {unknown} input
 * @returns {Record<string, unknown>}
 */
function objectInput(input) {
    return input && typeof input === 'object'
        ? /** @type {Record<string, unknown>} */ (input)
        : {}
}

/**
 * Extracts a layer style patch from tool input.
 * @param {Record<string, unknown>} input
 * @returns {object}
 */
function layerPatch(input) {
    const patch = {}
    for (const key of [
        'visible',
        'fillColor',
        'fillOpacity',
        'borderColor',
        'borderWidth'
    ]) {
        if (key in input) patch[key] = input[key]
    }
    return patch
}

/**
 * Extracts a badge patch from tool input.
 * @param {Record<string, unknown>} input
 * @returns {object}
 */
function badgePatch(input) {
    const patch = {}
    for (const key of ['text', 'x', 'y', 'rotation']) {
        if (key in input) patch[key] = input[key]
    }
    return patch
}
