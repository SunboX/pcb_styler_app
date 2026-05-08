// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: AGPL-3.0-or-later

import { BadgeRenderer } from './BadgeRenderer.mjs'
import { ComponentHighlight } from './ComponentHighlight.mjs'
import { RenderPalette } from './RenderPalette.mjs'

/**
 * Decorates toolkit PCB SVG output with PCB Styler presentation features.
 */
export class PcbSvgRendererDecorator {
    /** @type {{ render: (board: object | null, options?: object) => string }} */
    #renderer

    /** @type {(options: object, board: object | null) => object | undefined} */
    #baseOptions

    /** @type {object[]} */
    #layerRules

    /** @type {string[]} */
    #highlightableClasses

    /** @type {string[]} */
    #highlightFillClasses

    /** @type {(markup: string, board: object | null, options: object, context: object, helpers: typeof PcbSvgRendererDecorator) => string} */
    #prepareMarkup

    /** @type {(markup: string, board: object | null, options: object, context: object, helpers: typeof PcbSvgRendererDecorator) => string} */
    #afterLayerStyles

    /** @type {(board: object | null, options: object, context: object, helpers: typeof PcbSvgRendererDecorator) => string} */
    #overlayRenderer

    /** @type {(markup: string, overlayMarkup: string, board: object | null, options: object, context: object) => string} */
    #insertOverlay

    /** @type {(markup: string, board: object | null, options: object, context: object) => string} */
    #wrapMarkup

    /** @type {boolean} */
    #decorateEmpty

    /**
     * @param {{ renderer: { render: (board: object | null, options?: object) => string }, baseOptions?: (options: object, board: object | null) => object | undefined, layerRules?: object[], highlightableClasses?: string[], highlightFillClasses?: string[], prepareMarkup?: (markup: string, board: object | null, options: object, context: object, helpers: typeof PcbSvgRendererDecorator) => string, afterLayerStyles?: (markup: string, board: object | null, options: object, context: object, helpers: typeof PcbSvgRendererDecorator) => string, overlayRenderer?: (board: object | null, options: object, context: object, helpers: typeof PcbSvgRendererDecorator) => string, insertOverlay?: (markup: string, overlayMarkup: string, board: object | null, options: object, context: object) => string, wrapMarkup?: (markup: string, board: object | null, options: object, context: object) => string, decorateEmpty?: boolean }} config
     */
    constructor(config) {
        this.#renderer = config.renderer
        this.#baseOptions = config.baseOptions || (() => undefined)
        this.#layerRules = config.layerRules || []
        this.#highlightableClasses = config.highlightableClasses || []
        this.#highlightFillClasses = config.highlightFillClasses || []
        this.#prepareMarkup = config.prepareMarkup || ((markup) => markup)
        this.#afterLayerStyles = config.afterLayerStyles || ((markup) => markup)
        this.#overlayRenderer = config.overlayRenderer || (() => '')
        this.#insertOverlay =
            config.insertOverlay || PcbSvgRendererDecorator.insertBeforeSvgEnd
        this.#wrapMarkup = config.wrapMarkup || ((markup) => markup)
        this.#decorateEmpty = config.decorateEmpty === true
    }

    /**
     * Renders and decorates a toolkit PCB SVG.
     * @param {object | null} board
     * @param {{ side?: 'front' | 'back', layerStyles?: Record<string, object>, colors?: Record<string, string>, highlightedFootprints?: readonly string[], hoveredFootprintId?: string, highlightColor?: string, badges?: readonly object[], badgeStyle?: object }} [options]
     * @returns {string}
     */
    render(board, options = {}) {
        const side = options.side === 'back' ? 'back' : 'front'
        const context = {
            side,
            styles: RenderPalette.resolveStyles(
                options.layerStyles,
                options.colors
            ),
            highlight: ComponentHighlight.resolve(options)
        }
        const baseMarkup = String(
            this.#renderer.render(
                board || null,
                this.#baseOptions(options, board || null)
            ) || ''
        )

        if (!board && !this.#decorateEmpty) {
            return this.#wrapMarkup(baseMarkup, board || null, options, context)
        }

        const preparedMarkup = this.#prepareMarkup(
            baseMarkup,
            board || null,
            options,
            context,
            PcbSvgRendererDecorator
        )
        const styledMarkup = this.#afterLayerStyles(
            PcbSvgRendererDecorator.applyLayerStyles(
                preparedMarkup,
                context.styles,
                this.#layerRules
            ),
            board || null,
            options,
            context,
            PcbSvgRendererDecorator
        )
        const highlightedMarkup =
            PcbSvgRendererDecorator.applyComponentHighlights(
                styledMarkup,
                context.highlight,
                {
                    highlightableClasses: this.#highlightableClasses,
                    highlightFillClasses: this.#highlightFillClasses
                }
            )
        const overlayMarkup = [
            this.#overlayRenderer(
                board || null,
                options,
                context,
                PcbSvgRendererDecorator
            ),
            BadgeRenderer.render(
                options.badges || [],
                side,
                context.highlight.color,
                options.badgeStyle || {}
            )
        ].join('')

        return this.#wrapMarkup(
            this.#insertOverlay(
                highlightedMarkup,
                overlayMarkup,
                board || null,
                options,
                context
            ),
            board || null,
            options,
            context
        )
    }

    /**
     * Applies configured layer rules.
     * @param {string} markup
     * @param {Record<string, object>} styles
     * @param {object[]} rules
     * @returns {string}
     */
    static applyLayerStyles(markup, styles, rules) {
        return rules.reduce((next, rule) => {
            return PcbSvgRendererDecorator.styleMatchingTags(
                next,
                rule.classNames || [],
                (tag) =>
                    PcbSvgRendererDecorator.applyLayerRule(tag, styles, rule)
            )
        }, markup)
    }

    /**
     * Applies one layer rule to a start tag.
     * @param {string} tag
     * @param {Record<string, object>} styles
     * @param {object} rule
     * @returns {string}
     */
    static applyLayerRule(tag, styles, rule) {
        if (
            (rule.skipClassNames || []).some((className) =>
                PcbSvgRendererDecorator.hasClass(tag, className)
            )
        ) {
            return tag
        }

        if (typeof rule.apply === 'function') {
            return rule.apply(tag, styles, PcbSvgRendererDecorator)
        }

        return PcbSvgRendererDecorator.applySvgStyle(
            tag,
            styles[rule.styleKey],
            rule
        )
    }

    /**
     * Applies selected and hover highlight state to footprint-owned primitives.
     * @param {string} markup
     * @param {{ selected: Set<string>, hovered: string, color: string, hoverColor: string }} highlight
     * @param {{ highlightableClasses?: string[], highlightFillClasses?: string[] }} options
     * @returns {string}
     */
    static applyComponentHighlights(markup, highlight, options = {}) {
        const highlightableClasses = options.highlightableClasses || []
        const highlightFillClasses = options.highlightFillClasses || []
        return markup.replace(
            /<(?!(?:\/|svg\b))[^>]+\bdata-footprint-id="([^"]+)"[^>]*>/gu,
            (tag) => {
                if (
                    !highlightableClasses.some((className) =>
                        PcbSvgRendererDecorator.hasClass(tag, className)
                    )
                ) {
                    return tag
                }

                const state = ComponentHighlight.stateFor(
                    PcbSvgRendererDecorator.getAttribute(
                        tag,
                        'data-footprint-id'
                    ),
                    highlight
                )
                if (!state) return tag

                let next = PcbSvgRendererDecorator.setAttribute(
                    tag,
                    'data-highlight-state',
                    state.state
                )
                next = PcbSvgRendererDecorator.setAttribute(
                    next,
                    'stroke',
                    state.color
                )
                next = PcbSvgRendererDecorator.setStyleProperty(
                    next,
                    'stroke',
                    state.color
                )
                if (
                    highlightFillClasses.some((className) =>
                        PcbSvgRendererDecorator.hasClass(tag, className)
                    ) ||
                    PcbSvgRendererDecorator.tagHasPaintedFill(tag)
                ) {
                    next = PcbSvgRendererDecorator.setAttribute(
                        next,
                        'fill',
                        state.color
                    )
                    next = PcbSvgRendererDecorator.setStyleProperty(
                        next,
                        'fill',
                        state.color
                    )
                    next = PcbSvgRendererDecorator.setAttribute(
                        next,
                        'fill-opacity',
                        '1'
                    )
                    next = PcbSvgRendererDecorator.setStyleProperty(
                        next,
                        'fill-opacity',
                        '1'
                    )
                }
                return next
            }
        )
    }

    /**
     * Resolves the selected or hover state for one footprint id.
     * @param {string} footprintId
     * @param {{ selected: Set<string>, hovered: string, color: string, hoverColor: string }} highlight
     * @returns {{ state: 'selected' | 'hover', color: string } | null}
     */
    static componentHighlightStateFor(footprintId, highlight) {
        return ComponentHighlight.stateFor(footprintId, highlight)
    }

    /**
     * Applies fill, stroke, width, opacity, and visibility attributes.
     * @param {string} tag
     * @param {{ visible: boolean, fillColor: string, fillOpacity: number, borderColor: string, borderWidth: number | null }} style
     * @param {{ fill?: boolean, stroke?: boolean, forceFill?: string }} options
     * @returns {string}
     */
    static applySvgStyle(tag, style, options) {
        let next = tag
        if (!style.visible) {
            next = PcbSvgRendererDecorator.setAttribute(next, 'display', 'none')
            next = PcbSvgRendererDecorator.setStyleProperty(
                next,
                'display',
                'none'
            )
        }
        if (options.forceFill !== undefined) {
            next = PcbSvgRendererDecorator.setAttribute(
                next,
                'fill',
                options.forceFill
            )
            next = PcbSvgRendererDecorator.setStyleProperty(
                next,
                'fill',
                options.forceFill
            )
        } else if (options.fill) {
            next = PcbSvgRendererDecorator.setAttribute(
                next,
                'fill',
                style.fillColor
            )
            next = PcbSvgRendererDecorator.setStyleProperty(
                next,
                'fill',
                style.fillColor
            )
            if (style.fillOpacity < 1) {
                next = PcbSvgRendererDecorator.setAttribute(
                    next,
                    'fill-opacity',
                    PcbSvgRendererDecorator.formatNumber(style.fillOpacity)
                )
                next = PcbSvgRendererDecorator.setStyleProperty(
                    next,
                    'fill-opacity',
                    PcbSvgRendererDecorator.formatNumber(style.fillOpacity)
                )
            }
        }
        if (options.stroke) {
            next = PcbSvgRendererDecorator.setAttribute(
                next,
                'stroke',
                style.borderColor
            )
            next = PcbSvgRendererDecorator.setStyleProperty(
                next,
                'stroke',
                style.borderColor
            )
            if (style.borderWidth !== null) {
                next = PcbSvgRendererDecorator.setAttribute(
                    next,
                    'stroke-width',
                    PcbSvgRendererDecorator.formatNumber(style.borderWidth)
                )
                next = PcbSvgRendererDecorator.setStyleProperty(
                    next,
                    'stroke-width',
                    PcbSvgRendererDecorator.formatNumber(style.borderWidth)
                )
            }
        }
        return next
    }

    /**
     * Updates all SVG element start tags that contain one of the requested classes.
     * @param {string} markup
     * @param {string[]} classNames
     * @param {(tag: string) => string} callback
     * @returns {string}
     */
    static styleMatchingTags(markup, classNames, callback) {
        return markup.replace(
            /<(?!(?:\/|svg\b))[^>]+\bclass="[^"]*"[^>]*>/gu,
            (tag) => {
                return classNames.some((className) =>
                    PcbSvgRendererDecorator.hasClass(tag, className)
                )
                    ? callback(tag)
                    : tag
            }
        )
    }

    /**
     * Inserts overlay markup before the closing SVG tag.
     * @param {string} markup
     * @param {string} overlayMarkup
     * @returns {string}
     */
    static insertBeforeSvgEnd(markup, overlayMarkup) {
        if (!overlayMarkup) return markup
        return markup.includes('</svg>')
            ? markup.replace('</svg>', overlayMarkup + '</svg>')
            : markup + overlayMarkup
    }

    /**
     * Checks whether a start tag has a fill that should be recolored.
     * @param {string} tag
     * @returns {boolean}
     */
    static tagHasPaintedFill(tag) {
        const fill = PcbSvgRendererDecorator.getAttribute(tag, 'fill')
        return Boolean(fill && fill !== 'none')
    }

    /**
     * Checks whether an SVG start tag contains a class token.
     * @param {string} tag
     * @param {string} className
     * @returns {boolean}
     */
    static hasClass(tag, className) {
        const match = tag.match(/\bclass="([^"]*)"/u)
        return Boolean(match?.[1]?.split(/\s+/u).includes(className))
    }

    /**
     * Returns a quoted SVG attribute value.
     * @param {string} tag
     * @param {string} name
     * @returns {string}
     */
    static getAttribute(tag, name) {
        const pattern = new RegExp(
            '\\s' + PcbSvgRendererDecorator.escapeRegExp(name) + '="([^"]*)"',
            'u'
        )
        return tag.match(pattern)?.[1] || ''
    }

    /**
     * Sets or replaces one quoted SVG attribute.
     * @param {string} tag
     * @param {string} name
     * @param {unknown} value
     * @returns {string}
     */
    static setAttribute(tag, name, value) {
        const escaped = PcbSvgRendererDecorator.escapeAttribute(value)
        const pattern = new RegExp(
            '\\s' + PcbSvgRendererDecorator.escapeRegExp(name) + '="[^"]*"',
            'u'
        )
        if (pattern.test(tag)) {
            return tag.replace(pattern, ' ' + name + '="' + escaped + '"')
        }

        return tag.replace(/\s*\/?>$/u, (ending) => {
            const suffix = ending.trim() === '/>' ? ' />' : '>'
            return ' ' + name + '="' + escaped + '"' + suffix
        })
    }

    /**
     * Removes one quoted SVG attribute from a start tag.
     * @param {string} tag
     * @param {string} name
     * @returns {string}
     */
    static removeAttribute(tag, name) {
        const cleanName = String(name || '').trim()
        if (!cleanName) return tag

        const pattern = new RegExp(
            '\\s' +
                PcbSvgRendererDecorator.escapeRegExp(cleanName) +
                '="[^"]*"',
            'u'
        )
        return tag.replace(pattern, '')
    }

    /**
     * Sets or replaces one inline SVG/CSS style declaration.
     * @param {string} tag
     * @param {string} name
     * @param {unknown} value
     * @returns {string}
     */
    static setStyleProperty(tag, name, value) {
        const cleanName = String(name || '')
            .trim()
            .toLowerCase()
        if (!cleanName) return tag

        const declarations = PcbSvgRendererDecorator.getAttribute(tag, 'style')
            .split(';')
            .map((declaration) => declaration.trim())
            .filter(Boolean)
            .filter(
                (declaration) =>
                    !declaration.toLowerCase().startsWith(cleanName + ':')
            )
        declarations.push(cleanName + ': ' + String(value ?? '').trim())
        return PcbSvgRendererDecorator.setAttribute(
            tag,
            'style',
            declarations.join('; ')
        )
    }

    /**
     * Removes one inline SVG/CSS style declaration.
     * @param {string} tag
     * @param {string} name
     * @returns {string}
     */
    static removeStyleProperty(tag, name) {
        const cleanName = String(name || '')
            .trim()
            .toLowerCase()
        if (!cleanName) return tag

        const declarations = PcbSvgRendererDecorator.getAttribute(tag, 'style')
            .split(';')
            .map((declaration) => declaration.trim())
            .filter(Boolean)
            .filter(
                (declaration) =>
                    !declaration.toLowerCase().startsWith(cleanName + ':')
            )
        if (declarations.length === 0) {
            return PcbSvgRendererDecorator.removeAttribute(tag, 'style')
        }

        return PcbSvgRendererDecorator.setAttribute(
            tag,
            'style',
            declarations.join('; ')
        )
    }

    /**
     * Escapes a string for RegExp construction.
     * @param {string} value
     * @returns {string}
     */
    static escapeRegExp(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
    }

    /**
     * Formats compact SVG numbers.
     * @param {number} value
     * @returns {string}
     */
    static formatNumber(value) {
        return Number(value || 0)
            .toFixed(4)
            .replace(/\.?0+$/u, '')
    }

    /**
     * Escapes text content.
     * @param {unknown} value
     * @returns {string}
     */
    static escapeText(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
    }

    /**
     * Escapes attribute values.
     * @param {unknown} value
     * @returns {string}
     */
    static escapeAttribute(value) {
        return PcbSvgRendererDecorator.escapeText(value).replaceAll(
            '"',
            '&quot;'
        )
    }
}
