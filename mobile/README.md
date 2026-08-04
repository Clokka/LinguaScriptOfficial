# LinguaScript Mobile (Expo React Native)

Expo (SDK 51) React Native app that reuses `packages/core` for shared Supabase +
SRS logic.

## Local dev

```sh
cd mobile
cp .env.example .env       # fill in EXPO_PUBLIC_* values
npm install                 # or bun install / yarn install
npx expo start              # opens Expo dev tools
```

To run on an Android emulator: press `a` in the Expo dev CLI.
To run on a physical device: install Expo Go and scan the QR code
(for release features like Google Sign-In / push you'll need a dev build).

## Native features enabled

- Push notifications (Expo Notifications) — token stored in `device_tokens`
- Local daily reminders (works offline) — scheduled from Settings
- Haptics on all key interactions
- Native share sheet (words, friend invites)
- Deep links: `linguascript://` scheme + `https://linguascript.xyz/*` universal links
- Android intent filter: share-to-LinguaScript (SEND text → saves to vocab)
- Native Google Sign-In via `@react-native-google-signin/google-signin`

## Building for Play Store

```sh
# Install EAS CLI once
npm install -g eas-cli
eas login
eas init                    # writes projectId to app.json

# Preview APK for internal testing
npm run build:android:preview

# Production .aab for Play Store submission
npm run build:android:production

# Submit to Play internal track (requires play-service-account.json)
npm run submit:android
```

## Google Sign-In setup (required before Google button works)

1. In Google Cloud Console, create OAuth 2.0 credentials for **Web application** and **Android**.
2. Copy the web client ID into `mobile/.env` as `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
3. In Supabase Dashboard → Authentication → Providers → Google, paste the same
   web client ID + secret.
4. Add the Android SHA-1 (from EAS Build) to the Google Android OAuth client.

## Supabase migration

Before push works, apply the migration:

```sh
supabase db push
# or apply supabase/migrations/20260804230000_mobile_notifications.sql manually
```

Then deploy the edge function:

```sh
supabase functions deploy send-push-notification
```
