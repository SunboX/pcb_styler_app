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

    assert.match(indexHtml, new RegExp('/style\\.css\\?v=' + pkg.version))
    assert.match(indexHtml, new RegExp('/main\\.mjs\\?v=' + pkg.version))
    assert.match(
        mainSource,
        new RegExp('\\./AppController\\.mjs\\?v=' + pkg.version)
    )
    assert.doesNotMatch(controllerSource, /from ['"]@sunbox\/kicad-toolkit['"]/)
    assert.match(
        controllerSource,
        new RegExp(
            '/node_modules/@sunbox/kicad-toolkit/src/index\\.mjs\\?v=' +
                pkg.version
        )
    )
    assert.match(htaccessSource, /Cache-Control/)
    assert.match(htaccessSource, /no-store/)
})
