/**
 * Offline verification that the settings section actually renders.
 *
 * Mounts the browser half, renders the real section component through the
 * fake-React renderer, and inspects the resulting element tree. This is what
 * catches a component that throws, a panel that renders nothing, or a model
 * table that truncates instead of listing everything.
 *
 * @module commandcode-dash/test/render
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

const scenario = process.env.SCENARIO ?? 'ok'
const routes = {
  '/api/commandcode/account':
    scenario === 'no-key'
      ? { ok: false, code: 'NO_KEY', message: 'No Command Code API key is configured.' }
      : scenario === 'auth'
        ? { ok: false, code: 'AUTH', message: "Invalid 'Authorization' header or token." }
        : account,
  '/api/commandcode/models': { ok: true, models: catalog },
}
const fetched = []
globalThis.fetch = async (url) => {
  fetched.push(url)
  const body = routes[url]
  if (body === undefined) throw new Error(`unexpected fetch: ${url}`)
  return { ok: true, status: 200, text: async () => JSON.stringify(body) }
}

const renderer = createRenderer()
const mod = await loadClientBundle({ react: renderer.react })
// `fresh` models a machine where the plugin was just installed and nothing has
// been written to llm-pi-ai yet — the case that used to leave the user with no
// models at all. `write-fails` starts from the same empty state. `migrate` models
// an install provisioned by a version that never wrote the route-level modality
// default: the routes and their catalogs exist, so only that field is owed.
const legacy = scenario === 'migrate'
const routeInput = legacy ? {} : { defaultInput: ['text', 'image'] }
const configuredProviders =
  scenario === 'fresh' || scenario === 'write-fails'
    ? {}
    : {
        commandcode: { displayName: 'Command Code', ...routeInput, models: configured },
        // In sync with the catalog, so the run has exactly one thing to report.
        'commandcode-anthropic': {
          displayName: 'Command Code (Claude)',
          ...routeInput,
          models: [{ id: 'claude-opus-5', name: 'Claude Opus 5', contextWindow: 1000000 }],
        },
      }
const mounted = mountClient(mod, {
  section: { providers: configuredProviders },
  revision: 3,
  writeFails: scenario === 'write-fails',
})

console.log(`render (${scenario})`)
check.same('the bundle registers exactly one settings section', mounted.registrations.map((r) => r.id), ['command-code'])
check.same('the section sits after Models in the nav', mounted.registrations.map((r) => r.order), [10])
check.same('the nav label is the product name', mounted.registrations.map((r) => r.label), ['Command Code'])
check.same('it binds the llm-pi-ai namespace for the model list', mounted.binds.map((b) => b.namespace), ['llm-pi-ai'])
check.ok('the stylesheet is injected once', mounted.styleBytes > 500)

const Section = mounted.registrations.length === 1 ? mounted.section : undefined
if (Section === undefined) {
  console.log('FAIL  mountClient did not expose the registered component')
  process.exit(1)
}

const tree = await renderer.render(Section, {})
const view = renderer.walk(tree)
const [accountResponse, modelsResponse] = [fetched[0], fetched[1]]

const hasPanel = scenario === 'ok' || scenario === 'fresh' || scenario === 'write-fails' || scenario === 'migrate'
const rows = view.byClass['ccx-row'] ?? 0
const claudeRows = view.texts.filter((t) => t.startsWith('claude-'))
const nonClaudeLive = catalog.filter((model) => !model.id.startsWith('claude-')).length

if (hasPanel) {
  check.same('both routes are fetched', [accountResponse, modelsResponse], [
    '/api/commandcode/account',
    '/api/commandcode/models',
  ])
  check.ok('the account identity is rendered', view.texts.includes('ada'))
  check.ok('the plan tag is rendered', view.texts.includes('GOAT'))
  check.ok('the balance section is rendered', view.texts.includes('Balance'))
  check.ok('the monthly balance is rendered as dollars', view.texts.includes('$68.46'))
  check.ok(
    'no credit wording remains in the panel',
    !view.texts.join(' ').toLowerCase().includes('credit'),
  )
  check.ok('the usage window caps are dollars', view.texts.some((t) => t.includes('$14')))
  check.ok('the usage window section is rendered', view.texts.includes('Usage windows'))
  check.ok('the billing-period section is rendered', view.texts.includes('This billing period'))
  check.ok('a reset countdown is rendered', view.texts.some((t) => t.includes('resets in') || t.includes('reset pending')))
  check.ok('the model panel is rendered', view.texts.includes('Models'))
  check.same('no "more" placeholder remains', view.byClass['ccx-more'] ?? 0, 0)
}

// --- automatic provider provisioning -------------------------------------
if (scenario === 'ok') {
  // Four configured OpenAI-route entries, one catalog addition, and the
  // in-sync Claude entry.
  check.same('every model is rendered, with no truncation', rows, configured.length + 1 + 1)
  check.ok('the newly added model is listed', view.texts.includes('moonshotai/Kimi-K3'))
  check.ok('a dropped model is still listed', view.texts.includes('xai/grok-4.5'))
  check.ok('a context size is rendered', view.texts.some((t) => t.includes('1,048,576')))
  check.same('the capability column is gone', view.byClass['ccx-caps'] ?? 0, 0)
  check.ok('a diff summary is offered', view.texts.some((t) => t.includes('Apply')))
  check.same('claude is listed only once, on the Anthropic route', claudeRows, ['claude-opus-5'])
  check.same('an already-configured install is never overwritten', mounted.writes.length, 0)
} else if (scenario === 'fresh') {
  check.same('a fresh install provisions exactly once', mounted.writes.length, 1)
  const ops = (mounted.writes[0] && mounted.writes[0].ops) || []
  check.same(
    'it writes both provider routes, atomically',
    ops.map((op) => `${op.op} ${op.path.join('.')}`).sort(),
    ['set providers.commandcode', 'set providers.commandcode-anthropic'],
  )
  check.same('the write is fenced by the namespace revision', mounted.writes[0] && mounted.writes[0].revision, 3)
  const openai = ops.find((op) => op.path[1] === 'commandcode')
  const anthro = ops.find((op) => op.path[1] === 'commandcode-anthropic')
  check.same('the OpenAI route declares its protocol and endpoint', [openai.value.api, openai.value.baseURL], [
    'openai-completions',
    'https://api.commandcode.ai/provider/v1',
  ])
  check.same('the Claude route declares the Anthropic protocol', anthro.value.api, 'anthropic-messages')
  check.ok('the OpenAI route ships a non-empty model list', openai.value.models.length > 0)
  check.ok('the Claude route ships only claude models', anthro.value.models.every((m) => m.id.startsWith('claude-')))
  check.ok('the success is reported to the user', view.texts.some((t) => t.includes('Added the model provider')))
  // The whole point: once provisioned, the models are actually there.
  check.same('the model table appears after provisioning', rows, nonClaudeLive + 1)
  check.same('claude is listed only once', claudeRows, ['claude-opus-5'])
  check.ok('the provisioned catalog reports itself in sync', view.texts.some((t) => t.includes('in sync')))
} else if (scenario === 'write-fails') {
  check.same('a refused write is attempted once, not retried forever', mounted.writes.length, 1)
  check.ok('the failure is surfaced instead of passing silently', view.texts.some((t) => t.includes('Could not add the model provider')))
  check.ok('a retry action is offered', view.texts.includes('Try again'))
  check.same('the table stays empty when the write was refused', rows, 0)
} else if (scenario === 'migrate') {
  check.same('an existing install is topped up exactly once', mounted.writes.length, 1)
  const ops = (mounted.writes[0] && mounted.writes[0].ops) || []
  check.same(
    'only the modality default is written, never the catalog',
    ops.map((op) => `${op.op} ${op.path.join('.')}`).sort(),
    ['set providers.commandcode-anthropic.defaultInput', 'set providers.commandcode.defaultInput'],
  )
  check.same(
    'the top-up names both modalities on both routes',
    ops.map((op) => op.value),
    [['text', 'image'], ['text', 'image']],
  )
  check.same('the top-up is fenced by the namespace revision', mounted.writes[0] && mounted.writes[0].revision, 3)
  check.ok(
    'the silent top-up raises no notice of its own',
    !view.texts.some((t) => t.includes('model provider') || t.includes('image input')),
  )
  check.same('the existing catalog is left in place', rows, configured.length + 1 + 1)
  check.ok('the catalog diff from the same run is still offered', view.texts.some((t) => t.includes('Apply')))
  check.same('the top-up does not trigger a second write', mounted.writes.length, 1)
} else {
  check.same('no model table is rendered', rows, 0)
  check.same('the models route is not fetched without a usable key', fetched.length, 1)
  check.same('nothing is provisioned without a working key', mounted.writes.length, 0)
  check.ok('no CLI hint leaks into the panel', !view.texts.join(' ').toLowerCase().includes('cmd cli'))
  if (scenario === 'no-key') {
    check.ok('the setup card asks for a key', view.inputs.includes('user_…'))
    check.ok('the setup card names the credential store', view.texts.some((t) => t.includes('credential store')))
  } else {
    check.ok('the auth failure is named', view.texts.some((t) => t.includes('rejected')))
    check.ok('a retry action is offered', view.texts.includes('Retry'))
  }
}

process.exit(process.exitCode ?? 0)
