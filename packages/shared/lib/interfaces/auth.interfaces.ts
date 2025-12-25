import type { AuthMethod } from '../constants/index.js';

export interface AuthPayload {
  authMethod: AuthMethod;
  value: string;
}

export interface LoginPayload extends AuthPayload {
  password: string;
}
