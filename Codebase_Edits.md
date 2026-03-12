# Codebase Edit History

## 2026-03-11: Performance, notifications, timezones, padding, reset confirm, warning fixes
- **React.memo on TargetBlock:** Wrapped in `React.memo` so only the block whose countdown changed re-renders each second. Reason: 15+ blocks caused noticeable lag.
- **Countdown interval optimization:** Returns same array reference when no block changed (`anyChanged` flag). Reason: prevents unnecessary React reconciliation on idle ticks.
- **expo-notifications:** Added `expo-notifications` for push alerts. Guarded with `Constants.executionEnvironment === "storeClient"` to prevent module load in Expo Go (throws on SDK 53+). Falls back to `Alert.alert` via `sendAlert()` helper. Reason: in-app alerts were not reliable or visible when app is backgrounded.
- **LogBox suppression:** `LogBox.ignoreLogs(["SafeAreaView has been deprecated"])` added for expo-router internal warning we cannot patch. Reason: warning is noise from a library dependency.
- **Timezones expanded:** 8 → 18 zones covering all major world regions. Reason: user request.
- **Padding increased:** `safeTop = insets.top + 8` (min 44px), `safeBottom = insets.bottom + 8` (min 28px). Reason: content too close to status bar and nav buttons.
- **Reset All confirmation:** Uses `Alert.alert` with "Cancel" / "Yes, Reset" (destructive) buttons before executing reset. Reason: accidental resets reported.
- **Preflight JSDoc:** Auto-generated JSDoc on `HelpModal` export. CLAUDE.md updated with new standards.

## 2026-03-10: Fullscreen overflow fix + safe-area padding + preflight JSDoc
- **Fullscreen font scaling:** Dynamic `countdownFontSize` computed from screen height and block count (clamped 24–56px). Font shrinks as blocks increase; scrolling enabled when minimum reached. Reason: target blocks overflowing screen in fullscreen mode.
- **Fixed fullscreen layout:** ClockPicker pinned above a ScrollView; exit button fixed at bottom. Reason: clock must remain visible while targets scroll.
- **Crash fix:** Removed early-return pattern in `HomeScreen` that swapped root component type between `View` and `KeyboardAvoidingView`. Now uses a single `View` root with conditional children. Reason: full tree remount on toggle caused native crash.
- **Safe-area insets:** `useSafeAreaInsets()` used throughout. `safeBottom = Math.max(insets.bottom, 16)` applied to ScrollView padding and fixed button container. `safeTop` replaces hardcoded platform offsets. Reason: content clipped by Android nav bar.
- **TypeScript updated:** `typescript@5.8.3 → 5.9.3` via `npx expo install --fix`. Reason: Expo SDK 54 expected `~5.9.2`.
- **Preflight JSDoc:** Auto-generated JSDoc on `HomeScreen` and `TargetBlock` exported functions. Deduplicated `nameFontSize`/`bellFontSize` → `labelFontSize` in `TargetBlock`.

## 2026-03-10: Visual overhaul + HelpModal + preflight fixes
- **Colors:** Replaced near-black palette (`#0a0a0a`) with dark blue-gray scheme (`#1a1d23` bg, `#252830` surface); dark-themed pickers instead of white boxes. Reason: mobile readability on Android.
- **Styling migration:** Converted all NativeWind `className` props to inline `style` props across `index.tsx`, `ClockPicker.tsx`, `TargetBlock.tsx`. Reason: NativeWind classes were not reliably applying on native Android in Expo Go.
- **Picker clipping fix:** Removed fixed `height` and `overflow: hidden` from `@react-native-picker/picker` containers. Reason: Android renders picker taller than 44px, causing vertical text clipping.
- **Zone picker label formatting:** Added spaces around `/` separator (e.g. `Asia / Colombo`) for readability in narrow containers.
- **Icon consistency:** Replaced `▲`/`▼` collapse icons with `–`/`+` text chars to match `X` delete button style. Added border to all icon buttons for visual alignment.
- **Header layout:** Title row changed to flex row; `?` help button added to top-right. Reason: in-app help requested.
- **HelpModal:** New `components/HelpModal.tsx` — scrollable modal explaining all controls (11 items). Reason: user request for discoverability.
- **Preflight cleanup:** Removed `console.log` from error catch blocks in `index.tsx`; fixed `Array<T>` lint warnings; corrected bell icon label mismatch in `HelpModal`.
