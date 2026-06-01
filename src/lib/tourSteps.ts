/**
 * Forced cursor-guided onboarding tour.
 *
 * Each step targets a real on-page element via [data-tour="..."].
 * The TourOverlay finds the element, animates a fake cursor to it,
 * shows a tooltip, blocks clicks elsewhere, and advances when the
 * user clicks the target (or, for the auto-fill step, when our
 * scripted input is complete).
 */
export type TourStepId =
  | "watch-dual"
  | "watch-word"
  | "watch-pron"
  | "watch-save"
  | "watch-fullscreen"
  | "browse-flashcards"
  | "flashcards-review"
  | "flashcard-flip"
  | "flashcard-pron"
  | "flashcards-back"
  | "browse-calendar"
  | "browse-settings"
  | "settings-native"
  | "settings-learning"
  | "browse-home"
  | "browse-paste"
  | "finale";

export interface TourStep {
  id: TourStepId;
  selector: string;
  copy: string;
  /** Tooltip placement relative to target. */
  placement?: "top" | "bottom" | "left" | "right";
  /** Pixel padding around the spotlight rect. */
  pad?: number;
  /** If set, advancing this step triggers navigation after a short pause. */
  navigateTo?: string;
  /** Delay (ms) to wait after click before advancing/navigating. */
  postDelay?: number;
  /** Skip the click-to-advance contract: advance automatically when route matches. */
  expectRoute?: string;
  /** Auto-play action driven by the overlay (no user click required). */
  autoAction?: "fill-paste-url" | "finish" | "request-fullscreen";
  /** Disable the click guard for steps where the user must interact freely. */
  allowFreeClicks?: boolean;
  /** Optional element selector to anchor the guiding cursor (defaults to `selector`). */
  cursorSelector?: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "watch-dual",
    selector: '[data-tour="dual-toggle"]',
    copy: "See two languages at once.",
    placement: "bottom",
  },
  {
    id: "watch-word",
    selector: '[data-tour="subtitle-word"]',
    copy: "Click any word to learn it instantly.",
    placement: "top",
    pad: 4,
  },
  {
    id: "watch-pron",
    selector: '[data-tour="word-pronounce"]',
    copy: "Hear the word spoken aloud.",
    placement: "left",
  },
  {
    id: "watch-save",
    selector: '[data-tour="word-save"]',
    copy: "Save useful words directly into your personal flashcard deck for long-term retention.",
    placement: "top",
    pad: 4,
    postDelay: 400,
  },
  {
    id: "watch-fullscreen",
    selector: '[data-tour="fullscreen-btn"]',
    copy: "Immerse yourself — tap to go fullscreen.",
    placement: "bottom",
    pad: 14,
    postDelay: 200,
  },
  {
    id: "browse-flashcards",
    selector: '[data-tour="nav-flashcards"]',
    copy: "Every word you save lives here — click Flashcards to see your deck.",
    placement: "right",
    cursorSelector: '[data-tour="nav-flashcards"]',
    expectRoute: "/flashcards",
  },
  {
    id: "flashcards-review",
    selector: '[data-tour="flashcards-review-btn"]',
    copy: "Start a quick review session.",
    placement: "top",
    postDelay: 400,
  },
  {
    id: "flashcard-flip",
    selector: '[data-tour="flashcard"]',
    copy: "Click the card to reveal the translation.",
    placement: "top",
    pad: 6,
    postDelay: 600,
  },
  {
    id: "flashcard-pron",
    selector: '[data-tour="flashcard-pronounce"]',
    copy: "Shadow new words aloud — learners who do are 2–3× more likely to retain vocabulary long term.",
    placement: "top",
    allowFreeClicks: true,
    // After tooltip, drift the guiding cursor toward the back arrow so the user
    // sees exactly how to exit Flashcards next.
    cursorSelector: '[data-tour="page-back"]',
  },
  {
    id: "flashcards-back",
    selector: '[data-tour="page-back"]',
    copy: "Head back to your learning dashboard.",
    placement: "right",
    expectRoute: "/browse",
  },
  {
    id: "browse-calendar",
    selector: '[data-tour="nav-calendar"]',
    copy: "Track your daily streaks.",
    placement: "right",
  },
  {
    id: "browse-settings",
    selector: '[data-tour="nav-settings"]',
    copy: "Set your languages here.",
    placement: "right",
  },
  {
    id: "settings-native",
    selector: '[data-tour="settings-native"]',
    copy: "Choose your native language.",
    placement: "bottom",
    pad: 6,
    allowFreeClicks: true,
  },
  {
    id: "settings-learning",
    selector: '[data-tour="settings-learning"]',
    copy: "Choose what you're learning.",
    placement: "top",
    pad: 6,
    allowFreeClicks: true,
  },
  {
    id: "browse-home",
    selector: '[data-tour="nav-home"]',
    copy: "One more thing — back to your library.",
    placement: "right",
  },
  {
    id: "browse-paste",
    selector: '[data-tour="paste-input"]',
    copy:
      "Linguascript works with the YouTube videos you already love. Paste any link to turn it into an interactive lesson.",
    placement: "bottom",
    pad: 8,
    autoAction: "fill-paste-url",
    allowFreeClicks: true,
  },
  {
    id: "finale",
    selector: "body",
    copy: "You're ready. Happy learning ✨",
    placement: "top",
    autoAction: "finish",
    allowFreeClicks: true,
  },
];

export const TOUR_TRAINING_YT_ID = "v7G2iPeiVVg";
export const TOUR_PASTE_DEMO_URL =
  "https://www.youtube.com/watch?v=SoafcM3xqlc";
