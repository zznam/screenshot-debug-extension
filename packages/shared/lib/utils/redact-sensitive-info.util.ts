import { isNonProduction } from './is-non-production.util.js';
import { REDACTED_KEYWORD } from '../constants/redacted-keyword.constants.js';
import { EXEMPT_KEYS, keyMatches, NON_SENSITIVE_KEYS, STRONG_KEYS } from '../constants/sensitive-keywords.constants.js';
import {
  highRiskValuePatterns,
  keyedSecretPatterns,
  optionalPiiPatterns,
} from '../constants/sensitive-patterns.constants.js';

type Strength = 'strong' | 'allow' | 'unknown';

const redactSkipCache = new Map<string, boolean>();

const classifyField = (ctx: {
  key?: string;
  name?: string;
  label?: string;
  type?: string;
}): 'strong' | 'allow' | 'unknown' => {
  const hay = [ctx.key, ctx.name, ctx.label, ctx.type].filter(Boolean).join(' ').toLowerCase();
  if (keyMatches(hay, STRONG_KEYS)) return 'strong';
  if (keyMatches(hay, EXEMPT_KEYS)) return 'allow';
  if (keyMatches(hay, NON_SENSITIVE_KEYS)) return 'allow';

  return 'unknown';
};

/**
 * Applies redaction rules to a raw string using defined regex patterns.
 * @param value - The string to redact.
 * @returns Redacted string.
 */
const redactString = (value: string, ctxStrength: Strength): string => {
  if (!value || ctxStrength === 'allow') return value;

  const pass = (patterns: { pattern: RegExp; groupIndex?: number }[]) => {
    for (const { pattern, groupIndex } of patterns) {
      const out = value.replace(pattern, (...args) => {
        if (groupIndex !== undefined && args[groupIndex]) {
          const full = args[0];
          return full.replace(args[groupIndex], REDACTED_KEYWORD);
        }
        return REDACTED_KEYWORD;
      });
      if (out !== value) return out;
    }
    return value;
  };

  let out = pass(highRiskValuePatterns);
  if (out !== value) return out;

  out = pass(keyedSecretPatterns);
  if (out !== value) return out;

  if (ctxStrength === 'strong') {
    out = pass(optionalPiiPatterns);
  }
  return out;
};

/** Redact a string that may contain JSON while preserving string type. */
const redactPossiblyJsonString = (
  input: string,
  shouldSkipRedaction: boolean,
  ctx?: { strength: Strength },
): string => {
  const trimmed = input.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(input);
      const redacted = deepRedactInternal(parsed, shouldSkipRedaction, ctx);
      return JSON.stringify(redacted);
    } catch {
      return redactString(input, ctx?.strength ?? 'unknown');
    }
  }
  return redactString(input, ctx?.strength ?? 'unknown');
};

/**
 * Determines if an object contains a context where `name` matches a sensitive key.
 * @param obj - The object to inspect.
 * @returns True if the context suggests sensitive data.
 */
const shouldRedactByNameValueContext = (obj: unknown): boolean => {
  const name =
    typeof (obj as Record<string, unknown>)?.name === 'string' ? (obj as Record<string, unknown>).name : undefined;
  const key =
    typeof (obj as Record<string, unknown>)?.key === 'string' ? (obj as Record<string, unknown>).key : undefined;

  return keyMatches(name as string | undefined, STRONG_KEYS) || keyMatches(key as string | undefined, STRONG_KEYS);
};

/**
 * Internal recursive function that redacts sensitive values.
 * @param input - Any data.
 * @param shouldSkipRedaction - If true, redaction is bypassed entirely.
 * @param ctx - Optional context (derived from key/name/label/type).
 */
const deepRedactInternal = (input: unknown, shouldSkipRedaction: boolean, ctx?: { strength: Strength }): unknown => {
  if (shouldSkipRedaction || input === null || input === undefined) return input;

  if (typeof input === 'string') {
    return redactPossiblyJsonString(input, shouldSkipRedaction, ctx);
  }

  if (Array.isArray(input)) {
    return input.map(item => deepRedactInternal(item, shouldSkipRedaction, ctx));
  }

  if (typeof input !== 'object') return input;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    // Build field-level context
    const fieldCtx = {
      key,
      name: (typeof (input as Record<string, unknown>).name === 'string'
        ? (input as Record<string, unknown>).name
        : undefined) as string | undefined,
      label: (typeof (input as Record<string, unknown>).label === 'string'
        ? (input as Record<string, unknown>).label
        : undefined) as string | undefined,
      type: (typeof (input as Record<string, unknown>).type === 'string'
        ? (input as Record<string, unknown>).type
        : undefined) as string | undefined,
    };
    const strength = classifyField(fieldCtx); // 'strong' | 'allow' | 'unknown'

    // CASE 1: value in { key: "secret", value: "..." }
    if (key === 'value' && typeof value === 'string') {
      const nameKeyStrong =
        shouldRedactByNameValueContext(input) ||
        keyMatches((input as Record<string, unknown>).key as string | undefined, STRONG_KEYS) ||
        keyMatches((input as Record<string, unknown>).name as string | undefined, STRONG_KEYS);

      if (nameKeyStrong) {
        result[key] = REDACTED_KEYWORD;
        continue;
      }
      result[key] = deepRedactInternal(value, shouldSkipRedaction, { strength });
      continue;
    }

    // CASE 2: key-value pairs like { secret: "..." }
    if (typeof key === 'string' && typeof value === 'string') {
      if (keyMatches(key, STRONG_KEYS)) {
        result[key] = REDACTED_KEYWORD;
        continue;
      }
      if (keyMatches(key, EXEMPT_KEYS) || keyMatches(key, NON_SENSITIVE_KEYS)) {
        // explicitly allowed by name
        result[key] = value;
        continue;
      }
      // otherwise process string with context
      result[key] = deepRedactInternal(value, shouldSkipRedaction, { strength });
      continue;
    }

    // Recurse for nested structures, propagate context strength for this field
    result[key] = deepRedactInternal(value, shouldSkipRedaction, { strength });
  }

  return result;
};

/**
 * Deeply redacts sensitive information from an input structure.
 * Automatically skips redaction in non-production environments.
 * Uses cache when `uuid` is available on the object.
 *
 * @param input - Any value (object, array, string, etc.) to redact.
 * @param url - Optional URL to determine if redaction should apply (e.g. non-prod).
 * @returns Redacted copy of the input.
 */
export const deepRedactSensitiveInfo = <T>(input: T, tabUrl?: string): T => {
  if (!input) return input;
  const nonProd = isNonProduction(tabUrl);
  const cacheKey =
    input && typeof input === 'object' && (input as Record<string, unknown>).uuid
      ? `${(input as Record<string, unknown>).uuid}::${nonProd ? 'nonprod' : 'prod'}`
      : undefined;

  let shouldSkipRedaction = false;

  if (cacheKey) {
    const cached = redactSkipCache.get(cacheKey);
    if (cached !== undefined) {
      shouldSkipRedaction = cached;
    } else {
      shouldSkipRedaction = nonProd;
      redactSkipCache.set(cacheKey, shouldSkipRedaction);
    }
  } else {
    shouldSkipRedaction = nonProd;
  }

  return deepRedactInternal(input, shouldSkipRedaction) as T;
};
