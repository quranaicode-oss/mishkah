(function (global) {
  if (!global) return;

  const PACKAGE_URL = './pos-kds-chart-package.json';
  const DB_NAME = 'mishkah-chart-package';
  const DB_VERSION = 1;
  const STORE_SEGMENTS = 'segments';
  const STORE_META = 'meta';
  const fetchFn = typeof global.fetch === 'function' ? global.fetch.bind(global) : null;
  const memoryCache = {
    package: null,
    version: null,
    persistedVersion: null,
    segments: Object.create(null)
  };
  const listeners = new Set();
  let packagePromise = null;
  let dbPromise = null;

  function logDebug(...args) {
    if (!global.console || typeof global.console.debug !== 'function') return;
    global.console.debug('[Mishkah][ChartDistributor]', ...args);
  }

  function logError(...args) {
    if (!global.console || typeof global.console.error !== 'function') return;
    global.console.error('[Mishkah][ChartDistributor]', ...args);
  }

  function normalizeScreenName(name) {
    const raw = typeof name === 'string' ? name.trim().toLowerCase() : '';
    return raw === 'kds' ? 'kds' : 'pos';
  }

  function dispatchEvent(name, detail) {
    try {
      if (typeof global.dispatchEvent === 'function' && typeof global.CustomEvent === 'function') {
        global.dispatchEvent(new CustomEvent(name, { detail }));
      }
      if (global.document && typeof global.document.dispatchEvent === 'function' && typeof global.CustomEvent === 'function') {
        global.document.dispatchEvent(new CustomEvent(name, { detail }));
      }
    } catch (err) {
      logError('Failed to dispatch event', name, err);
    }
  }

  function openDb() {
    if (!global.indexedDB) return Promise.resolve(null);
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
      let resolved = false;
      try {
        const request = global.indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(STORE_SEGMENTS)) {
            db.createObjectStore(STORE_SEGMENTS, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORE_META)) {
            db.createObjectStore(STORE_META, { keyPath: 'id' });
          }
        };
        request.onsuccess = () => {
          const db = request.result;
          db.onclose = () => {
            if (dbPromise && resolved) {
              dbPromise = null;
            }
          };
          resolved = true;
          resolve(db);
        };
        request.onerror = () => {
          resolve(null);
        };
        request.onblocked = () => {
          resolve(null);
        };
      } catch (_err) {
        resolve(null);
      }
    });
    return dbPromise;
  }

  function withStore(storeName, mode, executor) {
    return openDb().then((db) => {
      if (!db) return null;
      return new Promise((resolve) => {
        let completed = false;
        try {
          const tx = db.transaction(storeName, mode);
          const store = tx.objectStore(storeName);
          const result = executor(store, resolve);
          if (result && typeof result.then === 'function') {
            result.then(resolve, () => resolve(null));
          }
          tx.oncomplete = () => {
            if (!completed) {
              completed = true;
              resolve(result);
            }
          };
          tx.onerror = () => {
            if (!completed) {
              completed = true;
              resolve(null);
            }
          };
        } catch (err) {
          logError('IndexedDB transaction failed', err);
          resolve(null);
        }
      });
    });
  }

  function loadPackage() {
    if (packagePromise) return packagePromise;
    if (!fetchFn) {
      return Promise.reject(new Error('CHART_PACKAGE_NO_FETCH'));
    }
    packagePromise = fetchFn(PACKAGE_URL, { cache: 'no-cache' })
      .then((response) => {
        if (!response.ok) {
          throw new Error('CHART_PACKAGE_FETCH_FAILED');
        }
        return response.json();
      })
      .then((data) => {
        const version = typeof data.version === 'string' ? data.version : '0';
        memoryCache.package = data;
        memoryCache.version = version;
        logDebug('Loaded chart package version', version);
        dispatchEvent('mishkah:chart-package-loaded', { version });
        return data;
      })
      .catch((error) => {
        packagePromise = null;
        logError('Failed to load chart package', error);
        throw error;
      });
    return packagePromise;
  }

  function notifySubscribers(payload) {
    listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (err) {
        logError('Listener execution failed', err);
      }
    });
  }

  function rememberInMemory(screen, payload) {
    const normalized = normalizeScreenName(screen);
    memoryCache.version = payload.version;
    memoryCache.segments[normalized] = payload.data;
    notifySubscribers({ screen: normalized, payload });
  }

  function readStoredVersion() {
    if (memoryCache.persistedVersion) return Promise.resolve(memoryCache.persistedVersion);
    return withStore(STORE_META, 'readonly', (store, resolve) => {
      const request = store.get('version');
      request.onsuccess = () => {
        const value = request.result && request.result.value ? String(request.result.value) : null;
        memoryCache.persistedVersion = value;
        resolve(value);
      };
      request.onerror = () => resolve(null);
    });
  }

  function writeStoredVersion(version) {
    memoryCache.persistedVersion = version;
    return withStore(STORE_META, 'readwrite', (store, resolve) => {
      try {
        const record = { id: 'version', value: version, ts: Date.now() };
        const request = store.put(record);
        request.onsuccess = () => resolve(version);
        request.onerror = () => resolve(null);
      } catch (_err) {
        resolve(null);
      }
    });
  }

  function writeSegment(screen, payload) {
    rememberInMemory(screen, payload);
    const normalized = normalizeScreenName(screen);
    return withStore(STORE_SEGMENTS, 'readwrite', (store, resolve) => {
      try {
        const record = { id: normalized, version: payload.version, data: payload.data, ts: Date.now() };
        const request = store.put(record);
        request.onsuccess = () => resolve(record);
        request.onerror = () => resolve(null);
      } catch (_err) {
        resolve(null);
      }
    });
  }

  function readSegment(screen) {
    const normalized = normalizeScreenName(screen);
    if (memoryCache.segments[normalized]) {
      return Promise.resolve({ version: memoryCache.version, data: memoryCache.segments[normalized] });
    }
    return withStore(STORE_SEGMENTS, 'readonly', (store, resolve) => {
      const request = store.get(normalized);
      request.onsuccess = () => {
        const record = request.result || null;
        if (record) {
          memoryCache.version = record.version || memoryCache.version;
          memoryCache.segments[normalized] = record.data;
        }
        resolve(record ? { version: record.version, data: record.data } : null);
      };
      request.onerror = () => resolve(null);
    });
  }

  function alertMismatch(detail) {
    const message = `تم اكتشاف اختلاف في إصدار حزمة الرسوم (${detail.persistedVersion} → ${detail.packageVersion}).\n` +
      'يجب تحديث الصفحة أو إعادة تهيئة بيانات المخطط قبل المتابعة.';
    if (typeof global.alert === 'function') {
      try {
        global.alert(message);
      } catch (_err) {
        // ignore
      }
    }
    dispatchEvent('mishkah:chart-version-mismatch', detail);
  }

  function createMismatchError(detail) {
    const error = new Error('CHART_VERSION_MISMATCH');
    error.code = 'chart-version-mismatch';
    error.detail = detail;
    return error;
  }

  function ensurePackage() {
    return loadPackage().catch((error) => {
      logError('Primary package load failed, attempting fallback', error);
      return readStoredVersion().then((version) => {
        if (version) {
          memoryCache.version = version;
        }
        return readSegment('pos').then(() => readSegment('kds')).then(() => {
          if (memoryCache.version) {
            return {
              version: memoryCache.version,
              segments: memoryCache.segments
            };
          }
          throw error;
        });
      });
    });
  }

  function buildPayloadForScreen(pkg, screen) {
    const normalized = normalizeScreenName(screen);
    const segments = pkg && pkg.segments ? pkg.segments : null;
    const segment = segments && segments[normalized] ? segments[normalized] : null;
    return {
      screen: normalized,
      version: typeof pkg.version === 'string' ? pkg.version : memoryCache.version || '0',
      data: segment
    };
  }

  function prepare(screen) {
    const normalized = normalizeScreenName(screen);
    return ensurePackage().then((pkg) => {
      const packageVersion = typeof pkg.version === 'string' ? pkg.version : memoryCache.version || '0';
      const payload = buildPayloadForScreen(pkg, normalized);
      return readStoredVersion().then((storedVersion) => {
        if (storedVersion && storedVersion !== packageVersion) {
          const detail = {
            screen: normalized,
            persistedVersion: storedVersion,
            packageVersion,
            timestamp: Date.now()
          };
          alertMismatch(detail);
          throw createMismatchError(detail);
        }
        return writeSegment(normalized, payload).then(() => writeStoredVersion(packageVersion)).then(() => {
          memoryCache.version = packageVersion;
          global.__MishkahChartDistribution__ = {
            version: packageVersion,
            segments: Object.assign({}, memoryCache.segments)
          };
          return payload;
        });
      });
    });
  }

  function reset() {
    memoryCache.package = null;
    memoryCache.version = null;
    memoryCache.persistedVersion = null;
    memoryCache.segments = Object.create(null);
    packagePromise = null;
    const deletePromise = new Promise((resolve) => {
      if (!global.indexedDB) {
        resolve(true);
        return;
      }
      try {
        const request = global.indexedDB.deleteDatabase(DB_NAME);
        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
        request.onblocked = () => resolve(false);
      } catch (_err) {
        resolve(false);
      }
    });
    dbPromise = null;
    return deletePromise;
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  const api = {
    prepare,
    reset,
    loadPackage,
    ensurePackage,
    getStoredVersion: readStoredVersion,
    getSegment: readSegment,
    subscribe
  };

  global.MishkahChartDistributor = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
