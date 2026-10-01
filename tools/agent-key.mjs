// tools/agent-key.mjs — load the devlog agent key for tools/sign.mjs and tools/pin.mjs. Local only.
//
// The mnemonic is read from the macOS Keychain (service "tet-agent-mnemonic", account "tet-devlog")
// by the process that uses it, so it is never in a file, an environment variable or shell history.
// TET_MNEMONIC, when set, wins; that is for tests with the public interop key, not for the real one.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
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

// A built tet-agent-sdk that has the agent signer. TET_AGENT_SDK wins; otherwise the main checkout once
// agent-identity is merged there, else the agent-identity worktree.
const SDK_CANDIDATES = [
  path.join(os.homedir(), 'Nexus_Network', 'tet-agent-sdk'),
  path.join(os.homedir(), 'Nexus_Network-agent-identity', 'tet-agent-sdk'),
];

// dist/agent.js exists on main too, as an older module without the signer; check for the export itself.
const hasSigner = d => { try { return fs.readFileSync(path.join(d, 'dist', 'agent.js'), 'utf8').includes('export async function signPayloadEnvelope'); } catch { return false; } };

/** Returns { wallet, signPayloadEnvelope } from a built tet-agent-sdk. */
export async function loadAgent() {
  const sdkDir = process.env.TET_AGENT_SDK || SDK_CANDIDATES.find(hasSigner);
  if (!sdkDir) throw new Error(`no built tet-agent-sdk with the agent signer: run (npm ci && npm run build) in one of ${SDK_CANDIDATES.join(', ')}, or set TET_AGENT_SDK`);
  const sdk = p => import(pathToFileURL(path.join(sdkDir, 'dist', p)).href);
  const { loadHybridWalletFromMnemonic } = await sdk('wallet_from_mnemonic.js');
  const { signPayloadEnvelope } = await sdk('agent.js');
  if (typeof signPayloadEnvelope !== 'function') throw new Error(`${sdkDir} is a tet-agent-sdk build without the agent signer`);
  const mnemonic = readMnemonic();
  if (mnemonic.split(/\s+/).length !== 12) throw new Error('the agent mnemonic is not 12 words');
  return { wallet: await loadHybridWalletFromMnemonic(mnemonic), signPayloadEnvelope };
}
