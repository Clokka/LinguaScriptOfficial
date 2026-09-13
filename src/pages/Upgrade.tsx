import { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { getEnabledFallbackPlans, type StripeFallbackPlan, type StripePlanKey } from '@/lib/stripeFallback';
import { StripeEmbeddedCheckout } from '@/components/StripeEmbeddedCheckout';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSubscription } from '@/hooks/useSubscription';
import { ManageBillingButton } from '@/components/ManageBillingButton';

// model-viewer types are declared globally elsewhere in the project.

type ModelViewerEl = HTMLElement & {
  animationName: string;
  play: (opts?: { repetitions?: number }) => void;
  pause: () => void;
};

// Prices are never hardcoded here any more: the cards render whatever the
// payment_plans table says, which is the same config the checkout charges.
// Previously this page advertised £3.25/£4.99 and a Family tier while every
// button charged the single configured monthly price.

type CurrentPlan = 'free' | 'pro';
type HoveredCard = 'free' | 'pro' | 'lifetime' | null;

// ── All 8 pets ───────────────────────────────────────────────────
const PETS = [
  { name: 'Sparrow',  file: 'Sparrow_Animations.glb',  anim: 'Idle_A' },
  { name: 'Gecko',    file: 'Gecko_Animations.glb',    anim: 'Idle_B' },
  { name: 'Colobus',  file: 'Colobus_Animations.glb',  anim: 'Idle_C' },
  { name: 'Inkfish',  file: 'Inkfish_Animations.glb',  anim: 'Bounce' },
  { name: 'Pudu',     file: 'Pudu_Animations.glb',     anim: 'Sit'    },
  { name: 'Muskrat',  file: 'Muskrat_Animations.glb',  anim: 'Idle_A' },
  { name: 'Herring',  file: 'Herring_Animations.glb',  anim: 'Idle_B' },
  { name: 'Taipan',   file: 'Taipan_Animations.glb',   anim: 'Idle_C' },
] as const;

function PetShowcase({ currentPlan, onUpgradeClick }: {
  currentPlan: CurrentPlan;
  onUpgradeClick: () => void;
}) {
  const isPro = currentPlan === 'pro' || currentPlan === 'family';
  return (
    <div className="mt-14 mb-2">
      {/* Section heading */}
      <div className="text-center mb-8">
        <p className="text-[10px] font-black tracking-[0.2em] text-[#4ade80] mb-2">PRO COMPANIONS</p>
        <h2 className="text-2xl md:text-3xl font-black text-white mb-2">
          8 living pets, all yours with Pro
        </h2>
        <p className="text-[#a1a1aa] text-sm max-w-md mx-auto">
          Each one animates, reacts to your progress, and greets you every time you log in.
          Free plan includes Sparrow only.
        </p>
      </div>

      {/* Pet grid */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-3 md:gap-2 max-w-4xl mx-auto px-2">
        {PETS.map((pet, i) => {
          const locked = !isPro && i > 0;
          return (
            <div key={pet.name} className="flex flex-col items-center gap-1 group">
              <div
                className={`relative rounded-2xl overflow-hidden transition-all duration-200
                  ${locked
                    ? 'opacity-40 grayscale'
                    : 'opacity-100 hover:scale-105'}`}
                style={{
                  background: locked ? '#18181b' : 'radial-gradient(circle at 50% 60%, rgba(74,222,128,0.08), transparent 70%)',
                  border: locked ? '1px solid #27272a' : '1px solid rgba(74,222,128,0.2)',
                }}
              >
                <model-viewer
                  src={`/pets/${pet.file}`}
                  animation-name={pet.anim}
                  autoplay
                  environment-image="neutral"
                  shadow-intensity="0"
                  style={{
                    width: '100%',
                    aspectRatio: '1/1',
                    background: 'transparent',
                    display: 'block',
                    minWidth: '72px',
                  } as React.CSSProperties}
                />
                {locked && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl">🔒</span>
                  </div>
                )}
              </div>
              <span className={`text-[10px] font-semibold tracking-wide
                ${locked ? 'text-[#3f3f46]' : 'text-[#a1a1aa] group-hover:text-white'} transition-colors`}>
                {pet.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* Unlock CTA — only shown to free users */}
      {!isPro && (
        <div className="text-center mt-8">
          <button
            onClick={onUpgradeClick}
            className="inline-flex items-center gap-2 bg-[#4ade80] text-[#09090b] font-bold
                       px-7 py-3 rounded-full hover:brightness-110 active:scale-95 transition-all text-sm"
          >
            Unlock all 8 pets with Pro →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Feature row ──────────────────────────────────────────────────
function Feature({ label, checked, color }: { label: string; checked: boolean; color: string }) {
  return (
    <div className="flex items-center gap-2.5 py-[3px]">
      <span className="text-sm flex-shrink-0 w-4 text-center font-semibold"
        style={{ color: checked ? color : '#52525b' }}>
        {checked ? '✓' : '–'}
      </span>
      <span className="text-sm text-[#a1a1aa]">{label}</span>
    </div>
  );
}

// ── Spinner ──────────────────────────────────────────────────────
function Spinner({ color = '#09090b' }: { color?: string }) {
  return (
    <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin inline-block"
      style={{ borderColor: `${color} ${color} ${color} transparent` }} />
  );
}

// ── Main page ────────────────────────────────────────────────────
export default function Upgrade() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const mvRef = useRef<ModelViewerEl | null>(null);
  const idleTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const isHovering = useRef(false);

  const { isPro, source, expiresAt, cancelAtPeriodEnd, hasBillingAccount, isLifetime } = useSubscription();

  const [isAnnual, setIsAnnual]           = useState(true);
  const [hoveredCard, setHoveredCard]     = useState<HoveredCard>(null);
  const [studentOpen, setStudentOpen]     = useState(false);
  const [studentResult, setStudentResult] = useState<{ eligible: boolean; email?: string } | null>(null);
  const [studentLoading, setStudentLoading] = useState(false);

  const currentPlan: CurrentPlan = isPro ? 'pro' : 'free';

  // ── Real plans (same source /pricing reads from) ─────────────
  const [stripePlans, setStripePlans]     = useState<Array<{ key: StripePlanKey } & StripeFallbackPlan>>([]);
  const [checkoutPriceId, setCheckoutPriceId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getEnabledFallbackPlans().then((p) => { if (alive) setStripePlans(p); });
    return () => { alive = false; };
  }, []);

  const stripeMonthly = stripePlans.find((p) => p.key === 'monthly');
  const stripeYearly = stripePlans.find((p) => p.key === 'yearly');
  const stripeLifetime = stripePlans.find((p) => p.key === 'lifetime');

  // ── Animation helpers ────────────────────────────────────────
  // model-viewer upgrades to a real custom element asynchronously (it loads
  // from a CDN script) — .play only exists once that's done. Calling it
  // before then throws, so guard the same way PetViewer.tsx does.
  const playAnim = useCallback((name: string, repetitions = 1) => {
    const mv = mvRef.current;
    if (!mv || typeof mv.play !== 'function') return;
    mv.animationName = name;
    mv.play({ repetitions });
  }, []);

  const startIdle = useCallback(() => {
    const idles = ['Idle_A', 'Idle_B', 'Idle_C'];
    playAnim('Idle_A', Infinity);
    if (idleTimer.current) clearInterval(idleTimer.current);
    idleTimer.current = setInterval(() => {
      if (!isHovering.current) {
        playAnim(idles[Math.floor(Math.random() * idles.length)], Infinity);
      }
    }, 6000);
  }, [playAnim]);

  // ── Idle animation ───────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(startIdle, 1000);
    return () => {
      clearTimeout(t);
      if (idleTimer.current) clearInterval(idleTimer.current);
    };
  }, [startIdle]);

  // ── Card hover ───────────────────────────────────────────────
  const onCardEnter = (card: HoveredCard) => {
    isHovering.current = true;
    setHoveredCard(card);
    const map: Record<string, string> = { free: 'Sit', pro: 'Bounce', lifetime: 'Spin' };
    if (card) playAnim(map[card], Infinity);
  };

  const onCardLeave = () => {
    isHovering.current = false;
    setHoveredCard(null);
    startIdle();
  };

  // ── Purchase — opens the real embedded checkout ───────────────
  const handlePurchase = (plan: 'pro' | 'lifetime') => {
    if (isPro) return;
    if (!user) { navigate('/auth?next=/upgrade'); return; }

    const chosen = plan === 'lifetime'
      ? stripeLifetime
      : (isAnnual ? stripeYearly : stripeMonthly);
    if (!chosen) {
      toast.error("That plan isn't available yet. Please try another option.");
      return;
    }
    playAnim('Jump', 1);
    setCheckoutPriceId(chosen.priceId);
  };

  const onCheckoutOpenChange = (open: boolean) => {
    if (open) return;
    setCheckoutPriceId(null);
    startIdle();
  };

  // ── Student discount — checked against the signed-in account ──
  const handleStudentCheck = async () => {
    if (!user) { navigate('/auth?next=/upgrade'); return; }
    setStudentLoading(true);
    setStudentResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('verify-student-email', { body: {} });
      if (error) throw error;
      setStudentResult({ eligible: !!data?.eligible, email: data?.email });
    } catch {
      toast.error("Couldn't check your student status. Please try again.");
    } finally {
      setStudentLoading(false);
    }
  };

  // Display copy comes from the configured plans, so what's shown is what's charged.
  const proPlan = isAnnual ? (stripeYearly ?? stripeMonthly) : (stripeMonthly ?? stripeYearly);
  const pro = {
    display: proPlan?.priceDisplay ?? '—',
    label: proPlan?.key === 'yearly' ? 'billed yearly' : 'per month',
    total: proPlan?.priceDisplay ?? '',
  };
  const life = {
    display: stripeLifetime?.priceDisplay ?? '—',
    label: 'one-time payment',
    total: stripeLifetime?.priceDisplay ?? '',
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#09090b] text-white selection:bg-[#4ade80]/30">
      <style>{`
        @keyframes ls-float {
          0%, 100% { transform: translateY(0px);   }
          50%       { transform: translateY(-10px); }
        }
        .ls-float { animation: ls-float 4s ease-in-out infinite; }
        model-viewer { --poster-color: transparent; }
      `}</style>

      {/* ── HERO ──────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center pt-10 pb-4 overflow-hidden">
        {/* Ambient orbs */}
        <div className="pointer-events-none absolute -top-20 right-0 w-[600px] h-[600px] rounded-full opacity-60"
          style={{ background: 'radial-gradient(circle, rgba(74,222,128,0.07) 0%, transparent 65%)' }} />
        <div className="pointer-events-none absolute top-40 -left-20 w-[400px] h-[400px] rounded-full opacity-50"
          style={{ background: 'radial-gradient(circle, rgba(108,63,245,0.09) 0%, transparent 65%)' }} />

        {/* Wordmark */}
        <div className="text-4xl md:text-5xl font-black tracking-tight z-10 mb-1">
          <span className="text-white">Lingua</span>
          <span className="text-[#4ade80]">Script</span>
        </div>
        <p className="text-[#a1a1aa] text-base z-10 mb-2">Unlock everything. Bring your pet to life.</p>

        {/* Pet */}
        <div
          className="ls-float z-10 cursor-pointer select-none"
          style={{ filter: 'drop-shadow(0 20px 40px rgba(74,222,128,0.15))' }}
          onClick={() => { playAnim('Clicked', 1); setTimeout(startIdle, 1800); }}
          title="Click me!"
        >
          <model-viewer
            ref={(el: HTMLElement | null) => { mvRef.current = el as ModelViewerEl | null; }}
            src="/pets/Sparrow_Animations.glb"
            animation-name="Idle_A"
            autoplay
            environment-image="neutral"
            shadow-intensity="0"
            style={{
              width: 'clamp(180px, 28vw, 280px)',
              height: 'clamp(180px, 28vw, 280px)',
              background: 'transparent',
            } as React.CSSProperties}
          />
        </div>

        {hoveredCard && (
          <p className="text-[#52525b] text-xs mt-1 z-10 transition-opacity">
            {hoveredCard === 'free' && 'My Sparrow can sit and wait…'}
            {hoveredCard === 'pro'  && 'Bounce! All 8 pets unlocked with Pro!'}
            {hoveredCard === 'family' && 'Every family member gets their own pet!'}
          </p>
        )}
      </section>

      {/* ── BILLING TOGGLE ────────────────────────────────────── */}
      <div className="flex justify-center mb-8">
        <div className="flex items-center gap-1 bg-[#18181b] border border-[#3f3f46] rounded-full p-1">
          {(['annual', 'monthly'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setIsAnnual(mode === 'annual')}
              className={`px-5 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 ${
                isAnnual === (mode === 'annual')
                  ? 'bg-[#4ade80] text-[#09090b] shadow-sm'
                  : 'text-[#a1a1aa] hover:text-white'
              }`}
            >
              {mode === 'annual' ? '📅 Annual · save 35%' : 'Monthly'}
            </button>
          ))}
        </div>
      </div>

      {/* ── PLAN CARDS ────────────────────────────────────────── */}
      <section className="px-4 pb-6 max-w-5xl mx-auto">
        {/*
          Mobile layout: Pro first (order-first), then Free, then Family.
          Desktop: Free | Pro | Family in a 3-col grid.
        */}
        <div className="flex flex-col md:grid md:grid-cols-3 gap-5 md:gap-4 md:items-start">

          {/* PRO — order-first on mobile so it leads */}
          <div className="md:order-2 order-first">
            <div
              onMouseEnter={() => onCardEnter('pro')}
              onMouseLeave={onCardLeave}
              className="relative bg-[#18181b] border-2 border-[#4ade80] rounded-2xl p-6 flex flex-col
                         shadow-[0_0_50px_rgba(74,222,128,0.13)] md:scale-105 transition-all duration-200
                         hover:shadow-[0_0_60px_rgba(74,222,128,0.2)]"
            >
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <span className="bg-[#4ade80] text-[#09090b] text-[10px] font-black tracking-widest px-3 py-1 rounded-full">
                  MOST POPULAR
                </span>
              </div>

              <p className="text-[10px] font-black tracking-[0.2em] text-[#4ade80] mb-3 mt-2">PRO</p>
              <div className="flex items-end gap-1 mb-0.5">
                <span className="text-4xl font-black">{pro.display}</span>
                <span className="text-[#a1a1aa] text-sm mb-1">/mo</span>
              </div>
              <p className="text-[#52525b] text-xs mb-6">{pro.label}</p>

              <div className="flex flex-col flex-1 mb-6">
                <Feature label="Everything in Free"                  checked color="#4ade80" />
                <Feature label="Unlimited word saves"                checked color="#4ade80" />
                <Feature label="Unlimited transcript analyses"       checked color="#4ade80" />
                <Feature label="Full SRS flashcard system"           checked color="#4ade80" />
                <Feature label="Comprehension history & analytics"   checked color="#4ade80" />
                <Feature label="All 8 animated pet companions"       checked color="#4ade80" />
                <Feature label="Priority access to new features"     checked color="#4ade80" />
              </div>

              <button
                onClick={() => handlePurchase('pro')}
                disabled={currentPlan === 'pro' || currentPlan === 'family'}
                className={`w-full py-3.5 rounded-full font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2
                  ${currentPlan === 'pro' || currentPlan === 'family'
                    ? 'bg-[#4ade80]/20 text-[#4ade80] cursor-default'
                    : 'bg-[#4ade80] text-[#09090b] hover:brightness-110 active:scale-95 disabled:opacity-60 cursor-pointer'}`}
              >
                {currentPlan === 'pro' ? '✓ Current Plan' :
                 currentPlan === 'family' ? '✓ Family includes Pro' :
                 'Upgrade to Pro'}
              </button>
            </div>
          </div>

          {/* FREE */}
          <div className="md:order-1 order-2">
            <div
              onMouseEnter={() => onCardEnter('free')}
              onMouseLeave={onCardLeave}
              className="bg-[#18181b] border border-[#3f3f46] rounded-2xl p-6 flex flex-col
                         transition-all duration-200 hover:border-[#52525b]"
            >
              <p className="text-[10px] font-black tracking-[0.2em] text-[#52525b] mb-3">FREE</p>
              <div className="flex items-end gap-1 mb-0.5">
                <span className="text-4xl font-black">£0</span>
                <span className="text-[#52525b] text-sm mb-1">forever</span>
              </div>
              <p className="text-[#52525b] text-xs mb-6">No card required</p>

              <div className="flex flex-col flex-1 mb-6">
                <Feature label="Subtitle colour-coding"             checked color="#52525b" />
                <Feature label="10 word saves per day"              checked color="#52525b" />
                <Feature label="3 transcript analyses per day"      checked color="#52525b" />
                <Feature label="1 starter pet companion"            checked color="#52525b" />
                <Feature label="Unlimited word saves"               checked={false} color="#52525b" />
                <Feature label="Full SRS flashcards"                checked={false} color="#52525b" />
                <Feature label="All 8 pet companions"               checked={false} color="#52525b" />
              </div>

              <div className={`text-center text-sm font-semibold py-3.5 rounded-full
                ${currentPlan === 'free' ? 'text-[#52525b] bg-[#3f3f46]/30' : 'text-[#52525b]'}`}>
                {currentPlan === 'free' ? '✓ Current Plan' : 'Free forever'}
              </div>
            </div>
          </div>

          {/* FAMILY */}
          <div className="md:order-3 order-3">
            <div
              onMouseEnter={() => onCardEnter('family')}
              onMouseLeave={onCardLeave}
              className="bg-[#18181b] border border-[#6c3ff5] rounded-2xl p-6 flex flex-col
                         transition-all duration-200 hover:shadow-[0_0_40px_rgba(108,63,245,0.12)]"
            >
              <p className="text-[10px] font-black tracking-[0.2em] text-[#6c3ff5] mb-3">FAMILY</p>
              <div className="flex items-end gap-1 mb-0.5">
                <span className="text-4xl font-black">{fam.display}</span>
                <span className="text-[#a1a1aa] text-sm mb-1">/mo</span>
              </div>
              <p className="text-[#52525b] text-xs mb-0.5">{fam.label}</p>
              <p className="text-[#6c3ff5] text-xs font-bold mb-6">Up to 5 members</p>

              <div className="flex flex-col flex-1 mb-6">
                <Feature label="Everything in Pro for all members"  checked color="#6c3ff5" />
                <Feature label="Shared family dashboard"            checked color="#6c3ff5" />
                <Feature label="Each member's own pet & progress"   checked color="#6c3ff5" />
                <Feature label="Invite members by email"            checked color="#6c3ff5" />
                <Feature label="One subscription, five learners"    checked color="#6c3ff5" />
              </div>

              <button
                onClick={() => handlePurchase('family')}
                disabled={currentPlan === 'family'}
                className={`w-full py-3.5 rounded-full font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2
                  ${currentPlan === 'family'
                    ? 'bg-[#6c3ff5]/20 text-[#6c3ff5] cursor-default'
                    : 'bg-[#6c3ff5] text-white hover:brightness-110 active:scale-95 disabled:opacity-60 cursor-pointer'}`}
              >
                {currentPlan === 'family' ? '✓ Current Plan' : 'Get Family Plan'}
              </button>
            </div>
          </div>

        </div>

        {/* ── Pet showcase ─────────────────────────────────────── */}
        <PetShowcase currentPlan={currentPlan} onUpgradeClick={() => handlePurchase('pro')} />

        {/* ── Student CTA ──────────────────────────────────────── */}
        <p className="text-center mt-8 text-[#a1a1aa] text-sm">
          🎓 Student?{' '}
          <button
            onClick={() => setStudentOpen(true)}
            className="underline underline-offset-2 hover:text-[#4ade80] transition-colors font-medium"
          >
            Get Pro completely free →
          </button>
        </p>

        {/* ── Footer links ─────────────────────────────────────── */}
        <div className="flex flex-wrap justify-center gap-5 mt-10 text-[#52525b] text-xs">
          <button
            onClick={async () => {
              try {
                const { Purchases } = await import('@revenuecat/purchases-js');
                await (Purchases.getSharedInstance() as any).restorePurchases();
                toast.success('Purchases restored.');
              } catch { toast.error('Could not restore purchases.'); }
            }}
            className="hover:text-[#a1a1aa] transition-colors"
          >
            Restore Purchases
          </button>
          <a href="/privacy" className="hover:text-[#a1a1aa] transition-colors">Privacy</a>
          <a href="/terms"   className="hover:text-[#a1a1aa] transition-colors">Terms</a>
        </div>
      </section>

      {/* ── STRIPE CHECKOUT ──────────────────────────────────── */}
      <Dialog open={!!checkoutPriceId} onOpenChange={onCheckoutOpenChange}>
        <DialogContent className="max-w-2xl border-white/10 bg-[#18181b] text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Complete your purchase</DialogTitle>
          </DialogHeader>
          {checkoutPriceId && (
            <StripeEmbeddedCheckout
              priceId={checkoutPriceId}
              customerEmail={user?.email ?? undefined}
              userId={user?.id}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ── STUDENT MODAL ─────────────────────────────────────── */}
      {studentOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
          onClick={e => {
            if (e.target === e.currentTarget) {
              setStudentOpen(false);
              setStudentSent(false);
              setStudentEmail('');
              setStudentError('');
            }
          }}
        >
          <div className="bg-[#18181b] border border-[#3f3f46] rounded-2xl p-8 w-full max-w-md shadow-2xl">
            {studentSent ? (
              <div className="text-center py-4">
                <div className="text-5xl mb-4">📬</div>
                <p className="text-[#4ade80] font-bold text-lg mb-2">Verification email sent!</p>
                <p className="text-[#a1a1aa] text-sm">
                  Check your university inbox — we've sent you a verification link. Once verified, your Pro access activates automatically.
                </p>
                <button
                  onClick={() => { setStudentOpen(false); setStudentSent(false); setStudentEmail(''); }}
                  className="mt-6 text-[#52525b] text-sm hover:text-white underline"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold mb-1">Student verification</h2>
                <p className="text-[#a1a1aa] text-sm mb-6">
                  Enter your university email and we'll send a verification link. Once verified, Pro is yours — free.
                </p>
                <input
                  type="email"
                  value={studentEmail}
                  onChange={e => { setStudentEmail(e.target.value); setStudentError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleStudentSubmit()}
                  placeholder="you@university.ac.uk"
                  className="w-full bg-[#09090b] border border-[#3f3f46] rounded-xl px-4 py-3 text-white
                             placeholder-[#52525b] text-sm outline-none focus:border-[#4ade80] transition-colors mb-2"
                />
                {studentError && (
                  <p className="text-red-400 text-xs mb-3">{studentError}</p>
                )}
                <button
                  onClick={handleStudentSubmit}
                  disabled={!studentEmail.trim() || studentLoading}
                  className="w-full bg-[#4ade80] text-[#09090b] font-bold py-3 rounded-full mt-1
                             disabled:opacity-50 hover:brightness-110 transition-all flex items-center justify-center gap-2"
                >
                  {studentLoading ? <><Spinner /> Sending…</> : 'Verify my student email'}
                </button>
                <button
                  onClick={() => { setStudentOpen(false); setStudentEmail(''); setStudentError(''); }}
                  className="w-full mt-3 text-[#52525b] text-sm hover:text-white transition-colors py-1"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
