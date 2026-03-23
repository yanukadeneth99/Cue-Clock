# The Design System: Technical Precision for Broadcast Operations

## 1. Overview & Creative North Star

### Creative North Star: "The Command Chronometer"
In the high-stakes environment of a broadcast gallery, every millisecond is a tactical decision. This design system departs from "consumer-grade" interfaces to embrace a **Technical Editorial** aesthetic. It moves beyond standard dashboard templates, favoring a layout that feels like a mission-critical instrument panel.

We break the "template" look through:
- **Intentional Asymmetry:** Essential time-keeping data is offset against wide-tracked, small-cap labels to create a sense of focused urgency.
- **Tonal Depth over Structural Lines:** We avoid the "boxed-in" look of typical SaaS apps. Instead, we use overlapping surfaces and color-coded zones to define space.
- **Micro-Precision:** Using monospaced elements for all variable data, ensuring that as numbers change, the layout remains rock-solid.

---

## 2. Colors & Surface Logic

The palette is engineered for low-light control rooms, prioritizing legibility and visual hierarchy without inducing eye strain.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to define sections. Layout boundaries must be established through background color shifts. Use `surface_container_low` (#191c22) for secondary panels sitting on a `surface` (#101319) background. Boundaries are felt through tone, not seen through lines.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of technical components.
- **Level 0 (Base):** `surface` (#101319) - The "desk" or foundation.
- **Level 1 (Sections):** `surface_container` (#1d2026) - Major layout blocks.
- **Level 2 (Active Cards):** `surface_container_high` (#272a30) - Interactive time-keeping units.
- **Level 3 (Overlays):** `surface_bright` (#363940) - Floating pickers and temporary menus.

### The "Glass & Gradient" Rule
To elevate the system, use **Glassmorphism** for floating elements (e.g., tooltips or time-pickers). Apply `surface_variant` (#32353b) at 80% opacity with a `20px` backdrop-blur. 
**Signature Texture:** Main CTAs should utilize a subtle linear gradient from `primary` (#a4c9ff) to `primary_container` (#60a5fa) at a 135-degree angle to provide a metallic, machined finish.

---

## 3. Typography

The system utilizes a dual-font strategy to balance editorial sophistication with technical utility.

| Role | Token | Font | Size | Character Spacing |
| :--- | :--- | :--- | :--- | :--- |
| **Data/Time** | Display-LG | Space Grotesk | 3.5rem | -0.02em |
| **Header** | Headline-SM | Space Grotesk | 1.5rem | 0.05em (Caps) |
| **Readout** | Title-MD | Inter (Medium) | 1.125rem | 0 |
| **System Label**| Label-SM | Inter (Bold) | 0.6875rem | 0.1em (All Caps) |

**Monospace Requirement:** All numerical displays (clocks, countdowns, frame rates) must utilize monospaced numerical sets from the `Space Grotesk` family to prevent "layout jitter" during active counting.

---

## 4. Elevation & Depth

We convey hierarchy through **Tonal Layering** rather than traditional structural shadows.

- **The Layering Principle:** Depth is achieved by "stacking" container tiers. A `surface_container_highest` (#32353b) button on a `surface_container` (#1d2026) background provides enough contrast to signify "pressability" without a drop shadow.
- **Ambient Shadows:** For floating modals, use an extra-diffused shadow: `offset: 0 12px`, `blur: 40px`, `color: rgba(0, 0, 0, 0.4)`. The shadow should feel like a soft occlusion of light, not a black outline.
- **The "Ghost Border" Fallback:** If a border is required for accessibility (e.g., focused states), use `outline_variant` (#414751) at **20% opacity**. Never use 100% opaque borders.
- **Optical Bridging:** Use the `accent` (#60a5fa) token as a 2px vertical "glow" on the left edge of an active container to denote focus, rather than a full-frame border.

---

## 5. Components

### Buttons
- **Primary:** High-contrast `primary_container` (#60a5fa) background with `on_primary_container` (#003a6b) text. Radius: `sm` (0.125rem) for a sharp, technical feel.
- **Technical Action:** Background `surface_bright` (#363940), 10% opacity `primary` outline. Used for secondary toggles.

### Status Chips
- **Zone 1 (Safety):** `secondary_container` (#00b55d) background with `secondary_fixed_dim` (#4de082) text.
- **Zone 2 (Critical):** `error_container` (#93000a) background with `error` (#ffb4ab) text.
- *Styling:* No radius. Use a 45-degree clipped corner (2px) on the top-right to mimic military hardware.

### Input Fields
- **Time Pickers:** Use `surface_container_highest` (#32353b). Labels must be `label-sm` (all caps) positioned *inside* the field boundaries to save vertical space.
- **Active State:** Instead of a border change, the background should shift to `primary` (#a4c9ff) at 5% opacity.

### Cards & Lists
- **The No-Divider Rule:** Forbid the use of horizontal lines between list items. Use **Spacing 4** (0.9rem) or a subtle shift between `surface_container_low` and `surface_container_lowest` to differentiate rows.

---

## 6. Do’s and Don’ts

### Do
- **Do** use `tertiary` (#f9bd22) for countdowns under 10 seconds to create high-visibility "warning" states.
- **Do** lean into asymmetry; align headers to the left and data to the right with significant "breathable" negative space between them.
- **Do** use `surface_bright` for hover states to create a "glow" effect that mimics backlit hardware buttons.

### Don't
- **Don't** use `primary` (#a4c9ff) for large background areas; it is an accent for interaction, not a structural color.
- **Don't** use standard rounded corners (`lg` or `xl`) except for floating FABs. Maintain `sm` (0.125rem) or `none` for a professional, "racked" appearance.
- **Don't** use "pure black" (#000000). Use the `surface` palette to maintain the sophisticated dark-grey "tech" depth.