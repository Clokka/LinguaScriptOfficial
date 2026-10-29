package __PACKAGE__

// LinguaScript — "select text → LinguaScript" on Android.
//
// Highlight a word in ANY app, tap "LinguaScript" in the text menu, and this
// small card slides up over that app: the word, its translation, and Save.
// Save drops the word into an inbox file the LinguaScript app picks up the next
// time it opens (app/index.tsx → the website saves it to the red deck). No
// special permission: Android hands us only the text the person selected.
//
// Added to the build by plugins/withProcessText.js (expo prebuild).

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.animation.DecelerateInterpolator
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.Locale
import kotlin.concurrent.thread

class ProcessTextActivity : Activity() {

  private val bg = Color.parseColor("#08080B")
  private val surface = Color.parseColor("#121218")
  private val line = Color.parseColor("#24242D")
  private val white = Color.parseColor("#F5F5F7")
  private val muted = Color.parseColor("#9A9AA6")
  private val red = Color.parseColor("#FF3B30")
  private val green = Color.parseColor("#34C759")

  private val main = Handler(Looper.getMainLooper())
  private lateinit var transView: TextView
  private lateinit var saveBtn: Button

  private var selected = ""
  private var translation = ""
  private var detected = ""
  private var learning = ""
  private var native = ""

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    selected = (intent.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT)?.toString() ?: "")
      .replace(Regex("\\s+"), " ").trim().take(200)
    if (selected.isEmpty()) { finish(); return }

    // Languages the app last saw on the website (written by app/index.tsx).
    try {
      val cfg = JSONObject(File(filesDir, "ls-config.json").readText())
      learning = cfg.optString("learning", "")
      native = cfg.optString("native", "")
    } catch (_: Exception) { }
    if (native.isEmpty()) native = Locale.getDefault().language.ifEmpty { "en" }

    setContentView(buildCard())
    translate()
  }

  private fun dp(v: Int): Int =
    TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics).toInt()

  private fun rounded(color: Int, radius: Int, stroke: Int? = null): GradientDrawable =
    GradientDrawable().apply {
      setColor(color)
      cornerRadius = dp(radius).toFloat()
      if (stroke != null) setStroke(dp(2), stroke)
    }

  private fun buildCard(): View {
    // Dimmed backdrop — tap outside the card to close.
    val root = FrameLayout(this).apply {
      setBackgroundColor(Color.parseColor("#80000000"))
      setOnClickListener { finish() }
    }

    val card = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      background = rounded(bg, 24)
      setPadding(dp(20), dp(18), dp(20), dp(20))
      isClickable = true // keep taps on the card from closing it
      elevation = dp(12).toFloat()
    }

    // Header: three deck dots + LinguaScript wordmark
    val header = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
    }
    for (c in listOf(red, Color.parseColor("#FF8A00"), green)) {
      header.addView(View(this).apply { background = rounded(c, 6) }, LinearLayout.LayoutParams(dp(9), dp(9)).apply { rightMargin = dp(4) })
    }
    header.addView(TextView(this).apply {
      text = "LinguaScript"
      setTextColor(white)
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
      typeface = Typeface.DEFAULT_BOLD
      setPadding(dp(6), 0, 0, 0)
    })
    card.addView(header)

    card.addView(TextView(this).apply {
      text = selected
      setTextColor(white)
      setTextSize(TypedValue.COMPLEX_UNIT_SP, if (selected.length > 40) 20f else 28f)
      typeface = Typeface.DEFAULT_BOLD
      setPadding(0, dp(12), 0, dp(4))
      maxLines = 4
    })

    transView = TextView(this).apply {
      text = "…"
      setTextColor(muted)
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
      setPadding(0, 0, 0, dp(16))
    }
    card.addView(transView)

    val row = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
    saveBtn = Button(this).apply {
      text = "🔴  Save"
      isAllCaps = false
      setTextColor(red)
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
      typeface = Typeface.DEFAULT_BOLD
      background = rounded(Color.parseColor("#26FF3B30"), 16, red)
      isEnabled = false
      setOnClickListener { save() }
    }
    row.addView(saveBtn, LinearLayout.LayoutParams(0, dp(52), 1f).apply { rightMargin = dp(10) })
    row.addView(Button(this).apply {
      text = "🦎"
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 20f)
      background = rounded(surface, 16, line)
      contentDescription = "Open LinguaScript"
      setOnClickListener { openApp("/flashcards") }
    }, LinearLayout.LayoutParams(dp(64), dp(52)))
    card.addView(row)

    root.addView(card, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM).apply {
      setMargins(dp(12), 0, dp(12), dp(16))
    })

    // Slide up
    card.translationY = dp(240).toFloat()
    card.animate().translationY(0f).setDuration(220).setInterpolator(DecelerateInterpolator()).start()
    return root
  }

  /** Google's free translate endpoint (the same one the Chrome extension uses). */
  private fun gtx(text: String, sl: String, tl: String): Pair<String, String>? {
    return try {
      val url = URL("https://translate.googleapis.com/translate_a/single?client=gtx&sl=$sl&tl=$tl&dt=t&q=" + URLEncoder.encode(text, "UTF-8"))
      val conn = (url.openConnection() as HttpURLConnection).apply { connectTimeout = 5000; readTimeout = 5000 }
      val body = conn.inputStream.bufferedReader().use { it.readText() }
      val data = JSONArray(body)
      val parts = data.getJSONArray(0)
      val sb = StringBuilder()
      for (i in 0 until parts.length()) sb.append(parts.getJSONArray(i).optString(0, ""))
      Pair(sb.toString().trim(), data.optString(2, sl))
    } catch (_: Exception) { null }
  }

  private fun translate() {
    thread {
      var res = gtx(selected, "auto", native)
      // Selected text in your own language? Show it in the language you're learning.
      if (res != null && res.second.startsWith(native) && learning.isNotEmpty() && learning != native) {
        val back = gtx(selected, native, learning)
        if (back != null) res = Pair(back.first, "$native>$learning")
      }
      main.post {
        if (res == null || res.first.isEmpty()) {
          transView.text = "Translation unavailable — check your connection"
        } else {
          translation = res.first
          detected = res.second
          transView.text = translation
          transView.setTextColor(white)
        }
        saveBtn.isEnabled = true
      }
    }
  }

  /** Queue the word for the LinguaScript app (it saves it to your red deck). */
  private fun save() {
    try {
      val reversed = detected.contains(">")
      val item = JSONObject().apply {
        // Reversed (you selected your own language): the word to learn is the translation.
        put("word", if (reversed) translation else selected)
        put("translation", if (reversed) selected else translation)
        put("language", if (reversed) learning else detected.substringBefore("-"))
        put("context", selected)
        put("at", System.currentTimeMillis())
      }
      val file = File(filesDir, "ls-inbox.json")
      val list = try { JSONArray(file.readText()) } catch (_: Exception) { JSONArray() }
      list.put(item)
      file.writeText(list.toString())
      saveBtn.text = "✓  Saved"
      saveBtn.setTextColor(Color.parseColor("#08080B"))
      saveBtn.background = rounded(red, 16, red)
      saveBtn.isEnabled = false
      Toast.makeText(this, "🔴 Saved to LinguaScript", Toast.LENGTH_SHORT).show()
      main.postDelayed({ finish() }, 700)
    } catch (_: Exception) {
      openApp("/flashcards")
    }
  }

  private fun openApp(path: String) {
    val launch = packageManager.getLaunchIntentForPackage(packageName) ?: return finish()
    launch.action = Intent.ACTION_VIEW
    launch.data = Uri.parse("https://linguascript.co.uk$path")
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    startActivity(launch)
    finish()
  }

  override fun finish() {
    super.finish()
    if (Build.VERSION.SDK_INT >= 34) {
      overrideActivityTransition(OVERRIDE_TRANSITION_CLOSE, 0, android.R.anim.fade_out)
    } else {
      @Suppress("DEPRECATION")
      overridePendingTransition(0, android.R.anim.fade_out)
    }
  }
}
