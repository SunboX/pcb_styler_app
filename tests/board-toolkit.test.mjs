// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict'
import test from 'node:test'
import { strFromU8, strToU8, zipSync } from 'fflate'
import { BoardFileLoader } from '../src/core/BoardFileLoader.mjs'
import { BoardSvgRenderer } from '../src/ui/BoardSvgRenderer.mjs'

test('BoardFileLoader parses direct Altium PcbDoc files', async () => {
    const board = createAltiumBoard('amplifier.PcbDoc')
    const altiumParser = {
        parseArrayBuffer(fileName, arrayBuffer) {
            assert.equal(fileName, 'amplifier.PcbDoc')
            assert.ok(arrayBuffer instanceof ArrayBuffer)
            assert.deepEqual([...new Uint8Array(arrayBuffer)], [1, 2, 3])
            return board
        }
    }
    const loader = new BoardFileLoader({
        altiumParser,
        kicadLoader: createUnusedKicadLoader()
    })

    const result = await loader.loadFiles([
        new FakeFile('amplifier.PcbDoc', new Uint8Array([1, 2, 3]))
    ])

    assert.equal(result.board, board)
    assert.equal(result.sourceFileName, 'amplifier.PcbDoc')
    assert.equal(result.sourceText, '')
    assert.equal(result.projectSettings, null)
    assert.equal(result.sourceFormat, 'altium')
})

test('BoardFileLoader finds Altium PcbDoc files inside zip archives', async () => {
    const board = createAltiumBoard('project/main-board.PcbDoc')
    const archive = zipSync({
        '__MACOSX/._main-board.PcbDoc': new Uint8Array([0]),
        'project/main-board.PcbDoc': new Uint8Array([4, 5, 6])
    })
    const altiumParser = {
        parseArrayBuffer(fileName, arrayBuffer) {
            assert.equal(fileName, 'project/main-board.PcbDoc')
            assert.deepEqual([...new Uint8Array(arrayBuffer)], [4, 5, 6])
            return board
        }
    }
    const loader = new BoardFileLoader({
        altiumParser,
        kicadLoader: {
            findBoardEntry() {
                return null
            },
            loadEntries() {
                throw new Error('KiCad loader should not handle Altium zips.')
            }
        }
    })

    const result = await loader.loadFiles([
        new FakeFile('project.zip', archive)
    ])

    assert.equal(result.board, board)
    assert.equal(result.sourceFileName, 'project/main-board.PcbDoc')
    assert.equal(result.sourceFormat, 'altium')
})

test('BoardFileLoader keeps KiCad files on the KiCad loader path', async () => {
    const board = { title: 'KiCad Board' }
    const kicadLoader = {
        findBoardEntry(entries) {
            return entries.find((entry) => /\.kicad_pcb$/i.test(entry.name))
        },
        loadEntries(entries) {
            assert.deepEqual(
                entries.map((entry) => entry.name),
                ['minimal.kicad_pcb']
            )
            return {
                board,
                sourceFileName: 'minimal.kicad_pcb',
                sourceText: '(kicad_pcb)',
                projectSettings: null
            }
        }
    }
    const loader = new BoardFileLoader({
        altiumParser: createUnusedAltiumParser(),
        kicadLoader
    })

    const result = await loader.loadFiles([
        new FakeFile('minimal.kicad_pcb', new Uint8Array([40, 41]))
    ])

    assert.equal(result.board, board)
    assert.equal(result.sourceFileName, 'minimal.kicad_pcb')
    assert.equal(result.sourceText, '(kicad_pcb)')
    assert.equal(result.sourceFormat, 'kicad')
})

test('BoardFileLoader loads full KiCad project zip results from the changed toolkit API', async () => {
    const source = createKicadBoardSource()
    const archive = createKicadFullProjectArchive(source)
    const loader = new BoardFileLoader({
        altiumParser: createUnusedAltiumParser()
    })

    const result = await loader.loadFiles([
        new FakeFile('demo-project.zip', archive)
    ])

    assert.equal(result.board.title, 'Demo Board')
    assert.equal(result.sourceFileName, 'demo/demo.kicad_pcb')
    assert.equal(result.sourceText, source)
    assert.deepEqual([...result.sourceBytes], [...strToU8(source)])
    assert.equal(result.sourceFormat, 'kicad')
})

test('BoardFileLoader restores PCB Styler project settings in the app', async () => {
    const board = { title: 'KiCad Project Board' }
    const source = '(kicad_pcb)'
    const archive = zipSync({
        'settings.json': strToU8(
            JSON.stringify({
                format: 'pcb-styler-project',
                formatVersion: 1,
                pcbFileName: 'boards/minimal.kicad_pcb',
                settings: {
                    side: 'back',
                    highlightColor: '#ff4422',
                    highlightedFootprints: ['footprint:U1:0']
                }
            })
        ),
        'boards/minimal.kicad_pcb': strToU8(source)
    })
    const kicadLoader = {
        findBoardEntry() {
            return null
        },
        loadEntries(entries) {
            assert.deepEqual(
                entries.map((entry) => entry.name),
                ['boards/minimal.kicad_pcb']
            )
            return {
                board,
                sourceFileName: entries[0].name,
                sourceText: strFromU8(entries[0].bytes)
            }
        }
    }
    const loader = new BoardFileLoader({
        altiumParser: createUnusedAltiumParser(),
        kicadLoader
    })

    const result = await loader.loadFiles([
        new FakeFile('minimal-project.zip', archive)
    ])

    assert.equal(result.board, board)
    assert.equal(result.sourceFileName, 'boards/minimal.kicad_pcb')
    assert.equal(result.sourceText, source)
    assert.equal(result.sourceFormat, 'kicad')
    assert.deepEqual(result.projectSettings, {
        side: 'back',
        highlightColor: '#ff4422',
        highlightedFootprints: ['footprint:U1:0']
    })
})

test('BoardSvgRenderer routes Altium and KiCad models to their renderers', () => {
    const altiumBoard = createAltiumBoard('amp.PcbDoc')
    const kicadBoard = { title: 'KiCad Board', footprints: [] }
    const kicadRenderer = {
        render(board, options) {
            assert.equal(board, kicadBoard)
            assert.equal(options.side, 'back')
            return '<svg data-format="kicad"></svg>'
        }
    }
    const altiumRenderer = {
        render(board, options) {
            assert.equal(board, altiumBoard)
            assert.equal(options.side, 'front')
            return '<section class="svg-panel">Altium</section>'
        }
    }
    const renderer = new BoardSvgRenderer({ kicadRenderer, altiumRenderer })

    assert.equal(
        renderer.render(altiumBoard, { side: 'front' }),
        '<section class="svg-panel">Altium</section>'
    )
    assert.equal(
        renderer.render(kicadBoard, { side: 'back' }),
        '<svg data-format="kicad"></svg>'
    )
})

test('BoardFileLoader restores PCB Styler project settings for Altium archives', async () => {
    const board = createAltiumBoard('boards/amplifier.PcbDoc')
    const archive = zipSync({
        'settings.json': strToU8(
            JSON.stringify({
                format: 'pcb-styler-project',
                formatVersion: 1,
                pcbFileName: 'boards/amplifier.PcbDoc',
                sourceFormat: 'altium',
                settings: {
                    side: 'front',
                    highlightColor: '#33aa99',
                    highlightedFootprints: ['altium:U1']
                }
            })
        ),
        'boards/amplifier.PcbDoc': new Uint8Array([8, 9, 10])
    })
    const altiumParser = {
        parseArrayBuffer(fileName, arrayBuffer) {
            assert.equal(fileName, 'boards/amplifier.PcbDoc')
            assert.deepEqual([...new Uint8Array(arrayBuffer)], [8, 9, 10])
            return board
        }
    }
    const loader = new BoardFileLoader({
        altiumParser,
        kicadLoader: createUnusedKicadLoader()
    })

    const result = await loader.loadFiles([
        new FakeFile('altium-project.zip', archive)
    ])

    assert.equal(result.board, board)
    assert.equal(result.sourceFileName, 'boards/amplifier.PcbDoc')
    assert.equal(result.sourceText, '')
    assert.deepEqual([...result.sourceBytes], [8, 9, 10])
    assert.equal(result.sourceFormat, 'altium')
    assert.deepEqual(result.projectSettings, {
        side: 'front',
        highlightColor: '#33aa99',
        highlightedFootprints: ['altium:U1']
    })
})

/**
 * Creates a minimal normalized Altium PCB model.
 * @param {string} fileName
 * @returns {object}
 */
function createAltiumBoard(fileName) {
    return {
        kind: 'pcb',
        fileType: 'PcbDoc',
        fileName,
        summary: { title: 'Altium Board' },
        pcb: {
            boardOutline: { segments: [], minX: 0, minY: 0 },
            components: [],
            pads: [],
            layers: []
        }
    }
}

/**
 * Creates a KiCad full-project archive with a schematic and PCB document.
 * @param {string} boardSource
 * @returns {Uint8Array}
 */
function createKicadFullProjectArchive(boardSource) {
    return zipSync({
        'demo/demo.kicad_pro': strToU8('{"meta":{"version":1}}'),
        'demo/demo.kicad_sch': strToU8(createKicadSchematicSource()),
        'demo/demo.kicad_pcb': strToU8(boardSource)
    })
}

/**
 * Creates minimal KiCad board source with an outline and title.
 * @returns {string}
 */
function createKicadBoardSource() {
    return `(kicad_pcb
        (version 20241229)
        (title_block (title "Demo Board"))
        (gr_poly
            (pts (xy 0 0) (xy 10 0) (xy 10 10) (xy 0 10))
            (stroke (width 0.15) (type solid))
            (fill no)
            (layer "Edge.Cuts")
        )
    )`
}

/**
 * Creates minimal KiCad schematic source so the toolkit takes its project path.
 * @returns {string}
 */
function createKicadSchematicSource() {
    return `(kicad_sch
        (version 20250114)
        (uuid "root")
        (paper "A4")
        (title_block (title "Root"))
    )`
}

/**
 * Creates a fake browser File.
 */
class FakeFile {
    /**
     * @param {string} name
     * @param {Uint8Array} bytes
     */
    constructor(name, bytes) {
        this.name = name
        this.bytes = bytes
    }

    /**
     * @returns {Promise<ArrayBuffer>}
     */
    async arrayBuffer() {
        return this.bytes.buffer.slice(
            this.bytes.byteOffset,
            this.bytes.byteOffset + this.bytes.byteLength
        )
    }
}

/**
 * Creates a KiCad loader that should not be called.
 * @returns {object}
 */
function createUnusedKicadLoader() {
    return {
        findBoardEntry() {
            return null
        },
        loadEntries() {
            throw new Error('KiCad loader should not be called.')
        }
    }
}

/**
 * Creates an Altium parser that should not be called.
 * @returns {object}
 */
function createUnusedAltiumParser() {
    return {
        parseArrayBuffer() {
            throw new Error('Altium parser should not be called.')
        }
    }
}
