import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { XpProvider } from "@/contexts/XpContext";
import { TourProvider } from "@/contexts/TourContext";
import { TourOverlay } from "@/components/TourOverlay";
import { DailyBriefing } from "@/components/DailyBriefing";
import { StreakCelebrationModal } from "@/components/StreakCelebrationModal";
import { XpToast } from "@/components/XpToast";
import Landing from "./pages/Landing";
import LandingPage2 from "./pages/LandingPage2";
import Browse from "./pages/Browse";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import Watch from "./pages/Watch";
import Flashcards from "./pages/Flashcards";
import StarterDeck from "./pages/StarterDeck";
import Vocabulary from "./pages/Vocabulary";
import Admin from "./pages/Admin";
import Story from "./pages/Story";
import Friends from "./pages/Friends";
import Onboarding from "./pages/Onboarding";
import Unsubscribe from "./pages/Unsubscribe";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Pricing from "./pages/Pricing";
import CheckoutReturn from "./pages/CheckoutReturn";
import Comprehension from "./pages/Comprehension";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <LanguageProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <XpProvider>
            <TourProvider>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/landing" element={<Landing />} />
                <Route path="/landingpage2" element={<LandingPage2 />} />
                <Route path="/browse" element={<Browse />} />
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
                <Route path="/checkout/return" element={<CheckoutReturn />} />
                <Route path="/comprehension" element={<Comprehension />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              <TourOverlay />
              <DailyBriefing />
              <StreakCelebrationModal />
              <XpToast />
            </TourProvider>
          </XpProvider>
        </BrowserRouter>
      </LanguageProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
