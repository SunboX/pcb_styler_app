// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: AGPL-3.0-or-later

import { PcbSvgRendererDecorator } from './PcbSvgRendererDecorator.mjs'

/**
 * Scopes Altium renderer markup so app-level styles do not leak.
 * @param {string} markup
 * @param {object | null} board
 * @param {object} _options
 * @param {{ side?: 'front' | 'back' }} context
 * @returns {string}
 */
export function wrapAltiumMarkup(markup, board, _options, context) {
    const svgMarkup = extractSvgMarkup(markup)
    const sideAwareMarkup =
        context?.side === 'back'
            ? wrapBackSideSvgScene(svgMarkup, board)
            : wrapFrontSideSvgScene(svgMarkup)
    return sideAwareMarkup.trim().startsWith('<div class="altium-output"')
        ? sideAwareMarkup
        : '<div class="altium-output">' + sideAwareMarkup + '</div>'
}

/**
 * Extracts the toolkit SVG scene from its report-style HTML wrapper.
 * @param {string} markup
 * @returns {string}
 */
function extractSvgMarkup(markup) {
    return markup.match(/<svg\b[\s\S]*<\/svg>/u)?.[0] || markup
}

/**
 * Wraps the front-side render in the shared scene coordinate group.
 * @param {string} markup
 * @returns {string}
 */
function wrapFrontSideSvgScene(markup) {
    return wrapSvgScene(markup, '<g class="pcb-scene">')
}

/**
 * Mirrors the rendered SVG scene as a backside view.
 * @param {string} markup
 * @param {object | null} board
 * @returns {string}
 */
function wrapBackSideSvgScene(markup, board) {
    const translateX = PcbSvgRendererDecorator.formatNumber(
        mirrorTranslateX(board)
    )
    return wrapSvgScene(
        markup,
        '<g class="pcb-scene pcb-scene--back" transform="translate(' +
            translateX +
            ' 0) scale(-1 1)">'
    )
}

/**
 * Wraps SVG render content while preserving definitions at root level.
 * @param {string} markup
 * @param {string} sceneOpenTag
 * @returns {string}
 */
function wrapSvgScene(markup, sceneOpenTag) {
    if (/\bclass="[^"]*\bpcb-scene\b[^"]*"/u.test(markup)) return markup

    return markup.replace(
        /(<svg\b[^>]*>)(<defs>[\s\S]*?<\/defs>)?([\s\S]*?)(<\/svg>)/u,
        (_match, openSvg, defs = '', sceneMarkup, closeSvg) =>
            openSvg + defs + sceneOpenTag + sceneMarkup + '</g>' + closeSvg
    )
}

/**
 * Resolves the horizontal mirror transform translation from board bounds.
 * @param {object | null} board
 * @returns {number}
 */
function mirrorTranslateX(board) {
    const outline = board?.pcb?.boardOutline
    const minX = Number(outline?.minX || 0)
    const width = Number(outline?.widthMil || 0)
    return minX * 2 + width
}
