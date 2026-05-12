// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict'
import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import { constants } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const rootUrl = new URL('../', import.meta.url)
const rootPath = fileURLToPath(rootUrl)
const builderUrl = new URL('../src/StaticDeployBuilder.mjs', import.meta.url)

/**
 * Checks whether a repository file exists.
 * @param {URL} fileUrl
 * @returns {Promise<boolean>}
 */
async function exists(fileUrl) {
    try {
        await access(fileUrl, constants.F_OK)
        return true
    } catch {
        return false
    }
}

/**
 * Imports a fresh copy of the static deploy builder.
 * @returns {Promise<typeof import('../src/StaticDeployBuilder.mjs')>}
 */
async function importStaticDeployBuilder() {
    return import(builderUrl.href + '?test=' + Date.now())
}

/**
 * Verifies the static deploy builder emits a cache-busted browser artifact
 * that can run on Apache/shared-hosting without the local Node server.
 */
test('static deploy builder writes versioned Apache assets', async (t) => {
    assert.equal(
        await exists(builderUrl),
        true,
        'Missing src/StaticDeployBuilder.mjs'
    )

    const packageRaw = await readFile(
        new URL('../package.json', import.meta.url)
    )
    const pkg = JSON.parse(packageRaw)
    const outputRoot = await mkdtemp(
        path.join(tmpdir(), 'pcb-styler-static-deploy-')
    )
    const { StaticDeployBuilder } = await importStaticDeployBuilder()

    t.after(async () => {
        await rm(outputRoot, { force: true, recursive: true })
    })

    await StaticDeployBuilder.build({
        projectRoot: rootPath,
        sourceRoot: path.join(rootPath, 'src'),
        outputRoot
    })

    const indexHtml = await readFile(
        path.join(outputRoot, 'index.html'),
        'utf8'
    )
    const mainSource = await readFile(path.join(outputRoot, 'main.mjs'), 'utf8')
    const controllerSource = await readFile(
        path.join(outputRoot, 'AppController.mjs'),
        'utf8'
    )
    const htaccessSource = await readFile(
        path.join(outputRoot, '.htaccess'),
        'utf8'
    )
    const robotsSource = await readFile(
        path.join(outputRoot, 'robots.txt'),
        'utf8'
    )
    const sitemapSource = await readFile(
        path.join(outputRoot, 'sitemap.xml'),
        'utf8'
    )

    assert.match(indexHtml, new RegExp('/style\\.css\\?v=' + pkg.version))
    assert.match(indexHtml, new RegExp('/main\\.mjs\\?v=' + pkg.version))
    assert.match(
        mainSource,
        new RegExp('\\./AppController\\.mjs\\?v=' + pkg.version)
    )
    assert.doesNotMatch(controllerSource, /from ['"]@sunbox\/kicad-toolkit/)
    assert.match(
        controllerSource,
        new RegExp('\\./core/ProjectArchive\\.mjs\\?v=' + pkg.version)
    )
    const boardLoaderSource = await readFile(
        path.join(outputRoot, 'core', 'BoardFileLoader.mjs'),
        'utf8'
    )
    const boardRendererSource = await readFile(
        path.join(outputRoot, 'ui', 'BoardSvgRenderer.mjs'),
        'utf8'
    )
    const altiumRendererSource = await readFile(
        path.join(outputRoot, 'ui', 'AltiumPcbSvgRenderer.mjs'),
        'utf8'
    )
    const altiumParserSource = await readFile(
        path.join(
            outputRoot,
            'node_modules',
            'altium-toolkit',
            'src',
            'parser.mjs'
        ),
        'utf8'
    )
    const kicadParserSource = await readFile(
        path.join(
            outputRoot,
            'node_modules',
            'kicad-toolkit',
            'src',
            'parser.mjs'
        ),
        'utf8'
    )
    const fflateBrowserSource = await readFile(
        path.join(outputRoot, 'node_modules', 'fflate', 'esm', 'browser.js'),
        'utf8'
    )
    const kicadRendererSource = await readFile(
        path.join(outputRoot, 'ui', 'KicadPcbSvgRenderer.mjs'),
        'utf8'
    )
    const decoratorSource = await readFile(
        path.join(outputRoot, 'ui', 'PcbSvgRendererDecorator.mjs'),
        'utf8'
    )

    assert.doesNotMatch(boardLoaderSource, /from ['"]kicad-toolkit\/parser['"]/)
    assert.doesNotMatch(
        boardRendererSource,
        /from ['"]kicad-toolkit\/renderers['"]/
    )
    assert.doesNotMatch(
        kicadRendererSource,
        /from ['"]kicad-toolkit\/(?:parser|renderers)['"]/
    )
    assert.doesNotMatch(
        boardLoaderSource,
        /from ['"]altium-toolkit\/parser['"]/
    )
    assert.doesNotMatch(
        boardRendererSource,
        /from ['"]altium-toolkit\/renderers['"]/
    )
    assert.doesNotMatch(
        altiumRendererSource,
        /from ['"]altium-toolkit\/renderers['"]/
    )
    assert.match(
        boardLoaderSource,
        new RegExp(
            '/node_modules/kicad-toolkit/src/parser\\.mjs\\?v=' + pkg.version
        )
    )
    assert.match(
        kicadRendererSource,
        new RegExp(
            '/node_modules/kicad-toolkit/src/renderers\\.mjs\\?v=' + pkg.version
        )
    )
    assert.match(
        kicadRendererSource,
        new RegExp(
            '/node_modules/kicad-toolkit/src/parser\\.mjs\\?v=' + pkg.version
        )
    )
    assert.match(
        boardLoaderSource,
        new RegExp(
            '/node_modules/altium-toolkit/src/parser\\.mjs\\?v=' + pkg.version
        )
    )
    assert.match(
        altiumRendererSource,
        new RegExp(
            '/node_modules/altium-toolkit/src/renderers\\.mjs\\?v=' +
                pkg.version
        )
    )
    assert.match(
        altiumParserSource,
        new RegExp('\\./core/altium/AltiumParser\\.mjs\\?v=' + pkg.version)
    )
    assert.match(
        kicadParserSource,
        new RegExp('\\./core/kicad/Geometry\\.mjs\\?v=' + pkg.version)
    )
    assert.match(fflateBrowserSource, /function/)
    assert.match(
        decoratorSource,
        new RegExp('\\./RenderPalette\\.mjs\\?v=' + pkg.version)
    )
    assert.match(
        decoratorSource,
        new RegExp('\\./BadgeRenderer\\.mjs\\?v=' + pkg.version)
    )
    assert.match(
        decoratorSource,
        new RegExp('\\./ComponentHighlight\\.mjs\\?v=' + pkg.version)
    )
    assert.match(htaccessSource, /Cache-Control/)
    assert.match(htaccessSource, /no-store/)
    assert.match(robotsSource, /^Allow: \/$/m)
    assert.match(
        robotsSource,
        /^Sitemap: https:\/\/pcb-styler\.app\/sitemap\.xml$/m
    )
    assert.match(sitemapSource, /<loc>https:\/\/pcb-styler\.app\/<\/loc>/)
})
