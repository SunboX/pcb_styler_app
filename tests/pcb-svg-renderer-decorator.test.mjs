// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbSvgRendererDecorator } from '../src/ui/PcbSvgRendererDecorator.mjs'

test('PcbSvgRendererDecorator applies shared styles highlights and badges', () => {
    let receivedBoard = null
    let receivedOptions = null
    const decorator = new PcbSvgRendererDecorator({
        renderer: {
            render(board, options) {
                receivedBoard = board
                receivedOptions = options
                return [
                    '<svg class="pcb-svg" viewBox="0 0 20 10">',
                    '<circle class="pcb-pad" data-footprint-id="footprint:U1" cx="5" cy="5" r="1" fill="#cfd1d4" stroke="#50545f"/>',
                    '</svg>'
                ].join('')
            }
        },
        baseOptions(options) {
            return { side: options.side }
        },
        layerRules: [
            {
                classNames: ['pcb-pad'],
                styleKey: 'pads',
                fill: true,
                stroke: true
            }
        ],
        highlightableClasses: ['pcb-pad'],
        overlayRenderer() {
            return '<rect class="pcb-component-hit-area"/>'
        }
    })
    const board = { title: 'Decorated' }
    const svg = decorator.render(board, {
        side: 'back',
        layerStyles: {
            pads: { fillColor: '#334455', borderColor: '#667788' }
        },
        highlightedFootprints: ['footprint:U1'],
        highlightColor: '#ff3b2b',
        badges: [{ id: 'badge-1', text: 'A1', x: 2, y: 3, side: 'back' }]
    })

    assert.equal(receivedBoard, board)
    assert.deepEqual(receivedOptions, { side: 'back' })
    assert.match(
        svg,
        /class="pcb-pad"(?=[^>]*data-highlight-state="selected")(?=[^>]*fill="#ff3b2b")(?=[^>]*stroke="#ff3b2b")/
    )
    assert.match(svg, /class="pcb-component-hit-area"/)
    assert.match(svg, /class="pcb-badge" data-badge-id="badge-1"/)
})

test('PcbSvgRendererDecorator removes SVG attributes and style properties', () => {
    const tag =
        '<line class="pcb-segment" display="none" stroke="#000000" style="display: none; stroke: #000000" />'

    const withoutDisplay = PcbSvgRendererDecorator.removeStyleProperty(
        PcbSvgRendererDecorator.removeAttribute(tag, 'display'),
        'display'
    )
    const withoutStroke = PcbSvgRendererDecorator.removeStyleProperty(
        withoutDisplay,
        'stroke'
    )

    assert.doesNotMatch(withoutDisplay, /\sdisplay="/)
    assert.doesNotMatch(withoutDisplay, /display: none/)
    assert.match(withoutDisplay, /style="stroke: #000000"/)
    assert.doesNotMatch(withoutStroke, /\sstyle="/)
})
