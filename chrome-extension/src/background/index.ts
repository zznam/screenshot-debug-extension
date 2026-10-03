import { tabs, contextMenus, runtime, webRequest, webNavigation } from 'webextension-polyfill';

import {
  handleOnCaptureCommand,
  handleOnBeforeRequest,
  handleOnBeforeSendHeaders,
  handleOnCompleted,
  handleOnContextMenuClicked,
  handleOnInstalled,
  handleOnMessage,
  handleOnTabRemoved,
  handleOnTabUpdated,
  handleOnCommitted,
} from '@src/services';
import { initBadgeListener } from '@src/services/badge.service';
import { initRetentionCleanup } from '@src/services/retention.service';

initBadgeListener();
initRetentionCleanup();

tabs.onRemoved.addListener(handleOnTabRemoved);
tabs.onUpdated.addListener(handleOnTabUpdated);
runtime.onMessage.addListener(handleOnMessage);
runtime.onInstalled.addListener(handleOnInstalled);
contextMenus.onClicked.addListener(handleOnContextMenuClicked);

/**
 * @todo
 * there is an scenario when tabId is -1,
 * but we know the requestId and we can use it to populate the right request data
 *
 * related to all 3 web req states
 */
webRequest.onBeforeRequest.addListener(handleOnBeforeRequest, { urls: ['<all_urls>'] }, ['requestBody']);
webRequest.onBeforeSendHeaders.addListener(handleOnBeforeSendHeaders, { urls: ['<all_urls>'] }, ['requestHeaders']);
webRequest.onCompleted.addListener(handleOnCompleted, { urls: ['<all_urls>'] });
webNavigation.onCommitted.addListener(handleOnCommitted);
chrome.commands.onCommand.addListener((command, tab) => void handleOnCaptureCommand(command, tab));
