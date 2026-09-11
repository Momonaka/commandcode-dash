# commandcode-dash

English | [中文](README.zh.md)

> Command Code credits, usage windows, and model catalog — inside the DeepSeek Harness settings panel.
>
> **Unofficial community plugin.** Not affiliated with DeepSeek or Command Code.

[![CI](https://github.com/Momonaka/commandcode-dash/actions/workflows/ci.yml/badge.svg)](https://github.com/Momonaka/commandcode-dash/actions/workflows/ci.yml)
[![DSH](https://img.shields.io/badge/DSH-web%20plugin-4c6ef5)](#)
[![build](https://img.shields.io/badge/build-none-success)](#)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-339933)](#)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) web
plugin that adds a **Command Code** section to the settings panel:

- Plan, credit balance, the 5-hour and weekly usage windows with live reset
  countdowns, and the current billing period's totals.
- The configured model catalog, diffed against the live `provider/v1/models`
  catalog — with a one-click sync.

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
- A Command Code plan with Provider API access — **every plan except Go**.
- Node 20+ on the host (the plugin uses `AbortSignal.any`).

## Installation

### From npm

```sh
dsh plugin --profile web add commandcode-dash
```

Restart `dsh web`.

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

## Disclaimer

This is an **unofficial, community-built** plugin. It is not affiliated with,
endorsed by, or sponsored by DeepSeek or Command Code, and it is not part of
either product.

It talks to Command Code's Provider API using **your own** API key, over the same
endpoints the Command Code CLI uses for its own usage screen. Nothing is sent
anywhere else.
