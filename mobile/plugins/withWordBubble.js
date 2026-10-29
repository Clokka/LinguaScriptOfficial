// Expo config plugin: the 🦎 bubble that colours your words over any Android app.
//
// Adds BubbleService (floating bubble + overlay), BubbleStartActivity (on/off
// links + the screen-capture consent), ML Kit text recognition (runs on the
// phone, via Google Play services so the app stays small), and the Kotlin
// sources in plugins/word-bubble/. Needs plugins/withProcessText.js too (the
// word card).
const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withAppBuildGradle, withDangerousMod, AndroidConfig } = require('expo/config-plugins');

const SOURCES = ['DeckStore.kt', 'WordFinder.kt', 'WordOverlayView.kt', 'BubbleService.kt', 'BubbleStartActivity.kt'];

const PERMISSIONS = [
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION',
  'android.permission.POST_NOTIFICATIONS',
];

// On-device text recognition through Google Play services (tiny download).
const DEPENDENCIES = [
  "implementation 'com.google.android.gms:play-services-mlkit-text-recognition:19.0.1'",
  "implementation 'com.google.android.gms:play-services-mlkit-text-recognition-japanese:16.0.1'",
  "implementation 'com.google.android.gms:play-services-mlkit-text-recognition-chinese:16.0.1'",
  "implementation 'com.google.android.gms:play-services-mlkit-text-recognition-korean:16.0.1'",
  "implementation 'com.google.android.gms:play-services-mlkit-text-recognition-devanagari:16.0.1'",
];

function withManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest['uses-permission'] = manifest['uses-permission'] || [];
    for (const p of PERMISSIONS) {
      if (!manifest['uses-permission'].some((x) => x.$['android:name'] === p)) {
        manifest['uses-permission'].push({ $: { 'android:name': p } });
      }
    }
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);

    app.service = (app.service || []).filter((s) => s.$['android:name'] !== '.BubbleService');
    app.service.push({
      $: {
        'android:name': '.BubbleService',
        'android:exported': 'false',
        'android:foregroundServiceType': 'specialUse|mediaProjection',
      },
      property: [{
        $: {
          'android:name': 'android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE',
          'android:value': 'Floating language-learning bubble: on tap, colours the learner\'s vocabulary words on the current screen',
        },
      }],
    });

    app.activity = (app.activity || []).filter((a) => a.$['android:name'] !== '.BubbleStartActivity');
    app.activity.push({
      $: {
        'android:name': '.BubbleStartActivity',
        'android:exported': 'true',
        'android:theme': '@android:style/Theme.Translucent.NoTitleBar',
        'android:excludeFromRecents': 'true',
        'android:taskAffinity': '',
        'android:launchMode': 'singleTask',
      },
      'intent-filter': [{
        action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
        category: [
          { $: { 'android:name': 'android.intent.category.DEFAULT' } },
          { $: { 'android:name': 'android.intent.category.BROWSABLE' } },
        ],
        data: [{ $: { 'android:scheme': 'linguascriptbubble' } }],
      }],
    });
    return cfg;
  });
}

function withDependencies(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    const missing = DEPENDENCIES.filter((d) => !gradle.includes(d));
    if (missing.length) {
      gradle = gradle.replace(/dependencies\s*\{/, (m) => `${m}\n    // LinguaScript bubble (plugins/withWordBubble.js)\n    ${missing.join('\n    ')}`);
      cfg.modResults.contents = gradle;
    }
    return cfg;
  });
}

function withKotlinSources(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const pkg = cfg.android?.package;
      if (!pkg) throw new Error('withWordBubble: android.package is required');
      const dir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'java', ...pkg.split('.'));
      fs.mkdirSync(dir, { recursive: true });
      for (const f of SOURCES) {
        const src = fs.readFileSync(path.join(__dirname, 'word-bubble', f), 'utf8').replace('__PACKAGE__', pkg);
        fs.writeFileSync(path.join(dir, f), src);
      }
      return cfg;
    },
  ]);
}

module.exports = function withWordBubble(config) {
  return withKotlinSources(withDependencies(withManifest(config)));
};
