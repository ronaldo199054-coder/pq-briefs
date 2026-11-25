# PQ Briefs

A post-quantum pay-per-brief crypto research agent on QoreChain testnet.
Built for **Build Before Q-Day** (QoreChain), Track A — agents, Advanced level.

Every brief costs **0.1 QOR**, paid on-chain through a linked post-quantum
agent key. The spending budget is enforced **by the chain, not by this code**:
the owner wrote an on-chain rule (send QOR only, 1 QOR per payment, 3 QOR
per day) and QoreChain rejects any payment outside it. Signatures are hybrid
secp256k1 + ML-DSA-87, verified on-chain (`pqc_hybrid_verify`).

![PQ Briefs — post-quantum research, paid on-chain](assets/featured.webp)

## What it does

```
$ node pq-briefs.mjs brief BTC
PQ Briefs — BTC  [LIVE — CoinMarketCap]

Bitcoin (BTC) — rank #1
Price: $97,420.00 | 24h: +1.8% | 7d: +4.2% | 30d: -6.5%
Market cap: $1.94T | 24h volume: $38.20B
Circulating supply: 19,920,000 BTC

Bitcoin is the first decentralized cryptocurrency, created in 2009. It runs on a proof-of-work blockchain and is the largest crypto asset by market cap.

Verdict: up 4.2% over 7 days after a 6.5% drop over 30 days — a bounce, not a breakout. 24h volume is 2.0% of market cap — active trading. BTC is 56.8% of the whole market.
Data summary from CoinMarketCap, not investment advice.

— Payment receipt —
  fee           0.1 QOR per brief -> qor1lenmzwz7474cm9sqm6lltt4332fl9f5sul5y7e
  payer         qor1k359qh84lzt8qa5rqlrd5s79llwvn5daje4nzc (via linked PQ agent key)
  status        PAID
  tx            <tx hash>
  explorer      https://explore.qore.network/tx/<tx hash>
  signature     hybrid ML-DSA-87: verified
  fee balance   4.72 QOR -> 4.82 QOR (arrived: 0.10 QOR)
  rule          on-chain: send QOR only, 1 QOR per payment, 3 QOR per day — the chain enforces it, not this code.
```

If the chain refuses the payment, the brief is still printed but the receipt
is marked **REFUSED** with the reason — a receipt is never faked. The chain
proves it: an over-limit payment is included as a transaction but its
execution fails (`abstractaccount_execution_failed`) and no money moves.
Verified live on testnet 2026-11-25: a 2 QOR payment against a 1 QOR/tx rule
was refused while a 0.1 QOR payment went through.

## Why post-quantum + on-chain rules

- **The budget lives on-chain.** The agent holds an ed25519 key that may only
  spend inside the owner's on-chain spending rule. Even if the agent's code
  is compromised or buggy, it cannot overspend — the chain refuses. This is
  the difference between "the agent promises to stay in budget" and "the
  budget is a fact of the ledger".
- **The signatures are quantum-resistant.** Every transaction is signed
  hybrid secp256k1 + ML-DSA-87 and the ML-DSA-87 part is verified on-chain.
  The "Q-Day" this festival is named for is the day quantum computers break
  classical signatures — this agent is already signing the other way.
- **Every brief has a receipt.** The payment tx hash, explorer link, and the
  hybrid-verified flag are printed with the brief, so anyone can check that
  the brief was paid for and that the payment followed the rules.

## How to run

```bash
npm install
```

### 1. Link the agent first (once)

The agent key, owner account, and gas wallet are created and linked with the
Workshop 2 agent (`~/workspace/qorechain-build-before-qday/workshop-2/02-pq-agent/agent.mjs`):

```bash
cd ~/workspace/qorechain-build-before-qday/workshop-2/02-pq-agent
node agent.mjs init            # agent ed25519 key + gas wallet
node agent.mjs owner-init      # owner account
node agent.mjs register owner  # register owner's ML-DSA-87 key
node agent.mjs register gas    # register gas wallet's ML-DSA-87 key
node agent.mjs link 1 3 24     # 1 QOR per payment, 3 QOR per day, 24h
```

PQ Briefs reads the keys from `~/.config/qday/agent.env` and `owner.env`
(the same paths as the Workshop 2 agent). It never copies key files into
this repo.

### 2. CoinMarketCap key (live mode only)

```bash
cp .env.example .env
# put your key in .env: CMC_API_KEY=...
```

Or set `CMC_API_KEY` in the environment. `--mock` needs no key at all.

### 3. Commands

```bash
node pq-briefs.mjs brief BTC            # live brief + 0.1 QOR payment + receipt
node pq-briefs.mjs brief ETH --mock     # mock data (labeled), still pays 0.1 QOR on-chain
node pq-briefs.mjs rules                # on-chain spending rules + link status
node pq-briefs.mjs balance              # owner + gas wallet + fee address balances
node pq-briefs.mjs receipts             # recent payment transactions
```

## Fee model

- **0.1 QOR per brief**, paid from the owner account via the linked agent key.
- Fee recipient defaults to the gas wallet
  (`qor1lenmzwz7474cm9sqm6lltt4332fl9f5sul5y7e`) — the money cycles back
  into operations (paying the gas fees for the next brief). Override with
  `FEE_ADDRESS` in the environment or `.env`.
- The on-chain rule caps the agent at 1 QOR per payment and 3 QOR per day,
  so at most 30 briefs/day can be paid for even if the code misbehaves.

## Repo layout

| File | What it is |
|---|---|
| `pq-briefs.mjs` | CLI: `brief`, `rules`, `balance`, `receipts` |
| `qore.mjs` | QoreChain helpers — key derivation, REST+curl broadcast, agent payment, rules, receipts (adapted from Workshop 2 `agent.mjs`) |
| `brief.mjs` | CoinMarketCap client + brief formatter (faithful port of Python `cmc_agent` `brief_coin`) + labeled mock data (BTC/ETH) |
| `package.json` | deps: `@qorechain/sdk`, `@cosmjs/stargate`, `@noble/curves` |
| `examples/brief-BTC.md` | A brief + receipt from a live test run |
| `.env.example` | `CMC_API_KEY`, `FEE_ADDRESS` (no real secrets) |

## Security / honesty

- **Mock data is labeled.** `--mock` prints `[MOCK DATA — numbers are fixtures, not live prices]` and the data is the same fixture set as the Python CMC agent's mock.
- **No price predictions.** Verdicts are template-based comparisons of the
  numbers actually fetched (week vs month momentum, volume as a share of
  market cap), with the thresholds stated in the text.
- **No investment advice.** Every brief ends with
  "Data summary from CoinMarketCap, not investment advice."
- **No secrets in this repo.** The CMC key lives in `.env` (git-ignored) or
  the environment; the QoreChain keys live in `~/.config/qday/` and are
  never printed or copied here.
- **Testnet only.** QoreChain diana testnet, chain ID `qorechain-diana`.
  Never fund these accounts on mainnet.

## Networking note

This VM cannot POST to `rpc-testnet.qore.host` (requests hang) and Node
`fetch` drops large POST bodies through the VM proxy. Broadcast therefore
goes via the REST endpoint with `curl` (sign with `@qorechain/sdk`, write
the tx bytes to a temp file, `curl` POST to `/cosmos/tx/v1beta1/txs` with
mode `BROADCAST_MODE_SYNC`). REST reads use `fetch` (GET), which works.
See `qore.mjs` `broadcast()`.

## Status (2026-11-25)

- Repo built; `npm install` clean (84 packages); `rules` and `balance`
  show the live on-chain state (rule on, agent linked, expires
  2026-11-26T05:23Z).
- Brief formatter verified against the Python `brief_coin` output.
- **Mock BTC brief: PAID.** `node pq-briefs.mjs brief BTC --mock` paid
  0.1 QOR on-chain — tx
  `59C16799597213A05DFB9F046FA7E7AB4A0C5CB5F947EBD94222FE1B8EF28A6A`
  (code 0, height 10715423, hybrid ML-DSA-87 verified, 0.1 QOR owner →
  fee address, no execution failure). See `examples/brief-BTC.md`.
  The CLI run itself reported "fetch failed" because the REST broadcast
  endpoint was timing out and the response was lost; the transaction
  still landed and the hash was recovered via `receipts`.
- **Live ETH brief: pending.** Not yet run — the REST broadcast POST
  endpoint (`/cosmos/tx/v1beta1/txs`) is timing out from this VM
  (HTTP 000 after 30s on a direct curl test; GETs still work), and
  broadcast attempts in this session keep hitting an approval timeout.
  Re-run `node pq-briefs.mjs brief ETH` (live CMC data) once the
  endpoint recovers. The daily budget is fine: spend so far today is
  ~0.3 QOR against the 3 QOR/day rule.
- One unplanned 0.1 QOR payment landed during debugging (a trace script
  broadcast before its curl response timed out). It went to the fee
  address, same as a brief fee.
