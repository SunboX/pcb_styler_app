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
     * Returns true for normalized Altium PCB models.
     * @param {object | null} board
     * @returns {boolean}
     */
    static isAltiumPcbModel(board) {
        return Boolean(board?.kind === 'pcb' && board?.fileType === 'PcbDoc')
    }
}
