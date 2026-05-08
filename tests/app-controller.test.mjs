// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { strFromU8, unzipSync } from 'fflate'
import { AppController } from '../src/AppController.mjs'
import { AppState } from '../src/core/AppState.mjs'

test('AppController loads files through the loader and renders the board', async () => {
    const board = {
        title: 'Tiny Board',
        pads: [],
        footprints: [],
        drawings: [],
        texts: [],
        outlines: [],
        bounds: {}
    }
    const view = new FakeView()
    const renderer = new FakeRenderer()
    const loader = {
        async loadFiles(files) {
            assert.deepEqual(files, ['file'])
            return { board, sourceFileName: 'minimal.kicad_pcb' }
        }
    }
    const state = new AppState()
    const controller = new AppController({ state, view, loader, renderer })

    await controller.init()
    await view.openFiles(['file'])

    const snapshot = state.getSnapshot()
    assert.equal(snapshot.board, board)
    assert.equal(snapshot.sourceFileName, 'minimal.kicad_pcb')
    assert.equal(snapshot.status, 'Loaded minimal.kicad_pcb.')
    assert.match(view.lastSvg, /data-side="front"/)
})

test('AppController exposes PCB Styler in the public state', async () => {
    const view = new FakeView()
    const renderer = new FakeRenderer()
    const state = new AppState()
    const controller = new AppController({ state, view, renderer })

    await controller.init()

    assert.equal(controller.getPublicState().app, 'PCB Styler')
})

test('AppController summarizes Altium PCB models in public state', async () => {
    const board = {
        kind: 'pcb',
        fileType: 'PcbDoc',
        fileName: 'amp.PcbDoc',
        summary: { title: 'Amp Board' },
        pcb: {
            boardOutline: {
                segments: [{}],
                minX: 10,
                minY: 20,
                widthMil: 300,
                heightMil: 200
            },
            components: [
                { designator: 'U1', layer: 'Top' },
                { designator: 'C1', layer: 'Bottom' }
            ],
            pads: [{}]
        }
    }
    const view = new FakeView()
    const renderer = new FakeRenderer()
    const state = new AppState({ board, sourceFileName: 'amp.PcbDoc' })
    const controller = new AppController({ state, view, renderer })

    await controller.init()

    const publicState = controller.getPublicState()
    assert.equal(publicState.board.title, 'Amp Board')
    assert.equal(publicState.board.footprintCount, 2)
    assert.equal(publicState.board.padCount, 1)
    assert.equal(publicState.board.outline, true)
    assert.deepEqual(publicState.board.bounds, {
        minX: 10,
        minY: 20,
        maxX: 310,
        maxY: 220
    })
    assert.deepEqual(publicState.footprints, [
        { id: 'altium:U1', reference: 'U1', side: 'front' },
        { id: 'altium:C1', reference: 'C1', side: 'back' }
    ])
    assert.equal(controller.exportSvgForAgent().fileName, 'amp.svg')
})

test('AppController toggles side through state', async () => {
    const board = {
        title: 'Tiny Board',
        pads: [],
        footprints: [],
        drawings: [],
        texts: [],
        outlines: [],
        bounds: {}
    }
    const view = new FakeView()
    const renderer = new FakeRenderer()
    const state = new AppState({ board, sourceFileName: 'minimal.kicad_pcb' })
    const controller = new AppController({ state, view, renderer })

    await controller.init()
    view.changeSide('back')

    const snapshot = state.getSnapshot()
    assert.equal(snapshot.side, 'back')
    assert.match(view.lastSvg, /data-side="back"/)
})

test('AppController exposes agent-safe WebMCP actions', async () => {
    const board = {
        title: 'Tiny Board',
        pads: [{}, {}],
        footprints: [{ id: 'footprint:U1:0', reference: 'U1', side: 'front' }],
        drawings: [],
        texts: [],
        outlines: [{}],
        bounds: { minX: 0, minY: 0, maxX: 20, maxY: 30 }
    }
    const view = new FakeView()
    const renderer = new FakeRenderer()
    const state = new AppState({
        board,
        sourceFileName: 'tiny.kicad_pcb',
        boardSource: '(kicad_pcb)'
    })
    const controller = new AppController({ state, view, renderer })

    await controller.init()

    assert.equal(controller.getPublicState().board.padCount, 2)
    assert.equal(controller.getPublicState().footprints[0].reference, 'U1')

    controller.setSide('back')
    controller.setRenderPreset('kicad')
    controller.setLayerStyle('pads', { visible: false })
    controller.setHighlightColor('#123456')
    controller.toggleFootprintHighlight('footprint:U1:0')
    const added = controller.addBadge({
        text: 'A1',
        x: 4,
        y: 5,
        rotation: 90
    })
    controller.updateBadge(added.badge.id, { text: 'A2', rotation: 45 })

    const snapshot = state.getSnapshot()
    assert.equal(snapshot.side, 'back')
    assert.equal(snapshot.renderPreset, 'kicad')
    assert.equal(snapshot.layerStyles.pads.visible, false)
    assert.deepEqual(snapshot.highlightedFootprints, ['footprint:U1:0'])
    assert.equal(snapshot.badges[0].text, 'A2')
    assert.equal(snapshot.badges[0].rotation, 45)
    assert.equal(controller.exportSvgForAgent().fileName, 'tiny.svg')
    assert.deepEqual(await controller.exportPngForAgent(), {
        fileName: 'tiny.png',
        mimeType: 'image/png',
        dataUrl:
            'data:image/png;base64,PHN2ZyBkYXRhLXNpZGU9ImJhY2siPjwvc3ZnPg=='
    })

    controller.removeBadge(added.badge.id)
    controller.clearHighlights()
    assert.deepEqual(state.getSnapshot().badges, [])
    assert.deepEqual(state.getSnapshot().highlightedFootprints, [])
})

test('AppController updates render preset through the view and public API', async () => {
    const board = {
        title: 'Tiny Board',
        pads: [],
        footprints: [],
        drawings: [],
        texts: [],
        outlines: [],
        bounds: {}
    }
    const view = new FakeView()
    const renderer = new FakeRenderer()
    const state = new AppState({ board, sourceFileName: 'minimal.kicad_pcb' })
    const controller = new AppController({ state, view, renderer })

    await controller.init()
    view.changeRenderPreset('kicad')

    assert.equal(state.getSnapshot().renderPreset, 'kicad')
    assert.equal(renderer.lastOptions.renderPreset, 'kicad')

    const publicState = controller.setRenderPreset('manual')
    assert.equal(publicState.renderPreset, 'manual')
    assert.equal(renderer.lastOptions.renderPreset, 'manual')
})

test('AppController updates render layer styles through state', async () => {
    const board = {
        title: 'Tiny Board',
        pads: [],
        footprints: [],
        drawings: [],
        texts: [],
        outlines: [],
        bounds: {}
    }
    const view = new FakeView()
    const renderer = new FakeRenderer()
    const state = new AppState({ board, sourceFileName: 'minimal.kicad_pcb' })
    const controller = new AppController({ state, view, renderer })

    await controller.init()
    view.changeLayerStyle('pads', {
        visible: false,
        fillOpacity: 0.4,
        fillColor: '#123456',
        borderWidth: 0.22
    })

    const snapshot = state.getSnapshot()
    assert.equal(snapshot.layerStyles.pads.visible, false)
    assert.equal(snapshot.layerStyles.pads.fillOpacity, 0.4)
    assert.equal(snapshot.layerStyles.pads.fillColor, '#123456')
    assert.equal(snapshot.layerStyles.pads.borderWidth, 0.22)
    assert.equal(renderer.lastOptions.layerStyles.pads.fillColor, '#123456')
})

test('AppController exports current SVG and PNG renderings', async () => {
    const board = {
        title: 'Tiny Board',
        pads: [],
        footprints: [],
        drawings: [],
        texts: [],
        outlines: [],
        bounds: {}
    }
    const view = new FakeView()
    const renderer = new FakeRenderer()
    const state = new AppState({ board, sourceFileName: 'minimal.kicad_pcb' })
    const controller = new AppController({ state, view, renderer })

    await controller.init()
    view.exportSvg()
    await view.exportPng()

    assert.deepEqual(view.downloads, [
        ['svg', '<svg data-side="front"></svg>', 'minimal.svg'],
        ['png', '<svg data-side="front"></svg>', 'minimal.png']
    ])
})

test('AppController exports and imports PCB Styler project archives', async () => {
    const board = {
        title: 'Tiny Board',
        pads: [],
        footprints: [],
        drawings: [],
        texts: [],
        outlines: [],
        bounds: {}
    }
    const boardSource = '(kicad_pcb (title "Tiny Board"))'
    const view = new FakeView()
    const renderer = new FakeRenderer()
    const state = new AppState()
    let loadCount = 0
    const loader = {
        async loadFiles(files) {
            loadCount += 1
            if (loadCount === 1) {
                assert.deepEqual(files, ['board-file'])
                return {
                    board,
                    sourceFileName: 'minimal.kicad_pcb',
                    sourceText: boardSource
                }
            }

            assert.deepEqual(files, ['project-file'])
            return {
                board,
                sourceFileName: 'minimal.kicad_pcb',
                sourceText: boardSource,
                projectSettings: {
                    side: 'back',
                    highlightColor: '#ff4422',
                    highlightedFootprints: ['footprint:U1:0'],
                    badges: [
                        {
                            id: 'badge-1',
                            text: 'A1',
                            x: 12,
                            y: 20,
                            rotation: 90,
                            side: 'back'
                        }
                    ],
                    badgeStyle: {
                        foregroundColor: '#111111',
                        scale: 1.5,
                        shadowColor: '#222222',
                        shadowOpacity: 0.25,
                        shadowBlur: 1,
                        shadowOffsetX: 0.5,
                        shadowOffsetY: 0.5
                    }
                }
            }
        }
    }
    const controller = new AppController({ state, view, loader, renderer })

    await controller.init()
    await view.openFiles(['board-file'])
    view.changeSide('back')
    view.toggleComponent('footprint:U1:0')
    view.changeHighlightColor('#ff4422')
    view.changeLayerStyle('pads', { visible: false })
    view.exportProject()

    const [kind, bytes, fileName] = view.downloads[0]
    const entries = unzipSync(bytes)
    const settings = JSON.parse(strFromU8(entries['settings.json']))

    assert.equal(kind, 'project')
    assert.equal(fileName, 'minimal-project.zip')
    assert.equal(strFromU8(entries['minimal.kicad_pcb']), boardSource)
    assert.equal(settings.settings.side, 'back')
    assert.equal(settings.settings.highlightColor, '#ff4422')
    assert.equal(settings.settings.layerStyles.pads.visible, false)

    await view.openFiles(['project-file'])
    const snapshot = state.getSnapshot()

    assert.equal(snapshot.side, 'back')
    assert.equal(snapshot.highlightColor, '#ff4422')
    assert.deepEqual(snapshot.highlightedFootprints, ['footprint:U1:0'])
    assert.deepEqual(snapshot.badges, [
        {
            id: 'badge-1',
            text: 'A1',
            x: 12,
            y: 20,
            rotation: 90,
            side: 'back'
        }
    ])
    assert.equal(snapshot.badgeStyle.scale, 1.5)
})

test('AppController exports Altium project archives from source bytes', async () => {
    const board = {
        kind: 'pcb',
        fileType: 'PcbDoc',
        fileName: 'amp.PcbDoc',
        pcb: { components: [], pads: [], boardOutline: {} }
    }
    const sourceBytes = new Uint8Array([1, 2, 3, 4])
    const view = new FakeView()
    const renderer = new FakeRenderer()
    const state = new AppState()
    const loader = {
        async loadFiles(files) {
            assert.deepEqual(files, ['altium-file'])
            return {
                board,
                sourceFileName: 'amp.PcbDoc',
                sourceBytes,
                sourceFormat: 'altium'
            }
        }
    }
    const controller = new AppController({ state, view, loader, renderer })

    await controller.init()
    await view.openFiles(['altium-file'])
    view.toggleComponent('altium:U1')
    view.exportProject()

    const [kind, bytes, fileName] = view.downloads[0]
    const entries = unzipSync(bytes)
    const settings = JSON.parse(strFromU8(entries['settings.json']))

    assert.equal(kind, 'project')
    assert.equal(fileName, 'amp-project.zip')
    assert.deepEqual([...entries['amp.PcbDoc']], [...sourceBytes])
    assert.equal(settings.sourceFormat, 'altium')
    assert.equal(settings.pcbFileName, 'amp.PcbDoc')
    assert.deepEqual(settings.settings.highlightedFootprints, ['altium:U1'])
})

test('AppController toggles and styles component highlights', async () => {
    const board = {
        title: 'Tiny Board',
        pads: [],
        footprints: [],
        drawings: [],
        texts: [],
        outlines: [],
        bounds: {}
    }
    const view = new FakeView()
    const renderer = new FakeRenderer()
    const state = new AppState({ board, sourceFileName: 'minimal.kicad_pcb' })
    const controller = new AppController({ state, view, renderer })

    await controller.init()
    view.toggleComponent('footprint:U1:0')
    view.hoverComponent('footprint:R1:1')
    view.changeHighlightColor('#123456')
    view.changeBadgeStyle({
        foregroundColor: '#223344',
        scale: 1.4,
        shadowOpacity: 0.5
    })

    let snapshot = state.getSnapshot()
    assert.deepEqual(snapshot.highlightedFootprints, ['footprint:U1:0'])
    assert.equal(snapshot.hoveredFootprintId, 'footprint:R1:1')
    assert.equal(snapshot.highlightColor, '#123456')
    assert.equal(snapshot.badgeStyle.foregroundColor, '#223344')
    assert.equal(snapshot.badgeStyle.scale, 1.4)
    assert.equal(snapshot.badgeStyle.shadowOpacity, 0.5)
    assert.deepEqual(renderer.lastOptions.highlightedFootprints, [
        'footprint:U1:0'
    ])
    assert.equal(renderer.lastOptions.hoveredFootprintId, 'footprint:R1:1')
    assert.equal(renderer.lastOptions.highlightColor, '#123456')
    assert.deepEqual(renderer.lastOptions.badgeStyle, snapshot.badgeStyle)

    view.toggleComponent('footprint:U1:0')
    snapshot = state.getSnapshot()
    assert.deepEqual(snapshot.highlightedFootprints, [])

    view.toggleComponent('footprint:U1:0')
    view.toggleComponent('footprint:R1:1')
    view.clearHighlights()
    snapshot = state.getSnapshot()
    assert.deepEqual(snapshot.highlightedFootprints, [])
})

test('AppController exposes hovered KiCad component information', async () => {
    const board = {
        title: 'Tiny Board',
        pads: [],
        footprints: [
            {
                id: 'footprint:U1:0',
                reference: 'U1',
                value: 'MCU',
                description: 'Main controller',
                footprint: 'Package_QFP:TQFP-44',
                side: 'front'
            }
        ],
        drawings: [],
        texts: [],
        outlines: [],
        bounds: {}
    }
    const view = new FakeView()
    const renderer = new FakeRenderer()
    const state = new AppState({ board, sourceFileName: 'tiny.kicad_pcb' })
    const controller = new AppController({ state, view, renderer })

    await controller.init()
    view.hoverComponent('footprint:U1:0')

    assert.deepEqual(controller.getPublicState().hoveredComponent, {
        id: 'footprint:U1:0',
        reference: 'U1',
        side: 'front',
        value: 'MCU',
        description: 'Main controller',
        package: 'Package_QFP:TQFP-44',
        sourceFormat: 'KiCad'
    })
})

test('AppController exposes hovered Altium component information', async () => {
    const board = {
        kind: 'pcb',
        fileType: 'PcbDoc',
        fileName: 'amp.PcbDoc',
        pcb: {
            components: [
                {
                    designator: 'U3',
                    comment: 'Op amp',
                    description: 'Audio amplifier',
                    pattern: 'SOIC-8',
                    layer: 'Bottom'
                }
            ],
            pads: [],
            boardOutline: {}
        }
    }
    const view = new FakeView()
    const renderer = new FakeRenderer()
    const state = new AppState({ board, sourceFileName: 'amp.PcbDoc' })
    const controller = new AppController({ state, view, renderer })

    await controller.init()
    view.hoverComponent('altium:U3')

    assert.deepEqual(controller.getPublicState().hoveredComponent, {
        id: 'altium:U3',
        reference: 'U3',
        side: 'back',
        value: 'Op amp',
        description: 'Audio amplifier',
        package: 'SOIC-8',
        sourceFormat: 'Altium'
    })
})

test('AppController exposes unknown hovered footprint ids', async () => {
    const board = {
        title: 'Tiny Board',
        pads: [],
        footprints: [],
        drawings: [],
        texts: [],
        outlines: [],
        bounds: {}
    }
    const view = new FakeView()
    const renderer = new FakeRenderer()
    const state = new AppState({ board, sourceFileName: 'tiny.kicad_pcb' })
    const controller = new AppController({ state, view, renderer })

    await controller.init()
    view.hoverComponent('footprint:Missing:9')

    assert.deepEqual(controller.getPublicState().hoveredComponent, {
        id: 'footprint:Missing:9',
        sourceFormat: 'KiCad'
    })
})

test('AppController creates, edits, moves, and removes badges', async () => {
    const board = {
        title: 'Tiny Board',
        pads: [],
        footprints: [],
        drawings: [],
        texts: [],
        outlines: [],
        bounds: {
            minX: 10,
            minY: 20,
            maxX: 30,
            maxY: 40,
            width: 20,
            height: 20
        }
    }
    const view = new FakeView()
    const renderer = new FakeRenderer()
    const state = new AppState({ board, sourceFileName: 'minimal.kicad_pcb' })
    const controller = new AppController({ state, view, renderer })

    await controller.init()
    view.addBadge()
    view.addBadge()

    let snapshot = state.getSnapshot()
    assert.deepEqual(
        snapshot.badges.map((badge) => badge.text),
        ['1', '2']
    )
    assert.equal(snapshot.badges[0].x, 20)
    assert.equal(snapshot.badges[0].y, 30)
    assert.equal(snapshot.badges[1].x, 24)
    assert.equal(snapshot.badges[1].y, 34)
    assert.equal(snapshot.badges[0].rotation, 0)
    assert.equal(snapshot.badges[0].side, 'front')
    assert.deepEqual(renderer.lastOptions.badges, snapshot.badges)

    view.changeBadgeText(snapshot.badges[0].id, 'A1')
    view.changeBadgeRotation(snapshot.badges[0].id, 45)
    view.moveBadge(snapshot.badges[0].id, { x: 12.5, y: 25.75 })
    snapshot = state.getSnapshot()
    assert.equal(snapshot.badges[0].text, 'A1')
    assert.equal(snapshot.badges[0].rotation, 45)
    assert.equal(snapshot.badges[0].x, 12.5)
    assert.equal(snapshot.badges[0].y, 25.75)

    view.removeBadge(snapshot.badges[0].id)
    snapshot = state.getSnapshot()
    assert.deepEqual(
        snapshot.badges.map((badge) => badge.text),
        ['2']
    )
})

class FakeRenderer {
    constructor() {
        this.lastOptions = null
    }

    /**
     * @param {object | null} _board
     * @param {{ side: string, renderPreset?: string, layerStyles: object }} options
     * @returns {string}
     */
    render(_board, options) {
        this.lastOptions = options
        return `<svg data-side="${options.side}"></svg>`
    }
}

class FakeView {
    constructor() {
        this.lastSvg = ''
        this.openFiles = () => {}
        this.changeSide = () => {}
        this.changeRenderPreset = () => {}
        this.changeLayerStyle = () => {}
        this.toggleComponent = () => {}
        this.hoverComponent = () => {}
        this.changeHighlightColor = () => {}
        this.changeBadgeStyle = () => {}
        this.clearHighlights = () => {}
        this.addBadge = () => {}
        this.changeBadgeText = () => {}
        this.changeBadgeRotation = () => {}
        this.moveBadge = () => {}
        this.removeBadge = () => {}
        this.exportSvg = () => {}
        this.exportPng = async () => {}
        this.exportProject = () => {}
        this.downloads = []
    }

    /**
     * @param {(files: unknown[]) => Promise<void>} callback
     */
    bindOpenFiles(callback) {
        this.openFiles = callback
    }

    /**
     * @param {(side: string) => void} callback
     */
    bindSideChange(callback) {
        this.changeSide = callback
    }

    /**
     * @param {(preset: string) => void} callback
     */
    bindRenderPresetChange(callback) {
        this.changeRenderPreset = callback
    }

    /**
     * @param {(key: string, patch: object) => void} callback
     */
    bindLayerStyleChange(callback) {
        this.changeLayerStyle = callback
    }

    /**
     * @param {(id: string) => void} callback
     */
    bindComponentToggle(callback) {
        this.toggleComponent = callback
    }

    /**
     * @param {(id: string) => void} callback
     */
    bindComponentHover(callback) {
        this.hoverComponent = callback
    }

    /**
     * @param {(color: string) => void} callback
     */
    bindHighlightColorChange(callback) {
        this.changeHighlightColor = callback
    }

    /**
     * @param {(patch: object) => void} callback
     */
    bindBadgeStyleChange(callback) {
        this.changeBadgeStyle = callback
    }

    /**
     * @param {() => void} callback
     */
    bindClearHighlights(callback) {
        this.clearHighlights = callback
    }

    /**
     * @param {() => void} callback
     */
    bindAddBadge(callback) {
        this.addBadge = callback
    }

    /**
     * @param {(id: string, text: string) => void} callback
     */
    bindBadgeTextChange(callback) {
        this.changeBadgeText = callback
    }

    /**
     * @param {(id: string, rotation: number) => void} callback
     */
    bindBadgeRotationChange(callback) {
        this.changeBadgeRotation = callback
    }

    /**
     * @param {(id: string, point: { x: number, y: number }) => void} callback
     */
    bindBadgeMove(callback) {
        this.moveBadge = callback
    }

    /**
     * @param {(id: string) => void} callback
     */
    bindRemoveBadge(callback) {
        this.removeBadge = callback
    }

    /**
     * @param {() => Promise<void>} callback
     */
    bindExportPng(callback) {
        this.exportPng = callback
    }

    /**
     * @param {() => void} callback
     */
    bindExportSvg(callback) {
        this.exportSvg = callback
    }

    /**
     * @param {() => void} callback
     */
    bindExportProject(callback) {
        this.exportProject = callback
    }

    /**
     * @param {string} svg
     * @param {string} fileName
     */
    downloadSvg(svg, fileName) {
        this.downloads.push(['svg', svg, fileName])
    }

    /**
     * @param {string} svg
     * @param {string} fileName
     */
    async downloadPng(svg, fileName) {
        this.downloads.push(['png', svg, fileName])
    }

    /**
     * @param {string} svg
     * @returns {Promise<string>}
     */
    async renderPngDataUrl(svg) {
        return (
            'data:image/png;base64,' +
            Buffer.from(svg, 'utf8').toString('base64')
        )
    }

    /**
     * @param {Uint8Array} bytes
     * @param {string} fileName
     */
    downloadProject(bytes, fileName) {
        this.downloads.push(['project', bytes, fileName])
    }

    /**
     * @param {object} _snapshot
     * @param {string} svg
     */
    render(_snapshot, svg) {
        this.lastSvg = svg
    }

    setStatus() {}
}
