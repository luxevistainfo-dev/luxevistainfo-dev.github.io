(function () {
  const cfg = window.PAWLIGHT_CONFIG || {};
  const RPC = cfg.rpc || "https://polygon-bor-rpc.publicnode.com";
  const TREASURY = (cfg.treasury || "").toLowerCase();
  const USDT = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";
  const USDC = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";

  function pad32(hex) {
    return hex.replace(/^0x/i, "").toLowerCase().padStart(64, "0");
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
    if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 }) + " PAW";
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 }) + " PAW";
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

  async function contractStats(addr) {
    const abi = window.PAWLIGHT_ABI || [];
    if (!addr || !abi.length) return null;
    async function call(sig) {
      const sel = sig;
      const result = await rpc("eth_call", [{ to: addr, data: sel }, "latest"]);
      return BigInt(result || "0x0");
    }
    const totalSupplySel = "0x18160ddd";
    const raisedSel = "0x0eb62b11";
    let supply = 0n;
    let raised = 0n;
    try { supply = await call(totalSupplySel); } catch (e) {}
    try { raised = await rpc("eth_call", [{ to: addr, data: "0x" }, "latest"]); } catch (e) {}
    try {
      const keccak = await fetch("https://polygon-bor-rpc.publicnode.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: addr, data: "0x18160ddd" }, "latest"] })
      }).then((r) => r.json());
      supply = BigInt(keccak.result || "0x0");
    } catch (e) {}
    return { supply, raised };
  }

  async function refresh() {
    const donatedEl = document.getElementById("liveDonated");
    const circEl = document.getElementById("liveCirc");
    const priceEl = document.getElementById("livePrice");
    const maxEl = document.getElementById("liveMax");
    if (maxEl) maxEl.textContent = "1,000,000,000 PAW";
    const mintStatus = document.getElementById("mintStatus");
    if (mintStatus) {
      mintStatus.textContent = cfg.contract ? ("Live " + cfg.contract.slice(0, 6) + "…" + cfg.contract.slice(-4)) : "Ready — needs ~0.05 POL to deploy";
    }
    if (priceEl) priceEl.textContent = "$0.001";
    try {
      const price = await polPrice();
      window.PAWLIGHT_POL_USD = price;
      const polWei = BigInt(await rpc("eth_getBalance", [cfg.treasury, "latest"]));
      const pol = Number(polWei) / 1e18;
      let usd = pol * price;
      try { usd += await tokenBal(USDT, TREASURY); } catch (e) {}
      try { usd += await tokenBal(USDC, TREASURY); } catch (e) {}

      let paw = 0;
      if (cfg.contract) {
        const res = await rpc("eth_call", [{ to: cfg.contract, data: "0x18160ddd" }, "latest"]);
        paw = Number(BigInt(res || "0x0")) / 1e18;
        try {
          const names = ["totalUsdRaised()"];
          const sel = "0x2cea9442";
          const r2 = await rpc("eth_call", [{ to: cfg.contract, data: sel }, "latest"]);
          const raised = Number(BigInt(r2 || "0x0")) / 1e18;
          if (raised > usd) usd = raised;
        } catch (e) {}
      } else {
        paw = 0;
      }
      if (donatedEl) donatedEl.textContent = fmtUsd(usd);
      if (circEl) circEl.textContent = fmtPaw(paw);
      const bar = document.getElementById("supplyBar");
      if (bar) bar.style.width = Math.min(100, (paw / 1e9) * 100) + "%";
    } catch (err) {
      if (donatedEl) donatedEl.textContent = "$0";
      if (circEl) circEl.textContent = "0 PAW";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    refresh();
    setInterval(refresh, 20000);
  });
})();
