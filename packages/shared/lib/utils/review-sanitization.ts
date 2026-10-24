import { deepRedactSensitiveInfo } from './redact-sensitive-info.util.js';

const sanitizeText = (text: string): string =>
  deepRedactSensitiveInfo(text, 'https://share-review.example')
    .replace(
      /\b(password|passwd|pwd|token|secret|api[_-]?key|authorization|access[_-]?token|refresh[_-]?token)(["'\s]*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;&}]+)/gi,
      '$1$2[REDACTED]',
    )
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[REDACTED_EMAIL]');
const sanitizeRecord = (value: unknown): unknown =>
  JSON.parse(
    JSON.stringify(deepRedactSensitiveInfo(value, 'https://share-review.example')) ?? 'null',
    (_key, item: unknown) => (typeof item === 'string' ? sanitizeText(item) : item),
  );

export { sanitizeText, sanitizeRecord };
