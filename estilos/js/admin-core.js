(() => {
  "use strict";
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const esc = value => {
    const node = document.createElement("div");
    node.textContent = String(value ?? "");
    return node.innerHTML;
  };
  const usd = cents => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((Number(cents) || 0) / 100);
  let csrf = "";

  async function api(path, options = {}) {
    const method = (options.method || "GET").toUpperCase();
    const headers = { Accept: "application/json", ...(options.headers || {}) };
    if (method !== "GET") {
      if (!csrf) {
        const tokenResponse = await fetch("/api/csrf", { credentials: "same-origin" });
        const tokenData = await tokenResponse.json();
        csrf = tokenData.csrf_token;
      }
      headers["X-CSRF-Token"] = csrf;
      headers["Content-Type"] = "application/json";
    }
    const response = await fetch(path, { credentials: "same-origin", ...options, method, headers });
    const data = await response.json().catch(() => ({ error: "Respuesta inválida." }));
    if (!response.ok) {
      const error = new Error(data.error || "Ocurrió un error.");
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function toast(message, type = "ok") {
    let stack = $("[data-admin-toast-stack]");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "admin-toast-stack";
      stack.dataset.adminToastStack = "";
      document.body.append(stack);
    }
    const item = document.createElement("div");
    item.className = `admin-toast${type === "error" ? " error" : ""}`;
    item.textContent = message;
    stack.append(item);
    setTimeout(() => item.remove(), 3300);
  }

  function navGroup(label, items, active) {
    return `<section class="admin-nav-group"><div class="admin-nav-label">${esc(label)}</div><div class="admin-nav-list">${items.map(([key, href, icon, text]) => `<a class="${active === key ? "active" : ""}" href="${href}"><span class="ico">${icon}</span><span>${esc(text)}</span></a>`).join("")}</div></section>`;
  }

  function navMarkup(active) {
    const groups = [
      ["General", [["dashboard", "index.html", "⌂", "Resumen"]]],
      ["Comercio", [
        ["productos", "productos.html", "□", "Productos"],
        ["pedidos", "pedidos.html", "▤", "Pedidos"],
        ["ventas", "ventas.html", "↗", "Ventas"],
        ["inventario", "inventario.html", "▦", "Inventario"],
        ["promociones", "promociones.html", "%", "Promociones"],
      ]],
      ["Arquitectura", [
        ["proyectos", "proyectos.html", "⌗", "Proyectos"],
        ["cotizaciones", "cotizaciones.html", "◇", "Cotizaciones"],
      ]],
      ["Personas", [
        ["clientes", "clientes.html", "○", "Clientes"],
        ["usuarios", "usuarios.html", "◎", "Usuarios"],
      ]],
      ["Análisis", [["reportes", "reportes.html", "⌁", "Reportes"]]],
      ["Sistema", [
        ["configuracion", "configuracion.html", "⚙", "Apariencia y sitio"],
        ["cuenta", "cuenta.html", "◉", "Mi cuenta admin"],
      ]],
    ];
    return `<a class="admin-side-brand" href="index.html"><img src="/assets/logos/tips-logo-orange.svg" alt="Tips"><div><strong>Tips</strong><small>Administración</small></div></a><div class="admin-nav-scroll">${groups.map(([label, items]) => navGroup(label, items, active)).join("")}</div><div class="admin-side-foot"><button type="button" data-admin-logout>Cerrar sesión</button></div>`;
  }

  function mountShell() {
    const page = document.body.dataset.adminPage || "dashboard";
    const sidebar = $("[data-admin-sidebar]");
    if (sidebar) sidebar.innerHTML = navMarkup(page);
    const top = $("[data-admin-top]");
    if (top) {
      top.innerHTML = `<div class="admin-top-left"><button class="admin-mobile-menu" type="button" data-admin-menu aria-label="Abrir menú">☰</button><div class="admin-breadcrumb"><small>Tips / Administración</small><strong data-admin-top-title>Panel</strong></div></div><div class="admin-top-actions"><button class="admin-icon" type="button" data-admin-alerts aria-label="Alertas">♢<span class="admin-count hidden" data-admin-alert-count>0</span></button><button class="admin-profile-button" type="button" data-admin-profile><span class="admin-avatar" data-admin-avatar>A</span><span data-admin-profile-name>Admin</span><span>⌄</span></button></div><div class="admin-popover" data-admin-popover><div class="identity"><strong data-admin-pop-name>Administrador</strong><small data-admin-pop-email></small></div><a href="cuenta.html">Mi cuenta admin</a><button type="button" data-admin-pop-logout>Cerrar sesión</button></div><div class="admin-alert-popover" data-admin-alert-popover><div class="admin-alert-popover-head"><strong>Alertas</strong><button type="button" data-admin-alert-close>×</button></div><div data-admin-alert-list></div></div>`;
    }
    $("[data-admin-menu]")?.addEventListener("click", () => document.body.classList.toggle("admin-menu-open"));
    document.addEventListener("click", event => {
      if (window.innerWidth <= 760 && document.body.classList.contains("admin-menu-open") && !event.target.closest(".admin-side") && !event.target.closest("[data-admin-menu]")) document.body.classList.remove("admin-menu-open");
    });
    const profileButton = $("[data-admin-profile]");
    const popover = $("[data-admin-popover]");
    profileButton?.addEventListener("click", event => {
      event.stopPropagation();
      $("[data-admin-alert-popover]")?.classList.remove("open");
      popover?.classList.toggle("open");
    });
    document.addEventListener("click", event => {
      if (!event.target.closest("[data-admin-popover]") && !event.target.closest("[data-admin-profile]")) popover?.classList.remove("open");
    });
    $$("[data-admin-logout],[data-admin-pop-logout]").forEach(button => button.addEventListener("click", logout));
  }

  async function logout() {
    try { await api("/api/auth/logout", { method: "POST", body: "{}" }); } catch {}
    location.href = "/cuenta.html";
  }

  function setIdentity(user) {
    if (!user) return;
    const initial = (user.display_name || user.email || "A").trim().charAt(0).toUpperCase();
    $("[data-admin-avatar]") && ($("[data-admin-avatar]").textContent = initial);
    $("[data-admin-profile-name]") && ($("[data-admin-profile-name]").textContent = user.display_name || "Admin");
    $("[data-admin-pop-name]") && ($("[data-admin-pop-name]").textContent = user.display_name || "Administrador");
    $("[data-admin-pop-email]") && ($("[data-admin-pop-email]").textContent = user.email || "");
  }

  function renderAlertPopover(alerts) {
    const panel = $("[data-admin-alert-popover]");
    const list = $("[data-admin-alert-list]");
    if (!panel || !list) return;
    list.innerHTML = alerts.length ? alerts.map(item => `<a class="admin-alert-popover-item" href="${item.view === "quotes" ? "cotizaciones.html" : item.view === "orders" ? "pedidos.html" : "inventario.html"}"><span class="dot ${esc(item.level)}"></span><div><strong>${esc(item.title)}</strong><small>${esc(item.message)}</small></div></a>`).join("") : '<div class="admin-alert-popover-empty"><strong>Todo al día</strong><small>No hay alertas pendientes.</small></div>';
    const button = $("[data-admin-alerts]");
    button?.addEventListener("click", event => {
      event.stopPropagation();
      $("[data-admin-popover]")?.classList.remove("open");
      panel.classList.toggle("open");
    });
    $("[data-admin-alert-close]")?.addEventListener("click", () => panel.classList.remove("open"));
    document.addEventListener("click", event => {
      if (!event.target.closest("[data-admin-alert-popover]") && !event.target.closest("[data-admin-alerts]")) panel.classList.remove("open");
    });
  }

  async function loadAlerts() {
    try {
      const data = await api("/api/admin/overview");
      setIdentity(data.user);
      const alerts = data.alerts || [];
      const count = alerts.reduce((sum, item) => sum + Number(item.count || 0), 0);
      const badge = $("[data-admin-alert-count]");
      if (badge) {
        badge.textContent = count;
        badge.classList.toggle("hidden", !count);
      }
      renderAlertPopover(alerts);
      return data;
    } catch (error) {
      if (error.status === 401 || error.status === 403) showAuth();
      throw error;
    }
  }

  function showAuth() {
    const main = $("[data-admin-main]");
    if (!main) return;
    main.innerHTML = `<section class="admin-auth-block"><img src="/assets/logos/tips-logo-orange.svg" alt="Tips"><h2>Acceso administrativo requerido</h2><p>Esta ruta pertenece exclusivamente a administradores.</p><a class="admin-btn primary" href="/cuenta.html">Iniciar sesión</a></section>`;
  }

  function modal(content, title = "Editar", wide = false) {
    const layer = document.createElement("div");
    layer.className = "admin-modal-layer open";
    layer.innerHTML = `<section class="admin-modal${wide ? " wide" : ""}" role="dialog" aria-modal="true"><header class="admin-modal-head"><h2>${esc(title)}</h2><button class="admin-modal-close" type="button" aria-label="Cerrar">×</button></header><div class="admin-modal-body">${content}</div></section>`;
    document.body.append(layer);
    const close = () => layer.remove();
    layer.querySelector(".admin-modal-close").addEventListener("click", close);
    layer.addEventListener("click", event => { if (event.target === layer) close(); });
    return { layer, close, body: layer.querySelector(".admin-modal-body") };
  }

  function setPageTitle(title, subtitle = "") {
    const top = $("[data-admin-top-title]");
    if (top) top.textContent = title;
    const main = $("[data-admin-main]");
    if (!main) return null;
    main.innerHTML = `<div class="admin-page-head"><div><p>${esc(subtitle)}</p><h1>${esc(title)}</h1></div><div class="admin-actions-row" data-page-actions></div></div><section data-page-content><div class="admin-skeleton tall"></div></section>`;
    document.title = `${title} | Tips Admin`;
    return main;
  }

  mountShell();
  window.TipsAdmin = { $, $$, esc, usd, api, toast, modal, setIdentity, loadAlerts, showAuth, setPageTitle };
})();
