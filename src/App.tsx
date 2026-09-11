import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { lazy, Suspense } from "react";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { XpProvider } from "@/contexts/XpContext";
import { TourProvider } from "@/contexts/TourContext";
import { TourOverlay } from "@/components/TourOverlay";
import { DailyBriefing } from "@/components/DailyBriefing";
import { StreakCelebrationModal } from "@/components/StreakCelebrationModal";
import { XpToast } from "@/components/XpToast";
import { InterestsPromptModal } from "@/components/InterestsPromptModal";
import { PetProvider } from "@/contexts/PetContext";
import { PetCompanion } from "@/components/pets/PetCompanion";
import { Loader2 } from "lucide-react";
// Marketing pages stay statically imported (unlike everything below) —
// they're a small shared chunk and not worth the added indirection of
// lazy-loading named exports out of a barrel file.
import {
  ChameleonMethodPage,
  DualSubtitlesPage,
  NetflixSubtitlesPage,
  YouTubeSubtitlesPage,
  SpacedRepetitionPage,
  VsLanguageReactorPage,
  ChromeExtensionPage,
  ForSchoolsPage,
  PolyglotPage,
  FamilyPage,
  LearningSciencePage,
} from "./pages/marketing/pages";

// Every route used to be a static import, so visiting ANY page — including
// /auth, which should be the fastest thing in the app — forced the browser
// to download and parse one ~2.8MB bundle containing Watch, Admin, Teacher,
// the Remotion studio pages, etc. before it could render anything. Splitting
// each route into its own lazy chunk means a page only pays for its own code.
const Landing = lazy(() => import("./pages/Landing"));
const LandingPage2 = lazy(() => import("./pages/LandingPage2"));
const LandingPage3 = lazy(() => import("./pages/LandingPage3"));
const LandingPage4 = lazy(() => import("./pages/LandingPage4"));
const Landing5 = lazy(() => import("./pages/Landing5"));
const GapDemo = lazy(() => import("./pages/GapDemo"));
const Demo = lazy(() => import("./pages/Demo"));
const Browse = lazy(() => import("./pages/Browse"));
const Auth = lazy(() => import("./pages/Auth"));
const Profile = lazy(() => import("./pages/Profile"));
const Watch = lazy(() => import("./pages/Watch"));
const Flashcards = lazy(() => import("./pages/Flashcards"));
const StarterDeck = lazy(() => import("./pages/StarterDeck"));
const Vocabulary = lazy(() => import("./pages/Vocabulary"));
const Admin = lazy(() => import("./pages/Admin"));
const Story = lazy(() => import("./pages/Story"));
const Friends = lazy(() => import("./pages/Friends"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Upgrade = lazy(() => import("./pages/Upgrade"));
const CheckoutReturn = lazy(() => import("./pages/CheckoutReturn"));
const Privacy = lazy(() => import("./pages/Privacy"));
const PrivacyExtension = lazy(() => import("./pages/PrivacyExtension"));
const Terms = lazy(() => import("./pages/Terms"));
const Teacher = lazy(() => import("./pages/Teacher"));
const Progress = lazy(() => import("./pages/Progress"));
const GiftClaim = lazy(() => import("./pages/GiftClaim"));
const MieoFrames = lazy(() => import("./pages/MieoFrames"));
const OnboardingMobile = lazy(() => import("./pages/OnboardingMobile"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));
const LinguaScripts = lazy(() => import("./pages/LinguaScripts"));
const Credits = lazy(() => import("./pages/Credits"));
const ChameleonMethod = lazy(() => import("./pages/ChameleonMethod"));
const ProGiftClaim = lazy(() => import("./pages/ProGiftClaim"));
const ProChameleonClaim = lazy(() => import("./pages/ProChameleonClaim"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPostPage = lazy(() => import("./pages/BlogPost"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

const App = () => (
  <HelmetProvider>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <LanguageProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <XpProvider>
            <PetProvider>
            <TourProvider>
              <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/landing" element={<Landing />} />
                <Route path="/landingpage2" element={<LandingPage2 />} />
                <Route path="/landingpage3" element={<LandingPage3 />} />
                <Route path="/landingpage4" element={<LandingPage4 />} />
                <Route path="/landing5" element={<Landing5 />} />
                <Route path="/gap-demo" element={<GapDemo />} />
                <Route path="/demo" element={<Demo />} />
                <Route path="/browse" element={<Navigate to="/discover" replace />} />
                <Route path="/browse1" element={<Navigate to="/discover" replace />} />
                <Route path="/browse2" element={<Navigate to="/discover" replace />} />
                <Route path="/discover" element={<Browse />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/watch/:id" element={<Watch />} />
                <Route path="/flashcards" element={<Flashcards />} />
                <Route path="/flashcards/starter/:slug" element={<StarterDeck />} />
                <Route path="/vocabulary" element={<Vocabulary />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/story" element={<Story />} />
                <Route path="/friends" element={<Friends />} />
                <Route path="/onboarding" element={<Onboarding />} />
                <Route path="/unsubscribe" element={<Unsubscribe />} />
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/upgrade" element={<Upgrade />} />
                <Route path="/checkout/return" element={<CheckoutReturn />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/privacy-extension" element={<PrivacyExtension />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/teacher" element={<Teacher />} />
                <Route path="/progress" element={<Progress />} />
                <Route path="/gift" element={<GiftClaim />} />
                <Route path="/pro-gift" element={<ProGiftClaim />} />
                <Route path="/pro-chameleon" element={<ProChameleonClaim />} />
                <Route path="/thechameleonmethod" element={<ChameleonMethod />} />
                <Route path="/credits" element={<Credits />} />
                <Route path="/mieoframes" element={<MieoFrames />} />
                <Route path="/onboarding/mobile" element={<OnboardingMobile />} />
                <Route path="/welcome" element={<OnboardingMobile />} />
                <Route path="/linguascript" element={<LinguaScripts />} />
                <Route path="/linguascripts" element={<Navigate to="/linguascript" replace />} />
                <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
                <Route path="/blog" element={<Blog />} />
                <Route path="/blog/:slug" element={<BlogPostPage />} />
                <Route path="/the-chameleon-method" element={<ChameleonMethodPage />} />
                <Route path="/dual-subtitles" element={<DualSubtitlesPage />} />
                <Route path="/dual-subtitles/netflix" element={<NetflixSubtitlesPage />} />
                <Route path="/dual-subtitles/youtube" element={<YouTubeSubtitlesPage />} />
                <Route path="/anki-alternative" element={<SpacedRepetitionPage />} />
                <Route path="/spaced-repetition" element={<Navigate to="/anki-alternative" replace />} />
                <Route path="/vs/language-reactor" element={<VsLanguageReactorPage />} />
                <Route path="/chrome-extension" element={<ChromeExtensionPage />} />
                <Route path="/language-learning-psychology" element={<LearningSciencePage />} />
                <Route path="/for-schools" element={<ForSchoolsPage />} />
                <Route path="/polyglot" element={<PolyglotPage />} />
                <Route path="/family" element={<FamilyPage />} />
                <Route path="/lingoscript" element={<Navigate to="/the-chameleon-method" replace />} />
                <Route path="/language-script" element={<Navigate to="/the-chameleon-method" replace />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
              <TourOverlay />
              <DailyBriefing />
              <StreakCelebrationModal />
              <XpToast />
              <InterestsPromptModal />
              {/* PetCompanion removed per user request */}
            </TourProvider>
            </PetProvider>
          </XpProvider>
        </BrowserRouter>
      </LanguageProvider>
    </TooltipProvider>
  </QueryClientProvider>
  </HelmetProvider>
);

export default App;
