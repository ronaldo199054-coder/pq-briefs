# Example: PQ Briefs — BTC

Run with `node pq-briefs.mjs brief BTC --mock` (mock data, labeled).
The fee payment below is a real on-chain transaction on QoreChain testnet.

```
PQ Briefs — BTC  [MOCK DATA — numbers are fixtures, not live prices]

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
  tx            59C16799597213A05DFB9F046FA7E7AB4A0C5CB5F947EBD94222FE1B8EF28A6A
  explorer      https://explore.qore.network/tx/59C16799597213A05DFB9F046FA7E7AB4A0C5CB5F947EBD94222FE1B8EF28A6A
  signature     hybrid ML-DSA-87: verified (dilithium5)
  rule          on-chain: send QOR only, 1 QOR per payment, 3 QOR per day — the chain enforces it, not this code.
```

Verified on-chain: code 0, height 10715423, gas used 217858. The
transaction's events show `coin_spent` 100000uqor from the owner and
`coin_received` 100000uqor to the fee address, with a `pqc_hybrid_verify`
event (`status: verified`, `algorithm_id: dilithium5`) and no
`abstractaccount_execution_failed` event.

Note: the CLI run that produced this payment reported "fetch failed"
because the REST broadcast endpoint was timing out and the response was
lost — the transaction itself still landed, and the hash was recovered
afterwards via `node pq-briefs.mjs receipts`. The broadcast response path
is flaky from this VM when the endpoint is slow; the payment is not.

## On-chain rule enforcement (verified live, Workshop 2 flow, 2026-11-25)

The same agent key and spending rule were already proven on-chain before
this repo existed:

- 0.1 QOR payment: **PAID**. Owner 94.64 → 94.54 QOR; tx
  `A4273986BC1B1E7C7B2CEDAFD072FC029BF8864F969355BE73F330389D8C2C11`,
  hybrid ML-DSA-87 verified.
- 2 QOR payment against the 1 QOR/tx rule: **REFUSED by the chain**.
  Owner balance unchanged, no money moved; the transaction carries an
  `abstractaccount_execution_failed` event. Tx
  `2A9591631341825A94F3F9F5457F69CF0520F2D9D954CCB92E4F16BAEE66A827`.
