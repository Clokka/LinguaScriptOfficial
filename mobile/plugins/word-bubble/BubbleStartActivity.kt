package __PACKAGE__

// Invisible helper screen for the 🦎 bubble:
//   linguascriptbubble://start?style=text|ring  → asks for "display over other
//                                                 apps" if needed, starts the bubble
//   linguascriptbubble://stop                   → turns it off
//   linguascriptbubble://style?style=ring       → switches Colour / Rings
//   linguascriptbubble://read                   → read this screen now (quick-settings tile);
//                                                 starts the bubble first if it's off
//   linguascriptbubble://gold?on=1|0            → gold word on the lock screen (GoldWords.kt)
//   linguascriptbubble://widget                 → "add the widget to your home screen?"
//   linguascriptbubble://tile                   → "add the LinguaScript button to quick settings?" (Android 13+)
//   linguascriptbubble://subtitles?on=1|0[&anywhere=1|0] → tap subtitle words in YouTube (SubtitleTapService);
//                                                 anywhere=1 also reads Live Caption boxes when the video has none;
//                                                 asks for "display over other apps", then the
//                                                 one-time "share your screen?" yes
//   ACTION_SUBTITLE_CAPTURE (from the service)  → that yes again, when a video starts and
//                                                 Android has stopped the old one
//   ACTION_CAPTURE (from the bubble)            → Android's "start recording?"
//                                                 consent, then hands it to the bubble
// The website's switch opens these links through the app (app/index.tsx).

import android.Manifest
import android.app.Activity
import android.app.StatusBarManager
import android.content.ComponentName
import android.graphics.drawable.Icon
import android.content.pm.PackageManager
import android.content.Intent
import android.media.projection.MediaProjectionConfig
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast

class BubbleStartActivity : Activity() {

  companion object {
    const val ACTION_CAPTURE = "ls.bubble.ASK_CAPTURE"
    const val ACTION_SUBTITLE_CAPTURE = "ls.subtitles.ASK_CAPTURE"
    private const val REQ_CAPTURE = 7001
    private const val REQ_SUB_CAPTURE = 7004
    private const val REQ_OVERLAY = 7002
    private const val REQ_NOTIFY = 7003
  }

  private val prefs get() = getSharedPreferences("ls-bubble", MODE_PRIVATE)
  /** Read the screen as soon as the bubble is up (quick-settings tile). */
  private var readNow = false
  /** Waiting for "display over other apps" to turn on subtitle taps. */
  private var forSubtitles = false

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (intent.action == ACTION_CAPTURE) { askCapture(); return }
    if (intent.action == ACTION_SUBTITLE_CAPTURE) { askCapture(REQ_SUB_CAPTURE); return }

    val uri: Uri? = intent.data
    val style = uri?.getQueryParameter("style")?.takeIf { it == "text" || it == "ring" || it == "common" }
    if (style != null) {
      prefs.edit().putString("style", style).apply()
      BubbleService.instance?.setStyle(style)
    }
    when (uri?.host) {
      "start" -> start()
      "read" -> {
        val running = BubbleService.instance
        if (running != null) { finish(); running.readScreenSoon() } else { readNow = true; start() }
      }
      "gold" -> gold(uri?.getQueryParameter("on") == "1")
      "widget" -> {
        val goldKind = uri?.getQueryParameter("kind") == "gold"
        val pinned = if (goldKind) GoldWidget.requestPin(this) else DeckWidget.requestPin(this)
        if (!pinned) {
          Toast.makeText(this, "Long-press your home screen → Widgets → ${if (goldKind) "LinguaScript Gold" else "LinguaScript"}", Toast.LENGTH_LONG).show()
        }
        finish()
      }
      "tile" -> addTile()
      "subtitles" -> {
        // "anywhere=1": no subtitles in the video → also read Live Caption / on-screen caption boxes.
        uri?.getQueryParameter("anywhere")?.let { prefs.edit().putBoolean("subtitles_anywhere", it == "1").apply() }
        if (uri?.getQueryParameter("on") == "1") {
          // Only the "anywhere" option changed while it's already running: no need to ask again.
          if (SubtitleTapService.isRunning()) finish() else startSubtitles()
        } else {
          prefs.edit().putBoolean("subtitles_on", false).apply()
          stopService(Intent(this, SubtitleTapService::class.java))
          finish()
        }
      }
      "stop" -> { stopService(Intent(this, BubbleService::class.java)); prefs.edit().putBoolean("on", false).apply(); finish() }
      else -> finish()
    }
  }

  /**
   * One tap to put "LinguaScript" in the quick-settings panel (swipe down from the top), so the
   * 🦎 bubble can be switched back on from anywhere. Android 13+ shows its own "Add tile?" box;
   * older phones are told where to drag it from.
   */
  private fun addTile() {
    if (Build.VERSION.SDK_INT >= 33) {
      val sbm = getSystemService(StatusBarManager::class.java)
      sbm.requestAddTileService(
        ComponentName(this, LinguaTileService::class.java),
        "LinguaScript",
        Icon.createWithResource(this, R.drawable.ls_tile),
        mainExecutor,
      ) { result ->
        val added = result == StatusBarManager.TILE_ADD_REQUEST_RESULT_TILE_ADDED ||
          result == StatusBarManager.TILE_ADD_REQUEST_RESULT_TILE_ALREADY_ADDED
        Toast.makeText(
          this,
          if (added) "LinguaScript is in your quick settings. Tap it any time to bring the 🦎 back."
          else "Swipe down twice, tap the pencil, and drag LinguaScript into your top tiles.",
          Toast.LENGTH_LONG,
        ).show()
        finish()
      }
    } else {
      Toast.makeText(this, "Swipe down twice, tap the pencil, and drag LinguaScript into your top tiles.", Toast.LENGTH_LONG).show()
      finish()
    }
  }

  private fun canDraw() = Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(this)

  /** Tap subtitle words in YouTube: overlay permission → service → the one-time screen-share yes. */
  private fun startSubtitles() {
    if (!canDraw()) {
      forSubtitles = true
      Toast.makeText(this, "Allow LinguaScript to show over other apps, so you can tap subtitles", Toast.LENGTH_LONG).show()
      @Suppress("DEPRECATION")
      startActivityForResult(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName")), REQ_OVERLAY)
      return
    }
    prefs.edit().putBoolean("subtitles_on", true).apply()
    val i = Intent(this, SubtitleTapService::class.java).setAction(SubtitleTapService.ACTION_START)
    if (Build.VERSION.SDK_INT >= 26) startForegroundService(i) else startService(i)
    askCapture(REQ_SUB_CAPTURE)
  }

  private fun start() {
    if (!canDraw()) {
      Toast.makeText(this, "Allow LinguaScript to show the bubble over other apps", Toast.LENGTH_LONG).show()
      @Suppress("DEPRECATION")
      startActivityForResult(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName")), REQ_OVERLAY)
      return
    }
    val i = Intent(this, BubbleService::class.java).setAction(BubbleService.ACTION_START)
      .putExtra(BubbleService.EXTRA_STYLE, prefs.getString("style", "text"))
      .putExtra(BubbleService.EXTRA_READ_NOW, readNow)
    if (Build.VERSION.SDK_INT >= 26) startForegroundService(i) else startService(i)
    prefs.edit().putBoolean("on", true).apply()
    finish()
  }

  private fun gold(on: Boolean) {
    if (on && Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
      requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQ_NOTIFY)
      return
    }
    GoldWords.setOn(this, on)
    finish()
  }

  override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    if (requestCode == REQ_NOTIFY) {
      val ok = grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED
      if (ok) GoldWords.setOn(this, true)
      else Toast.makeText(this, "Allow notifications to see gold words on your lock screen", Toast.LENGTH_LONG).show()
      finish()
    }
  }

  private fun askCapture(request: Int = REQ_CAPTURE) {
    val mpm = getSystemService(MediaProjectionManager::class.java)
    // Android 14+: offer the whole screen, not "one app".
    val ask = if (Build.VERSION.SDK_INT >= 34) mpm.createScreenCaptureIntent(MediaProjectionConfig.createConfigForDefaultDisplay())
              else mpm.createScreenCaptureIntent()
    @Suppress("DEPRECATION")
    startActivityForResult(ask, request)
  }

  @Deprecated("Deprecated in Java")
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    @Suppress("DEPRECATION")
    super.onActivityResult(requestCode, resultCode, data)
    when (requestCode) {
      REQ_OVERLAY -> {
        if (!canDraw()) finish()
        else if (forSubtitles) startSubtitles()
        else start()
      }
      REQ_SUB_CAPTURE -> {
        if (resultCode == RESULT_OK && data != null) {
          startService(Intent(this, SubtitleTapService::class.java)
            .setAction(SubtitleTapService.ACTION_CAPTURE)
            .putExtra(SubtitleTapService.EXTRA_RESULT_CODE, resultCode)
            .putExtra(SubtitleTapService.EXTRA_RESULT_DATA, data))
        } else {
          SubtitleTapService.instance?.captureCancelled()
        }
        finish()
        @Suppress("DEPRECATION")
        overridePendingTransition(0, 0)
      }
      REQ_CAPTURE -> {
        if (resultCode == RESULT_OK && data != null) {
          startService(Intent(this, BubbleService::class.java)
            .setAction(BubbleService.ACTION_CAPTURE)
            .putExtra(BubbleService.EXTRA_RESULT_CODE, resultCode)
            .putExtra(BubbleService.EXTRA_RESULT_DATA, data))
        } else {
          BubbleService.instance?.captureCancelled()
        }
        finish()
        @Suppress("DEPRECATION")
        overridePendingTransition(0, 0)
      }
    }
  }
}
