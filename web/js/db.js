/* IndexedDB persistence: two stores — expenses (each with an attached
   receipt image Blob) and fxRates (one record per "YYYY-MM" month). */
const MallockDB = (() => {
  const DB_NAME = "mallock-expenses";
  const DB_VERSION = 1;
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("expenses")) {
          const store = db.createObjectStore("expenses", { keyPath: "id" });
          store.createIndex("date", "date");
        }
        if (!db.objectStoreNames.contains("fxRates")) {
          db.createObjectStore("fxRates", { keyPath: "month" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function tx(storeName, mode) {
    const db = await open();
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  function wrap(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  return {
    async addExpense(expense) {
      const store = await tx("expenses", "readwrite");
      await wrap(store.add(expense));
      return expense;
    },
    async deleteExpense(id) {
      const store = await tx("expenses", "readwrite");
      await wrap(store.delete(id));
    },
    async getAllExpenses() {
      const store = await tx("expenses", "readonly");
      return wrap(store.getAll());
    },
    async putFxRate(record) {
      const store = await tx("fxRates", "readwrite");
      await wrap(store.put(record));
      return record;
    },
    async getAllFxRates() {
      const store = await tx("fxRates", "readonly");
      return wrap(store.getAll());
    },
    async getFxRate(month) {
      const store = await tx("fxRates", "readonly");
      return wrap(store.get(month));
    },
  };
})();
