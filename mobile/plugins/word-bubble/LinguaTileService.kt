package __PACKAGE__

// "LinguaScript" in the quick-settings panel (swipe down from the top, next to
// the torch and auto-rotate). Tap it while watching YouTube → the panel closes,
// the screen is read once, and you can tap any word for its meaning + Save.
// Works whether or not the 🦎 bubble is switched on (it starts it if needed).

import android.app.PendingIntent
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService

class LinguaTileService : TileService() {

  override fun onStartListening() {
    super.onStartListening()
    qsTile?.apply {
      state = Tile.STATE_INACTIVE
      label = "LinguaScript"
      if (Build.VERSION.SDK_INT >= 29) subtitle = "Tap a word"
      updateTile()
    }
  }

  override fun onClick() {
    super.onClick()
    val read = Intent(this, BubbleStartActivity::class.java)
      .setData(Uri.parse("linguascriptbubble://read"))
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    if (Build.VERSION.SDK_INT >= 34) {
      startActivityAndCollapse(PendingIntent.getActivity(this, 0, read, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT))
    } else {
      @Suppress("DEPRECATION")
      startActivityAndCollapse(read)
    }
  }
}
