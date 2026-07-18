import { describe, it, expect } from 'vitest';

import { reportToText } from './report-to-text.util';

describe('reportToText', () => {
  it('should format a complete report correctly', () => {
    const mockReport = {
      steps: ['Click button', 'Wait for load'],
      evidence: {
        errors: ['ReferenceError: x is not defined'],
        network: ['GET /api/data 404'],
        console: ['warn: slow rendering'],
      },
      suspectedCause: 'Missing variable',
      suggestedOwner: '@frontend-team',
    };

    const result = reportToText(mockReport);
    expect(result).toContain('Steps to Reproduce:\n- Click button\n- Wait for load');
    expect(result).toContain('Errors:\n- ReferenceError: x is not defined');
    expect(result).toContain('Network:\n- GET /api/data 404');
    expect(result).toContain('Console:\n- warn: slow rendering');
    expect(result).toContain('Suspected Cause: Missing variable');
    expect(result).toContain('Suggested Owner: @frontend-team');
  });

  it('should handle empty reports without crashing', () => {
    const result = reportToText({});
    expect(result).toBe('');
  });

  it('should handle partial evidence correctly', () => {
    const mockReport = {
      evidence: {
        errors: ['SyntaxError'],
      },
    };

    const result = reportToText(mockReport);
    expect(result).toContain('Errors:\n- SyntaxError');
    expect(result).not.toContain('Network:');
    expect(result).not.toContain('Console:');
  });
});
