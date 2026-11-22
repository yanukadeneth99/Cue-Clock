# Maestro flows

Maestro is a small tool that taps and types on a real phone for you, following a short script written in YAML. Each script is called a flow. These flows test the real Cue Clock app on a real Android phone.

## Run one flow

1. Connect the phone over adb and make sure the test app (package `com.yanukadeneth99.cueclock`) is installed.
2. Run `bash tests/maestro/grant-permissions.sh` once per install, see the permission note below.
3. Run `maestro test --test-output-dir ~/test-results/maestro tests/maestro/flows/add-cue.yaml` from the repo root.

Results and screenshots are written outside the repo, in `~/test-results/maestro/`. To run every flow, give the folder instead: `tests/maestro/flows/`.

## Flows

Each flow starts from a fresh app and closes the first-run dialogs with the shared steps in `flows/common/first-run.yaml`, so those steps are written once. Files in `flows/common/` are helpers, not flows, and Maestro does not run them on their own.

- `add-cue.yaml`: add a cue with a name and check it shows.
- `edit-cue.yaml`: add a cue, open it again, rename it, and check the new name shows and the old one is gone.
- `delete-cue.yaml`: add a cue, delete it, confirm, and check it is gone.
- `cue-buffer.yaml`: add a cue with a 1 minute buffer and check the card shows "Buffer −01:00".
- `settings.yaml`: switch off 24-hour time and seconds, and check the clocks now show AM or PM and no seconds.
- `second-zone.yaml`: change the second clock to Tokyo and check it shows.
- `cue-passes.yaml`: add a cue about 2 minutes ahead with the arrows, wait for it to pass, and check it moves to the "PASSED" strip. It takes up to 3 minutes.

Each flow saves screenshots with names like `edit-cue-02-modal-open.png`.

## In CI

Every pull request that changes `app/` or `tests/maestro/` runs all the flows on an Android emulator in GitHub Actions (`android-release-verify.yml`), so the test phone is not needed to test a PR. CI runs the flows one at a time with `run-ci.sh`, which retries a failed flow once after reconnecting to the emulator and marks a pass on retry with a warning. Screenshots and logs are saved as the `maestro-results` artifact for 7 days. Gemini then reviews the screenshots, see [tests/ai-review](../ai-review/README.md). The emulator is slower than a phone and has no real speaker, so the phone is still used before a release to check the sounds and real speed.

## Permission note

On first launch the app shows an "Android setup" sheet asking for notification, full-screen alarm, battery and exact-alarm permissions. The flow taps Continue on that sheet, which closes it without granting anything. The script `grant-permissions.sh` only applies the battery whitelist on Android 10, because the other permissions do not exist there. The flow's clearState does not undo the whitelist, so run the script once after each install.

## Test phones

- Main phone: Xiaomi Mi A2 Lite, Android 10, near-stock. It has no notification permission prompt.
- Second phone: Redmi Note 12, Android 15, HyperOS. HyperOS resets the app's permission switches on every reinstall, so turn Other Permissions, Autostart and unrestricted Battery back on, or background and lock-screen alarms will not fire.
- `INSTALL_FAILED_VERSION_DOWNGRADE` means a Play Store build is installed, so uninstall it first.
- After every USB replug, run `adb reverse` again.
