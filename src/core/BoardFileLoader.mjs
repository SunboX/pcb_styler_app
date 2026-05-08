// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: AGPL-3.0-or-later

import { strFromU8, unzipSync } from 'fflate'
import { KicadProjectLoader } from 'kicad-toolkit/parser'
import { AltiumParser } from 'altium-toolkit/parser'
import { ProjectArchive } from './ProjectArchive.mjs'

/**
 * Loads PCB documents through the matching format toolkit.
 */
export class BoardFileLoader {
    /** @type {{ findBoardEntry?: (entries: object[]) => object | null, loadEntries?: (entries: object[]) => Promise<object> | object, loadFiles?: (files: FileList | File[]) => Promise<object> | object }} */
    #kicadLoader

    /** @type {{ parseArrayBuffer: (fileName: string, arrayBuffer: ArrayBuffer) => object }} */
    #altiumParser

    /**
     * @param {{ kicadLoader?: object, altiumParser?: object }} [dependencies]
     */
    constructor(dependencies = {}) {
        this.#kicadLoader = dependencies.kicadLoader || KicadProjectLoader
        this.#altiumParser = dependencies.altiumParser || AltiumParser
    }

    /**
     * Loads browser File objects.
     * @param {FileList | File[]} files
     * @returns {Promise<{ board: object, sourceFileName: string, sourceText: string, sourceBytes: Uint8Array | null, projectSettings: object | null, sourceFormat: 'kicad' | 'altium' }>}
     */
    async loadFiles(files) {
        const entries = await BoardFileLoader.#entriesFromFiles(files)
        return this.loadEntries(entries)
    }

    /**
     * Loads named byte entries.
     * @param {{ name: string, bytes: Uint8Array }[]} entries
     * @returns {Promise<{ board: object, sourceFileName: string, sourceText: string, sourceBytes: Uint8Array | null, projectSettings: object | null, sourceFormat: 'kicad' | 'altium' }>}
     */
    async loadEntries(entries) {
        const normalizedEntries = BoardFileLoader.#normalizeEntries(entries)
        const directEntry =
            BoardFileLoader.#findDirectSupportedEntry(normalizedEntries)

        if (directEntry?.format === 'altium') {
            return this.#loadAltiumEntry(directEntry.entry)
        }

        const project = ProjectArchive.find(normalizedEntries)
        if (project) {
            if (BoardFileLoader.isAltiumBoardFile(project.boardEntry.name)) {
                return this.#loadAltiumEntry(
                    project.boardEntry,
                    project.settings
                )
            }

            return this.#loadKicadEntries(
                [project.boardEntry],
                project.settings
            )
        }

        if (
            directEntry?.format === 'kicad' ||
            this.#findKicadBoardEntry(normalizedEntries)
        ) {
            return this.#loadKicadEntries(normalizedEntries)
        }

        const altiumEntry =
            BoardFileLoader.findAltiumBoardEntry(normalizedEntries)
        if (altiumEntry) {
            return this.#loadAltiumEntry(altiumEntry)
        }

        throw new Error(
            'No supported PCB file found. Open a KiCad .kicad_pcb file, an Altium .PcbDoc file, or a project ZIP.'
        )
    }

    /**
     * Finds a direct or archived Altium PCB entry.
     * @param {{ name: string, bytes: Uint8Array }[]} entries
     * @returns {{ name: string, bytes: Uint8Array } | null}
     */
    static findAltiumBoardEntry(entries) {
        const direct = entries.find((entry) =>
            BoardFileLoader.isAltiumBoardFile(entry.name)
        )
        if (direct) return direct

        for (const entry of entries) {
            if (!BoardFileLoader.isZipFile(entry.name)) continue

            const archiveEntries = unzipSync(entry.bytes)
            const boardName = Object.keys(archiveEntries)
                .filter((name) => !name.startsWith('__MACOSX/'))
                .find((name) => BoardFileLoader.isAltiumBoardFile(name))

            if (boardName) {
                return {
                    name: boardName,
                    bytes: archiveEntries[boardName]
                }
            }
        }

        return null
    }

    /**
     * Returns true for Altium PCB document filenames.
     * @param {string} fileName
     * @returns {boolean}
     */
    static isAltiumBoardFile(fileName) {
        return /\.pcbdoc$/i.test(String(fileName || ''))
    }

    /**
     * Returns true for ZIP filenames.
     * @param {string} fileName
     * @returns {boolean}
     */
    static isZipFile(fileName) {
        return /\.zip$/i.test(String(fileName || ''))
    }

    /**
     * Reads File-like objects into named byte entries.
     * @param {FileList | File[]} files
     * @returns {Promise<{ name: string, bytes: Uint8Array }[]>}
     */
    static async #entriesFromFiles(files) {
        return Promise.all(
            Array.from(files || []).map(async (file) => ({
                name: String(file.name || ''),
                bytes: new Uint8Array(await file.arrayBuffer())
            }))
        )
    }

    /**
     * Normalizes named byte entries.
     * @param {{ name: string, bytes: Uint8Array }[]} entries
     * @returns {{ name: string, bytes: Uint8Array }[]}
     */
    static #normalizeEntries(entries) {
        return Array.from(entries || []).map((entry) => ({
            name: String(entry.name || ''),
            bytes:
                entry.bytes instanceof Uint8Array
                    ? entry.bytes
                    : new Uint8Array(entry.bytes || [])
        }))
    }

    /**
     * Finds the first direct supported board file in user-selected order.
     * @param {{ name: string, bytes: Uint8Array }[]} entries
     * @returns {{ format: 'kicad' | 'altium', entry: { name: string, bytes: Uint8Array } } | null}
     */
    static #findDirectSupportedEntry(entries) {
        for (const entry of entries) {
            if (BoardFileLoader.isAltiumBoardFile(entry.name)) {
                return { format: 'altium', entry }
            }
            if (/\.kicad_pcb$/i.test(entry.name)) {
                return { format: 'kicad', entry }
            }
        }

        return null
    }

    /**
     * Delegates KiCad loading to kicad-toolkit.
     * @param {{ name: string, bytes: Uint8Array }[]} entries
     * @param {object | null} [projectSettings]
     * @returns {Promise<{ board: object, sourceFileName: string, sourceText: string, sourceBytes: Uint8Array | null, projectSettings: object | null, sourceFormat: 'kicad' }>}
     */
    async #loadKicadEntries(entries, projectSettings = null) {
        if (typeof this.#kicadLoader.loadEntries === 'function') {
            const boardEntry = this.#findKicadBoardEntry(entries)
            const result = await this.#kicadLoader.loadEntries(entries)
            return BoardFileLoader.#normalizeKicadLoadResult(
                result,
                boardEntry,
                projectSettings
            )
        }

        throw new Error('KiCad loader does not support named entries.')
    }

    /**
     * Parses one Altium PCB entry.
     * @param {{ name: string, bytes: Uint8Array }} entry
     * @param {object | null} [projectSettings]
     * @returns {{ board: object, sourceFileName: string, sourceText: string, sourceBytes: Uint8Array, projectSettings: object | null, sourceFormat: 'altium' }}
     */
    #loadAltiumEntry(entry, projectSettings = null) {
        const board = this.#altiumParser.parseArrayBuffer(
            entry.name,
            BoardFileLoader.#bytesToArrayBuffer(entry.bytes)
        )
        if (board?.kind !== 'pcb' || !board?.pcb) {
            throw new Error('Altium file is not a PCB document: ' + entry.name)
        }

        return {
            board,
            sourceFileName: entry.name,
            sourceText: '',
            sourceBytes: new Uint8Array(entry.bytes),
            projectSettings,
            sourceFormat: 'altium'
        }
    }

    /**
     * Finds whether entries include a KiCad board.
     * @param {{ name: string, bytes: Uint8Array }[]} entries
     * @returns {object | null}
     */
    #findKicadBoardEntry(entries) {
        if (typeof this.#kicadLoader.findBoardEntry === 'function') {
            const entry = this.#kicadLoader.findBoardEntry(entries)
            if (entry) return entry
        }

        return entries.find((entry) => /\.kicad_pcb$/i.test(entry.name)) || null
    }

    /**
     * Normalizes old board-only and new full-project KiCad toolkit results.
     * @param {object} result
     * @param {{ name: string, bytes: Uint8Array } | null} boardEntry
     * @param {object | null} projectSettings
     * @returns {{ board: object, sourceFileName: string, sourceText: string, sourceBytes: Uint8Array | null, projectSettings: object | null, sourceFormat: 'kicad' }}
     */
    static #normalizeKicadLoadResult(result, boardEntry, projectSettings) {
        const board = BoardFileLoader.#resolveKicadBoard(result)
        if (!board) {
            throw new Error('KiCad loader result does not contain a PCB board.')
        }

        return {
            ...result,
            board,
            sourceFileName:
                result.sourceFileName ||
                boardEntry?.name ||
                board.fileName ||
                '',
            sourceText:
                result.sourceText ||
                BoardFileLoader.#sourceTextFromEntry(boardEntry),
            sourceBytes: boardEntry?.bytes
                ? new Uint8Array(boardEntry.bytes)
                : null,
            projectSettings: projectSettings || result.projectSettings || null,
            sourceFormat: 'kicad'
        }
    }

    /**
     * Resolves a raw KiCad board from supported toolkit result shapes.
     * @param {object | null} result
     * @returns {object | null}
     */
    static #resolveKicadBoard(result) {
        if (result?.board) return result.board

        const document = (result?.documents || []).find((candidate) => {
            return candidate?.kind === 'pcb' && candidate?.pcb?.kicadBoard
        })

        return document?.pcb?.kicadBoard || null
    }

    /**
     * Decodes the source text from a resolved KiCad board entry.
     * @param {{ bytes?: Uint8Array } | null} entry
     * @returns {string}
     */
    static #sourceTextFromEntry(entry) {
        return entry?.bytes ? strFromU8(entry.bytes) : ''
    }

    /**
     * Converts a Uint8Array view to an exact ArrayBuffer.
     * @param {Uint8Array} bytes
     * @returns {ArrayBuffer}
     */
    static #bytesToArrayBuffer(bytes) {
        return bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength
        )
    }
}
