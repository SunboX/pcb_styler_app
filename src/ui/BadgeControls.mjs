// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: AGPL-3.0-or-later

import { BadgeStyle } from '@sunbox/kicad-toolkit'

/**
 * Handles badge list, badge style controls, and SVG badge dragging.
 */
export class BadgeControls {
    /** @type {Document} */
    #document

    /** @type {HTMLElement | null} */
    #canvasNode

    /** @type {HTMLButtonElement | null} */
    #addButton

    /** @type {HTMLElement | null} */
    #listNode

    /** @type {HTMLElement | null} */
    #styleNode

    /**
     * @param {Document} documentRef
     * @param {{ canvasNode: HTMLElement | null, addButton: HTMLButtonElement | null, listNode: HTMLElement | null, styleNode: HTMLElement | null }} nodes
     */
    constructor(documentRef, nodes) {
        this.#document = documentRef
        this.#canvasNode = nodes.canvasNode
        this.#addButton = nodes.addButton
        this.#listNode = nodes.listNode
        this.#styleNode = nodes.styleNode
    }

    /**
     * Updates badge controls for the current state.
     * @param {{ board: object | null, badges?: readonly object[], badgeStyle?: object }} snapshot
     * @returns {void}
     */
    render(snapshot) {
        const hasBoard = Boolean(snapshot.board)
        this.#renderBadgeList(hasBoard, snapshot.badges || [])
        this.#renderBadgeStyle(hasBoard, snapshot.badgeStyle)
    }

    /**
     * Binds badge creation.
     * @param {() => void} callback
     * @returns {void}
     */
    bindAddBadge(callback) {
        this.#addButton?.addEventListener('click', callback)
    }

    /**
     * Binds badge text edits.
     * @param {(id: string, text: string) => void} callback
     * @returns {void}
     */
    bindBadgeTextChange(callback) {
        this.#listNode?.addEventListener('input', (event) => {
            const target = event.target
            if (!(target instanceof HTMLInputElement)) return
            if (target.getAttribute('data-badge-field') !== 'text') return

            callback(target.getAttribute('data-badge-id') || '', target.value)
        })
    }

    /**
     * Binds badge rotation edits.
     * @param {(id: string, rotation: number) => void} callback
     * @returns {void}
     */
    bindBadgeRotationChange(callback) {
        this.#listNode?.addEventListener('input', (event) => {
            const target = event.target
            if (!(target instanceof HTMLInputElement)) return
            if (target.getAttribute('data-badge-field') !== 'rotation') return

            callback(
                target.getAttribute('data-badge-id') || '',
                Number(target.value)
            )
        })
    }

    /**
     * Binds badge dragging in the SVG canvas.
     * @param {(id: string, point: { x: number, y: number }) => void} callback
     * @returns {void}
     */
    bindBadgeMove(callback) {
        let draggedId = ''

        this.#canvasNode?.addEventListener('pointerdown', (event) => {
            const id = badgeIdFromTarget(event.target)
            if (!id) return

            draggedId = id
            event.preventDefault()
            try {
                this.#canvasNode?.setPointerCapture?.(event.pointerId)
            } catch {
                // Pointer capture is best-effort; document listeners still track the drag.
            }
        })

        this.#document.addEventListener('pointermove', (event) => {
            if (!draggedId || !this.#canvasNode) return

            const point = scenePointFromPointer(this.#canvasNode, event)
            if (point) callback(draggedId, point)
        })

        this.#document.addEventListener('pointerup', (event) => {
            if (!draggedId) return

            try {
                this.#canvasNode?.releasePointerCapture?.(event.pointerId)
            } catch {
                // The pointer may already be released after an SVG rerender.
            }
            draggedId = ''
        })
    }

    /**
     * Binds badge removal.
     * @param {(id: string) => void} callback
     * @returns {void}
     */
    bindRemoveBadge(callback) {
        this.#listNode?.addEventListener('click', (event) => {
            const target = event.target
            if (!(target instanceof Element)) return

            const button = target.closest('[data-badge-action="remove"]')
            if (!button) return

            callback(button.getAttribute('data-badge-id') || '')
        })
    }

    /**
     * Binds badge style edits.
     * @param {(patch: object) => void} callback
     * @returns {void}
     */
    bindBadgeStyleChange(callback) {
        this.#styleNode?.addEventListener('input', (event) => {
            const target = event.target
            if (!(target instanceof HTMLInputElement)) return

            const field = target.getAttribute('data-badge-style-field')
            if (!field) return

            callback({ [field]: badgeStyleInputValue(target, field) })
        })
    }

    /**
     * Updates badge rows for the current board.
     * @param {boolean} hasBoard
     * @param {readonly object[]} badges
     * @returns {void}
     */
    #renderBadgeList(hasBoard, badges) {
        if (this.#addButton) this.#addButton.disabled = !hasBoard
        if (!this.#listNode) return

        if (!hasBoard || badges.length === 0) {
            this.#listNode.replaceChildren(this.#createEmptyState(hasBoard))
            return
        }

        this.#ensureRows(badges)
        badges.forEach((badge) => this.#updateRow(badge))
    }

    /**
     * Updates badge style controls.
     * @param {boolean} hasBoard
     * @param {object | undefined} value
     * @returns {void}
     */
    #renderBadgeStyle(hasBoard, value) {
        if (!this.#styleNode) return

        const style = BadgeStyle.normalize(value)
        this.#setStyleInput('foregroundColor', style.foregroundColor, hasBoard)
        this.#setStyleInput('scale', style.scale, hasBoard)
        this.#setStyleInput('shadowColor', style.shadowColor, hasBoard)
        this.#setStyleInput(
            'shadowOpacity',
            style.shadowOpacity * 100,
            hasBoard
        )
        this.#setStyleInput('shadowBlur', style.shadowBlur, hasBoard)
        this.#setStyleInput('shadowOffsetX', style.shadowOffsetX, hasBoard)
        this.#setStyleInput('shadowOffsetY', style.shadowOffsetY, hasBoard)
    }

    /**
     * Keeps badge rows stable while matching the current badge ids.
     * @param {readonly object[]} badges
     * @returns {void}
     */
    #ensureRows(badges) {
        if (!this.#listNode) return

        const currentIds = Array.from(
            this.#listNode.querySelectorAll('[data-badge-row]')
        ).map((row) => row.getAttribute('data-badge-row'))
        const nextIds = badges.map((badge) => String(badge.id || ''))

        if (
            currentIds.length === nextIds.length &&
            currentIds.every((id, index) => id === nextIds[index])
        ) {
            return
        }

        this.#listNode.replaceChildren(
            ...badges.map((badge) => this.#createRow(badge))
        )
    }

    /**
     * Creates one badge control row.
     * @param {object} badge
     * @returns {HTMLElement}
     */
    #createRow(badge) {
        const id = String(badge.id || '')
        const row = this.#document.createElement('div')
        row.className = 'badge-row'
        row.setAttribute('data-badge-row', id)

        const label = this.#document.createElement('label')
        label.className = 'badge-field'
        label.textContent = 'Text'

        const input = this.#document.createElement('input')
        input.className = 'badge-text-input'
        input.type = 'text'
        input.maxLength = 24
        input.value = String(badge.text ?? '')
        input.setAttribute('data-badge-id', id)
        input.setAttribute('data-badge-field', 'text')
        input.setAttribute('aria-label', 'Badge text')
        label.append(input)

        const rotationLabel = this.#document.createElement('label')
        rotationLabel.className = 'badge-field'
        rotationLabel.textContent = 'Rotation'

        const rotation = this.#document.createElement('input')
        rotation.className = 'badge-number-input'
        rotation.type = 'number'
        rotation.min = '-360'
        rotation.max = '360'
        rotation.step = '1'
        rotation.value = String(Number(badge.rotation) || 0)
        rotation.setAttribute('data-badge-id', id)
        rotation.setAttribute('data-badge-field', 'rotation')
        rotation.setAttribute('aria-label', 'Badge rotation')
        rotationLabel.append(rotation)

        const remove = this.#document.createElement('button')
        remove.className = 'button button-secondary button-compact'
        remove.type = 'button'
        remove.textContent = 'Remove'
        remove.setAttribute('data-badge-id', id)
        remove.setAttribute('data-badge-action', 'remove')
        remove.setAttribute('aria-label', 'Remove badge ' + id)

        row.append(label, rotationLabel, remove)
        return row
    }

    /**
     * Updates one row without stealing text input focus.
     * @param {object} badge
     * @returns {void}
     */
    #updateRow(badge) {
        const id = String(badge.id || '')
        const input = this.#listNode?.querySelector(
            `[data-badge-id="${escapeSelector(id)}"][data-badge-field="text"]`
        )
        const rotationInput = this.#listNode?.querySelector(
            `[data-badge-id="${escapeSelector(id)}"][data-badge-field="rotation"]`
        )
        const text = String(badge.text ?? '')
        const rotation = String(
            formatStyleInputValue(Number(badge.rotation) || 0)
        )

        if (
            input instanceof HTMLInputElement &&
            this.#document.activeElement !== input &&
            input.value !== text
        ) {
            input.value = text
        }

        if (
            rotationInput instanceof HTMLInputElement &&
            this.#document.activeElement !== rotationInput &&
            rotationInput.value !== rotation
        ) {
            rotationInput.value = rotation
        }
    }

    /**
     * Creates empty badge-list copy.
     * @param {boolean} hasBoard
     * @returns {HTMLElement}
     */
    #createEmptyState(hasBoard) {
        const node = this.#document.createElement('span')
        node.className = 'badge-empty'
        node.textContent = hasBoard ? 'No badges' : 'Open a board first'
        return node
    }

    /**
     * Updates a style input value and disabled state.
     * @param {string} field
     * @param {string | number} value
     * @param {boolean} enabled
     * @returns {void}
     */
    #setStyleInput(field, value, enabled) {
        const input = this.#styleNode?.querySelector(
            `[data-badge-style-field="${field}"]`
        )
        if (!(input instanceof HTMLInputElement)) return

        input.disabled = !enabled
        input.value = String(formatStyleInputValue(value))
    }
}

/**
 * Reads a badge style value from an input.
 * @param {HTMLInputElement} input
 * @param {string} field
 * @returns {string | number}
 */
function badgeStyleInputValue(input, field) {
    if (field === 'foregroundColor' || field === 'shadowColor') {
        return input.value
    }
    if (field === 'shadowOpacity') {
        return Number(input.value) / 100
    }
    return Number(input.value)
}

/**
 * Formats a style input value.
 * @param {string | number} value
 * @returns {string | number}
 */
function formatStyleInputValue(value) {
    if (typeof value === 'number') return Number(value.toFixed(3))
    return value
}

/**
 * Finds the closest rendered badge id for a DOM event target.
 * @param {EventTarget | null} target
 * @returns {string}
 */
function badgeIdFromTarget(target) {
    if (!(target instanceof Element)) return ''

    const node = target.closest('[data-badge-id]')
    return node?.getAttribute('data-badge-id') || ''
}

/**
 * Converts a pointer event to the PCB scene coordinate system.
 * @param {HTMLElement} canvasNode
 * @param {PointerEvent} event
 * @returns {{ x: number, y: number } | null}
 */
function scenePointFromPointer(canvasNode, event) {
    const svg = canvasNode.querySelector('svg')
    const scene = canvasNode.querySelector('.pcb-scene')
    if (!svg || !scene) return null
    if (typeof svg.createSVGPoint !== 'function') return null
    if (typeof scene.getScreenCTM !== 'function') return null

    const matrix = scene.getScreenCTM()
    if (!matrix) return null

    try {
        const point = svg.createSVGPoint()
        point.x = event.clientX
        point.y = event.clientY
        const transformed = point.matrixTransform(matrix.inverse())
        return { x: transformed.x, y: transformed.y }
    } catch {
        return null
    }
}

/**
 * Escapes a simple value for use in an attribute selector.
 * @param {string} value
 * @returns {string}
 */
function escapeSelector(value) {
    return String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}
