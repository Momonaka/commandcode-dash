/**
 * Offline verification of the model-catalog merge rules.
 *
 * Runs the browser half's own `mergeModels` against small deterministic
 * fixtures, so every branch is exercised without a network call or a browser.
 * When `DSH_PACKAGES` points at a DSH install's `@deepseek-ai` directory, the
 * merged list is additionally validated against the real `llm-pi-ai` schema.
 *
 * @module commandcode-dash/test/sync-logic
 */

import { createRenderer } from './fake-react.mjs'
import { check, fixture, loadClientBundle } from './helpers.mjs'

const configured = fixture('configured')
const live = fixture('catalog').data.map((model) => ({
  id: model.id,
  name: model.name,
  contextWindow: model.context_length,
}))

const mod = await loadClientBundle({ react: createRenderer().react })
const { mergeModels, belongsOnRoute } = mod.__internals
if (mergeModels === undefined) {
  console.log('FAIL  the bundle no longer exports __internals.mergeModels')
  process.exit(1)
}

console.log('sync-logic')

// --- route protocol filter ------------------------------------------------
check.same('claude is excluded from the OpenAI-compatible route', belongsOnRoute('commandcode', 'claude-opus-5'), false)
check.same('a non-Claude id belongs on the OpenAI-compatible route', belongsOnRoute('commandcode', 'gpt-5.5'), true)
check.same('claude belongs on the Anthropic route', belongsOnRoute('commandcode-anthropic', 'claude-opus-5'), true)
check.same('a non-Claude id does not belong on the Anthropic route', belongsOnRoute('commandcode-anthropic', 'gpt-5.5'), false)

// --- the OpenAI-compatible route -----------------------------------------
const openai = mergeModels('commandcode', live, configured)
console.log('  openai route')
check.same('a catalog id that is not configured is added', openai.added, ['moonshotai/Kimi-K3'])
check.same('an entry with no context window is filled', openai.filled, ['gpt-5.5'])
check.same('a configured id the catalog dropped is reported', openai.removed, ['xai/grok-4.5'])
check.same(
  'the merged list is the configured entries plus the additions',
  openai.next.map((model) => model.id),
  [
    'deepseek/deepseek-v4-flash',
    'google/gemini-3.7-flash',
    'gpt-5.5',
    'xai/grok-4.5',
    'moonshotai/Kimi-K3',
  ],
)
check.same('no claude id leaks onto the OpenAI-compatible route', openai.next.filter((m) => m.id.startsWith('claude-')), [])

const gemini = openai.next.find((model) => model.id === 'google/gemini-3.7-flash')
check.same('a hand-declared modality list survives the merge', gemini.input, ['text', 'image'])

const kimi = openai.next.find((model) => model.id === 'moonshotai/Kimi-K3')
check.same('an added model declares no modality', kimi.input, undefined)
check.same('an added model takes the catalog context window', kimi.contextWindow, 1000000)

const gpt = openai.next.find((model) => model.id === 'gpt-5.5')
check.same('a filled entry takes the catalog context window', gpt.contextWindow, 400000)

const grok = openai.next.find((model) => model.id === 'xai/grok-4.5')
check.same('a dropped entry keeps the fields it had', grok.contextWindow, 500000)

const flash = openai.next.find((model) => model.id === 'deepseek/deepseek-v4-flash')
check.same('an unchanged entry is left alone', flash.contextWindow, 1000000)

// --- idempotence ----------------------------------------------------------
const again = mergeModels('commandcode', live, openai.next)
check.same('re-running over the merged list changes nothing', [again.added, again.filled, again.removed], [[], [], ['xai/grok-4.5']])

// --- the Anthropic route --------------------------------------------------
const anthropic = mergeModels('commandcode-anthropic', live, [])
check.same('the Anthropic route takes only claude', anthropic.added, ['claude-opus-5'])
check.same('the Anthropic route does not take non-claude', anthropic.added.filter((id) => !id.startsWith('claude-')), [])

// --- optional: the real llm-pi-ai schema ---------------------------------
const packages = process.env.DSH_PACKAGES
if (packages === undefined || packages === '') {
  console.log('  SKIP  llm-pi-ai schema check (set DSH_PACKAGES to a DSH @deepseek-ai directory)')
} else {
  const { Config } = await import(`${packages}/dsh-llm-pi-ai/lib/index.js`)
  const candidate = {
    providers: {
      commandcode: {
        api: 'openai-completions',
        baseURL: 'https://api.commandcode.ai/provider/v1',
        apiKeyEnv: 'COMMANDCODE_API_KEY',
        models: openai.next,
      },
    },
  }
  try {
    const value = Config(candidate)
    check.ok(`the merged list passes the real llm-pi-ai schema (${String(value.providers.commandcode.models.length)} models)`, true)
  } catch (error) {
    check.ok(`the merged list passes the real llm-pi-ai schema — ${error.message}`, false)
  }
}

process.exit(process.exitCode ?? 0)
