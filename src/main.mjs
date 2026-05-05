// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: AGPL-3.0-or-later

import { AppController } from './AppController.mjs'
import { AppState } from './core/AppState.mjs'
import { WebMcpBridge } from './integrations/WebMcpBridge.mjs'
import { AppView } from './ui/AppView.mjs'

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
 * Loads the app version and updates the header.
 * @param {import('./ui/AppView.mjs').AppView} view
 */
async function loadVersion(view) {
    try {
        const response = await fetch('/api/app-meta', { cache: 'no-store' })
        if (!response.ok) {
            view.setVersion('')
            return
        }

        const payload = await response.json()
        view.setVersion(String(payload.version || '').trim())
    } catch (_error) {
        view.setVersion('')
    }
}

bootstrap().catch((error) => {
    console.error('App bootstrap failed:', error)
})
