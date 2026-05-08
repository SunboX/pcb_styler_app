// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { WebMcpBridge } from '../src/integrations/WebMcpBridge.mjs'

test('WebMcpBridge registers PCB Styler tools with modelContext', async () => {
    const modelContext = new FakeModelContext()
    const controller = new FakeController()
    const bridge = new WebMcpBridge({ modelContext, controller })

    const result = bridge.register()

    assert.equal(result.supported, true)
    assert.deepEqual(modelContext.toolNames, [
        'pcb_styler_get_state',
        'pcb_styler_set_side',
        'pcb_styler_set_render_preset',
        'pcb_styler_set_layer_style',
        'pcb_styler_set_highlight_color',
        'pcb_styler_toggle_component_highlight',
        'pcb_styler_clear_highlights',
        'pcb_styler_add_badge',
        'pcb_styler_update_badge',
        'pcb_styler_remove_badge',
        'pcb_styler_export_svg',
        'pcb_styler_export_png'
    ])

    assert.equal(
        modelContext.tools.get('pcb_styler_get_state').annotations.readOnlyHint,
        true
    )
    assert.equal(
        modelContext.tools.get('pcb_styler_export_png').annotations
            .readOnlyHint,
        true
    )
    assert.equal(
        modelContext.tools.get('pcb_styler_set_side').inputSchema.properties
            .side.enum[1],
        'back'
    )

    const stateResult = await modelContext.call('pcb_styler_get_state')
    assert.equal(stateResult.app, 'PCB Styler')

    const sideResult = await modelContext.call('pcb_styler_set_side', {
        side: 'back'
    })
    assert.equal(controller.actions.at(-1).name, 'setSide')
    assert.equal(controller.actions.at(-1).value, 'back')
    assert.equal(sideResult.side, 'back')

    const presetResult = await modelContext.call(
        'pcb_styler_set_render_preset',
        {
            preset: 'kicad'
        }
    )
    assert.equal(controller.actions.at(-1).name, 'setRenderPreset')
    assert.equal(controller.actions.at(-1).value, 'kicad')
    assert.equal(presetResult.renderPreset, 'kicad')

    const badgeResult = await modelContext.call('pcb_styler_add_badge', {
        text: 'A1',
        x: 10,
        y: 20,
        rotation: 45
    })
    assert.equal(badgeResult.badge.text, 'A1')
    assert.equal(badgeResult.badge.rotation, 45)

    const pngResult = await modelContext.call('pcb_styler_export_png')
    assert.equal(pngResult.fileName, 'board.png')
    assert.equal(pngResult.mimeType, 'image/png')
    assert.match(pngResult.dataUrl, /^data:image\/png;base64,/)

    bridge.dispose()
    assert.equal(modelContext.aborted, true)
})

test('WebMcpBridge no-ops when modelContext is unavailable', () => {
    const bridge = new WebMcpBridge({
        modelContext: null,
        controller: new FakeController()
    })

    assert.deepEqual(bridge.register(), {
        supported: false,
        toolNames: []
    })
})

class FakeModelContext {
    constructor() {
        this.tools = new Map()
        this.aborted = false
        this.observedSignals = new WeakSet()
    }

    /**
     * @returns {string[]}
     */
    get toolNames() {
        return [...this.tools.keys()]
    }

    /**
     * @param {{ name: string }} tool
     * @param {{ signal?: AbortSignal }} options
     */
    registerTool(tool, options = {}) {
        this.tools.set(tool.name, tool)
        if (options.signal && !this.observedSignals.has(options.signal)) {
            this.observedSignals.add(options.signal)
            options.signal.addEventListener('abort', () => {
                this.aborted = true
                this.tools.clear()
            })
        }
    }

    /**
     * @param {string} name
     * @param {object} [input]
     * @returns {Promise<unknown>}
     */
    async call(name, input = {}) {
        return this.tools.get(name).execute(input, {})
    }
}

class FakeController {
    constructor() {
        this.actions = []
        this.side = 'front'
        this.renderPreset = 'manual'
        this.badges = []
    }

    /**
     * @returns {object}
     */
    getPublicState() {
        return {
            app: 'PCB Styler',
            loaded: true,
            side: this.side,
            renderPreset: this.renderPreset,
            badges: this.badges
        }
    }

    /**
     * @param {'front' | 'back'} side
     * @returns {object}
     */
    setSide(side) {
        this.side = side
        this.actions.push({ name: 'setSide', value: side })
        return this.getPublicState()
    }

    /**
     * @param {'manual' | 'kicad'} preset
     * @returns {object}
     */
    setRenderPreset(preset) {
        this.renderPreset = preset
        this.actions.push({ name: 'setRenderPreset', value: preset })
        return this.getPublicState()
    }

    /**
     * @param {string} key
     * @param {object} patch
     * @returns {object}
     */
    setLayerStyle(key, patch) {
        this.actions.push({ name: 'setLayerStyle', value: { key, patch } })
        return this.getPublicState()
    }

    /**
     * @param {string} color
     * @returns {object}
     */
    setHighlightColor(color) {
        this.actions.push({ name: 'setHighlightColor', value: color })
        return this.getPublicState()
    }

    /**
     * @param {string} id
     * @returns {object}
     */
    toggleFootprintHighlight(id) {
        this.actions.push({ name: 'toggleFootprintHighlight', value: id })
        return this.getPublicState()
    }

    /**
     * @returns {object}
     */
    clearHighlights() {
        this.actions.push({ name: 'clearHighlights' })
        return this.getPublicState()
    }

    /**
     * @param {object} input
     * @returns {object}
     */
    addBadge(input) {
        const badge = { id: 'badge-1', ...input }
        this.badges = [badge]
        this.actions.push({ name: 'addBadge', value: input })
        return { badge, state: this.getPublicState() }
    }

    /**
     * @param {string} id
     * @param {object} patch
     * @returns {object}
     */
    updateBadge(id, patch) {
        this.actions.push({ name: 'updateBadge', value: { id, patch } })
        return this.getPublicState()
    }

    /**
     * @param {string} id
     * @returns {object}
     */
    removeBadge(id) {
        this.actions.push({ name: 'removeBadge', value: id })
        return this.getPublicState()
    }

    /**
     * @returns {object}
     */
    exportSvgForAgent() {
        return { fileName: 'board.svg', svg: '<svg></svg>' }
    }

    /**
     * @returns {object}
     */
    async exportPngForAgent() {
        return {
            fileName: 'board.png',
            mimeType: 'image/png',
            dataUrl: 'data:image/png;base64,abc'
        }
    }
}
