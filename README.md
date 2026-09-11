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

![The Command Code section: account, credit balances, and the 5-hour and weekly usage windows](https://raw.githubusercontent.com/Momonaka/commandcode-dash/main/docs/preview-account.png)

![The model catalog with its context windows and declared modalities](https://raw.githubusercontent.com/Momonaka/commandcode-dash/main/docs/preview-models.png)

## Requirements

- A DSH install with the `web` profile available.
- A Command Code plan with Provider API access — **every plan except Go**. The
  plugin surfaces a clear message rather than a generic error when the upstream
  answers `upgrade_required`.
- Node 20+ on the host (the plugin uses `AbortSignal.any`).

## Installation

### From npm

```sh
dsh plugin --profile web add commandcode-dash
```

The shortest path, and the only one with real version numbers: the package is
published to the public npm registry, so nothing is resolved through git and
`dsh plugin update` upgrades by version like any other dependency.

`dsh plugin` forwards to **pnpm**, which a stock Node install does not include.
Enable the bundled corepack shim once first:

```sh
corepack enable pnpm
```

### From GitHub

```sh
dsh plugin --profile web add github:Momonaka/commandcode-dash
```

Works without publishing anything, but pnpm pins the resolved commit in the
profile lockfile, so this path needs the explicit update step below to move
forward. It also cannot be used from a registry mirror that has not synced.

### From a local checkout

```sh
dsh plugin --profile web add "link:$HOME/dsh-plugins/commandcode-dash"
```

`link:` keeps the profile pointed at the checkout itself, so an edit there is
what the next boot loads — no reinstall per change. The host half imports
**nothing** from `@deepseek-ai/*`, so the checkout needs no build and no install
step of its own.

### It mounts itself

`commandcode-dash` is a DSH **bundle**: `package.json` declares
`dsh.bundle.patch`, and the patch file it names contributes the profile row
below.

```yaml
- insert:
    - id: commandcode
      name: commandcode-dash
```

`dsh plugin add` (and `update`) reconciles the installed state, finds that
declaration, and appends the package to the profile's `dsh.profile.bundles` list
— so the only step left after installing is a restart:

```sh
dsh --profile web
```

No edit to `cordis.patch.yml` is involved, and none should be made for this: a
second row with the id `commandcode` is a duplicate loader entry id, which fails
the boot. That file is applied *after* every bundle layer, so it remains the
place to opt out or retune:

```yaml
- id: commandcode
  disabled: true
```

### Verify

`commandcode` should appear at the end of the composed tree, with the profile
patch layer untouched:

```sh
dsh --profile web --dump-config | grep -A1 commandcode
```

### Upgrading from 0.1.0

0.1.0 was not a bundle and had to be mounted by hand, with the `insert` row
above pasted into the profile's `cordis.patch.yml`. That row and the bundle's own
insert are two entries sharing the id `commandcode`, which fails the boot. When
you update to 0.1.1 or later, reset that file to the empty array the profile
template ships with:

```yaml
[]
```

### Updating

```sh
dsh plugin --profile web update commandcode-dash
```

For an npm install that is the ordinary way to move to a new version. For a git
install it is **not optional**: pnpm resolves a git dependency once and pins the
resolved commit in the profile's lockfile, so re-running the install command
reports `Lockfile is up to date, resolution step is skipped` and leaves the old
code in place.

Restart `dsh web` afterwards either way: the browser half is snapshotted when the
plugin activates, so a running server keeps serving the old bundle until it
restarts.

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

### The model provider

Saving the key is the whole setup. Once it checks out, the section adds the
`llm-pi-ai` provider routes itself, using the catalog fetched from
`provider/v1/models`:

| Route | Protocol | Models |
|---|---|---|
| `commandcode` | `openai-completions` | everything except Claude |
| `commandcode-anthropic` | `anthropic-messages` | Claude, which Command Code only serves over `/messages` |

A route that already exists is never overwritten, so hand-tuned entries — including
per-model `input: [text, image]` declarations — survive an upgrade. Newly
provisioned models are declared text-only, because the catalog does not report
modalities; add them by hand in **Settings → Models** if you need them.

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
