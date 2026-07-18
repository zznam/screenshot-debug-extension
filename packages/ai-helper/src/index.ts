import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { createOpenAiResponder } from './openai-client';
import { createHelperServer, HELPER_HOST, HELPER_PORT } from './server';

const tokenDirectory = join(homedir(), '.screenshot-debug-extension');
const tokenPath = join(tokenDirectory, 'ai-helper-token');

const getPairingToken = async () => {
  try {
    return { token: (await readFile(tokenPath, 'utf8')).trim(), created: false };
  } catch {
    const token = randomBytes(32).toString('hex');
    await mkdir(tokenDirectory, { recursive: true, mode: 0o700 });
    await writeFile(tokenPath, `${token}\n`, { mode: 0o600 });
    return { token, created: true };
  }
};

const apiKey = process.env.OPENAI_API_KEY?.trim();
const model = process.env.OPENAI_MODEL?.trim() || 'gpt-5.6-terra';
const pairing = await getPairingToken();
const createResponse = apiKey
  ? createOpenAiResponder(apiKey, model)
  : async () => {
      throw new Error('OPENAI_API_KEY is not set.');
    };

createHelperServer({ apiKey, model, pairingToken: pairing.token, createResponse }).listen(
  HELPER_PORT,
  HELPER_HOST,
  () => {
    console.log(`[AI helper] Listening at http://${HELPER_HOST}:${HELPER_PORT}`);
    console.log(`[AI helper] Model: ${model}`);
    console.log(`[AI helper] API key: ${apiKey ? 'configured' : 'missing'}`);
    if (pairing.created) console.log(`[AI helper] Pairing token: ${pairing.token}`);
    else console.log(`[AI helper] Pairing token file: ${tokenPath}`);
  },
);
