# Maestro flows

Maestro is a small tool that taps and types on a real phone for you, following a short script written in YAML. Each script is called a flow. These flows test the real Cue Clock app on a real Android phone.

## Run one flow

1. Connect the phone over adb and make sure the test app (package `com.yanukadeneth99.cueclock`) is installed.
2. Run `bash tests/maestro/grant-permissions.sh` once per install, see the permission note below.
3. Run `maestro test --test-output-dir ~/test-results/maestro tests/maestro/flows/add-cue.yaml` from the repo root.

Results and screenshots are written outside the repo, in `~/test-results/maestro/`.

## Permission note

On first launch the app shows an "Android setup" sheet asking for notification, full-screen alarm, battery and exact-alarm permissions. The flow taps Continue on that sheet, which closes it without granting anything. The script `grant-permissions.sh` only applies the battery whitelist on Android 10, because the other permissions do not exist there. The flow's clearState does not undo the whitelist, so run the script once after each install.

## Test phones

- Main phone: Xiaomi Mi A2 Lite, Android 10, near-stock. It has no notification permission prompt.
- Second phone: Redmi Note 12, Android 15, HyperOS. HyperOS resets the app's permission switches on every reinstall, so turn Other Permissions, Autostart and unrestricted Battery back on, or background and lock-screen alarms will not fire.
- `INSTALL_FAILED_VERSION_DOWNGRADE` means a Play Store build is installed, so uninstall it first.
- After every USB replug, run `adb reverse` again.
