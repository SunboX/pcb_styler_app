// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Geometry } from 'kicad-toolkit/parser'
import { PcbSvgRenderer as ToolkitKicadPcbSvgRenderer } from 'kicad-toolkit/renderers'
import { PcbSvgRendererDecorator } from './PcbSvgRendererDecorator.mjs'

const emptyDropPrompt = 'Drop board file or ZIP file here.'
const kicadPreviewColors = Object.freeze({
    boardFill: '#df8060',
    edge: '#c7d0d6',
    frontCopper: '#fff0a2',
    frontZone: '#df8060',
    backCopper: '#842a30',
    backZone: '#842a30',
    padFill: '#fff0a2',
    padStroke: '#d43b3c',
    viaFill: '#f2c843',
    viaStroke: '#d43b3c',
    drill: '#061326',
    silkscreen: '#f26b6b'
})

/**
 * Applies PCB Styler presentation features to KiCad toolkit SVG output.
 */
export class KicadPcbSvgRenderer {
    /** @type {PcbSvgRendererDecorator} */
    #decorator

    /**
     * @param {{ render: (board: object | null, options?: object) => string }} [renderer]
     */
    constructor(renderer = ToolkitKicadPcbSvgRenderer) {
        this.#decorator = new PcbSvgRendererDecorator({
            renderer,
            baseOptions(options) {
                return { side: options.side === 'back' ? 'back' : 'front' }
            },
            layerRules: kicadLayerRules,
            highlightableClasses: ['pcb-pad', 'pcb-drawing', 'pcb-label'],
            highlightFillClasses: ['pcb-pad'],
            prepareMarkup(markup, board, _options, _context, helpers) {
                return annotateToolkitLayerMetadata(markup, board, helpers)
            },
            afterLayerStyles(markup, board, options, context, helpers) {
                return applyRenderPreset(markup, options, helpers)
            },
            overlayRenderer(board, _options, context, helpers) {
                return renderComponentHitAreas(board, context.side, helpers)
            },
            insertOverlay: insertBeforeSceneEnd
        })
    }

    /**
     * Renders a PCB using a default wrapper instance.
     * @param {object | null} board
     * @param {object} [options]
     * @returns {string}
     */
    static render(board, options = {}) {
        return new KicadPcbSvgRenderer().render(board, options)
    }

    /**
     * Renders empty placeholder SVG.
     * @returns {string}
     */
    static renderEmpty() {
        return [
            `<svg xmlns="http://www.w3.org/2000/svg" class="pcb-svg pcb-svg--empty" viewBox="0 0 100 60" role="img" aria-label="${emptyDropPrompt}">`,
            '<rect x="1" y="1" width="98" height="58" rx="2" fill="#f7f8f9" stroke="#8d98a4" stroke-width="0.35" stroke-dasharray="1.4 1.2"/>',
            `<text x="50" y="31" text-anchor="middle" fill="#1f2430" font-size="4.5" font-weight="700">${emptyDropPrompt}</text>`,
            '</svg>'
        ].join('')
    }

    /**
     * Renders a KiCad board with shared app palette and annotations.
     * @param {object | null} board
     * @param {{ side?: 'front' | 'back', renderPreset?: string, markers?: object[], layerStyles?: Record<string, object>, colors?: Record<string, string>, highlightedFootprints?: readonly string[], hoveredFootprintId?: string, highlightColor?: string, badges?: readonly object[], badgeStyle?: object }} [options]
     * @returns {string}
     */
    render(board, options = {}) {
        if (!board) return KicadPcbSvgRenderer.renderEmpty()

        return this.#decorator.render(board, options)
    }
}

/** @type {object[]} */
const kicadLayerRules = [
    {
        classNames: ['pcb-board'],
        apply(tag, styles, helpers) {
            return applyBoardStyle(tag, styles.board, styles.edgeCuts, helpers)
        }
    },
    {
        classNames: ['pcb-segment'],
        styleKey: 'traces',
        fill: false,
        stroke: true
    },
    {
        classNames: ['pcb-via'],
        styleKey: 'vias',
        fill: true,
        stroke: true
    },
    {
        classNames: ['pcb-via-drill'],
        styleKey: 'viaDrills',
        fill: true,
        stroke: true
    },
    {
        classNames: ['pcb-pad-drill'],
        styleKey: 'padDrills',
        fill: true,
        stroke: true
    },
    {
        classNames: ['pcb-zone'],
        styleKey: 'zones',
        fill: true,
        stroke: true
    },
    {
        classNames: ['pcb-pad'],
        styleKey: 'pads',
        fill: true,
        stroke: true
    },
    {
        classNames: ['pcb-drawing'],
        apply(tag, styles, helpers) {
            return applyDrawingStyle(tag, styles, helpers)
        }
    },
    {
        classNames: ['pcb-label'],
        styleKey: 'silkscreen',
        fill: false,
        stroke: true
    }
]

/**
 * Applies the split board fill and edge outline styles.
 * @param {string} tag
 * @param {{ visible: boolean, fillColor: string, fillOpacity: number }} boardStyle
 * @param {{ visible: boolean, borderColor: string, borderWidth: number | null }} edgeStyle
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {string}
 */
function applyBoardStyle(tag, boardStyle, edgeStyle, helpers) {
    let next = tag
    if (!boardStyle.visible && !edgeStyle.visible) {
        next = helpers.setAttribute(next, 'display', 'none')
    }
    next = helpers.setAttribute(
        next,
        'fill',
        boardStyle.visible ? boardStyle.fillColor : 'none'
    )
    if (boardStyle.visible && boardStyle.fillOpacity < 1) {
        next = helpers.setAttribute(
            next,
            'fill-opacity',
            helpers.formatNumber(boardStyle.fillOpacity)
        )
    }
    next = helpers.setAttribute(
        next,
        'stroke',
        edgeStyle.visible ? edgeStyle.borderColor : 'none'
    )
    if (edgeStyle.borderWidth !== null) {
        next = helpers.setAttribute(
            next,
            'stroke-width',
            helpers.formatNumber(edgeStyle.borderWidth)
        )
    }
    return next
}

/**
 * Applies copper or silkscreen styles to generic KiCad drawing primitives.
 * @param {string} tag
 * @param {Record<string, { visible: boolean, fillColor: string, fillOpacity: number, borderColor: string, borderWidth: number | null }>} styles
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {string}
 */
function applyDrawingStyle(tag, styles, helpers) {
    if (helpers.hasClass(tag, 'pcb-drawing--copper')) {
        const hasFill = helpers.tagHasPaintedFill(tag)
        return helpers.applySvgStyle(
            tag,
            hasFill ? styles.zones : styles.traces,
            {
                fill: hasFill,
                stroke: true
            }
        )
    }

    return helpers.applySvgStyle(tag, styles.silkscreen, {
        fill: helpers.tagHasPaintedFill(tag),
        stroke: true
    })
}

/**
 * Applies the named render preset after regular layer controls.
 * @param {string} markup
 * @param {{ renderPreset?: string }} options
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {string}
 */
function applyRenderPreset(markup, options, helpers) {
    if (options.renderPreset !== 'kicad') return markup

    return applyKicadPreviewStyles(
        addSvgClass(markup, 'pcb-svg--kicad-preview', helpers),
        helpers
    )
}

/**
 * Adds a class token to the root SVG element.
 * @param {string} markup
 * @param {string} className
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {string}
 */
function addSvgClass(markup, className, helpers) {
    return markup.replace(/^<svg\b[^>]*>/u, (tag) => {
        const classes = helpers
            .getAttribute(tag, 'class')
            .split(/\s+/u)
            .filter(Boolean)
        if (!classes.includes(className)) classes.push(className)
        return helpers.setAttribute(tag, 'class', classes.join(' '))
    })
}

/**
 * Adds app layer metadata when a toolkit release omits it from SVG tags.
 * @param {string} markup
 * @param {{ drawings?: object[], pads?: object[] } | null} board
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {string}
 */
function annotateToolkitLayerMetadata(markup, board, helpers) {
    const drawingQueues = drawingLayerQueues(board?.drawings || [])
    const padLayers = padLayerQueue(board?.pads || [])
    return markup
        .replace(
            /<(?:line|path)\b[^>]*\bclass="[^"]*\bpcb-segment\b[^"]*"[^>]*>/gu,
            (tag) => annotateLayerFromQueue(tag, drawingQueues.segment, helpers)
        )
        .replace(
            /<path\b[^>]*\bclass="[^"]*\bpcb-zone\b[^"]*"[^>]*>/gu,
            (tag) => annotateLayerFromQueue(tag, drawingQueues.zone, helpers)
        )
        .replace(
            /<circle\b[^>]*\bclass="[^"]*\bpcb-via\b[^"]*"[^>]*>/gu,
            (tag) => annotateLayerFromQueue(tag, drawingQueues.via, helpers)
        )
        .replace(
            /<(?:circle|rect|path)\b[^>]*\bclass="[^"]*\bpcb-pad\b[^"]*"[^>]*>/gu,
            (tag) => annotatePadLayersFromQueue(tag, padLayers, helpers)
        )
}

/**
 * Builds ordered layer queues from normalized KiCad drawings.
 * @param {object[]} drawings
 * @returns {{ segment: string[], zone: string[], via: string[] }}
 */
function drawingLayerQueues(drawings) {
    return {
        segment: drawingLayers(drawings, ['segment', 'arc']),
        zone: drawingLayers(drawings, ['zone']),
        via: drawingLayers(drawings, ['via'])
    }
}

/**
 * Selects layer names for drawing types in render order.
 * @param {object[]} drawings
 * @param {string[]} types
 * @returns {string[]}
 */
function drawingLayers(drawings, types) {
    return (drawings || [])
        .filter((drawing) => types.includes(String(drawing?.type || '')))
        .map((drawing) => String(drawing?.layer || '').trim())
}

/**
 * Selects pad layer names in render order.
 * @param {object[]} pads
 * @returns {string[]}
 */
function padLayerQueue(pads) {
    return (pads || []).map((pad) => {
        return (pad?.layers || [])
            .map((layer) => String(layer || '').trim())
            .filter(Boolean)
            .join(' ')
    })
}

/**
 * Adds one data-layer attribute from a queue when missing.
 * @param {string} tag
 * @param {string[]} layers
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {string}
 */
function annotateLayerFromQueue(tag, layers, helpers) {
    const layer = layers.shift()
    if (!layer || helpers.getAttribute(tag, 'data-layer')) return tag
    return helpers.setAttribute(tag, 'data-layer', layer)
}

/**
 * Adds one data-pad-layers attribute from a queue when missing.
 * @param {string} tag
 * @param {string[]} layers
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {string}
 */
function annotatePadLayersFromQueue(tag, layers, helpers) {
    if (!helpers.hasClass(tag, 'pcb-pad')) return tag
    const padLayers = layers.shift()
    if (!padLayers || helpers.getAttribute(tag, 'data-pad-layers')) return tag
    return helpers.setAttribute(tag, 'data-pad-layers', padLayers)
}

/**
 * Applies KiCad-like colors using toolkit layer metadata.
 * @param {string} markup
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {string}
 */
function applyKicadPreviewStyles(markup, helpers) {
    const classes = [
        'pcb-board',
        'pcb-zone',
        'pcb-segment',
        'pcb-arc',
        'pcb-via',
        'pcb-via-drill',
        'pcb-pad',
        'pcb-pad-drill',
        'pcb-drawing',
        'pcb-label'
    ]

    return helpers.styleMatchingTags(markup, classes, (tag) => {
        const visibleTag = showForKicadPreview(tag, helpers)
        if (helpers.hasClass(visibleTag, 'pcb-board')) {
            return styleBoardForKicadPreview(visibleTag, helpers)
        }
        if (helpers.hasClass(visibleTag, 'pcb-zone')) {
            return styleCopperZoneForKicadPreview(visibleTag, helpers)
        }
        if (
            helpers.hasClass(visibleTag, 'pcb-segment') ||
            helpers.hasClass(visibleTag, 'pcb-arc')
        ) {
            return styleCopperStrokeForKicadPreview(visibleTag, helpers)
        }
        if (helpers.hasClass(visibleTag, 'pcb-via')) {
            return styleViaForKicadPreview(visibleTag, helpers)
        }
        if (
            helpers.hasClass(visibleTag, 'pcb-via-drill') ||
            helpers.hasClass(visibleTag, 'pcb-pad-drill')
        ) {
            return styleDrillForKicadPreview(visibleTag, helpers)
        }
        if (helpers.hasClass(visibleTag, 'pcb-pad')) {
            return stylePadForKicadPreview(visibleTag, helpers)
        }
        if (helpers.hasClass(visibleTag, 'pcb-drawing')) {
            return styleDrawingForKicadPreview(visibleTag, helpers)
        }
        if (helpers.hasClass(visibleTag, 'pcb-label')) {
            return styleStrokeOnlyForKicadPreview(
                visibleTag,
                kicadPreviewColors.silkscreen,
                helpers
            )
        }
        return visibleTag
    })
}

/**
 * Removes manual-layer hiding before applying the full-detail KiCad preset.
 * @param {string} tag
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {string}
 */
function showForKicadPreview(tag, helpers) {
    return helpers.removeStyleProperty(
        helpers.removeAttribute(tag, 'display'),
        'display'
    )
}

/**
 * Applies KiCad-preview board fill and outline.
 * @param {string} tag
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {string}
 */
function styleBoardForKicadPreview(tag, helpers) {
    let next = helpers.setAttribute(tag, 'fill', kicadPreviewColors.boardFill)
    next = helpers.setStyleProperty(next, 'fill', kicadPreviewColors.boardFill)
    next = helpers.setAttribute(next, 'stroke', kicadPreviewColors.edge)
    next = helpers.setStyleProperty(next, 'stroke', kicadPreviewColors.edge)
    return next
}

/**
 * Applies KiCad-preview copper zone colors.
 * @param {string} tag
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {string}
 */
function styleCopperZoneForKicadPreview(tag, helpers) {
    const color = layerColor(tag, helpers, {
        front: kicadPreviewColors.frontZone,
        back: kicadPreviewColors.backZone,
        both: kicadPreviewColors.backZone
    })
    let next = helpers.setAttribute(tag, 'fill', color)
    next = helpers.setStyleProperty(next, 'fill', color)
    next = helpers.setAttribute(next, 'stroke', color)
    next = helpers.setStyleProperty(next, 'stroke', color)
    return next
}

/**
 * Applies KiCad-preview track stroke colors.
 * @param {string} tag
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {string}
 */
function styleCopperStrokeForKicadPreview(tag, helpers) {
    return styleStrokeOnlyForKicadPreview(
        tag,
        layerColor(tag, helpers, {
            front: kicadPreviewColors.frontCopper,
            back: kicadPreviewColors.backCopper,
            both: kicadPreviewColors.frontCopper
        }),
        helpers
    )
}

/**
 * Applies KiCad-preview via colors.
 * @param {string} tag
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {string}
 */
function styleViaForKicadPreview(tag, helpers) {
    let next = helpers.setAttribute(tag, 'fill', kicadPreviewColors.viaFill)
    next = helpers.setStyleProperty(next, 'fill', kicadPreviewColors.viaFill)
    next = helpers.setAttribute(next, 'stroke', kicadPreviewColors.viaStroke)
    next = helpers.setStyleProperty(
        next,
        'stroke',
        kicadPreviewColors.viaStroke
    )
    next = helpers.setAttribute(next, 'stroke-width', '0.08')
    next = helpers.setStyleProperty(next, 'stroke-width', '0.08')
    return next
}

/**
 * Applies KiCad-preview drill cutout colors.
 * @param {string} tag
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {string}
 */
function styleDrillForKicadPreview(tag, helpers) {
    let next = helpers.setAttribute(tag, 'fill', kicadPreviewColors.drill)
    next = helpers.setStyleProperty(next, 'fill', kicadPreviewColors.drill)
    next = helpers.setAttribute(next, 'stroke', kicadPreviewColors.drill)
    next = helpers.setStyleProperty(next, 'stroke', kicadPreviewColors.drill)
    return next
}

/**
 * Applies KiCad-preview pad colors.
 * @param {string} tag
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {string}
 */
function stylePadForKicadPreview(tag, helpers) {
    let next = helpers.setAttribute(tag, 'fill', kicadPreviewColors.padFill)
    next = helpers.setStyleProperty(next, 'fill', kicadPreviewColors.padFill)
    next = helpers.setAttribute(next, 'stroke', kicadPreviewColors.padStroke)
    next = helpers.setStyleProperty(
        next,
        'stroke',
        kicadPreviewColors.padStroke
    )
    return next
}

/**
 * Applies KiCad-preview colors to generic artwork.
 * @param {string} tag
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {string}
 */
function styleDrawingForKicadPreview(tag, helpers) {
    const layer = helpers.getAttribute(tag, 'data-layer')
    if (layer.includes('.Cu')) {
        return helpers.tagHasPaintedFill(tag)
            ? styleCopperZoneForKicadPreview(tag, helpers)
            : styleCopperStrokeForKicadPreview(tag, helpers)
    }

    return styleStrokeOnlyForKicadPreview(
        tag,
        kicadPreviewColors.silkscreen,
        helpers
    )
}

/**
 * Applies a stroke-only color while leaving fill semantics intact.
 * @param {string} tag
 * @param {string} color
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {string}
 */
function styleStrokeOnlyForKicadPreview(tag, color, helpers) {
    let next = helpers.setAttribute(tag, 'stroke', color)
    next = helpers.setStyleProperty(next, 'stroke', color)
    return next
}

/**
 * Selects a front, back, or both-side color from layer metadata.
 * @param {string} tag
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @param {{ front: string, back: string, both: string }} colors
 * @returns {string}
 */
function layerColor(tag, helpers, colors) {
    const layers = helpers
        .getAttribute(tag, 'data-layer')
        .split(/[,\s]+/u)
        .filter(Boolean)
    const hasFront = layers.some((layer) => layer.startsWith('F.'))
    const hasBack = layers.some((layer) => layer.startsWith('B.'))
    if (hasFront && hasBack) return colors.both
    if (hasBack) return colors.back
    return colors.front
}

/**
 * Renders transparent footprint targets for click and hover interaction.
 * @param {{ footprints?: object[], pads?: object[], drawings?: object[], texts?: object[] } | null} board
 * @param {'front' | 'back'} side
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {string}
 */
function renderComponentHitAreas(board, side, helpers) {
    const source = board || {}
    const visibleIds = visibleFootprintIds(
        (source.pads || []).filter((pad) => isVisibleOnSide(pad, side)),
        (source.drawings || []).filter(
            (drawing) =>
                isVisibleOnSide(drawing, side) &&
                isRenderableBoardLayer(drawing)
        ),
        (source.texts || []).filter((text) => {
            return (
                isVisibleOnSide(text, side) &&
                isVisibleText(text) &&
                !isExcludedReferenceText(text) &&
                isRenderableBoardLayer(text)
            )
        })
    )

    const hitAreas = (source.footprints || [])
        .filter((footprint) => visibleIds.has(footprint.id))
        .map((footprint) => renderComponentHitArea(footprint, helpers))
        .join('')

    return hitAreas
        ? '<g class="pcb-component-hit-areas">' + hitAreas + '</g>'
        : ''
}

/**
 * Renders one transparent component hit area.
 * @param {{ id: string, reference?: string, bounds?: object }} footprint
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {string}
 */
function renderComponentHitArea(footprint, helpers) {
    if (!footprint.bounds) return ''

    const bounds = Geometry.expandBounds(footprint.bounds, 0.4)
    return [
        '<rect',
        'class="pcb-component-hit-area"',
        `data-footprint-id="${helpers.escapeAttribute(footprint.id)}"`,
        `aria-label="${helpers.escapeAttribute(`Toggle highlight ${footprint.reference || footprint.id}`)}"`,
        `x="${helpers.formatNumber(bounds.minX)}"`,
        `y="${helpers.formatNumber(bounds.minY)}"`,
        `width="${helpers.formatNumber(bounds.width)}"`,
        `height="${helpers.formatNumber(bounds.height)}"`,
        'fill="transparent"',
        'pointer-events="all"/>'
    ].join(' ')
}

/**
 * Finds footprint ids that have visible renderable content.
 * @param {object[]} pads
 * @param {object[]} drawings
 * @param {object[]} texts
 * @returns {Set<string>}
 */
function visibleFootprintIds(pads, drawings, texts) {
    const ids = new Set()
    pads.forEach((pad) => addFootprintId(ids, pad.footprintId))
    drawings.forEach((drawing) => addFootprintId(ids, drawing.ownerId))
    texts.forEach((text) => addFootprintId(ids, text.ownerId))
    return ids
}

/**
 * Adds a real footprint id to a set.
 * @param {Set<string>} ids
 * @param {unknown} value
 * @returns {void}
 */
function addFootprintId(ids, value) {
    const id = String(value || '').trim()
    if (id && id !== 'board') ids.add(id)
}

/**
 * Inserts overlay markup before the closing scene group.
 * @param {string} markup
 * @param {string} overlayMarkup
 * @returns {string}
 */
function insertBeforeSceneEnd(markup, overlayMarkup) {
    if (!overlayMarkup) return markup
    return /<\/g><\/svg>\s*$/u.test(markup)
        ? markup.replace(/<\/g><\/svg>\s*$/u, overlayMarkup + '</g></svg>')
        : PcbSvgRendererDecorator.insertBeforeSvgEnd(markup, overlayMarkup)
}

/**
 * Checks whether an item is visible on the selected side.
 * @param {{ side?: string }} item
 * @param {'front' | 'back'} side
 * @returns {boolean}
 */
function isVisibleOnSide(item, side) {
    return item.side === 'both' || item.side === side
}

/**
 * Checks KiCad text visibility.
 * @param {{ visible?: boolean }} text
 * @returns {boolean}
 */
function isVisibleText(text) {
    return text.visible !== false
}

/**
 * Checks whether this is an assembly-excluded footprint reference.
 * @param {{ propertyName?: string, excludeFromPositionFiles?: boolean }} text
 * @returns {boolean}
 */
function isExcludedReferenceText(text) {
    return (
        text.excludeFromPositionFiles === true &&
        text.propertyName === 'Reference'
    )
}

/**
 * Checks whether a KiCad layer belongs in the visible board render.
 * @param {{ layer?: string }} item
 * @returns {boolean}
 */
function isRenderableBoardLayer(item) {
    return String(item.layer || '')
        .split(',')
        .some((layer) => isRenderableLayerName(layer.trim()))
}

/**
 * Checks a single KiCad layer name.
 * @param {string} layer
 * @returns {boolean}
 */
function isRenderableLayerName(layer) {
    return (
        layer.endsWith('.Cu') ||
        layer.endsWith('.Mask') ||
        layer.endsWith('.SilkS')
    )
}
