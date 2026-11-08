package __PACKAGE__

// ✨ The GOLD widget (home screen and lock screen): one gold word, and you can
// answer it right there — turning gold words into blue ones.
//   maison  → "Show meaning" → maison = house → "I knew it ✓" / "Not yet"
//   (or "Next" to skip without answering)
// An answer goes into files/ls-inbox.json as {kind:"review", word, language,
// correct, at}; when the app opens, the site applies it with the same rule as a
// flashcard answer (src/components/AppInbox.tsx: promote + applySrsReview).
// While the answer waits in the inbox, that word is hidden here, so the next gold word shows.
// widgetCategory = home_screen|keyguard, so phones that allow lock-screen
// widgets can place it there. Only gold words (never red), and never blue ones.
// Layout: res/layout/ls_widget_gold.xml. Refreshed hourly by GoldWordReceiver.

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.view.View
import android.widget.RemoteViews
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

class GoldWidget : AppWidgetProvider() {

  companion object {
    const val ACTION_SHOW = "ls.goldwidget.SHOW"
    const val ACTION_NEXT = "ls.goldwidget.NEXT"
    const val ACTION_KNEW = "ls.goldwidget.KNEW"
    const val ACTION_NOT_YET = "ls.goldwidget.NOT_YET"
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

    /**
     * Words answered here that the site hasn't applied yet: the review answers
     * still waiting in ls-inbox.json (the app deletes each one once it's saved).
     * Read from the inbox itself, so a word can't be answered twice.
     */
    private fun answered(c: Context): Set<String> = try {
      val list = JSONArray(File(c.filesDir, "ls-inbox.json").readText())
      (0 until list.length()).mapNotNull { list.optJSONObject(it) }
        .filter { it.optString("kind") == "review" }
        .map { DeckStore.key(it.optString("word")) }
        .toSet()
    } catch (_: Exception) { emptySet() }

    /** How many gold words were answered here and still wait for the app (the home widget subtracts them). */
    fun answeredCount(c: Context) = answered(c).size

    private fun goldWords(c: Context): List<Pair<String, String>> {
      DeckStore.load(c)
      val done = answered(c)
      return DeckStore.withMeaning(DeckStore.GOLD).filter { DeckStore.key(it.first) !in done }
    }

    private fun self(c: Context, action: String, req: Int) = PendingIntent.getBroadcast(
      c, req, Intent(c, GoldWidget::class.java).setAction(action),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    private fun render(c: Context, mgr: AppWidgetManager, ids: IntArray) {
      val gold = goldWords(c)
      val p = prefs(c)
      val reveal = p.getBoolean("reveal", false)
      for (id in ids) {
        val v = RemoteViews(c.packageName, R.layout.ls_widget_gold)
        v.setOnClickPendingIntent(R.id.ls_gw_root, GoldWords.openPage(c, "flashcards?deck=gold", 20))
        if (gold.isEmpty()) {
          v.setTextViewText(R.id.ls_gw_word, "All caught up")
          v.setTextViewText(R.id.ls_gw_meaning, "No gold words to review — nice!")
          v.setTextColor(R.id.ls_gw_meaning, Color.parseColor("#FF9AA3B2"))
          v.setViewVisibility(R.id.ls_gw_buttons, View.GONE)
          v.setTextViewText(R.id.ls_gw_hint, "New gold words appear when reviews fall due.")
          v.setTextViewText(R.id.ls_gw_count, "")
        } else {
          val index = Math.floorMod(p.getInt("index", 0), gold.size)
          val (word, meaning) = gold[index]
          v.setTextViewText(R.id.ls_gw_word, word)
          v.setTextViewText(R.id.ls_gw_count, "${index + 1} of ${gold.size}")
          v.setViewVisibility(R.id.ls_gw_buttons, View.VISIBLE)
          if (reveal) {
            v.setTextViewText(R.id.ls_gw_meaning, meaning)
            v.setTextColor(R.id.ls_gw_meaning, Color.parseColor("#FFF4F5F7"))
            v.setTextViewText(R.id.ls_gw_button, "I knew it ✓")
            v.setOnClickPendingIntent(R.id.ls_gw_button, self(c, ACTION_KNEW, 23))
            v.setTextViewText(R.id.ls_gw_button2, "Not yet")
            v.setOnClickPendingIntent(R.id.ls_gw_button2, self(c, ACTION_NOT_YET, 24))
            v.setTextViewText(R.id.ls_gw_hint, "Got it right? It moves towards blue.")
          } else {
            v.setTextViewText(R.id.ls_gw_meaning, "Do you know it? Tap to check.")
            v.setTextColor(R.id.ls_gw_meaning, Color.parseColor("#FF9AA3B2"))
            v.setTextViewText(R.id.ls_gw_button, "Show meaning")
            v.setOnClickPendingIntent(R.id.ls_gw_button, self(c, ACTION_SHOW, 21))
            v.setTextViewText(R.id.ls_gw_button2, "Next")
            v.setOnClickPendingIntent(R.id.ls_gw_button2, self(c, ACTION_NEXT, 22))
            v.setTextViewText(R.id.ls_gw_hint, "Turn your gold words blue.")
          }
        }
        mgr.updateAppWidget(id, v)
      }
    }

    /** Queue the answer for the site (same inbox as select-to-save) and hide the word here. */
    private fun answer(c: Context, correct: Boolean) {
      val gold = goldWords(c)
      if (gold.isEmpty()) return
      val p = prefs(c)
      val (word, _) = gold[Math.floorMod(p.getInt("index", 0), gold.size)]
      try {
        val item = JSONObject().apply {
          put("kind", "review")
          put("word", word)
          put("language", DeckStore.language)
          put("correct", correct)
          put("at", System.currentTimeMillis())
        }
        val file = File(c.filesDir, "ls-inbox.json")
        val list = try { JSONArray(file.readText()) } catch (_: Exception) { JSONArray() }
        list.put(item)
        file.writeText(list.toString())
      } catch (_: Exception) { return }
      // The answered word leaves the list, so the same index now shows the next one.
      p.edit().putBoolean("reveal", false).apply()
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
      ACTION_KNEW, ACTION_NOT_YET -> {
        answer(c, intent.action == ACTION_KNEW)
        refreshAll(c)
        DeckWidget.refreshAll(c)
      }
      else -> super.onReceive(c, intent)
    }
  }
}
