const PAWLIGHT = (window.PAWLIGHT_CONFIG && window.PAWLIGHT_CONFIG.treasury) || "0x6648A42cb5B425640C172Feb59c96D88bF05EE15";
const POLYGON_ID = "0x89";
const TOKENS = {
  USDT: { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6, symbol: "USDT" },
  USDC: { address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6, symbol: "USDC" },
  USDCe: { address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", decimals: 6, symbol: "USDC.e" }
};
const POLYGON_CHAIN = {
  chainId: POLYGON_ID,
  chainName: "Polygon",
  nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
  rpcUrls: ["https://polygon-bor-rpc.publicnode.com", "https://polygon-rpc.com"],
  blockExplorerUrls: ["https://polygonscan.com"]
};

function usdAmount() {
  const el = document.getElementById("usdInput");
  const n = el ? Number(el.value) : 1;
  if (!n || n <= 0) return 1;
  return Math.min(n, 100000);
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
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: POLYGON_ID }] });
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

async function polUsd() {
  if (window.PAWLIGHT_POL_USD) return window.PAWLIGHT_POL_USD;
  const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=polygon-ecosystem-token,matic-network&vs_currencies=usd");
  const data = await res.json();
  const p = (data["polygon-ecosystem-token"] && data["polygon-ecosystem-token"].usd)
    || (data["matic-network"] && data["matic-network"].usd);
  if (!p) throw new Error("Could not read POL price");
  window.PAWLIGHT_POL_USD = p;
  return p;
}

function donateSelector() {
  return "0xed88c68e";
}

async function sendDonateContract(eth, from, usd) {
  const cfg = window.PAWLIGHT_CONFIG || {};
  const contract = cfg.contract;
  if (!contract) return null;
  const price = await polUsd();
  const wei = BigInt(Math.floor((usd / price) * 1e18));
  if (wei <= 0n) throw new Error("Amount too small");
  const hash = await eth.request({
    method: "eth_sendTransaction",
    params: [{
      from,
      to: Web3Address(contract),
      data: "0xed88c68e",
      value: "0x" + wei.toString(16)
    }]
  });
  return { hash, label: usd + " USD → PAW mint + treasury" };
}

function Web3Address(a) {
  return a;
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
  const price = await polUsd();
  const wei = BigInt(Math.floor((usd / price) * 1e18));
  if (wei <= 0n) throw new Error("Amount too small");
  const hash = await eth.request({
    method: "eth_sendTransaction",
    params: [{ from, to: PAWLIGHT, value: "0x" + wei.toString(16) }]
  });
  return { hash, label: usd + " USD in POL" };
}

async function waitReceipt(eth, hash) {
  for (let i = 0; i < 40; i++) {
    const rec = await eth.request({ method: "eth_getTransactionReceipt", params: [hash] });
    if (rec && rec.blockNumber) return rec;
    await new Promise((r) => setTimeout(r, 2500));
  }
  return null;
}

function noWalletUi() {
  const dapp = "https://metamask.app.link/dapp/" + location.host + location.pathname + "#donate";
  setStatus("No wallet in this browser. Open Pawlight inside MetaMask, then tap Send. That signs a real Polygon transaction.", "warn");
  const box = document.getElementById("walletLinks");
  if (box) {
    box.hidden = false;
    const mm = document.getElementById("openMetamask");
    if (mm) mm.href = dapp;
  }
}

async function watchPaw(eth) {
  const cfg = window.PAWLIGHT_CONFIG || {};
  if (!cfg.contract) return;
  try {
    await eth.request({
      method: "wallet_watchAsset",
      params: {
        type: "ERC20",
        options: {
          address: cfg.contract,
          symbol: "PAW",
          decimals: 18
        }
      }
    });
  } catch (e) {}
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
    setStatus("Bitcoin is manual: copy the BTC address or scan the QR.", "warn");
    return;
  }
  const usd = usdAmount();
  const paw = usd * ((window.PAWLIGHT_CONFIG && window.PAWLIGHT_CONFIG.pawPerUsd) || 1000);
  btn.disabled = true;
  const minting = !!(window.PAWLIGHT_CONFIG && window.PAWLIGHT_CONFIG.contract);
  setStatus(
    minting
      ? ("Connecting wallet… you send $" + usd + " and receive about " + paw.toLocaleString() + " PAW.")
      : ("Connecting wallet… real Polygon send of about $" + usd + " to the treasury."),
    ""
  );
  try {
    const accounts = await eth.request({ method: "eth_requestAccounts" });
    const from = accounts && accounts[0];
    if (!from) throw new Error("No account selected");
    await ensurePolygon(eth);

    let sent = null;
    const cfg = window.PAWLIGHT_CONFIG || {};
    if (cfg.contract) {
      setStatus("Sending POL on Polygon and minting PAW to your wallet…", "");
      sent = await sendDonateContract(eth, from, usd);
    }
    if (!sent) {
      setStatus("Sending a real $" + usd + " gift on Polygon…", "");
      sent = await sendToken(eth, from, TOKENS.USDT, usd);
      if (!sent) sent = await sendToken(eth, from, TOKENS.USDC, usd);
      if (!sent) sent = await sendToken(eth, from, TOKENS.USDCe, usd);
      if (!sent) sent = await sendNative(eth, from, usd);
    }

    const link = explorerTx(sent.hash);
    setStatus(minting ? "Broadcast. Waiting for Polygon to mint PAW to you…" : "Broadcast. Waiting for Polygon confirmation…", "");
    const recEl = document.getElementById("txLink");
    if (recEl) {
      recEl.hidden = false;
      recEl.innerHTML = '<a href="' + link + '" target="_blank" rel="noopener">View on Polygonscan</a>';
    }
    const rec = await waitReceipt(eth, sent.hash);
    if (rec && rec.status === "0x0") {
      setStatus("Transaction reverted. Nothing was taken.", "err");
      btn.disabled = false;
      return;
    }
    await watchPaw(eth);
    setStatus("Confirmed. Your gift is on-chain. About " + paw.toLocaleString() + " PAW is your thank-you.", "ok");
    window.location.href = "thank-you.html?tx=" + encodeURIComponent(sent.hash) + "&paw=" + encodeURIComponent(String(paw)) + "&usd=" + encodeURIComponent(String(usd));
  } catch (err) {
    const code = err && err.code;
    if (code === 4001) setStatus("You rejected the transaction. Nothing was sent.", "warn");
    else setStatus((err && (err.message || err.reason)) || "Wallet error. Nothing was sent.", "err");
    btn.disabled = false;
  }
}

function syncUsdFromChip(chip) {
  const input = document.getElementById("usdInput");
  if (!input) return;
  if (chip.dataset.usd === "any") {
    input.focus();
    input.select();
    return;
  }
  input.value = chip.dataset.usd || "1";
}

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("donateWallet");
  if (btn) btn.addEventListener("click", donateWithWallet);
  const hero = document.getElementById("heroDonate");
  if (hero) {
    hero.addEventListener("click", (e) => {
      e.preventDefault();
      document.getElementById("donate")?.scrollIntoView({ behavior: "smooth" });
      setTimeout(donateWithWallet, 450);
    });
  }
  const input = document.getElementById("usdInput");
  if (input) {
    input.addEventListener("input", () => {
      const v = Number(input.value);
      const dw = document.getElementById("donateWallet");
      if (dw && v > 0) dw.textContent = "Send $" + (Number.isInteger(v) ? v : v.toFixed(2));
      document.querySelectorAll(".chip").forEach((c) => {
        c.classList.toggle("active", String(c.dataset.usd) === String(input.value));
      });
      if (typeof refreshPay === "function") refreshPay();
    });
  }
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => syncUsdFromChip(chip));
  });
});
