package __PACKAGE__

// ✨ The GOLD widget: one review word you already know, big and glimmering.
//   ✨ maison        → tap "Show meaning" → maison = house   → "Next ✨"
//   tap the word     → your gold flashcards
// widgetCategory = home_screen|keyguard, so phones that allow lock-screen
// widgets (Android lock-screen widget hub, older Android 4.2–4.4) can place it
// there; every phone can put it on the home screen. Same words as the
// lock-screen card (GoldWords.kt): ONLY gold, never a brand-new red word.
// Layout: res/layout/ls_widget_gold.xml. Refreshed hourly by GoldWordReceiver.

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews

class GoldWidget : AppWidgetProvider() {

  companion object {
    const val ACTION_SHOW = "ls.goldwidget.SHOW"
    const val ACTION_NEXT = "ls.goldwidget.NEXT"
    private fun prefs(c: Context) = c.getSharedPreferences("ls-gold-widget", Context.MODE_PRIVATE)

    fun refreshAll(c: Context) {
      val mgr = AppWidgetManager.getInstance(c)
      val ids = mgr.getAppWidgetIds(ComponentName(c, GoldWidget::class.java))
      if (ids.isNotEmpty()) render(c, mgr, ids)
    }

    /** Android 8+: "Add LinguaScript Gold to your home screen?" */
    fun requestPin(c: Context): Boolean {
      val mgr = AppWidgetManager.getInstance(c)
      if (android.os.Build.VERSION.SDK_INT < 26 || !mgr.isRequestPinAppWidgetSupported) return false
      return mgr.requestPinAppWidget(ComponentName(c, GoldWidget::class.java), null, null)
    }

    private fun self(c: Context, action: String, req: Int) = PendingIntent.getBroadcast(
      c, req, Intent(c, GoldWidget::class.java).setAction(action),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    private fun render(c: Context, mgr: AppWidgetManager, ids: IntArray) {
      DeckStore.load(c)
      val gold = DeckStore.withMeaning(DeckStore.GOLD)
      val p = prefs(c)
      val reveal = p.getBoolean("reveal", false)
      for (id in ids) {
        val v = RemoteViews(c.packageName, R.layout.ls_widget_gold)
        v.setOnClickPendingIntent(R.id.ls_gw_root, GoldWords.openPage(c, "flashcards?deck=gold", 20))
        if (gold.isEmpty()) {
          v.setTextViewText(R.id.ls_gw_word, "✨ All caught up")
          v.setTextViewText(R.id.ls_gw_meaning, "No gold words to review — nice!")
          v.setViewVisibility(R.id.ls_gw_meaning, View.VISIBLE)
          v.setViewVisibility(R.id.ls_gw_button, View.GONE)
          v.setTextViewText(R.id.ls_gw_count, "")
        } else {
          val index = Math.floorMod(p.getInt("index", 0), gold.size)
          val (word, meaning) = gold[index]
          v.setTextViewText(R.id.ls_gw_word, "✨ $word")
          v.setTextViewText(R.id.ls_gw_meaning, meaning)
          v.setViewVisibility(R.id.ls_gw_meaning, if (reveal) View.VISIBLE else View.INVISIBLE)
          v.setViewVisibility(R.id.ls_gw_button, View.VISIBLE)
          v.setTextViewText(R.id.ls_gw_button, if (reveal) "Next ✨" else "Show meaning")
          v.setOnClickPendingIntent(R.id.ls_gw_button, if (reveal) self(c, ACTION_NEXT, 22) else self(c, ACTION_SHOW, 21))
          v.setTextViewText(R.id.ls_gw_count, "${index + 1} / ${gold.size} gold")
        }
        mgr.updateAppWidget(id, v)
      }
    }
  }

  override fun onUpdate(c: Context, mgr: AppWidgetManager, ids: IntArray) = render(c, mgr, ids)

  override fun onReceive(c: Context, intent: Intent) {
    when (intent.action) {
      ACTION_SHOW -> { prefs(c).edit().putBoolean("reveal", true).apply(); refreshAll(c) }
      ACTION_NEXT -> {
        val p = prefs(c)
        p.edit().putInt("index", p.getInt("index", 0) + 1).putBoolean("reveal", false).apply()
        refreshAll(c)
      }
      else -> super.onReceive(c, intent)
    }
  }
}
