# Listify

**Photo in, listing out.** A mobile app that turns a photo of an item into a ready-to-post marketplace listing: title, description, tags and an estimated price range, written for eBay, Vinted, Etsy or Facebook Marketplace.

**Status:** personal project. It works end to end on real phones (Expo Go, plus an Android test build). It is not published in the app stores and has no payments yet.

<!-- Add a demo video link or GIF here, and screenshots below. -->
<!-- Demo: https://... -->

## What it does

1. Sign in (email and password, with email confirmation and password reset by code).
2. Take or choose a photo of an item and pick the platform you sell on.
3. Get a title, description, tags, a price estimate and a "check before posting" note listing what the photo cannot show (size, flaws, model).
4. Copy the pieces or the full listing and paste them into the marketplace.

Each user has a small daily free limit, enforced on the server. Users can sign out or delete their account from inside the app.

## How it works

```
Phone app (Expo / React Native)
   |  signed-in user's token
   v
Supabase Edge Function: generate-listing
   |-- verifies the user
   |-- consumes one credit in Postgres (atomic, server-side only)
   |-- calls the Gemini vision API with the photo
   |-- validates and cleans the AI's JSON
   v
Listing returned to the app (credit refunded if the AI call fails)
```

## Tech

- **App:** Expo (SDK 57), React Native, `expo-image-picker`, `expo-image-manipulator`, `expo-clipboard`
- **Backend:** Supabase Auth, Postgres with Row Level Security, Edge Functions (Deno, TypeScript)
- **AI:** Google Gemini API (vision), with retry and fallback between models

## Design decisions

- **The AI key never reaches the phone.** It is stored as a Supabase secret and only the Edge Function uses it. Anything inside an app bundle can be extracted, so the app only holds the public anon key.
- **The public anon key alone is not enough.** The function requires a signed-in user, so a leaked anon key cannot be used to spend AI credit.
- **Usage limits live in the database, not the app.** `usage_daily` has Row Level Security on, users can only read their own row, and there are no insert/update/delete policies. The `consume_quota` and `refund_quota` functions are executable only by the server role, so a user cannot reset their own limit.
- **Atomic quota.** One `UPDATE ... WHERE count < limit` statement means two simultaneous requests cannot both slip past the limit.
- **Input is validated.** Image size cap, allow-listed image types and platforms, and the AI's output is normalized (text lengths, tag count, numeric prices) before it reaches the app.
- **Failures are handled.** Per-request timeouts, retries when the AI service is busy, a fallback model, friendly error messages in the app, and a guard against showing a stale result after the photo changes.
- **Model names are configuration, not code.** They are a Supabase secret (`GEMINI_MODELS`), because providers retire model names.
- **Account deletion** is a server function that removes the user and, through `ON DELETE CASCADE`, their usage data.

## Run it yourself

You need Node.js 20+, a Supabase project, a Gemini API key, and the Expo Go app (or an EAS build).

**1. Backend**

1. In the Supabase SQL Editor, run `backend/supabase/migrations/20261009000000_usage_quota.sql`.
2. In a terminal:
   ```
   cd backend
   npx supabase login
   npx supabase link --project-ref YOUR-PROJECT-REF
   npx supabase secrets set GEMINI_API_KEY=your-key
   npx supabase functions deploy generate-listing
   npx supabase functions deploy delete-account
   ```
3. Optional secrets: `FREE_DAILY_LIMIT` (default 3) and `GEMINI_MODELS` (comma-separated model names).
4. In Supabase Authentication settings, keep "Confirm email" on and set a minimum password length of 8 or more.

**2. App**

```
npm install
cp .env.example .env     # add your Supabase URL and anon key
npx expo start -c
```

Only ever put the **anon** key in `.env`. Never use a `service_role` or `sb_secret` key in the app.

**3. Tests**

```
node --experimental-strip-types --test backend/supabase/functions/generate-listing/validate.test.ts
```

## Known limitations and next steps

- The free Gemini tier is rate limited and its terms are not suited to real users. A paid tier is needed before a public launch.
- Supabase's built-in email sender is heavily limited. Custom SMTP is needed for real sign-ups.
- Price ranges are AI estimates, not market data, and the app says so.
- Not built yet: subscriptions and payments, listing history, crash reporting, automated tests for the app screens, app store release.

## About this project

I built Listify to learn the full path from idea to a working, secured app: mobile front end, auth, database security, serverless functions, AI integration and a security review. I built it with AI assistance and worked through each part myself, including debugging real failures such as a retired AI model name and email delivery problems.

## License

MIT
