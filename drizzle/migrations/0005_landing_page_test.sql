-- Whole-page landing A/B test: Landing5 ("current") vs LandingClear ("clear").
INSERT INTO public.experiments(key, name, variants)
VALUES ('landing_page', 'Landing page: current vs clear (benefit-first, one button)', ARRAY['current','clear'])
ON CONFLICT (key) DO UPDATE SET status = 'running', variants = EXCLUDED.variants, updated_at = now();

-- Pause the headline test so two tests don't run on the same page at once.
UPDATE public.experiments SET status = 'paused', updated_at = now() WHERE key = 'landing_headline';
