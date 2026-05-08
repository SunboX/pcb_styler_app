// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
    boundsCenter,
    boundsEdgeDistance,
    boundsIntersect,
    boundsOverlapArea,
    expandBounds,
    squaredDistance,
    unionBounds,
    unionPoints
} from './BoundsGeometry.mjs'
import {
    componentDescriptor,
    connectorOwnerCandidateForOutlineBounds,
    connectorOwnerCandidateForPad,
    connectorProfile,
    isConnectorComponent
} from './AltiumConnectorOwnership.mjs'
import { isCopperPrimitive } from './AltiumPcbRenderModel.mjs'
import { PcbSvgRendererDecorator } from './PcbSvgRendererDecorator.mjs'

/** @type {number} */
const GENERIC_DETAIL_SEARCH_HALF_EXTENT = 240

/** @type {number} */
const COMPONENT_HIGHLIGHT_PADDING = 24

/** @type {number} */
const FOOTPRINT_OWNERSHIP_PADDING = 72

/** @type {number} */
const PAD_CLOUD_EDGE_MARKER_PADDING = 28

/** @type {number} */
const EDGE_MARKER_MIN_PAD_STROKE_RATIO = 0.75

/**
 * Resolves the nearest component whose local detail bounds overlap a primitive.
 * @param {{ minX: number, minY: number, maxX: number, maxY: number } | null} bounds
 * @param {readonly object[]} components
 * @param {Map<string, { minX: number, minY: number, maxX: number, maxY: number }>} [componentPadBounds]
 * @returns {{ footprintId: string, reference: string } | null}
 */
export function componentOwnerForBounds(
    bounds,
    components,
    componentPadBounds
) {
    if (!bounds) return null

    const connectorOutlineOwner = ownerFromCandidate(
        connectorOwnerCandidateForOutlineBounds(
            bounds,
            components,
            componentProfileBounds
        )
    )
    if (connectorOutlineOwner) return connectorOutlineOwner

    let best = null
    let bestDistance = Number.POSITIVE_INFINITY
    const constrainedOwner = componentOwnerForPadBounds(
        bounds,
        components,
        componentPadBounds
    )
    if (constrainedOwner) return constrainedOwner
    const expandedPadBounds =
        componentPadBounds?.expanded || componentPadBounds || new Map()

    components.forEach((component, index) => {
        const footprintId = componentFootprintId(component, index)
        if (expandedPadBounds.has(footprintId)) return

        const detailBounds = componentDetailBounds(component)
        if (!boundsIntersect(bounds, detailBounds)) return

        const distance = squaredDistance(boundsCenter(bounds), {
            x: Number(component?.x || 0),
            y: Number(component?.y || 0)
        })
        if (distance < bestDistance) {
            best = { component, index }
            bestDistance = distance
        }
    })

    return best
        ? {
              footprintId: componentFootprintId(best.component, best.index),
              reference: componentDesignator(best.component)
          }
        : null
}

/**
 * Converts an indexed component candidate into the public owner shape.
 * @param {{ component: object, index: number } | null} candidate
 * @returns {{ footprintId: string, reference: string } | null}
 */
function ownerFromCandidate(candidate) {
    return candidate
        ? {
              footprintId: componentFootprintId(
                  candidate.component,
                  candidate.index
              ),
              reference: componentDesignator(candidate.component)
          }
        : null
}

/**
 * Resolves ownership against actual component pad clouds when available.
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds
 * @param {readonly object[]} components
 * @param {Map<string, { minX: number, minY: number, maxX: number, maxY: number }>} [componentPadBounds]
 * @returns {{ footprintId: string, reference: string } | null}
 */
function componentOwnerForPadBounds(bounds, components, componentPadBounds) {
    const exactOwner = componentOwnerForExactPadBounds(
        bounds,
        components,
        componentPadBounds?.exact
    )
    if (exactOwner) return exactOwner

    const edgeOwner = componentOwnerForPadCloudEdgeBounds(
        bounds,
        components,
        componentPadBounds?.exact
    )
    if (edgeOwner) return edgeOwner

    return componentOwnerForExpandedPadBounds(
        bounds,
        components,
        componentPadBounds?.expanded || componentPadBounds
    )
}

/**
 * Resolves ownership when a primitive touches an owned pad directly.
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds
 * @param {readonly object[]} components
 * @param {Map<string, { minX: number, minY: number, maxX: number, maxY: number }[]>} [componentPadBounds]
 * @returns {{ footprintId: string, reference: string } | null}
 */
function componentOwnerForExactPadBounds(
    bounds,
    components,
    componentPadBounds
) {
    if (!componentPadBounds?.size) return null

    let best = null
    let bestArea = 0
    let bestDistance = Number.POSITIVE_INFINITY

    components.forEach((component, index) => {
        const footprintId = componentFootprintId(component, index)
        const padBoundsList = componentPadBounds.get(footprintId) || []
        padBoundsList.forEach((candidateBounds) => {
            const overlapArea = boundsOverlapArea(bounds, candidateBounds)
            if (overlapArea <= 0) return

            const distance = squaredDistance(
                boundsCenter(bounds),
                boundsCenter(candidateBounds)
            )
            if (
                overlapArea > bestArea ||
                (overlapArea === bestArea && distance < bestDistance)
            ) {
                best = { component, index }
                bestArea = overlapArea
                bestDistance = distance
            }
        })
    })

    return best
        ? {
              footprintId: componentFootprintId(best.component, best.index),
              reference: componentDesignator(best.component)
          }
        : null
}

/**
 * Resolves ownership for footprint outline markers near the edge of a pad cloud.
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds
 * @param {readonly object[]} components
 * @param {Map<string, { minX: number, minY: number, maxX: number, maxY: number }[]>} [componentPadBounds]
 * @returns {{ footprintId: string, reference: string } | null}
 */
function componentOwnerForPadCloudEdgeBounds(
    bounds,
    components,
    componentPadBounds
) {
    if (!componentPadBounds?.size) return null

    let best = null
    let bestDistance = Number.POSITIVE_INFINITY

    components.forEach((component, index) => {
        const footprintId = componentFootprintId(component, index)
        const padBoundsList = componentPadBounds.get(footprintId) || []
        if (!padBoundsList.length) return
        if (!hasCompatibleEdgeMarkerStroke(bounds, padBoundsList)) return

        const padCloudBounds = unionBounds(padBoundsList)
        if (
            !boundsIntersect(
                bounds,
                expandBounds(padCloudBounds, PAD_CLOUD_EDGE_MARKER_PADDING)
            )
        ) {
            return
        }

        const edgeDistance = boundsEdgeDistance(bounds, padCloudBounds)
        if (edgeDistance > PAD_CLOUD_EDGE_MARKER_PADDING) return

        if (edgeDistance < bestDistance) {
            best = { component, index }
            bestDistance = edgeDistance
        }
    })

    return best
        ? {
              footprintId: componentFootprintId(best.component, best.index),
              reference: componentDesignator(best.component)
          }
        : null
}

/**
 * Checks whether a footprint marker stroke matches the pad scale it borders.
 * @param {{ strokeWidth?: number }} bounds
 * @param {{ shortSide?: number }[]} padBoundsList
 * @returns {boolean}
 */
function hasCompatibleEdgeMarkerStroke(bounds, padBoundsList) {
    const strokeWidth = Number(bounds?.strokeWidth || 0)
    if (strokeWidth <= 0) return true

    const padShortSide = representativePadShortSide(padBoundsList)
    return (
        padShortSide <= 0 ||
        strokeWidth >= padShortSide * EDGE_MARKER_MIN_PAD_STROKE_RATIO
    )
}

/**
 * Resolves the representative small side across a component's pad cloud.
 * @param {{ shortSide?: number }[]} padBoundsList
 * @returns {number}
 */
function representativePadShortSide(padBoundsList) {
    const values = padBoundsList
        .map((bounds) => Number(bounds.shortSide || 0))
        .filter((value) => value > 0)
        .sort((first, second) => first - second)
    return values.length ? values[Math.floor(values.length / 2)] : 0
}

/**
 * Resolves ownership against expanded component pad clouds.
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds
 * @param {readonly object[]} components
 * @param {Map<string, { minX: number, minY: number, maxX: number, maxY: number }>} [componentPadBounds]
 * @returns {{ footprintId: string, reference: string } | null}
 */
function componentOwnerForExpandedPadBounds(
    bounds,
    components,
    componentPadBounds
) {
    if (!componentPadBounds?.size) return null

    let best = null
    let bestDistance = Number.POSITIVE_INFINITY

    components.forEach((component, index) => {
        const footprintId = componentFootprintId(component, index)
        const padBounds = componentPadBounds.get(footprintId)
        if (!padBounds || !boundsIntersect(bounds, padBounds)) return

        const distance = squaredDistance(boundsCenter(bounds), {
            x: Number(component?.x || 0),
            y: Number(component?.y || 0)
        })
        if (distance < bestDistance) {
            best = { component, index }
            bestDistance = distance
        }
    })

    return best
        ? {
              footprintId: componentFootprintId(best.component, best.index),
              reference: componentDesignator(best.component)
          }
        : null
}

/**
 * Renders transparent component hit areas for shared app selection handling.
 * @param {readonly object[]} components
 * @param {Map<string, { minX: number, minY: number, maxX: number, maxY: number }>} componentBounds
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {string}
 */
export function renderComponentHitAreas(components, componentBounds, helpers) {
    const hitAreas = components
        .map((component, index) => {
            const footprintId = componentFootprintId(component, index)
            const bounds =
                componentBounds.get(footprintId) ||
                expandBounds(
                    componentProfileBounds(component),
                    COMPONENT_HIGHLIGHT_PADDING
                )
            return { component, index, footprintId, bounds }
        })
        .sort((first, second) => {
            const areaDifference =
                componentHitAreaArea(second.bounds) -
                componentHitAreaArea(first.bounds)
            return areaDifference || first.index - second.index
        })
        .map(({ component, footprintId, bounds }) => {
            return [
                '<rect class="pcb-component-hit-area"',
                ` data-footprint-id="${helpers.escapeAttribute(footprintId)}"`,
                ` data-component-reference="${helpers.escapeAttribute(componentDesignator(component))}"`,
                ` x="${helpers.formatNumber(bounds.minX)}"`,
                ` y="${helpers.formatNumber(bounds.minY)}"`,
                ` width="${helpers.formatNumber(bounds.maxX - bounds.minX)}"`,
                ` height="${helpers.formatNumber(bounds.maxY - bounds.minY)}"`,
                ' fill="#000000"',
                ' fill-opacity="0"',
                ' pointer-events="all"',
                '/>'
            ].join('')
        })
        .join('')

    return hitAreas
        ? '<g class="pcb-component-hit-areas">' + hitAreas + '</g>'
        : ''
}

/**
 * Returns a component hit area's rectangular area for SVG stacking order.
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds
 * @returns {number}
 */
function componentHitAreaArea(bounds) {
    return (
        Math.max(Number(bounds.maxX) - Number(bounds.minX), 0) *
        Math.max(Number(bounds.maxY) - Number(bounds.minY), 0)
    )
}

/**
 * Builds the stable app footprint id for an Altium component.
 * @param {object} component
 * @param {number} index
 * @returns {string}
 */
export function componentFootprintId(component, index = 0) {
    return 'altium:' + (componentDesignator(component) || String(index))
}

/**
 * Returns the visible Altium designator text.
 * @param {object} component
 * @returns {string}
 */
export function componentDesignator(component) {
    return String(component?.designator || '').trim()
}

/**
 * Builds visual bounds for every rendered component in one pass.
 * @param {readonly object[]} components
 * @param {{ pads?: object[], fills?: object[], tracks?: object[], arcs?: object[], regions?: object[], shapeBasedRegions?: object[] }} pcb
 * @returns {Map<string, { minX: number, minY: number, maxX: number, maxY: number }>}
 */
export function buildComponentVisualBounds(components, pcb) {
    const componentPadBounds = buildComponentPadOwnershipBounds(
        pcb.pads || [],
        components
    )
    const ownedBoundsById = cloneOwnedBoundsMap(componentPadBounds.exact)
    addOwnedPrimitiveBounds(
        ownedBoundsById,
        (pcb.fills || []).filter((fill) => !isCopperPrimitive(fill)),
        components,
        fillBounds,
        componentPadBounds
    )
    addOwnedPrimitiveBounds(
        ownedBoundsById,
        (pcb.tracks || []).filter((track) => !isCopperPrimitive(track)),
        components,
        trackBounds,
        componentPadBounds
    )
    addOwnedPrimitiveBounds(
        ownedBoundsById,
        (pcb.arcs || []).filter((arc) => !isCopperPrimitive(arc)),
        components,
        arcBounds,
        componentPadBounds
    )
    addOwnedPrimitiveBounds(
        ownedBoundsById,
        selectRenderedRegions(pcb).filter(
            (region) =>
                !isCopperPrimitive(region) ||
                primitiveDeclaresComponentIndex(region)
        ),
        components,
        regionBounds,
        componentPadBounds
    )

    return new Map(
        components.map((component, index) => {
            const footprintId = componentFootprintId(component, index)
            const ownedBounds = ownedBoundsById.get(footprintId) || []
            const bounds = ownedBounds.length
                ? unionBounds(ownedBounds)
                : componentProfileBounds(component)
            return [
                footprintId,
                expandBounds(bounds, COMPONENT_HIGHLIGHT_PADDING)
            ]
        })
    )
}

/**
 * Builds exact and expanded pad-cloud bounds for every component with owned pads.
 * @param {readonly object[]} pads
 * @param {readonly object[]} components
 * @returns {{ exact: Map<string, { minX: number, minY: number, maxX: number, maxY: number }[]>, expanded: Map<string, { minX: number, minY: number, maxX: number, maxY: number }> }}
 */
export function buildComponentPadOwnershipBounds(pads, components) {
    const exact = new Map()
    addOwnedPadBounds(exact, pads, components)
    return {
        exact,
        expanded: expandOwnedBoundsMap(
            exact,
            FOOTPRINT_OWNERSHIP_PADDING,
            components
        )
    }
}

/**
 * Clones an owned bounds list map so later primitive ownership can mutate it.
 * @param {Map<string, { minX: number, minY: number, maxX: number, maxY: number }[]>} ownedBoundsById
 * @returns {Map<string, { minX: number, minY: number, maxX: number, maxY: number }[]>}
 */
function cloneOwnedBoundsMap(ownedBoundsById) {
    return new Map(
        [...ownedBoundsById.entries()].map(([footprintId, ownedBounds]) => [
            footprintId,
            [...ownedBounds]
        ])
    )
}

/**
 * Adds pad bounds to a footprint-indexed map using pad-specific ownership.
 * @param {Map<string, { minX: number, minY: number, maxX: number, maxY: number }[]>} ownedBoundsById
 * @param {readonly object[]} pads
 * @param {readonly object[]} components
 * @returns {void}
 */
function addOwnedPadBounds(ownedBoundsById, pads, components) {
    pads.forEach((pad) => {
        const bounds = padBounds(pad)
        const owner = componentOwnerForPad(pad, components)
        if (!owner || !bounds) return

        const ownedBounds = ownedBoundsById.get(owner.footprintId) || []
        ownedBounds.push(bounds)
        ownedBoundsById.set(owner.footprintId, ownedBounds)
    })
}

/**
 * Adds owned primitive bounds to a footprint-indexed map.
 * @param {Map<string, { minX: number, minY: number, maxX: number, maxY: number }[]>} ownedBoundsById
 * @param {readonly object[]} primitives
 * @param {readonly object[]} components
 * @param {(primitive: object) => ({ minX: number, minY: number, maxX: number, maxY: number } | null)} [boundsResolver]
 * @param {Map<string, { minX: number, minY: number, maxX: number, maxY: number }>} [componentPadBounds]
 * @returns {void}
 */
function addOwnedPrimitiveBounds(
    ownedBoundsById,
    primitives,
    components,
    boundsResolver = padBounds,
    componentPadBounds
) {
    primitives.forEach((primitive) => {
        const bounds = boundsResolver(primitive)
        const owner = primitiveDeclaresComponentIndex(primitive)
            ? componentOwnerForPrimitive(primitive, components)
            : componentOwnerForBounds(bounds, components, componentPadBounds)
        if (!owner || !bounds) return

        const ownedBounds = ownedBoundsById.get(owner.footprintId) || []
        ownedBounds.push(bounds)
        ownedBoundsById.set(owner.footprintId, ownedBounds)
    })
}

/**
 * Resolves ownership for one pad, preferring fine-pitch package edge-pad rows
 * over nearby small passive components.
 * @param {object | undefined} pad
 * @param {readonly object[]} components
 * @returns {{ footprintId: string, reference: string } | null}
 */
export function componentOwnerForPad(pad, components) {
    const bounds = padBounds(pad)
    if (!bounds) return null

    if (primitiveDeclaresComponentIndex(pad)) {
        return componentOwnerForPrimitive(pad, components)
    }

    return (
        ownerFromCandidate(
            connectorOwnerCandidateForPad(
                pad,
                bounds,
                components,
                componentDetailBounds
            )
        ) ||
        componentOwnerForFinePitchEdgePad(pad, bounds, components) ||
        componentOwnerForBounds(bounds, components)
    )
}

/**
 * Returns true when the primitive carries native Altium component linkage.
 * @param {object | undefined} primitive
 * @returns {boolean}
 */
export function primitiveDeclaresComponentIndex(primitive) {
    return (
        !!primitive &&
        typeof primitive === 'object' &&
        Object.prototype.hasOwnProperty.call(primitive, 'componentIndex')
    )
}

/**
 * Resolves an owner from native Altium primitive component linkage.
 * @param {object | undefined} primitive
 * @param {readonly object[]} components
 * @returns {{ footprintId: string, reference: string } | null}
 */
export function componentOwnerForPrimitive(primitive, components) {
    const rawComponentIndex = primitive?.componentIndex
    if (
        rawComponentIndex === null ||
        rawComponentIndex === undefined ||
        rawComponentIndex === ''
    ) {
        return null
    }

    const componentIndex = Number(rawComponentIndex)
    if (!Number.isInteger(componentIndex) || componentIndex < 0) return null

    const matchedIndex = components.findIndex(
        (component) => Number(component?.componentIndex) === componentIndex
    )
    const index =
        matchedIndex >= 0
            ? matchedIndex
            : Number(components[componentIndex]?.componentIndex) ===
                    componentIndex ||
                components.every(
                    (component) => component?.componentIndex === undefined
                )
              ? componentIndex
              : -1
    const component = components[index]
    if (!component) return null

    return {
        footprintId: componentFootprintId(component, index),
        reference: componentDesignator(component)
    }
}

/**
 * Resolves the fine-pitch package owner for narrow perimeter pads.
 * @param {object | undefined} pad
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds
 * @param {readonly object[]} components
 * @returns {{ footprintId: string, reference: string } | null}
 */
function componentOwnerForFinePitchEdgePad(pad, bounds, components) {
    if (!isFinePitchEdgePad(pad)) return null

    let best = null
    let bestDistance = Number.POSITIVE_INFINITY

    components.forEach((component, index) => {
        if (!isFinePitchPackage(component)) return
        if (!boundsIntersect(bounds, componentDetailBounds(component))) return

        const distance = squaredDistance(boundsCenter(bounds), {
            x: Number(component?.x || 0),
            y: Number(component?.y || 0)
        })
        if (distance < bestDistance) {
            best = { component, index }
            bestDistance = distance
        }
    })

    return best
        ? {
              footprintId: componentFootprintId(best.component, best.index),
              reference: componentDesignator(best.component)
          }
        : null
}

/**
 * Checks whether one pad has the narrow shape used by perimeter package pins.
 * @param {object | undefined} pad
 * @returns {boolean}
 */
function isFinePitchEdgePad(pad) {
    if (!pad || Number(pad.holeDiameter || 0) > 0) return false

    const size = resolvePadSurfaceSize(pad)
    const shortSide = Math.min(size.width, size.height)
    const longSide = Math.max(size.width, size.height)
    return shortSide <= 14 && longSide >= 24 && longSide <= 54
}

/**
 * Checks whether a component is a fine-pitch surface-mount package.
 * @param {object | undefined} component
 * @returns {boolean}
 */
function isFinePitchPackage(component) {
    const normalized = componentDescriptor(component)
    return /(?:^|[^A-Z0-9])(?:V?QFN|QFP|LQFP|TQFP|[UW]?SON|DFN|LGA)(?:[^A-Z]|$)/u.test(
        normalized
    )
}

/**
 * Expands every footprint-owned primitive union in a bounds map.
 * @param {Map<string, { minX: number, minY: number, maxX: number, maxY: number }[]>} ownedBoundsById
 * @param {number} padding
 * @param {readonly object[]} [components]
 * @returns {Map<string, { minX: number, minY: number, maxX: number, maxY: number }>}
 */
function expandOwnedBoundsMap(ownedBoundsById, padding, components = []) {
    const componentsById = new Map(
        components.map((component, index) => [
            componentFootprintId(component, index),
            component
        ])
    )

    return new Map(
        [...ownedBoundsById.entries()].map(([footprintId, ownedBounds]) => [
            footprintId,
            expandBounds(
                unionBounds(ownedBounds),
                footprintOwnershipPadding(
                    componentsById.get(footprintId),
                    padding
                )
            )
        ])
    )
}

/**
 * Resolves pad-cloud padding used only for ownership inference.
 * @param {object | undefined} component
 * @param {number} fallbackPadding
 * @returns {number}
 */
function footprintOwnershipPadding(component, fallbackPadding) {
    const profile = componentProfile(component)
    if (!profile.isRecognized) return fallbackPadding
    if (Math.max(profile.width, profile.height) >= 180) {
        return fallbackPadding
    }
    return Math.min(fallbackPadding, 36)
}

/**
 * Resolves a rotated fallback profile rectangle in board coordinates.
 * @param {object} component
 * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
 */
function componentProfileBounds(component) {
    const profile = componentProfile(component)
    const angle = (Number(component?.rotation || 0) * Math.PI) / 180
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const centerX = Number(component?.x || 0)
    const centerY = Number(component?.y || 0)
    const halfWidth = profile.width / 2
    const halfHeight = profile.height / 2
    return unionPoints(
        [
            { x: -halfWidth, y: -halfHeight },
            { x: halfWidth, y: -halfHeight },
            { x: halfWidth, y: halfHeight },
            { x: -halfWidth, y: halfHeight }
        ].map((point) => ({
            x: centerX + point.x * cos - point.y * sin,
            y: centerY + point.x * sin + point.y * cos
        }))
    )
}

/**
 * Builds an approximate component-local detail search box.
 * @param {object} component
 * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
 */
function componentDetailBounds(component) {
    if (isConnectorComponent(component)) {
        return expandBounds(componentProfileBounds(component), 36)
    }

    const profile = componentProfile(component)
    const halfWidth = profile.isRecognized
        ? profile.width / 2 + 36
        : GENERIC_DETAIL_SEARCH_HALF_EXTENT
    const halfHeight = profile.isRecognized
        ? profile.height / 2 + 36
        : GENERIC_DETAIL_SEARCH_HALF_EXTENT

    return {
        minX: Number(component?.x || 0) - halfWidth,
        minY: Number(component?.y || 0) - halfHeight,
        maxX: Number(component?.x || 0) + halfWidth,
        maxY: Number(component?.y || 0) + halfHeight
    }
}

/**
 * Resolves a component footprint profile from its pattern name.
 * @param {object} component
 * @returns {{ width: number, height: number, isRecognized: boolean }}
 */
function componentProfile(component) {
    const normalized = componentDescriptor(component)
    const finePitchPinCount = Number(
        normalized.match(
            /(?:^|[^A-Z0-9])(?:V?QFN|QFP|LQFP|TQFP)[-_ ]?(\d{2,3})(?:[^A-Z0-9]|$)/u
        )?.[1] || 0
    )
    const compactIcPinCount = Number(
        normalized.match(
            /(?:^|[^A-Z0-9])(?:[UW]?SON|DFN|LGA)[-_ ]?(\d{1,2})(?:[^A-Z0-9]|$)/u
        )?.[1] || 0
    )
    if (normalized.includes('0402')) {
        return { width: 52, height: 28, isRecognized: true }
    }
    if (normalized.includes('0603')) {
        return { width: 72, height: 36, isRecognized: true }
    }
    if (normalized.includes('0805')) {
        return { width: 92, height: 48, isRecognized: true }
    }
    if (normalized.includes('SOT')) {
        return { width: 140, height: 90, isRecognized: true }
    }
    if (/(?:^|[^A-Z0-9])(?:[UW]?SON|DFN|LGA)(?:[^A-Z]|$)/u.test(normalized)) {
        const size = compactIcPinCount
            ? Math.min(Math.max(compactIcPinCount * 16, 96), 180)
            : 120
        return {
            width: size,
            height: Math.max(size * 0.72, 70),
            isRecognized: true
        }
    }
    if (normalized.includes('QFN') || normalized.includes('QFP')) {
        const size = finePitchPinCount
            ? Math.min(Math.max(finePitchPinCount * 10, 180), 640)
            : 180
        return { width: size, height: size, isRecognized: true }
    }
    if (normalized.includes('SC70')) {
        return { width: 110, height: 70, isRecognized: true }
    }
    if (isConnectorComponent(component)) {
        return {
            ...connectorProfile(component),
            isRecognized: true
        }
    }
    return { width: 96, height: 60, isRecognized: false }
}

/**
 * Resolves a pad's top-view bounding box.
 * @param {object | undefined} pad
 * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
 */
function padBounds(pad) {
    if (!pad) return null

    const size = resolvePadSurfaceSize(pad)
    const rotationRadians = (Number(pad.rotation || 0) * Math.PI) / 180
    const boxWidth =
        Math.abs(size.width * Math.cos(rotationRadians)) +
        Math.abs(size.height * Math.sin(rotationRadians))
    const boxHeight =
        Math.abs(size.width * Math.sin(rotationRadians)) +
        Math.abs(size.height * Math.cos(rotationRadians))
    const centerX = Number(pad.x || 0) + Number(pad.offsetTopX || 0)
    const centerY = Number(pad.y || 0) + Number(pad.offsetTopY || 0)

    return {
        minX: centerX - boxWidth / 2,
        minY: centerY - boxHeight / 2,
        maxX: centerX + boxWidth / 2,
        maxY: centerY + boxHeight / 2,
        shortSide: Math.min(size.width, size.height)
    }
}

/**
 * Resolves a fill primitive's bounds.
 * @param {object | undefined} fill
 * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
 */
function fillBounds(fill) {
    if (!fill) return null

    const x1 = Number(fill.x1)
    const y1 = Number(fill.y1)
    const x2 = Number(fill.x2)
    const y2 = Number(fill.y2)
    if (![x1, y1, x2, y2].every(Number.isFinite)) return null

    return {
        minX: Math.min(x1, x2),
        minY: Math.min(y1, y2),
        maxX: Math.max(x1, x2),
        maxY: Math.max(y1, y2)
    }
}

/**
 * Resolves a track primitive's stroke bounds.
 * @param {object | undefined} track
 * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
 */
function trackBounds(track) {
    if (!track) return null

    const x1 = Number(track.x1)
    const y1 = Number(track.y1)
    const x2 = Number(track.x2)
    const y2 = Number(track.y2)
    if (![x1, y1, x2, y2].every(Number.isFinite)) return null

    const halfWidth = Math.max(Number(track.width || 0) / 2, 0)
    return {
        minX: Math.min(x1, x2) - halfWidth,
        minY: Math.min(y1, y2) - halfWidth,
        maxX: Math.max(x1, x2) + halfWidth,
        maxY: Math.max(y1, y2) + halfWidth,
        strokeWidth: halfWidth * 2
    }
}

/**
 * Resolves a conservative arc primitive's bounds.
 * @param {object | undefined} arc
 * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
 */
function arcBounds(arc) {
    if (!arc) return null

    const x = Number(arc.x)
    const y = Number(arc.y)
    const radius = Number(arc.radius)
    if (![x, y, radius].every(Number.isFinite)) return null

    const halfWidth = Math.max(Number(arc.width || 0) / 2, 0)
    const extent = Math.max(radius, 0) + halfWidth
    return {
        minX: x - extent,
        minY: y - extent,
        maxX: x + extent,
        maxY: y + extent
    }
}

/**
 * Resolves a region primitive's contour bounds.
 * @param {object | undefined} region
 * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
 */
function regionBounds(region) {
    const points = [
        ...(region?.points || []),
        ...(region?.holes || []).flat()
    ].filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y))

    return points.length ? unionPoints(points) : null
}

/**
 * Selects the preferred region stream for rendering and ownership.
 * @param {{ regions?: object[], shapeBasedRegions?: object[] }} pcb
 * @returns {object[]}
 */
function selectRenderedRegions(pcb) {
    return (pcb.shapeBasedRegions || []).length
        ? pcb.shapeBasedRegions || []
        : pcb.regions || []
}

/**
 * Resolves one pad's visible top-view size.
 * @param {object} pad
 * @returns {{ width: number, height: number }}
 */
function resolvePadSurfaceSize(pad) {
    const width =
        Number(pad.sizeTopX || pad.sizeMidX || pad.sizeBottomX || 0) ||
        Number(pad.holeDiameter || 0)
    const height =
        Number(pad.sizeTopY || pad.sizeMidY || pad.sizeBottomY || 0) ||
        Number(pad.holeDiameter || 0)

    return {
        width: Math.max(width, Number(pad.holeDiameter || 0), 1),
        height: Math.max(height, Number(pad.holeDiameter || 0), 1)
    }
}
