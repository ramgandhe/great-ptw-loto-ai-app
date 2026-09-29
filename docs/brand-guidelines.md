# PermitWiseAI brand

## Name

**PermitWiseAI**, one word, capital P, W and AI. Not "Permit Wise AI", "PermitWise AI" or "PWAI".
In running text, the product name is enough; "the permit-to-work platform" describes it where needed.

## Logo

The mark is a signed-off permit (a sheet with a folded corner and a tick) on a rounded square, with a
small spark in the corner for the AI that checks each permit.

- Component: `BrandMark` in `frontend/src/components/marketing/site-header.tsx` (mark + wordmark).
- Favicon: `frontend/src/app/icon.svg` (the mark alone, default theme colour).
- Wordmark: "PermitWise" in the text colour, "AI" in the theme's primary colour.
- The mark uses theme tokens (`fill-primary`, `stroke-primary-foreground`), so it follows the active
  theme and dark mode. Do not recolour it by hand or add effects.
- Minimum size 16 px for the mark; keep clear space of at least a quarter of its height around it.

## Colour and type

Colours come from the theme tokens in `frontend/src/styles/themes.css` (default primary `#ff4530`).
Headings use the `font-heading` family; body text the default sans.

## Voice

Plain, direct and specific to site safety work: say what happens ("Permit approved", "Isolation
verified"), not marketing adjectives. Sentence case in the interface.
