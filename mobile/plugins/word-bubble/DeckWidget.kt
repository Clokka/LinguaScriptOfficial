package __PACKAGE__

// 🦎 The home-screen widget (4×2): the chameleon funnel on your home screen.
//   Top:    gold chameleon · "12 gold — words ready to turn blue" · Review
//   Middle: the blue bar — how many of your words you 100% know
//   Bottom: five chameleons (red, orange, green, gold, blue) with their counts
// Tap Review / the gold square → due reviews; a square → that deck; anywhere
// else → flashcards. Blue = isBlue() in packages/core/src/review.ts (right at
// the 30-day review); a blue word counts only as blue.
// Layout: res/layout/ls_widget_deck.xml. Refreshed hourly by GoldWordReceiver,
// and whenever a gold answer is given on the gold / lock-screen widget.

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
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
      // Gold answered on the gold widget but not yet sent to the account: don't count it again.
      val gold = maxOf(0, (counts[DeckStore.GOLD] ?: 0) - GoldWidget.answeredCount(c))
      val blue = counts[DeckStore.BLUE] ?: 0
      val total = DeckStore.total()
      val pct = if (total > 0) (blue * 100) / total else 0

      for (id in ids) {
        val v = RemoteViews(c.packageName, R.layout.ls_widget_deck)
        if (gold > 0) {
          v.setTextViewText(R.id.ls_gold_count, "$gold gold")
          v.setTextViewText(R.id.ls_gold_sub, if (gold == 1) "word ready to turn blue" else "words ready to turn blue")
          v.setTextViewText(R.id.ls_review, "Review")
        } else {
          v.setTextViewText(R.id.ls_gold_count, "All caught up")
          v.setTextViewText(R.id.ls_gold_sub, "No gold words to review — nice!")
          v.setTextViewText(R.id.ls_review, "Learn")
        }
        v.setTextViewText(R.id.ls_blue_label, "$blue blue · 100% known")
        v.setTextViewText(R.id.ls_blue_pct, if (total > 0) "$pct% of your words" else "")
        v.setProgressBar(R.id.ls_blue_bar, 100, pct, false)
        v.setTextViewText(R.id.ls_count_red, (counts[DeckStore.RED] ?: 0).toString())
        v.setTextViewText(R.id.ls_count_orange, (counts[DeckStore.ORANGE] ?: 0).toString())
        v.setTextViewText(R.id.ls_count_green, (counts[DeckStore.GREEN] ?: 0).toString())
        v.setTextViewText(R.id.ls_count_gold, gold.toString())
        v.setTextViewText(R.id.ls_count_blue, blue.toString())

        v.setOnClickPendingIntent(R.id.ls_widget_root, GoldWords.openPage(c, "flashcards", 10))
        v.setOnClickPendingIntent(R.id.ls_cell_red, GoldWords.openPage(c, "flashcards?deck=red", 11))
        v.setOnClickPendingIntent(R.id.ls_cell_orange, GoldWords.openPage(c, "flashcards?deck=orange", 12))
        v.setOnClickPendingIntent(R.id.ls_cell_green, GoldWords.openPage(c, "flashcards?deck=green", 13))
        v.setOnClickPendingIntent(R.id.ls_cell_gold, GoldWords.openPage(c, "flashcards?deck=gold", 14))
        v.setOnClickPendingIntent(R.id.ls_cell_blue, GoldWords.openPage(c, "flashcards?deck=green", 15))
        v.setOnClickPendingIntent(R.id.ls_review, GoldWords.openPage(c, if (gold > 0) "flashcards?deck=gold" else "flashcards", 16))
        mgr.updateAppWidget(id, v)
      }
    }
  }

  override fun onUpdate(c: Context, mgr: AppWidgetManager, ids: IntArray) = render(c, mgr, ids)
}
