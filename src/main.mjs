// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: AGPL-3.0-or-later

import { AppController } from './AppController.mjs'
import { AppState } from './core/AppState.mjs'
import { WebMcpBridge } from './integrations/WebMcpBridge.mjs'
import { AppView } from './ui/AppView.mjs'

const versionEndpointPaths = ['/api/app-meta', '/api/app-meta.php']

/**
 * App bootstrap.
 */
async function bootstrap() {
    const state = new AppState()
    const view = new AppView(document)
    const controller = new AppController({ state, view })
    const webMcp = new WebMcpBridge({ controller })

    await controller.init()
    webMcp.register()
    await loadVersion(view)
}

/**
 * Loads the app version and updates visible version nodes.
 * @param {import('./ui/AppView.mjs').AppView} view
 * @returns {Promise<void>}
 */
async function loadVersion(view) {
    for (const endpointPath of versionEndpointPaths) {
        const version = await fetchVersion(endpointPath)
        if (version) {
            view.setVersion(version)
            return
        }
    }

    view.setVersion('')
}

/**
 * Fetches app metadata from one endpoint.
 * @param {string} endpointPath
 * @returns {Promise<string>}
 */
async function fetchVersion(endpointPath) {
    try {
        const response = await fetch(endpointPath, { cache: 'no-store' })
        if (!response.ok) {
            return ''
        }

        const payload = await response.json()
        return String(payload.version || '').trim()
    } catch (_error) {
        return ''
    }
}

bootstrap().catch((error) => {
    console.error('App bootstrap failed:', error)
})
