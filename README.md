# commandcode-dash

English | [中文](README.zh.md)

> Command Code credits, usage windows, and model catalog — inside the DeepSeek Harness settings panel.
>
> **Unofficial community plugin.** Not affiliated with, endorsed by, or sponsored by DeepSeek or Command Code.

[![CI](https://github.com/Momonaka/commandcode-dash/actions/workflows/ci.yml/badge.svg)](https://github.com/Momonaka/commandcode-dash/actions/workflows/ci.yml)
[![DSH](https://img.shields.io/badge/DSH-web%20plugin-4c6ef5)](#)
[![build](https://img.shields.io/badge/build-none-success)](#)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-339933)](#)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) web
plugin that adds a **Command Code** section to the settings panel, so you can
answer two questions without leaving the GUI:

- **How much is left?** Plan, credit balance, the 5-hour and weekly usage windows
  with live reset countdowns, and the current billing period's totals.
- **What can I run?** The configured model catalog, diffed against the live
  `provider/v1/models` catalog — with a one-click sync.

## Features

| | |
|---|---|
| **Credits** | Monthly, purchased, and free credit balances from the live billing API. |
| **Usage windows** | 5-hour and weekly windows as `used / cap` with progress bars and `resets in …` countdowns that tick without refetching. |
| **Billing period** | Requests, success rate, credits consumed, and token totals. |
| **Model catalog** | Every configured model with context window and modality, searchable. |
| **Catalog sync** | Diffs the live catalog against your config, then applies additions, context-window fills, and removals — each on your say-so. |
| **Setup card** | When no key is configured, the section becomes a form that stores one write-only. |

## Preview

```
Settings      Command Code                            ⟳ Refresh
────────      ────────────────────────────────────────────────
 General      Account
 Models       ada · Ada Lovelace
▶Command      ada@example.com
 Code         [ GOAT ]  active: active  renews Oct 10, 2026
 Plugins
              Credits
              Monthly credits          68.46
              Purchased credits         0.00
              Free credits              0.00

              Usage windows
              5-hour      0.02 / 14      resets in 2h 14m
                          ▏                        0.1%
              Weekly      1.54 / 35      resets in 6d 3h
                          █▏                       4.4%

              This billing period
              Requests 580   Success 100%  Credits used 1.60
              Tokens 76.6M   Tokens in 76.2M  Tokens out 0.41M
```

## Requirements

- A DSH install with the `web` profile available.
- A Command Code plan with Provider API access — **every plan except Go**. The
  plugin surfaces a clear message rather than a generic error when the upstream
  answers `upgrade_required`.
- Node 20+ on the host (the plugin uses `AbortSignal.any`).

## Installation

### From GitHub

```sh
dsh plugin --profile web add github:Momonaka/commandcode-dash
```

### From a local checkout

```sh
git clone https://github.com/Momonaka/commandcode-dash ~/dsh-plugins/commandcode-dash
mkdir -p "${DSH_HOME:-$HOME/.dsh}/profiles/web/node_modules"
ln -sfn ~/dsh-plugins/commandcode-dash \
        "${DSH_HOME:-$HOME/.dsh}/profiles/web/node_modules/commandcode-dash"
```

The symlink is enough because the host half imports **nothing** — no
`@deepseek-ai/*` specifier has to resolve from the profile's own
`node_modules`, so the package works without a real install step.

### Mount the plugin

Add the entry to the profile's patch layer at
`${DSH_HOME:-$HOME/.dsh}/profiles/web/cordis.patch.yml`:

```yaml
- insert:
    - id: commandcode
      name: commandcode-dash
```

Then restart the web profile:

```sh
dsh --profile web
```

### Verify

`commandcode` should appear at the end of the composed tree:

```sh
dsh --profile web --dump-config | grep -A1 commandcode
```

## Configuration

### The API key

The key is read from exactly one place: the harness credential store, under the
reference `COMMANDCODE_API_KEY`. The section's own setup card writes it there,
or you can add it by hand:

```yaml
# ${DSH_HOME:-$HOME/.dsh}/.credentials.yaml
refs:
  COMMANDCODE_API_KEY: user_…
```

It is resolved host-side once per request, so saving one takes effect on the next
refresh — no restart.

The plugin deliberately does **not** read the Command Code CLI's private state
(`~/.commandcode/auth.json` and friends). The harness credential store is the
declared source of truth for this deployment, and reaching into another tool's
files would be surprising.

### Model routes

The section manages the models on your `llm-pi-ai` Command Code routes. If none
are configured yet, add one in **Settings → Models** first — for example an
`openai-completions` route at `https://api.commandcode.ai/provider/v1` — then
come back to sync its catalog.

## How it works

Two halves, and no build step for either:

- **`lib/index.js` — the host half.** A Cordis plugin registering two exact
  routes on the connection's shared `/api` channel via
  `ctx.connection.fetch.register`: `/api/commandcode/account` and
  `/api/commandcode/models`. Trust checks and browser-session authentication are
  applied by that channel before the handlers run. The API key is resolved here
  and never reaches the browser — only the upstream response body crosses.
- **`lib/client.js` — the browser half.** A hand-authored lazy-CJS bundle in the
  shape `dsh-client-modules` serves, requiring only `react` from the shell's
  platform module table. It contributes a `settings.section` (nav id
  `command-code`) and renders the panel with plain markup and its own CSS.

Every upstream outcome is returned as HTTP 200 with an `ok` discriminator, so a
Command Code failure can never be confused with the `/api` channel's own session
authentication failure.

> **Why not a typed Remote?** The browser-side remote descriptor table in
> `@deepseek-ai/dsh-api-remotes` is a build-time aggregate, and the shipped
> client does not discover host services at runtime. A new Remote therefore
> cannot be added to an out-of-tree plugin without rebuilding that package — so
> the host exposes a plain authenticated route instead.

### Why not shell out to `cmd /usage`

`cmd /usage` is an interactive slash command, so driving it would mean parsing a
TUI. Its screen is backed by four ordinary HTTP endpoints, which the same
credential authenticates:

| Endpoint | Used for |
|---|---|
| `GET /alpha/whoami` | account identity |
| `GET /alpha/billing/credits` | credit balance + 5-hour/weekly windows |
| `GET /alpha/billing/subscriptions` | plan id, status, renewal date |
| `GET /alpha/usage/summary` | billing-period totals |
| `GET /provider/v1/models` | live model catalog |

## Model sync rules

- The catalog is filtered by the target route's protocol: `openai-completions`
  routes exclude `claude-*` ids, and an `anthropic-messages` route keeps only
  those — Command Code rejects Claude on `/chat/completions` and non-Claude on
  `/messages`.
- Existing entries keep every field they already carry, including a hand-written
  `input: [text, image]`. Only a missing `contextWindow` is filled in.
- New ids are appended **text-only**. The Provider API does not report
  modalities, and under-claiming one is the safe direction: an image is refused
  before it is attached, whereas over-claiming is only refused upstream,
  mid-turn.
- Configured ids the catalog no longer serves are reported and kept; removing
  them is a separate action.

## Development

There is nothing to compile — `lib/index.js` and `lib/client.js` are the shipped
artifacts. Everything is verified by three offline harnesses, none of which needs
a browser, a running DSH, or a network call:

```sh
npm test
```

1. **`test/sync-logic.mjs`** — runs the real `mergeModels` against deterministic
   fixtures and asserts the sync rules below: hand-declared modalities survive,
   Claude never leaks onto the OpenAI-compatible route, dropped ids are kept and
   reported, and re-running changes nothing. Point `DSH_PACKAGES` at a DSH
   install's `@deepseek-ai` directory to additionally validate the merged list
   against the real `llm-pi-ai` schema.
2. **`test/render.mjs`** — renders the actual section component through a minimal
   React-alike that implements hooks in call order, then inspects the element
   tree. Runs in three scenarios (`ok`, `no-key`, `auth`) and asserts every model
   is listed with no truncation.
3. **`test/host-routes.mjs`** — the live host check. Opt-in, because it calls the
   real API with your key:

   ```sh
   COMMANDCODE_API_KEY=user_… npm run test:live
   ```

CI runs `npm test` on Node 20 and 22 for every push and pull request.

The browser half exposes `__internals` (the pure merge helpers) purely as the
test seam; the plugin loader ignores it.

After changing `lib/client.js`, restart `dsh web`. Client bundles are snapshotted
when the plugin activates and new bytes only enter through the HMR hook, which is
disabled in the `web` profile.

## Limitations

- **Generic nav icon.** The settings shell maps nav icons by section id with a
  hardcoded table (`models`, `agent-presets`, `plugins`); a custom id falls back
  to the gear glyph. A bespoke icon would mean editing the shell package.
- **Text-only new models.** See the sync rules above — modalities are declared by
  hand, not discovered.
- **No automatic refresh.** Credits are fetched when the section opens or when
  you press Refresh, never on a timer.

## Disclaimer

This is an **unofficial, community-built** plugin. It is not affiliated with,
endorsed by, or sponsored by DeepSeek or Command Code, and it is not part of
either product. "DeepSeek", "DeepSeek Harness", and "Command Code" are
trademarks of their respective owners, used here only to describe what this
plugin interoperates with.

It talks to Command Code's Provider API using **your own** API key, over the same
endpoints the Command Code CLI uses for its own usage screen. Nothing is sent
anywhere else, and nothing is stored beyond the credential the harness already
holds.

Those endpoints are the CLI's internals rather than a documented public
contract, so they can change without notice — as can the plan rules around API
access. If one does, the panel reports an error instead of failing silently, and
a fix means updating this plugin. Use it at your own discretion.

## License

[MIT](LICENSE) © Momonaka

This project is not affiliated with or endorsed by DeepSeek or Command Code.
