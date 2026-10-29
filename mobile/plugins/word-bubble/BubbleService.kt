package __PACKAGE__

// The 🦎 bubble. Floats over every app. Tap it → Android asks to capture the
// screen (once per tap) → one screenshot → the words are found on the phone →
// your deck words light up over that screen (Colour or Rings style). Tap a
// word for its meaning and Save; tap anywhere else to close. Drag to move,
// long-press to open LinguaScript.
//
// Turned on and off from the app (BubbleStartActivity). Started by
// plugins/withWordBubble.js.

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.SystemClock
import android.util.DisplayMetrics
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.Toast
import kotlin.math.abs

class BubbleService : Service() {

  companion object {
    const val ACTION_START = "ls.bubble.START"
    const val ACTION_STOP = "ls.bubble.STOP"
    const val ACTION_CAPTURE = "ls.bubble.CAPTURE"
    const val EXTRA_STYLE = "style"
    const val EXTRA_RESULT_CODE = "resultCode"
    const val EXTRA_RESULT_DATA = "resultData"
    private const val CHANNEL = "ls-bubble"
    private const val NOTIF_ID = 4471

    /** The running bubble, so the word card can tell it what happened. */
    var instance: BubbleService? = null
      private set
    fun isRunning() = instance != null
  }

  private val main = Handler(Looper.getMainLooper())
  private lateinit var wm: WindowManager
  private var bubble: View? = null
  private var bubbleParams: WindowManager.LayoutParams? = null
  private var overlay: WordOverlayView? = null
  private var hits: List<WordHit> = emptyList()
  private var busy = false
  private var style = "text"

  private val density get() = resources.displayMetrics.density
  private fun dp(v: Int) = (v * density).toInt()

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    instance = this
    wm = getSystemService(WINDOW_SERVICE) as WindowManager
    style = getSharedPreferences("ls-bubble", MODE_PRIVATE).getString("style", "text") ?: "text"
    goForeground(capturing = false)
    showBubble()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> { stopSelf(); return START_NOT_STICKY }
      ACTION_START -> {
        intent.getStringExtra(EXTRA_STYLE)?.let { style = it }
      }
      ACTION_CAPTURE -> {
        val code = intent.getIntExtra(EXTRA_RESULT_CODE, 0)
        @Suppress("DEPRECATION")
        val data: Intent? = if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(EXTRA_RESULT_DATA, Intent::class.java) else intent.getParcelableExtra(EXTRA_RESULT_DATA)
        if (data != null) capture(code, data) else { busy = false; bubble?.visibility = View.VISIBLE }
      }
    }
    return START_STICKY
  }

  override fun onDestroy() {
    closeOverlay()
    bubble?.let { runCatching { wm.removeView(it) } }
    bubble = null
    instance = null
    super.onDestroy()
  }

  // ── Foreground notification (Android requires one for a floating bubble) ──

  private fun goForeground(capturing: Boolean) {
    val nm = getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null) {
      nm.createNotificationChannel(NotificationChannel(CHANNEL, "LinguaScript bubble", NotificationManager.IMPORTANCE_MIN))
    }
    val stop = PendingIntent.getService(this, 1, Intent(this, BubbleService::class.java).setAction(ACTION_STOP), PendingIntent.FLAG_IMMUTABLE)
    val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CHANNEL) else @Suppress("DEPRECATION") Notification.Builder(this)
    val notification = builder
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle("🦎 Colour your words")
      .setContentText("Tap the bubble on any screen")
      .setOngoing(true)
      .addAction(Notification.Action.Builder(null, "Turn off", stop).build())
      .build()
    if (Build.VERSION.SDK_INT >= 34) {
      val type = if (capturing) ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE or ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
                 else ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
      startForeground(NOTIF_ID, notification, type)
    } else if (Build.VERSION.SDK_INT >= 29) {
      startForeground(NOTIF_ID, notification, if (capturing) ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION else 0)
    } else {
      startForeground(NOTIF_ID, notification)
    }
  }

  private fun overlayType() =
    if (Build.VERSION.SDK_INT >= 26) WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    else @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE

  // ── The bubble ──────────────────────────────────────────────────────────────

  @SuppressLint("ClickableViewAccessibility")
  private fun showBubble() {
    val size = dp(56)
    val view = FrameLayout(this).apply {
      background = GradientDrawable().apply {
        setColor(Color.parseColor("#08080B"))
        cornerRadius = size / 2f
        setStroke(dp(2), Color.parseColor("#34C759"))
      }
      elevation = dp(8).toFloat()
      contentDescription = "LinguaScript: colour my words"
      addView(ImageView(context).apply {
        setImageResource(applicationInfo.icon)
        scaleType = ImageView.ScaleType.CENTER_INSIDE
      }, FrameLayout.LayoutParams(dp(40), dp(40), Gravity.CENTER))
    }
    val params = WindowManager.LayoutParams(
      size, size, overlayType(),
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
      PixelFormat.TRANSLUCENT,
    ).apply {
      gravity = Gravity.TOP or Gravity.START
      val prefs = getSharedPreferences("ls-bubble", MODE_PRIVATE)
      x = prefs.getInt("x", resources.displayMetrics.widthPixels - size - dp(4))
      y = prefs.getInt("y", resources.displayMetrics.heightPixels / 2)
    }

    // Drag to move (snaps to the nearest edge), tap to colour, long-press to open the app.
    var downX = 0f; var downY = 0f; var startX = 0; var startY = 0; var downAt = 0L; var moved = false
    view.setOnTouchListener { _, e ->
      when (e.action) {
        MotionEvent.ACTION_DOWN -> {
          downX = e.rawX; downY = e.rawY; startX = params.x; startY = params.y
          downAt = SystemClock.uptimeMillis(); moved = false
        }
        MotionEvent.ACTION_MOVE -> {
          val dx = e.rawX - downX; val dy = e.rawY - downY
          if (abs(dx) > dp(6) || abs(dy) > dp(6)) moved = true
          if (moved) { params.x = startX + dx.toInt(); params.y = startY + dy.toInt(); runCatching { wm.updateViewLayout(view, params) } }
        }
        MotionEvent.ACTION_UP -> {
          if (moved) {
            val w = resources.displayMetrics.widthPixels
            params.x = if (params.x + size / 2 < w / 2) dp(4) else w - size - dp(4)
            runCatching { wm.updateViewLayout(view, params) }
            getSharedPreferences("ls-bubble", MODE_PRIVATE).edit().putInt("x", params.x).putInt("y", params.y).apply()
          } else if (SystemClock.uptimeMillis() - downAt > 600) {
            openApp()
          } else {
            onBubbleTap()
          }
        }
      }
      true
    }
    wm.addView(view, params)
    bubble = view
    bubbleParams = params
  }

  private fun onBubbleTap() {
    if (overlay != null) { closeOverlay(); return }
    if (busy) return
    DeckStore.load(this)
    if (!DeckStore.hasWords()) {
      Toast.makeText(this, "Open LinguaScript once so the bubble knows your words", Toast.LENGTH_LONG).show()
      return
    }
    if (!WordFinder.supports(DeckStore.language)) {
      Toast.makeText(this, "The bubble can't read this language yet", Toast.LENGTH_LONG).show()
      return
    }
    busy = true
    bubble?.visibility = View.GONE // keep the bubble out of the screenshot
    startActivity(Intent(this, BubbleStartActivity::class.java)
      .setAction(BubbleStartActivity.ACTION_CAPTURE)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
  }

  /** The consent screen was cancelled. */
  fun captureCancelled() {
    busy = false
    bubble?.visibility = View.VISIBLE
  }

  private fun openApp() {
    val launch = packageManager.getLaunchIntentForPackage(packageName) ?: return
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    startActivity(launch)
  }

  // ── One screenshot ──────────────────────────────────────────────────────────

  private fun screenSize(): Triple<Int, Int, Int> {
    val dpi = resources.displayMetrics.densityDpi
    if (Build.VERSION.SDK_INT >= 30) {
      val b = wm.currentWindowMetrics.bounds
      return Triple(b.width(), b.height(), dpi)
    }
    val m = DisplayMetrics()
    @Suppress("DEPRECATION") wm.defaultDisplay.getRealMetrics(m)
    return Triple(m.widthPixels, m.heightPixels, dpi)
  }

  private fun capture(resultCode: Int, data: Intent) {
    // Android 14+: the screen-capture type may only be claimed after consent.
    goForeground(capturing = true)
    val mpm = getSystemService(MediaProjectionManager::class.java)
    val projection: MediaProjection = try {
      mpm.getMediaProjection(resultCode, data) ?: return captureFailed()
    } catch (_: Exception) { return captureFailed() }

    val (w, h, dpi) = screenSize()
    val reader = ImageReader.newInstance(w, h, PixelFormat.RGBA_8888, 2)
    var display: VirtualDisplay? = null
    var done = false
    val startedAt = SystemClock.uptimeMillis()

    fun finish(bitmap: Bitmap?) {
      if (done) return
      done = true
      runCatching { display?.release() }
      runCatching { projection.stop() }
      runCatching { reader.close() }
      goForeground(capturing = false)
      bubble?.visibility = View.VISIBLE
      if (bitmap == null) { captureFailed(); return }
      WordFinder.find(bitmap) { found ->
        main.post {
          busy = false
          hits = found
          if (found.none { it.colour != null && it.colour != DeckStore.COMMON }) {
            Toast.makeText(this, "No LinguaScript words on this screen", Toast.LENGTH_SHORT).show()
          } else showOverlay()
        }
      }
    }

    projection.registerCallback(object : MediaProjection.Callback() {
      override fun onStop() { main.post { finish(null) } }
    }, main)

    reader.setOnImageAvailableListener({ r ->
      val image = runCatching { r.acquireLatestImage() }.getOrNull() ?: return@setOnImageAvailableListener
      // Skip the first frames: the consent dialog may still be fading out.
      if (SystemClock.uptimeMillis() - startedAt < 350) { image.close(); return@setOnImageAvailableListener }
      val plane = image.planes[0]
      val rowPadding = plane.rowStride - plane.pixelStride * w
      val full = Bitmap.createBitmap(w + rowPadding / plane.pixelStride, h, Bitmap.Config.ARGB_8888)
      full.copyPixelsFromBuffer(plane.buffer)
      image.close()
      val bmp = if (full.width != w) Bitmap.createBitmap(full, 0, 0, w, h) else full
      finish(bmp)
    }, main)

    main.postDelayed({
      display = runCatching {
        projection.createVirtualDisplay("ls-capture", w, h, dpi, DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR, reader.surface, null, main)
      }.getOrNull()
      if (display == null) finish(null)
    }, 250)
    main.postDelayed({ finish(null) }, 4000) // never hang
  }

  private fun captureFailed() {
    busy = false
    goForeground(capturing = false)
    bubble?.visibility = View.VISIBLE
    Toast.makeText(this, "Couldn't read this screen", Toast.LENGTH_SHORT).show()
  }

  // ── The coloured words ──────────────────────────────────────────────────────

  private fun showOverlay() {
    closeOverlay()
    val view = WordOverlayView(this, hits, style, ::onWordTap, ::closeOverlay)
    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT, overlayType(),
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
      PixelFormat.TRANSLUCENT,
    ).apply {
      gravity = Gravity.TOP or Gravity.START
      x = 0; y = 0
      if (Build.VERSION.SDK_INT >= 30) layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
      else if (Build.VERSION.SDK_INT >= 28) layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
    }
    wm.addView(view, params)
    overlay = view
    // Keep the bubble on top so it can close colour mode.
    bubble?.let { b -> bubbleParams?.let { p -> runCatching { wm.removeView(b); wm.addView(b, p) } } }
  }

  private fun closeOverlay() {
    overlay?.let { runCatching { wm.removeView(it) } }
    overlay = null
  }

  private fun onWordTap(hit: WordHit) {
    // The card is an activity, which would sit UNDER the overlay — hide it meanwhile.
    overlay?.visibility = View.GONE
    CardEvents.onClosed = { saved -> onCardClosed(saved) }
    startActivity(Intent(this, ProcessTextActivity::class.java)
      .putExtra(Intent.EXTRA_PROCESS_TEXT, hit.text)
      .putExtra(ProcessTextActivity.EXTRA_CONTEXT, hit.context)
      .putExtra(ProcessTextActivity.EXTRA_LANGUAGE, DeckStore.language)
      .putExtra(ProcessTextActivity.EXTRA_STATE, hit.colour?.takeIf { it != DeckStore.COMMON } ?: "")
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
  }

  /** Called by the word card when it closes; `saved` = the word it saved, if any. */
  fun onCardClosed(saved: String?) {
    main.post {
      if (saved != null) {
        DeckStore.markSaved(saved)
        hits.filter { DeckStore.key(it.text) == DeckStore.key(saved) && (it.colour == null || it.colour == DeckStore.COMMON) }.forEach { it.colour = DeckStore.RED }
        showOverlay()
      } else {
        overlay?.visibility = View.VISIBLE
      }
    }
  }

  fun setStyle(s: String) {
    style = s
    if (overlay != null) showOverlay()
  }
}
