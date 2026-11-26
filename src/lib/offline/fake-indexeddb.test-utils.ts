/**
 * IndexedDB simulée, écrite à la main pour les tests (aucune dépendance) : la petite partie dont se sert
 * `lib/offline` — ouverture avec mise à niveau, magasins à clé (`keyPath`, `autoIncrement`), transactions
 * validées quand leurs requêtes sont servies, `put`, `add`, `get`, `getAll`, `delete`, `clear`, `count`,
 * suppression de la base (`versionchange` envoyé aux connexions ouvertes). Les `Blob` sont gardés tels
 * quels ; le reste est copié, comme le clonage structuré.
 */

type Callback = ((event: unknown) => void) | null;

interface StoreData {
  keyPath: string;
  autoIncrement: boolean;
  records: Map<IDBValidKey, unknown>;
  next: number;
}

interface DatabaseData {
  version: number;
  stores: Map<string, StoreData>;
  connections: Set<FakeDatabase>;
}

function clone<T>(value: T): T {
  if (value instanceof Blob) return value;
  if (Array.isArray(value)) return value.map(clone) as T;
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)])) as T;
  return value;
}

function compare(a: IDBValidKey, b: IDBValidKey): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

class FakeRequest<T> {
  result: T | undefined = undefined;
  error: Error | null = null;
  onsuccess: Callback = null;
  onerror: Callback = null;
  onupgradeneeded: Callback = null;
  onblocked: Callback = null;
}

class FakeTransaction {
  oncomplete: Callback = null;
  onerror: Callback = null;
  onabort: Callback = null;
  error: Error | null = null;
  private pending = 0;
  private finished = false;

  constructor(
    private readonly data: DatabaseData,
    private readonly names: string[],
    readonly mode: IDBTransactionMode,
  ) {
    this.check();
  }

  objectStore(name: string) {
    const store = this.data.stores.get(name);
    if (!store || !this.names.includes(name)) throw new Error(`NotFoundError: ${name}`);
    return new FakeStore(this, store);
  }

  schedule<T>(operation: () => T): FakeRequest<T> {
    const request = new FakeRequest<T>();
    this.pending += 1;
    queueMicrotask(() => {
      try {
        request.result = operation();
      } catch (error) {
        request.error = error as Error;
        this.error = error as Error;
        this.pending -= 1;
        request.onerror?.({ target: request });
        if (!this.finished) {
          this.finished = true;
          this.onerror?.({});
        }
        return;
      }
      request.onsuccess?.({ target: request });
      this.pending -= 1;
      this.check();
    });
    return request;
  }

  private check() {
    queueMicrotask(() => {
      if (this.pending === 0 && !this.finished) {
        this.finished = true;
        this.oncomplete?.({});
      }
    });
  }
}

class FakeStore {
  constructor(
    private readonly transaction: FakeTransaction,
    private readonly store: StoreData,
  ) {}

  private writable() {
    if (this.transaction.mode === 'readonly') throw new Error('ReadOnlyError');
  }

  private keyOf(value: unknown): IDBValidKey | undefined {
    return (value as Record<string, IDBValidKey>)[this.store.keyPath];
  }

  private write(value: unknown, mustBeNew: boolean): IDBValidKey {
    let record = clone(value) as Record<string, unknown>;
    let key = this.keyOf(record);
    if (key === undefined && this.store.autoIncrement) {
      key = this.store.next;
      record = { ...record, [this.store.keyPath]: key };
    }
    if (key === undefined) throw new Error('DataError: clé absente');
    if (mustBeNew && this.store.records.has(key)) throw new Error('ConstraintError');
    if (typeof key === 'number' && key >= this.store.next) this.store.next = key + 1;
    this.store.records.set(key, record);
    return key;
  }

  put(value: unknown) {
    this.writable();
    return this.transaction.schedule(() => this.write(value, false));
  }

  add(value: unknown) {
    this.writable();
    return this.transaction.schedule(() => this.write(value, true));
  }

  get(key: IDBValidKey) {
    return this.transaction.schedule(() => clone(this.store.records.get(key)));
  }

  getAll() {
    return this.transaction.schedule(() =>
      [...this.store.records.entries()].sort(([a], [b]) => compare(a, b)).map(([, value]) => clone(value)),
    );
  }

  count() {
    return this.transaction.schedule(() => this.store.records.size);
  }

  delete(key: IDBValidKey) {
    this.writable();
    return this.transaction.schedule(() => {
      this.store.records.delete(key);
      return undefined;
    });
  }

  clear() {
    this.writable();
    return this.transaction.schedule(() => {
      this.store.records.clear();
      return undefined;
    });
  }
}

class FakeDatabase {
  closed = false;
  upgrading = false;
  onversionchange: Callback = null;
  onclose: Callback = null;

  constructor(private readonly data: DatabaseData) {}

  get objectStoreNames() {
    return { contains: (name: string) => this.data.stores.has(name) };
  }

  createObjectStore(name: string, options: { keyPath: string; autoIncrement?: boolean }) {
    if (!this.upgrading) throw new Error('InvalidStateError: hors mise à niveau');
    this.data.stores.set(name, {
      keyPath: options.keyPath,
      autoIncrement: !!options.autoIncrement,
      records: new Map(),
      next: 1,
    });
  }

  transaction(names: string | string[], mode: IDBTransactionMode = 'readonly') {
    if (this.closed) throw new Error('InvalidStateError: connexion fermée');
    return new FakeTransaction(this.data, [names].flat(), mode);
  }

  close() {
    this.closed = true;
    this.data.connections.delete(this);
  }
}

export interface FakeIndexedDb {
  open(name: string, version?: number): FakeRequest<FakeDatabase>;
  deleteDatabase(name: string): FakeRequest<undefined>;
  /** Bases présentes (inspection par les tests). */
  databases: Map<string, DatabaseData>;
  /** Suppressions restées bloquées par une connexion ouverte. */
  blocked: string[];
}

export function createFakeIndexedDb(): FakeIndexedDb {
  const databases = new Map<string, DatabaseData>();
  const blocked: string[] = [];
  return {
    databases,
    blocked,
    open(name, version = 1) {
      const request = new FakeRequest<FakeDatabase>();
      queueMicrotask(() => {
        let data = databases.get(name);
        if (!data) {
          data = { version: 0, stores: new Map(), connections: new Set() };
          databases.set(name, data);
        }
        const db = new FakeDatabase(data);
        request.result = db;
        if (data.version < version) {
          data.version = version;
          db.upgrading = true;
          request.onupgradeneeded?.({ target: request });
          db.upgrading = false;
        }
        data.connections.add(db);
        request.onsuccess?.({ target: request });
      });
      return request;
    },
    deleteDatabase(name) {
      const request = new FakeRequest<undefined>();
      queueMicrotask(() => {
        const data = databases.get(name);
        if (data) {
          [...data.connections].forEach((connection) => connection.onversionchange?.({}));
          if (data.connections.size) {
            blocked.push(name);
            request.onblocked?.({});
            [...data.connections].forEach((connection) => connection.close());
          }
          databases.delete(name);
        }
        request.onsuccess?.({});
      });
      return request;
    },
  };
}

/** Installe une IndexedDB simulée neuve (`vi.unstubAllGlobals()` la retire). */
export function stubIndexedDb(): FakeIndexedDb {
  const fake = createFakeIndexedDb();
  vi.stubGlobal('indexedDB', fake);
  return fake;
}
