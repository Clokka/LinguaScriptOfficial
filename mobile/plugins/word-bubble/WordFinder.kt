package __PACKAGE__

// Finds every word on a screenshot with Google ML Kit (on the phone, nothing
// is uploaded), then works out how to redraw each one so it looks native:
// its background colour, whether the background is too busy to paint over,
// light or dark, and roughly how bold the original text is.

import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Rect
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions
import com.google.mlkit.vision.text.devanagari.DevanagariTextRecognizerOptions
import com.google.mlkit.vision.text.japanese.JapaneseTextRecognizerOptions
import com.google.mlkit.vision.text.korean.KoreanTextRecognizerOptions
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlin.math.sqrt

/** One word found on screen. */
class WordHit(
  val text: String,          // as it appears on screen
  val rect: Rect,            // where, in screen pixels
  var colour: String?,       // red / orange / green / gold, or null (not in a deck)
  val context: String,       // the line it sits in — becomes the flashcard's example
  var bg: Int = Color.WHITE, // the colour right behind it
  var busy: Boolean = false, // photo / gradient behind: use a ring, not a redraw
  var light: Boolean = true, // light background: use the deeper shades
  var bold: Boolean = false, // thick strokes: redraw bold
)

object WordFinder {

  private fun recognizerFor(lang: String): TextRecognizer = when (lang) {
    "ja" -> TextRecognition.getClient(JapaneseTextRecognizerOptions.Builder().build())
    "zh" -> TextRecognition.getClient(ChineseTextRecognizerOptions.Builder().build())
    "ko" -> TextRecognition.getClient(KoreanTextRecognizerOptions.Builder().build())
    "hi" -> TextRecognition.getClient(DevanagariTextRecognizerOptions.Builder().build())
    else -> TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
  }

  /** ML Kit reads Latin, Japanese, Chinese, Korean and Hindi scripts. */
  fun supports(lang: String) = lang in setOf("fr", "es", "de", "it", "pt", "nl", "pl", "sv", "tr", "en", "ja", "zh", "ko", "hi")

  fun find(bitmap: Bitmap, onDone: (List<WordHit>) -> Unit) {
    val lang = DeckStore.language
    val recognizer = recognizerFor(lang)
    recognizer.process(InputImage.fromBitmap(bitmap, 0))
      .addOnSuccessListener { text ->
        val hits = if (DeckStore.isCjk(lang)) cjkHits(text) else wordHits(text)
        hits.forEach { analyse(bitmap, it) }
        recognizer.close()
        onDone(hits)
      }
      .addOnFailureListener {
        recognizer.close()
        onDone(emptyList())
      }
  }

  // Spaced languages: one hit per word (ML Kit "element").
  private fun wordHits(text: Text): List<WordHit> {
    val out = ArrayList<WordHit>()
    for (block in text.textBlocks) for (line in block.lines) for (el in line.elements) {
      val box = el.boundingBox ?: continue
      val raw = el.text
      var colour = DeckStore.colourOf(raw)
      var rect = box
      var shown = raw
      // l'enfant, j'ai, qu'il: try the word after the apostrophe on its own.
      if (colour == null) {
        val cut = raw.indexOfAny(charArrayOf('\'', '’'))
        if (cut in 1 until raw.length - 1) {
          val rest = raw.substring(cut + 1)
          val c = DeckStore.colourOf(rest)
          if (c != null) {
            colour = c
            shown = rest
            rect = symbolsRect(el.symbols, cut + 1, raw.length) ?: Rect(box.left + box.width() * (cut + 1) / raw.length, box.top, box.right, box.bottom)
          }
        }
      }
      if (DeckStore.key(shown).isEmpty()) continue
      out.add(WordHit(shown, rect, colour, line.text))
    }
    return out
  }

  // Japanese / Chinese / Korean: match deck words inside each line, longest
  // first, character by character (ML Kit gives one box per character).
  private fun cjkHits(text: Text): List<WordHit> {
    val out = ArrayList<WordHit>()
    for (block in text.textBlocks) for (line in block.lines) {
      val chars = ArrayList<Pair<String, Rect>>()
      for (el in line.elements) for (s in el.symbols) {
        val b = s.boundingBox ?: continue
        chars.add(Pair(s.text, b))
      }
      var i = 0
      while (i < chars.size) {
        var matched = 0
        for (len in minOf(DeckStore.longest, chars.size - i) downTo 1) {
          val word = (i until i + len).joinToString("") { chars[it].first }
          val colour = DeckStore.colourOf(word) ?: continue
          val r = Rect(chars[i].second)
          for (j in i + 1 until i + len) r.union(chars[j].second)
          out.add(WordHit(word, r, colour, line.text))
          matched = len
          break
        }
        i += if (matched > 0) matched else 1
      }
    }
    return out
  }

  private fun symbolsRect(symbols: List<Text.Symbol>, from: Int, to: Int): Rect? {
    if (symbols.size < to) return null
    var r: Rect? = null
    for (k in from until to) {
      val b = symbols[k].boundingBox ?: continue
      if (r == null) r = Rect(b) else r.union(b)
    }
    return r
  }

  /** Background colour, busyness, light/dark and boldness, from the pixels. */
  private fun analyse(bmp: Bitmap, hit: WordHit) {
    val r = hit.rect
    val pad = maxOf(2, r.height() / 6)
    val rs = ArrayList<Int>(); val gs = ArrayList<Int>(); val bs = ArrayList<Int>()
    fun sample(x: Int, y: Int) {
      if (x < 0 || y < 0 || x >= bmp.width || y >= bmp.height) return
      val p = bmp.getPixel(x, y)
      rs.add(Color.red(p)); gs.add(Color.green(p)); bs.add(Color.blue(p))
    }
    // A ring of pixels just outside the word's box.
    val step = maxOf(1, r.width() / 24)
    var x = r.left - pad
    while (x <= r.right + pad) { sample(x, r.top - pad); sample(x, r.bottom + pad); x += step }
    var y = r.top
    while (y <= r.bottom) { sample(r.left - pad, y); sample(r.right + pad, y); y += maxOf(1, r.height() / 8) }
    if (rs.isEmpty()) return
    val mr = rs.sorted()[rs.size / 2]; val mg = gs.sorted()[gs.size / 2]; val mb = bs.sorted()[bs.size / 2]
    hit.bg = Color.rgb(mr, mg, mb)
    hit.light = (0.299 * mr + 0.587 * mg + 0.114 * mb) / 255.0 > 0.55
    // Busy = the ring's colours vary a lot (photo, gradient, pattern).
    var v = 0.0
    for (k in rs.indices) {
      val d = (rs[k] - mr) * (rs[k] - mr) + (gs[k] - mg) * (gs[k] - mg) + (bs[k] - mb) * (bs[k] - mb)
      v += d
    }
    hit.busy = sqrt(v / rs.size) > 26.0
    // Bold = a lot of the box is ink (far from the background colour).
    var ink = 0; var total = 0
    val sx = maxOf(1, r.width() / 30); val sy = maxOf(1, r.height() / 12)
    var yy = r.top
    while (yy < r.bottom) {
      var xx = r.left
      while (xx < r.right) {
        if (xx in 0 until bmp.width && yy in 0 until bmp.height) {
          val p = bmp.getPixel(xx, yy)
          val d = Math.abs(Color.red(p) - mr) + Math.abs(Color.green(p) - mg) + Math.abs(Color.blue(p) - mb)
          if (d > 160) ink++
          total++
        }
        xx += sx
      }
      yy += sy
    }
    hit.bold = total > 0 && ink.toDouble() / total > 0.30
  }
}
