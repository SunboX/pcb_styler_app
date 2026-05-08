// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: AGPL-3.0-or-later

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createLocalAssetApp } from './LocalAssetServer.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.join(__dirname, '..')
const staticRoot = path.join(projectRoot, 'src')
const vendorRoot = path.join(projectRoot, 'node_modules')
const port = parsePort(process.env.PORT)

const app = createLocalAssetApp({
    projectRoot,
    staticRoot,
    vendorRoot
})

app.listen(port, () => {
    console.log('Server listening on http://localhost:' + port)
})

/**
 * Parses a valid TCP port.
 * @param {string | undefined} rawPort
 * @returns {number}
 */
function parsePort(rawPort) {
    const parsed = Number.parseInt(String(rawPort || ''), 10)
    if (Number.isInteger(parsed) && parsed > 0 && parsed <= 65535) {
        return parsed
    }
    return 3001
}
