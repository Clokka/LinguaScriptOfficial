# Why video recommendations are empty — and the fix

## What I found

I called the video search service directly and traced every step. Three separate problems, each enough on its own to empty the rails:

1. **The YouTube daily quota is already used up.** The service now answers "Quota exceeded for Search Queries per day". YouTube allows 100 searches a day on this key; the Discover page fires 4–6 searches *per visitor, per language, per level*, and results are only cached in that one person's browser tab. A handful of visitors burns the whole day's allowance, and everyone after them sees nothing.

2. **The filters were impossibly strict.** Of 20 results from YouTube, the old rules kept 0: videos had to be 8–15 minutes long, have 5,000+ views, a strong like ratio, and *human-typed* captions. That last one is the killer — YouTube only reports "has captions" for manually uploaded tracks, so the vast majority of perfectly good videos (auto-captions, which our player reads fine) were thrown away. *(Already fixed and deployed: 3–20 min band, 1,000 views, captions are now a ranking bonus instead of a requirement.)*

3. **Unscoreable videos are silently dropped.** After the search, the app fetches each video's captions in the browser to match it against your vocabulary. Any video whose captions fail to load is discarded entirely — so even a good search result set can end up showing an empty rail with no explanation.

## The fix

**A. Shared search cache (the big one)**
Store each search's results in the database for 24 hours, keyed by language + query + level, shared by every user. The same rails today would cost a handful of searches instead of hundreds. Also lets the page keep working after quota runs out, serving yesterday's cached results instead of nothing.

**B. Never show an empty rail**
If caption scoring can't score anything, show the best metadata-ranked videos instead, without a comprehension badge. If the search itself fails or quota is gone, fall back to the curated catalog and say plainly that fresh picks are on the way.

**C. Fewer searches per page**
Load the "Recommended" rail first; only fetch interest rails when the learner scrolls to them. Trending and Beginner rails share a cached query per language.

**D. Honest quota visibility in Admin**
A small panel showing today's search count and whether the cache is serving, so this fails loudly next time instead of silently.

## Technical notes

- New table `youtube_search_cache (cache_key text pk, language text, items jsonb, created_at timestamptz)`, written by the `youtube-search` edge function with the service role; public read denied, function-only access. TTL 24h, checked before any YouTube call; on a quota error return the stale entry if one exists, flagged `stale: true`.
- `PersonalizedRails.tsx`: fall back to unranked `rec` items when `rankByComprehension` returns empty; render an explanatory state instead of nothing when `items` is empty; lazy-load interest rails via `IntersectionObserver`.
- Language purity filter stays as-is; it is behaving correctly.
- Search queries also get the learner's language name in-language (e.g. "recettes" not "French cooking") so `relevanceLanguage` and the purity filter stop fighting each other.
