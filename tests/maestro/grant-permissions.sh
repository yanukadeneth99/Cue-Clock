#!/usr/bin/env bash
# Grants the Cue Clock permissions over adb so alarms can fire during a test.
# Only uses commands that exist on Android 10. Anything newer is skipped with a note.
set -u
PKG=com.yanukadeneth99.cueclock
ADB=${ADB:-adb}

# Notifications are allowed by default before Android 13, so there is nothing to grant.
SDK=$($ADB shell getprop ro.build.version.sdk | tr -d '\r')
if [ "${SDK:-0}" -ge 33 ]; then
  $ADB shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS
else
  echo "skip: POST_NOTIFICATIONS needs Android 13 or newer (this phone is API $SDK)"
fi

# Exact alarms and full-screen alerts are only a user setting on Android 12 and newer.
if [ "${SDK:-0}" -ge 31 ]; then
  $ADB shell appops set "$PKG" SCHEDULE_EXACT_ALARM allow
else
  echo "skip: SCHEDULE_EXACT_ALARM is allowed by default before Android 12"
fi
if [ "${SDK:-0}" -ge 34 ]; then
  $ADB shell appops set "$PKG" USE_FULL_SCREEN_INTENT allow
else
  echo "skip: USE_FULL_SCREEN_INTENT is allowed by default before Android 14"
fi

# Let the app run in the background without battery limits.
$ADB shell dumpsys deviceidle whitelist +"$PKG"
echo "done"
