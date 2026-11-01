package __PACKAGE__

// ✨ One GOLD word on the lock screen. Gold = a green word whose review is due
// (DeckStore, same rule as isDueGold()). They're words the learner already
// knows, so seeing one is a quick "I knew that!" — never a brand-new red word.
//
// A quiet notification (no sound, no buzz) that shows on the lock screen:
//   "✨ maison — do you remember it?"   [Show meaning]
//   tap Show meaning → "maison = house" [Next ✨]
//   tap the card → your flashcards
// An hourly alarm picks the next gold word (or clears the card when none are
// due) and refreshes the home-screen widget. On/off: linguascriptbubble://gold?on=1|0.

import android.Manifest
import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.SystemClock

object GoldWords {
  private const val CHANNEL = "ls-gold-lock"
  private const val OLD_CHANNEL = "ls-gold"
  private const val NOTIFICATION_ID = 7301
  const val ACTION_TICK = "ls.gold.TICK"
  const val ACTION_SHOW = "ls.gold.SHOW"
  const val ACTION_NEXT = "ls.gold.NEXT"

  private fun prefs(c: Context) = c.getSharedPreferences("ls-gold", Context.MODE_PRIVATE)
  fun isOn(c: Context) = prefs(c).getBoolean("on", false)

  fun setOn(c: Context, on: Boolean) {
    prefs(c).edit().putBoolean("on", on).apply()
    val am = c.getSystemService(AlarmManager::class.java)
    val tick = tickIntent(c)
    if (on) {
      am.setInexactRepeating(AlarmManager.ELAPSED_REALTIME, SystemClock.elapsedRealtime() + AlarmManager.INTERVAL_HOUR, AlarmManager.INTERVAL_HOUR, tick)
      show(c, reveal = false, advance = false)
    } else {
      am.cancel(tick)
      c.getSystemService(NotificationManager::class.java).cancel(NOTIFICATION_ID)
    }
  }

  private fun tickIntent(c: Context) = PendingIntent.getBroadcast(
    c, 0, Intent(c, GoldWordReceiver::class.java).setAction(ACTION_TICK),
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
  )

  private fun action(c: Context, a: String, req: Int) = PendingIntent.getBroadcast(
    c, req, Intent(c, GoldWordReceiver::class.java).setAction(a),
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
  )

  /** Opens a page of the site inside the app (app/index.tsx: linguascript://open/…). */
  fun openPage(c: Context, page: String, req: Int): PendingIntent {
    val i = Intent(Intent.ACTION_VIEW, Uri.parse("linguascript://open/$page")).setPackage(c.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return PendingIntent.getActivity(c, req, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  /** Show the current gold word (optionally its meaning, or move to the next one). */
  fun show(c: Context, reveal: Boolean, advance: Boolean) {
    if (!isOn(c)) return
    val nm = c.getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= 33 && c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
    DeckStore.load(c)
    val gold = DeckStore.withMeaning(DeckStore.GOLD)
    if (gold.isEmpty()) { nm.cancel(NOTIFICATION_ID); return }

    val p = prefs(c)
    var index = p.getInt("index", 0)
    if (advance) index++
    index = Math.floorMod(index, gold.size)
    p.edit().putInt("index", index).apply()
    val (word, meaning) = gold[index]

    if (Build.VERSION.SDK_INT >= 26) {
      // IMPORTANCE_LOW counts as a "silent" notification, and Samsung (and most
      // phones) hide silent notifications from the lock screen. So: a DEFAULT
      // channel with the sound and buzz switched off — still quiet, but shown.
      // Channel importance can't change once made, hence the new id.
      nm.deleteNotificationChannel(OLD_CHANNEL)
      nm.createNotificationChannel(NotificationChannel(CHANNEL, "Gold word on lock screen", NotificationManager.IMPORTANCE_DEFAULT).apply {
        description = "One review word you already know, on your lock screen"
        setShowBadge(false)
        setSound(null, null)
        enableVibration(false)
        enableLights(false)
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      })
    }
    @Suppress("DEPRECATION")
    val b = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(c, CHANNEL) else Notification.Builder(c)
    b.setSmallIcon(R.drawable.ls_tile)
      .setColor(0xFFFFD54A.toInt())
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setOnlyAlertOnce(true)
      .setShowWhen(false)
      .setContentIntent(openPage(c, "flashcards?deck=gold", 1))
    if (reveal) {
      b.setContentTitle("✨ $word = $meaning")
        .setContentText(if (gold.size > 1) "${gold.size} gold words ready — tap to review them all" else "Tap to review it in LinguaScript")
        .addAction(Notification.Action.Builder(null, "Next ✨", action(c, ACTION_NEXT, 3)).build())
    } else {
      b.setContentTitle("✨ $word")
        .setContentText("Do you remember it?")
        .addAction(Notification.Action.Builder(null, "Show meaning", action(c, ACTION_SHOW, 2)).build())
    }
    nm.notify(NOTIFICATION_ID, b.build())
  }
}

/** Hourly tick, the card's buttons, and re-arming after a restart. */
class GoldWordReceiver : BroadcastReceiver() {
  override fun onReceive(c: Context, intent: Intent) {
    when (intent.action) {
      GoldWords.ACTION_SHOW -> GoldWords.show(c, reveal = true, advance = false)
      GoldWords.ACTION_NEXT -> GoldWords.show(c, reveal = false, advance = true)
      GoldWords.ACTION_TICK -> {
        GoldWords.show(c, reveal = false, advance = true)
        DeckWidget.refreshAll(c)
      }
      Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED -> {
        if (GoldWords.isOn(c)) GoldWords.setOn(c, true)
        DeckWidget.refreshAll(c)
      }
    }
  }
}
