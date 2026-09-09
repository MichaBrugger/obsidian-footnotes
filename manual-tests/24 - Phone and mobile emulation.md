# 24: phone and mobile-emulation checks

Run this sheet after a beta release has synced to the phone (BRAT beta in
the normal vault); these checks can't run against the sandbox vault's
dev build. The items marked "or emulation" have a desktop stopgap in
mobile emulation (`app.emulateMobile(true)`, which reloads the window;
run it again with `false` to leave), but the real phone is the ground
truth. Every fixture is already in this note.

Fixture reference[^menu] for the long-press check.

- [ ] PHONE: keyboard-aware dialogs (Android report 2026-08-28): run **Set footnote prefix** and tap into the field; with the keyboard open, the whole dialog (field, inline error, Create button) sits at the TOP of the screen above the keyboard, nothing hidden behind it. The fix lives in the shared modal base, so spot-check one of the Rename / Name-the-footnote dialogs the same way
- [ ] PHONE or emulation: long-press on `[^menu]` above: the menu shows **Rename footnote** with the pencil icon, opening the same modal as the command (the desktop right-click twin is sheet 10)
- [ ] PHONE or emulation: rapid popup entry, `Edit footnotes in a popup` ON: three fast rounds of press, type a few characters, press to close, press again; every definition below ends up with exactly the text typed for it, closing feels immediate, and the console (if reachable) shows no `Cannot read properties of undefined (reading 'split')` errors (the 2026-08-13 crash hit both modes; the desktop twin is sheet 04)
- [ ] PHONE or emulation: the plugin's commands sit on the mobile toolbar with their own icons and each one works from a tap (the popup stays open when a toolbar tap launches a command)

[^menu]: the definition to rename
