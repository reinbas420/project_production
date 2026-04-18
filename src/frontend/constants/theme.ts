import { Platform } from 'react-native';

// ─── Brand Palette ────────────────────────────────────────────────────────────
// Soft Sage       #E2EFDA  → main background (calm, reduces anxiety)
// Pale Periwinkle #E6E6FA  → browsing / search areas (sparks curiosity)
// Warm Cream      #FFFDD0  → reading mode (mimics physical books)
// Muted Peach     #FFDAB9  → buttons / quizzes (friendly, approachable)
// Deep Sage       #4A7C59  → primary text / active icons
// Charcoal        #2D3748  → body text
// ─────────────────────────────────────────────────────────────────────────────

export const Spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
};

export const Radius = {
  sm:   8,
  md:   16,
  lg:   24,
  xl:   32,
  full: 9999,
};

export const Typography = {
  // Child-friendly sizes — bigger, rounder
  displayChild: 36,
  titleChild:   28,
  bodyChild:    20,
  labelChild:   16,

  // Adult / standard sizes
  display: 28,
  title:   22,
  body:    16,
  label:   13,
  caption: 11,
};

export const Colors = {
  // Semantic surfaces
  background:       '#E2EFDA', // Soft Sage
  browseSurface:    '#E6E6FA', // Pale Periwinkle
  readSurface:      '#FFFDD0', // Warm Cream
  buttonPrimary:    '#FFDAB9', // Muted Peach
  buttonPrimaryText:'#5C3A1E', // warm dark brown on peach
  card:             '#FFFFFF',
  cardBorder:       '#D6E8CB',

  // Text
  textPrimary:      '#2D3748', // charcoal
  textSecondary:    '#5A7A65', // muted sage
  textMuted:        '#9DB8A0',
  textOnDark:       '#FFFFFF',

  // Accents
  accentSage:       '#4A7C59', // deep sage — active states, headers
  accentSageLight:  '#C5DDB8',
  accentPeriwinkle: '#8080C0',
  accentPeach:      '#E8A87C', // darker peach for pressed state

  // Status
  error:            '#E57373',
  success:          '#66BB6A',
  warning:          '#FFB74D',

  // Role tints (subtle background tint per role)
  userTint:         '#E2EFDA',
  childTint:        '#E6E6FA',
  librarianTint:    '#FFFDD0',
  adminTint:        '#FCE4EC',

  // Legacy (keep for existing components)
  light: {
    text:           '#2D3748',
    background:     '#E2EFDA',
    tint:           '#4A7C59',
    icon:           '#5A7A65',
    tabIconDefault: '#9DB8A0',
    tabIconSelected:'#4A7C59',
  },
  dark: {
    text:           '#ECEDEE',
    background:     '#1A2E1F',
    tint:           '#C5DDB8',
    icon:           '#9DB8A0',
    tabIconDefault: '#9DB8A0',
    tabIconSelected:'#C5DDB8',
  },
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
