// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: AGPL-3.0-or-later

const browserBareSpecifierMap = Object.freeze({
    'kicad-toolkit': '/node_modules/kicad-toolkit/src/index.mjs',
    'kicad-toolkit/parser': '/node_modules/kicad-toolkit/src/parser.mjs',
    'kicad-toolkit/renderers': '/node_modules/kicad-toolkit/src/renderers.mjs',
    'altium-toolkit/parser': '/node_modules/altium-toolkit/src/parser.mjs',
    'altium-toolkit/renderers':
        '/node_modules/altium-toolkit/src/renderers.mjs',
    fflate: '/node_modules/fflate/esm/browser.js'
})

/**
 * Rewrites served frontend assets so browser caches track the current app
 * version across full ESM import graphs.
 */
export class ServerAssetVersioner {
    /**
     * Appends or replaces one `v` query parameter on a local asset path.
     * @param {string} assetPath
     * @param {string} versionKey
     * @returns {string}
     */
    static appendVersionQuery(assetPath, versionKey) {
        const [pathAndQuery, hash = ''] = String(assetPath || '').split('#')
        const [pathName, query = ''] = pathAndQuery.split('?')
        const searchParams = new URLSearchParams(query)

        searchParams.set('v', String(versionKey || '0'))

        return (
            pathName + '?' + searchParams.toString() + (hash ? '#' + hash : '')
        )
    }

    /**
     * Rewrites relative JavaScript specifiers in browser ESM source so the
     * current asset version propagates through transitive local import graphs.
     * @param {string} source
     * @param {string} versionKey
     * @returns {string}
     */
    static rewriteRelativeJavaScriptSpecifiers(source, versionKey) {
        const patterns = [
            /(from\s+['"])(\.{1,2}\/[^'"]+\.(?:mjs|js)(?:\?[^'"]*)?)(['"])/g,
            /(import\s+['"])(\.{1,2}\/[^'"]+\.(?:mjs|js)(?:\?[^'"]*)?)(['"])/g,
            /(import\s*\(\s*['"])(\.{1,2}\/[^'"]+\.(?:mjs|js)(?:\?[^'"]*)?)(['"]\s*\))/g,
            /(new URL\(\s*['"])(\.{1,2}\/[^'"]+\.(?:mjs|js)(?:\?[^'"]*)?)(['"]\s*,\s*import\.meta\.url\s*\))/g
        ]

        return patterns.reduce(
            (rewrittenSource, pattern) =>
                rewrittenSource.replace(
                    pattern,
                    (_match, prefix, specifier, suffix) =>
                        prefix +
                        ServerAssetVersioner.appendVersionQuery(
                            specifier,
                            versionKey
                        ) +
                        suffix
                ),
            String(source || '')
        )
    }

    /**
     * Resolves one known bare browser dependency to its deployed asset path.
     * @param {string} specifier
     * @returns {string}
     */
    static resolveBrowserBareSpecifier(specifier) {
        const normalizedSpecifier = String(specifier || '')

        return browserBareSpecifierMap[normalizedSpecifier] || ''
    }

    /**
     * Lists package roots referenced by browser bare-specifier rewrites.
     * @returns {string[]}
     */
    static listBrowserDependencyPackages() {
        const packageNames = Object.values(browserBareSpecifierMap)
            .map((assetPath) =>
                ServerAssetVersioner.#extractNodeModulePackageName(assetPath)
            )
            .filter(Boolean)

        return Array.from(new Set(packageNames)).sort()
    }

    /**
     * Rewrites known bare dependency specifiers for browser contexts that
     * cannot rely on Node package resolution.
     * @param {string} source
     * @param {string} versionKey
     * @returns {string}
     */
    static rewriteBareJavaScriptSpecifiers(source, versionKey) {
        const specifierPattern =
            '(kicad-toolkit(?:\\/(?:parser|renderers))?|altium-toolkit\\/(?:parser|renderers)|fflate)'
        const patterns = [
            new RegExp('(from\\s+[\'"])' + specifierPattern + '([\'"])', 'g'),
            new RegExp('(import\\s+[\'"])' + specifierPattern + '([\'"])', 'g'),
            new RegExp(
                '(import\\s*\\(\\s*[\'"])' +
                    specifierPattern +
                    '([\'"]\\s*\\))',
                'g'
            )
        ]

        return patterns.reduce(
            (rewrittenSource, pattern) =>
                rewrittenSource.replace(
                    pattern,
                    (_match, prefix, specifier, suffix) => {
                        const assetPath =
                            ServerAssetVersioner.resolveBrowserBareSpecifier(
                                specifier
                            )
                        if (!assetPath) {
                            return _match
                        }

                        return (
                            prefix +
                            ServerAssetVersioner.appendVersionQuery(
                                assetPath,
                                versionKey
                            ) +
                            suffix
                        )
                    }
                ),
            String(source || '')
        )
    }

    /**
     * Rewrites the static HTML shell to request versioned CSS and JS assets.
     * @param {string} source
     * @param {string} versionKey
     * @returns {string}
     */
    static rewriteHtmlDocument(source, versionKey) {
        return String(source || '')
            .replace(
                /href="\/style\.css(?:\?[^"]*)?"/g,
                'href="' +
                    ServerAssetVersioner.appendVersionQuery(
                        '/style.css',
                        versionKey
                    ) +
                    '"'
            )
            .replace(
                /src="\/main\.mjs(?:\?[^"]*)?"/g,
                'src="' +
                    ServerAssetVersioner.appendVersionQuery(
                        '/main.mjs',
                        versionKey
                    ) +
                    '"'
            )
    }

    /**
     * Rewrites local ESM import specifiers and bare package imports to the
     * same version key so deployed browser module caches cannot drift.
     * @param {string} source
     * @param {string} versionKey
     * @returns {string}
     */
    static rewriteJavaScriptModule(source, versionKey) {
        const rewrittenSource =
            ServerAssetVersioner.rewriteRelativeJavaScriptSpecifiers(
                source,
                versionKey
            )

        return ServerAssetVersioner.rewriteBareJavaScriptSpecifiers(
            rewrittenSource,
            versionKey
        )
    }

    /**
     * Extracts the npm package name from a `/node_modules/...` asset path.
     * @param {string} assetPath
     * @returns {string}
     */
    static #extractNodeModulePackageName(assetPath) {
        const match = String(assetPath || '').match(
            /^\/node_modules\/((?:@[^/]+\/)?[^/]+)/u
        )

        return match?.[1] || ''
    }
}
