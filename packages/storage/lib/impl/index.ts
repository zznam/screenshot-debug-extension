export { annotationsHistoryStorage, annotationsRedoStorage, annotationsStorage } from './annotations/index.js';
export { authIdentityProviderStorage, authTokensStorage } from './auth/index.js';
export {
  captureNotifyStorage,
  captureStateStorage,
  captureTabStorage,
  debugModeStorage,
  rewindSettingsStorage,
} from './capture/index.js';
export * from './capture/settings.storage.js';
export * from './capture/domain-skip-list.storage.js';
export * from './capture/recording-settings.storage.js';
export type { AuthTokensStorage } from './auth/index.js';
export type {
  CaptureNotifyStorage,
  CaptureState,
  VideoRecordingState,
  ScreenshotCaptureState,
  CaptureMode,
} from './capture/index.js';

export * from './theme.storage.js';
export * from './user-uuid.storage.js';
