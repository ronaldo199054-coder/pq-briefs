# AI Usage

This project was built with AI tools. This file documents how, as required
for the Build Before Q-Day AI-Native special award.

## What AI did

- **Code**: The Node.js CLI (`pq-briefs.mjs`), the QoreChain helpers
  (`qore.mjs`), and the CMC brief formatter (`brief.mjs`) were written with
  Muse (Meta's AI coding assistant), working from the Workshop 2 bill-paying
  agent and the Python CMC agent as references. The author reviewed, tested,
  and debugged the code; all on-chain results were verified against the
  QoreChain testnet explorer and REST API.
- **Brief text**: The brief format is a deterministic port of the Python
  `brief_coin` function from the author's CMC agent — template-based, no LLM
  generation, every number from the CoinMarketCap API response.
- **Featured image**: `assets/featured.webp` was generated with an AI image
  model from a text prompt (quantum lattice dome, crypto charts, payment
  receipt).
- **Demo video**: Built with Remotion (code-driven animation, not AI video
  generation). The voiceover is AI text-to-speech, one segment per scene.
  All numbers and transaction hashes in the video are from real testnet runs.

## What AI did not do

- No on-chain action was taken by AI alone. Every payment was executed by
  the author through the linked agent key, within on-chain spending rules
  the author wrote, and verified on-chain (code 0, `pqc_hybrid_verify`).
- No price predictions. Briefs are summaries of fetched data only, with a
  "not investment advice" footer.
- The author owns the design, the spending rules, the test plan, and the
  final submission.
