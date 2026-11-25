// qore.mjs — QoreChain post-quantum helpers for PQ Briefs.
//
// Adapted from the Workshop 2 bill-paying agent (QoreChain "Build Before Q-Day",
// workshop-2/02-pq-agent/agent.mjs). The agent.mjs CLI itself is not imported;
// the needed logic is copied here with the same semantics.
//
// Three keys, three roles (same as Workshop 2):
//   owner  hybrid secp256k1 + ML-DSA-87 account. Holds the money, sets the rules.
//   agent  an ed25519 key. It can ask to spend from the owner, but only inside
//          the on-chain spending rules the owner wrote.
//   gas    a small hybrid fee wallet. It submits the agent's requests and pays
//          the fees. It never holds the owner's money.
//
// Networking note (2026-11-25): this VM cannot POST to rpc-testnet.qore.host
// (requests hang) and Node fetch drops large POST bodies through the VM proxy.
// Broadcast therefore goes via the REST endpoint with curl: sign with
// @qorechain/sdk, write the tx bytes to a temp file, curl POST to
// /cosmos/tx/v1beta1/txs with mode BROADCAST_MODE_SYNC. REST reads use fetch
// (GET), which works fine. Never POST to the RPC endpoint.
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { ed25519 } from "@noble/curves/ed25519";
import {
  EthNativeSigner, deriveUnifiedAccount,
  buildPhantomExecuteCosmos, fetchAuthNonce, fetchSpendingRules,
  fetchAuthenticators, decodeAuthenticatorExecutions, resolveSignBytesVersion,
} from "@qorechain/sdk";

export const CHAIN_ID = "qorechain-diana";
export const REST = process.env.QORE_REST ?? "https://api-testnet.qore.host";
export const EXPLORER = "https://explore.qore.network/tx/";
export const FEE_QOR = "0.1";
export const DEFAULT_FEE_ADDRESS = "qor1lenmzwz7474cm9sqm6lltt4332fl9f5sul5y7e";

const DIR = process.env.QDAY_DIR ?? join(homedir(), ".config", "qday");
const OWNER_ENV = process.env.OWNER_ENV ?? join(DIR, "owner.env");
const AGENT_ENV = process.env.AGENT_ENV ?? join(DIR, "agent.env");

const readEnv = (file) => {
  if (!existsSync(file)) throw new Error(`missing ${file}: link the agent first with the Workshop 2 agent (node agent.mjs init / owner-init / link)`);
  return Object.fromEntries(readFileSync(file, "utf8").split("\n").filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"(.*)"$/, "$1")]));
};

export const toUqor = (qor) => {
  if (!/^\d+(\.\d{1,6})?$/.test(String(qor))) throw new Error(`amount in QOR, e.g. 0.1 (got "${qor}")`);
  const [i, f = ""] = String(qor).split(".");
  return (BigInt(i) * 1000000n + BigInt((f + "000000").slice(0, 6))).toString();
};
export const fmt = (uqor) => `${(Number(uqor) / 1e6).toLocaleString("en-US", { maximumFractionDigits: 6 })} QOR`;
export const hex = (b) => Buffer.from(b).toString("hex");

export const owner = async () => deriveUnifiedAccount(readEnv(OWNER_ENV).QORE_MNEMONIC, 0);
export const gas = async () => deriveUnifiedAccount(readEnv(AGENT_ENV).GAS_MNEMONIC, 0);
export const agentKey = () => {
  const sk = Uint8Array.from(Buffer.from(readEnv(AGENT_ENV).AGENT_ED25519_KEY, "hex"));
  const pk = ed25519.getPublicKey(sk);
  return { sk, pk, wallet: { publicKey: pk, async signMessage(m) { return { signature: ed25519.sign(m, sk) }; } } };
};

export async function getJson(path) {
  const r = await fetch(`${REST}${path}`);
  return r.status === 200 ? r.json() : null;
}

export async function balance(addr) {
  const b = await getJson(`/cosmos/bank/v1beta1/balances/${addr}`);
  return b?.balances?.find((x) => x.denom === "uqor")?.amount ?? "0";
}

// The account query returns a flat account object (account_number/sequence
// directly on `account`) once the account is a hybrid account; fall back to
// base_account for plain accounts.
export async function getAccount(addr) {
  const a = await getJson(`/cosmos/auth/v1beta1/accounts/${addr}`);
  const base = a?.account?.base_account ?? a?.account ?? {};
  return { accountNumber: BigInt(base.account_number ?? 0), sequence: BigInt(base.sequence ?? 0) };
}

// Sign with the account's keys and broadcast via REST + curl (see header note).
// mode: "hybrid" (normal) or "classical" (only for the one-time PQ key registration).
// If local curl times out and QORE_BROADCAST_VIA=niubility is set, the signed
// bytes are broadcast from the niubility machine instead (its egress reaches
// the REST endpoint when this VM's proxy stalls). Default is local only.
export async function broadcast(acc, messages, memo, mode = "hybrid") {
  const { accountNumber, sequence } = await getAccount(acc.cosmos);
  const signer = new EthNativeSigner(acc, { signMode: mode, rest: REST });
  const params = { chainId: CHAIN_ID, accountNumber, sequence, memo, messages, fee: { amount: [{ denom: "uqor", amount: "120000" }], gas: "800000" } };
  if (mode === "hybrid") params.signBytesVersion = await resolveSignBytesVersion({ chainId: CHAIN_ID, rest: REST });
  const signed = await signer.sign(params);
  const body = JSON.stringify({ tx_bytes: Buffer.from(signed.txRawBytes).toString("base64"), mode: "BROADCAST_MODE_SYNC" });
  const tmp = `/tmp/qore-broadcast-${Date.now()}-${Math.floor(Math.random() * 1e6)}.json`;
  writeFileSync(tmp, body);
  let out;
  try {
    out = execFileSync("curl", ["-s", "-m", "30", "-X", "POST", `${REST}/cosmos/tx/v1beta1/txs`, "-H", "Content-Type: application/json", "--data", `@${tmp}`], { encoding: "utf8" });
  } catch (e) {
    if (process.env.QORE_BROADCAST_VIA !== "niubility") throw e;
    // Fallback: broadcast from niubility (its network reaches the endpoint).
    const bodyB64 = Buffer.from(body).toString("base64");
    const cmd = `echo ${bodyB64} | base64 -d > /tmp/qore-tx.json && curl -s -m 40 -X POST "${REST}/cosmos/tx/v1beta1/txs" -H "Content-Type: application/json" --data @/tmp/qore-tx.json`;
    const res = execFileSync("python3", [join(homedir(), "workspace/custom-connectors/custom.instabox/bin/instabox.py"), "exec", "niubility", cmd], { encoding: "utf8", timeout: 120000 });
    out = JSON.parse(res).stdout;
  } finally { try { unlinkSync(tmp); } catch {} }
  const resp = JSON.parse(out).tx_response ?? {};
  return { code: resp.code ?? -1, transactionHash: resp.txhash ?? "", rawLog: resp.raw_log ?? "", msgResponses: [], events: [] };
}

// The chain's own record of the transaction: code, events, hybrid check.
export async function onChain(hash) {
  for (let i = 0; i < 20; i++) {
    const t = await getJson(`/cosmos/tx/v1beta1/txs/${hash}`);
    if (t) {
      const ev = t.tx_response.events.filter((e) => e.type === "pqc_hybrid_verify")
        .map((e) => Object.fromEntries(e.attributes.map((x) => [x.key, x.value])));
      return {
        code: t.tx_response.code,
        events: t.tx_response.events,
        hybrid: ev.some((e) => e.status === "verified"),
        executionFailed: t.tx_response.events.some((e) => e.type === "abstractaccount_execution_failed"),
      };
    }
    await new Promise((s) => setTimeout(s, 3000));
  }
  return null;
}

// Pay `qor` QOR from the owner to `to` using the linked agent key, with the
// gas wallet as relayer. Returns { ok, hash, hybrid, reason }.
// The chain enforces the spending rules; a payment outside them is included
// as a tx but its execution fails (abstractaccount_execution_failed) and no
// money moves. We check that explicitly — the SDK's decode can miss it, so
// a "PAID" is only reported when the chain shows the execution succeeded.
export async function payFee(to, qor, memo) {
  const o = await owner(), g = await gas(), k = agentKey();
  const { nonce } = await fetchAuthNonce({ rest: REST, address: o.cosmos, pubkey: k.pk });
  const msg = await buildPhantomExecuteCosmos({ wallet: k.wallet, relayer: g.cosmos, chainId: CHAIN_ID, account: o.cosmos, to, amount: `${toUqor(qor)}uqor`, nonce });
  let res;
  try {
    res = await broadcast(g, [msg], memo);
  } catch (e) {
    const why = String(e?.message ?? e).match(/: ([^:()]*(revoked|expired|not permitted)[^()]*)\)/)?.[1] ?? String(e?.message ?? e);
    return { ok: false, hash: "", hybrid: false, reason: why };
  }
  if (res.code) return { ok: false, hash: res.transactionHash, hybrid: false, reason: `broadcast code ${res.code}: ${res.rawLog}` };
  const c = await onChain(res.transactionHash);
  if (!c) return { ok: false, hash: res.transactionHash, hybrid: false, reason: "transaction not found on chain within 60s" };
  if (c.code !== 0) return { ok: false, hash: res.transactionHash, hybrid: c.hybrid, reason: `on-chain code ${c.code}` };
  if (c.executionFailed) return { ok: false, hash: res.transactionHash, hybrid: c.hybrid, reason: "refused by the chain: execution failed (outside the on-chain spending rules)" };
  const [x] = decodeAuthenticatorExecutions({ msgResponses: res.msgResponses ?? [], events: c?.events ?? res.events ?? [] }, [msg]);
  if (x && !x.success) return { ok: false, hash: res.transactionHash, hybrid: c.hybrid, reason: x.reason || x.vmError || "execution failed" };
  return { ok: true, hash: res.transactionHash, hybrid: c.hybrid, reason: "" };
}

export async function getRules() {
  const o = await owner(), k = agentKey();
  const [r, auths, n] = await Promise.all([
    fetchSpendingRules({ rest: REST, address: o.cosmos }),
    fetchAuthenticators({ rest: REST, address: o.cosmos }),
    fetchAuthNonce({ rest: REST, address: o.cosmos, pubkey: k.pk }),
  ]);
  const me = auths.find((a) => a.pubkeyHex.toLowerCase() === hex(k.pk));
  return { owner: o.cosmos, balance: await balance(o.cosmos), rules: r.rules, agent: me ?? null, paymentsMade: n.nonce };
}

// Recent transactions sent by the owner (the agent's payments ride on the
// gas wallet as relayer, so we query both senders). Each entry: hash, height,
// code, memo, and any uqor amount moved.
export async function listReceipts(limit = 10) {
  const o = await owner(), g = await gas();
  const out = [];
  for (const sender of [o.cosmos, g.cosmos]) {
    // NOTE: this chain's tx-search endpoint takes the filter as `query=`,
    // not `events=` (that returns "query cannot be empty").
    const url = `/cosmos/tx/v1beta1/txs?query=${encodeURIComponent(`message.sender='${sender}'`)}&order_by=ORDER_BY_DESC&pagination.limit=${limit}`;
    const d = await getJson(url);
    const txs = d?.txs ?? [];
    (d?.tx_responses ?? []).forEach((t, i) => {
      const memo = txs[i]?.body?.memo ?? "";
      const amounts = [];
      for (const e of t.events ?? []) {
        if (e.type === "transfer") {
          for (const a of e.attributes ?? []) {
            if (a.key === "amount" && a.value.includes("uqor")) amounts.push(a.value);
          }
        }
      }
      out.push({ hash: t.txhash, height: t.height, code: Number(t.code), memo, amounts, sender });
    });
  }
  out.sort((a, b) => Number(b.height) - Number(a.height));
  return out.slice(0, limit);
}
