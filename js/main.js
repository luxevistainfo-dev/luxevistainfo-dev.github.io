const EVM = "0x6648A42cb5B425640C172Feb59c96D88bF05EE15";
const BTC = "1H2N2udaLsX96rpTXqggiPbRSaAKttabBj";

const NETWORKS = {
  polygon: { label: "Polygon (best for $1 — tiny fees)", chainId: 137, kind: "evm" },
  base: { label: "Base", chainId: 8453, kind: "evm" },
  ethereum: { label: "Ethereum", chainId: 1, kind: "evm" },
  arbitrum: { label: "Arbitrum", chainId: 42161, kind: "evm" },
  optimism: { label: "Optimism", chainId: 10, kind: "evm" },
  bsc: { label: "BNB Smart Chain", chainId: 56, kind: "evm" },
  avalanche: { label: "Avalanche C-Chain", chainId: 43114, kind: "evm" },
  bitcoin: { label: "Bitcoin", chainId: null, kind: "btc" }
};

function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return [...root.querySelectorAll(sel)]; }

function currentAddress(kind) {
  return kind === "btc" ? BTC : EVM;
}

function qrUrl(data) {
  return "https://api.qrserver.com/v1/create-qr-code/?size=240x240&ecc=M&data=" + encodeURIComponent(data);
}

function paymentUri(netKey) {
  const net = NETWORKS[netKey];
  if (net.kind === "btc") return "bitcoin:" + BTC;
  return "ethereum:" + EVM + "@" + net.chainId;
}

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2200);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Address copied");
  } catch {
    toast("Copy failed — select the address instead");
  }
}

function refreshPay() {
  const netKey = $("#network").value;
  const net = NETWORKS[netKey];
  const addr = currentAddress(net.kind);
  $("#address").value = addr;
  $("#qr").src = qrUrl(paymentUri(netKey));
  $("#qr").alt = "QR code for " + net.label;
  $("#networkHint").textContent = net.kind === "btc"
    ? "Send BTC to this Bitcoin address."
    : "Send ETH, MATIC, BNB, AVAX, USDT, or USDC to this same address on " + net.label.split(" (")[0] + ".";
}

function shareUrl() {
  return window.location.origin + window.location.pathname.replace(/thank-you\.html$/, "index.html").replace(/index\.html$/, "");
}

function setShareLinks() {
  const url = shareUrl();
  const text = "Pawlight — one dollar can feed a stray tonight. Give $1 or more: " + url;
  const map = {
    "#share-x": "https://twitter.com/intent/tweet?text=" + encodeURIComponent(text),
    "#share-facebook": "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(url),
    "#share-reddit": "https://www.reddit.com/submit?url=" + encodeURIComponent(url) + "&title=" + encodeURIComponent("Pawlight: $1 can feed a stray tonight"),
    "#share-whatsapp": "https://wa.me/?text=" + encodeURIComponent(text),
    "#share-telegram": "https://t.me/share/url?url=" + encodeURIComponent(url) + "&text=" + encodeURIComponent("Pawlight — one dollar. One meal. One more night safe."),
    "#share-email": "mailto:?subject=" + encodeURIComponent("A $1 gift that feeds a stray") + "&body=" + encodeURIComponent(text)
  };
  Object.entries(map).forEach(([sel, href]) => {
    const el = $(sel);
    if (el) el.href = href;
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const menuBtn = $("#menuBtn");
  const links = $("#navLinks");
  if (menuBtn) {
    menuBtn.addEventListener("click", () => {
      const open = links.classList.toggle("open");
      menuBtn.setAttribute("aria-expanded", String(open));
    });
  }

  const net = $("#network");
  if (net) {
    net.addEventListener("change", refreshPay);
    refreshPay();
    $("#copyBtn").addEventListener("click", () => copyText($("#address").value));
    $all(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        $all(".chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        $("#giftNote").textContent = chip.dataset.note;
      });
    });
  }

  const nativeShare = $("#nativeShare");
  if (nativeShare && navigator.share) {
    nativeShare.hidden = false;
    nativeShare.addEventListener("click", () => {
      navigator.share({
        title: "Pawlight",
        text: "One dollar. One meal. One more night safe.",
        url: shareUrl()
      }).catch(() => {});
    });
  }

  setShareLinks();
  const y = $("#year");
  if (y) y.textContent = String(new Date().getFullYear());

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const bar = $("#progress");
  const onScroll = () => {
    if (bar) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + "%";
    }
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (!reduce) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.16 });
    $all(".reveal").forEach((el) => io.observe(el));
  } else {
    $all(".reveal").forEach((el) => el.classList.add("in"));
  }

  const canvas = $("#paws");
  if (canvas && !reduce && canvas.getContext) {
    const ctx = canvas.getContext("2d");
    const dots = [];
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    for (let i = 0; i < 18; i++) {
      dots.push({
        x: Math.random(),
        y: Math.random(),
        r: 1.2 + Math.random() * 2.2,
        s: 0.15 + Math.random() * 0.35,
        a: 0.15 + Math.random() * 0.35
      });
    }
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      dots.forEach((d) => {
        d.y -= d.s / 1000;
        if (d.y < -0.05) d.y = 1.05;
        ctx.beginPath();
        ctx.fillStyle = "rgba(232,214,176," + d.a + ")";
        ctx.arc(d.x * canvas.width, d.y * canvas.height, d.r, 0, Math.PI * 2);
        ctx.fill();
      });
      requestAnimationFrame(tick);
    };
    tick();
  }

});
