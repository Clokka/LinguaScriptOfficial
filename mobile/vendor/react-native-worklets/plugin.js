// Stub babel plugin. Returns no visitors. See package.json for context.
// react-native-reanimated/plugin (already in babel.config.js) does the real
// work for Reanimated 3 on RN 0.74.
module.exports = function () {
  return { name: 'react-native-worklets-stub-plugin', visitor: {} };
};
