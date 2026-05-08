// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = new URL('../', import.meta.url)

/**
 * Checks whether a project-relative file exists.
 * @param {string} relativePath
 * @returns {Promise<boolean>}
 */
async function exists(relativePath) {
    try {
        await access(new URL(relativePath, root), constants.F_OK)
        return true
    } catch {
        return false
    }
}

/**
 * Verifies mandatory project files.
 */
test('required project files exist', async () => {
    const required = [
        'README.md',
        'AGENTS.md',
        'LICENSE',
        'LICENSES/AGPL-3.0-or-later.txt',
        'LICENSES/CC-BY-SA-4.0.txt',
        'COMMERCIAL-LICENSE.md',
        'NOTICE.md',
        'CONTRIBUTING.md',
        'package.json',
        'spec/web-app-specification.md',
        'docs/getting-started.md',
        'docs/architecture.md',
        'docs/testing.md',
        'docs/security.md',
        'docs/troubleshooting.md',
        '.github/workflows/deploy-ftp.yml',
        'api/.htaccess',
        'api/app-meta.php',
        'scripts/build-static-deploy.mjs',
        'src/index.html',
        'src/main.mjs',
        'src/style.css',
        'src/server.mjs',
        'src/ServerAssetVersioner.mjs',
        'src/StaticDeployBuilder.mjs',
        'src/core/BoardFileLoader.mjs',
        'src/core/AppState.mjs',
        'src/core/ProjectArchive.mjs',
        'src/integrations/WebMcpBridge.mjs',
        'src/ui/BoardSvgRenderer.mjs',
        'src/ui/AltiumPcbSvgRenderer.mjs',
        'src/ui/AppView.mjs',
        'src/ui/BadgeControls.mjs',
        'src/ui/PcbSvgRendererDecorator.mjs',
        'tests/board-toolkit.test.mjs',
        'tests/app-controller.test.mjs',
        'tests/app-state.test.mjs',
        'tests/altium-app-renderer.test.mjs',
        'tests/kicad-app-renderer.test.mjs',
        'tests/pcb-svg-renderer-decorator.test.mjs',
        'tests/project-archive.test.mjs',
        'tests/deploy-ftp-workflow.test.mjs',
        'tests/php-app-meta-endpoint.test.mjs',
        'tests/project-structure.test.mjs',
        'tests/static-deploy-builder.test.mjs',
        'tests/mjs-line-limit.test.mjs'
    ]

    for (const relativePath of required) {
        assert.equal(
            await exists(relativePath),
            true,
            'Missing file: ' + relativePath
        )
    }
})

/**
 * Verifies licensing metadata follows the SunboX dual-license policy.
 */
test('project declares AGPL and commercial licensing notices', async () => {
    const pkg = JSON.parse(
        await readFile(new URL('package.json', root), 'utf8')
    )
    const readme = await readFile(new URL('README.md', root), 'utf8')
    const commercial = await readFile(
        new URL('COMMERCIAL-LICENSE.md', root),
        'utf8'
    )
    const notice = await readFile(new URL('NOTICE.md', root), 'utf8')
    const contributing = await readFile(
        new URL('CONTRIBUTING.md', root),
        'utf8'
    )

    assert.equal(pkg.license, 'AGPL-3.0-or-later')
    assert.match(readme, /AGPL-3\.0-or-later/)
    assert.match(readme, /CC-BY-SA-4\.0/)
    assert.match(readme, /Commercial licensing contact/)
    assert.match(commercial, /not itself a commercial license grant/)
    assert.match(notice, /https:\/\/github\.com\/SunboX\/pcb_styler_app/)
    assert.match(contributing, /commercial\/proprietary license offerings/)
})

/**
 * Verifies core npm scripts are present.
 */
test('package scripts include start and test', async () => {
    const raw = await readFile(new URL('package.json', root), 'utf8')
    const pkg = JSON.parse(raw)

    assert.equal(typeof pkg.scripts?.start, 'string')
    assert.equal(
        pkg.scripts?.['build:static'],
        'node scripts/build-static-deploy.mjs'
    )
    assert.equal(typeof pkg.scripts?.test, 'string')
    assert.equal(typeof pkg.dependencies?.['kicad-toolkit'], 'string')
    assert.equal(
        Object.keys(pkg.dependencies || {}).some((name) =>
            name.startsWith('@sunbox/')
        ),
        false
    )
    assert.equal(typeof pkg.dependencies?.['altium-toolkit'], 'string')
})

/**
 * Verifies parser and renderer internals are provided by toolkit packages.
 */
test('app imports PCB parsing and rendering from toolkit packages', async () => {
    const controller = await readFile(
        new URL('src/AppController.mjs', root),
        'utf8'
    )
    const boardLoader = await readFile(
        new URL('src/core/BoardFileLoader.mjs', root),
        'utf8'
    )
    const boardRenderer = await readFile(
        new URL('src/ui/BoardSvgRenderer.mjs', root),
        'utf8'
    )
    const altiumRenderer = await readFile(
        new URL('src/ui/AltiumPcbSvgRenderer.mjs', root),
        'utf8'
    )
    const kicadRenderer = await readFile(
        new URL('src/ui/KicadPcbSvgRenderer.mjs', root),
        'utf8'
    )
    const decorator = await readFile(
        new URL('src/ui/PcbSvgRendererDecorator.mjs', root),
        'utf8'
    )
    const state = await readFile(new URL('src/core/AppState.mjs', root), 'utf8')
    const view = await readFile(new URL('src/ui/AppView.mjs', root), 'utf8')
    const badgeControls = await readFile(
        new URL('src/ui/BadgeControls.mjs', root),
        'utf8'
    )
    const viewSource = await readFile(
        new URL('src/ui/AppView.mjs', root),
        'utf8'
    )

    assert.match(controller, /BoardFileLoader/)
    assert.match(controller, /BoardSvgRenderer/)
    assert.match(controller, /from '\.\/core\/ProjectArchive\.mjs'/)
    assert.doesNotMatch(controller, /from 'kicad-toolkit\/parser'/)
    assert.match(boardLoader, /from 'kicad-toolkit\/parser'/)
    assert.match(boardLoader, /from 'altium-toolkit\/parser'/)
    assert.match(boardLoader, /from '\.\/ProjectArchive\.mjs'/)
    assert.match(boardRenderer, /from '\.\/KicadPcbSvgRenderer\.mjs'/)
    assert.match(boardRenderer, /from '\.\/AltiumPcbSvgRenderer\.mjs'/)
    assert.match(altiumRenderer, /from 'altium-toolkit\/renderers'/)
    assert.match(altiumRenderer, /from '\.\/PcbSvgRendererDecorator\.mjs'/)
    assert.match(kicadRenderer, /from 'kicad-toolkit\/renderers'/)
    assert.match(kicadRenderer, /from 'kicad-toolkit\/parser'/)
    assert.match(kicadRenderer, /from '\.\/PcbSvgRendererDecorator\.mjs'/)
    assert.match(decorator, /from '\.\/RenderPalette\.mjs'/)
    assert.match(decorator, /from '\.\/BadgeRenderer\.mjs'/)
    assert.match(decorator, /from '\.\/ComponentHighlight\.mjs'/)
    assert.match(state, /from '\.\.\/ui\/BadgeStyle\.mjs'/)
    assert.match(state, /from '\.\.\/ui\/RenderPalette\.mjs'/)
    assert.match(view, /from '\.\/RenderPalette\.mjs'/)
    assert.match(badgeControls, /from '\.\/BadgeStyle\.mjs'/)
    assert.equal(await exists('src/ui/BadgeRenderer.mjs'), true)
    assert.equal(await exists('src/ui/BadgeStyle.mjs'), true)
    assert.equal(await exists('src/ui/ComponentHighlight.mjs'), true)
    assert.equal(await exists('src/ui/PcbSvgRendererDecorator.mjs'), true)
    assert.equal(await exists('src/ui/AltiumPcbSvgRenderer.mjs'), true)
    assert.equal(await exists('src/ui/KicadPcbSvgRenderer.mjs'), true)
    assert.equal(await exists('src/ui/RenderPalette.mjs'), true)
    assert.equal(await exists('src/core/ProjectArchive.mjs'), true)
    assert.equal(await exists('src/core/KicadPcbParser.mjs'), false)
    assert.equal(await exists('src/ui/PcbSvgRenderer.mjs'), false)
    assert.equal(await exists('tests/kicad-pcb-parser.test.mjs'), false)
    assert.equal(await exists('tests/pcb-svg-renderer.test.mjs'), false)
})

/**
 * Verifies the repository folder has the requested app slug.
 */
test('project folder is named pcb_styler_app', () => {
    assert.equal(basename(fileURLToPath(root)), 'pcb_styler_app')
})

/**
 * Verifies the topbar file picker labels supported board and project inputs.
 */
test('topbar open button names KiCad Altium and project files', async () => {
    const source = await readFile(new URL('src/index.html', root), 'utf8')

    assert.match(source, />\s*Open KiCad, Altium, or Project ZIP\s*</)
    assert.match(source, /accept="[^"]*\.PcbDoc/)
    assert.doesNotMatch(source, />\s*Open KiCad file\s*</)
})

/**
 * Verifies the project uses the PCB Styler product name.
 */
test('project uses the PCB Styler name', async () => {
    const pkg = JSON.parse(
        await readFile(new URL('package.json', root), 'utf8')
    )
    const indexSource = await readFile(new URL('src/index.html', root), 'utf8')
    const readme = await readFile(new URL('README.md', root), 'utf8')
    const spec = await readFile(
        new URL('spec/web-app-specification.md', root),
        'utf8'
    )
    const agents = await readFile(new URL('AGENTS.md', root), 'utf8')

    assert.equal(pkg.name, 'pcb-styler')
    assert.match(pkg.description, /PCB styler/i)
    assert.match(
        indexSource,
        /<title>PCB Styler - KiCad and Altium PCB Assembly Views<\/title>/
    )
    assert.match(indexSource, /<h1>PCB Styler<\/h1>/)
    assert.match(readme, /^# PCB Styler/m)
    assert.match(spec, /^# PCB Styler Specification/m)
    assert.match(agents, /Repository: `PCB Styler` web application\./)
    assert.doesNotMatch(indexSource, /PCB Marker/)
    assert.doesNotMatch(readme, /PCB Marker/)
    assert.doesNotMatch(spec, /PCB Marker/)
})

/**
 * Verifies the left sidebar no longer carries the board drop prompt.
 */
test('left sidebar omits the board drop zone', async () => {
    const source = await readFile(new URL('src/index.html', root), 'utf8')
    const leftPanel = extractHtmlBlock(source, '<aside class="side-panel">')

    assert.doesNotMatch(source, /id="dropZone"/)
    assert.doesNotMatch(leftPanel, /class="drop-zone"/)
    assert.doesNotMatch(leftPanel, />\s*Drop board file\s*</)
})

/**
 * Verifies the center canvas handles drag-and-drop board opening.
 */
test('center PCB canvas is the board drop target', async () => {
    const source = await readFile(new URL('src/ui/AppView.mjs', root), 'utf8')

    assert.doesNotMatch(source, /querySelector\('#dropZone'\)/)
    assert.match(source, /#canvasNode\?\.addEventListener\('dragover'/)
    assert.match(source, /#canvasNode\?\.addEventListener\('drop'/)
})

/**
 * Verifies the empty canvas advertises clickability.
 */
test('empty PCB canvas shows the click cursor', async () => {
    const styles = await readFile(
        new URL('src/styles/10-layout.css', root),
        'utf8'
    )

    assert.match(styles, /\.pcb-svg--empty\s*\{[^}]*cursor:\s*pointer;/s)
})

/**
 * Verifies transparency is exposed as a single slider control.
 */
test('layer transparency controls use only the range slider', async () => {
    const source = await readFile(new URL('src/ui/AppView.mjs', root), 'utf8')

    assert.match(source, /'fillOpacity',\s+'Transparency',\s+'range'/)
    assert.doesNotMatch(source, /'Transp\.'/)
    assert.doesNotMatch(source, /'fillTransparent'/)
    assert.doesNotMatch(source, /'Transparent'/)
})

/**
 * Verifies annotation tools and export controls live in the right sidebar.
 */
test('annotation and export controls render in a right sidebar', async () => {
    const source = await readFile(new URL('src/index.html', root), 'utf8')
    const badgeControls = await readFile(
        new URL('src/ui/BadgeControls.mjs', root),
        'utf8'
    )
    const viewSource = await readFile(
        new URL('src/ui/AppView.mjs', root),
        'utf8'
    )
    const styles = await readFile(
        new URL('src/styles/10-layout.css', root),
        'utf8'
    )
    const leftPanel = extractHtmlBlock(source, '<aside class="side-panel">')
    const rightPanel = extractHtmlBlock(source, 'class="action-panel"')

    assert.match(
        styles,
        /grid-template-columns:\s*minmax\(\s*260px,\s*320px\s*\)\s+minmax\(\s*0,\s*1fr\s*\)\s+minmax\(\s*260px,\s*320px\s*\)/
    )
    const hoveredIndex = rightPanel.indexOf('aria-label="Hovered component"')
    const projectZipIndex = rightPanel.indexOf('Project ZIP')
    const componentInfoStyles = extractCssBlock(styles, '.component-info')

    assert.doesNotMatch(leftPanel, /aria-label="Component highlights"/)
    assert.doesNotMatch(leftPanel, /aria-label="Badges"/)
    assert.doesNotMatch(leftPanel, /aria-label="Export"/)
    assert.notEqual(hoveredIndex, -1)
    assert.notEqual(projectZipIndex, -1)
    assert.ok(projectZipIndex < hoveredIndex)
    assert.match(rightPanel, /aria-label="Component highlights"/)
    assert.match(rightPanel, /aria-label="Hovered component"/)
    assert.match(rightPanel, /id="hoveredComponentInfo"/)
    assert.match(rightPanel, /aria-label="Badges"/)
    assert.match(rightPanel, /aria-label="Export"/)
    assert.match(viewSource, /#hoveredComponentInfoNode/)
    assert.match(viewSource, /#renderHoveredComponentInfo/)
    assert.match(viewSource, /createElement\('dt'\)/)
    assert.match(viewSource, /createElement\('dd'\)/)
    assert.match(componentInfoStyles, /border:\s*1px solid var\(--border\)/)
    assert.match(componentInfoStyles, /background:\s*var\(--surface-strong\)/)
    assert.match(componentInfoStyles, /border-radius:\s*var\(--radius\)/)
    assert.match(badgeControls, /data-badge-field'\)\s*!==\s*'rotation'/)
    assert.match(badgeControls, /Badge rotation/)
    assert.match(rightPanel, /id="exportProjectButton"/)
    assert.match(rightPanel, />\s*Project ZIP\s*</)
})

/**
 * Verifies file metadata appears below layer controls in the left sidebar.
 */
test('file metadata appears below layer controls', async () => {
    const source = await readFile(new URL('src/index.html', root), 'utf8')
    const leftPanel = extractHtmlBlock(source, '<aside class="side-panel">')
    const layersIndex = leftPanel.indexOf('aria-label="Layer styles"')
    const activeFileIndex = leftPanel.indexOf('Active file')
    const summaryIndex = leftPanel.indexOf('id="boardSummary"')

    assert.notEqual(layersIndex, -1)
    assert.notEqual(activeFileIndex, -1)
    assert.notEqual(summaryIndex, -1)
    assert.ok(layersIndex < activeFileIndex)
    assert.ok(activeFileIndex < summaryIndex)
})

/**
 * Verifies the page exposes an ecadforge-style imprint footer.
 */
test('app shell renders imprint footer with version binding', async () => {
    const source = await readFile(new URL('src/index.html', root), 'utf8')
    const mainSource = await readFile(new URL('src/main.mjs', root), 'utf8')
    const styles = await readFile(
        new URL('src/styles/10-layout.css', root),
        'utf8'
    )
    const viewSource = await readFile(
        new URL('src/ui/AppView.mjs', root),
        'utf8'
    )
    const footerStyles = extractCssBlock(styles, '.page-footer')
    const footerCardStyles = extractCssBlock(styles, '.footer-card')

    assert.match(source, /<footer class="page-footer"/)
    assert.match(source, /class="footer-card"/)
    assert.match(source, />\s*Imprint\s*</)
    assert.match(source, /Responsible for this website/)
    assert.match(source, /Andr(?:é|&eacute;) Fiedler/)
    assert.match(source, /R(?:ä|&auml;)delstra(?:ß|&szlig;)e 7/)
    assert.match(source, /href="mailto:mail@andrefiedler\.de"/)
    assert.match(source, /id="footerAppVersion"/)
    assert.match(source, /data-app-version/)
    assert.doesNotMatch(source, /id="appVersion"/)
    assert.doesNotMatch(source, /class="version-pill"/)
    assert.equal(source.match(/data-app-version/g)?.length, 1)
    assert.match(source, /https:\/\/github\.com\/SunboX/)
    assert.match(source, /https:\/\/mastodon\.social\/@sonnenkiste/)
    assert.match(viewSource, /querySelectorAll\('\[data-app-version\]'\)/)
    assert.match(mainSource, /\/api\/app-meta/)
    assert.match(mainSource, /\/api\/app-meta\.php/)
    assert.match(footerStyles, /background:\s*var\(--surface\)/)
    assert.doesNotMatch(footerStyles, /background:\s*var\(--page\)/)
    assert.doesNotMatch(footerCardStyles, /linear-gradient/)
    assert.doesNotMatch(footerCardStyles, /border-radius/)
    assert.doesNotMatch(footerCardStyles, /border:\s*1px/)
})

/**
 * Verifies early WebMCP integration is wired at bootstrap.
 */
test('app registers early WebMCP tools at bootstrap', async () => {
    const mainSource = await readFile(new URL('src/main.mjs', root), 'utf8')
    const bridgeSource = await readFile(
        new URL('src/integrations/WebMcpBridge.mjs', root),
        'utf8'
    )
    const specSource = await readFile(
        new URL('spec/web-app-specification.md', root),
        'utf8'
    )

    assert.match(mainSource, /WebMcpBridge/)
    assert.match(mainSource, /register\(\)/)
    assert.match(bridgeSource, /navigator\.modelContext/)
    assert.match(bridgeSource, /registerTool/)
    assert.match(bridgeSource, /pcb_styler_get_state/)
    assert.match(bridgeSource, /pcb_styler_export_png/)
    assert.match(specSource, /WebMCP/)
    assert.match(specSource, /transparent PNG/)
})

/**
 * Extracts a top-level aside block starting at a known marker.
 * @param {string} source
 * @param {string} marker
 * @returns {string}
 */
function extractHtmlBlock(source, marker) {
    const start = source.indexOf(marker)
    assert.notEqual(start, -1, 'Missing marker: ' + marker)

    const close = source.indexOf('</aside>', start)
    assert.notEqual(close, -1, 'Missing aside close for: ' + marker)

    return source.slice(start, close + '</aside>'.length)
}

/**
 * Extracts one simple CSS rule block for structure assertions.
 * @param {string} source
 * @param {string} selector
 * @returns {string}
 */
function extractCssBlock(source, selector) {
    const start = source.indexOf(selector + ' {')
    assert.notEqual(start, -1, 'Missing CSS selector: ' + selector)

    const open = source.indexOf('{', start)
    const close = source.indexOf('}', open)
    assert.notEqual(close, -1, 'Missing CSS close for: ' + selector)

    return source.slice(start, close + 2)
}
