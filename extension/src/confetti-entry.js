// LinguaScript extension — confetti vendor entry.
// Bundles the real canvas-confetti package (the same one lib/lineBlast.ts
// uses) so the extension's Line Blast fires byte-identical particle bursts
// to the website's, instead of a hand-rolled reimplementation.
import confetti from "canvas-confetti";

window.LSConfetti = { create: confetti.create };
