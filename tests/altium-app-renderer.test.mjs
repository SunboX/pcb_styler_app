// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumPcbSvgRenderer } from '../src/ui/AltiumPcbSvgRenderer.mjs'

test('AltiumPcbSvgRenderer applies the shared render palette', () => {
    const renderer = new AltiumPcbSvgRenderer()
    const markup = renderer.render(createAltiumBoard(), {
        layerStyles: {
            board: { fillColor: '#112233' },
            edgeCuts: { borderColor: '#223344', borderWidth: 3 },
            pads: { fillColor: '#334455', borderColor: '#667788' },
            traces: { borderColor: '#445566', borderWidth: 5 },
            zones: { fillColor: '#556677', fillOpacity: 0.4 },
            drills: { fillColor: '#000000' }
        }
    })

    assert.match(markup, /^<div class="altium-output">/)
    assert.match(markup, /^<div class="altium-output"><svg\b/u)
    assert.doesNotMatch(markup, /class="svg-panel/u)
    assert.doesNotMatch(markup, /class="svg-panel__header/u)
    assert.doesNotMatch(markup, /class="pcb-legend/u)
    assert.doesNotMatch(markup, /Board stack/u)
    assert.match(markup, /class="board-outline"[^>]*fill="#112233"/u)
    assert.match(
        markup,
        /class="board-outline board-outline--stroke"[^>]*stroke="#223344"/u
    )
    assert.match(markup, /class="pcb-pad__ring"[^>]*fill="#334455"/u)
    assert.match(
        markup,
        /class="[^"]*pcb-track[^"]*"(?=[^>]*stroke="#445566")/u
    )
    assert.match(markup, /class="[^"]*pcb-fill[^"]*"(?=[^>]*fill="#556677")/u)
    assert.match(markup, /class="pcb-pad__hole"[^>]*fill="#000000"/u)
})

test('AltiumPcbSvgRenderer emits browser-authoritative paint styles', () => {
    const renderer = new AltiumPcbSvgRenderer()
    const markup = renderer.render(createAltiumBoard(), {
        layerStyles: {
            board: { fillColor: '#112233' },
            pads: { fillColor: '#334455', borderColor: '#667788' }
        },
        highlightedFootprints: ['altium:U1'],
        highlightColor: '#ff3300'
    })

    assert.match(
        markup,
        /class="board-outline"(?=[^>]*fill="#112233")(?=[^>]*style="[^"]*fill: #112233)/u
    )
    assert.match(
        markup,
        /class="pcb-pad__ring"(?=[^>]*fill="#334455")(?=[^>]*style="[^"]*fill: #334455)(?=[^>]*stroke: #667788)/u
    )
    assert.match(
        markup,
        /class="pcb-component__body"(?=[^>]*data-footprint-id="altium:U1")(?=[^>]*fill="#ff3300")(?=[^>]*style="[^"]*fill: #ff3300)(?=[^>]*stroke: #ff3300)/u
    )
})

test('AltiumPcbSvgRenderer applies shared component highlights', () => {
    const renderer = new AltiumPcbSvgRenderer()
    const markup = renderer.render(createAltiumBoard(), {
        highlightedFootprints: ['altium:U1'],
        hoveredFootprintId: 'altium:R1',
        highlightColor: '#ff3300'
    })

    assert.match(
        markup,
        /class="pcb-component-hit-area"[^>]*data-footprint-id="altium:U1"/u
    )
    assert.match(
        markup,
        /class="pcb-component-hit-area"[^>]*data-footprint-id="altium:R1"/u
    )
    assert.match(
        markup,
        /class="pcb-component__body"(?=[^>]*data-footprint-id="altium:U1")(?=[^>]*data-highlight-state="selected")(?=[^>]*fill="#ff3300")(?=[^>]*stroke="#ff3300")/u
    )
    assert.match(
        markup,
        /class="pcb-component__body"(?=[^>]*data-footprint-id="altium:R1")(?=[^>]*data-highlight-state="hover")(?=[^>]*fill="#e58a75")(?=[^>]*stroke="#e58a75")/u
    )
    assert.doesNotMatch(markup, /pcb-component-highlight/u)
    assert.doesNotMatch(markup, /pcb-component-highlights/u)
})

test('AltiumPcbSvgRenderer highlights component pad rings in place', () => {
    const renderer = new AltiumPcbSvgRenderer()
    const markup = renderer.render(createAltiumBoardWithLocalPad(), {
        highlightedFootprints: ['altium:U1'],
        highlightColor: '#ff3300'
    })

    assert.match(
        markup,
        /class="pcb-pad__ring"(?=[^>]*data-footprint-id="altium:U1")(?=[^>]*data-highlight-state="selected")(?=[^>]*fill="#ff3300")(?=[^>]*stroke="#ff3300")/u
    )
    assert.doesNotMatch(markup, /pcb-component-highlight/u)
})

test('AltiumPcbSvgRenderer renders authored board text without synthetic placement labels', () => {
    const renderer = new AltiumPcbSvgRenderer()
    const board = createAltiumBoard()
    board.pcb.primitiveLayers = [{ layerId: 33, name: 'Top Overlay' }]
    board.pcb.texts = [
        {
            text: 'BOARD-ID',
            x: 260,
            y: 210,
            height: 32,
            rotation: 0,
            layerId: 33
        },
        {
            text: 'U1',
            x: 300,
            y: 350,
            height: 20,
            rotation: 0,
            layerId: 33,
            visible: false
        }
    ]

    const markup = renderer.render(board)

    assert.match(markup, /class="pcb-text[^"]*"[^>]*>BOARD-ID<\/text>/u)
    assert.doesNotMatch(markup, />U1<\/text>/u)
    assert.doesNotMatch(markup, />R1<\/text>/u)
})

test('AltiumPcbSvgRenderer sizes QFN hit areas from owned pad bounds', () => {
    const renderer = new AltiumPcbSvgRenderer()
    const markup = renderer.render(createWideQfnAltiumBoard(), {
        highlightedFootprints: ['altium:U2'],
        highlightColor: '#ff3300'
    })
    const hitArea = markup.match(
        /<rect class="pcb-component-hit-area"[^>]*data-footprint-id="altium:U2"[^>]*>/u
    )?.[0]

    assert.ok(hitArea)
    const x = readNumberAttribute(hitArea, 'x')
    const y = readNumberAttribute(hitArea, 'y')
    const width = readNumberAttribute(hitArea, 'width')
    const height = readNumberAttribute(hitArea, 'height')

    assert.ok(width > 180)
    assert.ok(height > 180)
    assert.ok(x <= 905)
    assert.ok(y <= 885)
    assert.ok(x + width >= 1095)
    assert.ok(y + height >= 1148)
})

test('AltiumPcbSvgRenderer does not highlight nearby non-owned QFN footprint tracks', () => {
    const renderer = new AltiumPcbSvgRenderer()
    const markup = renderer.render(createWideQfnWithNeighborTrackBoard(), {
        highlightedFootprints: ['altium:U2'],
        highlightColor: '#ff3300'
    })

    assert.match(
        markup,
        /class="pcb-footprint-track" x1="1090" y1="900" x2="1120" y2="900"[^>]*data-footprint-id="altium:U2"[^>]*data-highlight-state="selected"/u
    )
    assert.doesNotMatch(
        markup,
        /class="pcb-footprint-track" x1="895" y1="1250" x2="935" y2="1250"[^>]*data-footprint-id="altium:U2"/u
    )
})

test('AltiumPcbSvgRenderer keeps QFN edge pads with the QFN near small neighbors', () => {
    const renderer = new AltiumPcbSvgRenderer()
    const markup = renderer.render(createWideQfnWithNeighborPadBoard(), {
        highlightedFootprints: ['altium:U2'],
        highlightColor: '#ff3300'
    })

    assert.match(
        markup,
        /transform="translate\(1000 725\) rotate\(180\)">\s*<rect class="pcb-pad__ring"[^>]*data-footprint-id="altium:U2"[^>]*data-highlight-state="selected"/u
    )
    assert.match(
        markup,
        /class="pcb-footprint-track" x1="970" y1="720" x2="1010" y2="720"[^>]*data-footprint-id="altium:U2"[^>]*data-highlight-state="selected"/u
    )
})

test('AltiumPcbSvgRenderer keeps sparse through-hole connector pads with the connector', () => {
    const renderer = new AltiumPcbSvgRenderer()
    const markup = renderer.render(createSparseConnectorAltiumBoard(), {
        highlightedFootprints: ['altium:J1'],
        highlightColor: '#ff3300'
    })

    assert.match(
        markup,
        /transform="translate\(900 410\) rotate\(90\)">\s*<rect class="pcb-pad__ring"[^>]*data-footprint-id="altium:J1"[^>]*data-highlight-state="selected"/u
    )
    assert.match(
        markup,
        /transform="translate\(1100 410\) rotate\(90\)">\s*<rect class="pcb-pad__ring"[^>]*data-footprint-id="altium:J1"[^>]*data-highlight-state="selected"/u
    )
    assert.match(
        markup,
        /transform="translate\(946 1465\) rotate\(0\)">\s*<circle class="pcb-pad__ring"[^>]*data-footprint-id="altium:J1"[^>]*data-highlight-state="selected"/u
    )
    assert.match(
        markup,
        /class="pcb-footprint-track" x1="850" y1="410" x2="1150" y2="410"[^>]*data-footprint-id="altium:J1"[^>]*data-highlight-state="selected"/u
    )
    assert.match(
        markup,
        /class="pcb-footprint-track" x1="900" y1="520" x2="900" y2="1440"[^>]*data-footprint-id="altium:J1"[^>]*data-highlight-state="selected"/u
    )
    assert.doesNotMatch(
        markup,
        /transform="translate\(1560 1020\) rotate\(0\)">\s*<circle class="pcb-pad__ring"[^>]*data-footprint-id="altium:J1"/u
    )
})

test('AltiumPcbSvgRenderer prefers native component indexes over geometry owners', () => {
    const renderer = new AltiumPcbSvgRenderer()
    const markup = renderer.render(createComponentIndexedAltiumBoard(), {
        highlightedFootprints: ['altium:J1'],
        highlightColor: '#ff3300'
    })

    assert.match(
        markup,
        /class="pcb-footprint-track" x1="880" y1="900" x2="920" y2="900"[^>]*data-footprint-id="altium:J1"[^>]*data-highlight-state="selected"/u
    )
})

test('AltiumPcbSvgRenderer keeps explicit unlinked primitives unowned', () => {
    const renderer = new AltiumPcbSvgRenderer()
    const markup = renderer.render(createExplicitUnlinkedAltiumBoard(), {
        highlightedFootprints: ['altium:U1'],
        highlightColor: '#ff3300'
    })

    assert.match(
        markup,
        /transform="translate\(130 130\) rotate\(0\)">\s*<rect class="pcb-pad__ring"[^>]*data-footprint-id="altium:U1"[^>]*data-highlight-state="selected"/u
    )
    assert.doesNotMatch(
        markup,
        /transform="translate\(100 100\) rotate\(0\)">\s*<circle class="pcb-pad__ring"[^>]*data-footprint-id="altium:U1"/u
    )
    assert.doesNotMatch(
        markup,
        /class="pcb-footprint-track" x1="80" y1="90" x2="160" y2="90"[^>]*data-footprint-id="altium:U1"/u
    )
})

test('AltiumPcbSvgRenderer follows connector rotation for sparse pad ownership', () => {
    const renderer = new AltiumPcbSvgRenderer()
    const markup = renderer.render(createRotatedSparseConnectorAltiumBoard(), {
        highlightedFootprints: ['altium:J1'],
        highlightColor: '#ff3300'
    })

    assert.match(
        markup,
        /transform="translate\(410 1100\) rotate\(0\)">\s*<rect class="pcb-pad__ring"[^>]*data-footprint-id="altium:J1"[^>]*data-highlight-state="selected"/u
    )
})

test('AltiumPcbSvgRenderer switches visible side like KiCad', () => {
    const renderer = new AltiumPcbSvgRenderer()
    const front = renderer.render(createTwoSidedAltiumBoard(), {
        side: 'front'
    })
    const back = renderer.render(createTwoSidedAltiumBoard(), {
        side: 'back'
    })

    assert.match(front, /data-footprint-id="altium:U1"/u)
    assert.doesNotMatch(front, /data-footprint-id="altium:U2"/u)
    assert.match(back, /data-footprint-id="altium:U2"/u)
    assert.doesNotMatch(back, /data-footprint-id="altium:U1"/u)
    assert.doesNotMatch(front, /pcb-scene--back/u)
    assert.match(
        back,
        /<g class="pcb-scene pcb-scene--back" transform="translate\(1000 0\) scale\(-1 1\)">/u
    )
    assert.match(
        front,
        /class="pcb-track pcb-track--surface" x1="100" y1="300" x2="220" y2="300"/u
    )
    assert.match(
        back,
        /class="pcb-track pcb-track--surface" x1="780" y1="300" x2="900" y2="300"/u
    )
    assert.match(
        front,
        /class="pcb-footprint-track" x1="110" y1="140" x2="150" y2="140"/u
    )
    assert.match(
        back,
        /class="pcb-footprint-track" x1="850" y1="460" x2="890" y2="460"/u
    )
    assert.match(front, /transform="translate\(120 360\) rotate\(0\)"/u)
    assert.doesNotMatch(front, /transform="translate\(880 360\) rotate\(0\)"/u)
    assert.match(front, /transform="translate\(500 360\) rotate\(0\)"/u)
    assert.match(back, /transform="translate\(880 360\) rotate\(0\)"/u)
    assert.doesNotMatch(back, /transform="translate\(120 360\) rotate\(0\)"/u)
    assert.match(back, /transform="translate\(500 360\) rotate\(0\)"/u)
    assert.match(front, /class="pcb-via__pad" cx="180" cy="500"/u)
    assert.doesNotMatch(front, /class="pcb-via__pad" cx="820" cy="500"/u)
    assert.doesNotMatch(front, /class="pcb-via__pad" cx="500" cy="500"/u)
    assert.match(back, /class="pcb-via__pad" cx="820" cy="500"/u)
    assert.doesNotMatch(back, /class="pcb-via__pad" cx="180" cy="500"/u)
    assert.doesNotMatch(back, /class="pcb-via__pad" cx="500" cy="500"/u)
})

test('AltiumPcbSvgRenderer applies shared badge rendering', () => {
    const renderer = new AltiumPcbSvgRenderer()
    const markup = renderer.render(createAltiumBoard(), {
        badges: [
            {
                id: 'badge-1',
                text: 'T1',
                x: 250,
                y: 180,
                rotation: 90,
                side: 'front'
            }
        ],
        badgeStyle: {
            foregroundColor: '#ffffff',
            scale: 1.4,
            shadowOpacity: 0.25
        },
        highlightColor: '#33aa99',
        side: 'front'
    })

    assert.match(markup, /class="pcb-badge" data-badge-id="badge-1"/u)
    assert.match(markup, /class="pcb-badge-fill"[^>]*fill="#33aa99"/u)
    assert.match(
        markup,
        /transform="translate\(250 180\) rotate\(90\) scale\(55\.1181\)"/u
    )
})

test('AltiumPcbSvgRenderer keeps badge overlays in the front scene', () => {
    const renderer = new AltiumPcbSvgRenderer()
    const markup = renderer.render(createAltiumBoard(), {
        badges: [
            {
                id: 'badge-1',
                text: '1',
                x: 500,
                y: 300,
                side: 'front'
            }
        ],
        side: 'front'
    })

    assert.match(
        markup,
        /<g class="pcb-scene">[\s\S]*class="pcb-badge" data-badge-id="badge-1"[^>]*transform="translate\(500 300\) scale\(39\.3701\)"/u
    )
})

/**
 * Creates a small normalized Altium PCB model with board and component artwork.
 * @returns {object}
 */
function createAltiumBoard() {
    return {
        kind: 'pcb',
        fileType: 'PcbDoc',
        fileName: 'amplifier.PcbDoc',
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
                    rotation: 0,
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
            vias: [
                {
                    x: 430,
                    y: 250,
                    diameter: 70,
                    holeDiameter: 28
                }
            ],
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
            components: [
                {
                    designator: 'U1',
                    x: 300,
                    y: 350,
                    rotation: 0,
                    layer: 'Top',
                    pattern: 'QFN'
                },
                {
                    designator: 'R1',
                    x: 700,
                    y: 350,
                    rotation: 0,
                    layer: 'Top',
                    pattern: '0603'
                }
            ]
        }
    }
}

/**
 * Creates an Altium PCB model where recovered pad detail suppresses the
 * synthetic component body, matching common parsed boards.
 * @returns {object}
 */
function createAltiumBoardWithLocalPad() {
    const board = createAltiumBoard()
    board.pcb.components = [
        {
            designator: 'U1',
            x: 300,
            y: 350,
            rotation: 0,
            layer: 'Top',
            pattern: 'QFN'
        }
    ]
    board.pcb.pads = [
        {
            name: '1',
            x: 300,
            y: 350,
            sizeTopX: 90,
            sizeTopY: 55,
            holeDiameter: 0,
            shapeTop: 1,
            rotation: 0
        }
    ]
    return board
}

/**
 * Creates a board with a large QFN component whose component origin is offset
 * from the recovered pad cloud.
 * @returns {object}
 */
function createWideQfnAltiumBoard() {
    const board = createAltiumBoard()
    board.pcb.components = [
        {
            designator: 'U2',
            x: 940,
            y: 1060,
            rotation: 0,
            layer: 'Top',
            pattern: 'QFN56'
        },
        {
            designator: 'C1',
            x: 1320,
            y: 1060,
            rotation: 0,
            layer: 'Top',
            pattern: '0402'
        }
    ]
    board.pcb.pads = [
        { x: 970, y: 1000, sizeTopX: 40, sizeTopY: 20, shapeTop: 2 },
        { x: 1030, y: 1000, sizeTopX: 40, sizeTopY: 20, shapeTop: 2 },
        { x: 1080, y: 920, sizeTopX: 30, sizeTopY: 70, shapeTop: 2 },
        { x: 1080, y: 1080, sizeTopX: 30, sizeTopY: 70, shapeTop: 2 },
        { x: 920, y: 1080, sizeTopX: 30, sizeTopY: 70, shapeTop: 2 },
        { x: 1000, y: 1100, sizeTopX: 96, sizeTopY: 96, shapeTop: 1 },
        { x: 1320, y: 1060, sizeTopX: 52, sizeTopY: 28, shapeTop: 2 }
    ]
    return board
}

/**
 * Creates a wide QFN next to another footprint whose documentation stroke
 * falls inside the broad QFN package profile but outside the actual QFN pads.
 * @returns {object}
 */
function createWideQfnWithNeighborTrackBoard() {
    const board = createWideQfnAltiumBoard()
    board.pcb.primitiveLayers = [{ layerId: 33, name: 'Top Overlay' }]
    board.pcb.tracks = [
        {
            x1: 1090,
            y1: 900,
            x2: 1120,
            y2: 900,
            width: 8,
            layerId: 33,
            layerCode: 33
        },
        {
            x1: 895,
            y1: 1250,
            x2: 935,
            y2: 1250,
            width: 8,
            layerId: 33,
            layerCode: 33
        }
    ]
    return board
}

/**
 * Creates a QFN edge pad that lies close to a small neighbor origin, matching
 * dense real boards where nearby 0402s can otherwise steal IC pads.
 * @returns {object}
 */
function createWideQfnWithNeighborPadBoard() {
    const board = createAltiumBoard()
    board.pcb.components = [
        {
            designator: 'U2',
            x: 1000,
            y: 1000,
            rotation: 0,
            layer: 'Top',
            pattern: 'QFN56'
        },
        {
            designator: 'R1',
            x: 1000,
            y: 690,
            rotation: 0,
            layer: 'Top',
            pattern: '0402'
        }
    ]
    board.pcb.primitiveLayers = [{ layerId: 33, name: 'Top Overlay' }]
    board.pcb.pads = [
        {
            x: 1000,
            y: 725,
            sizeTopX: 8,
            sizeTopY: 34,
            shapeTop: 1,
            rotation: 180
        },
        {
            x: 980,
            y: 690,
            sizeTopX: 28,
            sizeTopY: 52,
            shapeTop: 2,
            rotation: 90
        },
        {
            x: 1020,
            y: 690,
            sizeTopX: 28,
            sizeTopY: 52,
            shapeTop: 2,
            rotation: 90
        }
    ]
    board.pcb.tracks = [
        {
            x1: 970,
            y1: 720,
            x2: 1010,
            y2: 720,
            width: 8,
            layerId: 33,
            layerCode: 33
        }
    ]
    return board
}

/**
 * Creates a sparse through-hole connector whose holes span well beyond the
 * design origin and sit near dense surface-mount neighbors.
 * @returns {object}
 */
function createSparseConnectorAltiumBoard() {
    const board = createAltiumBoard()
    board.pcb.primitiveLayers = [{ layerId: 33, name: 'Top Overlay' }]
    board.pcb.components = [
        {
            designator: 'J1',
            x: 1000,
            y: 1000,
            rotation: 180,
            layer: 'Top',
            pattern: 'CON/GENERIC-AUDIO-JACK',
            source: 'CON/JACK/GENERIC'
        },
        {
            designator: 'J2',
            x: 1517,
            y: 662,
            rotation: 90,
            layer: 'Top',
            pattern: 'GENERIC-COMPACT-PH-CONNECTOR',
            source: 'CON/PH1.25/GENERIC-05Z'
        },
        {
            designator: 'U1',
            x: 1100,
            y: 410,
            rotation: 0,
            layer: 'Top',
            pattern: 'QFN16'
        },
        {
            designator: 'R1',
            x: 1560,
            y: 1020,
            rotation: 0,
            layer: 'Top',
            pattern: '0805'
        },
        {
            designator: 'R2',
            x: 880,
            y: 925,
            rotation: 0,
            layer: 'Top',
            pattern: '0805'
        }
    ]
    board.pcb.pads = [
        {
            name: 'T',
            x: 1000,
            y: 1000,
            sizeTopX: 126,
            sizeTopY: 67,
            holeDiameter: 39,
            holeShape: 2,
            shapeTop: 1,
            rotation: 90
        },
        {
            name: 'R',
            x: 900,
            y: 410,
            sizeTopX: 126,
            sizeTopY: 67,
            holeDiameter: 39,
            holeShape: 2,
            shapeTop: 1,
            rotation: 90
        },
        {
            name: 'L',
            x: 1100,
            y: 410,
            sizeTopX: 126,
            sizeTopY: 67,
            holeDiameter: 39,
            holeShape: 2,
            shapeTop: 1,
            rotation: 90
        },
        {
            name: 'M1',
            x: 946,
            y: 1465,
            sizeTopX: 0,
            sizeTopY: 0,
            holeDiameter: 28,
            shapeTop: 1,
            rotation: 0
        },
        {
            name: 'M2',
            x: 1056,
            y: 1465,
            sizeTopX: 0,
            sizeTopY: 0,
            holeDiameter: 28,
            shapeTop: 1,
            rotation: 0
        },
        {
            name: 'huge',
            x: 1560,
            y: 1020,
            sizeTopX: 244,
            sizeTopY: 244,
            holeDiameter: 138,
            shapeTop: 1,
            rotation: 0
        },
        {
            name: 'n1',
            x: 1100,
            y: 410,
            sizeTopX: 52,
            sizeTopY: 28,
            holeDiameter: 0,
            shapeTop: 2,
            rotation: 0
        },
        {
            name: 'n2',
            x: 880,
            y: 925,
            sizeTopX: 52,
            sizeTopY: 28,
            holeDiameter: 0,
            shapeTop: 2,
            rotation: 0
        }
    ]
    board.pcb.tracks = [
        {
            x1: 900,
            y1: 520,
            x2: 900,
            y2: 1440,
            width: 8,
            layerId: 33,
            layerCode: 33
        },
        {
            x1: 850,
            y1: 410,
            x2: 1150,
            y2: 410,
            width: 8,
            layerId: 33,
            layerCode: 33
        },
        {
            x1: 950,
            y1: 1440,
            x2: 1050,
            y2: 1440,
            width: 8,
            layerId: 33,
            layerCode: 33
        }
    ]
    return board
}

/**
 * Creates a board where native parser ownership disagrees with nearest
 * geometry, matching dense Altium footprints with remote child primitives.
 * @returns {object}
 */
function createComponentIndexedAltiumBoard() {
    const board = createAltiumBoard()
    board.pcb.primitiveLayers = [{ layerId: 33, name: 'Top Overlay' }]
    board.pcb.components = [
        {
            componentIndex: 4,
            designator: 'J1',
            x: 200,
            y: 200,
            rotation: 0,
            layer: 'Top',
            pattern: 'CON/REMOTE-PRIMITIVE'
        },
        {
            componentIndex: 9,
            designator: 'R1',
            x: 900,
            y: 900,
            rotation: 0,
            layer: 'Top',
            pattern: '0805'
        }
    ]
    board.pcb.pads = []
    board.pcb.tracks = [
        {
            componentIndex: 4,
            x1: 880,
            y1: 900,
            x2: 920,
            y2: 900,
            width: 8,
            layerId: 33,
            layerCode: 33
        }
    ]
    return board
}

/**
 * Creates a board with native unlinked primitives close to a component.
 * @returns {object}
 */
function createExplicitUnlinkedAltiumBoard() {
    const board = createAltiumBoard()
    board.pcb.primitiveLayers = [{ layerId: 33, name: 'Top Overlay' }]
    board.pcb.components = [
        {
            componentIndex: 0,
            designator: 'U1',
            x: 120,
            y: 120,
            rotation: 0,
            layer: 'Top',
            pattern: 'QFN16'
        }
    ]
    board.pcb.pads = [
        {
            componentIndex: null,
            x: 100,
            y: 100,
            sizeTopX: 120,
            sizeTopY: 120,
            holeDiameter: 60,
            shapeTop: 1,
            rotation: 0
        },
        {
            componentIndex: 0,
            x: 130,
            y: 130,
            sizeTopX: 24,
            sizeTopY: 24,
            holeDiameter: 0,
            shapeTop: 2,
            rotation: 0
        }
    ]
    board.pcb.tracks = [
        {
            componentIndex: null,
            x1: 80,
            y1: 90,
            x2: 160,
            y2: 90,
            width: 8,
            layerId: 33,
            layerCode: 33
        }
    ]
    return board
}

/**
 * Creates a sparse connector rotated onto the horizontal axis.
 * @returns {object}
 */
function createRotatedSparseConnectorAltiumBoard() {
    const board = createSparseConnectorAltiumBoard()
    board.pcb.components[0] = {
        ...board.pcb.components[0],
        rotation: 90
    }
    board.pcb.components[1] = {
        ...board.pcb.components[1],
        x: 626,
        y: 1517,
        rotation: 0
    }
    board.pcb.components[2] = {
        ...board.pcb.components[2],
        x: 410,
        y: 1100
    }
    board.pcb.pads[1] = {
        ...board.pcb.pads[1],
        x: 410,
        y: 900,
        rotation: 0
    }
    board.pcb.pads[2] = {
        ...board.pcb.pads[2],
        x: 410,
        y: 1100,
        rotation: 0
    }
    board.pcb.pads[6] = {
        ...board.pcb.pads[6],
        x: 410,
        y: 1100
    }
    return board
}

/**
 * Creates a compact two-sided Altium board for render side switching.
 * @returns {object}
 */
function createTwoSidedAltiumBoard() {
    const board = createAltiumBoard()
    board.pcb.components = [
        {
            designator: 'U1',
            x: 180,
            y: 180,
            rotation: 0,
            layer: 'Top',
            pattern: '0603'
        },
        {
            designator: 'U2',
            x: 820,
            y: 420,
            rotation: 180,
            layer: 'Bottom',
            pattern: '0603'
        }
    ]
    board.pcb.primitiveLayers = [
        { layerId: 33, name: 'Top Overlay' },
        { layerId: 34, name: 'Bottom Overlay' }
    ]
    board.pcb.tracks = [
        {
            x1: 100,
            y1: 300,
            x2: 220,
            y2: 300,
            width: 12,
            layerId: 1,
            layerCode: 1
        },
        {
            x1: 780,
            y1: 300,
            x2: 900,
            y2: 300,
            width: 12,
            layerId: 32,
            layerCode: 32
        },
        {
            x1: 110,
            y1: 140,
            x2: 150,
            y2: 140,
            width: 6,
            layerId: 33,
            layerCode: 33
        },
        {
            x1: 850,
            y1: 460,
            x2: 890,
            y2: 460,
            width: 6,
            layerId: 34,
            layerCode: 34
        }
    ]
    board.pcb.pads = [
        {
            x: 120,
            y: 360,
            sizeTopX: 24,
            sizeTopY: 24,
            holeDiameter: 0,
            shapeTop: 2,
            rotation: 0,
            layerId: 1,
            layerCode: 1
        },
        {
            x: 880,
            y: 360,
            sizeBottomX: 24,
            sizeBottomY: 24,
            holeDiameter: 0,
            shapeBottom: 2,
            rotation: 0,
            layerId: 32,
            layerCode: 32
        },
        {
            x: 500,
            y: 360,
            sizeTopX: 32,
            sizeTopY: 32,
            sizeBottomX: 32,
            sizeBottomY: 32,
            holeDiameter: 12,
            shapeTop: 1,
            shapeBottom: 1,
            rotation: 0,
            layerId: 74,
            layerCode: 74
        }
    ]
    board.pcb.vias = [
        {
            x: 430,
            y: 250,
            diameter: 70,
            holeDiameter: 28,
            layerStartId: 1,
            layerEndId: 32
        },
        {
            x: 180,
            y: 500,
            diameter: 28,
            holeDiameter: 10,
            layerStartId: 1,
            layerEndId: 8
        },
        {
            x: 820,
            y: 500,
            diameter: 28,
            holeDiameter: 10,
            layerStartId: 12,
            layerEndId: 32
        },
        {
            x: 500,
            y: 500,
            diameter: 28,
            holeDiameter: 10,
            layerStartId: 4,
            layerEndId: 12
        }
    ]
    return board
}

/**
 * Reads a numeric SVG attribute from one tag.
 * @param {string} tag
 * @param {string} name
 * @returns {number}
 */
function readNumberAttribute(tag, name) {
    const value = tag.match(new RegExp(`\\s${name}="([^"]*)"`, 'u'))?.[1]
    return Number(value)
}
