export const IS_DEV = process.env['CLI_DEV'] === 'true';
export const CLI_ENV = process.env['CLI_ENV'];
export const IS_PROD = !IS_DEV;
export const IS_FIREFOX = process.env['CLI_FIREFOX'] === 'true';
export const IS_CI = process.env['CI'] === 'true';
export const NAME = process.env['NAME'];
