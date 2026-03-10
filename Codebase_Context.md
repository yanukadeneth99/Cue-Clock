# Codebase Context

## Architecture

React Native + Expo 54 (SDK), file-based routing via Expo Router v6. Single screen app (`app/index.tsx`) with all state lifted to the root component. No navigation stack beyond the index screen.

### Component Tree
```
HomeScreen (app/index.tsx)
├── ClockPicker          — dual live-clock with timezone pickers
├── TargetBlock[]        — one per countdown; collapsible; includes AlertModal
│   └── AlertModal       — set/delete countdown alert
└── HelpModal            — in-app help overlay (triggered by ? button in header)
```

### State (HomeScreen)
| State | Type | Purpose |
|---|---|---|
| `zone1` / `zone2` | `string` | Timezones for each clock |
| `targetBlocks` | `TargetBlockType[]` | All countdown timers |
| `fullScreen` | `boolean` | Hides controls for on-air display |
| `helpVisible` | `boolean` | Controls HelpModal visibility |

All state persisted via AsyncStorage (`multiSet`/`multiGet`).

## Key Patterns

### Styling
All components use **inline `style` props** for layout and visual properties. NativeWind/Tailwind is configured but `className` is not the primary styling method — it failed to apply reliably on Android native. Colors sourced from `constants/colors.ts`.

### Picker rendering
`@react-native-picker/picker` containers must NOT have fixed `height` or `overflow: hidden` — Android renders pickers taller than their declared height, causing text clipping.

### Countdown algorithm
1-second `setInterval` in `HomeScreen`. Diff calculated in target timezone via Luxon. Deduction offset subtracted from target before diff. Alert fires when `totalMinutes <= alertMinutesBefore`. `alertFired` resets when countdown rolls to next day.

## Features (current)
- Dual live-clock with timezone selector (8 supported timezones)
- Multiple named countdown timers (Target + Deduct time, Zone selector)
- Collapsible countdown cards
- Per-timer alert at configurable minutes-before-target
- Full-screen mode for on-air display
- Persistent state across sessions
- In-app help modal (HelpModal)

## Standards Established
- Use `T[]` not `Array<T>` (ESLint rule)
- Catch blocks: use empty `catch {}` or comment-only — no `console.log` in production error handlers
- Icon buttons: 34×34, `borderRadius: 8`, background `colors.background`, border `colors.surfaceBorder` — consistent across all three header icons in TargetBlock
