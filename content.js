// content.js — everything the site says lives in this one file.
//
// To add a log post: copy the last entry in POSTS, paste it at the bottom, change it, save, push.
// Pictures go in images/ and are written as  ![caption](images/name.jpg)  inside any text.
// A picture that isn't uploaded yet is simply not shown, so you can write the line first.
// Text rules: blank line = new paragraph, ## heading, - list, `code`, **bold**, [link](https://...),
// and a code box is three backticks on their own line before and after.
//
// 記事を足すとき：POSTS の最後のエントリをコピーして一番下に貼って書き換えるだけ。
// 写真は images/ に入れて本文に ![説明](images/名前.jpg) と書く。まだ無い写真は表示されないだけ。

window.SITE = {
  url: "https://stevenexus.org",      // the real address once the domain is set up (used for RSS and share cards)
  title: "Steve",
  tagline: "What I'm building, written down as I go.",
  author: { name: "Steve", role: "Founder", location: "Switzerland / Japan" },
  email: "steve@stevenexus.org",
  contact: [
    ["X", "https://x.com/stevenexusz", "@stevenexusz"],
    ["GitHub", "https://github.com/Ai0090", "Ai0090"],
    ["GitHub (TET)", "https://github.com/TET-Network-Foundation", "TET-Network-Foundation"],
    ["Email", "mailto:steve@stevenexus.org", "steve@stevenexus.org"]
  ]
};

// ---------------------------------------------------------------------------
// NOW — the box at the top of the home page. Change it whenever it stops being true.
window.NOW = {
  updated: "2026-09-23",
  doing: [
    ["tet", "Tmail: burn-after-read, time-lock and pinned messages."],
    ["tet", "A watchdog on the Helsinki seed, and an outside check every fifteen minutes."],
    ["kpee", "Getting Kpee in front of the first students and teachers."]
  ],
  help: [
    ["tet", "Run a node for a week and tell me where it broke.", "#/p/tet/use"],
    ["unfog", "Use Unfog for a day and tell me what felt wrong in the first minute.", "https://unfog.tech"],
    ["kpee", "Print one sheet from your own notes and tell me which blank it got wrong.", "files/kpee.html"]
  ]
};

// SHIPPED — work that lives outside my own repos.
window.SHIPPED = [
  ["2026-09-22", "rust-libp2p PR #6635: log when a secondary connection gets no subscriptions", "https://github.com/libp2p/rust-libp2p/pull/6635"]
];

// ---------------------------------------------------------------------------
window.ABOUT = `
I'm Steve. I'm 15 and in school in Switzerland. I grew up moving between Japan, Switzerland, Singapore and Hong Kong, so I think in Japanese and English and I'm used to things changing every couple of years.

I build software after class and on weekends. Mostly Rust for TET, TypeScript for everything else.

## What I'm working on

**TET** is the big one. A blockchain that should still be safe once quantum computers can break today's signatures, with a small desktop on top where you send money, send messages and send files, all with one key. I started it in April after two earlier tries on Substrate and Solana that I threw away.

**Unfog** is a map of where you have actually been. The world starts covered in fog and it clears where you walk. I started it in June because I wanted it for myself.

**Kpee** is a small tool I made in one day because opening Word to print my class notes annoyed me. Paste, print, done.

## How I work

I write down what the code actually does, not what I wish it did. When the whitepaper and the code disagree, the whitepaper gets fixed. I keep a log of everything on this site, including the bugs that were my fault.

## Other things

Italian and Japanese menswear. Tuning EQ until the bass is right. Travelling (Iceland and Hong Kong this summer).

## Thanks

Manu Sheel Gupta, maintainer of rust-libp2p, for reviews, pointers and patience.

## Get in touch

[Write to me](#/contact) on this site, or on X at [@stevenexusz](https://x.com/stevenexusz). I read everything. I answer when I'm out of class.
`;

// ---------------------------------------------------------------------------
window.PROJECTS = {

tet: {
  name: "TET",
  line: "A post-quantum blockchain in Rust, and a small desktop that runs on it.",
  status: "Testnet",
  started: "2026-04",
  links: [["GitHub org", "https://github.com/TET-Network-Foundation"]],
  overview: `
TET is a Layer 1 blockchain I'm writing from scratch in Rust, on libp2p.

The reason it exists: most blockchains sign transactions with Ed25519 or ECDSA. A large enough quantum computer breaks both. TET signs every transaction twice, with Ed25519 and with ML-DSA-44 (the NIST post-quantum standard, FIPS 204), so it stays safe if one of them falls.

On top of the chain there's a desktop I call the Sovereign OS. One key, three things:

- **Send coins.** Transfers go through consensus like any chain.
- **Tmail.** End-to-end encrypted messages between keys. X25519 + Kyber768 for the key exchange, ChaCha20 for the message, signed with Ed25519 + ML-DSA-44.
- **Files.** Send files peer to peer over libp2p. The fee is paid in µTET and settled on chain.

The idea is something you open every day, not a wallet you open once a month.

![The TET desktop](images/tet-desktop.jpg)

## Where it is now

It's a testnet. Honest list:

**Works**
- Nodes find each other over libp2p and agree block for block. A seed runs in Helsinki; a second node in Switzerland matches its state root at every height.
- Signed transfers go through the mempool and consensus, from any node.
- Faucet: a new wallet can claim 1000 test TET once.
- Tmail end to end, and file transfer with on-chain fees (5.2 MB, Switzerland to Helsinki, 7.2 s).
- 185 tests in CI, Docker image with the UI included.

**Not done yet**
- The key exchange uses Kyber round 3, not the final ML-KEM (FIPS 203). The two aren't byte-compatible. The whitepaper says round 3 until I migrate.
- Some code still reads the wall clock inside consensus, which can make nodes disagree. Being removed.
- Nine of seventeen places that write to the ledger outside consensus are still open. Eight are closed.
- The ZK prover image needs rebuilding.

## Where it's going

The whitepaper also describes an AI inference market (pay nodes to run models), a ZK court for disputes (RISC Zero / SP1), and a way to reuse idle GPU miners for inference when mining isn't paying. Those are research, not code yet.

## Who it's for

Right now: developers who want to run a node, break it and tell me. Later: anyone who wants messages and payments that don't depend on a company or on today's cryptography lasting forever.
`,
  use: `
The repository is private while I clean it up. [Write to me](#/contact) for access; I say yes to people who want to run a node.

## Run a node

You need Docker.

\`\`\`
git clone https://github.com/TET-Network-Foundation/TET-OS
cd TET-OS
docker compose up -d
\`\`\`

Check that it's syncing. The height should go up every few seconds.

\`\`\`
curl -s 127.0.0.1:5010/ledger/state
\`\`\`

The public seed node, if you need to set it by hand:

\`\`\`
/ip4/95.217.158.153/tcp/8002/p2p/12D3KooWNcdESJUC1uhuhrMn5anmsGEBhYgCkE8pCbXf8cD7MSEC
\`\`\`

## Get test coins

\`\`\`
tet-cli faucet claim --mnemonic "your twelve words"
\`\`\`

You get 1000 TET in the next block. A second claim returns \`already_claimed\` and pays nothing. If you get a 401, your \`TET_CHAIN_ID\` doesn't match the network.

## Use the desktop

The UI comes with the Docker image. Open it in your browser, create or import a wallet, then:

- **Send** to another address.
- **Messages** to another key. Only the recipient can read them.
- **Files** to another node. You'll see the fee leave your balance.

## If something breaks

Send me the output of \`docker compose logs --tail 200\` and the height you're stuck at.
`,
  how: `
## Transactions

Every transaction is a \`SignedTxEnvelopeV1\` around a \`TxV1\`. What gets signed is not the raw JSON but a canonical preimage that includes the chain id and the genesis hash (\`tx_v1_auth_message_bytes\`), so a signature from one network can't be replayed on another. Two signatures per envelope: Ed25519 and ML-DSA-44. ML-DSA is checked against NIST's ACVP test vectors in CI.

## Network

libp2p with gossipsub for blocks, transactions and Tmail (\`/tet/v1/tmail\`), and a custom request-response codec for files so large bodies don't go through gossip.

## Fees

One file, \`fees.rs\`. There used to be seven different fee schedules in different places. File-transfer fees split 25 / 50 / 25 between treasury, the serving node and burn.

## Rules I keep in the repo

- A regression test only counts if I've shown it fails when the bug is put back. Otherwise it might be testing nothing.
- Signable is not the same as appliable. Before any REST write goes through the mempool, check that consensus actually has a branch that applies that transaction type. I learned this one the hard way.
- The testnet verifies signatures exactly like mainnet will. There used to be a looser dev fallback; it hid a mainnet bug, so it's gone.

## Bugs worth reading about

**Block 9828.** Two nodes disagreed on the state after block 9828. Three causes: wall-clock time read inside consensus, some routes writing to the ledger directly instead of through blocks, and a row being dropped without an error.

**Transactions that never arrived.** Transactions sent to a follower node never reached the block producer. I first blamed gossipsub and said so on X. The real cause was mine: three libp2p swarms sharing one keypair, so they had the same PeerId and stepped on each other. Fixed, and I corrected the post. Separately, \`/ledger/transfer\` wasn't publishing to the transaction topic at all.

**Routes anyone could call.** A clean-up found five kinds of unauthenticated routes, including one that could replace the whole ledger and seven DEX routes that could move other people's funds. All removed.
`,
  files: [
    ["Whitepaper", "", "Genesis draft v1.0, April 2026. Ask me for a copy while the repo is private."]
  ],
  pictures: [
    ["images/tet-desktop.jpg", "The desktop, Windows 95 style"],
    ["images/tet-nodes.jpg", "Two nodes in sync"],
    ["images/tet-tmail.jpg", "Tmail between two wallets"]
  ]
},

unfog: {
  name: "Unfog",
  line: "A map of where you've actually been. The fog clears where you walk.",
  status: "Live",
  started: "2026-06",
  links: [["unfog.tech", "https://unfog.tech"]],
  overview: `
Unfog is a social network where your profile is a map.

The whole world starts covered in fog. It clears only where you physically go, checked by your phone's GPS on the server. Photos you post stay pinned to the exact spot you took them. After a few months your map is a picture of your life outside.

![The map](images/unfog-map.jpg)

## Three maps

- **Yours.** Only the places you walked.
- **Everyone's.** The whole world, cleared by everybody together. The first person to open a place gets a First Footprint there.
- **A group's.** A map you share with friends. It's a group chat, except what builds up is places instead of messages. Good for a trip, a couple, a family, a club.

![Posting a photo where you are](images/unfog-post.jpg)

## Why it's different

Fog of World proved people love clearing a map by walking. It has no friends in it. Instagram has friends but doesn't care whether you were really there. Unfog checks that you were there, and it grows with the time you spend outside, not the time you spend scrolling.

## How people use it

- On a trip: make a group map, everyone's walks go on it, photos pin to where they happened.
- In your own city: find the streets you've never walked.
- Meeting someone: scan each other's code and the place you met becomes a private pin for both of you.

## What's live and what's next

**Live at unfog.tech:** the fog on all three maps, GPS checks against spoofing, posting only where you are, photo pins, First Footprints, daily prompts, your profile map.

**Built, coming next:** following, DMs, comments, notifications, the meeting-pin QR code, Japanese / English / Chinese / Cantonese.

## Things I won't do

Sell location data. Put ads in the feed. Make money from people feeling bad about themselves.
`,
  use: `
1. Open [unfog.tech](https://unfog.tech) on your phone.
2. Sign up with your email.
3. Allow location. Unfog needs it to know where you've been; nobody else sees your exact position.
4. Go for a walk. The fog clears behind you.
5. Take a photo somewhere and post it. It only posts if you're really there.
6. Make a group map and share it with the people you're with.

![Your profile is your map](images/unfog-profile.jpg)
`,
  how: `
Next.js on the front, Supabase (Postgres with PostGIS) behind it, MapLibre for the map. I turned down Google Maps: it costs too much at scale and Google would be both supplier and competitor.

The world is split into tiles. When your phone reports a position, a server function (\`rpc_unlock_tiles\`) checks the speed since your last position, so teleporting doesn't work, and then clears the tiles around you on your map, the world map and any group map you're in.

Posts go through \`rpc_create_post\`, which checks on the server that you're actually at the place. That's what makes a pin mean something.

Every table is behind row-level security. Meeting pins are private to the two people by default.
`,
  files: [],
  pictures: [
    ["images/unfog-map.jpg", "The map"],
    ["images/unfog-post.jpg", "Posting where you are"],
    ["images/unfog-profile.jpg", "Profile"],
    ["images/unfog-group.jpg", "A group map"]
  ]
},

kpee: {
  name: "Kpee",
  line: "Paste your notes, press print. One file, works offline, no AI.",
  status: "Free download",
  started: "2026-09",
  links: [["Open in browser", "files/kpee.html"], ["Download kpee.html", "files/kpee.html"]],
  overview: `
Kpee turns notes you paste into something worth printing: a clean study sheet, a fill-in-the-blanks test, a fold-and-test sheet or cut-out flashcards.

I made it because I kept opening Word just to print my class notes, and that took longer than printing them.

![Kpee](images/kpee-main.jpg)

It's one HTML file. Double-click it and it opens in your browser. No install, no account, no internet. There's no AI inside; the formatting is plain rules. To uninstall it, delete the file.

## Six kinds of print

- **Study sheet.** Headings, bullets, key terms in bold.
- **Fill in the blanks.** Your bold words become numbered blanks. Answers on the last page.
- **Fold & test.** Question on the left, answer on the right. Fold on the line.
- **Flashcards.** Every "Term — definition" line becomes a card. Front and back print mirrored so they line up double-sided.
- **Original.** Exactly what you typed.
- **Cornell notes.** Cue column, notes, summary box.

![Fill in the blanks, printed](images/kpee-print.jpg)

## Who uses it

Students printing revision sheets the night before a test. Teachers making a blanks worksheet from their own notes in a minute. Anyone who wants a flashcard deck without making it card by card.
`,
  use: `
1. [Download kpee.html](files/kpee.html) and double-click it. (Or just [open it here](files/kpee.html).)
2. Paste your notes. From Word, Google Docs, a website or Excel; bold, colours and highlights come across.
3. Pick a kind of print at the top.
4. Press Print.

![Flashcards](images/kpee-cards.jpg)

## Writing notes for it

\`\`\`
# Heading
- bullet
**key term**           becomes a blank and a card
Term — definition      same, without marks
==highlight==
{red|coloured text}
->centred line<-
\`\`\`

Cells copied from Excel become a table. A two-column table (word, meaning) becomes flashcards.

Keys: Ctrl+B bold, Ctrl+U underline, Ctrl+E centre, Ctrl+P print, F1 help. On a Mac, ⌘ instead of Ctrl.

![Practice on screen](images/kpee-practice.jpg)
`,
  how: `
The whole app is one file: styles, the engine, 32 interface languages, and a USER ZONE at the bottom where you can add your own.

It lays out real A4 or Letter pages itself instead of leaving it to the browser, so page numbers and page breaks come out the same in Chrome, Safari and Firefox. Paragraphs longer than a page get split so nothing is cut off.

Adding your own kind of print takes a few lines at the bottom of the file:

\`\`\`
Kpee.addMode('mine', {
  name: 'My print',
  render(doc, ctx) {
    return { html: ctx.util.renderBlocks(doc.blocks), info: '' };
  }
});
\`\`\`

The same goes for styles, colours, languages and the text on the empty page.
`,
  files: [
    ["kpee.html", "files/kpee.html", "The whole app. About 165 KB. Chrome, Edge, Safari, Firefox."]
  ],
  pictures: [
    ["images/kpee-main.jpg", "Kpee"],
    ["images/kpee-print.jpg", "Fill in the blanks, printed"],
    ["images/kpee-cards.jpg", "Flashcards"],
    ["images/kpee-practice.jpg", "Practice on screen"],
    ["images/kpee-blanks.jpg", "Blanks preview"]
  ]
}
};

// ---------------------------------------------------------------------------
// LOG — oldest first. New posts go at the bottom.
// ---------------------------------------------------------------------------
window.POSTS = [
  { date: "2026-04-28", project: "tet", title: "Genesis draft v1.0",
    body: "First full draft of the whitepaper.\n\nTET is a Layer 1 in Rust on libp2p. Transactions are signed with ML-DSA as well as Ed25519, so the chain still holds once quantum computers can break the classical signatures.\n\nTwo earlier tries are archived: one on Substrate (`tet-core-node`) and one on Solana (`nexus-onchain`). Both taught me what I didn't want. This one starts from nothing.\n\nThe product on top isn't a wallet. It's a desktop: send coins, message, share files, one key." },

  { date: "2026-05-31", project: "tet", title: "Payments through consensus, Tmail working end to end",
    body: "Send Coins now goes through consensus instead of writing to the ledger directly.\n\nSame afternoon, Tmail went from nothing to working between two wallets: register a key, write a message, encrypt it (X25519 + Kyber768, ChaCha20), sign it (Ed25519 + ML-DSA-44), gossip it, decrypt it on the other side. The other wallet showed 'Hello'.\n\nOne thing for the record. The Rust Kyber crate is CRYSTALS-Kyber round 3, not FIPS 203 ML-KEM, and the two aren't byte-compatible. The whitepaper now says round 3 until I migrate." },

  { date: "2026-06-07", project: "tet", title: "Applied to the Paradigm Fellowship",
    body: "Applied to the Paradigm Fellowship 2026 with an introduction from Manu. Eight essays." },

  { date: "2026-06-09", project: "tet", title: "Files over libp2p, fees on chain",
    body: "The third piece of the desktop. Files now move over a custom libp2p codec instead of the REST fallback, and the fee settles on chain.\n\nTest: 5.2 MB from my Mac in Switzerland to the server in Helsinki in 7.2 seconds. SHA-256 identical on both ends. Exactly 1000 µTET taken, treasury +250, burn +250, same numbers on both nodes. 15 of 15 interop checks pass.\n\nCoins, messages and files now all work between countries.\n\nThe UI got rebuilt too, as a Windows 95 style shell. The main client file went from about 3,100 lines to 2,200.\n\n![The desktop](images/tet-desktop.jpg)" },

  { date: "2026-06-29", project: "unfog", title: "A map where the fog clears where you walk",
    body: "New project, working name Msns.\n\nFog of World showed that clearing a map by walking is addictive. It was App of the Day in 137 countries. It has no people in it. I want the version with friends: your profile is the map of where you've been, and photos stay pinned where they were taken.\n\nThree fog layers: mine, everyone's, and a shared one for a group.\n\nNext.js, Supabase with PostGIS, MapLibre. Not Google Maps." },

  { date: "2026-07-25", project: "unfog", title: "Live, and the first real post",
    body: "The app runs against a real database now. I signed up like a stranger would and posted a photo. It's on the map.\n\nThe preview had thirty layers of patches on it, so I rebuilt it from zero with one design: paper white, ink black, one red for routes. Four languages, profile grid, follow and DM, comments, report and block.\n\n![First post on the map](images/unfog-first-post.jpg)" },

  { date: "2026-08-04", project: "unfog", title: "Meeting someone becomes a pin",
    body: "I almost built a separate app for swapping contacts with a QR code. It goes inside Unfog instead.\n\nWhen two people scan each other, both get a private pin where they met. It works even if you have zero followers, which helps with the empty-app problem, and no plain QR app can remember the place.\n\nDatabase first, screens after the first users." },

  { date: "2026-08-15", project: "unfog", title: "Msns is now Unfog",
    body: "Real name, real domain: [unfog.tech](https://unfog.tech). Same app. The name says what it does." },

  { date: "2026-09-17", project: "tet", title: "Back after three months",
    body: "IGCSE took the summer. The repo sat untouched from early July.\n\nFirst job back wasn't features. I read the whole codebase and wrote down what actually exists, then started fixing everything where the whitepaper said one thing and the code did another." },

  { date: "2026-09-21", project: "tet", title: "Clean-up: fees, cryptography, open routes",
    body: "Seven fee schedules are now one file. A hidden fee to the founder address is gone, and so is a DEX bug that leaked funds.\n\nCrypto claims now match the code: Kyber round 3 called round 3, ML-DSA set to level 44 everywhere and checked against NIST's test vectors.\n\nRemoved five kinds of routes anyone could call without signing, including one that could replace the whole ledger and seven that could move other people's money.\n\n185 tests in CI. Six of them guard against old bugs coming back, and each one is proven to fail when the bug is put back. Docker image with the UI inside. 72 GB of old build files deleted.\n\nAlso found why two nodes split at block 9828: wall-clock time inside consensus, direct writes to the ledger, and a row dropped without an error." },

  { date: "2026-09-22", project: "tet", title: "Helsinki seed live, second node in sync",
    body: "Seed node is back at `95.217.158.153:8002`. A fresh node in Switzerland syncs from it and matches the state root at every height.\n\nTransactions sent to a follower now reach the block producer. Before this, `/ledger/transfer` never published to the network and nobody had noticed.\n\nI first blamed gossipsub for the missing transactions and said so on X. It was my bug: three swarms sharing one key, so one PeerId. Fixed it and posted a correction.\n\nlibp2p 0.48 → 0.50, which closes three CVEs. Opened a small PR on rust-libp2p (#6635) that logs when a secondary connection gets no subscriptions, so the next person finds this faster.\n\n![Two nodes, same state root](images/tet-nodes.jpg)" },

  { date: "2026-09-23", project: "kpee", title: "Kpee",
    body: "I wrote the idea on paper this morning and it works tonight.\n\nPaste notes, pick study sheet, blanks, fold & test, flashcards or original, print. One HTML file. Offline. No AI. A USER ZONE at the bottom lets anyone add their own modes, colours or languages.\n\nIt does its own page layout so page numbers come out the same in every browser, A4 or Letter. Flashcards print mirrored on the back so they line up when you cut them.\n\n[Download it](files/kpee.html).\n\n![Printed blanks](images/kpee-print.jpg)" },

  { date: "2026-09-23", project: "tet", title: "Next: Tmail extras and monitoring",
    body: "Working on burn-after-read, time-lock and pinned messages for Tmail, a watchdog that restarts the seed if the height stops moving, and an outside check every fifteen minutes.\n\nAfter that, a note to Manu with how to join: `docker compose up`, the seed address, and what I found in libp2p." }
];
