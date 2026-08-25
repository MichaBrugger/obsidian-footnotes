# Agent instructions

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues (`MichaBrugger/obsidian-footnotes`), driven through the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Stock GitHub labels reused where they carry the meaning (`question`, `help wanted`, `wontfix`); `needs-triage` is the only added label, and the AFK-agent role is unused. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` at the repo root plus `docs/adr/`, both created lazily by `/domain-modeling` when terms or decisions actually get resolved. See `docs/agents/domain.md`.
