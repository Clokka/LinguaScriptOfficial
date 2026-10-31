// Expo config plugin: adds LinguaScript to Android's "select text" menu.
//
// Highlight text in any app → "Save to LinguaScript" (sometimes under ⋮) → a small card with the
// translation and a Save button (plugins/process-text/ProcessTextActivity.kt).
// Uses Android's PROCESS_TEXT intent, which needs no permission at all.
const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod, AndroidConfig } = require('expo/config-plugins');

const ACTIVITY = '.ProcessTextActivity';

function withManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app.activity = (app.activity || []).filter((a) => a.$['android:name'] !== ACTIVITY);
    app.activity.push({
      $: {
        'android:name': ACTIVITY,
        // What shows in the copy / paste menu.
        'android:label': 'Save to LinguaScript',
        'android:exported': 'true',
        'android:theme': '@android:style/Theme.Translucent.NoTitleBar',
        'android:excludeFromRecents': 'true',
        'android:taskAffinity': '',
        'android:noHistory': 'true',
        'android:windowSoftInputMode': 'adjustResize',
      },
      'intent-filter': [
        {
          action: [{ $: { 'android:name': 'android.intent.action.PROCESS_TEXT' } }],
          category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
          data: [{ $: { 'android:mimeType': 'text/plain' } }],
        },
      ],
    });
    return cfg;
  });
}

function withKotlinSource(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const pkg = cfg.android?.package;
      if (!pkg) throw new Error('withProcessText: android.package is required');
      const src = fs.readFileSync(path.join(__dirname, 'process-text', 'ProcessTextActivity.kt'), 'utf8').replace('__PACKAGE__', pkg);
      const dir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'java', ...pkg.split('.'));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'ProcessTextActivity.kt'), src);
      return cfg;
    },
  ]);
}

module.exports = function withProcessText(config) {
  return withKotlinSource(withManifest(config));
};
