/**
 * A minimal React-alike, so the browser half can be rendered in plain Node.
 *
 * The plugin bundle is a lazy-CJS factory that `require`s React; handing it this
 * module instead makes the real component tree renderable without a browser,
 * jsdom, or a React install. Hooks are stored per component function — the same
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
  /** Hook slots of the component being evaluated, and its cursor. */
  let slots = []
  let cursor = 0
  /**
   * Hook slots, one store per component function.
   *
   * React arrives at the same place by keying hooks to the mounted instance; a
   * single call-order array is not enough here because a component can be
   * skipped on an intermediate pass and rendered later — `ModelsPanel` waits for
   * a second fetch, while a control after it appears at once — and it would then
   * read the slots that control had already claimed.
   *
   * Keyed by function identity, so the same component mounted twice would share
   * state. Nothing here does that; a react-alike that did would need a
   * per-instance key rather than this one.
   */
  const stores = new Map()
  let pending = []
  /** Effect cleanups owed before the next batch of effects runs. */
  let cleanups = []
  /** Stores rendered in this pass, and in the one before it. */
  let rendered = new Set()
  let previous = new Set()
  let dirty = false

  /** @returns the persistent hook store for one component. */
  function storeFor(type) {
    let store = stores.get(type)
    if (store === undefined) {
      store = []
      stores.set(type, store)
    }
    return store
  }

  /**
   * Retire one component's hooks the way unmounting does: hand over whatever its
   * effects returned, and forget the slots so a remount starts from empty.
   *
   * @param store - the component's hook slots.
   */
  function unmount(store) {
    for (const slot of store) {
      if (slot === undefined || typeof slot.cleanup !== 'function') continue
      cleanups.push(slot.cleanup)
      slot.cleanup = undefined
    }
  }

  const react = {
    createElement: (type, props, ...children) => ({
      type,
      props: { ...(props || {}), children: children.length <= 1 ? children[0] : children },
    }),
    useState: (init) => {
      const i = cursor++
      if (slots[i] === undefined) slots[i] = { value: typeof init === 'function' ? init() : init }
      const slot = slots[i]
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
      if (slots[i] === undefined) slots[i] = { current: init }
      return slots[i]
    },
    useCallback: (fn, deps) => {
      const i = cursor++
      const prev = slots[i]
      if (prev === undefined || deps === undefined || !depsEqual(prev.deps, deps)) slots[i] = { fn, deps }
      return slots[i].fn
    },
    useMemo: (fn, deps) => {
      const i = cursor++
      const prev = slots[i]
      if (prev === undefined || deps === undefined || !depsEqual(prev.deps, deps)) slots[i] = { value: fn(), deps }
      return slots[i].value
    },
    useEffect: (fn, deps) => {
      const i = cursor++
      const store = slots
      const prev = store[i]
      if (prev !== undefined && deps !== undefined && depsEqual(prev.deps, deps)) return
      // A re-run cleans up the previous run first, and an unmount runs it last;
      // either way the cleanup is owed before the effect that replaces it.
      if (prev !== undefined && typeof prev.cleanup === 'function') cleanups.push(prev.cleanup)
      const slot = { deps, cleanup: undefined }
      store[i] = slot
      pending.push(() => {
        slot.cleanup = fn()
      })
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
    if (typeof node.type === 'function') {
      // Swap in this component's own slots for the duration of its call, then
      // hand the cursor back before recursing, so nesting neither leaks nor
      // loses a slot. The component reads all of its hooks before any child is
      // evaluated, which is what makes the swap safe.
      const outer = slots
      const outerCursor = cursor
      slots = storeFor(node.type)
      rendered.add(slots)
      cursor = 0
      const renderedTree = node.type(node.props)
      slots = outer
      cursor = outerCursor
      return evaluate(renderedTree)
    }
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
      dirty = false
      rendered = new Set()
      tree = evaluate({ type: component, props })
      // A component rendered on the previous pass and not on this one is gone.
      // React runs its effect cleanups and drops its state there, so a later
      // remount starts from empty rather than inheriting what it left behind.
      for (const [type, store] of [...stores]) {
        if (!previous.has(store) || rendered.has(store)) continue
        unmount(store)
        if (stores.get(type) === store) stores.delete(type)
      }
      previous = rendered
      const owed = cleanups
      cleanups = []
      for (const fn of owed) fn()
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
    for (const store of stores.values()) unmount(store)
    stores.clear()
    slots = []
    cursor = 0
    pending = []
    dirty = false
    rendered = new Set()
    previous = new Set()
    const owed = cleanups
    cleanups = []
    for (const fn of owed) fn()
  }

  return { react, evaluate, render, walk, reset, reactHooksPending: () => pending.length }
}
