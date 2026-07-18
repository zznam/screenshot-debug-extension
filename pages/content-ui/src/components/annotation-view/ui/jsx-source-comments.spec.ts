import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import fg from 'fast-glob';
import { createSourceFile, forEachChild, isJsxText, ScriptKind, ScriptTarget } from 'typescript';
import type { Node } from 'typescript';
import { describe, expect, it } from 'vitest';

const sourceRoot = resolve(import.meta.dirname, '../../../../../..');

describe('rendered JSX labels', () => {
  it('does not render source comments as visible text', async () => {
    const files = await fg(['pages/**/*.tsx', 'packages/**/*.tsx'], { cwd: sourceRoot, absolute: true });
    const leaks: string[] = [];

    for (const file of files) {
      const sourceText = readFileSync(file, 'utf8');
      const source = createSourceFile(file, sourceText, ScriptTarget.Latest, true, ScriptKind.TSX);

      const visit = (node: Node) => {
        if (isJsxText(node)) {
          const text = node.getText(source).trim();
          if (/^(\/\/|\/\*|eslint|TODO|FIXME)/.test(text)) {
            const location = source.getLineAndCharacterOfPosition(node.getStart(source));
            leaks.push(`${file}:${location.line + 1}: ${text}`);
          }
        }
        forEachChild(node, visit);
      };

      visit(source);
    }

    expect(leaks).toEqual([]);
  });
});
