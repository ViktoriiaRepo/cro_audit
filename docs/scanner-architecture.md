# Scanner Architecture

The scanner should be a separate module from scoring and UI code. Its job is to inspect a storefront, collect evidence, and emit structured findings.

## Scanner Goals

- Detect whether the site is Shopify.
- Find relevant pages automatically.
- Check for checklist signals on those pages.
- Collect evidence such as selectors, text, metadata, and links.

## Page Discovery Strategy

1. Load homepage.
2. Detect Shopify fingerprints.
3. Find collection links.
4. Find product links.
5. Find cart link.
6. Detect policy pages from footer or known routes.

## Detection Signals

### Shopify Detection

- `/cdn/shop/` assets
- `Shopify` global objects
- `shopify`-related script URLs
- known theme markers

### CRO Checks

- announcement bar text or fixed top strip
- site search input or search icon
- cart link or cart drawer trigger
- add-to-cart button on PDP
- sticky add-to-cart element
- review widgets or review text
- product rating stars or schema
- upsell or bundle components
- wishlist triggers
- policy links in footer
- free shipping messaging
- social profile links
- mobile menu trigger
- H1 on key pages
- meta title and meta description
- broken links from sampled internal links
- PageSpeed score from optional API

## Scanner Output

The scanner should return structured data, not final strategy.

Example output categories:

- page metadata
- detected features
- missing features
- confidence score
- evidence references

## Implementation Notes

- Use Playwright for rendering and DOM inspection.
- Keep all selectors and heuristics isolated in one folder.
- Separate deterministic checks from optional AI or recommendation layers.
- Make each check independently testable.
