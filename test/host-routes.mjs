/**
 * Live verification of the host half's two routes.
 *
 * Mounts `lib/index.js` against a fake Cordis context, captures the routes it
 * registers, and invokes their handlers. This one talks to the real Command Code
 * API, so it is opt-in: without a key it prints how to enable itself and exits 0.
 *
 *   COMMANDCODE_API_KEY=user_… node test/host-routes.mjs
 *
 * The key is read from the environment and never printed.
 *
 * @module commandcode-dash/test/host-routes
 */

import { check, root } from './helpers.mjs'

const key = process.env.COMMANDCODE_API_KEY
if (key === undefined || key === '') {
  console.log('host-routes')
  console.log('  SKIP  set COMMANDCODE_API_KEY to exercise the live routes')
  process.exit(0)
}

const mod = await import(`${root}/lib/index.js`)

/** Mount the plugin against a fake context and return its captured routes. */
function mount(withKey) {
  const routes = new Map()
  mod.apply({
    effect: (fn) => fn(),
    connection: {
      fetch: {
        register: (route) => {
          routes.set(route.path, route)
          return () => Promise.resolve()
        },
      },
    },
    get: (service) =>
      service === 'credentials'
        ? { resolve: async () => (withKey === undefined ? undefined : { value: withKey, source: 'file' }) }
        : undefined,
  })
  return routes
}

const call = (routes, name, init) =>
  routes.get(`/api/commandcode/${name}`).fetch(new Request(`http://127.0.0.1/api/commandcode/${name}`, init))

console.log('host-routes')
check.same('the plugin names itself', mod.name, 'commandcode-settings')
check.same('it depends only on the connection service', mod.inject, ['connection'])

// --- mounted routes -------------------------------------------------------
const routes = mount(key)
check.same('it registers both exact routes', [...routes.keys()], [
  '/api/commandcode/account',
  '/api/commandcode/models',
])
for (const [path, route] of routes) {
  check.same(`${path} is GET-only`, route.methods, ['GET'])
  check.same(`${path} buffers its body`, route.requestBody, 'buffered')
}

// --- account --------------------------------------------------------------
const accountResponse = await call(routes, 'account')
const account = await accountResponse.json()
check.same('the account route answers HTTP 200', accountResponse.status, 200)
check.ok('the account route reports success', account.ok === true)
if (account.ok === true) {
  check.ok('it returns an account identity', typeof account.account.userName === 'string')
  check.ok('it returns a plan', typeof account.plan.planName === 'string')
  check.ok('it returns a credit balance', typeof account.credits.monthlyCredits === 'number')
  check.ok('it returns both usage windows', Boolean(account.windowLimits?.fiveHour && account.windowLimits?.weekly))
  check.ok('it returns billing-period totals', typeof account.period?.totalCount === 'number')
  check.ok('the key source is not leaked to the client', account.keySource === undefined)
} else {
  console.log(`        (account: ${String(account.code)} ${String(account.message)})`)
}

// --- models ---------------------------------------------------------------
const modelsResponse = await call(routes, 'models')
const models = await modelsResponse.json()
check.same('the models route answers HTTP 200', modelsResponse.status, 200)
check.ok('the models route reports success', models.ok === true)
if (models.ok === true) {
  check.ok('it returns a non-empty catalog', models.models.length > 0)
  check.ok('every entry has an id', models.models.every((m) => typeof m.id === 'string' && m.id !== ''))
  check.ok('context windows are mapped from context_length', models.models.every((m) => m.contextWindow === undefined || typeof m.contextWindow === 'number'))
  check.ok('claude ids are present in the catalog for the Anthropic route', models.models.some((m) => m.id.startsWith('claude-')))
}

// --- a bad key is reported, not thrown ------------------------------------
const badRoutes = mount('user_definitely_not_a_valid_key')
const bad = await (await call(badRoutes, 'account')).json()
check.same('an invalid key is reported as AUTH', bad.code, 'AUTH')

// --- no key at all --------------------------------------------------------
const savedHome = process.env.HOME
const noKeyRoutes = mount(undefined)
const noKey = await (await call(noKeyRoutes, 'account')).json()
process.env.HOME = savedHome
check.same('a missing key is reported as NO_KEY', noKey.code, 'NO_KEY')
check.ok('the failure message never contains a key', !JSON.stringify(noKey).includes('user_'))

process.exit(process.exitCode ?? 0)
