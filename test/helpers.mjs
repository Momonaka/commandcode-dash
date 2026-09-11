/**
 * Test helpers: load the browser bundle the way the DSH module loader does, and
 * read fixtures relative to this file.
 *
 * @module commandcode-dash/test/helpers
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

/** Repository root. */
export const root = join(here, '..')

/**
 * Read one fixture file as JSON.
 *
 * @param name - fixture basename without the extension.
 * @returns the parsed fixture.
 */
export function fixture(name) {
  return JSON.parse(readFileSync(join(here, 'fixtures', `${name}.json`), 'utf8'))
}

/**
 * Import `lib/client.js` under a fake module loader and materialize it.
 *
 * The bundle only registers a factory when it is evaluated; `require` runs when
 * the factory is invoked, so the stub table is consulted here.
 *
 * @param stubs - module id to replacement, e.g. `{ react }`.
 * @returns the plugin module's exports.
 */
export async function loadClientBundle(stubs) {
  let factory
  globalThis.window = { __ModuleLoader__: { load: (record) => { factory = record.factory } } }
  await import(new URL('../lib/client.js', import.meta.url).href)
  if (factory === undefined) throw new Error('lib/client.js did not call window.__ModuleLoader__.load')
  return factory((id) => {
    if (Object.hasOwn(stubs, id)) return stubs[id]
    throw new Error(`the client bundle required an unexpected module: ${JSON.stringify(id)}`)
  })
}

/**
 * Mount the bundle's client half against a fake context.
 *
 * @param mod - exports from {@link loadClientBundle}.
 * @param options - `{ section }` is the resolved `llm-pi-ai` section handed to a
 *   bound scope; `{ credentials }` the credentials face; `{ revision }` the
 *   scope revision.
 * @returns `{ section, registrations, binds, styleBytes, ctx, head }`.
 */
export function mountClient(mod, options = {}) {
  const registered = []
  const binds = []
  const head = []
  globalThis.document = {
    documentElement: { getAttribute: () => options.lang ?? 'en' },
    querySelector: () => null,
    createElement: () => ({ dataset: {}, textContent: '' }),
    head: { appendChild: (el) => head.push(el) },
  }
  globalThis.MutationObserver = class {
    observe() {}
    disconnect() {}
  }
  const writes = []
  // The fake scope folds writes back into its snapshot and notifies subscribers,
  // the way the real settings service does — otherwise a test could never see
  // the panel react to its own provisioning write.
  let sectionValue = options.section ?? {}
  let sectionRevision = options.revision ?? 1
  const listeners = []
  const ctx = {
    get: (service) =>
      service === 'settingsScope'
        ? {
            bind: (spec) => {
              binds.push(spec)
              return {
                getSnapshot: () => ({
                  status: 'ready',
                  // A fresh object per read, like the real mirror: the contract is
                  // "stable reference until the next change", so a change must
                  // produce a new identity or identity-keyed consumers go stale.
                  value: structuredClone(sectionValue),
                  revision: sectionRevision,
                  writable: options.writable ?? true,
                }),
                subscribe: (fn) => {
                  listeners.push(fn)
                  return () => {
                    const at = listeners.indexOf(fn)
                    if (at >= 0) listeners.splice(at, 1)
                  }
                },
                // Records every auto-provisioning attempt so a test can assert it.
                mutate: (ops, revision) => {
                  writes.push({ ops, revision })
                  if (options.writeFails === true) return Promise.reject(new Error('settings refused the write'))
                  for (const op of ops) {
                    if (op.op !== 'set') continue
                    let node = sectionValue
                    for (const key of op.path.slice(0, -1)) {
                      if (typeof node[key] !== 'object' || node[key] === null) node[key] = {}
                      node = node[key]
                    }
                    node[op.path[op.path.length - 1]] = op.value
                  }
                  sectionRevision += 1
                  for (const fn of [...listeners]) fn()
                  return Promise.resolve()
                },
              }
            },
          }
        : service === 'remote'
          ? { credentials: options.credentials ?? { set: async () => {} } }
          : undefined,
    slots: {
      inject: (_slot, fn) => fn(),
      register: (slotOptions, Component) => {
        registered.push({
          id: slotOptions.id,
          order: slotOptions.order,
          label: slotOptions.label(),
          component: Component,
        })
        return () => {}
      },
    },
  }
  mod.apply(ctx)
  return {
    section: registered.length === 1 ? registered[0].component : undefined,
    registrations: registered,
    binds,
    writes,
    styleBytes: head[0] ? String(head[0].textContent).length : 0,
    ctx,
    head,
  }
}

/** Assertion helpers that print a stable, greppable line per check. */
export const check = {
  /** @returns true when the assertion held. */
  ok(label, condition) {
    console.log(`  ${condition ? 'PASS' : 'FAIL'}  ${label}`)
    if (!condition) process.exitCode = 1
    return Boolean(condition)
  },
  /** @returns true when both arrays are element-wise equal. */
  same(label, actual, expected) {
    const a = JSON.stringify(actual)
    const b = JSON.stringify(expected)
    console.log(`  ${a === b ? 'PASS' : 'FAIL'}  ${label}${a === b ? '' : `\n          actual   ${a}\n          expected ${b}`}`)
    if (a !== b) process.exitCode = 1
    return a === b
  },
}
