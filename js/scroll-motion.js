(function () {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") return;

  gsap.registerPlugin(ScrollTrigger);

  gsap.to(".hero-bg-wrap", {
    yPercent: 22,
    ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
  });

  gsap.to(".hero-copy", {
    y: 80,
    opacity: 0.15,
    ease: "none",
    scrollTrigger: { trigger: ".hero", start: "center top", end: "bottom top", scrub: true }
  });

  gsap.utils.toArray(".media img").forEach((img) => {
    gsap.fromTo(img, { yPercent: -8, scale: 1.08 }, {
      yPercent: 8,
      scale: 1,
      ease: "none",
      scrollTrigger: { trigger: img.parentElement, start: "top bottom", end: "bottom top", scrub: true }
    });
  });

  gsap.utils.toArray(".split .prose").forEach((el) => {
    gsap.from(el, {
      y: 70,
      opacity: 0,
      duration: 1.05,
      ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 82%" }
    });
  });

  gsap.utils.toArray(".stat").forEach((el, i) => {
    gsap.from(el, {
      y: 50,
      opacity: 0,
      duration: 0.7,
      delay: i * 0.08,
      ease: "power2.out",
      scrollTrigger: { trigger: el, start: "top 88%" }
    });
  });

  gsap.utils.toArray(".who-card").forEach((el, i) => {
    gsap.from(el, {
      y: 60,
      rotateX: 8,
      opacity: 0,
      duration: 0.85,
      delay: i * 0.1,
      ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 88%" }
    });
  });

  const pinQuote = document.querySelector("#story .quote");
  if (pinQuote && window.innerWidth > 900) {
    gsap.to(pinQuote, {
      scale: 1.06,
      scrollTrigger: { trigger: "#story", start: "top 60%", end: "bottom 40%", scrub: true }
    });
  }

  const hscroll = document.querySelector("#hscroll");
  const track = document.querySelector(".hscroll-track");
  if (hscroll && track && window.innerWidth > 900) {
    const distance = () => Math.max(0, track.scrollWidth - hscroll.clientWidth);
    gsap.to(track, {
      x: () => -distance(),
      ease: "none",
      scrollTrigger: {
        trigger: hscroll,
        start: "top 18%",
        end: () => "+=" + Math.max(400, distance()),
        scrub: 1,
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true
      }
    });
  }

  const donate = document.querySelector("#donate .donate-grid");
  if (donate) {
    gsap.from(donate.children, {
      y: 80,
      opacity: 0,
      stagger: 0.12,
      duration: 0.9,
      ease: "power3.out",
      scrollTrigger: { trigger: "#donate", start: "top 75%" }
    });
  }

  gsap.from("#donate h2", {
    y: 40,
    opacity: 0,
    duration: 0.8,
    scrollTrigger: { trigger: "#donate", start: "top 80%" }
  });
})();
