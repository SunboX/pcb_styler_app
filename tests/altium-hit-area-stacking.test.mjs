// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import {
    componentFootprintId,
    renderComponentHitAreas
} from '../src/ui/AltiumComponentOwnership.mjs'
import { PcbSvgRendererDecorator } from '../src/ui/PcbSvgRendererDecorator.mjs'

test('Altium hit areas keep broad connector targets behind nearby passives', () => {
    const components = [
        createComponent('C40', '0603'),
        createComponent('C44', '0603'),
        createComponent('J1', 'HEADER')
    ]
    const markup = renderComponentHitAreas(
        components,
        createOverlappingComponentBounds(components),
        PcbSvgRendererDecorator
    )

    assert.ok(
        markup.indexOf('data-footprint-id="altium:J1"') <
            markup.indexOf('data-footprint-id="altium:C40"')
    )
    assert.ok(
        markup.indexOf('data-footprint-id="altium:J1"') <
            markup.indexOf('data-footprint-id="altium:C44"')
    )
})

/**
 * Creates a minimal Altium component record.
 * @param {string} designator
 * @param {string} pattern
 * @returns {object}
 */
function createComponent(designator, pattern) {
    return {
        designator,
        pattern,
        x: 0,
        y: 0,
        rotation: 0,
        layer: 'Top'
    }
}

/**
 * Creates a bounds map matching dense boards where a connector envelope covers
 * small neighboring capacitors.
 * @param {readonly object[]} components
 * @returns {Map<string, { minX: number, minY: number, maxX: number, maxY: number }>}
 */
function createOverlappingComponentBounds(components) {
    return new Map([
        [
            componentFootprintId(components[0], 0),
            { minX: 90, minY: 90, maxX: 150, maxY: 130 }
        ],
        [
            componentFootprintId(components[1], 1),
            { minX: 90, minY: 140, maxX: 150, maxY: 180 }
        ],
        [
            componentFootprintId(components[2], 2),
            { minX: 60, minY: 60, maxX: 240, maxY: 240 }
        ]
    ])
}
