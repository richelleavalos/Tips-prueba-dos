(() => {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];

  document.documentElement.classList.add("js-page-transition");
  requestAnimationFrame(() => document.body.classList.add("page-ready"));

  const header = $("[data-header], .topbar");
  const syncHeader = () => header?.classList.toggle("is-scrolled", window.scrollY > 18);
  syncHeader();
  window.addEventListener("scroll", syncHeader, { passive: true });

  function markRevealTargets(root = document) {
    const selectors = [
      ".hero-copy > *",
      ".hero-canvas",
      ".architecture-hero > *",
      ".section-head",
      ".feature-card",
      ".project-card",
      ".portfolio-card",
      ".mini-product",
      ".shop-card",
      ".service-lines article",
      ".process-grid article",
      ".quote-banner-inner > *",
      ".quote-heading > *",
      ".quote-form",
      ".quote-illustration",
      ".project-top > *",
      ".project-layout > *",
      ".auth-shell",
      ".account-intro > *",
      ".checkout-layout > *",
      ".demo-alert"
    ];

    selectors.forEach(selector => {
      $$(selector, root).forEach((node, index) => {
        if (node.classList.contains("scroll-reveal") || node.closest(".modal-backdrop, .cart-drawer")) return;
        node.classList.add("scroll-reveal");
        node.style.setProperty("--reveal-delay", `${Math.min(index % 6, 5) * 55}ms`);
      });
    });
  }

  markRevealTargets();

  if (!reduced && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

    const observePending = root => {
      if (root instanceof Element && root.classList.contains("scroll-reveal") && !root.classList.contains("is-visible")) observer.observe(root);
      $$(".scroll-reveal:not(.is-visible)", root).forEach(node => observer.observe(node));
    };

    observePending(document);

    const mutations = new MutationObserver(records => {
      records.forEach(record => record.addedNodes.forEach(node => {
        if (!(node instanceof Element)) return;
        markRevealTargets(node);
        if (node.matches(".project-card,.portfolio-card,.mini-product,.shop-card")) node.classList.add("scroll-reveal");
        observePending(node);
      }));
    });
    mutations.observe(document.body, { childList: true, subtree: true });
  } else {
    $$(".scroll-reveal").forEach(node => node.classList.add("is-visible"));
  }

  $$("a[href^='#']").forEach(link => {
    link.addEventListener("click", event => {
      const href = link.getAttribute("href");
      if (!href || href === "#") return;
      const target = $(href);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      history.replaceState(null, "", href);
    });
  });

  if (reduced) return;

  document.addEventListener("click", event => {
    const link = event.target.closest("a[href]");
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (link.target === "_blank" || link.hasAttribute("download")) return;
    const href = link.getAttribute("href") || "";
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) return;

    let destination;
    try { destination = new URL(link.href, window.location.href); } catch { return; }
    if (destination.origin !== window.location.origin) return;
    if (destination.pathname === window.location.pathname && destination.search === window.location.search && destination.hash) return;

    event.preventDefault();
    document.body.classList.add("page-leaving");
    window.setTimeout(() => { window.location.href = destination.href; }, 170);
  });
})();
