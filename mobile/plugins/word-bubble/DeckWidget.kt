package __PACKAGE__

// 🦎 The home-screen widget: the chameleon, three squares (red, orange, green)
// with how many words are in each deck, one orange/green word with its meaning
// to glance at, and a gold strip when reviews are due. Tap a square → that
// deck; the gold strip → due reviews; anywhere else → flashcards.
// Layout: res/layout/ls_widget_deck.xml. Refreshed hourly by GoldWordReceiver.

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.view.View
import android.widget.RemoteViews

class DeckWidget : AppWidgetProvider() {

  companion object {
    fun refreshAll(c: Context) {
      val mgr = AppWidgetManager.getInstance(c)
      val ids = mgr.getAppWidgetIds(ComponentName(c, DeckWidget::class.java))
      if (ids.isNotEmpty()) render(c, mgr, ids)
    }

    /** Android 8+: "Add LinguaScript to your home screen?" */
    fun requestPin(c: Context): Boolean {
      val mgr = AppWidgetManager.getInstance(c)
      if (android.os.Build.VERSION.SDK_INT < 26 || !mgr.isRequestPinAppWidgetSupported) return false
      return mgr.requestPinAppWidget(ComponentName(c, DeckWidget::class.java), null, null)
    }

    private fun render(c: Context, mgr: AppWidgetManager, ids: IntArray) {
      DeckStore.load(c)
      val counts = DeckStore.counts()
      val gold = counts[DeckStore.GOLD] ?: 0
      // One orange or green word to glance at — changes every refresh.
      val glance = DeckStore.withMeaning(DeckStore.ORANGE) + DeckStore.withMeaning(DeckStore.GREEN)
      val pick = if (glance.isEmpty()) null else glance[((System.currentTimeMillis() / 3_600_000L) % glance.size).toInt()]

      for (id in ids) {
        val v = RemoteViews(c.packageName, R.layout.ls_widget_deck)
        v.setTextViewText(R.id.ls_count_red, (counts[DeckStore.RED] ?: 0).toString())
        v.setTextViewText(R.id.ls_count_orange, (counts[DeckStore.ORANGE] ?: 0).toString())
        // Gold words are green words too — count them in the green square.
        v.setTextViewText(R.id.ls_count_green, ((counts[DeckStore.GREEN] ?: 0) + gold).toString())
        if (pick != null) {
          v.setViewVisibility(R.id.ls_glance, View.VISIBLE)
          v.setTextViewText(R.id.ls_glance, "${pick.first} · ${pick.second}")
        } else {
          v.setViewVisibility(R.id.ls_glance, View.GONE)
        }
        v.setTextViewText(R.id.ls_gold, if (gold > 0) "✨ $gold gold word${if (gold == 1) "" else "s"} to review" else "✨ No reviews due — nice!")
        // Each square opens its own deck; the gold strip opens the due reviews.
        v.setOnClickPendingIntent(R.id.ls_widget_root, GoldWords.openPage(c, "flashcards", 10))
        v.setOnClickPendingIntent(R.id.ls_count_red, GoldWords.openPage(c, "flashcards?deck=red", 11))
        v.setOnClickPendingIntent(R.id.ls_count_orange, GoldWords.openPage(c, "flashcards?deck=orange", 12))
        v.setOnClickPendingIntent(R.id.ls_count_green, GoldWords.openPage(c, "flashcards?deck=green", 13))
        v.setOnClickPendingIntent(R.id.ls_gold, GoldWords.openPage(c, "flashcards?deck=gold", 14))
        mgr.updateAppWidget(id, v)
      }
    }
  }

  override fun onUpdate(c: Context, mgr: AppWidgetManager, ids: IntArray) = render(c, mgr, ids)
}
