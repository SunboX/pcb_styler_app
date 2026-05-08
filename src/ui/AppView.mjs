// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: AGPL-3.0-or-later

import { RenderPalette } from './RenderPalette.mjs'
import { BadgeControls } from './BadgeControls.mjs'
/**
 * DOM rendering and event binding helper.
 */
export class AppView {
    /** @type {Document} */
    #document

    /** @type {HTMLInputElement | null} */
    #fileInput

    /** @type {HTMLElement | null} */
    #statusNode

    /** @type {HTMLElement[]} */
    #versionNodes

    /** @type {HTMLElement | null} */
    #activeFileNode

    /** @type {HTMLElement | null} */
    #summaryNode

    /** @type {HTMLElement | null} */
    #colorControlsNode

    /** @type {HTMLElement | null} */
    #renderPresetControlsNode

    /** @type {HTMLElement | null} */
    #canvasNode

    /** @type {HTMLButtonElement | null} */
    #exportSvgButton

    /** @type {HTMLButtonElement | null} */
    #exportPngButton

    /** @type {HTMLButtonElement | null} */
    #exportProjectButton

    /** @type {HTMLInputElement | null} */
    #highlightColorInput

    /** @type {HTMLButtonElement | null} */
    #clearHighlightsButton

    /** @type {HTMLElement | null} */
    #highlightSummaryNode

    /** @type {HTMLElement | null} */
    #hoveredComponentInfoNode

    /** @type {BadgeControls} */
    #badgeControls

    /** @type {string} */
    #hoveredFootprintId

    /**
     * @param {Document} documentRef
     */
    constructor(documentRef) {
        this.#document = documentRef
        this.#fileInput = this.#document.querySelector('#fileInput')
        this.#statusNode = this.#document.querySelector('#statusMessage')
        this.#versionNodes = Array.from(
            this.#document.querySelectorAll('[data-app-version]')
        ).filter((node) => node instanceof HTMLElement)
        this.#activeFileNode = this.#document.querySelector('#activeFileName')
        this.#summaryNode = this.#document.querySelector('#boardSummary')
        this.#colorControlsNode = this.#document.querySelector(
            '#layerColorControls'
        )
        this.#renderPresetControlsNode = this.#document.querySelector(
            '#renderPresetControls'
        )
        this.#canvasNode = this.#document.querySelector('#pcbCanvas')
        this.#exportSvgButton = this.#document.querySelector('#exportSvgButton')
        this.#exportPngButton = this.#document.querySelector('#exportPngButton')
        this.#exportProjectButton = this.#document.querySelector(
            '#exportProjectButton'
        )
        this.#highlightColorInput = this.#document.querySelector(
            '#highlightColorInput'
        )
        this.#clearHighlightsButton = this.#document.querySelector(
            '#clearHighlightsButton'
        )
        this.#highlightSummaryNode =
            this.#document.querySelector('#highlightSummary')
        this.#hoveredComponentInfoNode = this.#document.querySelector(
            '#hoveredComponentInfo'
        )
        this.#badgeControls = new BadgeControls(this.#document, {
            canvasNode: this.#canvasNode,
            addButton: this.#document.querySelector('#addBadgeButton'),
            listNode: this.#document.querySelector('#badgeControls'),
            styleNode: this.#document.querySelector('#badgeStyleControls')
        })
        this.#hoveredFootprintId = ''
    }

    /**
     * Renders the current app state and SVG.
     * @param {{ board: object | null, sourceFileName: string, boardSource?: string, sourceBytes?: Uint8Array | null, side: string, renderPreset?: string, layerStyles?: Record<string, object>, highlightedFootprints?: readonly string[], highlightColor?: string, hoveredComponent?: object | null, badges?: readonly object[], badgeStyle?: object }} snapshot
     * @param {string} svg
     * @returns {void}
     */
    render(snapshot, svg) {
        if (this.#canvasNode) this.#canvasNode.innerHTML = svg
        if (this.#activeFileNode) {
            this.#activeFileNode.textContent =
                snapshot.sourceFileName || 'No board loaded'
        }
        this.#renderSummary(snapshot.board)
        this.#renderSide(snapshot.side)
        this.#renderRenderPreset(snapshot.renderPreset)
        this.#renderLayerStyles(snapshot.layerStyles)
        this.#renderHighlightState(snapshot)
        this.#renderHoveredComponentInfo(snapshot.hoveredComponent)
        this.#badgeControls.render(snapshot)
        this.#renderExportState(
            Boolean(snapshot.board),
            Boolean(snapshot.boardSource || snapshot.sourceBytes?.byteLength)
        )
    }

    /**
     * Renders status text.
     * @param {string} value
     */
    setStatus(value) {
        if (this.#statusNode) this.#statusNode.textContent = value
    }

    /**
     * Renders app version.
     * @param {string} version
     */
    setVersion(version) {
        const text = version ? 'v' + version : 'v—'
        this.#versionNodes.forEach((node) => {
            node.textContent = text
        })
    }

    /**
     * Binds file input and center-canvas file opening.
     * @param {(files: FileList | File[]) => Promise<void>} callback
     */
    bindOpenFiles(callback) {
        this.#fileInput?.addEventListener('change', () => {
            if (this.#fileInput?.files) callback(this.#fileInput.files)
        })

        this.#canvasNode?.addEventListener('click', () => {
            if (this.#canvasNode?.querySelector('.pcb-svg--empty')) {
                this.#fileInput?.click()
            }
        })

        this.#canvasNode?.addEventListener('dragover', (event) => {
            event.preventDefault()
            this.#canvasNode?.classList.add('is-dragging')
        })

        this.#canvasNode?.addEventListener('dragleave', () => {
            this.#canvasNode?.classList.remove('is-dragging')
        })

        this.#canvasNode?.addEventListener('drop', (event) => {
            event.preventDefault()
            this.#canvasNode?.classList.remove('is-dragging')
            if (event.dataTransfer?.files?.length)
                callback(event.dataTransfer.files)
        })
    }

    /**
     * Binds side toggle buttons.
     * @param {(side: string) => void} callback
     */
    bindSideChange(callback) {
        this.#document.querySelectorAll('[data-side]').forEach((button) => {
            button.addEventListener('click', () => {
                callback(button.getAttribute('data-side') || 'front')
            })
        })
    }

    /**
     * Binds render style preset buttons.
     * @param {(preset: string) => void} callback
     * @returns {void}
     */
    bindRenderPresetChange(callback) {
        this.#renderPresetControlsNode
            ?.querySelectorAll('[data-render-preset]')
            .forEach((button) => {
                button.addEventListener('click', () => {
                    callback(
                        button.getAttribute('data-render-preset') || 'manual'
                    )
                })
            })
    }

    /**
     * Binds renderer layer style controls.
     * @param {(key: string, patch: object) => void} callback
     * @returns {void}
     */
    bindLayerStyleChange(callback) {
        this.#colorControlsNode?.addEventListener('input', (event) => {
            const target = event.target
            if (!(target instanceof HTMLInputElement)) return
            if (target.type === 'checkbox') return

            this.#handleLayerStyleInput(target, callback)
        })

        this.#colorControlsNode?.addEventListener('change', (event) => {
            const target = event.target
            if (!(target instanceof HTMLInputElement)) return
            if (target.type !== 'checkbox') return

            this.#handleLayerStyleInput(target, callback)
        })
    }

    /**
     * Binds footprint click toggles from the rendered SVG.
     * @param {(footprintId: string) => void} callback
     * @returns {void}
     */
    bindComponentToggle(callback) {
        this.#canvasNode?.addEventListener('click', (event) => {
            const id = componentIdFromTarget(event.target)
            if (id) callback(id)
        })
    }

    /**
     * Binds footprint hover changes from the rendered SVG.
     * @param {(footprintId: string) => void} callback
     * @returns {void}
     */
    bindComponentHover(callback) {
        this.#canvasNode?.addEventListener('pointerover', (event) => {
            const id = componentIdFromTarget(event.target)
            if (!id || id === this.#hoveredFootprintId) return

            this.#hoveredFootprintId = id
            callback(id)
        })

        this.#canvasNode?.addEventListener('pointerout', (event) => {
            const id = componentIdFromTarget(event.target)
            if (!id) return

            const relatedId = componentIdFromTarget(event.relatedTarget)
            if (relatedId === id) return

            this.#hoveredFootprintId = ''
            callback('')
        })

        this.#canvasNode?.addEventListener('pointerleave', () => {
            if (!this.#hoveredFootprintId) return

            this.#hoveredFootprintId = ''
            callback('')
        })
    }

    /**
     * Binds persistent highlight color changes.
     * @param {(color: string) => void} callback
     * @returns {void}
     */
    bindHighlightColorChange(callback) {
        this.#highlightColorInput?.addEventListener('input', () => {
            if (this.#highlightColorInput)
                callback(this.#highlightColorInput.value)
        })
    }

    /**
     * Binds the clear-highlight command.
     * @param {() => void} callback
     * @returns {void}
     */
    bindClearHighlights(callback) {
        this.#clearHighlightsButton?.addEventListener('click', callback)
    }

    /**
     * Binds badge creation.
     * @param {() => void} callback
     * @returns {void}
     */
    bindAddBadge(callback) {
        this.#badgeControls.bindAddBadge(callback)
    }

    /**
     * Binds badge text edits.
     * @param {(id: string, text: string) => void} callback
     * @returns {void}
     */
    bindBadgeTextChange(callback) {
        this.#badgeControls.bindBadgeTextChange(callback)
    }

    /**
     * Binds badge rotation edits.
     * @param {(id: string, rotation: number) => void} callback
     * @returns {void}
     */
    bindBadgeRotationChange(callback) {
        this.#badgeControls.bindBadgeRotationChange(callback)
    }

    /**
     * Binds badge dragging in the SVG canvas.
     * @param {(id: string, point: { x: number, y: number }) => void} callback
     * @returns {void}
     */
    bindBadgeMove(callback) {
        this.#badgeControls.bindBadgeMove(callback)
    }

    /**
     * Binds badge removal.
     * @param {(id: string) => void} callback
     * @returns {void}
     */
    bindRemoveBadge(callback) {
        this.#badgeControls.bindRemoveBadge(callback)
    }

    /**
     * Binds badge style changes.
     * @param {(patch: object) => void} callback
     * @returns {void}
     */
    bindBadgeStyleChange(callback) {
        this.#badgeControls.bindBadgeStyleChange(callback)
    }

    /**
     * Binds SVG export.
     * @param {() => void} callback
     */
    bindExportSvg(callback) {
        this.#exportSvgButton?.addEventListener('click', callback)
    }

    /**
     * Binds PNG export.
     * @param {() => Promise<void>} callback
     */
    bindExportPng(callback) {
        this.#exportPngButton?.addEventListener('click', () => {
            callback().catch((error) => {
                this.setStatus(
                    error instanceof Error
                        ? error.message
                        : 'PNG export failed.'
                )
            })
        })
    }

    /**
     * Binds project ZIP export.
     * @param {() => void} callback
     */
    bindExportProject(callback) {
        this.#exportProjectButton?.addEventListener('click', callback)
    }

    /**
     * Downloads SVG text.
     * @param {string} svg
     * @param {string} fileName
     * @returns {void}
     */
    downloadSvg(svg, fileName) {
        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
        this.#downloadBlob(blob, fileName)
    }

    /**
     * Downloads a transparent PNG rendered from SVG.
     * @param {string} svg
     * @param {string} fileName
     * @returns {Promise<void>}
     */
    async downloadPng(svg, fileName) {
        const canvas = await svgToPngCanvas(this.#document, svg)
        const blob = await canvasToPngBlob(canvas)
        this.#downloadBlob(blob, fileName)
    }

    /**
     * Renders SVG to a transparent PNG data URL without downloading.
     * @param {string} svg
     * @returns {Promise<string>}
     */
    async renderPngDataUrl(svg) {
        const canvas = await svgToPngCanvas(this.#document, svg)
        return canvas.toDataURL('image/png')
    }

    /**
     * Downloads a portable project ZIP archive.
     * @param {Uint8Array} bytes
     * @param {string} fileName
     * @returns {void}
     */
    downloadProject(bytes, fileName) {
        const blob = new Blob([bytes], { type: 'application/zip' })
        this.#downloadBlob(blob, fileName)
    }

    /**
     * Renders board summary metrics.
     * @param {object | null} board
     * @returns {void}
     */
    #renderSummary(board) {
        if (!this.#summaryNode) return
        if (!board) {
            this.#summaryNode.innerHTML =
                '<span>Footprints: 0</span><span>Pads: 0</span><span>Outline: none</span>'
            return
        }
        this.#summaryNode.innerHTML = [
            `<span>Footprints: ${boardFootprintCount(board)}</span>`,
            `<span>Pads: ${boardPadCount(board)}</span>`,
            `<span>Outline: ${boardHasOutline(board) ? 'yes' : 'none'}</span>`
        ].join('')
    }

    /**
     * Updates side toggle pressed state.
     * @param {string} side
     * @returns {void}
     */
    #renderSide(side) {
        this.#document.querySelectorAll('[data-side]').forEach((button) => {
            button.setAttribute(
                'aria-pressed',
                button.getAttribute('data-side') === side ? 'true' : 'false'
            )
        })
    }

    /**
     * Updates render preset toggle pressed state.
     * @param {string | undefined} preset
     * @returns {void}
     */
    #renderRenderPreset(preset) {
        const resolved = preset === 'kicad' ? 'kicad' : 'manual'
        this.#renderPresetControlsNode
            ?.querySelectorAll('[data-render-preset]')
            .forEach((button) => {
                button.setAttribute(
                    'aria-pressed',
                    button.getAttribute('data-render-preset') === resolved
                        ? 'true'
                        : 'false'
                )
            })
    }

    /**
     * Handles one layer style input event.
     * @param {HTMLInputElement} target
     * @param {(key: string, patch: object) => void} callback
     * @returns {void}
     */
    #handleLayerStyleInput(target, callback) {
        const key = target.getAttribute('data-layer-key')
        const field = target.getAttribute('data-style-field')
        if (!key || !field) return

        callback(key, {
            [field]: inputStyleValue(target, field)
        })
    }

    /**
     * Renders and updates layer style controls.
     * @param {Record<string, object> | undefined} layerStyles
     * @returns {void}
     */
    #renderLayerStyles(layerStyles = {}) {
        if (!this.#colorControlsNode) return

        this.#ensureLayerStyleRows()
        const resolved = RenderPalette.resolveStyles(layerStyles)

        RenderPalette.layers().forEach((layer) => {
            const style = resolved[layer.key]
            this.#updateLayerStyleRow(layer, style)
        })
    }

    /**
     * Updates one existing layer style row.
     * @param {{ key: string, label: string, fill: boolean, border: boolean, width: boolean }} layer
     * @param {{ visible: boolean, fillColor: string, fillOpacity: number, borderColor: string, borderWidth: number | null }} style
     * @returns {void}
     */
    #updateLayerStyleRow(layer, style) {
        if (!this.#colorControlsNode) return

        const row = this.#colorControlsNode.querySelector(
            `[data-layer-row="${layer.key}"]`
        )
        if (row instanceof HTMLElement) {
            row.classList.toggle('is-hidden', !style.visible)
        }

        this.#setInputValue(layer.key, 'visible', style.visible)
        this.#setInputValue(layer.key, 'fillColor', style.fillColor)
        this.#setInputValue(layer.key, 'fillOpacity', style.fillOpacity)
        this.#setInputValue(layer.key, 'borderColor', style.borderColor)
        this.#setInputValue(layer.key, 'borderWidth', style.borderWidth)
    }

    /**
     * Updates highlight controls and summary text.
     * @param {{ board: object | null, highlightedFootprints?: readonly string[], highlightColor?: string }} snapshot
     * @returns {void}
     */
    #renderHighlightState(snapshot) {
        const hasBoard = Boolean(snapshot.board)
        const count = snapshot.highlightedFootprints?.length || 0

        if (this.#highlightColorInput) {
            this.#highlightColorInput.disabled = !hasBoard
            this.#highlightColorInput.value =
                snapshot.highlightColor || '#ff3b2b'
        }
        if (this.#clearHighlightsButton) {
            this.#clearHighlightsButton.disabled = !hasBoard || count === 0
        }
        if (this.#highlightSummaryNode) {
            this.#highlightSummaryNode.textContent =
                count === 0
                    ? 'No highlighted components'
                    : `${count} highlighted component${count === 1 ? '' : 's'}`
        }
    }

    /**
     * Updates the hovered component information panel.
     * @param {object | null | undefined} component
     * @returns {void}
     */
    #renderHoveredComponentInfo(component) {
        if (!this.#hoveredComponentInfoNode) return

        const rows = component ? componentInfoRows(component) : []
        if (rows.length === 0) {
            this.#hoveredComponentInfoNode.replaceChildren(
                this.#createComponentInfoEmptyState()
            )
            return
        }

        const list = this.#document.createElement('dl')
        list.className = 'component-info-grid'
        rows.forEach((row) => {
            list.append(this.#createComponentInfoRow(row))
        })
        this.#hoveredComponentInfoNode.replaceChildren(list)
    }

    /**
     * Creates the hovered component empty state.
     * @returns {HTMLElement}
     */
    #createComponentInfoEmptyState() {
        const node = this.#document.createElement('span')
        node.className = 'component-info-empty'
        node.textContent = 'Hover a component to inspect it.'
        return node
    }

    /**
     * Creates one hovered component information row.
     * @param {{ label: string, value: string }} row
     * @returns {HTMLElement}
     */
    #createComponentInfoRow(row) {
        const group = this.#document.createElement('div')
        group.className = 'component-info-row'

        const label = this.#document.createElement('dt')
        label.className = 'component-info-label'
        label.textContent = row.label

        const value = this.#document.createElement('dd')
        value.className = 'component-info-value'
        value.textContent = row.value

        group.append(label, value)
        return group
    }

    /**
     * Updates one style input value.
     * @param {string} key
     * @param {string} field
     * @param {string | number | boolean | null} value
     * @returns {void}
     */
    #setInputValue(key, field, value) {
        const input = this.#colorControlsNode?.querySelector(
            `[data-layer-key="${key}"][data-style-field="${field}"]`
        )
        if (!(input instanceof HTMLInputElement)) return

        if (field === 'visible') {
            input.checked = Boolean(value)
            return
        }

        if (field === 'fillOpacity') {
            const opacity = Number(value)
            const transparency = Number.isFinite(opacity)
                ? Math.round((1 - opacity) * 100)
                : 0
            input.value = String(clampPercentage(transparency))
            return
        }

        input.value = value === null ? '' : String(value)
    }

    /**
     * Creates layer style rows when the control list is empty or stale.
     * @returns {void}
     */
    #ensureLayerStyleRows() {
        if (!this.#colorControlsNode) return

        const layers = RenderPalette.layers()
        const existing = Array.from(
            this.#colorControlsNode.querySelectorAll('[data-layer-row]')
        ).map((row) => row.getAttribute('data-layer-row'))

        if (
            existing.length === layers.length &&
            existing.every((key, index) => key === layers[index].key)
        ) {
            return
        }

        this.#colorControlsNode.replaceChildren(
            ...layers.map((layer) => this.#createLayerStyleRow(layer))
        )
    }

    /**
     * Creates one layer style control row.
     * @param {{ key: string, label: string, fill: boolean, border: boolean, width: boolean }} layer
     * @returns {HTMLElement}
     */
    #createLayerStyleRow(layer) {
        const row = this.#document.createElement('div')
        row.className = 'layer-style-row'
        row.setAttribute('data-layer-row', layer.key)

        const fields = this.#document.createElement('div')
        fields.className = 'layer-style-fields'
        fields.append(
            this.#createStyleField(layer, 'fillColor', 'Fill', 'color'),
            this.#createStyleField(
                layer,
                'fillOpacity',
                'Transparency',
                'range'
            ),
            this.#createStyleField(layer, 'borderColor', 'Border', 'color'),
            this.#createStyleField(layer, 'borderWidth', 'Width', 'number')
        )

        row.append(
            this.#createVisibilityInput(layer),
            this.#createLayerName(layer),
            fields
        )

        return row
    }

    /**
     * Creates a visibility checkbox.
     * @param {{ key: string, label: string }} layer
     * @returns {HTMLInputElement}
     */
    #createVisibilityInput(layer) {
        const input = this.#document.createElement('input')
        input.className = 'layer-style-visible'
        input.type = 'checkbox'
        input.setAttribute('data-layer-key', layer.key)
        input.setAttribute('data-style-field', 'visible')
        input.setAttribute('aria-label', 'Show ' + layer.label)
        return input
    }

    /**
     * Creates the layer name.
     * @param {{ label: string }} layer
     * @returns {HTMLElement}
     */
    #createLayerName(layer) {
        const label = this.#document.createElement('span')
        label.className = 'layer-style-name'
        label.textContent = layer.label
        return label
    }

    /**
     * Creates one style field.
     * @param {{ key: string, label: string, fill: boolean, border: boolean, width: boolean }} layer
     * @param {'fillColor' | 'fillOpacity' | 'borderColor' | 'borderWidth'} field
     * @param {string} labelText
     * @param {'color' | 'number' | 'range'} type
     * @returns {HTMLElement}
     */
    #createStyleField(layer, field, labelText, type) {
        const label = this.#document.createElement('label')
        label.className = 'layer-style-field'
        label.textContent = labelText

        const input = this.#document.createElement('input')
        input.className = 'layer-style-input'
        input.type = type
        input.disabled = !layerSupportsField(layer, field)
        input.setAttribute('data-layer-key', layer.key)
        input.setAttribute('data-style-field', field)
        input.setAttribute('aria-label', `${layer.label} ${labelText}`)

        if (type === 'number') {
            input.min = '0'
            input.step = '0.01'
            input.placeholder = 'auto'
        }

        if (type === 'range') {
            input.min = '0'
            input.max = '100'
            input.step = '1'
            input.value = '0'
        }

        label.append(input)
        return label
    }

    /**
     * Updates export button disabled state.
     * @param {boolean} enabled
     * @param {boolean} projectEnabled
     * @returns {void}
     */
    #renderExportState(enabled, projectEnabled = enabled) {
        if (this.#exportSvgButton) this.#exportSvgButton.disabled = !enabled
        if (this.#exportPngButton) this.#exportPngButton.disabled = !enabled
        if (this.#exportProjectButton) {
            this.#exportProjectButton.disabled = !enabled || !projectEnabled
        }
    }

    /**
     * Triggers a browser download.
     * @param {Blob} blob
     * @param {string} fileName
     * @returns {void}
     */
    #downloadBlob(blob, fileName) {
        const url = URL.createObjectURL(blob)
        const anchor = this.#document.createElement('a')
        anchor.href = url
        anchor.download = fileName
        anchor.style.display = 'none'
        this.#document.body.append(anchor)
        anchor.click()
        anchor.remove()
        URL.revokeObjectURL(url)
    }
}

/**
 * Reads a normalized layer style value from an input.
 * @param {HTMLInputElement} input
 * @param {string} field
 * @returns {string | number | boolean | null}
 */
function inputStyleValue(input, field) {
    if (field === 'visible') {
        return input.checked
    }
    if (field === 'borderWidth') {
        return input.value === '' ? null : Number(input.value)
    }
    if (field === 'fillOpacity') {
        return 1 - clampPercentage(Number(input.value)) / 100
    }
    return input.value
}

/**
 * Checks whether a layer supports one style field.
 * @param {{ fill: boolean, border: boolean, width: boolean }} layer
 * @param {string} field
 * @returns {boolean}
 */
function layerSupportsField(layer, field) {
    if (field === 'fillColor') return layer.fill
    if (field === 'fillOpacity') return layer.fill
    if (field === 'borderColor') return layer.border
    if (field === 'borderWidth') return layer.width
    return true
}

/**
 * Clamps a UI percentage value to the 0..100 slider range.
 * @param {number} value
 * @returns {number}
 */
function clampPercentage(value) {
    if (!Number.isFinite(value)) return 0
    return Math.max(0, Math.min(100, value))
}

/**
 * Finds the closest rendered footprint id for a DOM event target.
 * @param {EventTarget | null} target
 * @returns {string}
 */
function componentIdFromTarget(target) {
    if (!(target instanceof Element)) return ''

    const node = target.closest('[data-footprint-id]')
    return node?.getAttribute('data-footprint-id') || ''
}

/**
 * Returns display rows for a hovered component info object.
 * @param {object} component
 * @returns {{ label: string, value: string }[]}
 */
function componentInfoRows(component) {
    return [
        ['Reference', component.reference],
        ['Footprint id', component.id],
        ['Side', component.side],
        ['Value', component.value],
        ['Description', component.description],
        ['Package', component.package],
        ['Source format', component.sourceFormat]
    ]
        .map(([label, value]) => ({
            label,
            value: String(value || '').trim()
        }))
        .filter((row) => row.value)
}

/**
 * Returns the displayed footprint count for a board model.
 * @param {object} board
 * @returns {number}
 */
function boardFootprintCount(board) {
    if (Array.isArray(board.footprints)) return board.footprints.length
    if (Array.isArray(board.pcb?.components)) return board.pcb.components.length
    return 0
}

/**
 * Returns the displayed pad count for a board model.
 * @param {object} board
 * @returns {number}
 */
function boardPadCount(board) {
    if (Array.isArray(board.pads)) return board.pads.length
    if (Array.isArray(board.pcb?.pads)) return board.pcb.pads.length
    return 0
}

/**
 * Returns whether the board has outline geometry.
 * @param {object} board
 * @returns {boolean}
 */
function boardHasOutline(board) {
    if (Array.isArray(board.outlines)) return board.outlines.length > 0
    return Array.isArray(board.pcb?.boardOutline?.segments)
        ? board.pcb.boardOutline.segments.length > 0
        : false
}

/**
 * Loads an image URL.
 * @param {string} url
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(url) {
    return new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = () =>
            reject(new Error('Could not render SVG for PNG export.'))
        image.src = url
    })
}

/**
 * Renders SVG markup into a transparent canvas.
 * @param {Document} documentRef
 * @param {string} svg
 * @returns {Promise<HTMLCanvasElement>}
 */
async function svgToPngCanvas(documentRef, svg) {
    const imageUrl = URL.createObjectURL(
        new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    )

    try {
        const image = await loadImage(imageUrl)
        const size = resolvePngSize(svg)
        const canvas = documentRef.createElement('canvas')
        canvas.width = size.width
        canvas.height = size.height
        const context = canvas.getContext('2d')
        if (!context)
            throw new Error('PNG export is not supported in this browser.')
        context.clearRect(0, 0, canvas.width, canvas.height)
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        return canvas
    } finally {
        URL.revokeObjectURL(imageUrl)
    }
}

/**
 * Converts a canvas to a PNG blob.
 * @param {HTMLCanvasElement} canvas
 * @returns {Promise<Blob>}
 */
function canvasToPngBlob(canvas) {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob)
                return
            }
            reject(new Error('Could not create PNG export.'))
        }, 'image/png')
    })
}

/**
 * Resolves a high-resolution PNG size from SVG viewBox.
 * @param {string} svg
 * @returns {{ width: number, height: number }}
 */
function resolvePngSize(svg) {
    const match = String(svg).match(/viewBox="([^"]+)"/)
    if (!match) return { width: 1600, height: 1200 }

    const values = match[1].split(/\s+/).map(Number)
    const viewWidth = Math.max(1, values[2] || 1)
    const viewHeight = Math.max(1, values[3] || 1)
    const scale = Math.max(
        2,
        Math.min(10, 2200 / Math.max(viewWidth, viewHeight))
    )

    return {
        width: Math.round(viewWidth * scale),
        height: Math.round(viewHeight * scale)
    }
}
