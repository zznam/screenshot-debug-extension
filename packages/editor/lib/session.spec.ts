import { describe, expect, it } from 'vitest';

import { createEditorSession } from './session.js';

describe('isolated annotation sessions', () => {
  it('keeps saved layers as the initial undo state and lets start-over be undone', () => {
    const session = createEditorSession({ shot: { objects: [{ objectId: 'saved' }] } });
    expect(session.undo('shot')).toBeNull();
    session.record('shot', [{ objectId: 'saved' }, { objectId: 'new' }]);
    expect(session.undo('shot')?.objects).toEqual([{ objectId: 'saved' }]);
    expect(session.redo('shot')?.objects).toHaveLength(2);
    session.record('shot', []);
    expect(session.undo('shot')?.objects).toHaveLength(2);
  });

  it('isolates two editors for the same image and clears only the closed session', () => {
    const first = createEditorSession({ shot: { objects: [{ objectId: 'initial' }] } });
    const second = createEditorSession({ shot: { objects: [{ objectId: 'initial' }] } });
    first.record('shot', [{ objectId: 'first' }]);
    second.record('shot', [{ objectId: 'second' }]);
    first.clipboard.objects = [{ objectId: 'copied' }];
    first.clear();
    expect(first.clipboard.objects).toEqual([]);
    expect(second.clipboard.objects).toEqual([]);
    expect(second.annotationsStorage.getSnapshot().shot?.objects).toEqual([{ objectId: 'second' }]);
    expect(second.undo('shot')?.objects).toEqual([{ objectId: 'initial' }]);
  });

  it('snapshots mutations, drops redo after a new edit, and bounds the undo history', () => {
    const session = createEditorSession();
    const objects = [{ left: 1 }];
    session.record('shot', objects);
    objects[0]!.left = 99;
    expect(session.annotationsStorage.getSnapshot().shot?.objects).toEqual([{ left: 1 }]);
    session.undo('shot');
    session.record('shot', [{ left: 2 }]);
    expect(session.redo('shot')).toBeNull();
    for (let left = 3; left < 120; left++) session.record('shot', [{ left }]);
    expect(session.annotationsHistoryStorage.getSnapshot().shot?.objects).toHaveLength(101);
    session.record('other', [{ left: 8 }]);
    session.remove('shot');
    expect(session.annotationsStorage.getSnapshot().other?.objects).toEqual([{ left: 8 }]);
  });
});
