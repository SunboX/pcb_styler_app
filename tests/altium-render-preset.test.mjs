// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumPcbSvgRenderer } from '../src/ui/AltiumPcbSvgRenderer.mjs'

test('AltiumPcbSvgRenderer applies the KiCad preview render preset', () => {
    const renderer = new AltiumPcbSvgRenderer()
    const manual = renderer.render(createAltiumBoard(), {
        layerStyles: {
            traces: { visible: false },
            zones: { visible: false },
            vias: { visible: false }
        },
        renderPreset: 'manual'
    })
    const kicad = renderer.render(createAltiumBoard(), {
        layerStyles: {
            traces: { visible: false },
            zones: { visible: false },
            vias: { visible: false }
        },
        renderPreset: 'kicad'
    })

    assert.doesNotMatch(manual, /pcb-svg--kicad-preview/u)
    assert.match(kicad, /pcb-svg--kicad-preview/u)
    assert.match(kicad, /class="pcb-render-background"/u)
    assert.match(kicad, /class="board-outline"[^>]*fill="#df8060"/u)
    assert.match(kicad, /class="[^"]*pcb-track[^"]*"[^>]*stroke="#fff0a2"/u)
    assert.match(kicad, /class="[^"]*pcb-fill[^"]*"[^>]*fill="#df8060"/u)
    assert.match(kicad, /class="pcb-via__pad"[^>]*fill="#f2c843"/u)
    assert.match(kicad, /class="pcb-pad__ring"[^>]*fill="#fff0a2"/u)
    assert.match(kicad, /class="pcb-pad__hole"[^>]*fill="#061326"/u)
})

/**
 * Creates a small normalized Altium PCB model with copper, via, and pad art.
 * @returns {object}
 */
function createAltiumBoard() {
    return {
        kind: 'pcb',
        fileType: 'PcbDoc',
        fileName: 'preset.PcbDoc',
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
            primitiveLayers: [],
            polygons: [],
            fills: [
                {
                    x1: 100,
                    y1: 100,
                    x2: 220,
                    y2: 180,
                    layerId: 1,
                    layerCode: 1
                }
            ],
            tracks: [
                {
                    x1: 110,
                    y1: 250,
                    x2: 350,
                    y2: 250,
                    width: 12,
                    layerId: 1,
                    layerCode: 1
                }
            ],
            arcs: [],
            vias: [{ x: 430, y: 250, diameter: 70, holeDiameter: 28 }],
            pads: [
                {
                    name: '1',
                    x: 520,
                    y: 310,
                    sizeTopX: 90,
                    sizeTopY: 55,
                    holeDiameter: 30,
                    shapeTop: 1,
                    rotation: 0
                }
            ],
            components: []
        }
    }
}
