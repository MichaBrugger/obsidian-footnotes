# 05: navigation

Automated coverage: 12 former checks now live in test/sheet-05-navigation.test.ts and the smoke suite; run `npm test` and `npm run test:smoke` before this sheet.

Settings: `Edit footnotes in a popup` OFF for the first check, ON for the second. Every fixture is already in this note. Undo between checks.

Jump from this numbered reference[^1]; the filler below is what makes the scrolling matter.

- [ ] Reference to definition: the jump lands the caret CENTERED in the window, not parked against the top or bottom edge (the other direction, definition back to reference, is already measured by the smoke suite)

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

[^1]: the first numbered definition

## Definitions inside a list item (ruling 1, 2026-09-20)

Settings: defaults plus `Edit footnotes in a popup` ON. Reading view renders a footnote definition inside a list item; the plugin now navigates to one instead of appending a second definition, and Obsidian resolves the name for the popup itself, which is the half no test can watch.

- [^la]: a definition written right after the list marker
- item two

Uses: alpha[^la].

- [ ] Caret in `alpha[^la]`, numbered key with the popup ON: the popup opens on THAT definition, showing its text, and nothing is appended at the bottom
