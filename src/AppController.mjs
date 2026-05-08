// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: AGPL-3.0-or-later

import { BoardFileLoader } from './core/BoardFileLoader.mjs'
import { ProjectArchive } from './core/ProjectArchive.mjs'
import { BoardSvgRenderer } from './ui/BoardSvgRenderer.mjs'

/**
 * Coordinates app state, PCB loading, rendering, and exports.
 */
export class AppController {
    /** @type {import('./core/AppState.mjs').AppState} */
    #state

    /** @type {import('./ui/AppView.mjs').AppView} */
    #view

    /** @type {{ loadFiles: (files: FileList | File[]) => Promise<{ board: object, sourceFileName: string, sourceText?: string, sourceBytes?: Uint8Array | null, projectSettings?: object | null, sourceFormat?: string }> }} */
    #loader

    /** @type {{ render: (board: object | null, options: { side: string, renderPreset?: string, layerStyles: Record<string, object>, highlightedFootprints?: readonly string[], hoveredFootprintId?: string, highlightColor?: string, badges?: readonly object[], badgeStyle?: object }) => string }} */
    #renderer

    /**
     * @param {{
     * state: import('./core/AppState.mjs').AppState,
     * view: import('./ui/AppView.mjs').AppView,
     * loader?: { loadFiles: (files: FileList | File[]) => Promise<{ board: object, sourceFileName: string, sourceText?: string, sourceBytes?: Uint8Array | null, projectSettings?: object | null, sourceFormat?: string }> },
     * renderer?: { render: (board: object | null, options: { side: string, renderPreset?: string, layerStyles: Record<string, object>, highlightedFootprints?: readonly string[], hoveredFootprintId?: string, highlightColor?: string, badges?: readonly object[], badgeStyle?: object }) => string }
     * }} dependencies
     */
    constructor(dependencies) {
        this.#state = dependencies.state
        this.#view = dependencies.view
        this.#loader = dependencies.loader || new BoardFileLoader()
        this.#renderer = dependencies.renderer || new BoardSvgRenderer()
    }

    /**
     * Initializes event wiring and first render.
     * @returns {Promise<void>}
     */
    async init() {
        this.#state.subscribe((snapshot) => {
            this.#view.render(
                enrichViewSnapshot(snapshot),
                this.#renderSvg(snapshot)
            )
            this.#view.setStatus(snapshot.status)
        })

        this.#view.bindOpenFiles((files) => this.#handleOpenFiles(files))
        this.#view.bindSideChange((side) => this.#handleSideChange(side))
        this.#view.bindRenderPresetChange((preset) =>
            this.#handleRenderPresetChange(preset)
        )
        this.#view.bindLayerStyleChange((key, patch) =>
            this.#handleLayerStyleChange(key, patch)
        )
        this.#view.bindComponentToggle((id) => this.#handleComponentToggle(id))
        this.#view.bindComponentHover((id) => this.#handleComponentHover(id))
        this.#view.bindHighlightColorChange((color) =>
            this.#handleHighlightColorChange(color)
        )
        this.#view.bindBadgeStyleChange((patch) =>
            this.#handleBadgeStyleChange(patch)
        )
        this.#view.bindClearHighlights(() => this.#handleClearHighlights())
        this.#view.bindAddBadge(() => this.#handleAddBadge())
        this.#view.bindBadgeTextChange((id, text) =>
            this.#handleBadgeTextChange(id, text)
        )
        this.#view.bindBadgeRotationChange((id, rotation) =>
            this.#handleBadgeRotationChange(id, rotation)
        )
        this.#view.bindBadgeMove((id, point) =>
            this.#handleBadgeMove(id, point)
        )
        this.#view.bindRemoveBadge((id) => this.#handleRemoveBadge(id))
        this.#view.bindExportSvg(() => this.#handleExportSvg())
        this.#view.bindExportPng(() => this.#handleExportPng())
        this.#view.bindExportProject(() => this.#handleExportProject())
    }

    /**
     * Returns a stable state snapshot for integration consumers.
     * @returns {{ app: string, sourceFileName: string, side: string, renderPreset: string, status: string, loaded: boolean, board: object | null, footprints: object[], hoveredComponent: object | null, layerStyles: object, highlightedFootprints: readonly string[], highlightColor: string, badges: readonly object[], badgeStyle: object }}
     */
    getPublicState() {
        const snapshot = this.#state.getSnapshot()
        return {
            app: 'PCB Styler',
            sourceFileName: snapshot.sourceFileName,
            side: snapshot.side,
            renderPreset: snapshot.renderPreset,
            status: snapshot.status,
            loaded: Boolean(snapshot.board),
            board: summarizeBoard(snapshot.board),
            footprints: summarizeFootprints(snapshot.board),
            hoveredComponent: summarizeHoveredComponent(
                snapshot.board,
                snapshot.hoveredFootprintId
            ),
            layerStyles: snapshot.layerStyles,
            highlightedFootprints: snapshot.highlightedFootprints,
            highlightColor: snapshot.highlightColor,
            badges: snapshot.badges,
            badgeStyle: snapshot.badgeStyle
        }
    }

    /**
     * Switches side through the same path as the UI.
     * @param {string} side
     * @returns {object}
     */
    setSide(side) {
        this.#handleSideChange(side)
        return this.getPublicState()
    }

    /**
     * Switches render style preset through the same path as the UI.
     * @param {string} preset
     * @returns {object}
     */
    setRenderPreset(preset) {
        this.#handleRenderPresetChange(preset)
        return this.getPublicState()
    }

    /**
     * Updates one layer style through the same path as the UI.
     * @param {string} key
     * @param {object} patch
     * @returns {object}
     */
    setLayerStyle(key, patch) {
        this.#handleLayerStyleChange(key, patch)
        return this.getPublicState()
    }

    /**
     * Updates the persistent highlight color.
     * @param {string} color
     * @returns {object}
     */
    setHighlightColor(color) {
        this.#handleHighlightColorChange(color)
        return this.getPublicState()
    }

    /**
     * Toggles one component highlight.
     * @param {string} footprintId
     * @returns {object}
     */
    toggleFootprintHighlight(footprintId) {
        this.#handleComponentToggle(footprintId)
        return this.getPublicState()
    }

    /**
     * Clears persistent highlights.
     * @returns {object}
     */
    clearHighlights() {
        this.#handleClearHighlights()
        return this.getPublicState()
    }

    /**
     * Adds a badge and returns the created badge plus state.
     * @param {{ text?: unknown, x?: unknown, y?: unknown, rotation?: unknown, side?: unknown }} [input]
     * @returns {{ badge: object, state: object }}
     */
    addBadge(input = {}) {
        const snapshot = this.#state.getSnapshot()
        if (!snapshot.board) {
            throw new Error('Open a board before adding badges.')
        }

        const point = nextBadgePoint(
            snapshot.board,
            snapshot.badges,
            snapshot.side
        )
        const badge = {
            id: nextBadgeId(snapshot.badges),
            text:
                'text' in input
                    ? String(input.text ?? '')
                    : nextBadgeText(snapshot.badges),
            x: finiteOrDefault(input.x, point.x),
            y: finiteOrDefault(input.y, point.y),
            rotation: finiteOrDefault(input.rotation, 0),
            side: input.side === 'back' ? 'back' : snapshot.side
        }

        this.#state.setValue('badges', [...snapshot.badges, badge])
        const created = this.#state
            .getSnapshot()
            .badges.find((item) => item.id === badge.id)
        return {
            badge: created || badge,
            state: this.getPublicState()
        }
    }

    /**
     * Updates a badge and returns state.
     * @param {string} id
     * @param {{ text?: unknown, x?: unknown, y?: unknown, rotation?: unknown }} patch
     * @returns {object}
     */
    updateBadge(id, patch) {
        this.#updateBadge(id, normalizeBadgePatch(patch))
        return this.getPublicState()
    }

    /**
     * Removes a badge and returns state.
     * @param {string} id
     * @returns {object}
     */
    removeBadge(id) {
        this.#handleRemoveBadge(id)
        return this.getPublicState()
    }

    /**
     * Returns current SVG content for agent integrations without downloading.
     * @returns {{ fileName: string, svg: string }}
     */
    exportSvgForAgent() {
        const snapshot = this.#state.getSnapshot()
        if (!snapshot.board) throw new Error('Open a board before SVG export.')

        return {
            fileName: exportFileName(snapshot.sourceFileName, 'svg'),
            svg: this.#renderSvg(snapshot)
        }
    }

    /**
     * Returns current PNG content for agent integrations without downloading.
     * @returns {Promise<{ fileName: string, mimeType: string, dataUrl: string }>}
     */
    async exportPngForAgent() {
        const snapshot = this.#state.getSnapshot()
        if (!snapshot.board) throw new Error('Open a board before PNG export.')

        return {
            fileName: exportFileName(snapshot.sourceFileName, 'png'),
            mimeType: 'image/png',
            dataUrl: await this.#view.renderPngDataUrl(
                this.#renderSvg(snapshot)
            )
        }
    }

    /**
     * Handles file selection.
     * @param {FileList | File[]} files
     * @returns {Promise<void>}
     */
    async #handleOpenFiles(files) {
        if (!files || files.length === 0) return

        this.#state.setValue('status', 'Loading PCB board...')

        try {
            const result = await this.#loader.loadFiles(files)
            this.#state.patch({
                board: result.board,
                sourceFileName: result.sourceFileName,
                boardSource: result.sourceText || '',
                sourceBytes: result.sourceBytes || null,
                sourceFormat: result.sourceFormat || '',
                ...(result.projectSettings || {}),
                status: result.projectSettings
                    ? 'Loaded ' + result.sourceFileName + ' with settings.'
                    : 'Loaded ' + result.sourceFileName + '.'
            })
        } catch (error) {
            this.#state.patch({
                board: null,
                sourceFileName: '',
                boardSource: '',
                sourceBytes: null,
                sourceFormat: '',
                status:
                    error instanceof Error
                        ? error.message
                        : 'Could not load board.'
            })
        }
    }

    /**
     * Handles side switching.
     * @param {string} side
     * @returns {void}
     */
    #handleSideChange(side) {
        this.#state.setValue('side', side === 'back' ? 'back' : 'front')
    }

    /**
     * Handles render preset switching.
     * @param {string} preset
     * @returns {void}
     */
    #handleRenderPresetChange(preset) {
        this.#state.setValue(
            'renderPreset',
            preset === 'kicad' ? 'kicad' : 'manual'
        )
    }

    /**
     * Handles render layer style changes.
     * @param {string} key
     * @param {object} patch
     * @returns {void}
     */
    #handleLayerStyleChange(key, patch) {
        this.#state.patch({
            layerStyles: { [key]: patch }
        })
    }

    /**
     * Toggles a footprint's persistent highlight.
     * @param {string} footprintId
     * @returns {void}
     */
    #handleComponentToggle(footprintId) {
        const id = String(footprintId || '').trim()
        if (!id) return

        const highlighted = this.#state.getSnapshot().highlightedFootprints
        this.#state.setValue(
            'highlightedFootprints',
            highlighted.includes(id)
                ? highlighted.filter((item) => item !== id)
                : [...highlighted, id]
        )
    }

    /**
     * Updates the currently hovered footprint.
     * @param {string} footprintId
     * @returns {void}
     */
    #handleComponentHover(footprintId) {
        this.#state.setValue('hoveredFootprintId', footprintId)
    }

    /**
     * Updates the persistent highlight color.
     * @param {string} color
     * @returns {void}
     */
    #handleHighlightColorChange(color) {
        this.#state.setValue('highlightColor', color)
    }

    /**
     * Updates configurable badge style.
     * @param {object} patch
     * @returns {void}
     */
    #handleBadgeStyleChange(patch) {
        this.#state.setValue('badgeStyle', patch)
    }

    /**
     * Clears all persistent component highlights.
     * @returns {void}
     */
    #handleClearHighlights() {
        this.#state.patch({
            highlightedFootprints: [],
            hoveredFootprintId: ''
        })
    }

    /**
     * Adds a new badge at the board center on the active side.
     * @returns {void}
     */
    #handleAddBadge() {
        this.addBadge()
    }

    /**
     * Updates badge text.
     * @param {string} id
     * @param {string} text
     * @returns {void}
     */
    #handleBadgeTextChange(id, text) {
        this.#updateBadge(id, { text })
    }

    /**
     * Updates badge rotation.
     * @param {string} id
     * @param {number} rotation
     * @returns {void}
     */
    #handleBadgeRotationChange(id, rotation) {
        const value = Number(rotation)
        if (!Number.isFinite(value)) return

        this.#updateBadge(id, { rotation: value })
    }

    /**
     * Moves a badge to a board coordinate.
     * @param {string} id
     * @param {{ x: number, y: number }} point
     * @returns {void}
     */
    #handleBadgeMove(id, point) {
        const x = Number(point.x)
        const y = Number(point.y)
        if (!Number.isFinite(x) || !Number.isFinite(y)) return

        this.#updateBadge(id, { x, y })
    }

    /**
     * Removes one badge.
     * @param {string} id
     * @returns {void}
     */
    #handleRemoveBadge(id) {
        const clean = String(id || '').trim()
        if (!clean) return

        const badges = this.#state
            .getSnapshot()
            .badges.filter((badge) => badge.id !== clean)
        this.#state.setValue('badges', badges)
    }

    /**
     * Applies a badge patch.
     * @param {string} id
     * @param {object} patch
     * @returns {void}
     */
    #updateBadge(id, patch) {
        const clean = String(id || '').trim()
        if (!clean) return

        const badges = this.#state.getSnapshot().badges.map((badge) =>
            badge.id === clean
                ? {
                      ...badge,
                      ...patch
                  }
                : badge
        )
        this.#state.setValue('badges', badges)
    }

    /**
     * Exports current SVG.
     * @returns {void}
     */
    #handleExportSvg() {
        const snapshot = this.#state.getSnapshot()
        if (!snapshot.board) return
        this.#view.downloadSvg(
            this.#renderSvg(snapshot),
            exportFileName(snapshot.sourceFileName, 'svg')
        )
    }

    /**
     * Exports current transparent PNG.
     * @returns {Promise<void>}
     */
    async #handleExportPng() {
        const snapshot = this.#state.getSnapshot()
        if (!snapshot.board) return
        await this.#view.downloadPng(
            this.#renderSvg(snapshot),
            exportFileName(snapshot.sourceFileName, 'png')
        )
    }

    /**
     * Exports the current PCB and settings as a project ZIP.
     * @returns {void}
     */
    #handleExportProject() {
        const snapshot = this.#state.getSnapshot()
        if (!snapshot.board) return

        try {
            const fileName = ProjectArchive.projectFileName(
                snapshot.sourceFileName
            )
            this.#view.downloadProject(
                ProjectArchive.create(snapshot),
                fileName
            )
        } catch (error) {
            this.#state.setValue(
                'status',
                error instanceof Error
                    ? error.message
                    : 'Project export failed.'
            )
        }
    }

    /**
     * Renders current SVG.
     * @param {{ board: object | null, side: string, renderPreset?: string, layerStyles: Record<string, object>, highlightedFootprints: readonly string[], hoveredFootprintId: string, highlightColor: string, badges: readonly object[], badgeStyle: object }} snapshot
     * @returns {string}
     */
    #renderSvg(snapshot) {
        return this.#renderer.render(snapshot.board, {
            side: snapshot.side,
            renderPreset: snapshot.renderPreset,
            layerStyles: snapshot.layerStyles,
            highlightedFootprints: snapshot.highlightedFootprints,
            hoveredFootprintId: snapshot.hoveredFootprintId,
            highlightColor: snapshot.highlightColor,
            badges: snapshot.badges,
            badgeStyle: snapshot.badgeStyle
        })
    }
}

/**
 * Adds derived view-only fields to a state snapshot.
 * @param {{ board: object | null, hoveredFootprintId: string }} snapshot
 * @returns {object}
 */
function enrichViewSnapshot(snapshot) {
    return {
        ...snapshot,
        hoveredComponent: summarizeHoveredComponent(
            snapshot.board,
            snapshot.hoveredFootprintId
        )
    }
}

/**
 * Creates an export filename from the source board path.
 * @param {string} sourceFileName
 * @param {string} extension
 * @returns {string}
 */
function exportFileName(sourceFileName, extension) {
    const clean = String(sourceFileName || 'pcb')
        .split('/')
        .pop()
        .replace(/\.kicad_pcb$/i, '')
        .replace(/\.pcbdoc$/i, '')
        .replace(/[^a-z0-9._-]+/gi, '-')
        .replace(/^-+|-+$/g, '')
    return (clean || 'pcb') + '.' + extension
}

/**
 * Returns the center point for the board bounds.
 * @param {{ bounds?: { minX: number, minY: number, maxX: number, maxY: number } }} board
 * @returns {{ x: number, y: number }}
 */
function boardCenter(board) {
    const bounds = board.bounds ||
        altiumBoardBounds(board) || {
            minX: 0,
            minY: 0,
            maxX: 0,
            maxY: 0
        }
    const minX = finiteOrZero(bounds.minX)
    const minY = finiteOrZero(bounds.minY)
    const maxX = finiteOrZero(bounds.maxX)
    const maxY = finiteOrZero(bounds.maxY)
    return {
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2
    }
}

/**
 * Returns a non-overlapping initial point for a new badge on one side.
 * @param {object} board
 * @param {readonly object[]} badges
 * @param {'front' | 'back'} side
 * @returns {{ x: number, y: number }}
 */
function nextBadgePoint(board, badges, side) {
    const center = boardCenter(board)
    const offset = badges.filter((badge) => badge.side === side).length * 4
    return {
        x: center.x + offset,
        y: center.y + offset
    }
}

/**
 * Converts a numeric input to a finite coordinate.
 * @param {unknown} value
 * @returns {number}
 */
function finiteOrZero(value) {
    const number = Number(value)
    return Number.isFinite(number) ? number : 0
}

/**
 * Converts a numeric input to a finite value with fallback.
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
function finiteOrDefault(value, fallback) {
    const number = Number(value)
    return Number.isFinite(number) ? number : fallback
}

/**
 * Normalizes a public badge patch.
 * @param {{ text?: unknown, x?: unknown, y?: unknown, rotation?: unknown }} patch
 * @returns {object}
 */
function normalizeBadgePatch(patch) {
    const clean = {}
    if ('text' in patch) clean.text = String(patch.text ?? '')
    if ('x' in patch && Number.isFinite(Number(patch.x))) {
        clean.x = Number(patch.x)
    }
    if ('y' in patch && Number.isFinite(Number(patch.y))) {
        clean.y = Number(patch.y)
    }
    if ('rotation' in patch && Number.isFinite(Number(patch.rotation))) {
        clean.rotation = Number(patch.rotation)
    }
    return clean
}

/**
 * Creates a compact public board summary.
 * @param {object | null} board
 * @returns {object | null}
 */
function summarizeBoard(board) {
    if (!board) return null
    if (isAltiumPcbModel(board)) {
        const pcb = board.pcb || {}
        const outline = pcb.boardOutline || {}
        return {
            title: String(board.summary?.title || board.fileName || ''),
            footprintCount: Array.isArray(pcb.components)
                ? pcb.components.length
                : 0,
            padCount: Array.isArray(pcb.pads) ? pcb.pads.length : 0,
            outline:
                Array.isArray(outline.segments) && outline.segments.length > 0,
            bounds: altiumBoardBounds(board)
        }
    }

    return {
        title: String(board.title || ''),
        footprintCount: Array.isArray(board.footprints)
            ? board.footprints.length
            : 0,
        padCount: Array.isArray(board.pads) ? board.pads.length : 0,
        outline: Array.isArray(board.outlines) && board.outlines.length > 0,
        bounds: board.bounds || null
    }
}

/**
 * Creates compact public footprint summaries.
 * @param {object | null} board
 * @returns {object[]}
 */
function summarizeFootprints(board) {
    if (!board) return []
    if (isAltiumPcbModel(board)) {
        return (board.pcb?.components || []).map((component, index) => ({
            id: altiumComponentId(component, index),
            reference: componentReference(component),
            side:
                String(component.layer || '').toLowerCase() === 'bottom'
                    ? 'back'
                    : 'front'
        }))
    }
    if (!Array.isArray(board.footprints)) return []

    return board.footprints.map((footprint) => ({
        id: String(footprint.id || ''),
        reference: String(footprint.reference || ''),
        side: footprint.side === 'back' ? 'back' : 'front'
    }))
}

/**
 * Creates compact public information for the currently hovered component.
 * @param {object | null} board
 * @param {unknown} footprintId
 * @returns {object | null}
 */
function summarizeHoveredComponent(board, footprintId) {
    const id = String(footprintId || '').trim()
    if (!board || !id) return null

    return isAltiumPcbModel(board)
        ? summarizeHoveredAltiumComponent(board, id)
        : summarizeHoveredKicadComponent(board, id)
}

/**
 * Creates hovered component info from a KiCad footprint.
 * @param {object} board
 * @param {string} id
 * @returns {object}
 */
function summarizeHoveredKicadComponent(board, id) {
    const footprint = (board.footprints || []).find(
        (item) => String(item?.id || '').trim() === id
    )
    if (!footprint) return { id, sourceFormat: 'KiCad' }

    return compactComponentInfo({
        id,
        reference: firstString(footprint.reference, footprint.ref),
        side: normalizeSide(footprint.side),
        value: firstString(footprint.value, footprint.properties?.Value),
        description: firstString(
            footprint.description,
            footprint.properties?.Description
        ),
        package: firstString(
            footprint.footprint,
            footprint.package,
            footprint.libId
        ),
        sourceFormat: 'KiCad'
    })
}

/**
 * Creates hovered component info from an Altium component.
 * @param {object} board
 * @param {string} id
 * @returns {object}
 */
function summarizeHoveredAltiumComponent(board, id) {
    const components = board.pcb?.components || []
    const component = components.find(
        (item, index) => altiumComponentId(item, index) === id
    )
    if (!component) return { id, sourceFormat: 'Altium' }

    return compactComponentInfo({
        id,
        reference: componentReference(component),
        side: normalizeSide(component.layer),
        value: firstString(component.comment, component.value),
        description: firstString(component.description, component.source),
        package: firstString(
            component.pattern,
            component.footprint,
            component.package
        ),
        sourceFormat: 'Altium'
    })
}

/**
 * Removes empty optional fields from a component info object.
 * @param {Record<string, unknown>} info
 * @returns {object}
 */
function compactComponentInfo(info) {
    const compact = {}
    Object.entries(info).forEach(([key, value]) => {
        const text = String(value || '').trim()
        if (text) compact[key] = text
    })
    return compact
}

/**
 * Returns the first non-empty string from a list of values.
 * @param {...unknown} values
 * @returns {string}
 */
function firstString(...values) {
    for (const value of values) {
        const text = String(value || '').trim()
        if (text) return text
    }
    return ''
}

/**
 * Normalizes component side metadata.
 * @param {unknown} value
 * @returns {string}
 */
function normalizeSide(value) {
    const side = String(value || '')
        .trim()
        .toLowerCase()
    if (side === 'back' || side === 'bottom') return 'back'
    if (side === 'front' || side === 'top') return 'front'
    return ''
}

/**
 * Returns the app-level Altium footprint id.
 * @param {object} component
 * @param {number} index
 * @returns {string}
 */
function altiumComponentId(component, index) {
    return 'altium:' + (componentReference(component) || String(index))
}

/**
 * Returns the visible component reference.
 * @param {object} component
 * @returns {string}
 */
function componentReference(component) {
    return String(component?.designator || '').trim()
}

/**
 * Returns the next stable badge id.
 * @param {readonly object[]} badges
 * @returns {string}
 */
function nextBadgeId(badges) {
    const next =
        Math.max(
            0,
            ...badges.map((badge) => {
                const match = String(badge.id || '').match(/^badge-(\d+)$/)
                return match ? Number(match[1]) : 0
            })
        ) + 1
    return `badge-${next}`
}

/**
 * Returns the next numeric badge label.
 * @param {readonly object[]} badges
 * @returns {string}
 */
function nextBadgeText(badges) {
    const next =
        Math.max(
            0,
            ...badges.map((badge) => {
                const number = Number(String(badge.text || '').trim())
                return Number.isInteger(number) && number > 0 ? number : 0
            })
        ) + 1
    return String(next)
}

/**
 * Returns true for normalized Altium PCB models.
 * @param {object | null} board
 * @returns {boolean}
 */
function isAltiumPcbModel(board) {
    return Boolean(board?.kind === 'pcb' && board?.fileType === 'PcbDoc')
}

/**
 * Resolves Altium board bounds from board outline metadata.
 * @param {object | null} board
 * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
 */
function altiumBoardBounds(board) {
    const outline = board?.pcb?.boardOutline
    if (!outline) return null

    const minX = finiteOrZero(outline.minX)
    const minY = finiteOrZero(outline.minY)
    const width = Number(outline.widthMil)
    const height = Number(outline.heightMil)

    if (!Number.isFinite(width) || !Number.isFinite(height)) return null

    return {
        minX,
        minY,
        maxX: minX + width,
        maxY: minY + height
    }
}
