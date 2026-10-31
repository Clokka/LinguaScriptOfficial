package __PACKAGE__

// The learner's deck for the bubble, read from files/ls-deck.json.
// The website writes it every time the app opens (src/components/AppInbox.tsx
// → app/index.tsx). Each word: [state, dueAtMs or 0, tappedAtMs or 0].
// Gold uses the SAME rule as isDueGold() in packages/core/src/vocab.ts:
// green + due + not tapped in a video since it fell due.
// "common": most-common words not yet in a deck (ringed in "common" style).
// "meanings": translations of orange + green words, for the home-screen
// widget and the lock-screen gold word (DeckWidget.kt, GoldWords.kt).

import android.content.Context
import org.json.JSONObject
import java.io.File

object DeckStore {
  const val RED = "red"
  const val ORANGE = "orange"
  const val GREEN = "green"
  const val GOLD = "gold"
  /** Not in a deck, but one of the most common words — ringed in "common" style. */
  const val COMMON = "common"

  private class Entry(val state: String, val dueAt: Long, val tappedAt: Long)

  private var words = HashMap<String, Entry>()
  private var common = HashSet<String>()
  private var meanings = HashMap<String, String>()
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
      val cs = HashSet<String>()
      val ca = json.optJSONArray("common")
      if (ca != null) for (i in 0 until ca.length()) {
        val k = key(ca.optString(i, ""))
        if (k.isNotEmpty()) { cs.add(k); if (k.length > max) max = k.length }
      }
      common = cs
      val mm = HashMap<String, String>()
      val mj = json.optJSONObject("meanings")
      if (mj != null) for (k in mj.keys()) mj.optString(k, "").takeIf { it.isNotBlank() }?.let { mm[k] = it }
      meanings = mm
      longest = minOf(max, 8)
      loadedAt = file.lastModified()
    } catch (_: Exception) { }
  }

  /** red / orange / green / gold, or null when the word isn't in a deck. */
  fun colourOf(raw: String, now: Long = System.currentTimeMillis()): String? {
    val k = key(raw)
    val e = words[k] ?: return if (common.contains(k)) COMMON else null
    if (e.state == GREEN && e.dueAt in 1..now && e.tappedAt < e.dueAt) return GOLD
    return e.state
  }

  fun hasWords() = words.isNotEmpty()

  /** How many words show red / orange / green / gold right now. */
  fun counts(now: Long = System.currentTimeMillis()): Map<String, Int> {
    val out = hashMapOf(RED to 0, ORANGE to 0, GREEN to 0, GOLD to 0)
    for (k in words.keys) {
      val c = colourOf(k, now) ?: continue
      out[c] = (out[c] ?: 0) + 1
    }
    return out
  }

  /** Words in this colour that have a meaning, as (word, meaning). */
  fun withMeaning(colour: String, now: Long = System.currentTimeMillis()): List<Pair<String, String>> =
    words.keys.filter { colourOf(it, now) == colour }.mapNotNull { k -> meanings[k]?.let { k to it } }.sortedBy { it.first }

  /** A word saved from the bubble shows red straight away (the app saves it later). */
  fun markSaved(raw: String) {
    val k = key(raw)
    if (k.isNotEmpty() && !words.containsKey(k)) words[k] = Entry(RED, 0L, 0L)
  }

  /** Languages written without spaces: match characters, not words. */
  fun isCjk(lang: String = language) = lang == "ja" || lang == "zh" || lang == "ko"
}
