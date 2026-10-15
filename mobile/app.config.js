// Extends app.json. Android push notifications go Expo -> Firebase Cloud
// Messaging, so the build needs the Firebase google-services.json.
// Put the file next to this one and commit it (it is not a secret), or set the
// GOOGLE_SERVICES_JSON file env var on EAS.
const fs = require('fs');
const path = require('path');

// The Android build fails ("No matching client found for package name") if
// google-services.json has no app for our exact package name (capitals count),
// so only use the file when it matches.
function hasAndroidApp(file, packageName) {
  try {
    const json = JSON.parse(fs.readFileSync(path.resolve(__dirname, file), 'utf8'));
    return (json.client ?? []).some(
      (c) => c.client_info?.android_client_info?.package_name === packageName,
    );
  } catch {
    return false;
  }
}

module.exports = ({ config }) => {
  const packageName = config.android?.package;
  const localFile = path.join(__dirname, 'google-services.json');
  let googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON ??
    (fs.existsSync(localFile) ? './google-services.json' : undefined);

  if (googleServicesFile && !hasAndroidApp(googleServicesFile, packageName)) {
    console.warn(
      `[app.config] google-services.json has no Android app for ${packageName} — skipping it. Server push notifications will not work on Android until you add that package in Firebase. See PUSH_NOTIFICATIONS.md.`,
    );
    googleServicesFile = undefined;
  } else if (!googleServicesFile) {
    console.warn(
      '[app.config] No google-services.json — server push notifications will not work on Android. See PUSH_NOTIFICATIONS.md.',
    );
  }

  return {
    ...config,
    android: {
      ...config.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
  };
};
