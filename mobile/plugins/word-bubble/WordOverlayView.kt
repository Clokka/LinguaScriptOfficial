package __PACKAGE__

// Draws the learner's words over any app, in one of two styles:
//   "text" — the word is covered with its own background and drawn again in
//            its deck colour, system font, same size and weight; gold glimmers.
//            Busy backgrounds (photos, gradients) fall back to a ring.
//   "ring" — deck words coloured as above, PLUS a gold ring around common
//            words not yet in a deck (same idea as the onboarding rings).
// Tap a word → its card (meaning + Save). Tap anywhere else → close.

import android.animation.ValueAnimator
import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.view.MotionEvent
import android.view.View
import android.view.animation.LinearInterpolator

@SuppressLint("ViewConstructor")
class WordOverlayView(
  context: Context,
  private val hits: List<WordHit>,
  private val style: String,
  private val onWordTap: (WordHit) -> Unit,
  private val onDismiss: () -> Unit,
) : View(context) {

  private val density = resources.displayMetrics.density
  private fun dp(v: Float) = v * density

  // Brand colours (src/lib/deck-colors.ts) and deeper shades for light backgrounds.
  private val brand = mapOf(
    DeckStore.RED to Color.parseColor("#FF3B30"), DeckStore.ORANGE to Color.parseColor("#FF8A00"),
    DeckStore.GREEN to Color.parseColor("#34C759"), DeckStore.GOLD to Color.parseColor("#FFD54A"),
  )
  private val deep = mapOf(
    DeckStore.RED to Color.parseColor("#D92B21"), DeckStore.ORANGE to Color.parseColor("#C05F00"),
    DeckStore.GREEN to Color.parseColor("#34C759"), DeckStore.GOLD to Color.parseColor("#B07A00"),
  )

  private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
  private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = dp(2f) }
  private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.SUBPIXEL_TEXT_FLAG)
  private val pillPaint = Paint(Paint.ANTI_ALIAS_FLAG)
  private val shaderMatrix = Matrix()
  private val bounds = Rect()

  /** 0..1, drives the gold glimmer and the gold ring's pulse. */
  private var phase = 0f
  // "text": deck words recoloured. "ring": deck words recoloured too, plus a
  // gold ring around common words not yet in a deck (worth tapping to save).
  private val coloured = hits.filter { it.colour != null && (style == "ring" || it.colour != DeckStore.COMMON) }
  private val hasGold = coloured.any { it.colour == DeckStore.GOLD }
  private val animator = ValueAnimator.ofFloat(0f, 1f).apply {
    duration = 2200
    repeatCount = ValueAnimator.INFINITE
    interpolator = LinearInterpolator()
    addUpdateListener { phase = it.animatedValue as Float; invalidate() }
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    if (hasGold) animator.start()
  }

  override fun onDetachedFromWindow() {
    animator.cancel()
    super.onDetachedFromWindow()
  }

  override fun onDraw(canvas: Canvas) {
    for (h in coloured) {
      if (h.colour == DeckStore.COMMON || h.busy) drawRing(canvas, h) else drawText(canvas, h)
    }
    drawPill(canvas)
  }

  private fun colourFor(h: WordHit): Int {
    val c = if (h.colour == DeckStore.COMMON) DeckStore.GOLD else h.colour ?: DeckStore.RED
    return (if (h.light) deep[c] else brand[c]) ?: Color.RED
  }

  // Cover the word with its own background, then draw it again in colour,
  // sized so its ink fills exactly the box the text reader found.
  private fun drawText(canvas: Canvas, h: WordHit) {
    val r = h.rect
    fill.shader = null
    fill.color = h.bg
    val patch = RectF(r).apply { inset(-dp(1.5f), -dp(1.5f)) }
    canvas.drawRoundRect(patch, dp(3f), dp(3f), fill)

    textPaint.typeface = Typeface.create(Typeface.DEFAULT, if (h.bold) Typeface.BOLD else Typeface.NORMAL)
    textPaint.textSize = r.height().toFloat()
    textPaint.getTextBounds(h.text, 0, h.text.length, bounds)
    if (bounds.width() > 0) textPaint.textSize *= r.width().toFloat() / bounds.width()
    // Keep a sensible height if the width fit went wild (very short words).
    val maxSize = r.height() * 1.45f
    if (textPaint.textSize > maxSize) textPaint.textSize = maxSize
    textPaint.getTextBounds(h.text, 0, h.text.length, bounds)
    val x = r.left - bounds.left + (r.width() - bounds.width()) / 2f
    val y = r.bottom - bounds.bottom.toFloat()

    if (h.colour == DeckStore.GOLD) {
      val base = colourFor(h)
      val shine = if (h.light) Color.parseColor("#FFE27A") else Color.parseColor("#FFF6C8")
      val w = r.width().toFloat().coerceAtLeast(1f)
      textPaint.shader = LinearGradient(0f, 0f, w, 0f, intArrayOf(base, base, shine, base, base), floatArrayOf(0f, 0.35f, 0.5f, 0.65f, 1f), Shader.TileMode.CLAMP)
      shaderMatrix.setTranslate(r.left - w + phase * 3f * w, 0f)
      textPaint.shader.setLocalMatrix(shaderMatrix)
      textPaint.setShadowLayer(dp(5f) * (0.6f + 0.4f * pulse()), 0f, 0f, Color.argb(150, 255, 200, 60))
    } else {
      textPaint.shader = null
      textPaint.color = colourFor(h)
      textPaint.clearShadowLayer()
    }
    canvas.drawText(h.text, x, y, textPaint)
  }

  private fun drawRing(canvas: Canvas, h: WordHit) {
    val box = RectF(h.rect).apply { inset(-dp(4f), -dp(3f)) }
    val radius = dp(10f)
    stroke.color = if (h.colour == DeckStore.COMMON) brand[DeckStore.GOLD]!! else if (h.busy) brand[h.colour] ?: Color.RED else colourFor(h)
    if (h.colour == DeckStore.GOLD) {
      stroke.setShadowLayer(dp(4f) + dp(8f) * pulse(), 0f, 0f, Color.argb(170, 255, 200, 60))
    } else {
      stroke.clearShadowLayer()
    }
    canvas.drawRoundRect(box, radius, radius, stroke)
  }

  /** 0..1..0 over one cycle. */
  private fun pulse() = if (phase < 0.5f) phase * 2f else (1f - phase) * 2f

  // "● ● ● ●  8 words · tap one" at the top.
  private fun drawPill(canvas: Canvas) {
    val label = "${coloured.size} word${if (coloured.size == 1) "" else "s"} · tap one"
    pillPaint.textSize = dp(13f)
    pillPaint.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    val tw = pillPaint.measureText(label)
    val w = dp(12f) + 4 * dp(13f) + dp(6f) + tw + dp(14f)
    val h = dp(34f)
    val left = (width - w) / 2f
    val top = dp(52f)
    pillPaint.shader = null
    pillPaint.color = Color.parseColor("#EB08080B")
    canvas.drawRoundRect(RectF(left, top, left + w, top + h), h / 2, h / 2, pillPaint)
    var cx = left + dp(12f) + dp(4.5f)
    for (c in listOf(DeckStore.RED, DeckStore.ORANGE, DeckStore.GREEN, DeckStore.GOLD)) {
      pillPaint.color = brand[c] ?: Color.WHITE
      canvas.drawCircle(cx, top + h / 2, dp(4.5f), pillPaint)
      cx += dp(13f)
    }
    pillPaint.color = Color.parseColor("#F5F5F7")
    canvas.drawText(label, cx + dp(2f), top + h / 2 + dp(4.5f), pillPaint)
  }

  @SuppressLint("ClickableViewAccessibility")
  override fun onTouchEvent(event: MotionEvent): Boolean {
    if (event.action != MotionEvent.ACTION_UP) return true
    val x = event.x.toInt(); val y = event.y.toInt()
    val slop = dp(8f).toInt()
    val hit = hits.firstOrNull { Rect(it.rect).apply { inset(-slop, -slop) }.contains(x, y) }
    if (hit != null) onWordTap(hit) else onDismiss()
    return true
  }
}
