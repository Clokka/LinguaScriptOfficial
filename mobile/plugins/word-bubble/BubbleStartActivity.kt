package __PACKAGE__

// Invisible helper screen for the 🦎 bubble:
//   linguascriptbubble://start?style=text|ring  → asks for "display over other
//                                                 apps" if needed, starts the bubble
//   linguascriptbubble://stop                   → turns it off
//   linguascriptbubble://style?style=ring       → switches Colour / Rings
//   ACTION_CAPTURE (from the bubble)            → Android's "start recording?"
//                                                 consent, then hands it to the bubble
// The website's switch opens these links through the app (app/index.tsx).

import android.app.Activity
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
    private const val REQ_CAPTURE = 7001
    private const val REQ_OVERLAY = 7002
  }

  private val prefs get() = getSharedPreferences("ls-bubble", MODE_PRIVATE)

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (intent.action == ACTION_CAPTURE) { askCapture(); return }

    val uri: Uri? = intent.data
    val style = uri?.getQueryParameter("style")?.takeIf { it == "text" || it == "ring" || it == "common" }
    if (style != null) {
      prefs.edit().putString("style", style).apply()
      BubbleService.instance?.setStyle(style)
    }
    when (uri?.host) {
      "start" -> start()
      "stop" -> { stopService(Intent(this, BubbleService::class.java)); prefs.edit().putBoolean("on", false).apply(); finish() }
      else -> finish()
    }
  }

  private fun canDraw() = Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(this)

  private fun start() {
    if (!canDraw()) {
      Toast.makeText(this, "Allow LinguaScript to show the bubble over other apps", Toast.LENGTH_LONG).show()
      @Suppress("DEPRECATION")
      startActivityForResult(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName")), REQ_OVERLAY)
      return
    }
    val i = Intent(this, BubbleService::class.java).setAction(BubbleService.ACTION_START)
      .putExtra(BubbleService.EXTRA_STYLE, prefs.getString("style", "text"))
    if (Build.VERSION.SDK_INT >= 26) startForegroundService(i) else startService(i)
    prefs.edit().putBoolean("on", true).apply()
    finish()
  }

  private fun askCapture() {
    val mpm = getSystemService(MediaProjectionManager::class.java)
    // Android 14+: offer the whole screen, not "one app".
    val ask = if (Build.VERSION.SDK_INT >= 34) mpm.createScreenCaptureIntent(MediaProjectionConfig.createConfigForDefaultDisplay())
              else mpm.createScreenCaptureIntent()
    @Suppress("DEPRECATION")
    startActivityForResult(ask, REQ_CAPTURE)
  }

  @Deprecated("Deprecated in Java")
  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    @Suppress("DEPRECATION")
    super.onActivityResult(requestCode, resultCode, data)
    when (requestCode) {
      REQ_OVERLAY -> { if (canDraw()) start() else finish() }
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
