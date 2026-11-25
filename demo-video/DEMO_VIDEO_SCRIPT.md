# PQ Briefs — Demo Video Script (90s, 9 scenes x 10s, vertical 1080x1920)

Submission: QoreChain Build Before Q-Day, Track A (agents).
Repo: https://github.com/ronaldo199054-coder/pq-briefs
Composition: `PqBriefsEn` in `~/workspace/remotion-hydrogen-test/src/PqBriefsEn.tsx`
(2700 frames @ 30fps). Render: `npx remotion render PqBriefsEn out/pq-briefs-demo.mp4 --overwrite`.
Voiceover: English, TTS (`/opt/hatch/bin/tts`, default voice), one segment per
scene, mixed at 10s offsets with ffmpeg `adelay` + `amix`. All segments ≤ 9.5s
(seg3, seg5, seg6 re-recorded at speed 120 to fit).

## Narration (exact, one line per scene)

1. (0–10s, hook) "Every AI agent can spend money. Almost none can prove it stayed inside its budget. This is PQ Briefs." (6.6s)
2. (10–20s, problem) "An agent that pays for data needs a budget the chain enforces, not a promise buried in code." (5.4s)
3. (20–30s, answer) "QoreChain gives the agent a post-quantum key. The owner writes the rule on chain: one QOR per payment, three per day. Every signature is verified on chain." (8.5s, speed 120)
4. (30–40s, product) "PQ Briefs turns that into a product. A crypto research brief that costs zero point one QOR, paid on chain, with a receipt for every brief." (8.7s)
5. (40–50s, live demo) "Here it is live. Brief ETH. Real CoinMarketCap data. Sixteen forty dollars, down nine percent this week. Paid: zero point one QOR. Signature verified." (8.9s, speed 120)
6. (50–60s, proof) "Here is the proof the chain is the boss. A two QOR payment over the limit was rejected. The money never moved. The tool said paid. The chain said no." (8.3s, speed 120)
7. (60–70s, run it) "To run it: install, set your CoinMarketCap key or use mock mode, link the agent, and ask for a brief." (7.2s)
8. (70–80s, repo) "Everything is in the repo: the CLI, the post-quantum helpers, the brief formatter, the examples. MIT licensed, public on GitHub." (8.1s)
9. (80–90s, close) "PQ Briefs. Research you can audit. Payments you can verify. Build Before Q-Day, Track A." (6.6s)

## On-screen content per scene

1. Hero (featured image) — title "PQ Briefs", hook text.
2. Text — "A budget is not a promise".
3. Text — "Post-quantum agent keys" (1 QOR/tx, 3 QOR/day, hybrid ML-DSA-87).
4. Text — "A brief costs 0.1 QOR".
5. Terminal (real data) — `node pq-briefs.mjs brief ETH`: ETH $1,640.94,
   24h -2.9%, 7d -9.3%, 30d -29.3%, market cap $200.61B, 24h volume $10.98B,
   verdict "down on both the week (-9.3%) and the month (-29.3%)"; receipt:
   PAID, tx 6C136E1F…82685A4, hybrid ML-DSA-87: verified, fee 0.1 QOR.
   (Live run 2026-11-25, code 0, verified on-chain.)
6. Terminal (real test) — 2 QOR over-limit payment: tool printed "PAID" but the
   chain returned `abstractaccount_execution_failed`; owner balance unchanged,
   gas wallet received nothing, money never moved.
7. Terminal — `npm install`, `export CMC_API_KEY=…` (or `--mock`),
   `node agent.mjs link 1 3 24`, `node pq-briefs.mjs brief BTC`.
8. Text — repo contents: pq-briefs.mjs, qore.mjs, brief.mjs, examples/, MIT.
9. Hero (featured image) — "Research you can audit." + repo URL + Track A.

## Honesty notes

- Every number on screen is from the real 2026-11-25 test runs (mock BTC tx
  59C16799…EF28A6A; live ETH tx 6C136E1F…82685A4 and 855DC66B…69D62B7, all
  code 0, hybrid verified). No fabricated brief.
- Scene 6 is the honest point: the example tool mislabeled the rejected payment
  as "PAID". The chain is the enforcer, not the code.
- Briefs carry the footer "Data summary from CoinMarketCap, not investment
  advice." No price predictions anywhere in the video.
