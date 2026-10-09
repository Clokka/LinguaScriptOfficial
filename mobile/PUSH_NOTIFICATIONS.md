# Push notifications: getting them ready

## How it works

```
Supabase (every 15 min)  ──►  Expo push service  ──►  Firebase (FCM)  ──►  your phone 📱
dispatch-push-notifications     exp.host                 Android only
```

Most of this is already built:

- ✅ The app asks for permission and saves the phone's push token in the `device_tokens` table
- ✅ Settings for which notifications people want (`notification_preferences`)
- ✅ `send-push-notification` sends a push to one user
- ✅ `dispatch-push-notifications` runs every 15 minutes and sends streak 🔥, flashcard 🃏 and friend 👋 notifications
- ✅ Tapping a notification opens the right page

You don't need to write any Firebase code in Supabase (Gemini suggested that).
Expo talks to Firebase for us. Firebase just needs two files.

---

## Step 1: Get `google-services.json` from Firebase (5 min)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → open **linguascript-497af**
2. Click the **⚙️ gear** → **Project settings**
3. Under **Your apps**, click **Add app** → the **Android** icon
4. Android package name: **`xyz.linguascript.app`** (it has to match exactly!)
5. Click **Register app** → **Download google-services.json**
6. Put the file in the `mobile/` folder, next to `app.json`
7. Commit it. This file is safe to put on GitHub because it's not a secret.

## Step 2: Give Expo the Firebase key (5 min)

⚠️ **This file IS a secret. Never commit it or send it to anyone.**

1. Firebase → ⚙️ **Project settings** → **Service accounts** tab
2. Click **Generate new private key** → **Generate key**. A `.json` file downloads.
3. Go to [expo.dev](https://expo.dev) → your project **linguascript-chameleon**
   → **Credentials** → **Android** → `xyz.linguascript.app`
4. Find **FCM V1 service account key** → **Add a service account key** → upload the file
5. Delete the downloaded file from your Downloads folder afterwards 🧹

(Or from a terminal: `cd mobile && eas credentials`, then Android → production →
Google Service Account → *Push Notifications (FCM V1)*.)

## Step 3: Make sure Supabase is set up

In Supabase → **SQL Editor**, check that these tables exist: `device_tokens`,
`notification_preferences`. If they don't, run these migration files:

- `supabase/migrations/20260804230000_mobile_notifications.sql`
- `supabase/migrations/20260811000000_push_dispatch_tracking.sql`

Then deploy the two functions (from the repo root):

```sh
supabase functions deploy send-push-notification
supabase functions deploy dispatch-push-notifications
```

(Lovable may deploy these for you automatically.)

## Step 4: Build and test 🎉

1. `cd mobile && npm run build:android:preview`, then install the APK on your phone
2. Open the app, log in, and tap **Allow** when it asks about notifications
3. Supabase → **Table Editor** → `device_tokens`. You should see a new row! Copy the `expo_push_token` (it starts with `ExponentPushToken[...]`)
4. Go to [expo.dev/notifications](https://expo.dev/notifications), paste the token, type a title and message, and click **Send**
5. Your phone buzzes = it works! 🦎

### If it doesn't work

| Problem | Fix |
|---|---|
| No row in `device_tokens` | You tapped "Don't allow". Phone Settings → Apps → LinguaScript → Notifications → turn on. Reopen the app. |
| Expo says `InvalidCredentials` | Step 2 wasn't finished. Upload the FCM V1 key. |
| Build log says "No google-services.json" | Step 1 wasn't finished, or the file isn't committed. |
| Testing in Expo Go | Server pushes don't work in Expo Go. Use the APK from Step 4. |

## Before submitting to Google Play

- The Play Console will ask about **`SCHEDULE_EXACT_ALARM`** (it's listed in `app.json`).
  Daily reminders don't need exact alarms, so if Google complains you can remove that line.
- iPhone (later): EAS sets up Apple push automatically when you run
  `eas build --platform ios`. It needs a paid Apple Developer account.
