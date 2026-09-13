/**
 * DentaFlow AI brand glyph — a stylized tooth. Stroke-based and drawn with
 * `currentColor`, so it inherits whatever text color its container sets (e.g.
 * `text-primary-foreground` inside the brand square). Replaces the generic
 * `Sparkles` mark (Sprint 33, founder request for a dental-appropriate icon).
 */
function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 5.5c-1.1 -1.15 -2.5 -1.5 -4 -1.5c-2.5 0 -4 1.5 -4 4c0 4 1 5 2 8c.7 2 .5 3.5 2 3.5c1.4 0 1.5 -2 2 -3.5c.35 -1 .5 -2 2 -2s1.65 1 2 2c.5 1.5 .6 3.5 2 3.5c1.5 0 1.3 -1.5 2 -3.5c1 -3 2 -4 2 -8c0 -2.5 -1.5 -4 -4 -4c-1.5 0 -2.9 .35 -4 1.5z" />
    </svg>
  )
}

export { BrandMark }
