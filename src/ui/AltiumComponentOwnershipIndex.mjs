// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: AGPL-3.0-or-later

import { unionBounds } from './BoundsGeometry.mjs'
import { BoundsSpatialIndex } from './BoundsSpatialIndex.mjs'

/**
 * Builds all spatial indexes used by component ownership lookup.
 * @param {Map<string, { minX: number, minY: number, maxX: number, maxY: number }[]>} exact
 * @param {Map<string, { minX: number, minY: number, maxX: number, maxY: number }>} expanded
 * @param {readonly object[]} components
 * @param {(component: object, index: number) => string} footprintIdFor
 * @param {(component: object) => { minX: number, minY: number, maxX: number, maxY: number }} detailBoundsFor
 * @returns {{ exactIndex: object, exactCloudIndex: object, expandedIndex: object, detailIndex: object }}
 */
export function buildComponentOwnershipIndexes(
    exact,
    expanded,
    components,
    footprintIdFor,
    detailBoundsFor
) {
    return {
        exactIndex: buildExactPadBoundsIndex(exact, components, footprintIdFor),
        exactCloudIndex: buildExactPadCloudIndex(
            exact,
            components,
            footprintIdFor
        ),
        expandedIndex: buildExpandedPadBoundsIndex(
            expanded,
            components,
            footprintIdFor
        ),
        detailIndex: buildComponentDetailBoundsIndex(
            components,
            footprintIdFor,
            detailBoundsFor
        )
    }
}

/**
 * Returns component detail candidates for one bounds query.
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds
 * @param {readonly object[]} components
 * @param {object | undefined} componentPadBounds
 * @param {(component: object, index: number) => string} footprintIdFor
 * @param {(component: object) => { minX: number, minY: number, maxX: number, maxY: number }} detailBoundsFor
 * @returns {{ component: object, index: number, footprintId: string, bounds: { minX: number, minY: number, maxX: number, maxY: number } }[]}
 */
export function componentDetailCandidates(
    bounds,
    components,
    componentPadBounds,
    footprintIdFor,
    detailBoundsFor
) {
    if (componentPadBounds?.detailIndex) {
        return BoundsSpatialIndex.query(componentPadBounds.detailIndex, bounds)
    }

    return components.map((component, index) => ({
        component,
        index,
        footprintId: footprintIdFor(component, index),
        bounds: detailBoundsFor(component)
    }))
}

/**
 * Returns exact pad bounds candidates for one bounds query.
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds
 * @param {readonly object[]} components
 * @param {object | undefined} componentPadBounds
 * @param {(component: object, index: number) => string} footprintIdFor
 * @returns {{ component: object, index: number, bounds: { minX: number, minY: number, maxX: number, maxY: number } }[]}
 */
export function exactPadBoundsCandidates(
    bounds,
    components,
    componentPadBounds,
    footprintIdFor
) {
    if (componentPadBounds?.exactIndex) {
        return BoundsSpatialIndex.query(componentPadBounds.exactIndex, bounds)
    }

    const exactPadBounds = componentPadBounds?.exact || componentPadBounds
    return components.flatMap((component, index) => {
        const footprintId = footprintIdFor(component, index)
        return (exactPadBounds.get(footprintId) || []).map(
            (candidateBounds) => ({
                component,
                index,
                bounds: candidateBounds
            })
        )
    })
}

/**
 * Returns exact pad-cloud candidates for one bounds query.
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds
 * @param {readonly object[]} components
 * @param {object | undefined} componentPadBounds
 * @param {(component: object, index: number) => string} footprintIdFor
 * @returns {{ component: object, index: number, padBoundsList: { minX: number, minY: number, maxX: number, maxY: number }[] }[]}
 */
export function exactPadCloudCandidates(
    bounds,
    components,
    componentPadBounds,
    footprintIdFor
) {
    if (componentPadBounds?.exactCloudIndex) {
        return BoundsSpatialIndex.query(
            componentPadBounds.exactCloudIndex,
            bounds
        )
    }

    const exactPadBounds = componentPadBounds?.exact || componentPadBounds
    return components.map((component, index) => {
        const footprintId = footprintIdFor(component, index)
        return {
            component,
            index,
            padBoundsList: exactPadBounds.get(footprintId) || []
        }
    })
}

/**
 * Returns expanded pad-cloud candidates for one bounds query.
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds
 * @param {readonly object[]} components
 * @param {object | undefined} componentPadBounds
 * @param {(component: object, index: number) => string} footprintIdFor
 * @returns {{ component: object, index: number, bounds: { minX: number, minY: number, maxX: number, maxY: number } | undefined }[]}
 */
export function expandedPadBoundsCandidates(
    bounds,
    components,
    componentPadBounds,
    footprintIdFor
) {
    if (componentPadBounds?.expandedIndex) {
        return BoundsSpatialIndex.query(
            componentPadBounds.expandedIndex,
            bounds
        )
    }

    return components.map((component, index) => {
        const footprintId = footprintIdFor(component, index)
        return {
            component,
            index,
            bounds: componentPadBounds.get(footprintId)
        }
    })
}

/**
 * Builds an index for individual component-owned pad bounds.
 * @param {Map<string, { minX: number, minY: number, maxX: number, maxY: number }[]>} exact
 * @param {readonly object[]} components
 * @param {(component: object, index: number) => string} footprintIdFor
 * @returns {{ cellSize: number, cells: Map<string, object[]> }}
 */
function buildExactPadBoundsIndex(exact, components, footprintIdFor) {
    const candidates = components.flatMap((component, index) => {
        const footprintId = footprintIdFor(component, index)
        return (exact.get(footprintId) || []).map((bounds) => ({
            component,
            index,
            bounds
        }))
    })
    return BoundsSpatialIndex.build(candidates, (candidate) => candidate.bounds)
}

/**
 * Builds an index for component-owned pad cloud bounds.
 * @param {Map<string, { minX: number, minY: number, maxX: number, maxY: number }[]>} exact
 * @param {readonly object[]} components
 * @param {(component: object, index: number) => string} footprintIdFor
 * @returns {{ cellSize: number, cells: Map<string, object[]> }}
 */
function buildExactPadCloudIndex(exact, components, footprintIdFor) {
    const candidates = components
        .map((component, index) => {
            const footprintId = footprintIdFor(component, index)
            const padBoundsList = exact.get(footprintId) || []
            return {
                component,
                index,
                padBoundsList,
                bounds: padBoundsList.length ? unionBounds(padBoundsList) : null
            }
        })
        .filter((candidate) => candidate.bounds)
    return BoundsSpatialIndex.build(candidates, (candidate) => candidate.bounds)
}

/**
 * Builds an index for expanded component pad-cloud bounds.
 * @param {Map<string, { minX: number, minY: number, maxX: number, maxY: number }>} expanded
 * @param {readonly object[]} components
 * @param {(component: object, index: number) => string} footprintIdFor
 * @returns {{ cellSize: number, cells: Map<string, object[]> }}
 */
function buildExpandedPadBoundsIndex(expanded, components, footprintIdFor) {
    const candidates = components
        .map((component, index) => {
            const footprintId = footprintIdFor(component, index)
            return {
                component,
                index,
                bounds: expanded.get(footprintId)
            }
        })
        .filter((candidate) => candidate.bounds)
    return BoundsSpatialIndex.build(candidates, (candidate) => candidate.bounds)
}

/**
 * Builds an index for fallback component detail bounds.
 * @param {readonly object[]} components
 * @param {(component: object, index: number) => string} footprintIdFor
 * @param {(component: object) => { minX: number, minY: number, maxX: number, maxY: number }} detailBoundsFor
 * @returns {{ cellSize: number, cells: Map<string, object[]> }}
 */
function buildComponentDetailBoundsIndex(
    components,
    footprintIdFor,
    detailBoundsFor
) {
    const candidates = components.map((component, index) => ({
        component,
        index,
        footprintId: footprintIdFor(component, index),
        bounds: detailBoundsFor(component)
    }))
    return BoundsSpatialIndex.build(candidates, (candidate) => candidate.bounds)
}
