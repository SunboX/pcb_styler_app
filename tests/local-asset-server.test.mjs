// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createLocalAssetApp } from '../src/LocalAssetServer.mjs'

const rootPath = fileURLToPath(new URL('../', import.meta.url))

test('local asset server serves versioned browser module graph', async (t) => {
    const packageRaw = await readFile(
        new URL('../package.json', import.meta.url)
    )
    const pkg = JSON.parse(packageRaw)
    const app = createLocalAssetApp({
        projectRoot: rootPath,
        staticRoot: path.join(rootPath, 'src'),
        vendorRoot: path.join(rootPath, 'node_modules')
    })
    const server = createServer(app)

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    t.after(() => new Promise((resolve) => server.close(resolve)))

    const address = server.address()
    const baseUrl = `http://127.0.0.1:${address.port}`
    const indexResponse = await fetch(baseUrl + '/')
    const indexHtml = await indexResponse.text()

    assert.match(indexResponse.headers.get('cache-control') || '', /no-store/)
    assert.equal(indexResponse.status, 200)
    assert.match(indexHtml, new RegExp('/style\\.css\\?v=' + pkg.version))
    assert.match(indexHtml, new RegExp('/main\\.mjs\\?v=' + pkg.version))

    const indexHtmlResponse = await fetch(baseUrl + '/index.html')

    assert.equal(indexHtmlResponse.status, 200)

    const robotsResponse = await fetch(baseUrl + '/robots.txt')
    const robotsSource = await robotsResponse.text()

    assert.equal(robotsResponse.status, 200)
    assert.match(robotsSource, /^Allow: \/$/m)
    assert.match(
        robotsSource,
        /^Sitemap: https:\/\/pcb-styler\.app\/sitemap\.xml$/m
    )

    const sitemapResponse = await fetch(baseUrl + '/sitemap.xml')
    const sitemapSource = await sitemapResponse.text()

    assert.equal(sitemapResponse.status, 200)
    assert.match(sitemapSource, /<loc>https:\/\/pcb-styler\.app\/<\/loc>/)

    const mainResponse = await fetch(baseUrl + '/main.mjs?v=' + pkg.version)
    const mainSource = await mainResponse.text()

    assert.match(mainResponse.headers.get('cache-control') || '', /no-store/)
    assert.match(
        mainSource,
        new RegExp('\\./AppController\\.mjs\\?v=' + pkg.version)
    )

    const altiumResponse = await fetch(
        baseUrl + '/ui/AltiumPcbSvgRenderer.mjs?v=' + pkg.version
    )
    const altiumSource = await altiumResponse.text()

    assert.match(
        altiumSource,
        new RegExp(
            '/node_modules/altium-toolkit/src/renderers\\.mjs\\?v=' +
                pkg.version
        )
    )

    const altiumParserResponse = await fetch(
        baseUrl + '/node_modules/altium-toolkit/src/parser.mjs?v=' + pkg.version
    )
    const altiumParserSource = await altiumParserResponse.text()

    assert.equal(altiumParserResponse.status, 200)
    assert.match(
        altiumParserResponse.headers.get('cache-control') || '',
        /no-store/
    )
    assert.match(
        altiumParserSource,
        new RegExp('\\./core/altium/AltiumParser\\.mjs\\?v=' + pkg.version)
    )

    const kicadParserResponse = await fetch(
        baseUrl + '/node_modules/kicad-toolkit/src/parser.mjs?v=' + pkg.version
    )
    const kicadParserSource = await kicadParserResponse.text()

    assert.equal(kicadParserResponse.status, 200)
    assert.match(
        kicadParserResponse.headers.get('cache-control') || '',
        /no-store/
    )
    assert.match(
        kicadParserSource,
        new RegExp('\\./core/kicad/Geometry\\.mjs\\?v=' + pkg.version)
    )
})
