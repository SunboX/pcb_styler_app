// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
    PcbEdgeFacingGlyphNormalizer,
    PcbFootprintPrimitiveSelector,
    PcbSvgRenderer as ToolkitAltiumPcbSvgRenderer
} from 'altium-toolkit/renderers'
import {
    buildComponentPadOwnershipBounds,
    buildComponentVisualBounds,
    componentDesignator,
    componentFootprintId,
    componentOwnerForBounds,
    componentOwnerForPad,
    componentOwnerForPrimitive,
    primitiveDeclaresComponentIndex,
    renderComponentHitAreas
} from './AltiumComponentOwnership.mjs'
import {
    isCopperPrimitive,
    prepareAltiumRenderBoard
} from './AltiumPcbRenderModel.mjs'
import { AltiumKicadPreviewStyles } from './AltiumKicadPreviewStyles.mjs'
import { injectSupplementalPrimitiveMarkup } from './AltiumSupplementalPrimitiveRenderer.mjs'
import { wrapAltiumMarkup } from './AltiumSvgSceneWrapper.mjs'
import { PcbSvgRendererDecorator } from './PcbSvgRendererDecorator.mjs'

const altiumMilsPerMillimeter = 1000 / 25.4

/**
 * Applies PCB Styler presentation features to Altium toolkit SVG output.
 */
export class AltiumPcbSvgRenderer {
    /** @type {PcbSvgRendererDecorator} */
    #decorator

    /**
     * @param {{ render: (board: object, options?: object) => string }} [renderer]
     */
    constructor(renderer = ToolkitAltiumPcbSvgRenderer) {
        this.#decorator = new PcbSvgRendererDecorator({
            renderer: createToolkitAdapter(renderer),
            layerRules: altiumLayerRules,
            highlightableClasses: [
                'pcb-component__body',
                'pcb-pad__ring',
                'pcb-footprint-fill',
                'pcb-footprint-track',
                'pcb-footprint-region',
                'pcb-region'
            ],
            highlightFillClasses: [
                'pcb-component__body',
                'pcb-pad__ring',
                'pcb-footprint-fill',
                'pcb-footprint-region',
                'pcb-region'
            ],
            prepareMarkup(markup, board, _options, _context, helpers) {
                const components = board?.pcb?.components || []
                const supplementedMarkup = injectSupplementalPrimitiveMarkup(
                    markup,
                    board?.pcb || {},
                    helpers
                )
                return annotateComponentOwnedMarkup(
                    annotateComponentGroups(
                        supplementedMarkup,
                        components,
                        helpers
                    ),
                    board?.pcb || {},
                    components,
                    helpers
                )
            },
            afterLayerStyles(markup, _board, _options, context, helpers) {
                const textStyledMarkup = markup.replace(
                    /<text\b[^>]*>/gu,
                    (tag) =>
                        helpers.applySvgStyle(tag, context.styles.silkscreen, {
                            fill: true,
                            stroke: false
                        })
                )
                return AltiumKicadPreviewStyles.apply(
                    textStyledMarkup,
                    _options,
                    helpers
                )
            },
            overlayRenderer(board, _options, _context, helpers) {
                const components = Array.isArray(board?.pcb?.components)
                    ? board.pcb.components
                    : []
                const componentBounds = buildComponentVisualBounds(
                    components,
                    board?.pcb || {}
                )
                return renderComponentHitAreas(
                    components,
                    componentBounds,
                    helpers
                )
            },
            wrapMarkup: wrapAltiumMarkup,
            decorateEmpty: true
        })
    }

    /**
     * Renders an Altium board using a default wrapper instance.
     * @param {object | null} board
     * @param {object} [options]
     * @returns {string}
     */
    static render(board, options = {}) {
        return new AltiumPcbSvgRenderer().render(board, options)
    }

    /**
     * Renders an Altium board with the shared app palette and annotations.
     * @param {object | null} board
     * @param {{ side?: 'front' | 'back', layerStyles?: Record<string, object>, colors?: Record<string, string>, highlightedFootprints?: readonly string[], hoveredFootprintId?: string, highlightColor?: string, badges?: readonly object[], badgeStyle?: object }} [options]
     * @returns {string}
     */
    render(board, options = {}) {
        const side = options.side === 'back' ? 'back' : 'front'
        return this.#decorator.render(prepareAltiumRenderBoard(board, side), {
            ...options,
            side,
            badgeStyle: withAltiumBadgeCoordinateScale(options.badgeStyle)
        })
    }
}

/** @type {object[]} */
const altiumLayerRules = [
    {
        classNames: ['board-outline'],
        skipClassNames: ['board-outline--stroke'],
        styleKey: 'board',
        fill: true,
        stroke: false
    },
    {
        classNames: ['board-outline--stroke'],
        apply(tag, styles, helpers) {
            return helpers.applySvgStyle(tag, styles.edgeCuts, {
                fill: false,
                stroke: true,
                forceFill: 'none'
            })
        }
    },
    {
        classNames: ['pcb-pad__ring'],
        styleKey: 'pads',
        fill: true,
        stroke: true
    },
    {
        classNames: ['pcb-via__pad'],
        styleKey: 'vias',
        fill: true,
        stroke: true
    },
    {
        classNames: ['pcb-via__hole'],
        styleKey: 'viaDrills',
        fill: true,
        stroke: true
    },
    {
        classNames: ['pcb-pad__hole'],
        styleKey: 'padDrills',
        fill: true,
        stroke: true
    },
    {
        classNames: [
            'pcb-track',
            'pcb-arc',
            'pcb-footprint-track',
            'pcb-footprint-arc'
        ],
        styleKey: 'traces',
        fill: false,
        stroke: true
    },
    {
        classNames: [
            'pcb-polygon',
            'pcb-fill',
            'pcb-region',
            'pcb-footprint-fill',
            'pcb-footprint-region'
        ],
        styleKey: 'zones',
        fill: true,
        stroke: true
    },
    {
        classNames: ['pcb-component__body'],
        styleKey: 'silkscreen',
        fill: true,
        stroke: true
    }
]

/**
 * Adapts the Altium toolkit renderer's empty-board expectation to the shared decorator.
 * @param {{ render: (board: object, options?: object) => string }} renderer
 * @returns {{ render: (board: object | null, options?: object) => string }}
 */
function createToolkitAdapter(renderer) {
    return {
        /**
         * Renders with an empty object when no board is available.
         * @param {object | null} board
         * @param {object} [options]
         * @returns {string}
         */
        render(board, options) {
            return renderer.render(board || {}, options)
        }
    }
}

/**
 * Adds the Altium mil-to-millimeter badge scale without changing stored UI state.
 * @param {unknown} style
 * @returns {object}
 */
function withAltiumBadgeCoordinateScale(style) {
    const base =
        style && typeof style === 'object'
            ? { .../** @type {Record<string, unknown>} */ (style) }
            : {}
    return {
        ...base,
        coordinateScale: altiumMilsPerMillimeter
    }
}

/**
 * Adds component ownership to Altium primitives that the shared highlighter can paint.
 * @param {string} markup
 * @param {{ pads?: object[], regions?: object[], shapeBasedRegions?: object[] }} pcb
 * @param {readonly object[]} components
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {string}
 */
function annotateComponentOwnedMarkup(markup, pcb, components, helpers) {
    const componentPadBounds = buildComponentPadOwnershipBounds(
        pcb.pads || [],
        components
    )
    const footprintPrimitives = selectFootprintPrimitives(pcb)
    return annotateFootprintPrimitiveMarkup(
        annotatePadRingMarkup(markup, pcb.pads || [], components, helpers),
        selectCopperRegionsInRenderedOrder(pcb),
        footprintPrimitives,
        components,
        helpers,
        componentPadBounds
    )
}

/**
 * Adds app data attributes to toolkit-rendered component groups and bodies.
 * @param {string} markup
 * @param {readonly object[]} components
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {string}
 */
function annotateComponentGroups(markup, components, helpers) {
    let index = 0
    return markup.replace(
        /<g\b[^>]*\bclass="pcb-component\b[^"]*"[^>]*>[\s\S]*?<\/g>/gu,
        (groupMarkup) => {
            const componentIndex = index
            const component = components[componentIndex]
            index += 1
            if (!component) return groupMarkup

            const footprintId = componentFootprintId(component, componentIndex)
            return annotateComponentGroupMarkup(
                groupMarkup,
                footprintId,
                componentDesignator(component),
                helpers
            )
        }
    )
}

/**
 * Adds ownership attributes to one component group and its visible body.
 * @param {string} groupMarkup
 * @param {string} footprintId
 * @param {string} reference
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {string}
 */
function annotateComponentGroupMarkup(
    groupMarkup,
    footprintId,
    reference,
    helpers
) {
    return groupMarkup
        .replace(/<g\b[^>]*>/u, (tag) =>
            annotateFootprintTag(tag, footprintId, reference, helpers)
        )
        .replace(
            /<[^>]+\bclass="[^"]*\bpcb-component__body\b[^"]*"[^>]*>/gu,
            (tag) => annotateFootprintTag(tag, footprintId, reference, helpers)
        )
}

/**
 * Adds inferred component ownership to rendered pad rings by pad order.
 * @param {string} markup
 * @param {readonly object[]} pads
 * @param {readonly object[]} components
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {string}
 */
function annotatePadRingMarkup(markup, pads, components, helpers) {
    let padIndex = 0
    return markup.replace(
        /<(?:circle|rect)\b[^>]*\bclass="[^"]*\bpcb-pad__ring\b[^"]*"[^>]*>/gu,
        (tag) => {
            const pad = pads[padIndex]
            padIndex += 1
            const owner = componentOwnerForPad(pad, components)
            return owner
                ? annotateFootprintTag(
                      tag,
                      owner.footprintId,
                      owner.reference,
                      helpers
                  )
                : tag
        }
    )
}

/**
 * Adds inferred ownership to rendered footprint documentation primitives.
 * @param {string} markup
 * @param {object[]} copperRegions
 * @param {{ fills: object[], tracks: object[], regions: object[] }} footprintPrimitives
 * @param {readonly object[]} components
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @param {Map<string, { minX: number, minY: number, maxX: number, maxY: number }>} componentPadBounds
 * @returns {string}
 */
function annotateFootprintPrimitiveMarkup(
    markup,
    copperRegions,
    footprintPrimitives,
    components,
    helpers,
    componentPadBounds
) {
    let fillIndex = 0
    let trackIndex = 0
    let copperRegionIndex = 0
    let footprintRegionIndex = 0
    return markup
        .replace(
            /<path\b[^>]*\bclass="[^"]*\bpcb-region\b[^"]*"[^>]*>/gu,
            (tag) => {
                const primitive = copperRegions[copperRegionIndex]
                copperRegionIndex += 1
                return primitiveDeclaresComponentIndex(primitive)
                    ? annotateTagByBounds(
                          tag,
                          null,
                          primitive,
                          components,
                          helpers,
                          componentPadBounds
                      )
                    : tag
            }
        )
        .replace(
            /<rect\b[^>]*\bclass="[^"]*\bpcb-footprint-fill\b[^"]*"[^>]*>/gu,
            (tag) => {
                const primitive = footprintPrimitives.fills[fillIndex]
                fillIndex += 1
                return annotateTagByBounds(
                    tag,
                    tagRectBounds(tag, helpers),
                    primitive,
                    components,
                    helpers,
                    componentPadBounds
                )
            }
        )
        .replace(
            /<line\b[^>]*\bclass="[^"]*\bpcb-footprint-track\b[^"]*"[^>]*>/gu,
            (tag) => {
                const primitive = footprintPrimitives.tracks[trackIndex]
                trackIndex += 1
                return annotateTagByBounds(
                    tag,
                    tagLineBounds(tag, helpers),
                    primitive,
                    components,
                    helpers,
                    componentPadBounds
                )
            }
        )
        .replace(
            /<path\b[^>]*\bclass="[^"]*\bpcb-footprint-region\b[^"]*"[^>]*>/gu,
            (tag) => {
                const primitive =
                    footprintPrimitives.regions[footprintRegionIndex]
                footprintRegionIndex += 1
                return annotateTagByBounds(
                    tag,
                    regionBounds(primitive),
                    primitive,
                    components,
                    helpers,
                    componentPadBounds
                )
            }
        )
}

/**
 * Adds footprint attributes to a tag when its bounds overlap a component.
 * @param {string} tag
 * @param {{ minX: number, minY: number, maxX: number, maxY: number } | null} bounds
 * @param {object | undefined} primitive
 * @param {readonly object[]} components
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @param {Map<string, { minX: number, minY: number, maxX: number, maxY: number }>} [componentPadBounds]
 * @returns {string}
 */
function annotateTagByBounds(
    tag,
    bounds,
    primitive,
    components,
    helpers,
    componentPadBounds
) {
    const owner = primitiveDeclaresComponentIndex(primitive)
        ? componentOwnerForPrimitive(primitive, components)
        : componentOwnerForBounds(bounds, components, componentPadBounds)
    return owner
        ? annotateFootprintTag(tag, owner.footprintId, owner.reference, helpers)
        : tag
}

/**
 * Selects the same footprint primitive sequence that the toolkit renderer emits.
 * @param {{ primitiveLayers?: object[], fills?: object[], tracks?: object[], arcs?: object[], regions?: object[], shapeBasedRegions?: object[], boardOutline?: object }} pcb
 * @returns {{ fills: object[], tracks: object[], regions: object[] }}
 */
function selectFootprintPrimitives(pcb) {
    const selected = PcbFootprintPrimitiveSelector.select(
        pcb.primitiveLayers || [],
        pcb.fills || [],
        pcb.tracks || [],
        pcb.arcs || [],
        selectRenderedRegions(pcb),
        'top'
    )
    const normalized = PcbEdgeFacingGlyphNormalizer.normalize(
        selected,
        pcb.boardOutline || {
            minX: 0,
            minY: 0,
            widthMil: 0,
            heightMil: 0
        }
    )
    normalized.regions = selectFootprintRegions(pcb)
    return normalized
}

/**
 * Selects region primitives belonging to documentation or overlay layers.
 * @param {{ primitiveLayers?: object[], regions?: object[], shapeBasedRegions?: object[] }} pcb
 * @returns {object[]}
 */
function selectFootprintRegions(pcb) {
    const layerIds = selectFootprintLayerIds(pcb.primitiveLayers || [])
    return selectRenderedRegions(pcb).filter(
        (region) =>
            !isCopperPrimitive(region) && layerIds.has(Number(region?.layerId))
    )
}

/**
 * Selects footprint-oriented primitive layer ids.
 * @param {readonly object[]} primitiveLayers
 * @returns {Set<number>}
 */
function selectFootprintLayerIds(primitiveLayers) {
    const layerIds = new Set(
        (primitiveLayers || [])
            .filter((layer) => isFootprintLayerName(layer?.name))
            .map((layer) => Number(layer.layerId))
            .filter((layerId) => Number.isInteger(layerId))
    )
    if (layerIds.size) return layerIds

    return new Set([1, 33, 35, 37, 73])
}

/**
 * Checks whether a primitive layer name belongs to visible board details.
 * @param {unknown} name
 * @returns {boolean}
 */
function isFootprintLayerName(name) {
    const value = String(name || '')
        .trim()
        .toUpperCase()
    return [
        'TOP OVERLAY',
        'TOP SOLDER',
        'TOP PASTE',
        'L1_TOP',
        'DRILL DRAWING'
    ].some((needle) => value.includes(needle))
}

/**
 * Selects the region family emitted by the toolkit renderer.
 * @param {{ regions?: object[], shapeBasedRegions?: object[] }} pcb
 * @returns {object[]}
 */
function selectRenderedRegions(pcb) {
    return (pcb.shapeBasedRegions || []).length
        ? pcb.shapeBasedRegions || []
        : pcb.regions || []
}

/**
 * Selects copper regions in the same order as toolkit surface groups emit them.
 * @param {{ regions?: object[], shapeBasedRegions?: object[] }} pcb
 * @returns {object[]}
 */
function selectCopperRegionsInRenderedOrder(pcb) {
    const copperRegions = selectRenderedRegions(pcb).filter((region) =>
        isCopperPrimitive(region)
    )
    const surfaceLayerCode = resolveSurfaceLayerCode(copperRegions)
    return [
        ...copperRegions.filter(
            (region) => region.layerCode !== surfaceLayerCode
        ),
        ...copperRegions.filter(
            (region) => region.layerCode === surfaceLayerCode
        )
    ]
}

/**
 * Splits copper regions into toolkit-compatible paint order groups.
 * @param {object[]} regions
 * @returns {{ surface: object[], subsurface: object[] }}
 */
function splitCopperRegions(regions) {
    const copperRegions = (regions || []).filter((region) =>
        isCopperPrimitive(region)
    )
    const surfaceLayerCode = resolveSurfaceLayerCode(copperRegions)
    return {
        subsurface: copperRegions.filter(
            (region) => region.layerCode !== surfaceLayerCode
        ),
        surface: copperRegions.filter(
            (region) => region.layerCode === surfaceLayerCode
        )
    }
}

/**
 * Returns the default visible layer code from one primitive family.
 * @param {{ layerCode?: number }[]} primitives
 * @returns {number | null}
 */
function resolveSurfaceLayerCode(primitives) {
    const layerCodes = primitives
        .map((primitive) => primitive.layerCode)
        .filter((layerCode) => Number.isFinite(layerCode))
    return layerCodes.length ? Math.min(...layerCodes) : null
}

/**
 * Adds one component ownership attribute pair to an SVG start tag.
 * @param {string} tag
 * @param {string} footprintId
 * @param {string} reference
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {string}
 */
function annotateFootprintTag(tag, footprintId, reference, helpers) {
    return helpers.setAttribute(
        helpers.setAttribute(tag, 'data-footprint-id', footprintId),
        'data-component-reference',
        reference
    )
}

/**
 * Reads a rectangle tag's bounds.
 * @param {string} tag
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
 */
function tagRectBounds(tag, helpers) {
    const x = Number(helpers.getAttribute(tag, 'x'))
    const y = Number(helpers.getAttribute(tag, 'y'))
    const width = Number(helpers.getAttribute(tag, 'width'))
    const height = Number(helpers.getAttribute(tag, 'height'))
    if (![x, y, width, height].every(Number.isFinite)) return null

    return {
        minX: x,
        minY: y,
        maxX: x + width,
        maxY: y + height
    }
}

/**
 * Reads a line tag's bounds.
 * @param {string} tag
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
 */
function tagLineBounds(tag, helpers) {
    const x1 = Number(helpers.getAttribute(tag, 'x1'))
    const y1 = Number(helpers.getAttribute(tag, 'y1'))
    const x2 = Number(helpers.getAttribute(tag, 'x2'))
    const y2 = Number(helpers.getAttribute(tag, 'y2'))
    if (![x1, y1, x2, y2].every(Number.isFinite)) return null

    const halfWidth = Math.max(
        Number(helpers.getAttribute(tag, 'stroke-width') || 0) / 2,
        0
    )
    return {
        minX: Math.min(x1, x2) - halfWidth,
        minY: Math.min(y1, y2) - halfWidth,
        maxX: Math.max(x1, x2) + halfWidth,
        maxY: Math.max(y1, y2) + halfWidth,
        strokeWidth: halfWidth * 2
    }
}

/**
 * Reads a region primitive's bounds from decoded contour points.
 * @param {{ points?: { x: number, y: number }[], holes?: { x: number, y: number }[][] } | undefined} region
 * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
 */
function regionBounds(region) {
    const points = [
        ...(region?.points || []),
        ...(region?.holes || []).flat()
    ].filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y))

    if (!points.length) return null

    return {
        minX: Math.min(...points.map((point) => Number(point.x))),
        minY: Math.min(...points.map((point) => Number(point.y))),
        maxX: Math.max(...points.map((point) => Number(point.x))),
        maxY: Math.max(...points.map((point) => Number(point.y)))
    }
}
