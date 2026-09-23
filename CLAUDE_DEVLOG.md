# Keeping the site up to date

The site reads everything from `content.js`. After any work session, the log gets one new post. Nothing else changes unless a project's status really changed.

## Put this in the CLAUDE.md of every project repo (TET, Unfog, Kpee)

```
## Devlog
The public site repo is at ~/site (github.com/Nexus-Network-Foundation/site).
At the end of every session where something shipped, was fixed, or was found:
1. Append ONE entry to the END of window.POSTS in ~/site/content.js:
   { date: "YYYY-MM-DD", project: "tet" | "unfog" | "kpee", title: "...", body: "..." }
2. If a project's "Where it is now" / "What's live" list, or window.NOW, is now wrong, fix it in the same file.
3. If there's a screenshot worth showing, save it to ~/site/images/<project>-<topic>.jpg
   (max 1100px wide) and put ![caption](images/<name>.jpg) in the body.
4. cd ~/site && git add -A && git commit -m "log: <title>" && git push
Writing rules for the entry:
- First person, plain, short sentences. Write what happened, with the real numbers.
- Say what didn't work too. If an earlier post was wrong, say so in the new one.
- No hype words, no "excited to announce", no emojis, no hashtags.
- Never write secrets: no keys, tokens, passwords, private IPs, personal addresses, school name.
- Don't claim anything the code doesn't do yet.
```

## Things that update themselves

- **feed.xml (RSS)** and the **share card tags** are rebuilt by the GitHub Action every time `content.js` changes. Don't edit them by hand.
- **stats.json** is rebuilt once a day. Turn each number on by adding a repository variable (Settings → Secrets and variables → Actions → Variables). Anything not set is simply not shown.
  - `TET_SEED` = `95.217.158.153:8002` → "TET seed online/offline"
  - `TET_STATE_URL` = a public URL returning `/ledger/state` → block height (only if you choose to expose one)
  - `UNFOG_STATS_URL` = a URL returning `{"users": 123}` → Unfog users
  - `KPEE_REPO` = `Ai0090/kpee` → Kpee downloads (counts files attached to GitHub Releases)
- **The Now box** (top of the home page) is `window.NOW` in `content.js`. Update it when it stops being true; ask Claude Code to do it as part of the log step.

## From a chat with Claude

Say **"ログ書いて"** at the end. You get back one entry to paste at the bottom of `POSTS`.

## Pictures that are already referenced but not uploaded yet

These lines are in the text already. Drop a file with the same name into `images/` and it appears. Until then it's simply hidden.

| file | what to take |
|---|---|
| `tet-desktop.jpg` | the Win95-style desktop with a wallet open |
| `tet-nodes.jpg` | two terminals, same height and state_root |
| `tet-tmail.jpg` | a message arriving in the other wallet |
| `unfog-map.jpg` | the map with some fog cleared |
| `unfog-post.jpg` | posting a photo at a place |
| `unfog-profile.jpg` | a profile map |
| `unfog-group.jpg` | a group map |
| `unfog-first-post.jpg` | the first real post on the map (July 25) |

Screenshots of code: paste the real code into a post between three backticks instead of a picture. It shows as a code box, stays sharp, and people can copy it.

## Turning on "Write to me"

1. Make a new Supabase project for the site (keep it separate from Unfog's database).
2. SQL Editor → paste `supabase/mail.sql` → Run.
3. Authentication → Users → Add user: your email and a long password.
4. Authentication → Sign In / Providers → switch OFF "Allow new users to sign up".
5. SQL Editor: `insert into public.site_admins (user_id) select id from auth.users where email = 'YOUR_EMAIL';`
6. Project Settings → API → copy the Project URL and the anon key into `config.js`. Push.
7. Your inbox is at `/#/inbox`. It isn't linked anywhere until you're signed in.

Visitors get a private link to their conversation and see your replies there. If they left an email, the inbox also has a button to answer by email. The site does not send email by itself.

## Publishing

GitHub repo `site` (Ai0090), Settings → Pages → main / root. The `CNAME` file holds the domain (now `stevenexus.org`; change it if you buy a different one, and change `url` at the top of `content.js` to match).
