// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const reportToText = (report: any): string => {
  const lines: string[] = [];
  //   lines.push(`${report.title} [${report.severity}]`);
  //   lines.push(report.summary);
  //   lines.push('');

  if (report.steps?.length) {
    lines.push('Steps to Reproduce:');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lines.push(...report.steps.map((s: any) => `- ${s}`));
    lines.push('');
  }

  if (report.evidence) {
    if (report.evidence.errors?.length) {
      lines.push('Errors:');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lines.push(...report.evidence.errors.map((s: any) => `- ${s}`));
      lines.push('');
    }
    if (report.evidence.network?.length) {
      lines.push('Network:');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lines.push(...report.evidence.network.map((s: any) => `- ${s}`));

      lines.push('');
    }
    if (report.evidence.console?.length) {
      lines.push('Console:');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lines.push(...report.evidence.console.map((s: any) => `- ${s}`));
      lines.push('');
    }
  }

  if (report.suspectedCause) lines.push(`Suspected Cause: ${report.suspectedCause}`);
  if (report.suggestedOwner) lines.push(`Suggested Owner: ${report.suggestedOwner}`);
  return lines.join('\n');
};
