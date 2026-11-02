package __PACKAGE__

// Tap a subtitle word in the YouTube app. No 🦎, no button: just tap the word.
//
// How it works:
//   1. Android needs ONE "start sharing your screen?" yes per session. Every app
//      that reads other apps' screens has to ask, and there is no way round it
//      without the Accessibility permission, which Google rejects for us. We ask
//      by ourselves the first time a video plays, then keep that permission
//      alive (no question on every tap) until Android or the learner stops it.
//   2. While something is playing, about twice a second we look at the screen
//      on the phone (nothing is uploaded) and find the VIDEO: the part of the
//      screen that keeps moving.
//   3. Inside the video we read the text (ML Kit). Subtitle lines are the
//      centred text in the lower part of the video. We put an INVISIBLE tap
//      area exactly over those lines. Everywhere else, taps go to YouTube.
//   4. Tap a word → the video pauses → the word card (meaning + Save) opens →
//      close it → the video plays again.
//
// Turned on/off from the website switch (PhoneBubbleSetting) through
// linguascriptbubble://subtitles?on=1|0 (BubbleStartActivity).

import android.annotation.SuppressLint
import android.app.KeyguardManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.Rect
import android.graphics.RectF
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.AudioManager
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.util.DisplayMetrics
import android.view.Gravity
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.Toast
import kotlin.math.abs

class SubtitleTapService : Service() {

  companion object {
    const val ACTION_START = "ls.subtitles.START"
    const val ACTION_STOP = "ls.subtitles.STOP"
    const val ACTION_CAPTURE = "ls.subtitles.CAPTURE"
    const val EXTRA_RESULT_CODE = "resultCode"
    const val EXTRA_RESULT_DATA = "resultData"
    private const val CHANNEL = "ls-subtitles"
    private const val NOTIF_ID = 4472

    private const val TICK_MS = 550L
    /** Keep looking this long after the sound stops (a paused video still shows its subtitle). */
    private const val AFTER_SOUND_MS = 60_000L
    /** The video area is remembered this long after it stops moving (paused video). */
    private const val ZONE_KEEP_MS = 30_000L
    private const val GRID_X = 24
    private const val GRID_Y = 48

    var instance: SubtitleTapService? = null
      private set
    fun isRunning() = instance != null

    fun prefs(c: Context) = c.getSharedPreferences("ls-bubble", Context.MODE_PRIVATE)
    fun isOn(c: Context) = prefs(c).getBoolean("subtitles_on", false)
  }

  private val main = Handler(Looper.getMainLooper())
  private lateinit var wm: WindowManager
  private lateinit var audio: AudioManager

  // Screen capture, kept alive between taps.
  private var projection: MediaProjection? = null
  private var reader: ImageReader? = null
  private var display: VirtualDisplay? = null
  private var capW = 0
  private var capH = 0
  private var attached = false
  private var lastFrame: Bitmap? = null

  // Asking for permission: at most once each time the screen turns on.
  private var askedThisScreenOn = false
  private var asking = false

  // Finding the video: which grid cells keep changing.
  private var prevGrid: IntArray? = null
  private var history = IntArray(GRID_X * GRID_Y)
  private var zone: Rect? = null
  private var zoneSeenAt = 0L
  private var soundAt = 0L

  // The subtitle words and the invisible tap area over them.
  private var words: List<WordHit> = emptyList()
  private var targetView: TapTargetView? = null
  private var targetParams: WindowManager.LayoutParams? = null
  private var targetRect: Rect? = null
  /** Some phones place overlay windows a little off (status bar, notch): learned once, then corrected. */
  private var offX = 0
  private var offY = 0
  private var reading = false
  private var cardOpen = false
  private var pausedByUs = false

  private val tick = object : Runnable {
    override fun run() {
      runCatching { step() }
      main.postDelayed(this, TICK_MS)
    }
  }

  private val screenReceiver = object : BroadcastReceiver() {
    override fun onReceive(c: Context, i: Intent) {
      when (i.action) {
        Intent.ACTION_SCREEN_OFF -> { detach(); removeTarget() }
        Intent.ACTION_USER_PRESENT, Intent.ACTION_SCREEN_ON -> askedThisScreenOn = false
      }
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    instance = this
    wm = getSystemService(WINDOW_SERVICE) as WindowManager
    audio = getSystemService(AUDIO_SERVICE) as AudioManager
    goForeground(capturing = false)
    val f = IntentFilter().apply {
      addAction(Intent.ACTION_SCREEN_OFF); addAction(Intent.ACTION_SCREEN_ON); addAction(Intent.ACTION_USER_PRESENT)
    }
    if (Build.VERSION.SDK_INT >= 33) registerReceiver(screenReceiver, f, Context.RECEIVER_NOT_EXPORTED)
    else registerReceiver(screenReceiver, f)
    main.post(tick)
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> {
        prefs(this).edit().putBoolean("subtitles_on", false).apply()
        stopSelf(); return START_NOT_STICKY
      }
      ACTION_CAPTURE -> {
        asking = false
        val code = intent.getIntExtra(EXTRA_RESULT_CODE, 0)
        @Suppress("DEPRECATION")
        val data: Intent? = if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(EXTRA_RESULT_DATA, Intent::class.java) else intent.getParcelableExtra(EXTRA_RESULT_DATA)
        if (data != null) startCapture(code, data)
      }
    }
    return START_STICKY
  }

  override fun onDestroy() {
    main.removeCallbacks(tick)
    runCatching { unregisterReceiver(screenReceiver) }
    instance = null // first, so stopCapture doesn't refresh the notification
    removeTarget()
    stopCapture()
    super.onDestroy()
  }

  /** The permission screen was closed without a yes. */
  fun captureCancelled() { asking = false }

  // ── Foreground notification (Android requires one) ──────────────────────────

  private fun goForeground(capturing: Boolean) {
    val nm = getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null) {
      nm.createNotificationChannel(NotificationChannel(CHANNEL, "LinguaScript subtitles", NotificationManager.IMPORTANCE_MIN))
    }
    val stop = PendingIntent.getService(this, 2, Intent(this, SubtitleTapService::class.java).setAction(ACTION_STOP), PendingIntent.FLAG_IMMUTABLE)
    val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CHANNEL) else @Suppress("DEPRECATION") Notification.Builder(this)
    val notification = builder
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle("🦎 Tap any subtitle word")
      .setContentText(if (capturing) "Reading subtitles on this phone only — nothing is uploaded" else "Play a video with subtitles on")
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

  // ── The loop ────────────────────────────────────────────────────────────────

  private fun step() {
    val now = SystemClock.uptimeMillis()
    val power = getSystemService(POWER_SERVICE) as PowerManager
    if (!power.isInteractive) { detach(); removeTarget(); return }
    if (audio.isMusicActive) soundAt = now
    val watching = soundAt > 0 && now - soundAt < AFTER_SOUND_MS

    if (projection == null) {
      removeTarget()
      // A video started and we can't see the screen yet: ask (once per screen-on).
      if (audio.isMusicActive && !askedThisScreenOn && !asking && !locked()) askForCapture()
      return
    }
    if (!watching) { detach(); removeTarget(); zone = null; prevGrid = null; return }
    attach()
    if (cardOpen || reading) return

    val frame = grabFrame() ?: return
    updateZone(frame, now)
    val z = zone
    if (z == null || now - zoneSeenAt > ZONE_KEEP_MS) { removeTarget(); return }
    reading = true
    readSubtitles(frame, z) { found ->
      reading = false
      if (cardOpen) return@readSubtitles
      words = found
      if (found.isEmpty()) removeTarget() else placeTarget(found)
    }
  }

  private fun locked() = (getSystemService(KEYGUARD_SERVICE) as KeyguardManager).isKeyguardLocked

  private fun askForCapture() {
    DeckStore.load(this)
    if (DeckStore.language.isEmpty() || !WordFinder.supports(DeckStore.language)) return
    askedThisScreenOn = true
    asking = true
    // "Display over other apps" lets us open this from the background.
    startActivity(Intent(this, BubbleStartActivity::class.java)
      .setAction(BubbleStartActivity.ACTION_SUBTITLE_CAPTURE)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
  }

  // ── Screen capture (kept alive) ─────────────────────────────────────────────

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

  private fun startCapture(resultCode: Int, data: Intent) {
    projection?.let { old -> projection = null; runCatching { old.stop() } }
    stopCapture()
    // Android 14+: the screen-capture type may only be claimed after the yes.
    goForeground(capturing = true)
    val mpm = getSystemService(MediaProjectionManager::class.java)
    val p = try { mpm.getMediaProjection(resultCode, data) } catch (_: Exception) { null }
    if (p == null) { goForeground(capturing = false); return }
    projection = p
    p.registerCallback(object : MediaProjection.Callback() {
      // Android (or the learner, from the status bar) stopped sharing.
      // (Only if it's still the current one: replacing an old one also "stops" it.)
      override fun onStop() { main.post { if (projection === p) stopCapture() } }
      // The screen turned (YouTube full screen): follow the new size.
      override fun onCapturedContentResize(width: Int, height: Int) { main.post { resize() } }
    }, main)
    val (w, h, dpi) = screenSize()
    capW = w; capH = h
    val r = ImageReader.newInstance(w, h, PixelFormat.RGBA_8888, 3)
    reader = r
    display = runCatching {
      p.createVirtualDisplay("ls-subtitles", w, h, dpi, DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR, r.surface, null, main)
    }.getOrNull()
    if (display == null) { stopCapture(); return }
    attached = true
    if (!prefs(this).getBoolean("subtitles_hint", false)) {
      prefs(this).edit().putBoolean("subtitles_hint", true).apply()
      Toast.makeText(this, "Tap any subtitle word for its meaning", Toast.LENGTH_LONG).show()
    }
  }

  private fun stopCapture() {
    runCatching { display?.release() }
    runCatching { projection?.stop() }
    runCatching { reader?.close() }
    display = null; projection = null; reader = null; attached = false
    lastFrame = null; prevGrid = null; zone = null
    removeTarget()
    if (instance != null) goForeground(capturing = false)
  }

  /** Rotation: new reader at the new size; the same virtual display, resized. */
  private fun resize() {
    val d = display ?: return
    val (w, h, dpi) = screenSize()
    if (w == capW && h == capH) return
    capW = w; capH = h
    val old = reader
    val r = ImageReader.newInstance(w, h, PixelFormat.RGBA_8888, 3)
    reader = r
    runCatching { d.resize(w, h, dpi) }
    runCatching { d.surface = if (attached) r.surface else null }
    runCatching { old?.close() }
    lastFrame = null; prevGrid = null; zone = null
    history = IntArray(GRID_X * GRID_Y)
    removeTarget()
  }

  /** Only draw into our reader while a video might be on (saves battery). */
  private fun attach() {
    if (attached) return
    val r = reader ?: return
    runCatching { display?.surface = r.surface }
    attached = true
  }

  private fun detach() {
    if (!attached) return
    runCatching { display?.surface = null }
    attached = false
  }

  /** The newest frame, or the last one if the screen hasn't changed. */
  private fun grabFrame(): Bitmap? {
    if (screenSize().let { it.first != capW || it.second != capH }) { resize(); return null }
    val r = reader ?: return null
    val image = runCatching { r.acquireLatestImage() }.getOrNull() ?: return lastFrame
    return try {
      val plane = image.planes[0]
      val w = image.width; val h = image.height
      val rowPadding = plane.rowStride - plane.pixelStride * w
      val full = Bitmap.createBitmap(w + rowPadding / plane.pixelStride, h, Bitmap.Config.ARGB_8888)
      full.copyPixelsFromBuffer(plane.buffer)
      val bmp = if (full.width != w) Bitmap.createBitmap(full, 0, 0, w, h) else full
      lastFrame = bmp
      bmp
    } catch (_: Exception) {
      lastFrame
    } finally {
      image.close()
    }
  }

  // ── Finding the video (the part of the screen that keeps moving) ────────────

  private fun updateZone(b: Bitmap, now: Long) {
    val grid = IntArray(GRID_X * GRID_Y)
    val cw = b.width / GRID_X; val ch = b.height / GRID_Y
    if (cw < 2 || ch < 2) return
    for (gy in 0 until GRID_Y) for (gx in 0 until GRID_X) {
      // 4 pixels per cell is enough to see movement.
      var sum = 0
      for ((fx, fy) in arrayOf(1 to 1, 3 to 1, 1 to 3, 3 to 3)) {
        val p = b.getPixel(gx * cw + cw * fx / 4, gy * ch + ch * fy / 4)
        sum += (Color.red(p) * 3 + Color.green(p) * 6 + Color.blue(p)) / 10
      }
      grid[gy * GRID_X + gx] = sum / 4
    }
    val prev = prevGrid
    prevGrid = grid
    if (prev == null) return
    // Each cell remembers whether it changed in each of the last 8 looks.
    for (i in grid.indices) {
      val changed = abs(grid[i] - prev[i]) > 10
      history[i] = ((history[i] shl 1) or (if (changed) 1 else 0)) and 0xFF
    }
    // Video cells moved in at least 3 of the last 8 looks (a scrolling page doesn't keep doing that).
    var minX = GRID_X; var minY = GRID_Y; var maxX = -1; var maxY = -1; var count = 0
    for (gy in 0 until GRID_Y) for (gx in 0 until GRID_X) {
      if (Integer.bitCount(history[gy * GRID_X + gx]) >= 3) {
        count++
        if (gx < minX) minX = gx; if (gx > maxX) maxX = gx
        if (gy < minY) minY = gy; if (gy > maxY) maxY = gy
      }
    }
    if (count == 0) return // nothing moving right now: keep the last video area (paused)
    val area = (maxX - minX + 1) * (maxY - minY + 1)
    val bigEnough = area >= GRID_X * GRID_Y / 25 // ≥ 4 % of the screen
    val solid = count >= area * 0.35            // a rectangle, not scattered specks
    if (!bigEnough || !solid) return
    zone = Rect(minX * cw, minY * ch, (maxX + 1) * cw, (maxY + 1) * ch)
    zoneSeenAt = now
  }

  // ── Reading the subtitle lines inside the video ─────────────────────────────

  private fun readSubtitles(frame: Bitmap, z: Rect, onDone: (List<WordHit>) -> Unit) {
    val clip = Rect(z).apply { intersect(0, 0, frame.width, frame.height) }
    if (clip.width() < 40 || clip.height() < 40) { onDone(emptyList()); return }
    val crop = runCatching { Bitmap.createBitmap(frame, clip.left, clip.top, clip.width(), clip.height()) }.getOrNull()
    if (crop == null) { onDone(emptyList()); return }
    DeckStore.load(this)
    WordFinder.find(crop) { hits ->
      hits.forEach { it.rect.offset(clip.left, clip.top) }
      main.post { onDone(subtitleWords(hits, clip)) }
    }
  }

  /** Keep only words in subtitle-looking lines: centred, in the lower part of the video, with letters. */
  private fun subtitleWords(hits: List<WordHit>, z: Rect): List<WordHit> {
    val lines = LinkedHashMap<String, MutableList<WordHit>>()
    for (h in hits) {
      // Same line text + about the same height on screen = one line.
      val key = h.context + "@" + (h.rect.centerY() / maxOf(1, h.rect.height()))
      lines.getOrPut(key) { ArrayList() }.add(h)
    }
    val out = ArrayList<WordHit>()
    for (line in lines.values) {
      val r = Rect(line[0].rect)
      line.forEach { r.union(it.rect) }
      val centred = abs(r.centerX() - z.centerX()) < z.width() * 0.14
      val lower = r.centerY() > z.top + z.height() * 0.35
      val hasLetters = line.any { w -> w.text.any { it.isLetter() } }
      val notTime = !Regex("^\\d{1,2}:\\d{2}").containsMatchIn(line[0].context.trim())
      if (centred && lower && hasLetters && notTime) out.addAll(line)
    }
    return out
  }

  // ── The invisible tap area over the subtitle words ──────────────────────────

  private fun overlayType() =
    if (Build.VERSION.SDK_INT >= 26) WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    else @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE

  private fun placeTarget(found: List<WordHit>) {
    val pad = (8 * resources.displayMetrics.density).toInt()
    val r = Rect(found[0].rect)
    found.forEach { r.union(it.rect) }
    r.inset(-pad, -pad)
    targetRect = r
    val view = targetView
    val params = targetParams
    if (view == null || params == null) {
      val v = TapTargetView(this)
      val p = WindowManager.LayoutParams(
        r.width(), r.height(), overlayType(),
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
          WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
        PixelFormat.TRANSLUCENT,
      ).apply {
        gravity = Gravity.TOP or Gravity.START
        x = r.left + offX; y = r.top + offY
        if (Build.VERSION.SDK_INT >= 28) layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
        if (Build.VERSION.SDK_INT >= 30) layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
      }
      if (runCatching { wm.addView(v, p) }.isFailure) return
      targetView = v; targetParams = p
      v.post { correctPosition() }
    } else {
      params.width = r.width(); params.height = r.height()
      params.x = r.left + offX; params.y = r.top + offY
      runCatching { wm.updateViewLayout(view, params) }
    }
  }

  /** Where did the window really land? Move it so it sits exactly over the words. */
  private fun correctPosition() {
    val v = targetView ?: return
    val p = targetParams ?: return
    val r = targetRect ?: return
    val loc = IntArray(2); v.getLocationOnScreen(loc)
    val dx = r.left - loc[0]; val dy = r.top - loc[1]
    if (dx == 0 && dy == 0) return
    offX += dx; offY += dy
    p.x = r.left + offX; p.y = r.top + offY
    runCatching { wm.updateViewLayout(v, p) }
  }

  private fun removeTarget() {
    targetView?.let { runCatching { wm.removeView(it) } }
    targetView = null; targetParams = null; targetRect = null
  }

  /** A tap at screen position (x, y) inside the subtitle area. */
  private fun onTap(x: Int, y: Int) {
    if (cardOpen) return
    // 1. Pause, so the line stays on screen.
    pausedByUs = audio.isMusicActive
    if (pausedByUs) mediaKey(KeyEvent.KEYCODE_MEDIA_PAUSE)
    // 2. Which word? Read the newest frame again (the line may have just changed).
    val frame = grabFrame()
    val z = zone
    if (frame != null && z != null && !reading) {
      reading = true
      readSubtitles(frame, z) { fresh ->
        reading = false
        val hit = wordAt(fresh, x, y) ?: wordAt(words, x, y)
        if (fresh.isNotEmpty()) { words = fresh; placeTarget(fresh) }
        openCard(hit)
      }
    } else {
      openCard(wordAt(words, x, y))
    }
  }

  private fun wordAt(list: List<WordHit>, x: Int, y: Int): WordHit? {
    val slack = (6 * resources.displayMetrics.density).toInt()
    list.firstOrNull { Rect(it.rect).apply { inset(-slack, -slack) }.contains(x, y) }?.let { return it }
    // Between two words: the nearest one on the same line.
    return list.filter { y in (it.rect.top - slack)..(it.rect.bottom + slack) }
      .minByOrNull { abs(it.rect.centerX() - x) }
  }

  private fun openCard(hit: WordHit?) {
    if (hit == null) { resume(); return }
    cardOpen = true
    targetView?.flash(hit.rect)
    CardEvents.onClosed = { saved -> main.post { onCardClosed(saved) } }
    // Show the ring for a moment, then take the tap area away so it can't sit on top of the card.
    main.postDelayed({
      removeTarget()
      startActivity(Intent(this, ProcessTextActivity::class.java)
        .putExtra(Intent.EXTRA_PROCESS_TEXT, hit.text)
        .putExtra(ProcessTextActivity.EXTRA_CONTEXT, hit.context)
        .putExtra(ProcessTextActivity.EXTRA_LANGUAGE, DeckStore.language)
        .putExtra(ProcessTextActivity.EXTRA_STATE, hit.colour?.takeIf { it != DeckStore.COMMON } ?: "")
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }, 250)
  }

  private fun onCardClosed(saved: String?) {
    cardOpen = false
    if (saved != null) DeckStore.markSaved(saved)
    resume()
  }

  private fun resume() {
    if (pausedByUs) mediaKey(KeyEvent.KEYCODE_MEDIA_PLAY)
    pausedByUs = false
  }

  /** Play/pause whatever is playing. Needs no permission. */
  private fun mediaKey(code: Int) {
    val t = SystemClock.uptimeMillis()
    runCatching {
      audio.dispatchMediaKeyEvent(KeyEvent(t, t, KeyEvent.ACTION_DOWN, code, 0))
      audio.dispatchMediaKeyEvent(KeyEvent(t, t, KeyEvent.ACTION_UP, code, 0))
    }
  }

  /** Invisible over the subtitle; a quick green ring shows which word you tapped. */
  @SuppressLint("ViewConstructor")
  private inner class TapTargetView(c: Context) : View(c) {
    private val ring = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      style = Paint.Style.STROKE; strokeWidth = 3 * resources.displayMetrics.density; color = Color.parseColor("#34C759")
    }
    private var flashRect: RectF? = null
    private var downX = 0f; private var downY = 0f; private var downAt = 0L

    fun flash(screen: Rect) {
      val loc = IntArray(2); getLocationOnScreen(loc)
      val pad = 4 * resources.displayMetrics.density
      flashRect = RectF(screen.left - loc[0] - pad, screen.top - loc[1] - pad, screen.right - loc[0] + pad, screen.bottom - loc[1] + pad)
      invalidate()
      postDelayed({ flashRect = null; invalidate() }, 900)
    }

    override fun onDraw(canvas: Canvas) {
      flashRect?.let { canvas.drawRoundRect(it, it.height() / 2, it.height() / 2, ring) }
    }

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(e: MotionEvent): Boolean {
      when (e.actionMasked) {
        MotionEvent.ACTION_DOWN -> { downX = e.rawX; downY = e.rawY; downAt = SystemClock.uptimeMillis() }
        MotionEvent.ACTION_UP -> {
          val still = abs(e.rawX - downX) < 24 && abs(e.rawY - downY) < 24
          if (still && SystemClock.uptimeMillis() - downAt < 600) onTap(e.rawX.toInt(), e.rawY.toInt())
        }
      }
      return true
    }
  }
}
