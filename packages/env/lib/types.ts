import type { dynamicEnvValues } from './index.js';

interface ICebEnv {
  readonly NAME: string;
}

interface ICebCliEnv {
  readonly CLI_ENV: string;
  readonly CLI_DEV: string;
  readonly CLI_FIREFOX: string;
}

export type IEnv = ICebEnv & ICebCliEnv & typeof dynamicEnvValues;
