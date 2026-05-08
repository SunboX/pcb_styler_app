// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: AGPL-3.0-or-later

import express from 'express'
import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { ServerAssetVersioner } from './ServerAssetVersioner.mjs'

const noStoreCacheControl = 'no-store, no-cache, must-revalidate, max-age=0'

/**
 * Creates the local development HTTP app.
 * @param {{ projectRoot: string, staticRoot: string, vendorRoot: string }} options
 * @returns {import('express').Express}
 */
export function createLocalAssetApp(options) {
    const projectRoot = path.resolve(String(options?.projectRoot || ''))
    const staticRoot = path.resolve(String(options?.staticRoot || ''))
    const vendorRoot = path.resolve(String(options?.vendorRoot || ''))
    const app = express()

    app.use(express.json({ limit: '1mb' }))
    app.get(['/', '/index.html'], (_req, res, next) =>
        serveVersionedIndex(projectRoot, staticRoot, res, next)
    )
    app.get(/.*\.(?:mjs|js)$/u, async (req, res, next) => {
        try {
            const modulePath = resolveBrowserModulePath(
                staticRoot,
                vendorRoot,
                req.path
            )
            if (!modulePath) {
                res.status(404).send('Not Found')
                return
            }

            const version = await readAppVersion(projectRoot)
            const source = await readFile(modulePath, 'utf8')
            sendNoStore(
                res,
                'application/javascript',
                ServerAssetVersioner.rewriteJavaScriptModule(source, version)
            )
        } catch (error) {
            if (error.code === 'ENOENT') {
                res.status(404).send('Not Found')
                return
            }
            next(error)
        }
    })
    app.use('/node_modules', setNoStoreHeader, express.static(vendorRoot))
    app.use(setNoStoreHeader, express.static(staticRoot, { extensions: [] }))

    app.get('/api/health', (_req, res) => {
        res.json({ status: 'ok' })
    })

    app.get(['/api/app-meta', '/api/app-meta.php'], async (_req, res) => {
        const version = await readAppVersion(projectRoot)
        setNoStoreHeader(_req, res, () => {})
        res.json({ version })
    })

    app.use((req, res, next) => {
        const hasFileExtension = /.[a-z0-9]+$/i.test(req.path)
        if (hasFileExtension) {
            res.status(404).send('Not Found')
            return
        }
        serveVersionedIndex(projectRoot, staticRoot, res, next)
    })

    return app
}

/**
 * Serves the browser shell with versioned asset URLs.
 * @param {string} projectRoot
 * @param {string} staticRoot
 * @param {object} res
 * @param {(error?: unknown) => void} next
 * @returns {Promise<void>}
 */
async function serveVersionedIndex(projectRoot, staticRoot, res, next) {
    try {
        const version = await readAppVersion(projectRoot)
        const source = await readFile(
            path.join(staticRoot, 'index.html'),
            'utf8'
        )
        sendNoStore(
            res,
            'html',
            ServerAssetVersioner.rewriteHtmlDocument(source, version)
        )
    } catch (error) {
        next(error)
    }
}

/**
 * Reads app version from known metadata files.
 * @param {string} root
 * @returns {Promise<string>}
 */
export async function readAppVersion(root) {
    const files = [
        path.join(root, 'package.json'),
        path.join(root, 'api', 'app-version.json')
    ]

    for (const filePath of files) {
        try {
            const raw = await readFile(filePath, 'utf8')
            const parsed = JSON.parse(raw)
            const version = String(parsed?.version || '').trim()
            if (version) return version
        } catch (_error) {
            // Ignore missing or malformed metadata files.
        }
    }

    return ''
}

/**
 * Sets no-store cache headers.
 * @param {object} _req
 * @param {object} res
 * @param {() => void} next
 * @returns {void}
 */
function setNoStoreHeader(_req, res, next) {
    res.setHeader('Cache-Control', noStoreCacheControl)
    next()
}

/**
 * Sends a no-store response body.
 * @param {object} res
 * @param {string} type
 * @param {string} body
 * @returns {void}
 */
function sendNoStore(res, type, body) {
    res.setHeader('Cache-Control', noStoreCacheControl)
    res.type(type).send(body)
}

/**
 * Resolves a browser JavaScript request inside app or vendor roots.
 * @param {string} staticRoot
 * @param {string} vendorRoot
 * @param {string} requestPath
 * @returns {string | null}
 */
function resolveBrowserModulePath(staticRoot, vendorRoot, requestPath) {
    const relativePath = normalizeRequestPath(requestPath)
    const nodeModulesPrefix = 'node_modules/'

    if (relativePath.startsWith(nodeModulesPrefix)) {
        return resolveInsideRoot(
            vendorRoot,
            relativePath.slice(nodeModulesPrefix.length)
        )
    }

    return resolveInsideRoot(staticRoot, relativePath)
}

/**
 * Normalizes an HTTP request path to a relative filesystem path.
 * @param {string} requestPath
 * @returns {string}
 */
function normalizeRequestPath(requestPath) {
    return path.normalize(String(requestPath || '')).replace(/^\/+/u, '')
}

/**
 * Resolves a relative path inside one filesystem root.
 * @param {string} root
 * @param {string} relativePath
 * @returns {string | null}
 */
function resolveInsideRoot(root, relativePath) {
    const rootPath = path.resolve(String(root || ''))
    const normalizedRelativePath = path
        .normalize(String(relativePath || ''))
        .replace(/^[/\\]+/u, '')
    const filePath = path.resolve(rootPath, normalizedRelativePath)

    return filePath.startsWith(rootPath + path.sep) ? filePath : null
}
