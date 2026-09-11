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
const mounted = mountClient(mod, {
  section: { providers: { commandcode: { displayName: 'Command Code', models: configured } } },
  revision: 3,
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

if (scenario === 'ok') {
  check.same('both routes are fetched', [accountResponse, modelsResponse], [
    '/api/commandcode/account',
    '/api/commandcode/models',
  ])
  check.ok('the account identity is rendered', view.texts.includes('ada'))
  check.ok('the plan tag is rendered', view.texts.includes('GOAT'))
  check.ok('the credits section is rendered', view.texts.includes('Credits'))
  check.ok('the monthly balance is rendered', view.texts.includes('68.46'))
  check.ok('the usage window section is rendered', view.texts.includes('Usage windows'))
  check.ok('the billing-period section is rendered', view.texts.includes('This billing period'))
  check.ok('a reset countdown is rendered', view.texts.some((t) => t.includes('resets in') || t.includes('reset pending')))
  check.ok('the model panel is rendered', view.texts.includes('Models'))

  // The table must list every merged model — 4 configured plus 1 addition.
  const rows = view.byClass['ccx-row'] ?? 0
  check.same('every model is rendered, with no truncation', rows, configured.length + 1)
  check.same('no "more" placeholder remains', view.byClass['ccx-more'] ?? 0, 0)
  check.ok('the newly added model is listed', view.texts.includes('moonshotai/Kimi-K3'))
  check.ok('a dropped model is still listed', view.texts.includes('xai/grok-4.5'))
  check.ok('a vision entry shows its modality', view.texts.some((t) => t.includes('vision')))
  check.ok('a diff summary is offered', view.texts.some((t) => t.includes('Apply')))
  check.same('no claude id reaches the OpenAI-compatible table', view.texts.filter((t) => t.startsWith('claude-')), [])
} else {
  check.same('no model table is rendered', view.byClass['ccx-row'] ?? 0, 0)
  check.same('the models route is not fetched without a usable key', fetched.length, 1)
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
