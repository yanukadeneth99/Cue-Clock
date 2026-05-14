package expo.modules.alarmvibrator

import android.content.Context
import android.media.AudioAttributes
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AlarmVibratorModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AlarmVibrator")

    Function("vibrateAsAlarm") { durationMs: Int ->
      val context = appContext.reactContext
      val vibrator = context?.let { resolveVibrator(it) }
      if (vibrator != null) {
        val effect = VibrationEffect.createOneShot(
          durationMs.toLong().coerceAtLeast(1L),
          VibrationEffect.DEFAULT_AMPLITUDE
        )
        val attrs = AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_ALARM)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build()
        vibrator.vibrate(effect, attrs)
      }
      null
    }

    Function("cancel") {
      appContext.reactContext?.let { ctx ->
        resolveVibrator(ctx)?.cancel()
      }
      null
    }
  }

  private fun resolveVibrator(context: Context): Vibrator? {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val manager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
      manager?.defaultVibrator
    } else {
      @Suppress("DEPRECATION")
      context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    }
  }
}
