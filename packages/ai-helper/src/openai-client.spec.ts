import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createOpenAiResponder } from './openai-client';

const { create } = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock('openai', () => ({
  default: class MockOpenAI {
    responses = { create };
  },
}));

describe('OpenAI responder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    create.mockResolvedValue({
      output_text: 'Diagnosis',
      model: 'gpt-5.6-terra',
      usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
    });
  });

  it('uses store false and sends local text and image context', async () => {
    const respond = createOpenAiResponder('secret-key', 'gpt-5.6-terra');
    const signal = new AbortController().signal;
    const result = await respond(
      {
        sessionId: 'session',
        messages: [{ id: 'm1', role: 'user', content: 'Find the bug', createdAt: 1 }],
        context: {
          sourceTabId: 1,
          sourceId: 'source',
          sourceUrl: 'https://example.com',
          sourceTitle: 'Example',
          capturedAt: 1,
          screenshotDataUrl: 'data:image/jpeg;base64,AA==',
          records: [{ method: 'GET', status: 500 }],
          recordsTruncated: false,
        },
      },
      signal,
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-5.6-terra',
        store: false,
        input: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.arrayContaining([
              expect.objectContaining({ type: 'input_text' }),
              { type: 'input_image', image_url: 'data:image/jpeg;base64,AA==', detail: 'auto' },
            ]),
          }),
        ]),
      }),
      { signal },
    );
    expect(result).toEqual({
      text: 'Diagnosis',
      model: 'gpt-5.6-terra',
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    });
  });
});
