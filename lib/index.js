/**
 * Command Code settings plugin — host half.
 *
 * Exposes two authenticated read-only routes on the connection's shared `/api`
 * channel. The Command Code API key is resolved here, on the host, and never
 * crosses to the browser: only the upstream response body does.
 *
 * The key comes from exactly one place — the harness credential store, under
 * the `COMMANDCODE_API_KEY` reference. This plugin deliberately does not read
 * the Command Code CLI's own state (`~/.commandcode/auth.json`): the harness
 * credential store is the user's declared source of truth, and reaching into a
 * third-party tool's private files is not this plugin's business.
 *
 * Zero package dependencies on purpose. This plugin is installed out of tree in
 * the profile's own node_modules, where `@deepseek-ai/*` specifiers do not
 * resolve, so it uses the injected Cordis services only.
 *
 * @module commandcode-dash
 */

/** Cordis plugin name. */
export const name = 'commandcode-settings'

/**
 * The connection service owns the `/api` channel this plugin registers on;
 * trust checks and browser-session authentication are applied by that channel
 * before any handler here runs. Credentials are read optionally through
 * `ctx.get` so the plugin still loads when no credential store is mounted.
 */
export const inject = ['connection']

/** Command Code public API origin. */
const API_BASE = 'https://api.commandcode.ai'

/** Credential reference holding the Command Code API key. */
const KEY_REF = 'COMMANDCODE_API_KEY'

/** Upstream deadline for one Command Code request. */
const TIMEOUT_MS = 10_000

/** Monthly credit allowance per plan id, used for the usage percentage. */
const PLAN_TOTALS = {
  'individual-go': 10,
  'individual-goat': 70,
  'individual-pro': 30,
  'individual-pro-v1': 80,
  'individual-provider': 15,
  'individual-max': 150,
  'individual-ultra': 300,
  'teams-pro': 40,
}

/** Display name per plan id. */
const PLAN_LABELS = {
  'individual-go': 'Go',
  'individual-goat': 'GOAT',
  'individual-pro': 'Pro',
  'individual-pro-v1': 'Pro',
  'individual-provider': 'Provider',
  'individual-max': 'Max',
  'individual-ultra': 'Ultra',
  'teams-pro': 'Teams Pro',
}

/**
 * Read the Command Code API key from the harness credential store.
 *
 * Resolution runs per request, so a key saved through the GUI or written into
 * `~/.dsh/.credentials.yaml` takes effect without a restart. A missing store or
 * a store failure both answer "no key", which surfaces as the setup card rather
 * than an error.
 *
 * @param ctx - host plugin context.
 * @returns the key, or undefined when none is configured.
 */
async function resolveKey(ctx) {
  const credentials = ctx.get('credentials')
  if (credentials === undefined) return undefined
  try {
    // A CredentialRef is a branded string at runtime; the plain name is exact.
    const resolved = await credentials.resolve(KEY_REF)
    const value = resolved?.value
    return typeof value === 'string' && value.length > 0 ? value : undefined
  } catch {
    return undefined
  }
}

/**
 * Map one upstream failure onto the plugin's stable failure vocabulary.
 *
 * @param status - upstream HTTP status.
 * @param body - parsed upstream body, when it was JSON.
 * @param text - raw upstream body, used when JSON parsing failed.
 * @returns `{ code, message }`; the message never contains the key.
 */
function failureFrom(status, body, text) {
  const detail = body?.error
  const message =
    (typeof detail?.message === 'string' && detail.message) ||
    (typeof body?.message === 'string' && body.message) ||
    (typeof text === 'string' && text.trim() !== '' && text.trim().slice(0, 300)) ||
    `HTTP ${String(status)}`
  if (status === 401) return { code: 'AUTH', message }
  if (status === 403) {
    const code = String(detail?.code ?? detail?.type ?? '').toLowerCase()
    return code.includes('upgrade')
      ? { code: 'UPGRADE_REQUIRED', message }
      : { code: 'AUTH', message }
  }
  if (status === 429) return { code: 'RATE_LIMIT', message }
  if (status === 422) return { code: 'UPSTREAM', message }
  if (status >= 500) return { code: 'SERVER', message }
  return { code: 'UPSTREAM', message }
}

/**
 * Perform one authenticated GET against the Command Code API.
 *
 * @param path - absolute API path.
 * @param key - bearer key.
 * @param signal - caller cancellation.
 * @returns `{ ok: true, body }` or `{ ok: false, failure }`.
 */
async function apiGet(path, key, signal) {
  let response
  try {
    response = await fetch(API_BASE + path, {
      headers: { authorization: `Bearer ${key}`, accept: 'application/json' },
      signal,
    })
  } catch (error) {
    if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
      return { ok: false, failure: { code: 'TIMEOUT', message: 'Command Code did not answer in time.' } }
    }
    return { ok: false, failure: { code: 'NETWORK', message: String(error?.message ?? error) } }
  }
  const text = await response.text().catch(() => '')
  let body
  try {
    body = text === '' ? undefined : JSON.parse(text)
  } catch {
    body = undefined
  }
  if (!response.ok) return { ok: false, failure: failureFrom(response.status, body, text) }
  if (body === undefined) {
    return { ok: false, failure: { code: 'UPSTREAM', message: 'Command Code returned a non-JSON body.' } }
  }
  return { ok: true, body }
}

/**
 * Build the JSON response envelope shared by both routes.
 *
 * Every upstream outcome is reported as HTTP 200 with an `ok` discriminator, so
 * a Command Code failure can never be mistaken for the `/api` channel's own
 * session-authentication failure by anything sitting in front of this handler.
 *
 * @param payload - JSON-serializable body.
 * @param status - HTTP status; reserved for host-side defects.
 * @returns the response.
 */
function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

/**
 * Handler for `GET /api/commandcode/account`.
 *
 * @param ctx - host plugin context.
 * @param request - already-authenticated request.
 * @returns the account, plan, credits, usage windows, and period totals.
 */
async function handleAccount(ctx, request) {
  const key = await resolveKey(ctx)
  if (key === undefined) {
    return json({ ok: false, code: 'NO_KEY', message: 'No Command Code API key is configured.' })
  }
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(TIMEOUT_MS)])
  const [whoami, credits, subscriptions, summary] = await Promise.all([
    apiGet('/alpha/whoami', key, signal),
    apiGet('/alpha/billing/credits', key, signal),
    apiGet('/alpha/billing/subscriptions', key, signal),
    apiGet('/alpha/usage/summary', key, signal),
  ])
  const failed = [whoami, credits, subscriptions, summary].find((r) => !r.ok)
  if (failed !== undefined) {
    return json({ ok: false, ...failed.failure })
  }
  const subscription = subscriptions.body?.data
  const planId = typeof subscription?.planId === 'string' ? subscription.planId : undefined
  return json({
    ok: true,
    fetchedAt: Date.now(),
    account: {
      name: whoami.body?.user?.name,
      userName: whoami.body?.user?.userName,
      email: whoami.body?.user?.email,
      org: whoami.body?.org ?? null,
    },
    plan: {
      planId,
      planName: planId === undefined ? undefined : (PLAN_LABELS[planId] ?? planId),
      totalCredits: planId === undefined ? undefined : PLAN_TOTALS[planId],
      status: subscription?.status,
      currentPeriodStart: subscription?.currentPeriodStart,
      currentPeriodEnd: subscription?.currentPeriodEnd,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd,
    },
    credits: credits.body?.credits,
    windowLimits: credits.body?.windowLimits,
    period: summary.body,
  })
}

/**
 * Handler for `GET /api/commandcode/models`.
 *
 * @param ctx - host plugin context.
 * @param request - already-authenticated request.
 * @returns the live Provider API model catalog.
 */
async function handleModels(ctx, request) {
  const key = await resolveKey(ctx)
  if (key === undefined) {
    return json({ ok: false, code: 'NO_KEY', message: 'No Command Code API key is configured.' })
  }
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(TIMEOUT_MS)])
  const result = await apiGet('/provider/v1/models', key, signal)
  if (!result.ok) return json({ ok: false, ...result.failure })
  const rows = Array.isArray(result.body?.data) ? result.body.data : []
  const models = rows
    .filter((row) => typeof row?.id === 'string' && row.id !== '')
    .map((row) => ({
      id: row.id,
      name: typeof row.name === 'string' && row.name !== '' ? row.name : row.id,
      contextWindow: typeof row.context_length === 'number' ? row.context_length : undefined,
    }))
  return json({ ok: true, fetchedAt: Date.now(), models })
}

/**
 * Register the plugin's two routes on the shared `/api` channel.
 *
 * @param ctx - host plugin context.
 */
export function apply(ctx) {
  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: '/api/commandcode/account',
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: (request) => handleAccount(ctx, request),
      }),
    'commandcode-settings: account route',
  )
  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: '/api/commandcode/models',
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: (request) => handleModels(ctx, request),
      }),
    'commandcode-settings: models route',
  )
}
