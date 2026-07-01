# Accessibility audit

Pixel Motion targets keyboard and pointer users, including children learning pixel art.

## Automated coverage

`npm run test:browser` verifies:

- every button has an accessible name;
- keyboard navigation moves focus to another interactive control;
- focused controls have a visible two-pixel accent outline;
- layer text meets the WCAG AA 4.5:1 contrast threshold;
- embedded layout does not clip the brand or creator credit;
- responsive layouts do not create page-level horizontal overflow.

## Implemented interaction support

- Native buttons, inputs, selects, and dialogs are used instead of clickable generic containers.
- Tool controls expose translated titles and `aria-label` values.
- Status messages use `role="status"`.
- The interface respects `prefers-reduced-motion`.
- A shared `:focus-visible` treatment is applied to interactive elements.

## Remaining manual audit

- Verify focus trapping and focus restoration for every dialog.
- Test Windows Narrator, NVDA, and VoiceOver announcements.
- Verify touch targets on real phones and tablets.
- Check all text/background pairs with a full-page contrast scanner.
- Test at 200% and 400% browser zoom.
