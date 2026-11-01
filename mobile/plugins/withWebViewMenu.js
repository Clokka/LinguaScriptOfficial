// Expo config plugin: "Save to LinguaScript" in the app's OWN text menu.
//
// Select text inside the app → Copy · Paste · Web search · Translate ·
// Save to LinguaScript. react-native-webview's `menuItems` prop REPLACES the
// whole Android menu with only the custom items (no Copy, no Translate), so
// at build time this rewrites RNCWebView.startActionMode to ADD our items to
// the normal menu and pass everything else to Android as usual. It also drops
// our own PROCESS_TEXT entry from this menu (otherwise "Save to LinguaScript"
// would show twice inside the app). app/index.tsx sets `menuItems` and hands
// the selection to the site (window.__lsSaveText → SelectionSave.tsx).
//
// Fails the build loudly if react-native-webview's code changes shape, so it
// never silently stops working after an upgrade.
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const START = '    @Override\n    public ActionMode startActionMode(ActionMode.Callback callback, int type) {';
const END = '      }, type);\n    }\n';

const REPLACEMENT = `    @Override
    public ActionMode startActionMode(ActionMode.Callback callback, int type) {
      if(menuCustomItems == null ){
        return super.startActionMode(callback, type);
      }
      // LinguaScript (plugins/withWebViewMenu.js): keep Android's own menu and
      // add our items to it, instead of replacing it.
      final int CUSTOM_BASE = 0x4C530000;
      final ActionMode.Callback original = callback;
      return super.startActionMode(new ActionMode.Callback2() {
        private void addCustom(Menu menu) {
          for (int i = menu.size() - 1; i >= 0; i--) {
            MenuItem existing = menu.getItem(i);
            android.content.Intent intent = existing.getIntent();
            if (existing.getItemId() >= CUSTOM_BASE && existing.getItemId() < CUSTOM_BASE + 100) continue;
            if (intent != null && android.content.Intent.ACTION_PROCESS_TEXT.equals(intent.getAction())
                && intent.getComponent() != null
                && getContext().getPackageName().equals(intent.getComponent().getPackageName())) {
              menu.removeItem(existing.getItemId());
            }
          }
          for (int i = 0; i < menuCustomItems.size(); i++) {
            if (menu.findItem(CUSTOM_BASE + i) == null) {
              menu.add(Menu.NONE, CUSTOM_BASE + i, 50 + i, (menuCustomItems.get(i)).get("label"));
            }
          }
        }

        @Override
        public boolean onCreateActionMode(ActionMode mode, Menu menu) {
          boolean show = original.onCreateActionMode(mode, menu);
          addCustom(menu);
          return show;
        }

        @Override
        public boolean onPrepareActionMode(ActionMode actionMode, Menu menu) {
          original.onPrepareActionMode(actionMode, menu);
          addCustom(menu);
          return true;
        }

        @Override
        public boolean onActionItemClicked(ActionMode mode, MenuItem item) {
          int index = item.getItemId() - CUSTOM_BASE;
          if (index < 0 || index >= menuCustomItems.size()) {
            return original.onActionItemClicked(mode, item);
          }
          WritableMap wMap = Arguments.createMap();
          RNCWebView.this.evaluateJavascript(
            "(function(){return {selection: window.getSelection().toString()} })()",
            new ValueCallback<String>() {
              @Override
              public void onReceiveValue(String selectionJson) {
                Map<String, String> menuItemMap = menuCustomItems.get(index);
                wMap.putString("label", menuItemMap.get("label"));
                wMap.putString("key", menuItemMap.get("key"));
                String selectionText = "";
                try {
                  selectionText = new JSONObject(selectionJson).getString("selection");
                } catch (JSONException ignored) {}
                wMap.putString("selectedText", selectionText);
                dispatchEvent(RNCWebView.this, new TopCustomMenuSelectionEvent(RNCWebViewWrapper.getReactTagFromWebView(RNCWebView.this), wMap));
                mode.finish();
              }
            }
          );
          return true;
        }

        @Override
        public void onDestroyActionMode(ActionMode mode) {
          original.onDestroyActionMode(mode);
        }

        @Override
        public void onGetContentRect (ActionMode mode,
                View view,
                Rect outRect){
            if (original instanceof ActionMode.Callback2) {
                ((ActionMode.Callback2) original).onGetContentRect(mode, view, outRect);
            } else {
                super.onGetContentRect(mode, view, outRect);
            }
          }
      }, type);
    }
`;

function patch(file) {
  const src = fs.readFileSync(file, 'utf8');
  if (src.includes('plugins/withWebViewMenu.js')) return; // already patched
  const a = src.indexOf(START);
  const b = a < 0 ? -1 : src.indexOf(END, a);
  if (a < 0 || b < 0) {
    throw new Error('withWebViewMenu: RNCWebView.startActionMode not found — react-native-webview changed; update plugins/withWebViewMenu.js');
  }
  fs.writeFileSync(file, src.slice(0, a) + REPLACEMENT + src.slice(b + END.length));
}

module.exports = function withWebViewMenu(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const pkg = path.dirname(require.resolve('react-native-webview/package.json', { paths: [cfg.modRequest.projectRoot] }));
      patch(path.join(pkg, 'android', 'src', 'main', 'java', 'com', 'reactnativecommunity', 'webview', 'RNCWebView.java'));
      return cfg;
    },
  ]);
};

module.exports.patch = patch;
