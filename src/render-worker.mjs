// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: AGPL-3.0-or-later

import { BoardSvgRenderer } from './ui/BoardSvgRenderer.mjs'

const renderer = new BoardSvgRenderer()

self.addEventListener('message', (event) => {
    handleRenderRequest(event.data)
})

/**
 * Renders one PCB SVG worker request.
 * @param {{ id?: number, board?: object | null, options?: object }} message
 * @returns {void}
 */
function handleRenderRequest(message) {
    const id = Number(message?.id)
    try {
        self.postMessage({
            id,
            svg: renderer.render(message?.board || null, message?.options || {})
        })
    } catch (error) {
        self.postMessage({
            id,
            error: error instanceof Error ? error.message : 'PCB render failed.'
        })
    }
}
