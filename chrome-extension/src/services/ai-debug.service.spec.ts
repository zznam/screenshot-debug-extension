import { beforeEach, describe, expect, it, vi } from 'vitest';

import { findAiDebugSession, putAiDebugSession } from './ai-debug-indexed-db.service';
import { limitAiDebugRecords, startAiDebug } from './ai-debug.service';
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
    vi.clearAllMocks();
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
