# L16: CJK fullwidth punctuation (2026-08-10)

Settings: all rules ON; second item needs `Insert footnote at end of word` ON.

Chinese sentence 中文句子[^j1]。 and mixed wait[^j2]？!

[^j1]: jp one
[^j2]: jp two

- [ ] Lint swaps across the fullwidth stop: the reference hops after the 。 and `[^j2]？!` crosses both marks
- [ ] Autonumber mid-word in `中文。` lands the reference AFTER the fullwidth stop
