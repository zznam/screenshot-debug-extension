import type { ReportFields } from './review-export';

const reportTemplates = {
  blank: { label: 'Blank report', steps: '', expected: '', actual: '' },
  bug: {
    label: 'Bug report',
    steps: '1. Open the affected page.\n2. Perform the action that triggers the issue.\n3. Observe the result.',
    expected: 'Describe what should happen.',
    actual: 'Describe what happened and how often it occurs.',
  },
  regression: {
    label: 'Regression',
    steps:
      '1. Identify the last working version.\n2. Repeat the same steps in the current version.\n3. Compare the results.',
    expected: 'Describe the behavior in the last working version.',
    actual: 'Describe the changed behavior and the first affected version.',
  },
  accessibility: {
    label: 'Accessibility',
    steps:
      '1. Note the browser and assistive technology.\n2. Navigate to the control using the keyboard or assistive technology.\n3. Attempt the intended action.',
    expected: 'Describe the expected focus, label, announcement, or interaction.',
    actual: 'Describe the barrier and who is affected.',
  },
} as const;
type ReportTemplate = keyof typeof reportTemplates;
const applyReportTemplate = (fields: ReportFields, template: ReportTemplate): ReportFields => {
  const { steps, expected, actual } = reportTemplates[template];
  return { ...fields, steps, expected, actual };
};

export { reportTemplates, applyReportTemplate };
export type { ReportTemplate };
