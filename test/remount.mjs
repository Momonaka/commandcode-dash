/**
 * Offline verification that the panel loads its routes once, not on every visit.
 *
 * Leaving a settings section unmounts it and returning builds it again. The
 * panel used to refetch both routes on every rebuild, so the user watched the
 * loading skeleton each time they came back. This test renders the real section,
 * resets the renderer's hook state to model that unmount/remount, and checks
 * that the second visit renders the first visit's answer without touching the
 * network — while the Refresh control still reaches it on demand.
 *
 * `SCENARIO=error` covers the same rule for a failed first load: the failure is
 * kept and rendered again, and Retry is the way back to the network.
 *
 * @module commandcode-dash/test/remount
 */

import { createRenderer } from './fake-react.mjs'
import { check, fixture, loadClientBundle, mountClient } from './helpers.mjs'

const account = fixture('account')
const configured = fixture('configured')
const catalog = fixture('catalog').data.map((model) => ({
  id: model.id,
  name: model.name,
  contextWindow: model.context_length,
}))

const ACCOUNT = '/api/commandcode/account'
const MODELS = '/api/commandcode/models'

const scenario = process.env.SCENARIO ?? 'ok'
const fetched = []
globalThis.fetch = async (url) => {
  fetched.push(url)
  if (scenario === 'error' && url === ACCOUNT) throw new Error('offline')
  const body = url === ACCOUNT ? account : { ok: true, models: catalog }
  return { ok: true, status: 200, text: async () => JSON.stringify(body) }
}

/** Concatenate every text node in one evaluated subtree. */
function textOf(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  return textOf(node.props && node.props.children)
}

/** Every button whose label contains `label`. */
function buttons(node, label, out = []) {
  if (node === null || node === undefined || typeof node === 'boolean') return out
  if (Array.isArray(node)) {
    for (const child of node) buttons(child, label, out)
    return out
  }
  if (typeof node !== 'object') return out
  if (node.type === 'button' && textOf(node).includes(label)) out.push(node)
  buttons(node.props && node.props.children, label, out)
  return out
}

const renderer = createRenderer()
const mod = await loadClientBundle({ react: renderer.react })
const mounted = mountClient(mod, {
  section: {
    providers: {
      commandcode: { displayName: 'Command Code', defaultInput: ['text', 'image'], models: configured },
      // In sync with the catalog, so returning visits have nothing to provision.
      'commandcode-anthropic': {
        displayName: 'Command Code (Claude)',
        defaultInput: ['text', 'image'],
        models: [{ id: 'claude-opus-5', name: 'Claude Opus 5', contextWindow: 1000000 }],
      },
    },
  },
  revision: 3,
})

console.log(`remount (${scenario})`)

const Section = mounted.section
if (Section === undefined) {
  console.log('FAIL  mountClient did not expose the registered component')
  process.exit(1)
}

// --- first visit: nothing cached, so the panel loads ----------------------
const firstTree = await renderer.render(Section, {})
const first = renderer.walk(firstTree)

// --- leave and come back: the component remounts, the bundle's cache does not
renderer.reset()
const secondTree = await renderer.render(Section, {})
const second = renderer.walk(secondTree)

// --- an explicit Refresh is the way back to the network -------------------
const refresh = buttons(secondTree, 'Refresh')

if (scenario === 'ok') {
  check.same('the first visit loads both routes', fetched, [ACCOUNT, MODELS])
  check.ok('the first visit renders the account', first.texts.includes('ada'))
  check.ok('the first visit renders the model table', (first.byClass['ccx-row'] ?? 0) > 0)

  check.same('returning to the panel fetches nothing', fetched, [ACCOUNT, MODELS])
  check.ok('the cached account is rendered again', second.texts.includes('ada'))
  check.ok('the cached plan tag is rendered again', second.texts.includes('GOAT'))
  check.same('the cached model table is rendered again', second.byClass['ccx-row'] ?? 0, first.byClass['ccx-row'] ?? 0)
  check.same('returning shows no loading skeleton', second.byClass['ccx-skel'] ?? 0, 0)
  check.same('the panel is unchanged by the visit', second.classes.length, first.classes.length)

  check.ok('the panel offers a refresh control', refresh.length > 0)
  refresh[0].props.onClick()
  check.same('an explicit refresh reloads both routes', fetched.slice(-2), [ACCOUNT, MODELS])
  const refreshed = renderer.walk(await renderer.render(Section, {}))
  check.ok('the refreshed account is rendered', refreshed.texts.includes('ada'))
  check.ok('the refreshed model table is rendered', (refreshed.byClass['ccx-row'] ?? 0) > 0)
} else {
  check.same('the failed first visit loads only the account route', fetched, [ACCOUNT])
  check.ok('the failure is named', first.texts.some((t) => t.includes('Could not reach Command Code')))

  check.same('returning to the panel does not retry automatically', fetched, [ACCOUNT])
  check.ok(
    'the cached failure is rendered again',
    second.texts.some((t) => t.includes('Could not reach Command Code')),
  )
  check.same('the failed panel shows no loading skeleton', second.byClass['ccx-skel'] ?? 0, 0)
  check.same('the model table stays away without a key', second.byClass['ccx-row'] ?? 0, 0)

  const retry = buttons(secondTree, 'Retry')
  check.ok('the error card still offers a retry', retry.length > 0)
  retry[0].props.onClick()
  check.same('retry is the way back to the network', fetched, [ACCOUNT, ACCOUNT])
}

process.exit(process.exitCode ?? 0)
