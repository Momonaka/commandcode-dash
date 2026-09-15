/**
 * Offline verification that signing out is confirmed first, then forgets the key
 * and returns the section to the page a first-ever visitor sees.
 *
 * The key never reaches the browser, so the panel's only lever is asking the
 * credential Remote to forget the reference — and what actually flips the panel
 * is that the host resolves the key per request. This test wires a fake store
 * that its fake account route reads, so it can assert the whole arc: opening the
 * confirmation writes nothing, dismissing it writes nothing, confirming unsets
 * the reference, and the reload that follows lands on the setup card.
 *
 * `SCENARIO=fresh` starts from an install with no Command Code route at all, so
 * the run has a provisioning report to drop on the way out — and a route pair to
 * prove it does not tear down.
 *
 * `SCENARIO=refused` covers the other direction. A store that refuses the write
 * (a read-only source shadowing the reference) must leave the dialog up, the key
 * in place, and the user signed in, rather than repainting into a signed-out
 * page that nothing actually happened to earn.
 *
 * @module commandcode-dash/test/signout
 */

import { createRenderer } from './fake-react.mjs'
import { check, fixture, loadClientBundle, mountClient } from './helpers.mjs'

const KEY_REF = 'COMMANDCODE_API_KEY'
const ACCOUNT = '/api/commandcode/account'
const MODELS = '/api/commandcode/models'

const account = fixture('account')
const configured = fixture('configured')
const catalog = fixture('catalog').data.map((model) => ({
  id: model.id,
  name: model.name,
  contextWindow: model.context_length,
}))

const scenario = process.env.SCENARIO ?? 'ok'
const refused = scenario === 'refused'
// `fresh` is the install the section provisions from scratch: no routes yet, so
// signing out has both a banner to clear and a write that must not repeat.
const providers =
  scenario === 'fresh'
    ? {}
    : {
        commandcode: { displayName: 'Command Code', defaultInput: ['text', 'image'], models: configured },
        // In sync with the catalog and carrying the modality default, so a run
        // that is not `fresh` has nothing to provision at all.
        'commandcode-anthropic': {
          displayName: 'Command Code (Claude)',
          defaultInput: ['text', 'image'],
          models: [{ id: 'claude-opus-5', name: 'Claude Opus 5', contextWindow: 1000000 }],
        },
      }

// The secret as the store holds it. The fake account route reads it the way the
// host resolves the real store once per request, so forgetting it is observable
// all the way out at which page the panel renders.
let stored = 'user_secret'
const credentials = {
  set: async (ref, value) => {
    if (ref === KEY_REF) stored = value
  },
  unset: async (ref) => {
    if (refused) {
      // The browser's `remote` face answers a result, it does not reject.
      return { ok: false, error: { code: 'credential/rejected', message: 'read-only source' } }
    }
    if (ref === KEY_REF) stored = undefined
    return { ok: true, value: undefined }
  },
}

const fetched = []
globalThis.fetch = async (url) => {
  fetched.push(url)
  const body =
    url === ACCOUNT
      ? stored === undefined
        ? { ok: false, code: 'NO_KEY', message: 'No Command Code API key is configured.' }
        : account
      : { ok: true, models: catalog }
  return { ok: true, status: 200, text: async () => JSON.stringify(body) }
}

/** Every text node in one evaluated subtree. */
function textOf(node) {
  if (node === null || node === undefined || typeof node !== 'object') {
    return typeof node === 'string' || typeof node === 'number' ? String(node) : ''
  }
  if (Array.isArray(node)) return node.map(textOf).join('')
  return textOf(node.props && node.props.children)
}

/** The first evaluated element whose class list contains `name`. */
function byClass(node, name) {
  if (node === null || node === undefined || typeof node !== 'object') return undefined
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = byClass(child, name)
      if (found !== undefined) return found
    }
    return undefined
  }
  const classes = String((node.props && node.props.className) || '').split(/\s+/)
  if (classes.includes(name)) return node
  return byClass(node.props && node.props.children, name)
}

/** One action inside the open confirmation dialog. */
function dialogAction(tree, label) {
  return byLabel(byClass(tree, 'ccx-dialog'), label)
}

/** The first button whose label contains `label`. */
function byLabel(node, label) {
  if (node === null || node === undefined || typeof node !== 'object') return undefined
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = byLabel(child, label)
      if (found !== undefined) return found
    }
    return undefined
  }
  if (node.type === 'button' && textOf(node).includes(label)) return node
  return byLabel(node.props && node.props.children, label)
}

const renderer = createRenderer()
const mod = await loadClientBundle({ react: renderer.react })
const mounted = mountClient(mod, { section: { providers }, revision: 3, credentials })

console.log(`signout (${scenario})`)

const Section = mounted.section
if (Section === undefined) {
  console.log('FAIL  mountClient did not expose the registered component')
  process.exit(1)
}

const tree = await renderer.render(Section, {})
const view = renderer.walk(tree)
const control = byClass(tree, 'ccx-link')
const row = byClass(tree, 'ccx-signOut')
const css = mounted.head[0] ? String(mounted.head[0].textContent) : ''
const rootChildren = byClass(tree, 'ccx-root').props.children.filter((child) => child !== null)

/** Render once more, the way a live panel would. */
async function repaint() {
  return renderer.render(Section, {})
}

check.same('the signed-in panel loads both routes', fetched, [ACCOUNT, MODELS])
check.ok('the signed-in panel renders the account', view.texts.includes('ada'))
check.ok('the panel offers a sign-out control', control !== undefined)
check.same('sign-out is a text control, not a bordered button', control.props.className, 'ccx-link')
check.ok('the sign-out row is the last thing in the panel', rootChildren[rootChildren.length - 1] === row)
check.ok('the row centres what it holds', /\.ccx-signOut\{[^}]*align-items:center/.test(css))
check.ok('the text control draws no button chrome', /\.ccx-link\{[^}]*background:none/.test(css))

// --- nothing happens until the confirmation says so ------------------------
control.props.onClick()
let dialog = await repaint()
let opened = renderer.walk(dialog)
const panel = byClass(dialog, 'ccx-dialog')
check.ok('clicking sign-out asks first', panel !== undefined)
check.same('the question is a labelled dialog', panel.props.role, 'dialog')
check.same('and it is modal', panel.props['aria-modal'], 'true')
check.same('its title is what the dialog points at', panel.props['aria-labelledby'], 'ccx-signout-title')
check.ok('it says what will be forgotten', opened.texts.some((t) => t.includes('forgets the stored API key')))
check.ok('it offers a way out', dialogAction(dialog, 'Cancel') !== undefined)
check.same('the key survives the question', stored, 'user_secret')
check.same('no write is attempted on open', mounted.credentialCalls, [])
check.same('the dialog does not refetch anything', fetched, [ACCOUNT, MODELS])
check.ok('the signed-in panel is still behind it', opened.texts.includes('ada'))

// --- Escape dismisses it, and only it -------------------------------------
const escape = mounted.windowListeners.find((entry) => entry.type === 'keydown')
check.ok('the dialog listens for Escape', escape !== undefined)
check.ok('it takes Escape before the settings panel that owns it', escape.capture === true)
let stopped = false
escape.fn({
  key: 'Escape',
  stopPropagation: () => {
    stopped = true
  },
})
check.ok('Escape is not left to close the settings panel too', stopped)
dialog = await repaint()
check.ok('Escape closes the dialog', byClass(dialog, 'ccx-dialog') === undefined)
check.same('and still writes nothing', mounted.credentialCalls, [])
check.same('the dismissed dialog leaves no listener behind', mounted.windowListeners.length, 0)

// --- the mask is the same non-event ---------------------------------------
control.props.onClick()
dialog = await repaint()
byClass(dialog, 'ccx-mask').props.onClick()
dialog = await repaint()
check.ok('the mask dismisses the dialog', byClass(dialog, 'ccx-dialog') === undefined)
check.same('and dismissing by mask writes nothing either', mounted.credentialCalls, [])

// --- confirming is what does it -------------------------------------------
control.props.onClick()
dialog = await repaint()

if (refused) {
  dialogAction(dialog, 'Sign out').props.onClick()
  const failed = await repaint()
  const after = renderer.walk(failed)
  check.same('a refused write asks the store exactly once', mounted.credentialCalls, [{ op: 'unset', ref: KEY_REF }])
  check.same('the key is left in place', stored, 'user_secret')
  check.same('a refused sign-out does not re-read the account route', fetched, [ACCOUNT, MODELS])
  check.ok('the dialog stays up to say so', byClass(failed, 'ccx-dialog') !== undefined)
  check.ok('the failure is named', after.texts.some((t) => t.includes('Could not sign out')))
  check.ok('the store message is shown verbatim', after.texts.some((t) => t.includes('read-only source')))
  check.ok('the user is still signed in', after.texts.includes('ada'))

  dialogAction(failed, 'Cancel').props.onClick()
  const closedTree = await repaint()
  const closed = renderer.walk(closedTree)
  check.ok('cancelling after a refusal closes the dialog', byClass(closedTree, 'ccx-dialog') === undefined)
  check.ok('and the failure goes with it', !closed.texts.some((t) => t.includes('Could not sign out')))
  check.ok('the control is still offered', byClass(closedTree, 'ccx-link') !== undefined)
  check.same('cancelling wrote nothing more', mounted.credentialCalls, [{ op: 'unset', ref: KEY_REF }])
} else {
  if (scenario === 'fresh') {
    check.same('a fresh install provisions exactly once', mounted.writes.length, 1)
    check.ok('the provisioning is reported to the user', view.texts.some((t) => t.includes('Added the model provider')))
  }

  dialogAction(dialog, 'Sign out').props.onClick()
  const done = await repaint()
  const after = renderer.walk(done)
  check.same('confirming unsets exactly the reference the form writes', mounted.credentialCalls, [
    { op: 'unset', ref: KEY_REF },
  ])
  check.same('the secret is really gone from the store', stored, undefined)
  check.same('the account route is re-read, not replayed from the cache', fetched, [ACCOUNT, MODELS, ACCOUNT])
  check.ok('the dialog is gone', byClass(done, 'ccx-dialog') === undefined)
  check.ok('the panel is back on the setup card', after.inputs.includes('user_…'))
  check.ok('the signed-out panel names the credential store', after.texts.some((t) => t.includes('credential store')))
  check.ok('the account is no longer rendered', !after.texts.includes('ada'))
  check.same('the model table is gone with the key', after.byClass['ccx-row'] ?? 0, 0)
  check.ok('there is nothing left to sign out of', byClass(done, 'ccx-link') === undefined)
  check.same('the closed dialog leaves no listener behind', mounted.windowListeners.length, 0)
  if (scenario === 'fresh') {
    check.ok(
      'the provisioning report leaves with the key',
      !after.texts.some((t) => t.includes('Added the model provider')),
    )
    check.same('the routes it wrote are neither re-provisioned nor torn down', mounted.writes.length, 1)
  }

  // The page the user lands on is the one a first-ever visitor sees: the
  // bundle's cache now holds NO_KEY, so a remount renders that same page
  // without another round trip.
  renderer.reset()
  const fresh = renderer.walk(await repaint())
  check.same('the signed-out page is the first-run page', fresh.classes, after.classes)
  check.same('and a fresh visitor sees it without a refetch', fetched, [ACCOUNT, MODELS, ACCOUNT])
}

process.exit(process.exitCode ?? 0)
