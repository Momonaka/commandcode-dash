/**
 * A minimal React-alike, so the browser half can be rendered in plain Node.
 *
 * The plugin bundle is a lazy-CJS factory that `require`s React; handing it this
 * module instead makes the real component tree renderable without a browser,
 * jsdom, or a React install. Hooks are implemented in call order — the same
 * contract React relies on — and function components are evaluated depth-first
 * inside the render pass.
 *
 * Only the hooks the plugin uses are implemented. Anything else throws, so an
 * unnoticed new hook shows up as a test failure rather than a silent no-op.
 *
 * @module commandcode-dash/test/fake-react
 */

/** @returns true when two dependency arrays are shallow-equal. */
function depsEqual(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => Object.is(v, b[i]))
}

/**
 * Create one isolated renderer instance.
 *
 * @returns `{ react, evaluate, render, walk, reset, reactHooksPending }`.
 */
export function createRenderer() {
  let hooks = []
  let cursor = 0
  let pending = []
  let dirty = false

  const react = {
    createElement: (type, props, ...children) => ({
      type,
      props: { ...(props || {}), children: children.length <= 1 ? children[0] : children },
    }),
    useState: (init) => {
      const i = cursor++
      if (hooks[i] === undefined) hooks[i] = { value: typeof init === 'function' ? init() : init }
      const slot = hooks[i]
      return [
        slot.value,
        (next) => {
          const value = typeof next === 'function' ? next(slot.value) : next
          if (!Object.is(value, slot.value)) {
            slot.value = value
            dirty = true
          }
        },
      ]
    },
    useRef: (init) => {
      const i = cursor++
      if (hooks[i] === undefined) hooks[i] = { current: init }
      return hooks[i]
    },
    useCallback: (fn, deps) => {
      const i = cursor++
      const prev = hooks[i]
      if (prev === undefined || deps === undefined || !depsEqual(prev.deps, deps)) hooks[i] = { fn, deps }
      return hooks[i].fn
    },
    useMemo: (fn, deps) => {
      const i = cursor++
      const prev = hooks[i]
      if (prev === undefined || deps === undefined || !depsEqual(prev.deps, deps)) hooks[i] = { value: fn(), deps }
      return hooks[i].value
    },
    useEffect: (fn, deps) => {
      const i = cursor++
      const prev = hooks[i]
      if (prev === undefined || deps === undefined || !depsEqual(prev.deps, deps)) pending.push(fn)
      hooks[i] = { deps }
    },
    useLayoutEffect: () => {
      throw new Error('fake-react: useLayoutEffect is not implemented')
    },
    useId: () => {
      throw new Error('fake-react: useId is not implemented')
    },
  }

  /** Evaluate function components depth-first, exactly as React would. */
  function evaluate(node) {
    if (node === null || node === undefined || typeof node === 'boolean') return null
    if (Array.isArray(node)) return node.map(evaluate)
    if (typeof node === 'string' || typeof node === 'number') return node
    if (typeof node.type === 'function') return evaluate(node.type(node.props))
    return { type: node.type, props: { ...node.props, children: evaluate(node.props.children) } }
  }

  /**
   * Render a component until state settles.
   *
   * @param component - the component to render.
   * @param props - its props.
   * @param options - `{ passes }` caps the settle loop; `{ settleMs }` waits between passes.
   * @returns the evaluated element tree.
   */
  async function render(component, props = {}, options = {}) {
    const maxPasses = options.passes ?? 30
    const settleMs = options.settleMs ?? 2
    let tree
    let passes = 0
    for (; passes < maxPasses; passes++) {
      cursor = 0
      dirty = false
      tree = evaluate(component(props))
      const queued = pending
      pending = []
      for (const fn of queued) fn()
      if (settleMs > 0) await new Promise((resolve) => setTimeout(resolve, settleMs))
      if (!dirty && pending.length === 0) break
    }
    if (passes >= maxPasses) throw new Error(`fake-react: state did not settle in ${String(maxPasses)} passes`)
    return tree
  }

  /**
   * Collect host-element facts from an evaluated tree.
   *
   * @param node - evaluated tree.
   * @param out - accumulator; defaults to a fresh report.
   * @returns `{ texts, classes, byClass, inputs, tags }`.
   */
  function walk(node, out) {
    const acc = out ?? { texts: [], classes: [], byClass: {}, inputs: [], tags: [] }
    if (node === null || node === undefined || typeof node === 'boolean') return acc
    if (Array.isArray(node)) {
      for (const child of node) walk(child, acc)
      return acc
    }
    if (typeof node === 'string' || typeof node === 'number') {
      acc.texts.push(String(node))
      return acc
    }
    acc.tags.push(node.type)
    const cls = String((node.props && node.props.className) || '')
    if (cls !== '') {
      acc.classes.push(cls)
      for (const name of cls.split(/\s+/)) acc.byClass[name] = (acc.byClass[name] ?? 0) + 1
    }
    if (node.type === 'input') acc.inputs.push(node.props.placeholder)
    walk(node.props.children, acc)
    return acc
  }

  /**
   * Drop every hook slot so the next `render` is a fresh mount.
   *
   * A React component that stays registered while the user navigates away and
   * back is unmounted and remounted with empty hook state; the module closure
   * around it — and anything it memoizes there — survives. This reproduces that
   * split, which is exactly what a cache that must outlive one mount depends on.
   */
  function reset() {
    hooks = []
    cursor = 0
    pending = []
    dirty = false
  }

  return { react, evaluate, render, walk, reset, reactHooksPending: () => pending.length }
}
