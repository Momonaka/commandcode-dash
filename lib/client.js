/**
 * Command Code settings plugin — browser half.
 *
 * Hand-authored lazy-CJS bundle in the shape `dsh-client-modules` serves and
 * `window.__ModuleLoader__` materializes. It is deliberately built with plain
 * `React.createElement` over markup the plugin styles itself, and requires only
 * `react` from the shell's platform module table — no build step, no external
 * module requests, and no guessing at another package's private component API.
 *
 * Everything privileged (the Command Code API key) stays on the host: this half
 * only calls the plugin's own two authenticated `/api/commandcode/*` routes.
 *
 * @module commandcode-dash/client
 */

window.__ModuleLoader__.load({
  id: 'commandcode-dash',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const React = require('react')
    const { useCallback, useEffect, useMemo, useRef, useState } = React
    const h = React.createElement

    /** Settings section id (stable; the shell's nav maps unknown ids to a gear). */
    const SECTION_ID = 'command-code'
    /** Credential reference the host resolves and the key form writes. */
    const KEY_REF = 'COMMANDCODE_API_KEY'
    /** pi-ai settings namespace and the routes this section provisions and syncs. */
    const PI_AI_NS = 'llm-pi-ai'
    /** The Anthropic-protocol route; every other route speaks OpenAI Chat Completions. */
    const ANTHROPIC_ROUTE = 'commandcode-anthropic'
    const ROUTES = ['commandcode', ANTHROPIC_ROUTE]
    /** Endpoint shared by both routes. */
    const PROVIDER_BASE_URL = 'https://api.commandcode.ai/provider/v1'
    /** Command Code serves Claude only over the Anthropic Messages endpoint. */
    const ANTHROPIC_PREFIX = 'claude-'

    // ---------------------------------------------------------------------
    // Copy
    // ---------------------------------------------------------------------

    const DICT = {
      en: {
        nav: 'Command Code',
        account: 'Account',
        credits: 'Credits',
        monthly: 'Monthly credits',
        purchased: 'Purchased credits',
        free: 'Free credits',
        windows: 'Usage windows',
        fiveHour: '5-hour',
        weekly: 'Weekly',
        resetIn: 'resets in',
        resetPending: 'reset pending',
        period: 'This billing period',
        requests: 'Requests',
        success: 'Success',
        creditsUsed: 'Credits used',
        tokens: 'Tokens',
        tokensIn: 'Tokens in',
        tokensOut: 'Tokens out',
        refresh: 'Refresh',
        models: 'Models',
        search: 'Search models…',
        configured: 'configured',
        served: 'served',
        inSync: 'in sync',
        pending: 'changes pending',
        apply: 'Apply',
        discard: 'Discard',
        removeMissing: 'Remove no-longer-served',
        connect: 'Connect your Command Code account',
        apiKey: 'Command Code API key',
        keyHelp: 'Create a key in Studio → API keys, then paste it here.',
        keyStored: 'Stored write-only in the harness credential store as COMMANDCODE_API_KEY.',
        saveKey: 'Save key',
        saving: 'Saving…',
        savingFailed: 'Could not save the key',
        retry: 'Retry',
        loading: 'Loading…',
        active: 'active',
        renews: 'renews',
        cancels: 'cancels',
        noRoute: 'No Command Code route is configured in llm-pi-ai yet.',
        noRouteHint: 'It is created automatically once your key checks out. If it stays empty, the settings document is read-only.',
        provisionWorking: 'Adding the Command Code model provider…',
        provisionDone: 'Added the model provider',
        provisionFailed: 'Could not add the model provider',
        provisionRetry: 'Try again',
        scopeUnavailable: 'Settings writes are unavailable in this browser session.',
        tableModel: 'Model',
        tableContext: 'Context',
        tableCaps: 'Capabilities',
        capText: 'text',
        capVision: 'vision',
        newlyAdded: 'new',
        noLongerServed: 'no longer served',
        errNoKey: 'No Command Code API key is configured.',
        errAuth: 'The Command Code API key was rejected.',
        errAuthHint: 'Generate a new key in Studio → API keys.',
        errUpgrade: 'API access requires the GOAT plan or higher.',
        errUpgradeHint: 'The Go plan has no Provider API access.',
        errRate: 'Command Code rate-limited this request.',
        errRateHint: 'Wait a moment, then retry.',
        errTimeout: 'Command Code did not answer in time.',
        errNetwork: 'Could not reach Command Code.',
        errServer: 'Command Code reported a server error.',
        errUpstream: 'Command Code rejected the request.',
      },
      zh: {
        nav: 'Command Code',
        account: '账号',
        credits: '余额',
        monthly: '月度 credits',
        purchased: '购买的 credits',
        free: '赠送 credits',
        windows: '用量窗口',
        fiveHour: '5 小时',
        weekly: '每周',
        resetIn: '重置倒计时',
        resetPending: '等待重置',
        period: '本计费周期',
        requests: '请求数',
        success: '成功率',
        creditsUsed: '消耗 credits',
        tokens: 'Tokens',
        tokensIn: '输入',
        tokensOut: '输出',
        refresh: '刷新',
        models: '模型',
        search: '搜索模型…',
        configured: '已配置',
        served: '服务端',
        inSync: '已同步',
        pending: '项待处理变更',
        apply: '应用',
        discard: '放弃',
        removeMissing: '移除已下线模型',
        connect: '连接你的 Command Code 账号',
        apiKey: 'Command Code API key',
        keyHelp: '在 Studio → API keys 创建，然后粘贴到这里。',
        keyStored: '以只写方式存入 harness 凭据库，引用名 COMMANDCODE_API_KEY。',
        saveKey: '保存 key',
        saving: '保存中…',
        savingFailed: 'key 保存失败',
        retry: '重试',
        loading: '加载中…',
        active: '生效中',
        renews: '续费于',
        cancels: '到期取消',
        noRoute: 'llm-pi-ai 里还没有配置 Command Code 路由。',
        noRouteHint: 'key 校验通过后会自动创建。若一直为空，说明设置文档是只读的。',
        provisionWorking: '正在添加 Command Code 模型提供方…',
        provisionDone: '已自动添加模型提供方',
        provisionFailed: '添加模型提供方失败',
        provisionRetry: '重试',
        scopeUnavailable: '当前浏览器会话无法写入设置。',
        tableModel: '模型',
        tableContext: '上下文',
        tableCaps: '能力',
        capText: '文本',
        capVision: '视觉',
        newlyAdded: '新增',
        noLongerServed: '已下线',
        errNoKey: '尚未配置 Command Code API key。',
        errAuth: 'Command Code API key 被拒绝。',
        errAuthHint: '请到 Studio → API keys 重新生成。',
        errUpgrade: 'API 访问需要 GOAT 及以上套餐。',
        errUpgradeHint: 'Go 套餐没有 Provider API 权限。',
        errRate: 'Command Code 触发了限流。',
        errRateHint: '稍等片刻后重试。',
        errTimeout: 'Command Code 响应超时。',
        errNetwork: '无法连接 Command Code。',
        errServer: 'Command Code 服务端错误。',
        errUpstream: 'Command Code 拒绝了该请求。',
      },
    }

    /** @returns 'zh' or 'en', from the document language the locale service maintains. */
    function currentLang() {
      const raw = document.documentElement.getAttribute('lang') || navigator.language || 'en'
      return String(raw).toLowerCase().startsWith('zh') ? 'zh' : 'en'
    }

    /** @returns the dictionary for the active language, re-rendering when it flips. */
    function useDict() {
      const [lang, setLang] = useState(currentLang)
      useEffect(() => {
        const observer = new MutationObserver(() => setLang(currentLang()))
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
        return () => observer.disconnect()
      }, [])
      return DICT[lang] || DICT.en
    }

    // ---------------------------------------------------------------------
    // Formatting
    // ---------------------------------------------------------------------

    /** @returns a fixed-point number, or an em dash for anything not finite. */
    function num(value, digits = 2) {
      return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—'
    }

    /** @returns a grouped integer, or an em dash. */
    function int(value) {
      return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('en-US') : '—'
    }

    /** @returns a compact token count (76.6M). */
    function tokens(value) {
      if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
      if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`
      if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`
      if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`
      return String(value)
    }

    /** @returns a coarse countdown to an epoch-millisecond instant. */
    function countdown(at, t) {
      if (typeof at !== 'number' || !Number.isFinite(at)) return ''
      const remaining = at - Date.now()
      if (remaining <= 0) return t.resetPending
      const minutes = Math.floor(remaining / 60000)
      const days = Math.floor(minutes / 1440)
      const hours = Math.floor((minutes % 1440) / 60)
      if (days > 0) return `${String(days)}d ${String(hours)}h`
      if (hours > 0) return `${String(hours)}h ${String(minutes % 60)}m`
      return `${String(minutes)}m`
    }

    /** @returns a short local date, or an em dash. */
    function shortDate(value) {
      if (typeof value !== 'string' || value === '') return '—'
      const at = new Date(value)
      return Number.isNaN(at.getTime())
        ? '—'
        : at.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    }

    /** @returns a 0-100 percentage of a cap, clamped for display. */
    function percent(used, cap) {
      if (typeof used !== 'number' || typeof cap !== 'number' || cap <= 0) return undefined
      return Math.min(100, Math.max(0, (used / cap) * 100))
    }

    // ---------------------------------------------------------------------
    // Data access
    // ---------------------------------------------------------------------

    /**
     * Fetch one plugin route.
     *
     * The host answers every upstream outcome as HTTP 200 with an `ok`
     * discriminator, so a Command Code failure is never confused with the
     * `/api` channel's own session authentication.
     *
     * @param path - plugin route path.
     * @param enabled - false leaves the resource idle.
     * @returns `[state, reload]`.
     */
    function useApi(path, enabled) {
      const [state, setState] = useState({ status: enabled ? 'loading' : 'idle' })
      const sequence = useRef(0)
      const load = useCallback(() => {
        if (!enabled) {
          setState({ status: 'idle' })
          return
        }
        const mine = (sequence.current += 1)
        setState({ status: 'loading' })
        fetch(path, { credentials: 'include', headers: { accept: 'application/json' } })
          .then(async (response) => {
            const text = await response.text()
            let body
            try {
              body = text === '' ? undefined : JSON.parse(text)
            } catch {
              body = undefined
            }
            if (mine !== sequence.current) return
            if (!response.ok || body === undefined) {
              setState({
                status: 'error',
                code: `HTTP_${String(response.status)}`,
                message: (body && body.message) || `HTTP ${String(response.status)}`,
              })
              return
            }
            setState({ status: 'ready', body })
          })
          .catch((error) => {
            if (mine !== sequence.current) return
            setState({ status: 'error', code: 'NETWORK', message: String((error && error.message) || error) })
          })
      }, [path, enabled])
      useEffect(() => {
        load()
      }, [load])
      return [state, load]
    }

    /**
     * Observe one settings namespace through the shared describe mirror.
     *
     * @param scope - bound settings scope, when the client could bind one.
     * @returns the current snapshot, or undefined.
     */
    function useScopeSnapshot(scope) {
      const [snapshot, setSnapshot] = useState(() => (scope ? scope.getSnapshot() : undefined))
      useEffect(() => {
        if (!scope) return undefined
        setSnapshot(scope.getSnapshot())
        return scope.subscribe(() => setSnapshot(scope.getSnapshot()))
      }, [scope])
      return snapshot
    }

    // ---------------------------------------------------------------------
    // Model catalog merge
    // ---------------------------------------------------------------------

    /** @returns true when a model id belongs on the given route's protocol. */
    function belongsOnRoute(route, id) {
      const isClaude = id.startsWith(ANTHROPIC_PREFIX)
      return route === 'commandcode-anthropic' ? isClaude : !isClaude
    }

    /**
     * Merge the live catalog into one route's configured list.
     *
     * Existing entries keep every field they already carry — crucially a
     * hand-declared `input: [text, image]` — and only gain a context window
     * when they had none. New ids are appended as text-only, because the
     * Provider API does not report modalities and under-claiming a modality is
     * the safe direction: images are refused before they are attached, whereas
     * over-claiming is only refused upstream, mid-turn.
     *
     * Configured ids the catalog no longer serves are reported, never dropped.
     *
     * @param route - route key being synced.
     * @param live - the live catalog.
     * @param configured - the route's configured model entries.
     * @returns the next list plus the change sets.
     */
    function mergeModels(route, live, configured) {
      const eligible = live.filter((model) => belongsOnRoute(route, model.id))
      const liveById = new Map(eligible.map((model) => [model.id, model]))
      const next = []
      const added = []
      const filled = []
      for (const entry of configured) {
        const seen = liveById.get(entry.id)
        if (seen === undefined) {
          next.push(entry)
          continue
        }
        if (entry.contextWindow === undefined && seen.contextWindow !== undefined) {
          filled.push(entry.id)
          next.push({ ...entry, contextWindow: seen.contextWindow })
        } else {
          next.push(entry)
        }
      }
      const known = new Set(configured.map((entry) => entry.id))
      for (const model of eligible) {
        if (known.has(model.id)) continue
        added.push(model.id)
        next.push({
          id: model.id,
          name: model.name,
          ...(model.contextWindow === undefined ? {} : { contextWindow: model.contextWindow }),
        })
      }
      const removed = configured.filter((entry) => !liveById.has(entry.id)).map((entry) => entry.id)
      return { next, added, filled, removed }
    }

    /**
     * Build the `llm-pi-ai` provider routes this plugin needs.
     *
     * A route pi-ai does not ship must declare its protocol, endpoint, and a
     * non-empty catalog, so the catalog fetched from the live API is what makes
     * a fresh install work without hand-editing `settings.yaml`.
     *
     * @param catalog - the live catalog, as the plugin's models route returns it.
     * @returns a route keyed by provider name; routes with no models are omitted.
     */
    function buildProviderRoutes(catalog) {
      const routes = {}
      for (const route of ROUTES) {
        const isAnthropic = route === ANTHROPIC_ROUTE
        const models = catalog
          .filter((model) => belongsOnRoute(route, model.id))
          .map((model) => ({
            id: model.id,
            name: model.name,
            ...(model.contextWindow === undefined ? {} : { contextWindow: model.contextWindow }),
          }))
        if (models.length === 0) continue
        routes[route] = {
          displayName: isAnthropic ? 'Command Code (Claude)' : 'Command Code',
          api: isAnthropic ? 'anthropic-messages' : 'openai-completions',
          baseURL: PROVIDER_BASE_URL,
          apiKeyEnv: KEY_REF,
          defaultContextWindow: 262144,
          defaultMaxTokens: 32768,
          // Usage is emitted on every stream; the switch is completions-only.
          ...(isAnthropic ? {} : { compat: { supportsUsageInStreaming: true } }),
          models,
        }
      }
      return routes
    }

    // ---------------------------------------------------------------------
    // Presentation
    // ---------------------------------------------------------------------

    /** One label/value stat. */
    function Stat(props) {
      return h(
        'div',
        { className: 'ccx-stat' },
        h('div', { className: 'ccx-statLabel' }, props.label),
        h('div', { className: 'ccx-statValue' }, props.value),
      )
    }

    /** A labelled usage window with a progress bar. */
    function WindowRow(props) {
      const t = props.t
      const used = props.window ? props.window.used : undefined
      const cap = props.window ? props.window.cap : undefined
      const pct = percent(used, cap)
      return h(
        'div',
        { className: 'ccx-window' },
        h(
          'div',
          { className: 'ccx-windowTop' },
          h('span', { className: 'ccx-windowName' }, props.name),
          h('span', { className: 'ccx-windowValue' }, `${num(used)} / ${num(cap, 0)}`),
        ),
        h(
          'div',
          { className: 'ccx-bar', role: 'presentation' },
          h('div', {
            className: props.window && props.window.exceeded ? 'ccx-barFill ccx-barOver' : 'ccx-barFill',
            style: { width: `${String(pct === undefined ? 0 : pct)}%` },
          }),
        ),
        h(
          'div',
          { className: 'ccx-windowFoot' },
          h('span', null, pct === undefined ? '—' : `${pct.toFixed(1)}%`),
          h('span', null, `${t.resetIn} ${countdown(props.window && props.window.resetAt, t)}`),
        ),
      )
    }

    /** The API-key form shown when no key can be resolved. */
    function KeyCard(props) {
      const t = props.t
      const [value, setValue] = useState('')
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState(undefined)
      const submit = useCallback(
        (event) => {
          event.preventDefault()
          const trimmed = value.trim()
          if (trimmed === '') return
          const credentials = props.credentials
          if (credentials === undefined) {
            setError(t.scopeUnavailable)
            return
          }
          setBusy(true)
          setError(undefined)
          Promise.resolve(credentials.set(KEY_REF, trimmed))
            .then(() => {
              setValue('')
              setBusy(false)
              props.onSaved()
            })
            .catch((err) => {
              setBusy(false)
              setError(`${t.savingFailed}: ${String((err && err.message) || err)}`)
            })
        },
        [value, props, t],
      )
      return h(
        'div',
        { className: 'ccx-card ccx-setup' },
        h('div', { className: 'ccx-cardTitle' }, t.connect),
        h(
          'form',
          { className: 'ccx-form', onSubmit: submit },
          h('label', { className: 'ccx-label', htmlFor: 'ccx-key' }, t.apiKey),
          h('input', {
            id: 'ccx-key',
            className: 'ccx-input',
            type: 'password',
            autoComplete: 'off',
            spellCheck: false,
            placeholder: 'user_…',
            value,
            disabled: busy,
            onChange: (event) => setValue(event.target.value),
          }),
          h('p', { className: 'ccx-help' }, t.keyHelp),
          h('p', { className: 'ccx-help' }, t.keyStored),
          error === undefined ? null : h('p', { className: 'ccx-error' }, error),
          h(
            'button',
            { className: 'ccx-button ccx-buttonPrimary', type: 'submit', disabled: busy || value.trim() === '' },
            busy ? t.saving : t.saveKey,
          ),
        ),
      )
    }

    /** The failure card for any non-NO_KEY problem. */
    function ErrorCard(props) {
      const t = props.t
      const code = props.code
      const headline =
        code === 'AUTH'
          ? t.errAuth
          : code === 'UPGRADE_REQUIRED'
            ? t.errUpgrade
            : code === 'RATE_LIMIT'
              ? t.errRate
              : code === 'TIMEOUT'
                ? t.errTimeout
                : code === 'NETWORK'
                  ? t.errNetwork
                  : code === 'SERVER'
                    ? t.errServer
                    : t.errUpstream
      const hint =
        code === 'AUTH'
          ? t.errAuthHint
          : code === 'UPGRADE_REQUIRED'
            ? t.errUpgradeHint
            : code === 'RATE_LIMIT'
              ? t.errRateHint
              : undefined
      return h(
        'div',
        { className: 'ccx-card ccx-errorCard' },
        h('div', { className: 'ccx-cardTitle' }, `⚠ ${headline}`),
        h('p', { className: 'ccx-error' }, props.message),
        hint === undefined ? null : h('p', { className: 'ccx-help' }, hint),
        h('button', { className: 'ccx-button', type: 'button', onClick: props.onRetry }, t.retry),
      )
    }

    /** Skeleton rows while a resource loads. */
    function LoadingCard() {
      return h(
        'div',
        { className: 'ccx-card' },
        h('div', { className: 'ccx-skel', style: { width: '55%' } }),
        h('div', { className: 'ccx-skel', style: { width: '35%' } }),
      )
    }

    /** The account, credits, windows, and period readout. */
    function AccountPanel(props) {
      const t = props.t
      const body = props.body
      const account = body.account || {}
      const plan = body.plan || {}
      const credits = body.credits || {}
      const limits = body.windowLimits || {}
      const period = body.period || {}
      return h(
        'div',
        { className: 'ccx-stack' },
        h(
          'div',
          { className: 'ccx-colHead' },
          h('h3', { className: 'ccx-h3' }, t.account),
          h(
            'div',
            { className: 'ccx-colActions' },
            h(
              'button',
              { className: 'ccx-button', type: 'button', onClick: props.onRefresh, disabled: props.busy },
              `⟳ ${t.refresh}`,
            ),
          ),
        ),
        h(
          'div',
          { className: 'ccx-card' },
          h('div', { className: 'ccx-identity' }, account.userName || account.name || '—'),
          account.name && account.userName ? h('div', { className: 'ccx-muted' }, account.name) : null,
          account.email ? h('div', { className: 'ccx-muted' }, account.email) : null,
          h(
            'div',
            { className: 'ccx-tags' },
            plan.planName === undefined ? null : h('span', { className: 'ccx-tag ccx-tagPlan' }, plan.planName),
            plan.status === undefined ? null : h('span', { className: 'ccx-tag' }, `${t.active}: ${plan.status}`),
            plan.currentPeriodEnd === undefined
              ? null
              : h(
                  'span',
                  { className: 'ccx-tag' },
                  `${plan.cancelAtPeriodEnd ? t.cancels : t.renews} ${shortDate(plan.currentPeriodEnd)}`,
                ),
          ),
        ),
        h(
          'div',
          { className: 'ccx-card' },
          h('h4', { className: 'ccx-h4' }, t.credits),
          h(
            'div',
            { className: 'ccx-grid3' },
            h(Stat, { label: t.monthly, value: num(credits.monthlyCredits) }),
            h(Stat, { label: t.purchased, value: num(credits.purchasedCredits) }),
            h(Stat, { label: t.free, value: num(credits.freeCredits) }),
          ),
        ),
        h(
          'div',
          { className: 'ccx-card' },
          h('h4', { className: 'ccx-h4' }, t.windows),
          h(WindowRow, { t, name: t.fiveHour, window: limits.fiveHour }),
          h(WindowRow, { t, name: t.weekly, window: limits.weekly }),
        ),
        h(
          'div',
          { className: 'ccx-card' },
          h('h4', { className: 'ccx-h4' }, t.period),
          h(
            'div',
            { className: 'ccx-grid3' },
            h(Stat, { label: t.requests, value: int(period.totalCount) }),
            h(Stat, { label: t.success, value: `${num(period.successRate, 0)}%` }),
            h(Stat, { label: t.creditsUsed, value: num(period.totalCredits) }),
            h(Stat, { label: t.tokens, value: tokens(period.totalTokens) }),
            h(Stat, { label: t.tokensIn, value: tokens(period.totalTokensIn) }),
            h(Stat, { label: t.tokensOut, value: tokens(period.totalTokensOut) }),
          ),
        ),
      )
    }

    /** Report of the automatic provider provisioning, shown above the model panel. */
    function ProvisionStatus(props) {
      const t = props.t
      const state = props.state
      if (state.status === 'working') {
        return h('div', { className: 'ccx-note' }, `⏳ ${t.provisionWorking}`)
      }
      if (state.status === 'done') {
        return h(
          'div',
          { className: 'ccx-note ccx-noteOk' },
          `✓ ${t.provisionDone}: ${state.routes.join(', ')} · ${String(state.count)} models`,
        )
      }
      return h(
        'div',
        { className: 'ccx-note ccx-noteErr' },
        h('span', null, `⚠ ${t.provisionFailed}: ${state.message}`),
        h('button', { className: 'ccx-button', type: 'button', onClick: props.onRetry }, t.provisionRetry),
      )
    }

    /** The per-route model catalog table with pending changes. */
    function ModelsPanel(props) {
      const t = props.t
      const [query, setQuery] = useState('')
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState(undefined)
      const live = props.live
      const section = props.section
      const scope = props.scope
      const revision = props.revision

      // Derived on every render rather than memoized on `section`: a settings
      // write can land as an in-place update of the resolved section, which
      // would leave an identity-keyed memo holding the pre-write routes.
      const providers = (section && section.providers) || {}
      const routes = ROUTES.filter((route) => providers[route] !== undefined).map((route) => ({
        route,
        displayName: providers[route].displayName || route,
        configured: Array.isArray(providers[route].models) ? providers[route].models : [],
      }))

      const plans = routes.map((entry) => ({
        ...entry,
        ...mergeModels(entry.route, live, entry.configured),
      }))

      const pendingTotal = plans.reduce((sum, plan) => sum + plan.added.length + plan.filled.length, 0)
      const missingTotal = plans.reduce((sum, plan) => sum + plan.removed.length, 0)

      const write = useCallback(
        async (plansToWrite) => {
          if (!scope) return
          setBusy(true)
          setError(undefined)
          try {
            await scope.mutate(
              plansToWrite.map((plan) => ({
                op: 'set',
                path: ['providers', plan.route, 'models'],
                value: plan.next,
              })),
              revision,
            )
          } catch (err) {
            setError(String((err && err.message) || err))
          } finally {
            setBusy(false)
          }
        },
        [scope, revision],
      )

      const apply = useCallback(() => {
        void write(plans.filter((plan) => plan.added.length > 0 || plan.filled.length > 0))
      }, [plans, write])

      const drop = useCallback(() => {
        void write(
          plans
            .filter((plan) => plan.removed.length > 0)
            .map((plan) => ({
              ...plan,
              next: plan.next.filter((model) => !plan.removed.includes(model.id)),
            })),
        )
      }, [plans, write])

      if (routes.length === 0) {
        return h(
          'div',
          { className: 'ccx-card' },
          h('h4', { className: 'ccx-h4' }, t.models),
          h('p', { className: 'ccx-help' }, t.noRoute),
          h('p', { className: 'ccx-help' }, t.noRouteHint),
        )
      }

      const needle = query.trim().toLowerCase()
      const allModels = plans.flatMap((plan) =>
        plan.next.map((model) => ({ ...model, route: plan.route, caps: model.input })),
      )
      /** Every configured model; the table scrolls rather than truncating. */
      const shown = needle === ''
        ? allModels
        : allModels.filter(
            (model) =>
              model.id.toLowerCase().includes(needle) ||
              String(model.name || '').toLowerCase().includes(needle),
          )

      return h(
        'div',
        { className: 'ccx-stack' },
        h(
          'div',
          { className: 'ccx-colHead' },
          h(
            'div',
            { className: 'ccx-colTitle' },
            h('h3', { className: 'ccx-h3' }, t.models),
            h(
              'div',
              { className: 'ccx-muted' },
              `${String(allModels.length)} ${t.configured} · ${String(live.length)} ${t.served} · ` +
                (pendingTotal + missingTotal === 0 ? t.inSync : `${String(pendingTotal + missingTotal)} ${t.pending}`),
            ),
          ),
          h(
            'div',
            { className: 'ccx-colActions' },
            h(
              'button',
              { className: 'ccx-button', type: 'button', onClick: props.onRefresh, disabled: props.busy },
              `⟳ ${t.refresh}`,
            ),
          ),
        ),
        error === undefined ? null : h('p', { className: 'ccx-error' }, error),
        scope === undefined ? h('p', { className: 'ccx-help' }, t.scopeUnavailable) : null,
        pendingTotal + missingTotal === 0
          ? null
          : h(
              'div',
              { className: 'ccx-card ccx-diff' },
              plans.flatMap((plan) =>
                [
                  ...plan.added.map((id) =>
                    h('div', { className: 'ccx-diffRow', key: `a:${id}` }, h('span', { className: 'ccx-add' }, '+'), h('code', { className: 'ccx-code' }, id), h('span', { className: 'ccx-muted' }, t.newlyAdded)),
                  ),
                  ...plan.filled.map((id) =>
                    h('div', { className: 'ccx-diffRow', key: `f:${id}` }, h('span', { className: 'ccx-fill' }, '~'), h('code', { className: 'ccx-code' }, id), h('span', { className: 'ccx-muted' }, 'context')),
                  ),
                  ...plan.removed.map((id) =>
                    h('div', { className: 'ccx-diffRow', key: `r:${id}` }, h('span', { className: 'ccx-del' }, '−'), h('code', { className: 'ccx-code' }, id), h('span', { className: 'ccx-muted' }, t.noLongerServed)),
                  ),
                ],
              ),
              h(
                'div',
                { className: 'ccx-actions' },
                h(
                  'button',
                  { className: 'ccx-button ccx-buttonPrimary', type: 'button', onClick: apply, disabled: busy || pendingTotal === 0 || scope === undefined || props.readOnly },
                  `${t.apply}${pendingTotal === 0 ? '' : ` ${String(pendingTotal)}`}`,
                ),
                missingTotal === 0
                  ? null
                  : h(
                      'button',
                      { className: 'ccx-button', type: 'button', onClick: drop, disabled: busy || scope === undefined || props.readOnly },
                      `${t.removeMissing} (${String(missingTotal)})`,
                    ),
              ),
            ),
        h(
          'div',
          { className: 'ccx-card ccx-tableCard' },
          h('input', {
            className: 'ccx-input',
            type: 'search',
            placeholder: t.search,
            value: query,
            onChange: (event) => setQuery(event.target.value),
          }),
          h(
            'div',
            { className: 'ccx-table' },
            shown.map((model) =>
              h(
                'div',
                { className: 'ccx-row', key: model.id },
                h('code', { className: 'ccx-code ccx-codeGrow' }, model.id),
                h('span', { className: 'ccx-context' }, model.contextWindow === undefined ? '—' : int(model.contextWindow)),
                h(
                  'span',
                  { className: 'ccx-caps' },
                  t.capText + (Array.isArray(model.caps) && model.caps.includes('image') ? ` • ${t.capVision}` : ''),
                ),
              ),
            ),
          ),
        ),
      )
    }

    /** The settings section root. */
    function CommandCodeSection() {
      const t = useDict()
      const [accountState, reloadAccount] = useApi('/api/commandcode/account', true)
      const accountReady = accountState.status === 'ready'
      const body = accountReady ? accountState.body : undefined
      const ok = Boolean(body && body.ok)
      const needKey = Boolean(body && !body.ok && body.code === 'NO_KEY')
      const [modelsState, reloadModels] = useApi('/api/commandcode/models', ok)
      const [tick, setTick] = useState(0)

      // Keep the reset countdowns honest without refetching.
      useEffect(() => {
        const timer = setInterval(() => setTick((value) => value + 1), 60_000)
        return () => clearInterval(timer)
      }, [])
      void tick

      const snapshot = useScopeSnapshot(scopeRef.current)
      const section = snapshot && snapshot.status === 'ready' ? snapshot.value : undefined
      const readOnly = Boolean(snapshot && snapshot.writable === false)

      const refreshAll = useCallback(() => {
        reloadAccount()
        reloadModels()
      }, [reloadAccount, reloadModels])

      // A fresh install has no Command Code route in `llm-pi-ai`, and without one
      // the harness has no models to offer. Provision it from the live catalog as
      // soon as the key checks out, so filling the key is the whole setup.
      const catalog =
        modelsState.status === 'ready' && modelsState.body && modelsState.body.ok
          ? modelsState.body.models || []
          : undefined
      const providers = (section && section.providers) || {}
      const missing =
        snapshot && snapshot.status === 'ready' && catalog !== undefined && catalog.length > 0
          ? ROUTES.filter((route) => providers[route] === undefined)
          : []
      const [provision, setProvision] = useState({ status: 'idle' })
      const attempted = useRef(false)
      const missingKey = missing.join('|')

      useEffect(() => {
        if (attempted.current || missingKey === '' || readOnly) return undefined
        const scope = scopeRef.current
        if (scope === undefined) return undefined
        const planned = buildProviderRoutes(catalog)
        const ops = missingKey
          .split('|')
          .filter((route) => planned[route] !== undefined)
          .map((route) => ({ op: 'set', path: ['providers', route], value: planned[route] }))
        if (ops.length === 0) return undefined
        attempted.current = true
        setProvision({ status: 'working' })
        let alive = true
        Promise.resolve(scope.mutate(ops, snapshot ? snapshot.revision : undefined))
          .then(() => {
            if (!alive) return
            setProvision({
              status: 'done',
              routes: ops.map((op) => op.path[1]),
              count: ops.reduce((total, op) => total + op.value.models.length, 0),
            })
          })
          .catch((error) => {
            if (!alive) return
            setProvision({ status: 'failed', message: String((error && error.message) || error) })
          })
        return () => {
          alive = false
        }
      }, [missingKey, readOnly, catalog, snapshot])

      const retryProvision = useCallback(() => {
        attempted.current = false
        setProvision({ status: 'idle' })
      }, [])

      return h(
        'div',
        { className: 'ccx-root' },
        h('h2', { className: 'ccx-h2' }, t.nav),
        accountState.status === 'loading' || accountState.status === 'idle'
          ? h(LoadingCard, null)
          : accountState.status === 'error'
            ? h(ErrorCard, { t, code: accountState.code, message: accountState.message, onRetry: reloadAccount })
            : needKey
              ? h(KeyCard, { t, credentials: credentialsRef.current, onSaved: refreshAll })
              : ok
                ? h(AccountPanel, { t, body, onRefresh: refreshAll, busy: accountState.status === 'loading' })
                : h(ErrorCard, { t, code: body && body.code, message: body && body.message, onRetry: reloadAccount }),
        provision.status === 'idle'
          ? null
          : h(ProvisionStatus, { t, state: provision, onRetry: retryProvision }),
        ok
          ? modelsState.status === 'loading' || modelsState.status === 'idle'
            ? h(LoadingCard, null)
            : modelsState.status === 'error'
              ? h(ErrorCard, { t, code: modelsState.code, message: modelsState.message, onRetry: reloadModels })
              : Boolean(modelsState.body && modelsState.body.ok)
                ? h(ModelsPanel, {
                    t,
                    live: modelsState.body.models || [],
                    section,
                    scope: scopeRef.current,
                    revision: snapshot ? snapshot.revision : undefined,
                    readOnly,
                    onRefresh: refreshAll,
                    busy: false,
                  })
                : h(ErrorCard, {
                    t,
                    code: modelsState.body && modelsState.body.code,
                    message: modelsState.body && modelsState.body.message,
                    onRetry: reloadModels,
                  })
          : null,
      )
    }

    // ---------------------------------------------------------------------
    // Plugin
    // ---------------------------------------------------------------------

    /** Bound `llm-pi-ai` scope, when this client could bind one. */
    const scopeRef = { current: undefined }
    /** The credentials Remote, when the assembled client exposes it. */
    const credentialsRef = { current: undefined }

    const CSS = `
.ccx-root{display:flex;flex-direction:column;gap:18px;padding:4px 0 24px;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary,#e6e6e6)}
.ccx-h2{margin:0;font-size:18px;font-weight:600;line-height:26px}
.ccx-h3{margin:0;font-size:14px;font-weight:600;line-height:22px}
.ccx-h4{margin:0 0 10px;font-size:13px;font-weight:600;line-height:20px}
.ccx-stack{display:flex;flex-direction:column;gap:12px}
.ccx-colHead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.ccx-colTitle{display:flex;flex-direction:column;gap:2px}
.ccx-colActions{display:flex;align-items:center;gap:8px}
.ccx-card{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.22));border-radius:12px;padding:14px 16px;background:var(--dsw-alias-bg-layer-2,transparent)}
.ccx-identity{font-size:14px;font-weight:600}
.ccx-muted{font-size:12px;opacity:.62}
.ccx-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.ccx-tag{display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.22));font-size:11px}
.ccx-tagPlan{font-weight:600;border-color:transparent;background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.16))}
.ccx-grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.ccx-stat{display:flex;flex-direction:column;gap:2px;min-width:0}
.ccx-statLabel{font-size:11px;opacity:.6;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ccx-statValue{font-size:15px;font-weight:600;font-variant-numeric:tabular-nums}
.ccx-window{display:flex;flex-direction:column;gap:5px;margin-bottom:14px}
.ccx-windowTop{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.ccx-windowName{font-weight:600}
.ccx-windowValue{font-variant-numeric:tabular-nums}
.ccx-windowFoot{display:flex;align-items:baseline;justify-content:space-between;gap:10px;font-size:11px;opacity:.6;font-variant-numeric:tabular-nums}
.ccx-bar{height:6px;border-radius:999px;background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.18));overflow:hidden}
.ccx-barFill{height:100%;border-radius:999px;background:var(--dsw-alias-label-primary,#8ab4f8);opacity:.75}
.ccx-barOver{background:#e5534b;opacity:.9}
.ccx-button{box-sizing:border-box;height:30px;padding:0 12px;border-radius:9px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.28));background:transparent;color:inherit;font:inherit;font-size:12px;cursor:pointer}
.ccx-button:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.16))}
.ccx-button:disabled{opacity:.45;cursor:default}
.ccx-buttonPrimary{border-color:transparent;background:var(--dsw-alias-label-primary,#3b6ef5);color:var(--dsw-alias-bg-layer-2,#fff);font-weight:600}
.ccx-buttonPrimary:hover:not(:disabled){opacity:.9;background:var(--dsw-alias-label-primary,#3b6ef5)}
.ccx-actions{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.ccx-form{display:flex;flex-direction:column;gap:8px;margin-top:10px}
.ccx-label{font-size:12px;font-weight:600}
.ccx-input{box-sizing:border-box;width:100%;height:32px;padding:0 10px;border-radius:9px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.28));background:transparent;color:inherit;font:inherit;font-size:12px}
.ccx-input:focus{outline:none;border-color:var(--dsw-alias-label-primary,#3b6ef5)}
.ccx-help{margin:0;font-size:11px;opacity:.62;line-height:17px}
.ccx-error{margin:0;font-size:11px;color:#e5534b;line-height:17px;word-break:break-word}
.ccx-note{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:12px;padding:9px 12px;border-radius:9px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.22));background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.08))}
.ccx-noteOk{color:#3fb950;border-color:rgba(63,185,80,.4)}
.ccx-noteErr{color:#e5534b;border-color:rgba(229,83,75,.4)}
.ccx-errorCard{border-color:rgba(229,83,75,.5)}
.ccx-diff{display:flex;flex-direction:column;gap:6px}
.ccx-diffRow{display:flex;align-items:center;gap:8px}
.ccx-add{color:#3fb950;font-weight:700;width:10px}
.ccx-fill{color:#d29922;font-weight:700;width:10px}
.ccx-del{color:#e5534b;font-weight:700;width:10px}
.ccx-code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px}
.ccx-codeGrow{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ccx-tableCard{display:flex;flex-direction:column;gap:10px}
.ccx-table{display:flex;flex-direction:column;max-height:440px;overflow-y:auto}
.ccx-row{display:flex;align-items:center;gap:10px;padding:5px 0;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.12))}
.ccx-row:last-child{border-bottom:none}
.ccx-context{font-variant-numeric:tabular-nums;font-size:11px;opacity:.75;white-space:nowrap}
.ccx-caps{font-size:11px;opacity:.62;white-space:nowrap}
.ccx-skel{height:14px;border-radius:6px;margin:6px 0;background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.18))}
`

    const inject = ['slots', 'settingsScope', 'remote', 'remote.credentials']

    /** Stylesheet identity used to install the plugin's CSS exactly once. */
    const STYLE_ID = 'commandcode-dash/client.css'

    /** Install the plugin stylesheet into the document head once. */
    function ensureStyle() {
      if (typeof document === 'undefined') return
      if (document.querySelector(`style[data-plugin-css="${STYLE_ID}"]`) !== null) return
      const tag = document.createElement('style')
      tag.dataset.plugin = 'commandcode-dash'
      tag.dataset.pluginCss = STYLE_ID
      tag.textContent = CSS
      document.head.appendChild(tag)
    }

    /**
     * Register the settings section.
     *
     * @param ctx - client plugin context.
     */
    function apply(ctx) {
      ensureStyle()
      const remote = ctx.get('remote')
      credentialsRef.current = remote === undefined ? undefined : remote.credentials
      const settingsScope = ctx.get('settingsScope')
      if (settingsScope !== undefined) {
        try {
          scopeRef.current = settingsScope.bind({ namespace: PI_AI_NS })
        } catch {
          scopeRef.current = undefined
        }
      }
      ctx.slots.inject('settings.section', () =>
        ctx.slots.register(
          {
            name: 'settings.section',
            id: SECTION_ID,
            order: 10,
            label: () => 'Command Code',
          },
          CommandCodeSection,
        ),
      )
    }

    exports.apply = apply
    exports.inject = inject
    /** Test-only handle on the pure merge and provisioning helpers; ignored by the plugin loader. */
    exports.__internals = { mergeModels, belongsOnRoute, buildProviderRoutes }
    return module.exports
  },
})
