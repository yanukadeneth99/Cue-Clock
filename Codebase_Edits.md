# Codebase Edit History

## 2026-03-10: Visual overhaul + HelpModal + preflight fixes
- **Colors:** Replaced near-black palette (`#0a0a0a`) with dark blue-gray scheme (`#1a1d23` bg, `#252830` surface); dark-themed pickers instead of white boxes. Reason: mobile readability on Android.
- **Styling migration:** Converted all NativeWind `className` props to inline `style` props across `index.tsx`, `ClockPicker.tsx`, `TargetBlock.tsx`. Reason: NativeWind classes were not reliably applying on native Android in Expo Go.
- **Picker clipping fix:** Removed fixed `height` and `overflow: hidden` from `@react-native-picker/picker` containers. Reason: Android renders picker taller than 44px, causing vertical text clipping.
- **Zone picker label formatting:** Added spaces around `/` separator (e.g. `Asia / Colombo`) for readability in narrow containers.
- **Icon consistency:** Replaced `▲`/`▼` collapse icons with `–`/`+` text chars to match `X` delete button style. Added border to all icon buttons for visual alignment.
- **Header layout:** Title row changed to flex row; `?` help button added to top-right. Reason: in-app help requested.
- **HelpModal:** New `components/HelpModal.tsx` — scrollable modal explaining all controls (11 items). Reason: user request for discoverability.
- **Preflight cleanup:** Removed `console.log` from error catch blocks in `index.tsx`; fixed `Array<T>` lint warnings; corrected bell icon label mismatch in `HelpModal`.
