// Extends app.json. Android push notifications go Expo -> Firebase Cloud
// Messaging, so the build needs the Firebase google-services.json.
// Put the file next to this one and commit it (it is not a secret), or set the
// GOOGLE_SERVICES_JSON file env var on EAS.
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const localFile = path.join(__dirname, 'google-services.json');
  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON ??
    (fs.existsSync(localFile) ? './google-services.json' : undefined);

  if (!googleServicesFile) {
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
