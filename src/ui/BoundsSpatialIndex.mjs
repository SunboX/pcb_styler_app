// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: AGPL-3.0-or-later

/** @type {number} */
const DEFAULT_CELL_SIZE = 240

/**
 * Grid index for querying rectangular board-coordinate bounds.
 */
export class BoundsSpatialIndex {
    /**
     * Builds a spatial index from bounded records.
     * @template T
     * @param {readonly T[]} items
     * @param {(item: T) => ({ minX: number, minY: number, maxX: number, maxY: number } | null | undefined)} boundsForItem
     * @param {number} [cellSize]
     * @returns {{ cellSize: number, cells: Map<string, T[]> }}
     */
    static build(items, boundsForItem, cellSize = DEFAULT_CELL_SIZE) {
        const index = { cellSize, cells: new Map() }
        items.forEach((item) => {
            const bounds = boundsForItem(item)
            if (!bounds) return

            BoundsSpatialIndex.#cellKeys(bounds, cellSize).forEach((key) => {
                const cellItems = index.cells.get(key) || []
                cellItems.push(item)
                index.cells.set(key, cellItems)
            })
        })
        return index
    }

    /**
     * Returns unique indexed records whose grid cells overlap the query bounds.
     * @template T
     * @param {{ cellSize: number, cells: Map<string, T[]> } | null | undefined} index
     * @param {{ minX: number, minY: number, maxX: number, maxY: number } | null | undefined} bounds
     * @returns {T[]}
     */
    static query(index, bounds) {
        if (!index || !bounds) return []

        const seen = new Set()
        const matches = []
        BoundsSpatialIndex.#cellKeys(bounds, index.cellSize).forEach((key) => {
            const cellItems = index.cells.get(key) || []
            cellItems.forEach((item) => {
                if (seen.has(item)) return

                seen.add(item)
                matches.push(item)
            })
        })
        return matches
    }

    /**
     * Returns every grid key touched by one bounds rectangle.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds
     * @param {number} cellSize
     * @returns {string[]}
     */
    static #cellKeys(bounds, cellSize) {
        const minColumn = Math.floor(Number(bounds.minX || 0) / cellSize)
        const maxColumn = Math.floor(Number(bounds.maxX || 0) / cellSize)
        const minRow = Math.floor(Number(bounds.minY || 0) / cellSize)
        const maxRow = Math.floor(Number(bounds.maxY || 0) / cellSize)
        const keys = []

        for (let row = minRow; row <= maxRow; row += 1) {
            for (let column = minColumn; column <= maxColumn; column += 1) {
                keys.push(column + ':' + row)
            }
        }
        return keys
    }
}
