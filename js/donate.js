const PAWLIGHT = "0x6648A42cb5B425640C172Feb59c96D88bF05EE15";
const POLYGON_ID = "0x89";
const POLYGON_DEC = 137;

const TOKENS = {
  USDT: { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6, symbol: "USDT" },
  USDC: { address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6, symbol: "USDC" },
  USDCe: { address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", decimals: 6, symbol: "USDC.e" }
};

const POLYGON_CHAIN = {
  chainId: POLYGON_ID,
  chainName: "Polygon",
  nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
  rpcUrls: ["https://polygon-rpc.com", "https://polygon-bor-rpc.publicnode.com"],
  blockExplorerUrls: ["https://polygonscan.com"]
};

function usdAmount() {
  const active = document.querySelector(".chip.active");
  const raw = active && active.dataset.usd;
  if (raw === "any") {
    const typed = Number(window.prompt("How many USD to send?", "1"));
    if (!typed || typed <= 0) return 1;
    return Math.min(typed, 10000);
  }
  return Number(raw || 1);
}

function pad32(hex) {
  return hex.replace(/^0x/, "").toLowerCase().padStart(64, "0");
}

function encodeTransfer(to, amount) {
  return "0xa9059cbb" + pad32(to) + BigInt(amount).toString(16).padStart(64, "0");
}

function encodeBalanceOf(account) {
  return "0x70a08231" + pad32(account);
}

function setStatus(msg, kind) {
  const el = document.getElementById("donateStatus");
  if (!el) return;
  el.textContent = msg;
  el.className = "donate-status" + (kind ? " " + kind : "");
}

function explorerTx(hash) {
  return "https://polygonscan.com/tx/" + hash;
}

function getEthereum() {
  if (typeof window.ethereum === "undefined") return null;
  if (window.ethereum.providers && window.ethereum.providers.length) {
    return window.ethereum.providers.find((p) => p.isMetaMask) || window.ethereum.providers[0];
  }
  return window.ethereum;
}

async function ensurePolygon(eth) {
  const current = await eth.request({ method: "eth_chainId" });
  if (current === POLYGON_ID) return;
  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: POLYGON_ID }]
    });
  } catch (err) {
    if (err && (err.code === 4902 || String(err.message || "").includes("Unrecognized chain"))) {
      await eth.request({ method: "wallet_addEthereumChain", params: [POLYGON_CHAIN] });
      return;
    }
    throw err;
  }
}

async function tokenBalance(eth, token, account) {
  const result = await eth.request({
    method: "eth_call",
    params: [{ to: token.address, data: encodeBalanceOf(account) }, "latest"]
  });
  return BigInt(result || "0x0");
}

async function maticUsd() {
  const url = "https://api.coingecko.com/api/v3/simple/price?ids=matic-network,polygon-ecosystem-token&vs_currencies=usd";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not read POL price");
  const data = await res.json();
  const price = (data["polygon-ecosystem-token"] && data["polygon-ecosystem-token"].usd)
    || (data["matic-network"] && data["matic-network"].usd);
  if (!price) throw new Error("Could not read POL price");
  return Number(price);
}

async function sendToken(eth, from, token, usd) {
  const units = BigInt(Math.round(usd * (10 ** token.decimals)));
  const bal = await tokenBalance(eth, token, from);
  if (bal < units) return null;
  const hash = await eth.request({
    method: "eth_sendTransaction",
    params: [{
      from,
      to: token.address,
      data: encodeTransfer(PAWLIGHT, units),
      value: "0x0"
    }]
  });
  return { hash, label: usd + " " + token.symbol };
}

async function sendNative(eth, from, usd) {
  const price = await maticUsd();
  const wei = BigInt(Math.floor((usd / price) * 1e18));
  if (wei <= 0n) throw new Error("Amount too small");
  const hash = await eth.request({
    method: "eth_sendTransaction",
    params: [{
      from,
      to: PAWLIGHT,
      value: "0x" + wei.toString(16)
    }]
  });
  return { hash, label: usd + " USD in POL" };
}

async function waitReceipt(eth, hash) {
  for (let i = 0; i < 40; i++) {
    const rec = await eth.request({
      method: "eth_getTransactionReceipt",
      params: [hash]
    });
    if (rec && rec.blockNumber) return rec;
    await new Promise((r) => setTimeout(r, 2500));
  }
  return null;
}

function noWalletUi() {
  const dapp = "https://metamask.app.link/dapp/" + location.host + location.pathname + "#donate";
  setStatus("No wallet in this browser. Open this page inside MetaMask, Rainbow, or Trust — then tap Donate. That signs a real Polygon transaction to our address.", "warn");
  const box = document.getElementById("walletLinks");
  if (box) {
    box.hidden = false;
    const mm = document.getElementById("openMetamask");
    if (mm) mm.href = dapp;
  }
}

async function donateWithWallet() {
  const btn = document.getElementById("donateWallet");
  const eth = getEthereum();
  if (!eth) {
    noWalletUi();
    window.open("https://metamask.io/download/", "_blank", "noopener");
    return;
  }
  const netSel = document.getElementById("network");
  if (netSel && netSel.value === "bitcoin") {
    setStatus("Bitcoin is manual: copy the BTC address or scan the QR. The wallet button sends on Polygon (USDT/USDC/POL).", "warn");
    return;
  }
  const usd = usdAmount();
  btn.disabled = true;
  setStatus("Opening your wallet… confirm the network and the send. This is a real on-chain transfer.", "");
  try {
    const accounts = await eth.request({ method: "eth_requestAccounts" });
    const from = accounts && accounts[0];
    if (!from) throw new Error("No account selected");
    await ensurePolygon(eth);
    setStatus("Checking USDT / USDC, then sending $" + usd + " to Pawlight…", "");

    let sent = await sendToken(eth, from, TOKENS.USDT, usd);
    if (!sent) sent = await sendToken(eth, from, TOKENS.USDC, usd);
    if (!sent) sent = await sendToken(eth, from, TOKENS.USDCe, usd);
    if (!sent) {
      setStatus("No USDT/USDC in this wallet on Polygon. Sending ~$" + usd + " in POL instead…", "warn");
      sent = await sendNative(eth, from, usd);
    }

    const link = explorerTx(sent.hash);
    setStatus("Transaction submitted: " + sent.label + ". Waiting for Polygon confirmation…", "");
    const recEl = document.getElementById("txLink");
    if (recEl) {
      recEl.hidden = false;
      recEl.innerHTML = '<a href="' + link + '" target="_blank" rel="noopener">View on Polygonscan</a>';
    }
    const rec = await waitReceipt(eth, sent.hash);
    if (rec && rec.status === "0x0") {
      setStatus("Transaction reverted on-chain. Nothing was taken. Check Polygonscan.", "err");
      btn.disabled = false;
      return;
    }
    setStatus("Confirmed on Polygon. Thank you — that gift is real.", "ok");
    window.location.href = "thank-you.html?tx=" + encodeURIComponent(sent.hash);
  } catch (err) {
    const code = err && err.code;
    if (code === 4001) setStatus("You rejected the transaction in your wallet. Nothing was sent.", "warn");
    else setStatus((err && (err.message || err.reason)) || "Wallet error. Nothing was sent.", "err");
    btn.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("donateWallet");
  if (btn) btn.addEventListener("click", donateWithWallet);
  document.querySelectorAll("[data-donate]").forEach((el) => {
    el.addEventListener("click", (e) => {
      if (el.getAttribute("href") === "#donate") return;
      e.preventDefault();
      document.getElementById("donate")?.scrollIntoView({ behavior: "smooth" });
      donateWithWallet();
    });
  });
});
