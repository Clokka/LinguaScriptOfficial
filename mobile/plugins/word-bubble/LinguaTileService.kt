package __PACKAGE__

// "LinguaScript" in the quick-settings panel (swipe down from the top, next to
// the torch and auto-rotate): an on/off switch for the 🦎 bubble. Lit while the
// bubble is on. Turning it on goes through BubbleStartActivity, which asks for
// "display over other apps" the first time.

import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService

class LinguaTileService : TileService() {

  companion object {
    /** Ask Android to redraw the tile (the bubble just turned on or off). */
    fun refresh(c: Context) {
      runCatching { requestListeningState(c, ComponentName(c, LinguaTileService::class.java)) }
    }
  }

  override fun onStartListening() {
    super.onStartListening()
    show(BubbleService.isRunning())
  }

  private fun show(on: Boolean) {
    qsTile?.apply {
      state = if (on) Tile.STATE_ACTIVE else Tile.STATE_INACTIVE
      label = "LinguaScript"
      if (Build.VERSION.SDK_INT >= 29) subtitle = if (on) "On" else "Off"
      updateTile()
    }
  }

  override fun onClick() {
    super.onClick()
    if (BubbleService.isRunning()) {
      stopService(Intent(this, BubbleService::class.java))
      getSharedPreferences("ls-bubble", MODE_PRIVATE).edit().putBoolean("on", false).apply()
      show(false)
      return
    }
    val start = Intent(this, BubbleStartActivity::class.java)
      .setData(Uri.parse("linguascriptbubble://start"))
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    if (Build.VERSION.SDK_INT >= 34) {
      startActivityAndCollapse(PendingIntent.getActivity(this, 0, start, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT))
    } else {
      @Suppress("DEPRECATION")
      startActivityAndCollapse(start)
    }
  }
}
