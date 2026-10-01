// tools/agent-key.mjs — load the devlog agent key for tools/sign.mjs and tools/pin.mjs. Local only.
//
// The mnemonic is read from the macOS Keychain (service "tet-agent-mnemonic", account "tet-devlog")
// by the process that uses it, so it is never in a file, an environment variable or shell history.
// TET_MNEMONIC, when set, wins; that is for tests with the public interop key, not for the real one.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const KEYCHAIN_SERVICE = 'tet-agent-mnemonic';
export const KEYCHAIN_ACCOUNT = 'tet-devlog';

function readMnemonic() {
  if (process.env.TET_MNEMONIC) return process.env.TET_MNEMONIC;
  try {
    return execFileSync('security', ['find-generic-password', '-s', KEYCHAIN_SERVICE, '-a', KEYCHAIN_ACCOUNT, '-w'],
      { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    throw new Error(`no agent key: nothing in the Keychain under service "${KEYCHAIN_SERVICE}", account "${KEYCHAIN_ACCOUNT}"`);
  }
}

/** Returns { wallet, signPayloadEnvelope } from the SDK at TET_AGENT_SDK (a built tet-agent-sdk, branch agent-identity). */
export async function loadAgent() {
  const sdkDir = process.env.TET_AGENT_SDK;
  if (!sdkDir) throw new Error('TET_AGENT_SDK is not set: path to a built tet-agent-sdk from branch agent-identity');
  const sdk = p => import(pathToFileURL(path.join(sdkDir, 'dist', p)).href);
  const { loadHybridWalletFromMnemonic } = await sdk('wallet_from_mnemonic.js');
  const { signPayloadEnvelope } = await sdk('agent.js');
  const mnemonic = readMnemonic();
  if (mnemonic.split(/\s+/).length !== 12) throw new Error('the agent mnemonic is not 12 words');
  return { wallet: await loadHybridWalletFromMnemonic(mnemonic), signPayloadEnvelope };
}
