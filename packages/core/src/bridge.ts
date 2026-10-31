/**
 * How the website (linguascript.co.uk) and the phone app talk to each other
 * when the app shows the site inside a WebView. Both sides import these types,
 * so a message can't be renamed on one side and forgotten on the other.
 *
 *   site → app:  window.ReactNativeWebView.postMessage(JSON.stringify(msg))
 *   app → site:  webView.injectJavaScript("window.__lsInbox([...])")
 *
 * Plain types and constants only — safe to import anywhere.
 */
import type { DeckState } from "./review";

/** A word saved on the phone (select text → LinguaScript) waiting for the site to store it. */
export interface InboxItem {
  word: string;
  translation?: string;
  language?: string;
  context?: string;
  /** When it was saved (ms). Also its id: the site sends it back in "inbox-saved". */
  at: number;
}

/** The 🦎 bubble's copy of the deck: normalised word → [deck, review due (ms, 0 = none), tapped in a video (ms, 0 = never)]. */
export type BubbleDeckWords = Record<string, [DeckState, number, number]>;

/** Messages the website sends to the app. */
export type SiteToAppMessage =
  /** The site is ready to receive saved words from the phone. */
  | { type: "inbox-ready" }
  /** These inbox words are stored; the app can delete them. */
  | { type: "inbox-saved"; ats: number[] }
  /** The learner's languages (the select-text card uses them). */
  | { type: "langs"; learning: string; native: string }
  /** The deck for the 🦎 bubble. */
  | { type: "deck"; language: string; native: string; words: BubbleDeckWords; common?: string[] }
  /** Turn the 🦎 bubble on/off (Android). */
  | { type: "bubble"; on: boolean; style: "text" | "ring" | "common" }
  /** Sent by the app's injected script with the site's login, so the app can register for push. */
  | { type: "session"; userId: string; accessToken: string };

/** The function the site puts on window for the app to call with inbox words. */
export const SITE_INBOX_FN = "__lsInbox";

/** Files the app keeps in its documents folder (Android native code reads them too). */
export const APP_FILES = {
  inbox: "ls-inbox.json",
  config: "ls-config.json",
  deck: "ls-deck.json",
} as const;

/** Deep links. */
export const LINKS = {
  scheme: "linguascript",
  bubbleScheme: "linguascriptbubble",
  authCallback: "linguascript://auth-callback",
} as const;

/** Added to the WebView user agent, so the site knows it runs inside the app. */
export const APP_USER_AGENT_TAG = "LinguaScriptApp";

/** Parse a WebView message safely; null when it isn't one of ours. */
export function parseSiteMessage(raw: string): SiteToAppMessage | null {
  try {
    const msg = JSON.parse(raw);
    return msg && typeof msg.type === "string" ? (msg as SiteToAppMessage) : null;
  } catch {
    return null;
  }
}
