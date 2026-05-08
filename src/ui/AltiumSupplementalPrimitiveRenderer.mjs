// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: AGPL-3.0-or-later

import { isCopperPrimitive } from './AltiumPcbRenderModel.mjs'
import { PcbSvgRendererDecorator } from './PcbSvgRendererDecorator.mjs'

/**
 * Adds primitives omitted by older public toolkit renderer releases.
 * @param {string} markup
 * @param {{ primitiveLayers?: object[], regions?: object[], shapeBasedRegions?: object[], texts?: object[], components?: object[] }} pcb
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {string}
 */
export function injectSupplementalPrimitiveMarkup(markup, pcb, helpers) {
    return removeSyntheticComponentTextLabels(
        injectSupplementalTextMarkup(
            injectSupplementalRegionMarkup(markup, pcb, helpers),
            pcb,
            helpers
        ),
        pcb.components || [],
        helpers
    )
}

/**
 * Adds region path markup when the toolkit renderer did not emit it.
 * @param {string} markup
 * @param {{ primitiveLayers?: object[], regions?: object[], shapeBasedRegions?: object[] }} pcb
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {string}
 */
function injectSupplementalRegionMarkup(markup, pcb, helpers) {
    if (markup.includes('class="pcb-region')) return markup

    const copperGroups = splitCopperRegions(selectRenderedRegions(pcb))
    return injectIntoFirstGroup(
        injectIntoFirstGroup(
            injectIntoFirstGroup(
                markup,
                'pcb-copper pcb-copper--subsurface',
                renderRegions(
                    copperGroups.subsurface,
                    'pcb-region pcb-region--subsurface',
                    helpers
                )
            ),
            'pcb-copper pcb-copper--surface',
            renderRegions(
                copperGroups.surface,
                'pcb-region pcb-region--surface',
                helpers
            )
        ),
        'pcb-footprints',
        renderRegions(
            selectFootprintRegions(pcb),
            'pcb-footprint-region',
            helpers
        )
    )
}

/**
 * Adds authored board text when the toolkit renderer did not emit it.
 * @param {string} markup
 * @param {{ primitiveLayers?: object[], texts?: object[] }} pcb
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {string}
 */
function injectSupplementalTextMarkup(markup, pcb, helpers) {
    if (markup.includes('class="pcb-text')) return markup

    return injectIntoFirstGroup(
        markup,
        'pcb-footprints',
        renderTexts(selectVisibleTexts(pcb), helpers)
    )
}

/**
 * Removes labels generated from component placement data.
 * @param {string} markup
 * @param {readonly object[]} components
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {string}
 */
function removeSyntheticComponentTextLabels(markup, components, helpers) {
    const designators = new Set(
        (components || []).map((component) =>
            String(component?.designator || component?.name || '').trim()
        )
    )
    if (!designators.size) return markup

    return markup.replace(/<text\b[^>]*>([^<]*)<\/text>/gu, (tag, text) => {
        if (helpers.hasClass(tag, 'pcb-text')) return tag
        return designators.has(String(text || '').trim()) ? '' : tag
    })
}

/**
 * Inserts child markup before the closing tag of the first matching SVG group.
 * @param {string} markup
 * @param {string} className
 * @param {string} childMarkup
 * @returns {string}
 */
function injectIntoFirstGroup(markup, className, childMarkup) {
    if (!childMarkup) return markup

    const escapedClass = PcbSvgRendererDecorator.escapeRegExp(className)
    const pattern = new RegExp(
        '(<g\\b[^>]*\\bclass="' + escapedClass + '"[^>]*>)([\\s\\S]*?)(<\\/g>)',
        'u'
    )
    return markup.replace(pattern, '$1$2' + childMarkup + '$3')
}

/**
 * Renders filled region contours as SVG paths.
 * @param {object[]} regions
 * @param {string} className
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {string}
 */
function renderRegions(regions, className, helpers) {
    return (regions || [])
        .map((region) => renderRegion(region, className, helpers))
        .join('')
}

/**
 * Renders one filled region path.
 * @param {{ points?: object[], holes?: object[][] }} region
 * @param {string} className
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {string}
 */
function renderRegion(region, className, helpers) {
    const path = buildRegionPath(region, helpers)
    if (!path) return ''

    return (
        '<path class="' +
        helpers.escapeText(className) +
        '" d="' +
        helpers.escapeText(path) +
        '" fill-rule="evenodd" />'
    )
}

/**
 * Builds one SVG path containing the outline and holes.
 * @param {{ points?: object[], holes?: object[][] }} region
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {string}
 */
function buildRegionPath(region, helpers) {
    return [
        buildPointPath(region?.points || [], helpers),
        ...(region?.holes || []).map((hole) => buildPointPath(hole, helpers))
    ]
        .filter(Boolean)
        .join(' ')
}

/**
 * Builds one closed contour path from region points.
 * @param {object[]} points
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {string}
 */
function buildPointPath(points, helpers) {
    const contour = withoutClosingDuplicate(points || [])
    if (contour.length < 3) return ''

    const [first] = contour
    const commands = [
        'M ' +
            formatPointCoordinate(first.x, helpers) +
            ' ' +
            formatPointCoordinate(first.y, helpers)
    ]
    for (let index = 0; index < contour.length - 1; index += 1) {
        commands.push(
            regionSegmentCommand(contour[index], contour[index + 1], helpers)
        )
    }
    commands.push('Z')
    return commands.join(' ')
}

/**
 * Builds one line or arc command between two region points.
 * @param {object} current
 * @param {object} next
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {string}
 */
function regionSegmentCommand(current, next, helpers) {
    if (current?.isArc && Number(current.radius || 0) > 0) {
        const delta =
            normalizeAngle(
                Number(current.endAngle || 0) - Number(current.startAngle || 0)
            ) || 360
        return (
            'A ' +
            formatPointCoordinate(current.radius, helpers) +
            ' ' +
            formatPointCoordinate(current.radius, helpers) +
            ' 0 ' +
            (delta > 180 ? '1' : '0') +
            ' ' +
            (Number(current.endAngle || 0) >= Number(current.startAngle || 0)
                ? '1'
                : '0') +
            ' ' +
            formatPointCoordinate(next.x, helpers) +
            ' ' +
            formatPointCoordinate(next.y, helpers)
        )
    }

    return (
        'L ' +
        formatPointCoordinate(next.x, helpers) +
        ' ' +
        formatPointCoordinate(next.y, helpers)
    )
}

/**
 * Removes an explicit duplicate closing vertex when present.
 * @param {object[]} points
 * @returns {object[]}
 */
function withoutClosingDuplicate(points) {
    if (points.length < 2) return points

    const first = points[0]
    const last = points[points.length - 1]
    if (
        Math.abs(Number(first.x) - Number(last.x)) < 1e-6 &&
        Math.abs(Number(first.y) - Number(last.y)) < 1e-6
    ) {
        return points.slice(0, -1)
    }
    return points
}

/**
 * Normalizes one angle delta into [0, 360).
 * @param {number} angle
 * @returns {number}
 */
function normalizeAngle(angle) {
    const normalized = Number(angle || 0) % 360
    return normalized < 0 ? normalized + 360 : normalized
}

/**
 * Renders recovered PCB text primitives.
 * @param {object[]} texts
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {string}
 */
function renderTexts(texts, helpers) {
    return (texts || []).map((text) => renderText(text, helpers)).join('')
}

/**
 * Renders one PCB text primitive.
 * @param {{ text?: string, x?: number, y?: number, height?: number, rotation?: number, layerId?: number, fontFamily?: string, fontWeight?: number, fontStyle?: string }} text
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {string}
 */
function renderText(text, helpers) {
    const fontSize = Math.max(Number(text.height || 0), 8)
    const lines = String(text.text || '')
        .replace(/\r\n?/gu, '\n')
        .split('\n')
        .filter((line) => line.length > 0)
    const content =
        lines.length === 1
            ? helpers.escapeText(lines[0])
            : renderTextLines(lines, fontSize, helpers)

    return (
        '<text class="pcb-text pcb-text--layer-' +
        helpers.escapeText(String(Number(text.layerId || 0))) +
        '" transform="translate(' +
        formatPointCoordinate(text.x, helpers) +
        ' ' +
        formatPointCoordinate(text.y, helpers) +
        ') rotate(' +
        formatPointCoordinate(text.rotation, helpers) +
        ')" font-size="' +
        helpers.formatNumber(fontSize) +
        '"' +
        renderTextFontAttributes(text, helpers) +
        ' text-anchor="start" dominant-baseline="alphabetic">' +
        content +
        '</text>'
    )
}

/**
 * Renders SVG tspans for multi-line text.
 * @param {string[]} lines
 * @param {number} fontSize
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {string}
 */
function renderTextLines(lines, fontSize, helpers) {
    return lines
        .map(
            (line, index) =>
                '<tspan x="0" dy="' +
                helpers.formatNumber(index === 0 ? 0 : fontSize) +
                '">' +
                helpers.escapeText(line) +
                '</tspan>'
        )
        .join('')
}

/**
 * Renders optional SVG font attributes for TrueType text primitives.
 * @param {{ fontFamily?: string, fontWeight?: number, fontStyle?: string }} text
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {string}
 */
function renderTextFontAttributes(text, helpers) {
    let attributes = ''
    if (text.fontFamily && text.fontFamily !== 'Stroke') {
        attributes +=
            ' font-family="' + helpers.escapeText(text.fontFamily) + '"'
    }
    if (text.fontWeight) {
        attributes +=
            ' font-weight="' + helpers.escapeText(text.fontWeight) + '"'
    }
    if (text.fontStyle && text.fontStyle !== 'normal') {
        attributes += ' font-style="' + helpers.escapeText(text.fontStyle) + '"'
    }
    return attributes
}

/**
 * Formats one SVG coordinate.
 * @param {unknown} value
 * @param {typeof PcbSvgRendererDecorator} helpers
 * @returns {string}
 */
function formatPointCoordinate(value, helpers) {
    return helpers.formatNumber(Number(value || 0))
}

/**
 * Selects the authored texts visible in the side-resolved board.
 * @param {{ primitiveLayers?: object[], texts?: object[] }} pcb
 * @returns {object[]}
 */
function selectVisibleTexts(pcb) {
    const layerIds = selectFootprintLayerIds(pcb.primitiveLayers || [])
    return (pcb.texts || []).filter((text) => {
        const layerId = Number(text?.layerId)
        return (
            text?.visible !== false &&
            String(text?.text || '').trim() &&
            text?.isPlaceholder !== true &&
            Number.isInteger(layerId) &&
            layerIds.has(layerId)
        )
    })
}

/**
 * Selects the region family emitted by the toolkit renderer.
 * @param {{ regions?: object[], shapeBasedRegions?: object[] }} pcb
 * @returns {object[]}
 */
function selectRenderedRegions(pcb) {
    return (pcb.shapeBasedRegions || []).length
        ? pcb.shapeBasedRegions || []
        : pcb.regions || []
}

/**
 * Selects region primitives belonging to documentation or overlay layers.
 * @param {{ primitiveLayers?: object[], regions?: object[], shapeBasedRegions?: object[] }} pcb
 * @returns {object[]}
 */
function selectFootprintRegions(pcb) {
    const layerIds = selectFootprintLayerIds(pcb.primitiveLayers || [])
    return selectRenderedRegions(pcb).filter(
        (region) =>
            !isCopperPrimitive(region) && layerIds.has(Number(region?.layerId))
    )
}

/**
 * Selects footprint-oriented primitive layer ids.
 * @param {readonly object[]} primitiveLayers
 * @returns {Set<number>}
 */
function selectFootprintLayerIds(primitiveLayers) {
    const layerIds = new Set(
        (primitiveLayers || [])
            .filter((layer) => isFootprintLayerName(layer?.name))
            .map((layer) => Number(layer.layerId))
            .filter((layerId) => Number.isInteger(layerId))
    )
    if (layerIds.size) return layerIds

    return new Set([1, 33, 35, 37, 73])
}

/**
 * Checks whether a primitive layer name belongs to visible board details.
 * @param {unknown} name
 * @returns {boolean}
 */
function isFootprintLayerName(name) {
    const value = String(name || '')
        .trim()
        .toUpperCase()
    return [
        'TOP OVERLAY',
        'TOP SOLDER',
        'TOP PASTE',
        'L1_TOP',
        'DRILL DRAWING'
    ].some((needle) => value.includes(needle))
}

/**
 * Splits copper regions into toolkit-compatible paint order groups.
 * @param {object[]} regions
 * @returns {{ surface: object[], subsurface: object[] }}
 */
function splitCopperRegions(regions) {
    const copperRegions = (regions || []).filter((region) =>
        isCopperPrimitive(region)
    )
    const surfaceLayerCode = resolveSurfaceLayerCode(copperRegions)
    return {
        subsurface: copperRegions.filter(
            (region) => region.layerCode !== surfaceLayerCode
        ),
        surface: copperRegions.filter(
            (region) => region.layerCode === surfaceLayerCode
        )
    }
}

/**
 * Returns the default visible layer code from one primitive family.
 * @param {{ layerCode?: number }[]} primitives
 * @returns {number | null}
 */
function resolveSurfaceLayerCode(primitives) {
    const layerCodes = primitives
        .map((primitive) => primitive.layerCode)
        .filter((layerCode) => Number.isFinite(layerCode))
    return layerCodes.length ? Math.min(...layerCodes) : null
}
