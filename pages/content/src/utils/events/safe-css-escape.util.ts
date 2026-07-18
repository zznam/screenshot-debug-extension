/** Safe CSS.escape fallback for older engines. */
export const cssEscape = (s: string) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).CSS?.escape
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).CSS.escape(s)
    : // eslint-disable-next-line no-useless-escape
      s.replace(/([ !"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~])/g, '\\$1');
