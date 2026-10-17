import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { toast } from "sonner";

const SITE = "https://linguascript.co.uk";

const WhatsAppGlyph = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
    <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.4.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.7.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.3c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.3 8.3 0 1 1 12 20.3z" />
  </svg>
);

/**
 * The green share pair used on proud moments (big comprehension jump,
 * level 10): WhatsApp and Copy link. Never shown during onboarding.
 */
export function ShareActions({ text, url = SITE, className = "" }: { text: string; url?: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const whatsapp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank", "noopener");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      toast.success("Link copied. Paste it anywhere to share");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Long-press the link to share it instead");
    }
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      <button
        type="button"
        onClick={whatsapp}
        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-[#34C759] px-4 py-2 text-sm font-bold text-[#08080B] hover:brightness-110"
      >
        <WhatsAppGlyph /> WhatsApp
      </button>
      <button
        type="button"
        onClick={copy}
        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full border border-[#34C759]/60 px-4 py-2 text-sm font-semibold text-[#34C759] hover:bg-[#34C759]/10"
      >
        {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />} {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}

export default ShareActions;
