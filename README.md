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

![The Command Code section: account, credit balances, and the 5-hour and weekly usage windows](docs/preview-account.png)

![The model catalog with its context windows and declared modalities](docs/preview-models.png)

## Requirements

- A DSH install with the `web` profile available.
- A Command Code plan with Provider API access — **every plan except Go**. The
  plugin surfaces a clear message rather than a generic error when the upstream
  answers `upgrade_required`.
- Node 20+ on the host (the plugin uses `AbortSignal.any`).

## Installation

### From GitHub

`dsh plugin` forwards to **pnpm**, which a stock Node install does not include. Enable
the bundled corepack shim once, then install:

```sh
corepack enable pnpm
dsh plugin --profile web add github:Momonaka/commandcode-dash
```

Without pnpm that command stops with `dsh: pnpm not found on PATH`. If you would
rather not enable it, use the local-checkout path below — the plugin has no
dependencies, so a symlink is enough.

The install prints a `declares no dsh.bundle` warning. That is expected: the
plugin is mounted by the patch entry below rather than as a profile layer.

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

The profile's patch layer ships as an empty array containing `[]`. **Replace that
`[]`** with the entry below — leaving it in place and appending produces invalid
YAML and the profile refuses to boot. The file lives at
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

### Updating

pnpm resolves a git dependency once and pins the resolved commit in the profile's
lockfile, so **the install command will not update an existing install** — it
reports `Lockfile is up to date, resolution step is skipped` and leaves the old
code in place. Update explicitly:

```sh
dsh plugin --profile web update commandcode-dash
```

Restart `dsh web` afterwards: the browser half is snapshotted when the plugin
activates, so a running server keeps serving the old bundle until it restarts.

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
