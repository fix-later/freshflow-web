# FreshFlow Web — State Management

**Layer:** Engineering. **Signals first, local state preferred.** No global store library
(NgRx etc.) — it is not a dependency and not warranted at this scope.

## Hierarchy of state

Choose the **narrowest** scope that works:

1. **Component view state** — `signal()` / `computed()` inside the component. Default for most UI.
2. **Feature store** — a signal-based service (`providedIn` the feature route) holding a
   feature's data, filters, and async status. Use when state is shared across a feature's
   screens (e.g., the orders list filter survives navigation to a detail and back).
3. **App/core state** — a small signal service in `core/` for cross-cutting state only:
   authenticated user, navigation, theme/locale, real-time connection status.

Do **not** lift state higher than it needs to live. Prefer local; promote only on real reuse.

## Feature store pattern

```ts
// orders.service.ts (illustrative shape, not endpoints)
@Injectable()
export class OrdersStore {
  private readonly api = inject(OrdersApi);

  // source state
  readonly filter = signal<OrderFilter>(defaultFilter);
  private readonly _orders = signal<Order[]>([]);
  readonly status = signal<'idle' | 'loading' | 'error'>('idle');

  // derived state
  readonly orders = computed(() => this._orders());
  readonly isEmpty = computed(() => this.status() === 'idle' && this._orders().length === 0);

  // async (see resource note below)
  async load() { /* set loading → call api → set orders/status */ }
  setFilter(f: OrderFilter) { this.filter.set(f); this.load(); }
}
```

Rules:

- **State is private signals; expose `computed`/readonly.** Never hand a writable signal to a
  template or another service.
- **Derive, don't duplicate** — anything computable is a `computed`, not stored state.
- **One writer per signal** — only the owning store mutates it (real-time updates go through the
  store, see [`API.md`](./API.md)).

## RxJS interop

- RxJS is for **streams/events** (SignalR, debounced search, complex async). Bridge into signals
  with `toSignal()` and out with `toObservable()` at the edges.
- Keep templates and most logic on signals; don't thread observables through the view.

## Async data

- Prefer Angular's **`resource()` / `rxResource()`** for request-driven async where suitable
  (declarative loading/error), falling back to the store `load()` pattern above.
- Always model the three states explicitly: **loading / loaded / error** (drives the required UI
  states in [`../ux/SCREEN_RULES.md`](../ux/SCREEN_RULES.md)).

## Effects

- `effect()` is for **side effects only** (e.g., persisting a filter, reacting to connection
  status) — never to compute derived state, and never to write a signal it reads (no loops).
- Keep effects few and in stores/services, not scattered in components.

## Real-time + state

SignalR updates are pushed into the relevant feature store, which updates its private signals;
the UI re-renders via `computed`. On reconnect the store **re-fetches** rather than replaying
(BR-PRI-3, BR-ORD-6).

## Avoid

Global store libraries · `BehaviorSubject` service-state (use signals) · public writable
signals · derived state stored as state · effects that mutate their own dependencies.
