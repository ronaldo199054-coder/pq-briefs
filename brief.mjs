// brief.mjs — CoinMarketCap data + deterministic brief formatting for PQ Briefs.
//
// The formatter is a faithful port of the Python cmc_agent brief_coin()
// (~/workspace/cmc-agent/cmc_agent/brief.py): same lines, same verdict
// thresholds, same footer. No LLM, no predictions, no shilling — every
// number comes from the API response (or labeled mock data).
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const FOOTER = "Data summary from CoinMarketCap, not investment advice.";
const BASE_URL = "https://pro-api.coinmarketcap.com/v1";

// -- CMC API key (never printed) -----------------------------------------
// Priority: CMC_API_KEY env var, then .env in this repo, then the
// ~/workspace/cmc-agent/.env (dev convenience — the key is read, never copied).
function loadDotenvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const [k, ...rest] = t.split("=");
    const key = k.trim(), value = rest.join("=").trim().replace(/^["']|["']$/g, "");
    if (key && !(key in process.env)) process.env[key] = value;
  }
}
export function getApiKey() {
  if (!process.env.CMC_API_KEY) loadDotenvFile(join(process.cwd(), ".env"));
  if (!process.env.CMC_API_KEY) loadDotenvFile(join(homedir(), "workspace", "cmc-agent", ".env"));
  return process.env.CMC_API_KEY || "";
}

// -- live CMC fetch --------------------------------------------------------
async function cmcGet(apiKey, path, params) {
  const url = `${BASE_URL}${path}?${new URLSearchParams(params)}`;
  const r = await fetch(url, { headers: { "X-CMC_PRO_API_KEY": apiKey, Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
  const payload = await r.json();
  const status = payload?.status ?? {};
  if (r.status !== 200 || status.error_code) {
    throw new Error(`${path} failed: ${status.error_message || `HTTP ${r.status}`} (code ${status.error_code ?? r.status})`);
  }
  return payload.data;
}

export async function fetchCoinLive(symbol) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("no CMC_API_KEY: set it in .env or use --mock");
  const [coin, info, metrics] = await Promise.all([
    cmcGet(apiKey, "/cryptocurrency/quotes/latest", { symbol, convert: "USD" }).then((d) => d[symbol] ?? Object.values(d)[0]),
    cmcGet(apiKey, "/cryptocurrency/info", { symbol }).then((d) => Object.values(d)[0]),
    cmcGet(apiKey, "/global-metrics/quotes/latest", { convert: "USD" }),
  ]);
  if (!coin) throw new Error(`no data returned for symbol '${symbol}'`);
  return { coin, info, metrics, mock: false };
}

// -- mock data (labeled; same shape as the live API) -----------------------
const MOCK = {
  BTC: {
    coin: { id: 1, name: "Bitcoin", symbol: "BTC", slug: "bitcoin", cmc_rank: 1, circulating_supply: 19920000, total_supply: 19920000, max_supply: 20916000, quote: { USD: { price: 97420.0, volume_24h: 38200000000, volume_change_24h: 5.6, percent_change_1h: 0.3, percent_change_24h: 1.8, percent_change_7d: 4.2, percent_change_30d: -6.5, percent_change_60d: 12.1, percent_change_90d: 28.4, market_cap: 1940000000000, market_cap_dominance: 56.73, fully_diluted_market_cap: 1940000000000, last_updated: "2026-11-18T14:00:00.000Z" } } },
    info: { id: 1, name: "Bitcoin", symbol: "BTC", category: "coin", description: "Bitcoin is the first decentralized cryptocurrency, created in 2009. It runs on a proof-of-work blockchain and is the largest crypto asset by market cap.", slug: "bitcoin" },
  },
  ETH: {
    coin: { id: 1027, name: "Ethereum", symbol: "ETH", slug: "ethereum", cmc_rank: 2, circulating_supply: 120400000, total_supply: 120400000, max_supply: null, quote: { USD: { price: 3310.0, volume_24h: 21500000000, volume_change_24h: 2.8, percent_change_1h: 0.1, percent_change_24h: 0.9, percent_change_7d: 2.1, percent_change_30d: -9.8, percent_change_60d: 6.3, percent_change_90d: 14.2, market_cap: 398000000000, market_cap_dominance: 11.64, fully_diluted_market_cap: 398000000000, last_updated: "2026-11-18T14:00:00.000Z" } } },
    info: { id: 1027, name: "Ethereum", symbol: "ETH", category: "coin", description: "Ethereum is a programmable blockchain and the home of smart contracts, DeFi, and NFTs. Its native asset is ether (ETH).", slug: "ethereum" },
  },
};
const MOCK_METRICS = {
  quote: { USD: { total_market_cap: 3420000000000, total_volume_24h: 96500000000, total_market_cap_yesterday_percentage_change: 0.9, total_volume_24h_yesterday_percentage_change: 4.2, btc_dominance: 56.8, eth_dominance: 12.9, last_updated: "2026-11-18T14:00:00.000Z" } },
  active_cryptocurrencies: 10240, total_cryptocurrencies: 58400, active_market_pairs: 104300, active_exchanges: 812, total_exchanges: 941, eth_dominance: 12.9, btc_dominance: 56.8, last_updated: "2026-11-18T14:00:00.000Z",
};

export function fetchCoinMock(symbol) {
  const m = MOCK[symbol.toUpperCase()];
  if (!m) throw new Error(`no mock data for '${symbol}' (mock covers BTC and ETH)`);
  return { coin: m.coin, info: m.info, metrics: MOCK_METRICS, mock: true };
}

// -- formatting (ported from Python brief.py) ------------------------------
export function fmtUsd(n) {
  if (n === null || n === undefined) return "n/a";
  n = Number(n);
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}T`;
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}K`;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtPrice(p) {
  if (p === null || p === undefined) return "n/a";
  p = Number(p);
  if (p >= 1) return `$${p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (p >= 0.01) return `$${p.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
  return `$${p.toLocaleString("en-US", { minimumFractionDigits: 6, maximumFractionDigits: 6 })}`;
}

export function fmtPct(x, signed = true) {
  if (x === null || x === undefined) return "n/a";
  const sign = signed && x > 0 ? "+" : "";
  return `${sign}${Number(x).toFixed(1)}%`;
}

export function briefCoin(coin, info = null, metrics = null) {
  const q = coin.quote?.USD ?? {};
  const name = coin.name ?? "?";
  const symbol = coin.symbol ?? "?";
  const rank = coin.cmc_rank ?? "?";
  const price = q.price;
  const p24 = q.percent_change_24h, p7 = q.percent_change_7d, p30 = q.percent_change_30d;
  const mcap = q.market_cap;
  const vol = q.volume_24h;
  const supply = coin.circulating_supply;

  const lines = [`${name} (${symbol}) — rank #${rank}`];
  lines.push(`Price: ${fmtPrice(price)} | 24h: ${fmtPct(p24)} | 7d: ${fmtPct(p7)} | 30d: ${fmtPct(p30)}`);
  lines.push(`Market cap: ${fmtUsd(mcap)} | 24h volume: ${fmtUsd(vol)}`);
  if (supply) lines.push(`Circulating supply: ${Number(supply).toLocaleString("en-US", { maximumFractionDigits: 0 })} ${symbol}`);

  // Momentum: week vs month.
  let momentum;
  if (p7 !== null && p7 !== undefined && p30 !== null && p30 !== undefined) {
    if (p7 > 0 && p30 < 0) momentum = `up ${p7.toFixed(1)}% over 7 days after a ${Math.abs(p30).toFixed(1)}% drop over 30 days — a bounce, not a breakout.`;
    else if (p7 > 0 && p30 > 0) momentum = `up on both the week (${fmtPct(p7)}) and the month (${fmtPct(p30)}).`;
    else if (p7 < 0 && p30 < 0) momentum = `down on both the week (${fmtPct(p7)}) and the month (${fmtPct(p30)}).`;
    else momentum = `down ${Math.abs(p7).toFixed(1)}% this week after rising ${p30.toFixed(1)}% over the month — cooling off.`;
  } else {
    momentum = "not enough change data to judge momentum.";
  }
  // Volume health: 24h volume as a share of market cap.
  const ratio = vol && mcap ? (vol / mcap * 100) : null;
  let volumeNote;
  if (ratio === null) volumeNote = "Volume data missing.";
  else if (ratio > 5) volumeNote = `24h volume is ${ratio.toFixed(1)}% of market cap — very active trading relative to size.`;
  else if (ratio >= 1) volumeNote = `24h volume is ${ratio.toFixed(1)}% of market cap — active trading.`;
  else volumeNote = `24h volume is ${ratio.toFixed(1)}% of market cap — quiet trading.`;

  if (metrics) {
    const dom = metrics.btc_dominance ?? metrics.quote?.USD?.btc_dominance;
    if (symbol === "BTC" && dom !== null && dom !== undefined) volumeNote += ` BTC is ${dom.toFixed(1)}% of the whole market.`;
  }

  if (info?.description) {
    lines.push("");
    lines.push(info.description.slice(0, 280));
  }
  lines.push("");
  lines.push(`Verdict: ${momentum} ${volumeNote}`);
  lines.push(FOOTER);
  return lines.join("\n");
}
