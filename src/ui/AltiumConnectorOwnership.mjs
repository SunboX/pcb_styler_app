// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
    boundsCenter,
    boundsEdgeDistance,
    boundsIntersect,
    expandBounds,
    squaredDistance
} from './BoundsGeometry.mjs'

/** @type {number} */
const CONNECTOR_PROFILE_WIDTH = 360

/** @type {number} */
const CONNECTOR_PROFILE_HEIGHT = 1320

/** @type {number} */
const COMPACT_CONNECTOR_PROFILE_WIDTH = 360

/** @type {number} */
const COMPACT_CONNECTOR_PROFILE_HEIGHT = 520

/** @type {number} */
const USB_CONNECTOR_PROFILE_WIDTH = 560

/** @type {number} */
const USB_CONNECTOR_PROFILE_HEIGHT = 420

/** @type {number} */
const CONNECTOR_PAD_MAX_HOLE_DIAMETER = 100

/** @type {number} */
const CONNECTOR_PAD_MAX_SURFACE_SIZE = 180

/** @type {number} */
const CONNECTOR_OUTLINE_MIN_STROKE_WIDTH = 7

/** @type {number} */
const CONNECTOR_OUTLINE_MIN_LENGTH_RATIO = 4

/**
 * Resolves sparse through-hole pads that belong to connector footprints.
 * @param {object | undefined} pad
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds
 * @param {readonly object[]} components
 * @param {(component: object) => { minX: number, minY: number, maxX: number, maxY: number }} detailBoundsResolver
 * @returns {{ component: object, index: number } | null}
 */
export function connectorOwnerCandidateForPad(
    pad,
    bounds,
    components,
    detailBoundsResolver
) {
    if (!isConnectorPadCandidate(pad)) return null

    let best = null
    let bestDistance = Number.POSITIVE_INFINITY

    components.forEach((component, index) => {
        if (!isConnectorComponent(component)) return
        if (!boundsIntersect(bounds, detailBoundsResolver(component))) return

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
}

/**
 * Resolves wide outline strokes that form large sparse connector bodies.
 * @param {{ minX: number, minY: number, maxX: number, maxY: number, strokeWidth?: number }} bounds
 * @param {readonly object[]} components
 * @param {(component: object) => { minX: number, minY: number, maxX: number, maxY: number }} profileBoundsResolver
 * @returns {{ component: object, index: number } | null}
 */
export function connectorOwnerCandidateForOutlineBounds(
    bounds,
    components,
    profileBoundsResolver
) {
    if (!isConnectorOutlineBounds(bounds)) return null

    let best = null
    let bestDistance = Number.POSITIVE_INFINITY
    const center = boundsCenter(bounds)

    components.forEach((component, index) => {
        if (!isSparseConnectorComponent(component)) return

        const profileBounds = profileBoundsResolver(component)
        const outlineBounds = connectorOutlineSearchBounds(
            profileBounds,
            bounds
        )
        if (!pointInsideBounds(center, outlineBounds)) return

        const distance = boundsEdgeDistance(bounds, profileBounds)
        if (distance < bestDistance) {
            best = { component, index }
            bestDistance = distance
        }
    })

    return best
}

/**
 * Resolves a connector footprint search profile from generic metadata.
 * @param {object | undefined} component
 * @returns {{ width: number, height: number }}
 */
export function connectorProfile(component) {
    if (isUsbConnectorComponent(component)) {
        return {
            width: USB_CONNECTOR_PROFILE_WIDTH,
            height: USB_CONNECTOR_PROFILE_HEIGHT
        }
    }
    if (isCompactConnectorComponent(component)) {
        return {
            width: COMPACT_CONNECTOR_PROFILE_WIDTH,
            height: COMPACT_CONNECTOR_PROFILE_HEIGHT
        }
    }
    return {
        width: CONNECTOR_PROFILE_WIDTH,
        height: CONNECTOR_PROFILE_HEIGHT
    }
}

/**
 * Checks whether a component footprint is connector-like.
 * @param {object | undefined} component
 * @returns {boolean}
 */
export function isConnectorComponent(component) {
    const normalized = componentDescriptor(component)
    return /(?:^|[^A-Z0-9])(?:CON|CONN|CONNECTOR|HEADER|JACK|SOCKET|USB|RJ\d*|IDC|FFC|FPC|JST|PH|XH)(?:[^A-Z0-9]|$)/u.test(
        normalized
    )
}

/**
 * Builds a normalized descriptor string from footprint metadata.
 * @param {object | undefined} component
 * @returns {string}
 */
export function componentDescriptor(component) {
    return String(
        (component?.pattern || '') + ' ' + (component?.source || '')
    ).toUpperCase()
}

/**
 * Checks whether a pad shape is likely a connector pin or locating hole.
 * @param {object | undefined} pad
 * @returns {boolean}
 */
function isConnectorPadCandidate(pad) {
    if (!pad) return false

    const holeDiameter = Number(pad.holeDiameter || 0)
    if (holeDiameter <= 0 || holeDiameter > CONNECTOR_PAD_MAX_HOLE_DIAMETER) {
        return false
    }

    const size = resolvePadSurfaceSize(pad)
    return Math.max(size.width, size.height) <= CONNECTOR_PAD_MAX_SURFACE_SIZE
}

/**
 * Checks whether bounds look like a connector documentation stroke.
 * @param {{ minX: number, minY: number, maxX: number, maxY: number, strokeWidth?: number }} bounds
 * @returns {boolean}
 */
function isConnectorOutlineBounds(bounds) {
    const strokeWidth = Number(bounds?.strokeWidth || 0)
    if (strokeWidth < CONNECTOR_OUTLINE_MIN_STROKE_WIDTH) return false

    const width = Math.max(Number(bounds.maxX) - Number(bounds.minX), 0)
    const height = Math.max(Number(bounds.maxY) - Number(bounds.minY), 0)
    return (
        Math.max(width, height) >=
        strokeWidth * CONNECTOR_OUTLINE_MIN_LENGTH_RATIO
    )
}

/**
 * Builds a connector outline search box around the footprint profile.
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} profileBounds
 * @param {{ strokeWidth?: number }} bounds
 * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
 */
function connectorOutlineSearchBounds(profileBounds, bounds) {
    const strokeWidth = Number(bounds?.strokeWidth || 0)
    return expandBounds(profileBounds, Math.max(36, strokeWidth * 5))
}

/**
 * Checks whether a point lies inside one bounds object.
 * @param {{ x: number, y: number }} point
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds
 * @returns {boolean}
 */
function pointInsideBounds(point, bounds) {
    return (
        point.x >= bounds.minX &&
        point.x <= bounds.maxX &&
        point.y >= bounds.minY &&
        point.y <= bounds.maxY
    )
}

/**
 * Checks whether a connector uses a large sparse body envelope.
 * @param {object | undefined} component
 * @returns {boolean}
 */
function isSparseConnectorComponent(component) {
    return (
        isConnectorComponent(component) &&
        !isCompactConnectorComponent(component) &&
        !isUsbConnectorComponent(component)
    )
}

/**
 * Checks whether connector metadata describes a compact board connector.
 * @param {object | undefined} component
 * @returns {boolean}
 */
function isCompactConnectorComponent(component) {
    const normalized = componentDescriptor(component)
    return /(?:^|[^A-Z0-9])(?:(?:PH|SH|GH|ZH|XH)[-_ ]?\d|JST|FFC|FPC|PITCH[-_ ]?(?:0\.5|1(?:\.0|\.25|\.5)?|2(?:\.0|\.54)?))(?:[^A-Z0-9]|$)/u.test(
        normalized
    )
}

/**
 * Checks whether connector metadata describes a USB connector.
 * @param {object | undefined} component
 * @returns {boolean}
 */
function isUsbConnectorComponent(component) {
    const normalized = componentDescriptor(component)
    return /(?:^|[^A-Z0-9])(?:USB|TYPE[-_ ]?C|MICRO[-_ ]?USB|MINI[-_ ]?USB)(?:[^A-Z0-9]|$)/u.test(
        normalized
    )
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
