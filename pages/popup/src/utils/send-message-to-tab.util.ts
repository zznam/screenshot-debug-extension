import { createSendMessageToTab } from '@extension/shared';

const sendMessageToTab = <Response>(tabId: number, message: Record<string, unknown>) =>
  createSendMessageToTab(chrome)<Response>(tabId, message);

export { createSendMessageToTab, sendMessageToTab };
