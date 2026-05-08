// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumPcbSvgRenderer } from '../src/ui/AltiumPcbSvgRenderer.mjs'

test('AltiumPcbSvgRenderer highlights native-indexed region primitives in place', () => {
    const renderer = new AltiumPcbSvgRenderer()
    const markup = renderer.render(createComponentIndexedRegionAltiumBoard(), {
        highlightedFootprints: ['altium:J1'],
        highlightColor: '#ff3300'
    })

    assert.match(
        markup,
        /<path class="pcb-region pcb-region--surface"(?=[^>]*data-footprint-id="altium:J1")(?=[^>]*data-highlight-state="selected")(?=[^>]*fill="#ff3300")/u
    )
    assert.match(
        markup,
        /<path class="pcb-footprint-region"(?=[^>]*data-footprint-id="altium:J1")(?=[^>]*data-highlight-state="selected")(?=[^>]*fill="#ff3300")/u
    )
})

/**
 * Creates a small board whose native component owns copper and documentation
 * region contours.
 * @returns {object}
 */
function createComponentIndexedRegionAltiumBoard() {
    return {
        kind: 'pcb',
        fileType: 'PcbDoc',
        fileName: 'region-board.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 600,
                segments: [
                    { x1: 0, y1: 0, x2: 1000, y2: 0 },
                    { x1: 1000, y1: 0, x2: 1000, y2: 600 },
                    { x1: 1000, y1: 600, x2: 0, y2: 600 },
                    { x1: 0, y1: 600, x2: 0, y2: 0 }
                ]
            },
            layers: [{ id: 1, name: 'Top Layer' }],
            primitiveLayers: [{ layerId: 33, name: 'Top Overlay' }],
            polygons: [],
            fills: [],
            tracks: [],
            arcs: [],
            vias: [],
            pads: [],
            components: [
                {
                    componentIndex: 4,
                    designator: 'J1',
                    x: 200,
                    y: 200,
                    rotation: 0,
                    layer: 'Top',
                    pattern: 'CON/REMOTE-REGION'
                }
            ],
            shapeBasedRegions: [
                {
                    componentIndex: 4,
                    layerId: 1,
                    layerCode: 1,
                    points: [
                        { x: 850, y: 850 },
                        { x: 950, y: 850 },
                        { x: 950, y: 950 },
                        { x: 850, y: 950 }
                    ],
                    holes: [
                        [
                            { x: 880, y: 880 },
                            { x: 910, y: 880 },
                            { x: 910, y: 910 },
                            { x: 880, y: 910 }
                        ]
                    ]
                },
                {
                    componentIndex: 4,
                    layerId: 33,
                    layerCode: 33,
                    points: [
                        { x: 760, y: 830 },
                        { x: 970, y: 830 },
                        { x: 970, y: 980 },
                        { x: 760, y: 980 }
                    ],
                    holes: []
                }
            ]
        }
    }
}
