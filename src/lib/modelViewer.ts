/**
 * Loads Google's <model-viewer> (3D pets) only when a page actually shows
 * one. It used to sit in index.html — twice — so every visitor downloaded
 * ~1 MB of 3D code before seeing anything.
 */
const SRC = "https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js";

let loading = false;

export function ensureModelViewer() {
  if (loading || typeof document === "undefined" || customElements.get("model-viewer")) return;
  loading = true;
  const s = document.createElement("script");
  s.type = "module";
  s.src = SRC;
  document.head.appendChild(s);
}
