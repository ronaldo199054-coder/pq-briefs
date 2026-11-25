// pq-briefs.mjs — PQ Briefs: a post-quantum pay-per-brief crypto research agent.
//
// Every brief costs 0.1 QOR, paid on QoreChain testnet through a linked
// post-quantum agent key. The spending budget is enforced by the chain, not
// by this code: the owner wrote an on-chain rule (send QOR only, 1 QOR per
// payment, 3 QOR per day) and the chain rejects any payment outside it.
// Signatures are hybrid secp256k1 + ML-DSA-87, verified on-chain.
//
//   node pq-briefs.mjs brief <SYMBOL> [--mock]   brief + pay 0.1 QOR + receipt
//   node pq-briefs.mjs rules                     on-chain spending rules + link status
//   node pq-briefs.mjs balance                   owner + gas wallet balances
//   node pq-briefs.mjs receipts                  recent payment transactions
//
// Live CMC data needs CMC_API_KEY (env or .env). --mock uses labeled mock
// data and needs no key. Keys are read from ~/.config/qday/ (same as the
// Workshop 2 agent); nothing secret is ever printed or stored in this repo.
import { readFileSync } from "node:fs";
import { fetchCoinLive, fetchCoinMock, briefCoin, FOOTER } from "./brief.mjs";
import {
  CHAIN_ID, EXPLORER, FEE_QOR, DEFAULT_FEE_ADDRESS,
  owner, gas, agentKey, balance, fmt, hex, payFee, getRules, listReceipts,
} from "./qore.mjs";

const feeAddress = process.env.FEE_ADDRESS ?? DEFAULT_FEE_ADDRESS;
const usage = readFileSync(new URL(import.meta.url), "utf8")
  .split("\n").filter((l) => l.startsWith("//")).map((l) => l.slice(3)).join("\n");

const cmds = {
  async brief(symbol, ...rest) {
    if (!symbol) { console.log("usage: node pq-briefs.mjs brief <SYMBOL> [--mock]"); process.exitCode = 1; return; }
    const mock = rest.includes("--mock");
    symbol = symbol.toUpperCase();
    let data;
    try {
      data = mock ? fetchCoinMock(symbol) : await fetchCoinLive(symbol);
    } catch (e) {
      console.error(`error: could not fetch ${symbol}: ${e.message}`);
      process.exitCode = 1;
      return;
    }
    const brief = briefCoin(data.coin, data.info, data.metrics);
    const label = data.mock ? "MOCK DATA — numbers are fixtures, not live prices" : "LIVE — CoinMarketCap";
    const memo = `pq-briefs ${symbol} ${FEE_QOR} QOR`;

    // Pay the fee first (the brief is printed either way; the receipt shows
    // honestly whether the payment went through).
    const before = await balance(feeAddress);
    const pay = await payFee(feeAddress, FEE_QOR, memo);
    const after = await balance(feeAddress);

    console.log(`PQ Briefs — ${symbol}  [${label}]`);
    console.log("");
    console.log(brief);
    console.log("");
    console.log("— Payment receipt —");
    console.log(`  fee           ${FEE_QOR} QOR per brief -> ${feeAddress}`);
    console.log(`  payer         ${(await owner()).cosmos} (via linked PQ agent key)`);
    if (pay.ok) {
      console.log(`  status        PAID`);
      console.log(`  tx            ${pay.hash}`);
      console.log(`  explorer      ${EXPLORER}${pay.hash}`);
      console.log(`  signature     ${pay.hybrid ? "hybrid ML-DSA-87: verified" : "hybrid check not returned"}`);
      console.log(`  fee balance   ${fmt(before)} -> ${fmt(after)} (arrived: ${fmt(String(BigInt(after) - BigInt(before)))})`);
    } else {
      console.log(`  status        REFUSED — ${pay.reason}`);
      if (pay.hash) console.log(`  tx            ${pay.hash}\n  explorer      ${EXPLORER}${pay.hash}`);
      console.log(`  note          the brief above is still shown; no receipt was faked.`);
    }
    console.log(`  rule          on-chain: send QOR only, 1 QOR per payment, 3 QOR per day — the chain enforces it, not this code.`);
    if (!pay.ok) process.exitCode = 1;
  },

  async rules() {
    const r = await getRules();
    console.log(`account ${r.owner}  balance ${fmt(r.balance)}`);
    for (const x of r.rules) console.log(`  rule "${x.id}" ${x.enabled ? "on" : "off"}: per payment ${fmt(x.perTxLimit)}, per day ${fmt(x.dailyLimit)}, denoms ${x.allowedDenoms.join(",") || "any"}`);
    if (!r.agent) { console.log("  agent key: not linked"); return; }
    console.log(`  agent key: ${r.agent.revoked ? "REVOKED" : "linked"}, may: ${r.agent.permissions.join(",")}, expires ${new Date(Number(r.agent.expiryUnix) * 1000).toISOString().slice(0, 16)}Z, payments made: ${r.paymentsMade}`);
  },

  async balance() {
    const o = await owner(), g = await gas();
    console.log(`owner       ${o.cosmos}  ${fmt(await balance(o.cosmos))}`);
    console.log(`gas wallet  ${g.cosmos}  ${fmt(await balance(g.cosmos))}`);
    console.log(`fee address ${feeAddress}  ${fmt(await balance(feeAddress))}`);
  },

  async receipts() {
    const list = await listReceipts(10);
    if (!list.length) { console.log("no transactions found for owner / gas wallet"); return; }
    for (const t of list) {
      console.log(`${t.hash}  height ${t.height}  code ${t.code}  ${t.memo ? `memo "${t.memo}"` : ""}  ${t.amounts.join(" ") || ""}  (sender ${t.sender.slice(0, 14)}...)`);
      console.log(`    ${EXPLORER}${t.hash}`);
    }
  },
};

const [cmd, ...args] = process.argv.slice(2);
if (!cmds[cmd]) {
  console.log(usage);
  process.exit(cmd ? 1 : 0);
}
cmds[cmd](...args).catch((e) => { console.error(`error: ${e?.message ?? e}`); process.exitCode = 1; });
