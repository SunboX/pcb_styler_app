// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { KicadPcbSvgRenderer } from '../src/ui/KicadPcbSvgRenderer.mjs'

test('KicadPcbSvgRenderer empty state names board and ZIP drops', () => {
    const svg = KicadPcbSvgRenderer.render(null)

    assert.match(svg, /aria-label="Drop board file or ZIP file here\."/)
    assert.match(svg, />Drop board file or ZIP file here\.<\/text>/)
    assert.doesNotMatch(svg, /\.kicad_pcb or project \.zip/)
})

test('KicadPcbSvgRenderer applies app-owned layer styles', () => {
    const svg = KicadPcbSvgRenderer.render(createBoard(), {
        side: 'front',
        layerStyles: {
            board: { fillColor: '#112233' },
            pads: {
                fillColor: '#334455',
                borderColor: '#667788',
                borderWidth: 0.33
            },
            traces: { borderColor: '#445566', borderWidth: 0.66 },
            zones: {
                fillColor: '#556677',
                borderColor: '#556688',
                borderWidth: 0.11
            },
            silkscreen: {
                fillColor: '#778899',
                borderColor: '#8899aa',
                borderWidth: 0.22
            }
        }
    })

    assert.match(svg, /class="pcb-board"[^>]+fill="#112233"/)
    assert.match(svg, /class="pcb-pad"[^>]+fill="#334455"/)
    assert.match(svg, /class="pcb-pad"[^>]+stroke="#667788"/)
    assert.match(svg, /class="pcb-pad"[^>]+stroke-width="0\.33"/)
    assert.match(svg, /class="pcb-segment"[^>]+stroke="#445566"/)
    assert.match(svg, /class="pcb-zone"[^>]+fill="#556677"/)
    assert.match(svg, /class="pcb-label"[^>]+stroke="#8899aa"/)
})

test('KicadPcbSvgRenderer styles via and pad drill holes independently', () => {
    const svg = KicadPcbSvgRenderer.render(createBoard(), {
        side: 'front',
        layerStyles: {
            padDrills: {
                fillColor: '#111111',
                borderColor: '#222222',
                borderWidth: 0.12
            },
            viaDrills: {
                fillColor: '#333333',
                borderColor: '#444444',
                borderWidth: 0.24
            }
        }
    })

    assert.match(
        svg,
        /class="pcb-pad-drill"[^>]+fill="#111111"[^>]+stroke="#222222"[^>]+stroke-width="0\.12"/
    )
    assert.match(
        svg,
        /class="pcb-via-drill"[^>]+fill="#333333"[^>]+stroke="#444444"[^>]+stroke-width="0\.24"/
    )
})

test('KicadPcbSvgRenderer keeps manual defaults focused on assembly layers', () => {
    const svg = KicadPcbSvgRenderer.render(createBoard(), { side: 'front' })

    assert.match(svg, /class="pcb-pad"(?=[^>]+fill="#cfd1d4")/)
    assert.match(svg, /class="pcb-pad-drill"(?=[^>]+fill="#000000")/)
    assert.match(svg, /class="pcb-segment"(?=[^>]+display="none")/)
    assert.match(svg, /class="pcb-zone"(?=[^>]+display="none")/)
    assert.match(svg, /class="pcb-via"(?=[^>]+display="none")/)
    assert.match(svg, /class="pcb-via-drill"(?=[^>]+display="none")/)
})

test('KicadPcbSvgRenderer applies KiCad preview styling from layer metadata', () => {
    const svg = KicadPcbSvgRenderer.render(createBoard(), {
        side: 'front',
        renderPreset: 'kicad'
    })

    assert.match(svg, /class="pcb-svg pcb-svg--kicad-preview"/)
    assert.match(svg, /class="pcb-render-background"[^>]+fill="#061326"/)
    assert.match(svg, /class="pcb-board"[^>]+fill="#df8060"/)
    assert.match(
        svg,
        /class="pcb-segment"(?=[^>]+data-layer="F\.Cu")(?=[^>]+stroke="#fff0a2")/
    )
    assert.doesNotMatch(
        svg,
        /class="pcb-segment"(?=[^>]+data-layer="F\.Cu")(?=[^>]+display="none")/
    )
    assert.match(
        svg,
        /class="pcb-zone"(?=[^>]+data-layer="F\.Cu")(?=[^>]+fill="#df8060")/
    )
    assert.match(
        svg,
        /class="pcb-pad"(?=[^>]+data-pad-layers="F\.Cu F\.Mask F\.Paste")(?=[^>]+fill="#fff0a2")(?=[^>]+stroke="#d43b3c")/
    )
    assert.match(
        svg,
        /class="pcb-via"(?=[^>]+data-layer="F\.Cu")(?=[^>]+fill="#f2c843")(?=[^>]+stroke="#d43b3c")/
    )
    assert.match(svg, /class="pcb-via-drill"[^>]+fill="#061326"/)
    assert.match(svg, /class="pcb-label"[^>]+stroke="#f26b6b"/)
})

test('KicadPcbSvgRenderer decorates toolkit SVG output', () => {
    let receivedBoard = null
    let receivedOptions = null
    const renderer = new KicadPcbSvgRenderer({
        render(board, options) {
            receivedBoard = board
            receivedOptions = options
            return [
                '<svg class="pcb-svg" viewBox="0 0 20 10">',
                '<g class="pcb-scene">',
                '<circle class="pcb-pad" data-footprint-id="footprint:U1:0" cx="5" cy="5" r="0.5" fill="#cfd1d4" stroke="#50545f" stroke-width="0.16"/>',
                '</g>',
                '</svg>'
            ].join('')
        }
    })
    const svg = renderer.render(createBoard(), {
        side: 'front',
        highlightedFootprints: ['footprint:U1:0'],
        highlightColor: '#ff3b2b',
        badges: [{ id: 'badge-1', text: '1', x: 5, y: 5, side: 'front' }]
    })

    assert.equal(receivedBoard.title, 'App Board')
    assert.deepEqual(receivedOptions, { side: 'front' })
    assert.match(
        svg,
        /class="pcb-pad"(?=[^>]+data-highlight-state="selected")(?=[^>]+fill="#ff3b2b")/
    )
    assert.match(svg, /class="pcb-component-hit-area"/)
    assert.match(svg, /class="pcb-badge" data-badge-id="badge-1"/)
})

test('KicadPcbSvgRenderer highlights component-owned artwork', () => {
    const svg = KicadPcbSvgRenderer.render(createBoard(), {
        side: 'front',
        highlightedFootprints: ['footprint:U1:0'],
        hoveredFootprintId: 'footprint:R1:1',
        highlightColor: '#ff3b2b'
    })

    assert.match(
        svg,
        /class="pcb-pad[^"]*"(?=[^>]+data-footprint-id="footprint:U1:0")(?=[^>]+data-highlight-state="selected")(?=[^>]+fill="#ff3b2b")/
    )
    assert.match(
        svg,
        /class="pcb-pad[^"]*"(?=[^>]+data-footprint-id="footprint:R1:1")(?=[^>]+data-highlight-state="hover")(?=[^>]+fill="#e58e88")/
    )
    assert.match(
        svg,
        /class="pcb-component-hit-area"(?=[^>]+data-footprint-id="footprint:U1:0")/
    )
})

test('KicadPcbSvgRenderer renders app-owned badge overlays', () => {
    const svg = KicadPcbSvgRenderer.render(createBoard(), {
        side: 'front',
        highlightColor: '#ff3b2b',
        badgeStyle: {
            foregroundColor: '#112233',
            scale: 1.5,
            shadowColor: '#222222',
            shadowOpacity: 0.4
        },
        badges: [
            {
                id: 'badge-1',
                text: 'A1',
                x: 4,
                y: 5,
                rotation: 45,
                side: 'front'
            }
        ]
    })

    assert.match(svg, /id="pcb-badge-shadow"/)
    assert.match(
        svg,
        /class="pcb-badge"(?=[^>]+data-badge-id="badge-1")(?=[^>]+rotate\(45\))(?=[^>]+scale\(1.5\))/
    )
    assert.match(svg, /class="pcb-badge-fill"[^>]+fill="#ff3b2b"/)
    assert.match(svg, /class="pcb-badge-fill"[^>]+stroke="#112233"/)
    assert.match(
        svg,
        /class="pcb-badge-text"[^>]+fill="#112233"[^>]*>A1<\/text>/
    )
})

/**
 * Creates a compact normalized KiCad board model with app-owned render affordances.
 * @returns {object}
 */
function createBoard() {
    return {
        title: 'App Board',
        bounds: {
            minX: 0,
            minY: 0,
            maxX: 20,
            maxY: 10,
            width: 20,
            height: 10
        },
        outlines: [],
        drawings: [
            {
                type: 'segment',
                side: 'front',
                layer: 'F.Cu',
                start: { x: 1, y: 1 },
                end: { x: 2, y: 1 },
                strokeWidth: 0.2
            },
            {
                type: 'zone',
                side: 'front',
                layer: 'F.Cu',
                points: [
                    { x: 3, y: 3 },
                    { x: 4, y: 3 },
                    { x: 4, y: 4 }
                ]
            },
            {
                type: 'via',
                side: 'front',
                layer: 'F.Cu',
                x: 12,
                y: 5,
                size: 1,
                drill: 0.4
            },
            {
                type: 'line',
                side: 'front',
                layer: 'F.SilkS',
                material: 'silk',
                ownerId: 'footprint:U1:0',
                strokeWidth: 0.1,
                start: { x: 5, y: 5 },
                end: { x: 6, y: 5 }
            }
        ],
        pads: [
            {
                number: '1',
                footprintId: 'footprint:U1:0',
                type: 'thru_hole',
                shape: 'circle',
                x: 5,
                y: 5,
                width: 1,
                height: 1,
                rotation: 0,
                drill: 0.4,
                layers: ['F.Cu', 'F.Mask', 'F.Paste'],
                side: 'front'
            },
            {
                number: '2',
                footprintId: 'footprint:R1:1',
                type: 'smd',
                shape: 'rect',
                x: 8,
                y: 5,
                width: 1,
                height: 1,
                rotation: 0,
                drill: 0,
                layers: ['F.Cu', 'F.Mask', 'F.Paste'],
                side: 'front'
            }
        ],
        texts: [
            {
                value: 'U1',
                ownerId: 'footprint:U1:0',
                layer: 'F.SilkS',
                side: 'front',
                visible: true,
                x: 5,
                y: 8,
                rotation: 0,
                sizeX: 1,
                sizeY: 1,
                thickness: 0.12,
                hAlign: 'center',
                vAlign: 'center'
            }
        ],
        footprints: [
            {
                id: 'footprint:U1:0',
                reference: 'U1',
                bounds: { minX: 4, minY: 4, maxX: 6, maxY: 8 }
            },
            {
                id: 'footprint:R1:1',
                reference: 'R1',
                bounds: { minX: 7, minY: 4, maxX: 9, maxY: 6 }
            }
        ]
    }
}
