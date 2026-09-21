# 06: selection to footnote

Automated coverage: 31 former checks now live in test/sheet-06-selection-to-footnote.test.ts and the smoke suite; run `npm test` and `npm run test:smoke` before this sheet.

Settings: defaults. Undo between checks. Every fixture is already in this note. Tables are sheet 08 and the block zoo is sheet 07; what is left here is the handful of things only eyes and a real editor can settle.

This fixture keeps a numbered footnote alive[^5] for the name-collision check below.

[^5]: five

## Undo and the popup

Select the words `move this aside` in the next line before each press:

The paragraph wants to move this aside for later readers. A second sentence rides along for the multi-line checks.

- [ ] NUMBERED hotkey, then undo ONCE: the sentence is back exactly as it was, definition and all, in a single step; the same for the NAMED hotkey's modal flow (type a name, Enter, one undo)
- [ ] With `Edit footnotes in a popup` ON, select BOTH sentences of that paragraph plus this line and press the NUMBERED hotkey: the popup opens showing the whole multi-paragraph body, and no Properties widget bleeds into it

## The name modal

- [ ] With a selection and the NAMED hotkey: typing `5` (a name another footnote already uses) or a name with a space shows the reason inline and the modal STAYS OPEN; Escape cancels with nothing changed; with an invalid name typed, pressing any footnote hotkey shows the same inline reason and keeps the modal open

## Rendering and alignment

The line above the fence.

```
select me in here
```

- [ ] Select the fence above ALONE (opening ``` through closing ```) and press the NUMBERED hotkey: the new footnote renders as a code block in Reading view, even though its label line is empty; then undo and select from `The line above the fence.` through the closing ``` instead: that one renders as a paragraph followed by the code block

- [ ] With the popup ON, open it on the heading definition below: the top of the heading sits level with the top of the `[^h]:` label, as in the core Footnotes view (tuned live 2026-09-09); a plain one-line definition lines up as before. In the core Footnotes view itself, click into that heading footnote: its heading stays level with the id while editing (the plugin strips the editor's heading padding there too), and the label colour and gap follow the sidebar's theme variables

A reference for the heading fixture[^h].

[^h]: # A heading starts this definition's body
