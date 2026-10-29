package __PACKAGE__

// The learner's deck for the bubble, read from files/ls-deck.json.
// The website writes it every time the app opens (src/components/AppInbox.tsx
// → app/index.tsx). Each word: [state, dueAtMs or 0, tappedAtMs or 0].
// Gold uses the SAME rule as isDueGold() in packages/core/src/vocab.ts:
// green + due + not tapped in a video since it fell due.

import android.content.Context
import org.json.JSONObject
import java.io.File

object DeckStore {
  const val RED = "red"
  const val ORANGE = "orange"
  const val GREEN = "green"
  const val GOLD = "gold"

  private class Entry(val state: String, val dueAt: Long, val tappedAt: Long)

  private var words = HashMap<String, Entry>()
  private var loadedAt = 0L
  var language = ""
    private set
  var native = "en"
    private set
  /** Longest deck word, in characters — limits the CJK search. */
  var longest = 1
    private set

  /** Same key as normalizeToken() in src/lib/vocab.ts and the extension. */
  private val PUNCT = Regex("[.,!?;:\"'`«»()\\[\\]…，。、！？；：「」『』（）《》〈〉“”‘’]")
  fun key(raw: String): String = PUNCT.replace(raw.lowercase(), "").trim()

  fun load(context: Context, force: Boolean = false) {
    val file = File(context.filesDir, "ls-deck.json")
    if (!file.exists()) return
    if (!force && file.lastModified() <= loadedAt) return
    try {
      val json = JSONObject(file.readText())
      language = json.optString("language", "")
      native = json.optString("native", "en")
      val map = HashMap<String, Entry>()
      val w = json.optJSONObject("words") ?: JSONObject()
      var max = 1
      for (k in w.keys()) {
        val arr = w.optJSONArray(k) ?: continue
        map[k] = Entry(arr.optString(0, RED), arr.optLong(1, 0L), arr.optLong(2, 0L))
        if (k.length > max) max = k.length
      }
      words = map
      longest = minOf(max, 8)
      loadedAt = file.lastModified()
    } catch (_: Exception) { }
  }

  /** red / orange / green / gold, or null when the word isn't in a deck. */
  fun colourOf(raw: String, now: Long = System.currentTimeMillis()): String? {
    val e = words[key(raw)] ?: return null
    if (e.state == GREEN && e.dueAt in 1..now && e.tappedAt < e.dueAt) return GOLD
    return e.state
  }

  fun hasWords() = words.isNotEmpty()

  /** A word saved from the bubble shows red straight away (the app saves it later). */
  fun markSaved(raw: String) {
    val k = key(raw)
    if (k.isNotEmpty() && !words.containsKey(k)) words[k] = Entry(RED, 0L, 0L)
  }

  /** Languages written without spaces: match characters, not words. */
  fun isCjk(lang: String = language) = lang == "ja" || lang == "zh" || lang == "ko"
}
