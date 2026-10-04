import type { BaseStorage, CaptureAnnotations } from '@extension/storage';

type AnnotationMap = Record<string, CaptureAnnotations>;
type Snapshot = { objects: unknown[] };

const clone = <T>(value: T): T => structuredClone(value);

const createMemoryAnnotations = (initial: AnnotationMap = {}) => {
  let map = clone(initial);
  const listeners = new Set<() => void>();
  const replace = (next: AnnotationMap) => {
    map = next;
    listeners.forEach(listener => listener());
  };
  return {
    get: async () => clone(map),
    getSnapshot: () => map,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set: async value => replace(clone(typeof value === 'function' ? await value(clone(map)) : value)),
    getAnnotations: async (id: string) => clone(map[id] ?? null),
    setAnnotations: async (id: string, value: Partial<CaptureAnnotations>) => {
      replace({ ...map, [id]: { ...(map[id] ?? { objects: [] }), ...clone(value) } });
    },
    remove: (id: string) => {
      const { [id]: _removed, ...next } = map;
      replace(next);
    },
    clear: () => replace({}),
  } satisfies BaseStorage<AnnotationMap> & Record<string, unknown>;
};

/** Each capture overlay or saved-capture window owns its layers and undo stacks. */
const createEditorSession = (initial: AnnotationMap = {}) => {
  const clipboard = { objects: [] as unknown[] };
  const annotationsStorage = createMemoryAnnotations(initial);
  const annotationsHistoryStorage = createMemoryAnnotations(
    Object.fromEntries(Object.entries(initial).map(([id, value]) => [id, { objects: [{ objects: value.objects }] }])),
  );
  const annotationsRedoStorage = createMemoryAnnotations();
  const historyFor = (id: string) => annotationsHistoryStorage.getSnapshot()[id]?.objects as Snapshot[] | undefined;
  const record = (id: string, objects: unknown[]) => {
    const current = annotationsStorage.getSnapshot()[id]?.objects ?? [];
    const history = historyFor(id) ?? [{ objects: clone(current) }];
    if (JSON.stringify(history.at(-1)?.objects) === JSON.stringify(objects)) return;
    void annotationsStorage.setAnnotations(id, { objects });
    void annotationsHistoryStorage.setAnnotations(id, {
      objects: [...history, { objects: clone(objects) }].slice(-101),
    });
    void annotationsRedoStorage.setAnnotations(id, { objects: [] });
  };
  const undo = (id: string) => {
    const history = historyFor(id) ?? [];
    if (history.length < 2) return null;
    const redo = annotationsRedoStorage.getSnapshot()[id]?.objects ?? [];
    const previous = history.at(-2)!;
    void annotationsHistoryStorage.setAnnotations(id, { objects: history.slice(0, -1) });
    void annotationsRedoStorage.setAnnotations(id, { objects: [...redo, history.at(-1)!] });
    void annotationsStorage.setAnnotations(id, previous);
    return clone(previous);
  };
  const redo = (id: string) => {
    const stack = annotationsRedoStorage.getSnapshot()[id]?.objects as Snapshot[] | undefined;
    if (!stack?.length) return null;
    const restored = stack.at(-1)!;
    void annotationsHistoryStorage.setAnnotations(id, { objects: [...(historyFor(id) ?? []), restored] });
    void annotationsRedoStorage.setAnnotations(id, { objects: stack.slice(0, -1) });
    void annotationsStorage.setAnnotations(id, restored);
    return clone(restored);
  };
  const remove = (id: string) => {
    annotationsStorage.remove(id);
    annotationsHistoryStorage.remove(id);
    annotationsRedoStorage.remove(id);
  };
  return {
    clipboard,
    annotationsStorage,
    annotationsHistoryStorage,
    annotationsRedoStorage,
    record,
    undo,
    redo,
    remove,
    clear: () => {
      clipboard.objects = [];
      annotationsStorage.clear();
      annotationsHistoryStorage.clear();
      annotationsRedoStorage.clear();
    },
  };
};

type EditorSession = ReturnType<typeof createEditorSession>;
export { createEditorSession };
export type { EditorSession };
