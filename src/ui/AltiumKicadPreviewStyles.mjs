// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: AGPL-3.0-or-later

const kicadPreviewColors = Object.freeze({
    background: '#061326',
    boardFill: '#df8060',
    edge: '#c7d0d6',
    frontCopper: '#fff0a2',
    frontZone: '#df8060',
    padFill: '#fff0a2',
    padStroke: '#d43b3c',
    viaFill: '#f2c843',
    viaStroke: '#d43b3c',
    drill: '#061326',
    silkscreen: '#f26b6b'
})

/**
 * Applies the KiCad-like preview preset to Altium renderer SVG markup.
 */
export class AltiumKicadPreviewStyles {
    /**
     * Applies the preset when requested.
     * @param {string} markup
     * @param {{ renderPreset?: string }} options
     * @param {typeof import('./PcbSvgRendererDecorator.mjs').PcbSvgRendererDecorator} helpers
     * @returns {string}
     */
    static apply(markup, options, helpers) {
        if (options.renderPreset !== 'kicad') return markup

        return AltiumKicadPreviewStyles.#applyElementStyles(
            AltiumKicadPreviewStyles.#addBackground(
                AltiumKicadPreviewStyles.#addSvgClass(
                    markup,
                    'pcb-svg--kicad-preview',
                    helpers
                ),
                helpers
            ),
            helpers
        )
    }

    /**
     * Adds a class token to the rendered SVG element.
     * @param {string} markup
     * @param {string} className
     * @param {typeof import('./PcbSvgRendererDecorator.mjs').PcbSvgRendererDecorator} helpers
     * @returns {string}
     */
    static #addSvgClass(markup, className, helpers) {
        return markup.replace(/<svg\b[^>]*>/u, (tag) => {
            const classes = helpers
                .getAttribute(tag, 'class')
                .split(/\s+/u)
                .filter(Boolean)
            if (!classes.includes(className)) classes.push(className)
            return helpers.setAttribute(tag, 'class', classes.join(' '))
        })
    }

    /**
     * Adds the KiCad preview background inside the SVG viewBox.
     * @param {string} markup
     * @param {typeof import('./PcbSvgRendererDecorator.mjs').PcbSvgRendererDecorator} helpers
     * @returns {string}
     */
    static #addBackground(markup, helpers) {
        if (markup.includes('class="pcb-render-background"')) return markup

        const svgTag = markup.match(/<svg\b[^>]*>/u)?.[0] || ''
        const viewBox = helpers
            .getAttribute(svgTag, 'viewBox')
            .split(/\s+/u)
            .map(Number)
        if (
            viewBox.length !== 4 ||
            viewBox.some((value) => !Number.isFinite(value))
        ) {
            return markup
        }

        const [x, y, width, height] = viewBox
        const background = [
            '<rect class="pcb-render-background"',
            `x="${helpers.formatNumber(x)}"`,
            `y="${helpers.formatNumber(y)}"`,
            `width="${helpers.formatNumber(width)}"`,
            `height="${helpers.formatNumber(height)}"`,
            `fill="${kicadPreviewColors.background}"/>`
        ].join(' ')
        return markup.replace(svgTag, svgTag + background)
    }

    /**
     * Applies KiCad preview colors to Altium SVG element classes.
     * @param {string} markup
     * @param {typeof import('./PcbSvgRendererDecorator.mjs').PcbSvgRendererDecorator} helpers
     * @returns {string}
     */
    static #applyElementStyles(markup, helpers) {
        return helpers.styleMatchingTags(
            markup,
            [
                'board-outline',
                'pcb-fill',
                'pcb-polygon',
                'pcb-region',
                'pcb-track',
                'pcb-arc',
                'pcb-footprint-fill',
                'pcb-footprint-region',
                'pcb-footprint-track',
                'pcb-footprint-arc',
                'pcb-pad__ring',
                'pcb-pad__hole',
                'pcb-via__pad',
                'pcb-via__hole',
                'pcb-component__body',
                'pcb-text'
            ],
            (tag) =>
                AltiumKicadPreviewStyles.#styleElement(
                    AltiumKicadPreviewStyles.#show(tag, helpers),
                    helpers
                )
        )
    }

    /**
     * Removes manual-layer hiding before applying preset colors.
     * @param {string} tag
     * @param {typeof import('./PcbSvgRendererDecorator.mjs').PcbSvgRendererDecorator} helpers
     * @returns {string}
     */
    static #show(tag, helpers) {
        return helpers.removeStyleProperty(
            helpers.removeAttribute(tag, 'display'),
            'display'
        )
    }

    /**
     * Applies one KiCad-preview style based on Altium SVG classes.
     * @param {string} tag
     * @param {typeof import('./PcbSvgRendererDecorator.mjs').PcbSvgRendererDecorator} helpers
     * @returns {string}
     */
    static #styleElement(tag, helpers) {
        if (helpers.hasClass(tag, 'board-outline')) {
            return helpers.hasClass(tag, 'board-outline--stroke')
                ? AltiumKicadPreviewStyles.#styleStrokeOnly(
                      tag,
                      kicadPreviewColors.edge,
                      helpers
                  )
                : AltiumKicadPreviewStyles.#styleFillAndStroke(
                      tag,
                      kicadPreviewColors.boardFill,
                      kicadPreviewColors.edge,
                      helpers
                  )
        }
        if (AltiumKicadPreviewStyles.#isZone(tag, helpers)) {
            return AltiumKicadPreviewStyles.#styleFillAndStroke(
                tag,
                kicadPreviewColors.frontZone,
                kicadPreviewColors.frontZone,
                helpers
            )
        }
        if (AltiumKicadPreviewStyles.#isTrace(tag, helpers)) {
            return AltiumKicadPreviewStyles.#styleStrokeOnly(
                tag,
                kicadPreviewColors.frontCopper,
                helpers
            )
        }
        if (helpers.hasClass(tag, 'pcb-pad__ring')) {
            return AltiumKicadPreviewStyles.#styleFillAndStroke(
                tag,
                kicadPreviewColors.padFill,
                kicadPreviewColors.padStroke,
                helpers
            )
        }
        if (helpers.hasClass(tag, 'pcb-via__pad')) {
            return AltiumKicadPreviewStyles.#styleFillAndStroke(
                tag,
                kicadPreviewColors.viaFill,
                kicadPreviewColors.viaStroke,
                helpers
            )
        }
        if (
            helpers.hasClass(tag, 'pcb-pad__hole') ||
            helpers.hasClass(tag, 'pcb-via__hole')
        ) {
            return AltiumKicadPreviewStyles.#styleFillAndStroke(
                tag,
                kicadPreviewColors.drill,
                kicadPreviewColors.drill,
                helpers
            )
        }
        return AltiumKicadPreviewStyles.#styleFillAndStroke(
            tag,
            kicadPreviewColors.silkscreen,
            kicadPreviewColors.silkscreen,
            helpers
        )
    }

    /**
     * Checks whether an Altium tag represents copper area geometry.
     * @param {string} tag
     * @param {typeof import('./PcbSvgRendererDecorator.mjs').PcbSvgRendererDecorator} helpers
     * @returns {boolean}
     */
    static #isZone(tag, helpers) {
        return [
            'pcb-fill',
            'pcb-polygon',
            'pcb-region',
            'pcb-footprint-fill',
            'pcb-footprint-region'
        ].some((className) => helpers.hasClass(tag, className))
    }

    /**
     * Checks whether an Altium tag represents copper stroke geometry.
     * @param {string} tag
     * @param {typeof import('./PcbSvgRendererDecorator.mjs').PcbSvgRendererDecorator} helpers
     * @returns {boolean}
     */
    static #isTrace(tag, helpers) {
        return [
            'pcb-track',
            'pcb-arc',
            'pcb-footprint-track',
            'pcb-footprint-arc'
        ].some((className) => helpers.hasClass(tag, className))
    }

    /**
     * Applies fill and stroke attributes plus browser-authoritative styles.
     * @param {string} tag
     * @param {string} fill
     * @param {string} stroke
     * @param {typeof import('./PcbSvgRendererDecorator.mjs').PcbSvgRendererDecorator} helpers
     * @returns {string}
     */
    static #styleFillAndStroke(tag, fill, stroke, helpers) {
        let next = helpers.setAttribute(tag, 'fill', fill)
        next = helpers.setStyleProperty(next, 'fill', fill)
        next = helpers.setAttribute(next, 'stroke', stroke)
        next = helpers.setStyleProperty(next, 'stroke', stroke)
        return next
    }

    /**
     * Applies stroke attributes plus browser-authoritative styles.
     * @param {string} tag
     * @param {string} stroke
     * @param {typeof import('./PcbSvgRendererDecorator.mjs').PcbSvgRendererDecorator} helpers
     * @returns {string}
     */
    static #styleStrokeOnly(tag, stroke, helpers) {
        let next = helpers.setAttribute(tag, 'stroke', stroke)
        next = helpers.setStyleProperty(next, 'stroke', stroke)
        return next
    }
}
