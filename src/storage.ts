import { newState, validateState, type State } from './model.js';
const DB = 'horizon-ui-lab-v1';
export class LocalStore {
  private db: IDBDatabase | null = null;
  async open(): Promise<State> {
    this.db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('state');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('Закройте другую вкладку HORIZON и обновите страницу.'));
    });
    this.db.onversionchange = () => { this.db?.close(); this.db = null; };
    const state = await new Promise<unknown>((resolve, reject) => {
      const req = this.db!.transaction('state').objectStore('state').get('current');
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
    if (state === undefined) return newState();
    if (!validateState(state)) throw new Error('Сохранённые данные повреждены. Они не перезаписаны.');
    return state;
  }
  /** Compare-and-swap in ONE readwrite transaction prevents silent cross-tab overwrites. */
  async save(next: State, expectedRevision: number): Promise<void> {
    if (!this.db) throw new Error('Хранилище недоступно. Экспортируйте проект.');
    if (!validateState(next)) throw new Error('Некорректное состояние не сохранено.');
    await new Promise<void>((resolve, reject) => {
      const tx = this.db!.transaction('state', 'readwrite');
      const store = tx.objectStore('state');
      let problem: Error | null = null;
      const read = store.get('current');
      read.onsuccess = () => {
        const current: unknown = read.result;
        if ((current === undefined && expectedRevision !== 0) || (current !== undefined && (!validateState(current) || current.revision !== expectedRevision))) {
          problem = new Error('Проект изменён в другой вкладке. Экспортируйте черновик или обновите страницу.'); tx.abort(); return;
        }
        store.put(next, 'current');
      };
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(problem ?? tx.error ?? new Error('Сохранение прервано.'));
      tx.onerror = () => reject(tx.error ?? new Error('Не удалось сохранить проект.'));
    });
  }
}
