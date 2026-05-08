// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Checks if two bounds overlap.
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} first
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} second
 * @returns {boolean}
 */
export function boundsIntersect(first, second) {
    return !(
        first.maxX < second.minX ||
        first.minX > second.maxX ||
        first.maxY < second.minY ||
        first.minY > second.maxY
    )
}

/**
 * Calculates the overlap area between two bounds.
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} first
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} second
 * @returns {number}
 */
export function boundsOverlapArea(first, second) {
    const width = Math.max(
        Math.min(first.maxX, second.maxX) - Math.max(first.minX, second.minX),
        0
    )
    const height = Math.max(
        Math.min(first.maxY, second.maxY) - Math.max(first.minY, second.minY),
        0
    )
    return width * height
}

/**
 * Returns the center point of a bounds object.
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds
 * @returns {{ x: number, y: number }}
 */
export function boundsCenter(bounds) {
    return {
        x: (bounds.minX + bounds.maxX) / 2,
        y: (bounds.minY + bounds.maxY) / 2
    }
}

/**
 * Returns the shortest center-point distance to any edge of a bounds object.
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} inner
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} outer
 * @returns {number}
 */
export function boundsEdgeDistance(inner, outer) {
    const center = boundsCenter(inner)
    return Math.min(
        Math.abs(center.x - outer.minX),
        Math.abs(center.x - outer.maxX),
        Math.abs(center.y - outer.minY),
        Math.abs(center.y - outer.maxY)
    )
}

/**
 * Returns squared distance between two points.
 * @param {{ x: number, y: number }} first
 * @param {{ x: number, y: number }} second
 * @returns {number}
 */
export function squaredDistance(first, second) {
    const dx = first.x - second.x
    const dy = first.y - second.y
    return dx * dx + dy * dy
}

/**
 * Unions several bounds objects.
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }[]} bounds
 * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
 */
export function unionBounds(bounds) {
    return {
        minX: Math.min(...bounds.map((item) => item.minX)),
        minY: Math.min(...bounds.map((item) => item.minY)),
        maxX: Math.max(...bounds.map((item) => item.maxX)),
        maxY: Math.max(...bounds.map((item) => item.maxY))
    }
}

/**
 * Unions point coordinates into bounds.
 * @param {{ x: number, y: number }[]} points
 * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
 */
export function unionPoints(points) {
    return {
        minX: Math.min(...points.map((point) => point.x)),
        minY: Math.min(...points.map((point) => point.y)),
        maxX: Math.max(...points.map((point) => point.x)),
        maxY: Math.max(...points.map((point) => point.y))
    }
}

/**
 * Expands bounds by a fixed amount.
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds
 * @param {number} padding
 * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
 */
export function expandBounds(bounds, padding) {
    return {
        minX: bounds.minX - padding,
        minY: bounds.minY - padding,
        maxX: bounds.maxX + padding,
        maxY: bounds.maxY + padding
    }
}
