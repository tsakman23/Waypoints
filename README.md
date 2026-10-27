# Waypoints

A planner for everything you want to do. Add your interests and projects, connect what depends on what, and Waypoints plans your week: one interest per session, rotating so none of them fades, with skills you haven't touched in a while brought back before they're forgotten. Check in each morning and the plan learns from what you actually do, drag today's sessions into the order you'll do them, and watch a ship fly your route through a solar system of your interests.

Live at **https://waypoints-teal.vercel.app**.

| | |
|---|---|
| **Framework** | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| **Styling** | Tailwind CSS v4, shadcn/ui (Radix), the "Night Sky" theme in `app/globals.css` |
| **Data and sign-in** | Supabase: Postgres with row-level security, email and Google sign-in, cookie sessions via `@supabase/ssr` |
| **3D** | three.js with react-three-fiber, drei and postprocessing; GLSL shaders for the suns and planets |
| **Other** | dnd-kit (drag and drop), cmdk (searchable timezone list), Lucide icons |
| **Hosting** | Vercel |
| **Email** | Brevo SMTP, through Supabase |

---

## Running it locally

**You need** Node.js 20.9 or later (24 recommended) and npm.

```bash
npm install
cp .env.example .env.local   # then fill in the two Supabase values (see below)
npm run dev                  # http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm run dev` | Development server with live reload on port 3000 |
| `npm test` | Unit tests for everything in `lib/` (Node's built-in test runner; no extra framework) |
| `npm run build` | Production build, as Vercel runs it |
| `npm start` | Serve a production build locally |

Port 3000 matters: Supabase only accepts sign-in redirects to the URLs you allow (see [Sign-in redirects](#3-sign-in-redirects)), and `http://localhost:3000` is the one set up for development.

### Windows notes

- **`npm` "cannot be loaded because running scripts is disabled"**: PowerShell blocks npm's script wrapper by default. Either run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, use `npm.cmd` instead of `npm`, or use Command Prompt or Git Bash.
- **`npm` or `node` "not recognised" right after installing Node**: programs keep the PATH they started with. Restart your editor or terminal.
- **Don't run `npm run build` while `npm run dev` is running.** It can leave the dev server serving stale code (500 errors or hydration mismatches). Stop the dev server, build, then start it again.

---

## Setting up Supabase from scratch

### 1. The project and the database

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. In **SQL Editor**, run the whole of [`supabase/schema.sql`](supabase/schema.sql). It creates every table with its row-level security policies. If the editor warns about RLS, either choice is fine: the script enables RLS on every table itself.
3. In **Table Editor** you should see `categories`, `items`, `dependencies`, `work_logs` and `profiles`, each marked RLS-enabled.

### 2. Connecting the app

From **Project Settings → API** (or the **Connect** button), copy the project URL and the publishable (anon) key into `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR-PUBLISHABLE-KEY
```

The publishable key is safe in the browser: row-level security is what protects the data. `.env.local` is git-ignored.

### 3. Sign-in redirects

**Authentication → URL Configuration**:

- **Site URL**: your production URL, e.g. `https://waypoints-teal.vercel.app`.
- **Redirect URLs**: add `http://localhost:3000/**` and `https://YOUR-PRODUCTION-DOMAIN/**`.

The app tells Supabase to send people back to whichever site they signed up on (`/auth/confirm` for email, `/auth/callback` for Google). Supabase only does that for URLs on this list, and otherwise falls back to the Site URL.

### 4. Email confirmation, through Brevo

Supabase's built-in email sender only allows a few emails an hour and doesn't let you edit the templates. Waypoints uses Brevo's free SMTP instead.

**In Brevo** ([brevo.com](https://www.brevo.com)):

1. **Settings → Senders, Domains & Dedicated IPs → Senders → Add a sender**, and verify the address.
2. **SMTP & API → SMTP → Generate a new SMTP key.** Note the **SMTP server** (`smtp-relay.brevo.com`), **port** (`587`), **login** (looks like `xxxx@smtp-brevo.com`, not your account email) and the **key** (shown once).

**In Supabase**:

1. **Authentication → Emails → SMTP Settings → Enable custom SMTP**: sender email (the verified one), sender name `Waypoints`, host `smtp-relay.brevo.com`, port `587`, username the Brevo login, password the SMTP key.
2. **Authentication → Sign In / Providers → Email**: leave **Confirm email** on.
3. **Authentication → Emails → Confirm signup**: replace the body with

   ```html
   <h2>Confirm your Waypoints account</h2>
   <p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Confirm your email</a></p>
   ```

   `{{ .RedirectTo }}` is the `/auth/confirm` address the app passes at sign-up, so the same template works locally and in production. The link carries a one-time token that [`app/auth/confirm/route.ts`](app/auth/confirm/route.ts) verifies, so it works on any device.

Without a domain of your own, the first emails may land in spam.

### 5. Google sign-in

**In [Google Cloud Console](https://console.cloud.google.com)**:

1. Create a project.
2. **Google Auth Platform → Branding**: app name `Waypoints`, your support email, **Audience: External**. While the app is in **Testing**, only accounts listed under **Audience → Test users** can sign in.
3. **Clients → Create client**, type **Web application**:
   - **Authorized JavaScript origins**: `http://localhost:3000` and your production URL.
   - **Authorized redirect URIs**: the **Callback URL** shown in Supabase's Google provider settings (`https://YOUR-PROJECT.supabase.co/auth/v1/callback`).
4. Copy the **Client ID** and **Client secret**.

**In Supabase**: **Authentication → Sign In / Providers → Google**: enable it and paste the ID and secret.

Google refuses to sign in inside embedded browsers (some in-app or IDE browser panes show "Sorry, something went wrong there"). Use a normal browser.

### Updating an existing database

`schema.sql` is always the complete, current schema for **new** projects. A database created from an earlier version is brought up to date by running the files in [`supabase/migrations/`](supabase/migrations/), oldest first, in the SQL Editor:

| Migration | Adds |
|---|---|
| `20261009_route_planning.sql` | skill type and interval on categories, the `work_logs` table, the `profiles` table |
| `20261011_today_order.sql` | today's saved session order on profiles |
| `20261027_learning.sql` | automatic (null) resurfacing intervals on categories, the `plan_snapshots` table |
| `20261028_admin.sql` | the `evaluations` and `admins` tables, and the `is_admin` and `admin_overview` functions |
| `20261029_stats_excluded.sql` | the `stats_excluded` table; `admin_overview` marks excluded users |

Run a migration **before** deploying code that needs it: the app asks for the new columns by name, and a missing column is an error.

### Admins

`/admin` shows pooled planner accuracy and activity across all users, anonymised, and is only visible to admins. Add one in the SQL Editor:

```sql
insert into admins (user_id) select id from auth.users where email = 'you@example.com';
```

The admin page only ever sees score totals and activity dates through `admin_overview()`, never titles, notes or emails.

Leave demo or test accounts out of the statistics, so made-up history can't distort the pooled evaluation:

```sql
insert into stats_excluded (user_id) select id from auth.users where email = 'demo@example.com';
```

---

## Deploying to Vercel

1. Import the GitHub repository in Vercel. It detects Next.js; no build settings to change.
2. **Settings → Environment Variables**: add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. If you connect Supabase through Vercel's integration, check the key's name: the integration may call it `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the app reads `…_PUBLISHABLE_KEY`.
3. Add the production URL to Supabase's **Site URL** and **Redirect URLs**, and to Google's **Authorized JavaScript origins**.

Every push to `main` deploys.

---

## How it works

### The pieces

```
app/
  page.tsx                 the landing page (signed-out visitors)
  login/                   sign-in and sign-up
  auth/                    server actions, email confirmation and Google callback routes
  actions.ts               every server action that changes data
  (app)/                   signed-in pages, sharing the floating header in layout.tsx
    list/  next/  system/  settings/  how-it-works/
components/                React components; ui/ holds the shadcn/ui primitives
lib/                       pure logic, all unit-tested, plus the data loaders
supabase/                  schema.sql and migrations/
proxy.ts                   runs before every request: refreshes the session, guards pages
```

- **Server and client.** Pages are server components: they load data on the server (`lib/data.ts`) and send finished HTML. Interactive parts (forms, drag and drop, the 3D scene) are client components marked `"use client"`. Every change goes through a server action in `app/actions.ts`, which checks its input; row-level security then guarantees users only ever touch their own rows.
- **Sessions.** `@supabase/ssr` keeps the login in cookies. `proxy.ts` (Next 16's name for middleware) refreshes an expiring token before each request and redirects signed-out visitors to `/login`.
- **Dates.** "Today" and "yesterday" are always worked out in the user's own timezone (`lib/profile.ts`), never the server's.

### The planner (`lib/planner.ts`)

Plans the next 7 days within the time you set, one interest per session, from **active** items whose prerequisites are done. Each session goes to the item with the best adjusted score:

```
adjusted = value for effort × follow-through × skill clock × repeat penalty × variety penalty
```

- **Value for effort** (`lib/scoring.ts`): (interest + impact + a boost for what the item unlocks, halved per step away) ÷ effort.
- **Follow-through** (`lib/learning.ts`): learned from the daily check-ins. Each morning's plan is saved, and the next check-in shows what was actually done. Each item's chance of being done is a Beta-Binomial estimate shrunk towards its category's rate, and each category's towards your overall rate (4 pretend days each), so a few days of history barely move it. The factor is that chance relative to your overall rate, capped to 0.5–1.5, and exactly 1 with no history.
- **Skill clock**: each category has a skill type with a resurfacing interval (Fitness 7 days, Language 21, Technical 28, Instrument 42, Creative 28, Other 28; `lib/skills.ts`). Left automatic, the interval moves towards how often you really return (the median gap between work days, weighted by how many gaps there are, within half to double the preset); one set by hand is used as is. An interest left untouched gets pulled forward: ×1 while fresh, ×1.5 when due, up to ×2.
- **Repeat penalty**: ×0.7 / 0.85 / 0.95 for the same interest one, two or three sessions back, so a session never switches interests midway but the plan rotates.
- **Variety penalty**: ×0.8 for every earlier session of the same interest that week, so two strong interests can't take turns all week.
- **Alternatives**: each day offers the best options from interests it doesn't already include, and there are two alternative routes that start differently.

Today's sessions on Next up say why in a few words when the learning is behind them ("You often skip this", "Due · back to Fitness about every 10 days"; `lib/reasons.ts`).

The interval defaults come from research on spacing, skill decay and motivation; see the "Waypoints Route Research" write-up. Every tunable number lives in the `PLAN` object at the top of `lib/planner.ts`, and the learning's in `LEARN` in `lib/learning.ts`.

### Does the learning work? (`lib/backtest.ts`)

A walk-forward backtest replays your answered days in order, predicting each one only from the days before it, and compares the model's predictions with a baseline that guesses your overall rate, using the Brier score. Settings shows your own result after 14 answered days. Each check-in saves your totals (sums only), and `/admin` pools everyone's, so each prediction counts once.

### The solar system (`components/solar-system.tsx`, `lib/solar.ts`)

Each interest is a sun and its items are planets on elliptical orbits that follow Kepler's laws: faster near the sun, longer years further out. Available planets orbit closest, then locked ones (greyed, with what unlocks them on hover), parked and done. Today's sessions form a glowing route that the ship flies once, then it parks at the first stop. Surfaces are procedural GLSL shaders (`components/solar-shaders.ts`): no image files. Motion stops with the "Animate the solar system" setting or the system's reduced-motion preference.

### Tests

`npm test` runs the unit tests in `lib/`: dependency cycles, availability and scoring, list sorting and filtering, timezones and session budgets, the planner (rotation, skill clocks, variety, alternatives, saved order), the learning (cold start, shrinkage, caps, hand-set intervals, determinism), the backtest (no peeking at the future, no false gains) and pooling, plan reasons, and the orbital maths (Kepler's laws, layout, determinism).
