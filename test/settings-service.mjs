/**
 * Offline verification that the panel rides whichever settings service its shell
 * serves.
 *
 * The settings namespace view moved in 0.2.0: `settingsScope.bind({ namespace })`
 * became `configForms.get(namespace)`, and the old service name is gone rather
 * than aliased. The client boot audit fails the whole page on any entry still
 * waiting for a service, so naming either generation in the bundle's `inject`
 * would take the plugin — and the settings panel with it — down on the other
 * one. This test pins both halves of that seam: the declared services must be
 * generation-neutral, and the `llm-pi-ai` namespace must still be bound (and
 * still be the thing the provisioning write goes through) on each generation.
 *
 * @module commandcode-dash/test/settings-service
 */

import { createRenderer } from './fake-react.mjs'
import { check, fixture, loadClientBundle, mountClient } from './helpers.mjs'

const account = fixture('account')
const catalog = fixture('catalog').data.map((model) => ({
  id: model.id,
  name: model.name,
  contextWindow: model.context_length,
}))

const renderer = createRenderer()
const mod = await loadClientBundle({ react: renderer.react })

globalThis.fetch = async (url) => ({
  ok: true,
  status: 200,
  text: async () =>
    JSON.stringify(url === '/api/commandcode/account' ? account : { ok: true, models: catalog }),
})

/**
 * Mount and render one fresh install — no `llm-pi-ai` routes yet, so the panel
 * has to provision them through whatever scope it managed to claim.
 *
 * @param settings - settings service this fake shell serves.
 * @returns the mount record and the rendered text/class view.
 */
async function freshInstall(settings) {
  const mounted = mountClient(mod, { settings, section: { providers: {} }, revision: 3 })
  const view = renderer.walk(await renderer.render(mounted.section, {}))
  // A settings section unmounts when the user leaves it; the hook store is
  // per-mount, so each case starts from a clean one.
  renderer.reset()
  return { mounted, view }
}

console.log('settings service')

// --- the declared services -------------------------------------------------
// The one line that was wrong: `settingsScope` in `inject` is a hard wait on a
// service 0.2.x does not provide, and the web boot rejects the whole page for it.
check.ok(
  'the entry requires no generation-specific settings service',
  !mod.inject.includes('settingsScope') && !mod.inject.includes('configForms'),
)
check.same(
  'it still requires the slot registry, the Remote transport, and its credentials',
  ['slots', 'remote', 'remote.credentials'].filter((service) => !mod.inject.includes(service)),
  [],
)

// --- both shell generations ------------------------------------------------
for (const settings of ['settingsScope', 'configForms']) {
  const { mounted, view } = await freshInstall(settings)
  check.same(`(${settings}) the settings section is still registered`, mounted.registrations.map((r) => r.id), ['command-code'])
  check.same(`(${settings}) the llm-pi-ai namespace is claimed`, mounted.binds.map((b) => b.namespace), ['llm-pi-ai'])
  check.same(`(${settings}) a fresh install provisions both routes through it`, mounted.writes.length, 1)
  check.same(
    `(${settings}) the write still carries both provider routes`,
    ((mounted.writes[0] && mounted.writes[0].ops) || []).map((op) => `${op.op} ${op.path.join('.')}`).sort(),
    ['set providers.commandcode', 'set providers.commandcode-anthropic'],
  )
  check.same(`(${settings}) it is fenced by the namespace revision`, mounted.writes[0] && mounted.writes[0].revision, 3)
  check.ok(`(${settings}) the account half renders regardless`, view.texts.includes('ada'))
  check.ok(
    `(${settings}) the provisioned routes are reported to the user`,
    view.texts.some((t) => t.includes('Added the model provider')),
  )
}

// --- a shell that serves neither -------------------------------------------
// Claiming by child fiber means the panel degrades to "no catalog sync" instead
// of failing to load: it must still register and render.
const bare = mountClient(mod, { settings: 'none', section: { providers: {} }, revision: 3 })
const bareView = renderer.walk(await renderer.render(bare.section, {}))
check.same('a shell serving neither name still registers the section', bare.registrations.map((r) => r.id), ['command-code'])
check.same('and leaves the namespace unclaimed instead of throwing', bare.binds.length, 0)
check.ok('the account half still renders without a settings scope', bareView.texts.includes('ada'))

process.exit(process.exitCode ?? 0)
