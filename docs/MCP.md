# LinguaScript in ChatGPT and Claude (MCP)

LinguaScript has an MCP server, so a learner can connect their account to
ChatGPT or Claude and the AI can teach with *their* flashcards.

**Server URL:** `https://ffephracinqeylfhqkiz.supabase.co/functions/v1/mcp`

Sign-in is the learner's normal LinguaScript account (OAuth; the consent
screen is `/.lovable/oauth/consent` on the website).

## Connect

**Claude** (claude.ai or the app): Settings → Connectors → *Add custom
connector* → name `LinguaScript`, paste the URL → Connect → sign in.

**ChatGPT**: Settings → Apps & Connectors → *Advanced* → turn on Developer
mode → *Create* → name `LinguaScript`, paste the URL, authentication OAuth →
sign in. (Menu names move around; look for "custom connector" / "MCP".)

Then try: *"Teach me 5 of the most common French words I don't know yet,
then quiz me on my due LinguaScript reviews."*

## Tools

| Tool | What it does |
|---|---|
| `get_progress` | Learning + native language, XP, streak, deck sizes |
| `get_frequent_words` | Next most-frequent words (core_vocabulary rank) not saved yet |
| `get_due_reviews` | Gold (due) words first, then red/orange — what to quiz |
| `record_review` | Right/wrong answer → same ladder as flashcards (packages/core/src/review.ts) |
| `save_word` | Add a word/phrase to the red deck |
| `list_saved_words` | The whole deck, filterable |
| `list_films` | Videos in the catalog |

## Editing

Source: `src/lib/mcp/` (one file per tool). `npx vite build` regenerates
`supabase/functions/mcp/index.ts` — don't edit that file by hand. Deploy the
`mcp` edge function after changing tools.

## Name and logo in ChatGPT / Claude

- **Name:** `title` and `auth.resourceName` in `src/lib/mcp/index.ts` are both
  `LinguaScript`; that's what the apps show instead of the supabase.co address.
- **Logo:** custom connectors show the favicon of the server URL's domain. Ours
  is `*.supabase.co`, so they show the Supabase logo. The MCP library has no
  "icon" setting. Two ways to get the chameleon:
  1. **Get listed** (below): both directories take an uploaded logo
     (`public/logo.svg`, PNG export if they ask).
  2. **Supabase custom domain** (paid add-on, Supabase dashboard → Settings →
     Custom Domains), e.g. `api.linguascript.co.uk` → the server URL becomes
     `https://api.linguascript.co.uk/functions/v1/mcp`. Then update `MCP_URL` in
     `src/pages/ConnectAI.tsx` and the URL at the top of this file. Existing
     connections must reconnect with the new link.

## Getting listed (so users skip the "custom connector" screen)

Custom connectors show Claude's / ChatGPT's technical sign-in settings; we
can't change that screen. Listed apps just show **Connect** → LinguaScript
sign-in. To apply:

- **Claude Connectors Directory:** claude.ai → your organization's admin
  settings → connector submission portal (remote MCP servers only). Docs:
  https://claude.com/docs/connectors/building/submission
- **ChatGPT app directory:** test in Developer mode, then submit from the
  OpenAI Platform dashboard (project must NOT use EU data residency). Docs:
  https://developers.openai.com/apps-sdk/deploy/submission

Checklist:
- [x] Public HTTPS server URL (above)
- [x] Every tool has a title + readOnlyHint / destructiveHint
- [x] OAuth sign-in with the learner's LinguaScript account
- [x] Privacy policy: https://linguascript.co.uk/privacy (add a line about the AI connector)
- [ ] A test LinguaScript account with some saved words, for the reviewers
- [ ] Support email, short description, logo (public/logo.svg) and 3 example prompts (see /ai)
