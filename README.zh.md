# commandcode-dash

[English](README.md) | 中文

> 在 DeepSeek Harness 的设置面板里，直接查看 Command Code 的 credits、用量窗口与模型目录。
>
> **非官方社区插件。** 与 DeepSeek 及 Command Code 均无隶属、背书或赞助关系。

[![CI](https://github.com/Momonaka/commandcode-dash/actions/workflows/ci.yml/badge.svg)](https://github.com/Momonaka/commandcode-dash/actions/workflows/ci.yml)
[![DSH](https://img.shields.io/badge/DSH-web%20plugin-4c6ef5)](#)
[![build](https://img.shields.io/badge/build-none-success)](#)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-339933)](#)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）
Web 插件，在设置面板中新增 **Command Code** 分区，让你不用离开界面就能回答两个问题：

- **还剩多少？** 套餐、credits 余额、5 小时与每周用量窗口（含实时重置倒计时），
  以及本计费周期的统计。
- **我能跑什么？** 已配置的模型目录与 `provider/v1/models` 实时目录的差异对比，
  并可一键同步。

## 功能特性

| | |
|---|---|
| **Credits** | 来自实时计费接口的月度、购买与赠送 credits 余额。 |
| **用量窗口** | 5 小时与每周窗口，显示 `used / cap`（已用 / 上限）、进度条，以及会自行走动的 `resets in …` 倒计时（不重新请求）。 |
| **计费周期** | 请求数、成功率、消耗 credits 与 Token 总量。 |
| **模型目录** | 列出每个已配置模型及其上下文窗口与模态，支持搜索。 |
| **目录同步** | 对比实时目录与你的配置，然后在你确认后执行新增、补齐上下文窗口与移除。 |
| **引导卡片** | 未配置 key 时，该分区会变成一个表单，以只写方式保存 key。 |

## 界面预览

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

## 环境要求

- 一份可用 `web` profile 的 DSH 安装。
- 一个有 Provider API 权限的 Command Code 套餐 —— **除 Go 之外的套餐都可以**。
  上游返回 `upgrade_required` 时，插件会给出明确提示而非笼统报错。
- 主机侧 Node 20+（插件用到了 `AbortSignal.any`）。

## 安装

### 从 GitHub 安装

```sh
dsh plugin --profile web add github:Momonaka/commandcode-dash
```

### 从本地检出安装

```sh
git clone https://github.com/Momonaka/commandcode-dash ~/dsh-plugins/commandcode-dash
mkdir -p "${DSH_HOME:-$HOME/.dsh}/profiles/web/node_modules"
ln -sfn ~/dsh-plugins/commandcode-dash \
        "${DSH_HOME:-$HOME/.dsh}/profiles/web/node_modules/commandcode-dash"
```

一个软链就够了，因为主机半**零 import** —— 不需要从 profile 自己的
`node_modules` 解析任何 `@deepseek-ai/*` 说明符，所以该包无需真正的安装步骤
即可工作。

### 挂载插件

把条目加到 profile 的 patch 层
`${DSH_HOME:-$HOME/.dsh}/profiles/web/cordis.patch.yml`：

```yaml
- insert:
    - id: commandcode
      name: commandcode-dash
```

然后重启 web profile：

```sh
dsh --profile web
```

### 验证

`commandcode` 应出现在组装树的末尾：

```sh
dsh --profile web --dump-config | grep -A1 commandcode
```

## 配置

### API key

key 只从一处读取：harness 凭据库中引用名为 `COMMANDCODE_API_KEY` 的记录。
本分区自带的引导卡片会写入该处，也可以手工添加：

```yaml
# ${DSH_HOME:-$HOME/.dsh}/.credentials.yaml
refs:
  COMMANDCODE_API_KEY: user_…
```

它在主机侧按请求解析，因此保存后下次刷新即生效，无需重启。

插件刻意**不**读取 Command Code CLI 的私有状态（`~/.commandcode/auth.json`
之类）。在这个部署里，harness 凭据库才是声明的唯一可信来源；去翻另一个工具的
文件既出人意料，也不合适。

### 模型路由

该分区管理的是你 `llm-pi-ai` 中 Command Code 路由上的模型。如果还没有配置，
请先到「设置 → 模型」添加一条 —— 例如一条指向
`https://api.commandcode.ai/provider/v1` 的 `openai-completions` 路由 ——
再回来同步它的目录。

## 工作原理

两半，且都不需要构建步骤：

- **`lib/index.js` —— 主机半。** 一个 Cordis 插件，通过
  `ctx.connection.fetch.register` 在连接的共享 `/api` 通道上注册两条 exact
  路由：`/api/commandcode/account` 与 `/api/commandcode/models`。可信校验与
  浏览器会话鉴权由该通道在处理函数运行前完成。API key 在这里解析，绝不进入
  浏览器 —— 只有上游响应体会跨过去。
- **`lib/client.js` —— 浏览器半。** 手写的 lazy-CJS bundle，形态与
  `dsh-client-modules` 所提供的一致，只从 shell 的平台模块表里加载 `react`。
  它贡献一个 `settings.section`（导航 id 为 `command-code`），并用普通标签与
  自带 CSS 渲染面板。

所有上游结果都以 HTTP 200 加一个 `ok` 判别字段返回，因此 Command Code 的失败
绝不会与 `/api` 通道自身的会话鉴权失败混淆。

> **为什么不用带类型的 Remote？** `@deepseek-ai/dsh-api-remotes` 中浏览器侧的
> remote 描述符表是构建期聚合的产物，而已发布的 client 不会在运行时发现主机
> 服务。因此不重新构建该包，就无法为 out-of-tree 插件新增 Remote —— 所以主机
> 侧改为暴露一条普通的已鉴权路由。

### 为什么不用 shell 调 `cmd /usage`

`cmd /usage` 是交互式斜杠命令，驱动它就意味着解析 TUI。它那个界面背后就是四个
普通 HTTP 接口，用同一份凭据即可鉴权：

| 接口 | 用途 |
|---|---|
| `GET /alpha/whoami` | 账号身份 |
| `GET /alpha/billing/credits` | credits 余额 + 5 小时 / 每周窗口 |
| `GET /alpha/billing/subscriptions` | 套餐 ID、状态、续费日期 |
| `GET /alpha/usage/summary` | 计费周期统计 |
| `GET /provider/v1/models` | 实时模型目录 |

## 模型同步规则

- 目录会按目标路由的协议过滤：`openai-completions` 路由排除 `claude-*`，而
  `anthropic-messages` 路由只保留它们 —— Command Code 会拒绝在
  `/chat/completions` 上的 Claude，以及在 `/messages` 上的非 Claude 模型。
- 已存在的条目会完整保留它已有的每个字段，包括手工写下的
  `input: [text, image]`。只有缺失的 `contextWindow` 会被补上。
- 新 id 以**纯文本**方式追加。Provider API 不返回模态信息，而少声明是安全的
  方向：图片会在附加前被拒，过度声明则只会在回合中途被上游拒绝。
- 目录已不再服务的已配置 id 会被报告并保留；移除它们是另一个独立操作。

## 开发

没有需要编译的东西 —— `lib/index.js` 与 `lib/client.js` 就是交付产物。全部验证由
三套离线校验完成，都不需要浏览器、运行中的 DSH 或网络：

```sh
npm test
```

1. **`test/sync-logic.mjs`** —— 用确定性 fixtures 跑真实的 `mergeModels`，断言下方
   的同步规则：手工声明的模态得以保留、Claude 不会混进 OpenAI 兼容路由、已下线的
   id 会被保留并报告，且重复执行不会再产生变更。把 `DSH_PACKAGES` 指向某个 DSH
   安装的 `@deepseek-ai` 目录，还会额外用真实的 `llm-pi-ai` schema 校验合并结果。
2. **`test/render.mjs`** —— 用最小化的 React 替身（按调用顺序实现 hooks）渲染真实
   的分区组件，再遍历元素树。分 `ok`、`no-key`、`auth` 三种场景运行，并断言所有
   模型都被列出、没有任何截断。
3. **`test/host-routes.mjs`** —— 实时主机检查。因为是拿你的 key 打真实 API，所以是
   按需启用：

   ```sh
   COMMANDCODE_API_KEY=user_… npm run test:live
   ```

CI 会在每次 push 与 pull request 时，用 Node 20 与 22 运行 `npm test`。

浏览器半导出的 `__internals`（纯合并函数）只是测试接缝，插件加载器会忽略它。

改动 `lib/client.js` 后需要重启 `dsh web`。客户端 bundle 在插件激活时被快照，
新字节只能通过 HMR 钩子进入，而该钩子在 `web` profile 中是关闭的。

## 已知限制

- **通用导航图标。** 设置外壳按 section id 用一张硬编码表映射导航图标
  （`models`、`agent-presets`、`plugins`）；自定义 id 会回退到齿轮图标。要做
  专属图标就得修改外壳包本身。
- **新模型为纯文本。** 见上方的同步规则 —— 模态是手工声明的，不是发现的。
- **不自动刷新。** credits 只在该分区打开或你按下 Refresh 时获取，不会定时拉取。

## 免责声明

这是一个**非官方、社区构建**的插件。它与 DeepSeek 及 Command Code 均无隶属、
背书或赞助关系，也不属于这两者的任何产品。「DeepSeek」「DeepSeek Harness」
「Command Code」是各自所有者的商标，此处仅用于说明本插件与什么互操作。

它使用**你自己的** API key 访问 Command Code 的 Provider API，走的是 Command
Code CLI 自己那个用量界面所用的同一批接口。除此之外不向任何地方发送数据，除了
harness 已经持有的凭据之外也不存储任何东西。

那些接口属于该 CLI 的内部实现，而非公开的正式契约，因此可能随时变更 —— 围绕
API 访问的套餐规则同样如此。一旦发生变更，本面板会报错而不是静默失败，修复则
意味着更新本插件。请自行斟酌使用。

## 许可证

[MIT](LICENSE) © Momonaka

本项目与 DeepSeek 及 Command Code 无隶属或背书关系。
