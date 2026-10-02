import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StorageEnum } from './enums.js';

const key = 'settings';
const data: Record<string, unknown> = {};
const get = vi.fn(async () => ({ ...data }));
const set = vi.fn(async (values: Record<string, unknown>) => {
  Object.assign(data, values);
});
const addListener = vi.fn();
const setAccessLevel = vi.fn().mockResolvedValue(undefined);
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  for (const name of Object.keys(data)) delete data[name];
  get.mockImplementation(async () => ({ ...data }));
  set.mockImplementation(async values => {
    Object.assign(data, values);
  });
  const area = { get, set, onChanged: { addListener }, setAccessLevel };
  vi.stubGlobal('chrome', { storage: { local: area, session: area } });
});
afterEach(() => vi.unstubAllGlobals());
const factory = async () => (await import('./base.js')).createStorage;

describe('extension storage', () => {
  it('initializes snapshots and emits persisted changes only to subscribed listeners', async () => {
    const createStorage = await factory();
    const storage = createStorage(key, 0);
    const listener = vi.fn();
    const unsubscribe = storage.subscribe(listener);
    await vi.waitFor(() => expect(storage.getSnapshot()).toBe(0));
    listener.mockClear();
    await storage.set(1);
    expect(listener).toHaveBeenCalledOnce();
    expect(storage.getSnapshot()).toBe(1);
    expect(await storage.get()).toBe(1);
    unsubscribe();
    await storage.set(2);
    expect(listener).toHaveBeenCalledOnce();
  });

  it('serializes overlapping asynchronous updates without losing either change', async () => {
    const storage = (await factory())(key, { screenshot: false, recording: false });
    const gate = deferred<void>();
    const first = storage.set(async previous => {
      await gate.promise;
      return { ...previous, screenshot: true };
    });
    const second = storage.set(previous => ({ ...previous, recording: true }));
    gate.resolve();
    await Promise.all([first, second]);
    expect(await storage.get()).toEqual({ screenshot: true, recording: true });
  });

  it('reads changes from other contexts before applying an updater', async () => {
    const storage = (await factory())(key, 0);
    await storage.set(1);
    data[key] = 10;
    await storage.set(previous => previous + 1);
    expect(storage.getSnapshot()).toBe(11);
  });

  it('retains the last committed snapshot on write failure and recovers the queue', async () => {
    data[key] = 4;
    const storage = (await factory())(key, 0);
    await vi.waitFor(() => expect(storage.getSnapshot()).toBe(4));
    const listener = vi.fn();
    storage.subscribe(listener);
    set.mockRejectedValueOnce(new Error('quota exceeded'));
    await expect(storage.set(99)).rejects.toThrow('quota exceeded');
    expect(storage.getSnapshot()).toBe(4);
    expect(listener).not.toHaveBeenCalled();
    await storage.set(previous => previous + 1);
    expect(storage.getSnapshot()).toBe(5);
  });

  it('does not let a delayed initialization overwrite a newer storage event', async () => {
    const initial = deferred<Record<string, unknown>>();
    get.mockReturnValueOnce(initial.promise);
    const storage = (await factory())(key, 0, { liveUpdate: true });
    const change = addListener.mock.calls[0][0];
    change({ unrelated: { newValue: 7 } });
    change({ [key]: { newValue: 5 } });
    initial.resolve({ [key]: 1 });
    await initial.promise;
    await Promise.resolve();
    expect(storage.getSnapshot()).toBe(5);
    const listener = vi.fn();
    storage.subscribe(listener);
    change({ [key]: { newValue: 5 } });
    expect(listener).not.toHaveBeenCalled();
    change({ [key]: { oldValue: 5 } });
    expect(storage.getSnapshot()).toBe(0);
    expect(listener).toHaveBeenCalledOnce();
  });

  it('uses fallback after a failed initial read without an unhandled rejection', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    get.mockRejectedValueOnce(new Error('unavailable'));
    const storage = (await factory())(key, 42);
    await vi.waitFor(() => expect(storage.getSnapshot()).toBe(42));
    expect(warn).toHaveBeenCalled();
    await storage.set(43);
    expect(await storage.get()).toBe(43);
    warn.mockRestore();
  });

  it('round trips serialized values, including legacy native values and deletion', async () => {
    data[key] = { value: 2 };
    const storage = (await factory())(
      key,
      { value: 0 },
      {
        liveUpdate: true,
        serialization: { serialize: JSON.stringify, deserialize: JSON.parse },
      },
    );
    expect(await storage.get()).toEqual({ value: 2 });
    await storage.set({ value: 3 });
    expect(data[key]).toBe('{"value":3}');
    expect(await storage.get()).toEqual({ value: 3 });
    addListener.mock.calls[0][0]({ [key]: { newValue: '{"value":4}' } });
    expect(storage.getSnapshot()).toEqual({ value: 4 });
  });

  it('enables session access once when explicitly requested', async () => {
    const createStorage = await factory();
    createStorage('first', 0, { storageEnum: StorageEnum.Session, sessionAccessForContentScripts: true });
    createStorage('second', 0, { storageEnum: StorageEnum.Session, sessionAccessForContentScripts: true });
    expect(setAccessLevel).toHaveBeenCalledOnce();
  });

  it('is safe to import in non-browser build tools', async () => {
    vi.stubGlobal('chrome', undefined);
    const storage = (await factory())(key, 'fallback');
    expect(await storage.get()).toBe('fallback');
  });
});
