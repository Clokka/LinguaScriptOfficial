-- Landing A/B test v2: the real-loop demo page ("loop", /landing-7) vs the
-- early-access email page ("early", /landing-6). Conversion = Try free click
-- or early-access email. New key so v1 results stay readable.
INSERT INTO public.experiments(key, name, variants)
VALUES ('landing_page_v2', 'Landing page v2: app-loop demo vs early-access email', ARRAY['loop','early'])
ON CONFLICT (key) DO UPDATE SET status = 'running', variants = EXCLUDED.variants, updated_at = now();

-- One whole-page test at a time.
UPDATE public.experiments SET status = 'paused', updated_at = now() WHERE key = 'landing_page';
