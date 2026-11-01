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
//   linguascriptbubble://tile                   → Android's "Add LinguaScript to quick settings?"
//                                                 (Android 13+); older phones get a how-to toast.
//                                                 Also asked once, the first time the bubble starts.
//   linguascriptbubble://subtitles?on=1|0       → tap subtitle words in YouTube (SubtitleTapService);
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
        if (!DeckWidget.requestPin(this)) {
          Toast.makeText(this, "Long-press your home screen → Widgets → LinguaScript", Toast.LENGTH_LONG).show()
        }
        finish()
      }
      "subtitles" -> if (uri?.getQueryParameter("on") == "1") startSubtitles() else {
        prefs.edit().putBoolean("subtitles_on", false).apply()
        stopService(Intent(this, SubtitleTapService::class.java))
        finish()
      }
      "tile" -> askAddTile(always = true)
      "stop" -> { stopService(Intent(this, BubbleService::class.java)); prefs.edit().putBoolean("on", false).apply(); finish() }
      else -> finish()
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
    // First time: offer the LinguaScript tile in the swipe-down panel, so next time it's one tap.
    if (!prefs.getBoolean("tile_asked", false)) askAddTile(always = false) else finish()
  }

  /** "Add LinguaScript to quick settings?" — Android's own box (13+). Taps the tile = 🦎 bubble on/off. */
  private fun askAddTile(always: Boolean) {
    prefs.edit().putBoolean("tile_asked", true).apply()
    val howTo = "Swipe down twice → tap ✏️ (edit) → drag LinguaScript into your tiles"
    if (Build.VERSION.SDK_INT < 33) {
      if (always) Toast.makeText(this, howTo, Toast.LENGTH_LONG).show()
      finish(); return
    }
    val icon = resources.getIdentifier("ls_tile", "drawable", packageName)
    val ok = runCatching {
      getSystemService(StatusBarManager::class.java).requestAddTileService(
        ComponentName(this, LinguaTileService::class.java),
        "LinguaScript",
        Icon.createWithResource(this, if (icon != 0) icon else applicationInfo.icon),
        mainExecutor,
      ) { result ->
        if (result == StatusBarManager.TILE_ADD_REQUEST_RESULT_TILE_ALREADY_ADDED && always) {
          Toast.makeText(this, "LinguaScript is already in your quick settings — swipe down to find it", Toast.LENGTH_LONG).show()
        }
        finish()
      }
    }.isSuccess
    if (!ok) { if (always) Toast.makeText(this, howTo, Toast.LENGTH_LONG).show(); finish() }
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
