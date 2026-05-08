// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { AppView } from '../src/ui/AppView.mjs'

test('AppView opens the file chooser when the empty canvas is clicked', () => {
    globalThis.HTMLElement = FakeElement
    globalThis.HTMLInputElement = FakeElement
    const fileInput = new FakeElement()
    const canvas = new FakeElement()
    canvas.emptySvg = new FakeElement()
    const documentRef = new FakeDocument({
        '#fileInput': fileInput,
        '#pcbCanvas': canvas
    })
    const view = new AppView(documentRef)

    view.bindOpenFiles(() => {})
    canvas.dispatch('click', { target: canvas })

    assert.equal(fileInput.clickCount, 1)
})

test('AppView keeps loaded-board canvas clicks away from the file chooser', () => {
    globalThis.HTMLElement = FakeElement
    globalThis.HTMLInputElement = FakeElement
    const fileInput = new FakeElement()
    const canvas = new FakeElement()
    const documentRef = new FakeDocument({
        '#fileInput': fileInput,
        '#pcbCanvas': canvas
    })
    const view = new AppView(documentRef)

    view.bindOpenFiles(() => {})
    canvas.dispatch('click', { target: canvas })

    assert.equal(fileInput.clickCount, 0)
})

class FakeDocument {
    /** @type {Map<string, FakeElement>} */
    #nodes

    /**
     * @param {Record<string, FakeElement>} nodes
     */
    constructor(nodes) {
        this.#nodes = new Map(Object.entries(nodes))
    }

    /**
     * Returns a fake node for the selector.
     * @param {string} selector
     * @returns {FakeElement | null}
     */
    querySelector(selector) {
        return this.#nodes.get(selector) || null
    }

    /**
     * Returns fake nodes for collection queries.
     * @returns {FakeElement[]}
     */
    querySelectorAll() {
        return []
    }

    /**
     * Stores document-level event listeners.
     * @returns {void}
     */
    addEventListener() {}
}

class FakeElement {
    /** @type {FakeElement | null} */
    emptySvg = null

    /** @type {number} */
    clickCount = 0

    /** @type {Record<string, Function[]>} */
    listeners = {}

    /**
     * Registers an event listener.
     * @param {string} type
     * @param {Function} callback
     * @returns {void}
     */
    addEventListener(type, callback) {
        this.listeners[type] ||= []
        this.listeners[type].push(callback)
    }

    /**
     * Dispatches a stored event listener.
     * @param {string} type
     * @param {object} event
     * @returns {void}
     */
    dispatch(type, event) {
        for (const callback of this.listeners[type] || []) {
            callback(event)
        }
    }

    /**
     * Tracks file chooser open requests.
     * @returns {void}
     */
    click() {
        this.clickCount += 1
    }

    /**
     * Returns the empty SVG node when present.
     * @param {string} selector
     * @returns {FakeElement | null}
     */
    querySelector(selector) {
        if (selector === '.pcb-svg--empty') return this.emptySvg

        return null
    }
}
