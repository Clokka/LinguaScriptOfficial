# Felix the Chameleon - Implementation Guide

## Overview

Felix the Chameleon is a dynamic pet mascot that changes color based on the user's active learning language. Felix is "lucky" (felix in Latin) and appears as a legendary pet with the ability to match the color of the LinguaScript language being studied.

## Features

- **Dynamic Color Changing**: Felix's color changes in real-time when users switch their learning language
- **Language-Based Color Mapping**: Different language families are mapped to different colors:
  - **Red** - Romance Languages (Spanish, French, Italian, Portuguese, Romanian, Catalan)
  - **Orange** - Germanic Languages (German, Dutch, Swedish, Norwegian, Danish, English)
  - **Green** - Asian & Other Languages (Japanese, Chinese, Korean, Russian, Arabic, Hindi, Turkish, Polish, Thai, Vietnamese)
- **Smooth Animations**: Felix uses pre-recorded animations for different reactions (Idle, Dance, Wave, Happy, Celebrate, etc.)
- **No Glow Effects**: Color changes use direct material color modification instead of glow effects for a natural appearance

## Architecture

### Files Modified/Created

1. **`src/lib/felixColors.ts`** (NEW)
   - Defines the language-to-color mapping system
   - Provides utility functions for color conversion and retrieval
   - Contains `ColorValue` interface and helper functions

2. **`src/lib/pets.ts`** (MODIFIED)
   - Added Felix to the PETS array with legendary rarity
   - References the Chameleon_Animations.glb file

3. **`src/components/pets/PetViewer.tsx`** (MODIFIED)
   - Added `languageColor` prop to support dynamic color changes
   - Implements material color modification using Three.js
   - Applies color changes to all meshes in the 3D model

4. **`src/components/pets/PetCompanion.tsx`** (MODIFIED)
   - Integrated `useLanguage` hook to track active learning language
   - Monitors language changes and updates Felix's color
   - Passes color data to PetViewer component

5. **`public/pets/Chameleon_Animations.glb`** (NEW)
   - The 3D model file containing Felix and all animations
   - Includes animations: Sit, Roll, Walk, Idle variants, Hit, Fly, Swim, and more

## How It Works

### Color System Flow

```
User changes language
        ↓
LanguageContext updates languageContext
        ↓
PetCompanion detects change via useLanguage hook
        ↓
getLanguageColor() maps language code to RGB color
        ↓
setLanguageColor() updates state with new ColorValue
        ↓
PetViewer receives languageColor prop
        ↓
useEffect applies color to 3D model materials via Three.js
        ↓
Felix appears in new color instantly
```

### Material Modification

The `PetViewer` component uses Three.js to directly modify the base color of all meshes in the GLB model:

```typescript
// Access the 3D scene from model-viewer
const scene = modelViewerElement.model.scene;

// Create target color from RGB values (0-255 range)
const targetColor = new THREE.Color(r/255, g/255, b/255);

// Traverse all meshes and update their material colors
scene.traverse((child) => {
  if (child.isMesh && child.material) {
    child.material.color.copy(targetColor);
  }
});
```

## Usage

### Displaying Felix

To show Felix as the active pet, users select Felix from the pet gallery. The companion automatically:
1. Displays the 3D model with the current language color
2. Updates color whenever the language changes
3. Plays animations based on user actions and achievements

### Adding New Language Mappings

Edit `src/lib/felixColors.ts` to add new languages:

```typescript
export const LANGUAGE_COLORS: Record<string, ColorValue> = {
  // Add language code and RGB color
  "my": { r: 34, g: 197, b: 94 },  // Burmese - Green family
};
```

### Customizing Colors

The current color scheme can be changed by modifying the RGB values in `LANGUAGE_COLORS`:

```typescript
// Red: { r: 239, g: 68, b: 68 }
// Orange: { r: 249, g: 115, b: 22 }
// Green: { r: 34, g: 197, b: 94 }

// Change to custom colors
es: { r: 255, g: 0, b: 0 },  // Pure red
```

## Animation Names

Felix supports the following animation names (from the GLB file):
- `Idle` - Standing still or resting
- `Sit` - Sitting down
- `Roll` - Rolling animation
- `Walk` - Walking animation
- `Idle_A`, `Idle_B`, `Idle_C` - Different idle variations
- `Hit` - Impact/hit animation
- `Fly` - Flying animation
- `Swim` - Swimming animation

These animations are triggered by the `PetCompanion` component based on user reactions (celebrate, dance, happy, etc.).

## Technical Details

### Three.js Integration

The project already includes Three.js as a dependency (`three: ^0.169.0`). The `model-viewer` web component internally uses Three.js to render the GLB models.

### Color Space

All colors use the RGB color space with values from 0-255. These are converted to normalized values (0-1) for Three.js:

```typescript
const normalizedColor = new THREE.Color(r/255, g/255, b/255);
```

### Performance

- Color updates are applied on-demand when the language changes
- The update is fast (single traverse of scene graph)
- No continuous re-rendering or animation loops for color changes

## Troubleshooting

### Felix doesn't change color
1. Verify `languageContext` is being updated in `LanguageContext`
2. Check browser console for "Failed to apply language color" errors
3. Ensure Three.js is loaded: `console.log(window.THREE)` should not be undefined

### Felix appears with wrong color
1. Check `LANGUAGE_COLORS` mapping in `felixColors.ts`
2. Verify language code format matches (lowercase, 2-letter ISO codes)
3. Check RGB values are between 0-255

### Animation doesn't play
1. Ensure animation names match exactly (case-sensitive)
2. Verify GLB file is loaded: check network tab in DevTools
3. Check `availableAnimations` in model-viewer element

## Future Enhancements

Possible improvements to the Felix system:
1. **Animated Color Transitions**: Smoothly animate color changes over 500-1000ms
2. **Color Presets**: Allow users to customize Felix's color scheme
3. **Multi-Material Support**: Support different colors for different body parts
4. **Particle Effects**: Add subtle particles during color transitions
5. **Sound Effects**: Play a sound when Felix changes color
6. **Glow Intensity**: Allow glow effect configuration per color

## Model Attribution

Felix model created by Quirky Series (v1.4)
- Original file: Chameleon_Animations.glb
- Includes multiple LOD variants and individual animation files
- Supports texturing and material modifications
