import OpenAI from 'openai';
import type { ResponseInput } from 'openai/resources/responses/responses';

import type { AiHelperResponseRequest } from '@extension/shared';

const instructions = `You are an expert web debugging assistant. Analyze only the supplied evidence. Clearly separate observed facts from inference. Rank likely root causes, cite relevant console or network evidence, propose concrete fixes, and end with concise verification steps. Never claim to have executed code or inspected data that was not supplied.`;

const contextText = (request: AiHelperResponseRequest) => {
  if (!request.context) return '';
  return [
    `Source title: ${request.context.sourceTitle}`,
    `Source URL: ${request.context.sourceUrl}`,
    `Captured at: ${new Date(request.context.capturedAt).toISOString()}`,
    `Records truncated: ${request.context.recordsTruncated}`,
    `Diagnostics JSON:\n${JSON.stringify(request.context.records)}`,
  ].join('\n');
};

export const createOpenAiResponder = (apiKey: string, model: string) => {
  const client = new OpenAI({ apiKey });

  return async (request: AiHelperResponseRequest, signal: AbortSignal) => {
    const history: ResponseInput = request.messages.map(message => ({ role: message.role, content: message.content }));
    const context = request.context;
    if (context) {
      history.unshift({
        role: 'user',
        content: [
          { type: 'input_text', text: contextText(request) },
          ...(context.screenshotDataUrl
            ? [{ type: 'input_image' as const, image_url: context.screenshotDataUrl, detail: 'auto' as const }]
            : []),
        ],
      });
    }

    const response = await client.responses.create({ model, store: false, instructions, input: history }, { signal });
    if (!response.output_text) throw new Error('OpenAI returned an empty response.');
    return {
      text: response.output_text,
      model: response.model,
      usage: response.usage
        ? {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    };
  };
};
