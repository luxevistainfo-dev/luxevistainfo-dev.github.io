(function () {
  const cfg = window.PAWLIGHT_CONFIG || {};
  const RPC = cfg.rpc || "https://polygon-bor-rpc.publicnode.com";
  const TREASURY = (cfg.treasury || "0x6648A42cb5B425640C172Feb59c96D88bF05EE15").toLowerCase();
  const USDT = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";
  const USDC = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
  const USDCe = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
  const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  const PAW_PER_USD = cfg.pawPerUsd || 1000;

  function pad32(hex) {
    return hex.replace(/^0x/i, "").toLowerCase().padStart(64, "0");
  }
  function topicAddr(hex) {
    return ("0x" + hex.slice(-40)).toLowerCase();
  }

  async function rpc(method, params) {
    const res = await fetch(RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.result;
  }

  async function tokenBal(token, addr) {
    const result = await rpc("eth_call", [
      { to: token, data: "0x70a08231" + pad32(addr) },
      "latest"
    ]);
    return Number(BigInt(result || "0x0")) / 1e6;
  }

  function fmtUsd(n) {
    if (n >= 1000) return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
    return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  function fmtPaw(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "M PAW";
    if (n >= 1000) return Math.round(n).toLocaleString() + " PAW";
    return n.toLocaleString(undefined, { maximumFractionDigits: 1 }) + " PAW";
  }

  async function polPrice() {
    try {
      const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=polygon-ecosystem-token,matic-network&vs_currencies=usd");
      const j = await res.json();
      return (j["polygon-ecosystem-token"] && j["polygon-ecosystem-token"].usd)
        || (j["matic-network"] && j["matic-network"].usd)
        || 0.09;
    } catch {
      return 0.09;
    }
  }

  async function incomingUsd() {
    const latest = parseInt(await rpc("eth_blockNumber", []), 16);
    const from = "0x" + Math.max(0, latest - 250000).toString(16);
    const toTopic = "0x" + pad32(TREASURY);
    let usd = 0;
    const donors = {};
    for (const token of [USDT, USDC, USDCe]) {
      try {
        const logs = await rpc("eth_getLogs", [{
          fromBlock: from,
          toBlock: "latest",
          address: token,
          topics: [TRANSFER, null, toTopic]
        }]);
        (logs || []).forEach((log) => {
          const amount = Number(BigInt(log.data || "0x0")) / 1e6;
          usd += amount;
          const fromAddr = topicAddr(log.topics[1] || "0x");
          donors[fromAddr] = (donors[fromAddr] || 0) + amount;
        });
      } catch (e) {}
    }
    try {
      const polWei = BigInt(await rpc("eth_getBalance", [cfg.treasury, "latest"]));
      const price = await polPrice();
      window.PAWLIGHT_POL_USD = price;
      usd += Number(polWei) / 1e18 * price;
    } catch (e) {}
    return { usd, donors };
  }

  async function refresh() {
    const donatedEl = document.getElementById("liveDonated");
    const circEl = document.getElementById("liveCirc");
    const priceEl = document.getElementById("livePrice");
    const maxEl = document.getElementById("liveMax");
    const donorsEl = document.getElementById("liveDonors");
    if (maxEl) maxEl.textContent = "1,000,000,000 PAW";
    if (priceEl) priceEl.textContent = "$0.001";
    try {
      let usd = 0;
      let paw = 0;
      let donorCount = 0;
      if (cfg.contract) {
        const res = await rpc("eth_call", [{ to: cfg.contract, data: "0x18160ddd" }, "latest"]);
        paw = Number(BigInt(res || "0x0")) / 1e18;
        try {
          const r2 = await rpc("eth_call", [{ to: cfg.contract, data: "0x2cea9442" }, "latest"]);
          usd = Number(BigInt(r2 || "0x0")) / 1e18;
        } catch (e) {}
      }
      const incoming = await incomingUsd();
      if (incoming.usd > usd) usd = incoming.usd;
      if (!cfg.contract) paw = incoming.usd * PAW_PER_USD;
      donorCount = Object.keys(incoming.donors).length;
      window.PAWLIGHT_DONORS = incoming.donors;
      if (donatedEl) donatedEl.textContent = fmtUsd(usd);
      if (circEl) circEl.textContent = fmtPaw(paw);
      if (donorsEl) donorsEl.textContent = String(donorCount);
      const bar = document.getElementById("supplyBar");
      if (bar) bar.style.width = Math.min(100, (paw / 1e9) * 100) + "%";
      const mintStatus = document.getElementById("mintStatus");
      if (mintStatus) {
        mintStatus.textContent = cfg.contract
          ? "Minting on Polygon"
          : "Genesis on-chain — 1000 PAW per $1";
      }
    } catch (err) {
      if (donatedEl) donatedEl.textContent = "$0.00";
      if (circEl) circEl.textContent = "0 PAW";
    }
  }

  async function showMyPaw() {
    const out = document.getElementById("myPaw");
    const eth = window.ethereum;
    if (!eth) {
      if (out) out.textContent = "Open this page in MetaMask to see your genesis PAW.";
      return;
    }
    try {
      const acc = await eth.request({ method: "eth_requestAccounts" });
      const me = (acc[0] || "").toLowerCase();
      if (!window.PAWLIGHT_DONORS) await refresh();
      const usd = (window.PAWLIGHT_DONORS && window.PAWLIGHT_DONORS[me]) || 0;
      const paw = usd * PAW_PER_USD;
      if (out) {
        out.textContent = usd > 0
          ? ("Your gifts: " + fmtUsd(usd) + " → " + fmtPaw(paw) + " genesis. Whoever donates, holds the light.")
          : "No gift from this wallet yet. Send any amount — 1,000 PAW per $1 is written from the chain.";
      }
    } catch (e) {
      if (out) out.textContent = "Wallet closed. Nothing sent.";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    refresh();
    setInterval(refresh, 20000);
    const btn = document.getElementById("checkPaw");
    if (btn) btn.addEventListener("click", showMyPaw);
  });
})();
