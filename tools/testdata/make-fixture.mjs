// tools/testdata/make-fixture.mjs — regenerate sigs-fixture.json. Local only; needs a built SDK:
//   TET_AGENT_SDK=…/tet-agent-sdk node tools/testdata/make-fixture.mjs
// Key A is the public interop key from tet-agent-sdk/scripts/make_agent_payload_fixture.mjs (it is
// in a public repository and holds nothing). Key B is generated here and discarded: only its
// signatures are kept, which is all the "valid signature, wrong key" case needs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { entryPayloadBytes, mldsa44KeyId, DEVLOG_PAYLOAD_TYPE } from '../../files/tet-verify/verify.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const sdkDir = process.env.TET_AGENT_SDK;
const src = fs.readFileSync(path.join(sdkDir, 'scripts', 'make_agent_payload_fixture.mjs'), 'utf8');
const MNEMONIC_A = src.match(/const MNEMONIC =\s*"([^"]+)"/)[1];
const sdk = p => import(pathToFileURL(path.join(sdkDir, 'dist', p)).href);
const { loadHybridWalletFromMnemonic } = await sdk('wallet_from_mnemonic.js');
const { signPayloadEnvelope } = await sdk('agent.js');
const { generateMnemonic } = await import(pathToFileURL(path.join(sdkDir, 'node_modules', '@scure', 'bip39', 'index.js')).href);
const { wordlist } = await import(pathToFileURL(path.join(sdkDir, 'node_modules', '@scure', 'bip39', 'wordlists', 'english.js')).href);

const a = await loadHybridWalletFromMnemonic(MNEMONIC_A);
const b = await loadHybridWalletFromMnemonic(generateMnemonic(wordlist, 128));
const chain = { chainId: 'tet-devlog-test-1', genesisHash: '0x' + '5e'.repeat(32) };
const otherChain = { chainId: 'tet-devlog-test-2', genesisHash: '0x' + '5e'.repeat(32) };
const entries = [
  { date: '2026-10-01', project: 'tet', title: 'First test entry', body: 'Plain text.\n\nTwo paragraphs, a quote " and a backslash \\.' },
  { date: '2026-10-02', project: 'tet', title: 'Second test entry', body: 'Unicode — dash, 日本語, and an emoji-free line.' },
];
const sign = (w, e, c = chain) => signPayloadEnvelope(w, DEVLOG_PAYLOAD_TYPE, entryPayloadBytes(e), c);
const out = {
  note: 'Test data only. Key A is the public TET interop test key; key B was discarded after signing.',
  pin: {
    chain_id: chain.chainId, genesis_hash: chain.genesisHash,
    agent_ed25519_pubkey_hex: a.walletIdHex64.toLowerCase(),
    agent_mldsa44_keyid: await mldsa44KeyId(a.mldsa44PubkeyB64),
  },
  entries,
  envelopes: {
    a0: await sign(a, entries[0]),
    a1: await sign(a, entries[1]),
    b0: await sign(b, entries[0]),
    a0_other_chain: await sign(a, entries[0], otherChain),
  },
};
fs.writeFileSync(path.join(here, 'sigs-fixture.json'), JSON.stringify(out, null, 2) + '\n');
console.log('wrote sigs-fixture.json');
