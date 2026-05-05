// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { RenderPalette } from '@sunbox/kicad-toolkit'
import { AppState } from '../src/core/AppState.mjs'

/**
 * Verifies default state values are applied.
 */
test('AppState initializes with defaults', () => {
    const state = new AppState()
    const snapshot = state.getSnapshot()

    assert.equal(snapshot.board, null)
    assert.equal(snapshot.sourceFileName, '')
    assert.equal(snapshot.boardSource, '')
    assert.equal(snapshot.side, 'front')
    assert.equal(snapshot.status, 'Ready.')
    assert.deepEqual(snapshot.layerStyles, RenderPalette.defaultStyles())
    assert.deepEqual(snapshot.badges, [])
    assert.deepEqual(snapshot.badgeStyle, {
        foregroundColor: '#000000',
        scale: 1,
        shadowColor: '#000000',
        shadowOpacity: 0,
        shadowBlur: 0.8,
        shadowOffsetX: 0.6,
        shadowOffsetY: 0.6
    })
})

/**
 * Verifies patch operations update supported fields.
 */
test('AppState.patch updates multiple fields', () => {
    const state = new AppState({ side: 'front', status: 'Ready.' })
    const snapshot = state.patch({ side: 'back', status: 'Loaded board.' })

    assert.equal(snapshot.side, 'back')
    assert.equal(snapshot.status, 'Loaded board.')
})

/**
 * Verifies subscribers are notified on updates.
 */
test('AppState.subscribe receives updates', () => {
    const state = new AppState({ status: 'Ready.' })
    const received = []

    const unsubscribe = state.subscribe((snapshot) => {
        received.push(snapshot.status)
    })

    state.setValue('status', 'Loading.')
    state.setValue('status', 'Loaded.')
    unsubscribe()
    state.setValue('status', 'Ignored.')

    assert.deepEqual(received, ['Ready.', 'Loading.', 'Loaded.'])
})

/**
 * Verifies render layer styles are normalized and merged with defaults.
 */
test('AppState stores normalized render layer styles', () => {
    const state = new AppState({
        layerStyles: {
            board: {
                fillColor: '#abc',
                fillOpacity: '0.45'
            },
            pads: { visible: false, borderWidth: '0.33' }
        }
    })
    const snapshot = state.patch({
        layerStyles: {
            silkscreen: { borderColor: '#FEDCBA' },
            zones: { fillColor: 'invalid', borderWidth: '' }
        }
    })

    assert.equal(snapshot.layerStyles.board.fillColor, '#aabbcc')
    assert.equal(snapshot.layerStyles.board.fillOpacity, 0.45)
    assert.equal(snapshot.layerStyles.pads.visible, false)
    assert.equal(snapshot.layerStyles.pads.borderWidth, 0.33)
    assert.equal(snapshot.layerStyles.silkscreen.borderColor, '#fedcba')
    assert.equal(snapshot.layerStyles.zones.fillColor, '#3c3f46')
    assert.equal(snapshot.layerStyles.zones.borderWidth, null)
})

/**
 * Verifies component highlight state is normalized.
 */
test('AppState stores component highlight state', () => {
    const state = new AppState({
        highlightedFootprints: ['footprint:U1:0', '', 42],
        hoveredFootprintId: 99,
        highlightColor: '#ABCDEF'
    })
    const snapshot = state.patch({
        highlightedFootprints: ['footprint:R1:1'],
        hoveredFootprintId: 'footprint:R1:1',
        highlightColor: '#123456'
    })

    assert.deepEqual(snapshot.highlightedFootprints, ['footprint:R1:1'])
    assert.equal(snapshot.hoveredFootprintId, 'footprint:R1:1')
    assert.equal(snapshot.highlightColor, '#123456')
})

/**
 * Verifies badge annotations are normalized.
 */
test('AppState stores editable badge annotations', () => {
    const state = new AppState({
        badges: [
            {
                id: ' badge-1 ',
                text: ' 1 ',
                x: '10.5',
                y: '20.25',
                rotation: '45',
                side: 'back'
            },
            { id: '', text: 'ignored', x: 1, y: 1, side: 'front' },
            { id: 'badge-2', text: '', x: Number.NaN, y: 2, side: 'front' }
        ]
    })
    const snapshot = state.patch({
        badges: [
            {
                id: 'badge-3',
                text: 'A',
                x: 4,
                y: 5,
                rotation: '370',
                side: 'front'
            }
        ]
    })

    assert.deepEqual(snapshot.badges, [
        {
            id: 'badge-3',
            text: 'A',
            x: 4,
            y: 5,
            rotation: 10,
            side: 'front'
        }
    ])
})

/**
 * Verifies badge styling values are normalized.
 */
test('AppState stores normalized badge style', () => {
    const state = new AppState({
        badgeStyle: {
            foregroundColor: '#ABCDEF',
            scale: '1.5',
            shadowColor: '#123456',
            shadowOpacity: '0.4',
            shadowBlur: '1.2',
            shadowOffsetX: '0.3',
            shadowOffsetY: '-0.4'
        }
    })
    let snapshot = state.getSnapshot()

    assert.deepEqual(snapshot.badgeStyle, {
        foregroundColor: '#abcdef',
        scale: 1.5,
        shadowColor: '#123456',
        shadowOpacity: 0.4,
        shadowBlur: 1.2,
        shadowOffsetX: 0.3,
        shadowOffsetY: -0.4
    })

    snapshot = state.patch({
        badgeStyle: {
            foregroundColor: '#FEDCBA',
            scale: 9,
            shadowOpacity: -2,
            shadowBlur: -1,
            shadowOffsetX: 99,
            shadowOffsetY: -99
        }
    })

    assert.deepEqual(snapshot.badgeStyle, {
        foregroundColor: '#fedcba',
        scale: 2,
        shadowColor: '#123456',
        shadowOpacity: 0,
        shadowBlur: 0,
        shadowOffsetX: 5,
        shadowOffsetY: -5
    })
})
