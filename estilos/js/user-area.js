(() => {
  "use strict";
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const page = document.body.dataset.userPage || "resumen";
  let csrf = "";

  async function api(path, options = {}) {
    const method = (options.method || "GET").toUpperCase();
    const headers = { Accept: "application/json", ...(options.headers || {}) };
    if (method !== "GET") {
      if (!csrf) {
        const r = await fetch("/api/csrf", { credentials: "same-origin" });
        csrf = (await r.json()).csrf_token;
      }
      headers["X-CSRF-Token"] = csrf;
      headers["Content-Type"] = "application/json";
    }
    const response = await fetch(path, { credentials: "same-origin", ...options, method, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || "No se pudo completar la acción.");
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function esc(value) {
    const node = document.createElement("div");
    node.textContent = String(value ?? "");
    return node.innerHTML;
  }
  const money = cents => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((Number(cents) || 0) / 100);

  function shell(user) {
    const side = $("[data-user-side]");
    const nav = [
      ["resumen", "/user/", "⌂", "Resumen"],
      ["datos", "/user/datos.html", "○", "Datos personales"],
      ["pedidos", "/user/pedidos.html", "▤", "Mis pedidos"],
      ["seguridad", "/user/seguridad.html", "◇", "Seguridad"],
    ];
    side.innerHTML = `<a class="user-brand" href="/index.html"><img src="/assets/logos/tips-logo-orange.svg" alt="Tips"><div><strong>Tips</strong><small>Mi cuenta</small></div></a><div class="user-side-label">Tu espacio</div><nav class="user-nav">${nav.map(([key, href, icon, label]) => `<a class="${page === key ? "active" : ""}" href="${href}"><span class="ico">${icon}</span>${label}</a>`).join("")}</nav><div class="user-side-foot"><a href="/tienda.html">← Volver a la tienda</a><button type="button" data-user-logout>Cerrar sesión</button></div>`;
    $("[data-user-top]").innerHTML = `<div style="display:flex;align-items:center;gap:10px"><button class="user-mobile-menu" type="button" data-user-menu>☰</button><strong>${esc(user.display_name)}</strong></div><a href="/index.html">Ver sitio público</a>`;
    $("[data-user-menu]")?.addEventListener("click", () => document.body.classList.toggle("user-menu-open"));
    $("[data-user-logout]")?.addEventListener("click", logout);
  }

  async function logout() {
    try { await api("/api/auth/logout", { method: "POST", body: "{}" }); } finally { location.href = "/index.html"; }
  }

  function head(title, subtitle) {
    $("[data-user-main]").innerHTML = `<div class="user-head"><div><p>${esc(subtitle)}</p><h1>${esc(title)}</h1></div></div><section data-user-content></section>`;
    return $("[data-user-content]");
  }

  function renderOverview(data) {
    const root = head("Hola, " + data.user.display_name, "Tu cuenta Tips en un solo lugar.");
    const orders = data.recent_orders || [];
    root.innerHTML = `<div class="user-grid-3"><article class="user-stat"><span>Pedidos recientes</span><strong>${orders.length}</strong></article><article class="user-stat"><span>Cuenta</span><strong>Activa</strong></article><article class="user-stat"><span>Correo</span><strong style="font-size:.95rem">${esc(data.user.email)}</strong></article></div><div class="user-grid" style="margin-top:16px"><article class="user-card"><h2>Tu información</h2><p>Mantén tus datos actualizados para comprar más rápido.</p><div class="user-avatar-card"><div class="user-avatar-large">${esc((data.user.display_name || "U").charAt(0).toUpperCase())}</div><div><strong>${esc(data.user.display_name)}</strong><small>${esc(data.user.email)}</small></div></div><div style="margin-top:18px"><a class="user-btn primary" href="/user/datos.html">Editar datos</a></div></article><article class="user-card"><h2>Seguridad</h2><p>Cambia tu contraseña o administra el estado de tu cuenta.</p><a class="user-btn" href="/user/seguridad.html">Ir a seguridad</a></article></div>`;
  }

  function renderData(data) {
    const root = head("Datos personales", "Cambia tu nombre o correo de forma segura.");
    root.innerHTML = `<article class="user-card"><form class="user-form" data-user-profile-form><label class="user-field"><span>Nombre</span><input name="display_name" maxlength="120" required value="${esc(data.user.display_name)}"></label><label class="user-field"><span>Correo</span><input name="email" type="email" maxlength="180" required value="${esc(data.user.email)}"></label><label class="user-field"><span>Contraseña actual</span><input name="current_password" type="password" autocomplete="current-password"><small style="color:var(--u-muted)">Solo es necesaria si cambias el correo.</small></label><div><button class="user-btn primary">Guardar cambios</button></div><p class="user-message" data-user-profile-message></p></form></article>`;
    $("[data-user-profile-form]").onsubmit = async event => {
      event.preventDefault();
      const form = event.currentTarget, fd = new FormData(form), message = $("[data-user-profile-message]");
      message.textContent = "Guardando…";
      try {
        await api("/api/account/profile", { method: "POST", body: JSON.stringify({ display_name: fd.get("display_name"), email: fd.get("email"), current_password: fd.get("current_password") }) });
        message.textContent = "Cambios guardados correctamente.";
        form.elements.current_password.value = "";
      } catch (error) { message.textContent = error.message; }
    };
  }

  function renderOrders(data) {
    const root = head("Mis pedidos", "Consulta tus compras más recientes.");
    const orders = data.recent_orders || [];
    root.innerHTML = `<article class="user-card">${orders.length ? orders.map(order => `<div class="user-order"><div><strong>${esc(order.public_id)}</strong><small>${esc(String(order.created_at).slice(0, 10))}</small></div><span class="user-chip">${esc(order.status)}</span><strong>${money(order.total_cents)}</strong></div>`).join("") : '<div class="user-empty"><strong>Aún no tienes pedidos.</strong>Cuando completes una compra aparecerá aquí.</div>'}</article>`;
  }

  function renderSecurity() {
    const root = head("Seguridad", "Protege tu acceso y controla el estado de tu cuenta.");
    root.innerHTML = `<div class="user-grid"><article class="user-card"><h2>Cambiar contraseña</h2><p>Al cambiarla, las otras sesiones activas se cerrarán.</p><form class="user-form" data-user-password-form><label class="user-field"><span>Contraseña actual</span><input type="password" name="current_password" autocomplete="current-password" required></label><label class="user-field"><span>Nueva contraseña</span><input type="password" name="new_password" minlength="12" autocomplete="new-password" required></label><label class="user-field"><span>Confirmar nueva contraseña</span><input type="password" name="confirm_password" minlength="12" autocomplete="new-password" required></label><button class="user-btn primary">Actualizar contraseña</button><p class="user-message" data-user-password-message></p></form></article><article class="user-card user-danger"><h2>Desactivar cuenta</h2><p>Tu cuenta dejará de poder iniciar sesión. Tus pedidos existentes se conservan como registro transaccional.</p><form class="user-form" data-user-deactivate-form><label class="user-field"><span>Contraseña actual</span><input type="password" name="current_password" required></label><label class="user-field"><span>Escribe DESACTIVAR</span><input name="confirmation" required autocomplete="off"></label><button class="user-btn danger">Desactivar mi cuenta</button><p class="user-message" data-user-deactivate-message></p></form></article></div>`;
    $("[data-user-password-form]").onsubmit = async event => {
      event.preventDefault(); const fd = new FormData(event.currentTarget), message = $("[data-user-password-message]");
      if (fd.get("new_password") !== fd.get("confirm_password")) { message.textContent = "Las contraseñas no coinciden."; return; }
      try { await api("/api/account/password", { method: "POST", body: JSON.stringify({ current_password: fd.get("current_password"), new_password: fd.get("new_password") }) }); message.textContent = "Contraseña actualizada."; event.currentTarget.reset(); } catch (error) { message.textContent = error.message; }
    };
    $("[data-user-deactivate-form]").onsubmit = async event => {
      event.preventDefault(); const fd = new FormData(event.currentTarget), message = $("[data-user-deactivate-message]");
      if (String(fd.get("confirmation")).trim().toUpperCase() !== "DESACTIVAR") { message.textContent = "Escribe DESACTIVAR para continuar."; return; }
      if (!confirm("¿Seguro que quieres desactivar tu cuenta?")) return;
      try { await api("/api/account/deactivate", { method: "POST", body: JSON.stringify({ current_password: fd.get("current_password"), confirmation: fd.get("confirmation") }) }); location.href = "/index.html"; } catch (error) { message.textContent = error.message; }
    };
  }

  async function boot() {
    try {
      const data = await api("/api/account");
      if (data.user.role !== "user") { location.href = "/admin/"; return; }
      shell(data.user);
      ({ resumen: renderOverview, datos: renderData, pedidos: renderOrders, seguridad: renderSecurity }[page] || renderOverview)(data);
    } catch (error) {
      if (error.status === 401) location.href = "/cuenta.html";
      else $("[data-user-main]").innerHTML = `<div class="user-empty"><strong>No pudimos cargar tu cuenta.</strong>${esc(error.message)}</div>`;
    }
  }
  boot();
})();
