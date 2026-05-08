// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: AGPL-3.0-or-later

import { AltiumPcbSvgRenderer } from './AltiumPcbSvgRenderer.mjs'
import { KicadPcbSvgRenderer } from './KicadPcbSvgRenderer.mjs'

/**
 * Routes board rendering through the matching format renderer.
 */
export class BoardSvgRenderer {
    /** @type {{ render: (board: object | null, options?: object) => string }} */
    #kicadRenderer

    /** @type {{ render: (board: object, options?: object) => string }} */
    #altiumRenderer

    /**
     * @param {{ kicadRenderer?: object, altiumRenderer?: object }} [dependencies]
     */
    constructor(dependencies = {}) {
        this.#kicadRenderer =
            dependencies.kicadRenderer || new KicadPcbSvgRenderer()
        this.#altiumRenderer =
            dependencies.altiumRenderer || new AltiumPcbSvgRenderer()
    }

    /**
     * Renders a board with its native toolkit renderer.
     * @param {object | null} board
     * @param {object} [options]
     * @returns {string}
     */
    render(board, options = {}) {
        if (BoardSvgRenderer.isAltiumPcbModel(board)) {
            return this.#altiumRenderer.render(board, options)
        }

        return this.#kicadRenderer.render(board, options)
    }

    /**
     * Renders a board asynchronously, using a browser worker when available.
     * @param {object | null} board
     * @param {object} [options]
     * @returns {Promise<string>}
     */
    async renderAsync(board, options = {}) {
        if (canUseRenderWorker()) {
            try {
                return await renderInWorker(board, options)
            } catch (_error) {
                disableRenderWorker()
            }
        }

        await yieldToMainThread()
        return this.render(board, options)
    }

    /**
     * Returns true for normalized Altium PCB models.
     * @param {object | null} board
     * @returns {boolean}
     */
    static isAltiumPcbModel(board) {
        return Boolean(board?.kind === 'pcb' && board?.fileType === 'PcbDoc')
    }
}

/** @type {Worker | null} */
let renderWorker = null

/** @type {boolean} */
let renderWorkerDisabled = false

/** @type {number} */
let nextRenderRequestId = 1

/** @type {Map<number, { resolve: (svg: string) => void, reject: (error: Error) => void }>} */
const pendingRenderRequests = new Map()

/**
 * Returns whether the current runtime can use a browser render worker.
 * @returns {boolean}
 */
function canUseRenderWorker() {
    return (
        !renderWorkerDisabled &&
        typeof Worker === 'function' &&
        typeof window !== 'undefined'
    )
}

/**
 * Disables the render worker after a startup or runtime failure.
 * @returns {void}
 */
function disableRenderWorker() {
    renderWorkerDisabled = true
    if (renderWorker) {
        renderWorker.terminate()
        renderWorker = null
    }
    rejectPendingRenderRequests(new Error('PCB render worker failed.'))
}

/**
 * Renders the board in the shared module worker.
 * @param {object | null} board
 * @param {object} options
 * @returns {Promise<string>}
 */
function renderInWorker(board, options) {
    const worker = ensureRenderWorker()
    const id = nextRenderRequestId++

    return new Promise((resolve, reject) => {
        pendingRenderRequests.set(id, { resolve, reject })
        worker.postMessage({ id, board, options })
    })
}

/**
 * Creates or returns the shared render worker.
 * @returns {Worker}
 */
function ensureRenderWorker() {
    if (renderWorker) return renderWorker

    renderWorker = new Worker(
        new URL('../render-worker.mjs', import.meta.url),
        {
            type: 'module'
        }
    )
    renderWorker.addEventListener('message', handleRenderWorkerMessage)
    renderWorker.addEventListener('error', handleRenderWorkerError)
    renderWorker.addEventListener('messageerror', handleRenderWorkerError)
    return renderWorker
}

/**
 * Handles one worker render response.
 * @param {MessageEvent} event
 * @returns {void}
 */
function handleRenderWorkerMessage(event) {
    const id = Number(event.data?.id)
    const request = pendingRenderRequests.get(id)
    if (!request) return

    pendingRenderRequests.delete(id)
    if (event.data?.error) {
        request.reject(new Error(String(event.data.error)))
        return
    }

    request.resolve(String(event.data?.svg || ''))
}

/**
 * Handles worker startup, runtime, or message errors.
 * @returns {void}
 */
function handleRenderWorkerError() {
    disableRenderWorker()
}

/**
 * Rejects all pending worker render requests.
 * @param {Error} error
 * @returns {void}
 */
function rejectPendingRenderRequests(error) {
    const requests = Array.from(pendingRenderRequests.values())
    pendingRenderRequests.clear()
    requests.forEach((request) => request.reject(error))
}

/**
 * Gives the browser a chance to paint before running a synchronous fallback render.
 * @returns {Promise<void>}
 */
function yieldToMainThread() {
    return new Promise((resolve) => {
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => resolve())
            return
        }

        setTimeout(resolve, 0)
    })
}
