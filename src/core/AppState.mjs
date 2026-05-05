// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: AGPL-3.0-or-later

import { BadgeStyle, RenderPalette } from '@sunbox/kicad-toolkit'

/**
 * State container for the PCB styler workspace.
 */
export class AppState {
    /** @type {{ board: object | null, sourceFileName: string, boardSource: string, side: 'front' | 'back', status: string, layerStyles: Record<string, object>, highlightedFootprints: string[], hoveredFootprintId: string, highlightColor: string, badges: object[], badgeStyle: object }} */
    #state

    /** @type {Set<(snapshot: object) => void>} */
    #listeners

    /**
     * @param {{ board?: object | null, sourceFileName?: string, boardSource?: string, side?: 'front' | 'back', status?: string, layerStyles?: Record<string, object>, colors?: Record<string, string>, highlightedFootprints?: unknown[], hoveredFootprintId?: unknown, highlightColor?: unknown, badges?: unknown[], badgeStyle?: unknown }} [initial]
     */
    constructor(initial = {}) {
        this.#state = {
            board: initial.board || null,
            sourceFileName: String(initial.sourceFileName || ''),
            boardSource: String(initial.boardSource || ''),
            side: initial.side === 'back' ? 'back' : 'front',
            status: String(initial.status || 'Ready.'),
            layerStyles: RenderPalette.resolveStyles(
                initial.layerStyles,
                initial.colors
            ),
            highlightedFootprints: normalizeFootprintIds(
                initial.highlightedFootprints
            ),
            hoveredFootprintId: normalizeFootprintId(
                initial.hoveredFootprintId
            ),
            highlightColor: RenderPalette.normalizeColor(
                initial.highlightColor,
                '#ff3b2b'
            ),
            badges: normalizeBadges(initial.badges),
            badgeStyle: BadgeStyle.normalize(initial.badgeStyle)
        }
        this.#listeners = new Set()
    }

    /**
     * Returns a readonly snapshot.
     * @returns {{ board: object | null, sourceFileName: string, boardSource: string, side: 'front' | 'back', status: string, layerStyles: Record<string, object>, highlightedFootprints: readonly string[], hoveredFootprintId: string, highlightColor: string, badges: readonly object[], badgeStyle: object }}
     */
    getSnapshot() {
        return Object.freeze({
            ...this.#state,
            layerStyles: freezeStyles(this.#state.layerStyles),
            highlightedFootprints: Object.freeze([
                ...this.#state.highlightedFootprints
            ]),
            badges: Object.freeze(
                this.#state.badges.map((badge) => Object.freeze({ ...badge }))
            ),
            badgeStyle: Object.freeze({ ...this.#state.badgeStyle })
        })
    }

    /**
     * Sets one state field and notifies listeners.
     * @param {'board' | 'sourceFileName' | 'boardSource' | 'side' | 'status' | 'layerStyles' | 'colors' | 'highlightedFootprints' | 'hoveredFootprintId' | 'highlightColor' | 'badges' | 'badgeStyle'} key
     * @param {object | string | null | Record<string, string> | unknown[]} value
     * @returns {object}
     */
    setValue(key, value) {
        return this.patch({ [key]: value })
    }

    /**
     * Applies multiple state fields.
     * @param {{ board?: object | null, sourceFileName?: string, boardSource?: string, side?: 'front' | 'back', status?: string, layerStyles?: Record<string, object>, colors?: Record<string, string>, highlightedFootprints?: unknown[], hoveredFootprintId?: unknown, highlightColor?: unknown, badges?: unknown[], badgeStyle?: unknown }} patch
     * @returns {object}
     */
    patch(patch) {
        if ('board' in patch) {
            this.#state.board = patch.board || null
            this.#state.highlightedFootprints = []
            this.#state.hoveredFootprintId = ''
            this.#state.badges = []
            if (!('boardSource' in patch)) this.#state.boardSource = ''
        }
        if ('sourceFileName' in patch) {
            this.#state.sourceFileName = String(patch.sourceFileName || '')
        }
        if ('boardSource' in patch) {
            this.#state.boardSource = String(patch.boardSource || '')
        }
        if ('side' in patch) {
            this.#state.side = patch.side === 'back' ? 'back' : 'front'
        }
        if ('status' in patch) this.#state.status = String(patch.status || '')
        if ('layerStyles' in patch) {
            this.#state.layerStyles = RenderPalette.mergeStyles(
                this.#state.layerStyles,
                patch.layerStyles
            )
        }
        if ('colors' in patch) {
            this.#state.layerStyles = RenderPalette.mergeStyles(
                this.#state.layerStyles,
                RenderPalette.stylesFromColors(patch.colors)
            )
        }
        if ('highlightedFootprints' in patch) {
            this.#state.highlightedFootprints = normalizeFootprintIds(
                patch.highlightedFootprints
            )
        }
        if ('hoveredFootprintId' in patch) {
            this.#state.hoveredFootprintId = normalizeFootprintId(
                patch.hoveredFootprintId
            )
        }
        if ('highlightColor' in patch) {
            this.#state.highlightColor = RenderPalette.normalizeColor(
                patch.highlightColor,
                this.#state.highlightColor
            )
        }
        if ('badges' in patch) {
            this.#state.badges = normalizeBadges(patch.badges)
        }
        if ('badgeStyle' in patch) {
            this.#state.badgeStyle = BadgeStyle.normalize(
                patch.badgeStyle,
                this.#state.badgeStyle
            )
        }

        return this.#emit()
    }

    /**
     * Subscribes to state changes.
     * @param {(snapshot: object) => void} callback
     * @returns {() => void}
     */
    subscribe(callback) {
        if (typeof callback !== 'function') return () => {}

        this.#listeners.add(callback)
        callback(this.getSnapshot())

        return () => {
            this.#listeners.delete(callback)
        }
    }

    /**
     * Emits a fresh state snapshot to all listeners.
     * @returns {object}
     */
    #emit() {
        const snapshot = this.getSnapshot()
        this.#listeners.forEach((listener) => listener(snapshot))
        return snapshot
    }
}

/**
 * Freezes a one-level layer style map for snapshots.
 * @param {Record<string, object>} layerStyles
 * @returns {Record<string, object>}
 */
function freezeStyles(layerStyles) {
    return Object.freeze(
        Object.fromEntries(
            Object.entries(layerStyles).map(([key, value]) => [
                key,
                Object.freeze({ ...value })
            ])
        )
    )
}

/**
 * Normalizes a footprint id for state storage.
 * @param {unknown} value
 * @returns {string}
 */
function normalizeFootprintId(value) {
    return typeof value === 'string' ? value.trim() : ''
}

/**
 * Normalizes a list of footprint ids, preserving first occurrence order.
 * @param {unknown} value
 * @returns {string[]}
 */
function normalizeFootprintIds(value) {
    if (!Array.isArray(value)) return []

    return [
        ...new Set(
            value
                .map((item) => normalizeFootprintId(item))
                .filter((item) => item.length > 0)
        )
    ]
}

/**
 * Normalizes editable badge annotations.
 * @param {unknown} value
 * @returns {{ id: string, text: string, x: number, y: number, rotation: number, side: 'front' | 'back' }[]}
 */
function normalizeBadges(value) {
    if (!Array.isArray(value)) return []

    return value.map(normalizeBadge).filter(Boolean)
}

/**
 * Normalizes one badge annotation.
 * @param {unknown} value
 * @returns {{ id: string, text: string, x: number, y: number, rotation: number, side: 'front' | 'back' } | null}
 */
function normalizeBadge(value) {
    if (!value || typeof value !== 'object') return null

    const badge = /** @type {Record<string, unknown>} */ (value)
    const id = String(badge.id || '').trim()
    const text = String(badge.text ?? '').trim()
    const x = Number(badge.x)
    const y = Number(badge.y)
    if (!id || !Number.isFinite(x) || !Number.isFinite(y)) return null

    return {
        id,
        text,
        x,
        y,
        rotation: normalizeRotation(badge.rotation),
        side: badge.side === 'back' ? 'back' : 'front'
    }
}

/**
 * Normalizes badge rotation to a positive degree value.
 * @param {unknown} value
 * @returns {number}
 */
function normalizeRotation(value) {
    const rotation = Number(value)
    if (!Number.isFinite(rotation)) return 0

    const normalized = rotation % 360
    return normalized < 0 ? normalized + 360 : normalized
}
