import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  deleteAiDebugSession,
  findAiDebugSession,
  getAiDebugSession,
  listAiDebugSessions,
  putAiDebugSession,
} from './ai-debug-indexed-db.service';
import {
  getAiDebug,
  limitAiDebugRecords,
  listAiDebug,
  removeAiDebug,
  saveAiDebugMessage,
  startAiDebug,
} from './ai-debug.service';
import { getRecords } from '../utils';

const { tabs } = vi.hoisted(() => ({
  tabs: {
    get: vi.fn(),
    sendMessage: vi.fn(),
    captureVisibleTab: vi.fn(),
    query: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    reload: vi.fn(),
  },
}));

vi.mock('webextension-polyfill', () => ({
  tabs,
  runtime: { getURL: (path: string) => `chrome-extension://id/${path}` },
}));
vi.mock('../utils', () => ({ getRecords: vi.fn() }));
vi.mock('./ai-debug-indexed-db.service', () => ({
  findAiDebugSession: vi.fn(),
  putAiDebugSession: vi.fn(),
  getAiDebugSession: vi.fn(),
  listAiDebugSessions: vi.fn(),
  deleteAiDebugSession: vi.fn(),
}));

describe('AI Debug orchestration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('chrome', { windows: { update: vi.fn() } });
    tabs.get.mockResolvedValue({ id: 7, windowId: 2, active: true, url: 'https://example.com/app', title: 'App' });
    tabs.sendMessage.mockResolvedValue({ sourceId: 'source-7' });
    tabs.captureVisibleTab.mockResolvedValue('data:image/jpeg;base64,c2NyZWVu');
    tabs.query.mockResolvedValue([]);
    tabs.create.mockResolvedValue({ id: 8 });
    vi.mocked(getRecords).mockResolvedValue([]);
    vi.mocked(findAiDebugSession).mockResolvedValue(null);
  });

  it('captures and persists context before opening the AI page', async () => {
    const response = await startAiDebug(7);
    expect(response.status).toBe('success');
    expect(tabs.captureVisibleTab).toHaveBeenCalledWith(2, { format: 'jpeg', quality: 80 });
    expect(putAiDebugSession).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'prepared',
        context: expect.objectContaining({
          sourceTabId: 7,
          sourceId: 'source-7',
          screenshotDataUrl: expect.any(String),
        }),
      }),
    );
    expect(vi.mocked(putAiDebugSession).mock.invocationCallOrder[0]).toBeLessThan(
      tabs.create.mock.invocationCallOrder[0],
    );
  });

  it('uses a prepared annotated screenshot without recapturing the viewport', async () => {
    const annotated = 'data:image/png;base64,YW5ub3RhdGVk';
    const response = await startAiDebug(7, annotated);
    expect(response.status).toBe('success');
    expect(tabs.captureVisibleTab).not.toHaveBeenCalled();
    expect(putAiDebugSession).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'prepared',
        context: expect.objectContaining({ screenshotDataUrl: annotated }),
      }),
    );
  });

  it('reuses the source session while refreshing its context', async () => {
    vi.mocked(findAiDebugSession).mockResolvedValue({
      id: 'existing',
      createdAt: 1,
      updatedAt: 1,
      model: 'custom-model',
      status: 'ready',
      messages: [{ id: 'a', role: 'assistant', content: 'previous', createdAt: 1 }],
      context: {
        sourceTabId: 7,
        sourceId: 'source-7',
        sourceUrl: 'https://example.com/app',
        sourceTitle: 'App',
        capturedAt: 1,
        screenshotDataUrl: 'old',
        records: [],
        recordsTruncated: false,
      },
    });

    const response = await startAiDebug(7);
    expect(response.status).toBe('success');
    expect(putAiDebugSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'existing',
        model: 'custom-model',
        status: 'prepared',
        messages: expect.any(Array),
      }),
    );
  });

  it('rejects restricted pages without capturing or opening a tab', async () => {
    tabs.get.mockResolvedValue({ id: 7, url: 'chrome://extensions', title: 'Extensions' });
    await expect(startAiDebug(7)).resolves.toEqual({
      status: 'error',
      code: 'RESTRICTED_URL',
      message: 'AI Debug works on regular HTTP or HTTPS pages.',
    });
    expect(tabs.captureVisibleTab).not.toHaveBeenCalled();
    expect(tabs.create).not.toHaveBeenCalled();
  });

  it('keeps diagnostics when screenshot capture fails', async () => {
    tabs.captureVisibleTab.mockRejectedValue(new Error('denied'));
    vi.mocked(getRecords).mockResolvedValue([{ timestamp: 1, method: 'error', message: 'boom' }] as never[]);
    const response = await startAiDebug(7);
    expect(response.status).toBe('success');
    expect(putAiDebugSession).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error', context: expect.objectContaining({ screenshotDataUrl: null }) }),
    );
  });

  it('rejects a closed source tab without creating a session', async () => {
    tabs.get.mockRejectedValue(new Error('closed'));
    await expect(startAiDebug(7)).resolves.toMatchObject({ code: 'TAB_NOT_FOUND' });
    expect(putAiDebugSession).not.toHaveBeenCalled();
  });

  it('never captures an inactive source tab', async () => {
    tabs.get.mockResolvedValue({ id: 7, windowId: 2, active: false, url: 'https://example.com/app' });
    await startAiDebug(7);
    expect(tabs.captureVisibleTab).not.toHaveBeenCalled();
    expect(putAiDebugSession).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error', context: expect.objectContaining({ screenshotDataUrl: null }) }),
    );
  });

  it('discards a screenshot if the source navigates while capture is in flight', async () => {
    const source = { id: 7, windowId: 2, active: true, url: 'https://example.com/app' };
    tabs.get
      .mockResolvedValueOnce(source)
      .mockResolvedValueOnce(source)
      .mockResolvedValueOnce({ ...source, url: 'https://example.com/other' });
    await startAiDebug(7);
    expect(putAiDebugSession).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error', context: expect.objectContaining({ screenshotDataUrl: null }) }),
    );
  });

  it('uses a fallback source ID and focuses an existing AI tab', async () => {
    tabs.sendMessage.mockRejectedValue(new Error('missing receiver'));
    vi.mocked(findAiDebugSession).mockResolvedValue({ id: 'existing', createdAt: 1, messages: [] } as never);
    tabs.query.mockResolvedValue([
      { id: 8, windowId: 2, url: 'chrome-extension://id/ai-debug/index.html?session=existing' },
    ]);
    await startAiDebug(7);
    expect(findAiDebugSession).toHaveBeenCalledWith('tab-7', 7);
    expect(tabs.update).toHaveBeenCalledWith(8, { active: true });
    expect(tabs.reload).toHaveBeenCalledWith(8);
    expect(chrome.windows.update).toHaveBeenCalledWith(2, { focused: true });
    expect(tabs.create).not.toHaveBeenCalled();
  });

  it('enforces the byte limit even before reaching the record-count limit', () => {
    const result = limitAiDebugRecords([{ timestamp: 1, message: 'x'.repeat(1024 * 1024) }]);
    expect(result).toEqual({ records: [], truncated: true });
    expect(limitAiDebugRecords([])).toEqual({ records: [], truncated: false });
  });

  it('reports missing sessions and lists or deletes stored sessions', async () => {
    vi.mocked(getAiDebugSession).mockResolvedValue(null);
    await expect(getAiDebug('missing')).resolves.toMatchObject({ code: 'SESSION_NOT_FOUND' });
    await expect(
      saveAiDebugMessage('missing', { id: 'm', role: 'user', content: 'hello', createdAt: 1 }),
    ).resolves.toMatchObject({ code: 'SESSION_NOT_FOUND' });
    vi.mocked(listAiDebugSessions).mockResolvedValue([]);
    await expect(listAiDebug()).resolves.toEqual({ status: 'success', sessions: [] });
    await expect(removeAiDebug('old')).resolves.toEqual({ status: 'success' });
    expect(deleteAiDebugSession).toHaveBeenCalledWith('old');
  });

  it('persists messages once and marks assistant responses ready', async () => {
    await startAiDebug(7);
    const session = vi.mocked(putAiDebugSession).mock.calls[0][0];
    vi.mocked(getAiDebugSession).mockResolvedValue(session);
    await expect(getAiDebug(session.id)).resolves.toEqual({ status: 'success', session });
    const message = { id: 'answer', role: 'assistant' as const, content: 'Try this', createdAt: 1 };
    await saveAiDebugMessage(session.id, message, 'new-model');
    const updated = vi.mocked(putAiDebugSession).mock.calls.at(-1)![0];
    expect(updated).toMatchObject({ status: 'ready', model: 'new-model', messages: [message] });
    vi.mocked(getAiDebugSession).mockResolvedValue(updated);
    await saveAiDebugMessage(session.id, message);
    expect(vi.mocked(putAiDebugSession).mock.calls.at(-1)![0].messages).toHaveLength(1);
    await saveAiDebugMessage(session.id, { ...message, id: 'question', role: 'user' });
    expect(vi.mocked(putAiDebugSession).mock.calls.at(-1)![0]).toMatchObject({
      status: 'prepared',
      model: 'new-model',
    });
  });

  it('redacts secrets, keeps newest records, and marks truncation', () => {
    const records = Array.from({ length: 205 }, (_, index) => ({
      timestamp: index,
      authorization: index === 204 ? 'Bearer top-secret-value' : `value-${index}`,
    }));
    const result = limitAiDebugRecords(records);
    expect(result.records).toHaveLength(200);
    expect(result.truncated).toBe(true);
    expect(JSON.stringify(result.records)).not.toContain('top-secret-value');
  });
});
