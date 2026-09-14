(() => {
  "use strict";

  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];
  const root = $("[data-admin-root]");
  const authBox = $("[data-admin-auth]");
  const title = $("[data-admin-title]");
  const nameEl = $("[data-admin-name]");
  const initialEl = $("[data-admin-initial]");
  const alertCount = $("[data-alert-count]");
  const drawer = $("[data-notification-drawer]");
  const notificationList = $("[data-notification-list]");
  const toastStack = $("[data-toast-stack]");
  let csrfToken = "";
  let overviewCache = null;

  const titles = {
    overview: "Resumen",
    content: "Contenido del sitio",
    products: "Productos",
    projects: "Proyectos",
    quotes: "Cotizaciones",
    orders: "Pedidos",
    sales: "Ventas",
    inventory: "Inventario",
    reports: "Reportes",
    promotions: "Promociones",
    clients: "Clientes",
    users: "Usuarios",
    settings: "Apariencia",
  };

  const esc = (value) => {
    const node = document.createElement("div");
    node.textContent = String(value ?? "");
    return node.innerHTML;
  };

  const money = (cents = 0) => new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format((Number(cents) || 0) / 100);

  async function ensureCsrf() {
    if (csrfToken) return csrfToken;
    const response = await fetch("/api/csrf", { credentials: "same-origin" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo iniciar la sesión segura.");
    csrfToken = data.csrf_token;
    return csrfToken;
  }

  async function api(path, options = {}) {
    const method = (options.method || "GET").toUpperCase();
    const headers = { Accept: "application/json", ...(options.headers || {}) };
    if (method !== "GET" && method !== "HEAD") {
      headers["X-CSRF-Token"] = await ensureCsrf();
      headers["Content-Type"] = "application/json";
    }
    const response = await fetch(path, {
      credentials: "same-origin",
      ...options,
      method,
      headers,
    });
    const data = await response.json().catch(() => ({ error: "Respuesta inválida del servidor." }));
    if (!response.ok) {
      const error = new Error(data.error || "Ocurrió un error.");
      error.status = response.status;
      throw error;
    }
    return data;
  }

  function toast(message, type = "success") {
    const node = document.createElement("div");
    node.className = `admin-toast ${type === "error" ? "error" : type === "warning" ? "warning" : ""}`;
    node.textContent = message;
    toastStack?.appendChild(node);
    window.setTimeout(() => node.remove(), 3600);
  }

  function showSkeleton(kind = "panel") {
    if (!root) return;
    root.innerHTML = kind === "overview"
      ? '<div class="skeleton-metrics"><div class="admin-skeleton"></div><div class="admin-skeleton"></div><div class="admin-skeleton"></div><div class="admin-skeleton"></div></div><div class="admin-skeleton skeleton-panel"></div>'
      : '<div class="admin-skeleton skeleton-panel"></div>';
  }

  function statusLabel(status) {
    const map = {
      pending: "Pendiente", paid: "Pagado", processing: "En proceso", ready: "Listo",
      shipped: "Enviado", completed: "Completado", cancelled: "Cancelado", refunded: "Reembolsado",
      new: "Nueva", contacted: "Contactada", qualified: "Calificada", closed: "Cerrada", archived: "Archivada",
      available: "Disponible", low: "Bajo", out: "Agotado", made_to_order: "Bajo pedido",
    };
    return map[status] || status || "—";
  }

  function statusClass(status) {
    return ["low", "pending", "new"].includes(status) ? "warn" : ["out", "cancelled", "archived"].includes(status) ? "off" : "";
  }

  function setAdminIdentity(user) {
    if (!user) return;
    if (nameEl) nameEl.textContent = user.display_name || "Administrador";
    if (initialEl) initialEl.textContent = (user.display_name || "A").trim().charAt(0).toUpperCase();
  }

  function updateNotifications(alerts = []) {
    if (alertCount) {
      alertCount.textContent = String(alerts.length);
      alertCount.classList.toggle("hidden", alerts.length === 0);
    }
    if (notificationList) {
      notificationList.innerHTML = alerts.length
        ? alerts.map(alert => `<button class="notification-item" data-alert-view="${esc(alert.view)}"><strong>${esc(alert.title)}</strong><p>${esc(alert.message)}</p></button>`).join("")
        : '<div class="notification-item"><strong>Todo al día</strong><p>No hay alertas operativas en este momento.</p></div>';
      $$("[data-alert-view]", notificationList).forEach(button => {
        button.addEventListener("click", () => {
          closeNotifications();
          setView(button.dataset.alertView || "overview");
        });
      });
    }
  }

  function openNotifications() {
    drawer?.classList.add("open");
    drawer?.setAttribute("aria-hidden", "false");
  }

  function closeNotifications() {
    drawer?.classList.remove("open");
    drawer?.setAttribute("aria-hidden", "true");
  }

  $("[data-notifications]")?.addEventListener("click", openNotifications);
  $$("[data-notification-close]").forEach(button => button.addEventListener("click", closeNotifications));

  function renderOverview(data) {
    overviewCache = data;
    setAdminIdentity(data.user);
    updateNotifications(data.alerts || []);
    const metrics = data.metrics || {};
    root.innerHTML = `
      <section class="admin-view">
        <div class="admin-page-head"><div><h2>Resumen operativo</h2><p>Lo que necesita atención hoy, sin mezclar el panel con la experiencia del cliente.</p></div><button class="admin-button secondary" data-refresh-overview>Actualizar</button></div>
        <div class="metrics-grid">
          <article class="metric-card"><div class="metric-top"><span>Ventas</span><span class="metric-icon">$</span></div><strong>${money(metrics.sales_cents)}</strong><small>Ventas registradas</small></article>
          <article class="metric-card"><div class="metric-top"><span>Pedidos</span><span class="metric-icon">▤</span></div><strong>${esc(metrics.orders)}</strong><small>Pedidos totales</small></article>
          <article class="metric-card"><div class="metric-top"><span>Productos</span><span class="metric-icon">□</span></div><strong>${esc(metrics.products)}</strong><small>Productos activos</small></article>
          <article class="metric-card"><div class="metric-top"><span>Cotizaciones</span><span class="metric-icon">◇</span></div><strong>${esc(metrics.quotes)}</strong><small>Solicitudes recibidas</small></article>
        </div>
        <div class="alerts-strip">
          ${(data.alerts || []).length ? data.alerts.map(alert => `<button class="alert-card ${esc(alert.level)}" data-alert-view="${esc(alert.view)}"><span class="alert-dot"></span><div><strong>${esc(alert.title)}</strong><p>${esc(alert.message)}</p></div></button>`).join("") : '<div class="alert-card success"><span class="alert-dot"></span><div><strong>Sin alertas críticas</strong><p>Inventario, pedidos y cotizaciones están bajo control.</p></div></div>'}
        </div>
        <div class="admin-grid-2">
          <section class="admin-panel"><div class="admin-panel-head"><div><h3>Pedidos recientes</h3><small>Últimos movimientos de venta</small></div><button class="admin-button small secondary" data-go-view="orders">Ver pedidos</button></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Pedido</th><th>Cliente</th><th>Estado</th><th>Total</th></tr></thead><tbody>${(data.orders || []).length ? data.orders.map(order => `<tr><td><strong>${esc(order.public_id)}</strong></td><td>${esc(order.customer_name)}</td><td><span class="status-pill ${statusClass(order.status)}">${esc(statusLabel(order.status))}</span></td><td>${money(order.total_cents)}</td></tr>`).join("") : '<tr><td colspan="4">Todavía no hay pedidos.</td></tr>'}</tbody></table></div></section>
          <section class="admin-panel"><div class="admin-panel-head"><div><h3>Cotizaciones recientes</h3><small>Solicitudes de arquitectura</small></div><button class="admin-button small secondary" data-go-view="quotes">Gestionar</button></div><div class="activity-list">${(data.quotes || []).length ? data.quotes.map(quote => `<article class="activity-item"><div class="activity-mark">◇</div><div><strong>${esc(quote.name)}</strong><p>${esc(quote.project_type)} · ${esc(statusLabel(quote.status))}</p></div></article>`).join("") : '<div class="empty-admin">Sin cotizaciones nuevas.</div>'}</div></section>
        </div>
      </section>`;
    bindNavigationShortcuts();
    $("[data-refresh-overview]")?.addEventListener("click", () => setView("overview", true));
  }

  async function renderContent() {
    const data = await api("/api/admin/settings");
    setAdminIdentity(data.user);
    const values = Object.fromEntries(data.items.map(item => [item.key, item.value || {}]));
    const home = values.home || {};
    const contact = values.contact || {};
    root.innerHTML = `
      <section class="admin-view">
        <div class="admin-page-head"><div><h2>Contenido del sitio</h2><p>Edita textos visibles sin tocar HTML. Los cambios se guardan en SQLite y se reflejan en el sitio público.</p></div><a class="admin-button secondary" href="index.html" target="_blank" rel="noreferrer">Vista pública ↗</a></div>
        <form class="admin-editor-section" data-home-form>
          <h3>Página de inicio</h3><p>Contenido principal del hero.</p>
          <div class="admin-form-grid">
            <div class="admin-field full"><span>Etiqueta superior</span><input name="eyebrow" maxlength="120" value="${esc(home.eyebrow || "")}"></div>
            <div class="admin-field"><span>Título</span><input name="title" maxlength="120" value="${esc(home.title || "")}"></div>
            <div class="admin-field"><span>Palabra destacada</span><input name="highlight" maxlength="120" value="${esc(home.highlight || "")}"></div>
            <div class="admin-field full"><span>Descripción</span><textarea name="description" maxlength="900">${esc(home.description || "")}</textarea></div>
            <div class="admin-field"><span>CTA principal</span><input name="primary_cta" maxlength="80" value="${esc(home.primary_cta || "")}"></div>
            <div class="admin-field"><span>CTA secundario</span><input name="secondary_cta" maxlength="80" value="${esc(home.secondary_cta || "")}"></div>
          </div>
          <div class="admin-editor-actions"><button class="admin-button primary" type="submit">Guardar inicio</button></div>
        </form>
        <form class="admin-editor-section" data-contact-form>
          <h3>Contacto y redes</h3><p>Datos utilizados en pie de página y futuras notificaciones.</p>
          <div class="admin-form-grid">
            <div class="admin-field full"><span>Ubicación</span><input name="location" maxlength="180" value="${esc(contact.location || "")}"></div>
            <div class="admin-field"><span>Correo</span><input name="email" type="email" maxlength="180" value="${esc(contact.email || "")}"></div>
            <div class="admin-field"><span>WhatsApp</span><input name="whatsapp" maxlength="80" value="${esc(contact.whatsapp || "")}" placeholder="+503 ..."></div>
            <div class="admin-field"><span>Instagram</span><input name="instagram" maxlength="300" value="${esc(contact.instagram || "")}"></div>
            <div class="admin-field"><span>Facebook</span><input name="facebook" maxlength="300" value="${esc(contact.facebook || "")}"></div>
          </div>
          <div class="admin-editor-actions"><button class="admin-button primary" type="submit">Guardar contacto</button></div>
        </form>
      </section>`;
    $("[data-home-form]")?.addEventListener("submit", event => saveObjectForm(event, "home"));
    $("[data-contact-form]")?.addEventListener("submit", event => saveObjectForm(event, "contact"));
  }

  async function saveObjectForm(event, key) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const value = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v).trim()]));
    try {
      await api("/api/admin/settings/save", { method: "POST", body: JSON.stringify({ key, value, is_public: true }) });
      toast("Cambios guardados correctamente.");
    } catch (error) {
      toast(error.message, "error");
    }
  }

  async function renderAppearance() {
    const data = await api("/api/admin/settings");
    const themeItem = data.items.find(item => item.key === "theme");
    const theme = themeItem?.value || {};
    root.innerHTML = `
      <section class="admin-view">
        <div class="admin-page-head"><div><h2>Apariencia</h2><p>Controla la identidad visual sin modificar CSS manualmente.</p></div></div>
        <form class="admin-editor-section" data-theme-form>
          <h3>Paleta y logotipo</h3><p>Los colores se aplican como variables del sistema en las vistas públicas.</p>
          <div class="admin-form-grid">
            ${colorField("primary", "Verde principal", theme.primary || "#173d2b")}
            ${colorField("accent", "Acento", theme.accent || "#ef7d22")}
            ${colorField("secondary", "Secundario", theme.secondary || "#825334")}
            ${colorField("surface", "Fondo", theme.surface || "#f7f7f2")}
            <div class="admin-field full"><span>Versión del logotipo</span><div class="logo-choice">${["orange", "green", "black", "brown"].map(variant => `<label><img src="assets/logos/tips-logo-${variant}.svg" alt="Logo ${variant}"><span><input type="radio" name="logo_variant" value="${variant}" ${theme.logo_variant === variant ? "checked" : ""}> ${variant}</span></label>`).join("")}</div></div>
          </div>
          <div class="admin-editor-actions"><button class="admin-button primary" type="submit">Guardar apariencia</button></div>
        </form>
      </section>`;
    $("[data-theme-form]")?.addEventListener("submit", async event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const value = {
        primary: String(data.get("primary")), accent: String(data.get("accent")),
        secondary: String(data.get("secondary")), surface: String(data.get("surface")),
        logo_variant: String(data.get("logo_variant") || "orange"),
      };
      try {
        await api("/api/admin/settings/save", { method: "POST", body: JSON.stringify({ key: "theme", value, is_public: true }) });
        toast("Apariencia actualizada.");
      } catch (error) { toast(error.message, "error"); }
    });
  }

  function colorField(name, label, value) {
    return `<div class="admin-field"><span>${esc(label)}</span><div class="color-field"><input type="color" name="${name}" value="${esc(value)}"><input value="${esc(value)}" data-color-text="${name}" aria-label="${esc(label)}"></div></div>`;
  }

  async function renderProducts(inventoryOnly = false) {
    const data = await api("/api/admin/products");
    const items = data.items || [];
    root.innerHTML = `
      <section class="admin-view">
        <div class="admin-page-head"><div><h2>${inventoryOnly ? "Inventario" : "Productos"}</h2><p>${inventoryOnly ? "Ajusta existencias y detecta niveles bajos." : "Edita nombre, precio, disponibilidad, descripción y estado de publicación."}</p></div></div>
        <section class="admin-panel">
          <div class="admin-panel-head"><div><h3>${inventoryOnly ? "Existencias" : "Catálogo"}</h3><small>${items.length} registros</small></div></div>
          <div>${items.length ? items.map(item => inventoryOnly ? inventoryRow(item) : productRow(item)).join("") : '<div class="empty-admin">No hay productos registrados.</div>'}</div>
        </section>
      </section>`;
    $$("[data-product-save]").forEach(button => button.addEventListener("click", () => saveProduct(button)));
  }

  function productRow(item) {
    return `<div class="edit-row" data-product-row="${item.id}"><input data-field="name" value="${esc(item.name)}" aria-label="Nombre"><input data-field="price" type="number" min="0" step="0.01" value="${(Number(item.base_price_cents) / 100).toFixed(2)}" aria-label="Precio"><select data-field="status" aria-label="Estado">${["available", "low", "out", "made_to_order"].map(s => `<option value="${s}" ${item.stock_status === s ? "selected" : ""}>${statusLabel(s)}</option>`).join("")}</select><input data-field="stock" type="number" min="0" value="${item.stock_quantity ?? ""}" aria-label="Inventario"><button class="admin-button small primary" data-product-save="${item.id}">Guardar</button><textarea data-field="description" maxlength="5000" aria-label="Descripción">${esc(item.description)}</textarea></div>`;
  }

  function inventoryRow(item) {
    return `<div class="edit-row" data-product-row="${item.id}"><div><strong>${esc(item.name)}</strong><div class="muted">${esc(item.category_name || "Sin categoría")}</div></div><div><span class="status-pill ${statusClass(item.stock_status)}">${statusLabel(item.stock_status)}</span></div><input data-field="stock" type="number" min="0" value="${item.stock_quantity ?? ""}" aria-label="Inventario"><select data-field="status" aria-label="Estado">${["available", "low", "out", "made_to_order"].map(s => `<option value="${s}" ${item.stock_status === s ? "selected" : ""}>${statusLabel(s)}</option>`).join("")}</select><button class="admin-button small primary" data-product-save="${item.id}">Actualizar</button></div>`;
  }

  async function saveProduct(button) {
    const row = button.closest("[data-product-row]");
    const id = Number(button.dataset.productSave);
    const name = $("[data-field='name']", row)?.value;
    const description = $("[data-field='description']", row)?.value;
    const priceInput = $("[data-field='price']", row);
    const payload = {
      id,
      stock_status: $("[data-field='status']", row)?.value,
      stock_quantity: $("[data-field='stock']", row)?.value === "" ? null : Number($("[data-field='stock']", row)?.value),
    };
    if (name !== undefined) payload.name = name.trim();
    if (description !== undefined) payload.description = description.trim();
    if (priceInput) payload.base_price_cents = Math.max(0, Math.round(Number(priceInput.value || 0) * 100));
    try {
      await api("/api/admin/products/update", { method: "POST", body: JSON.stringify(payload) });
      toast("Producto actualizado.");
      overviewCache = null;
    } catch (error) { toast(error.message, "error"); }
  }

  async function renderProjects() {
    const data = await api("/api/admin/projects");
    root.innerHTML = `
      <section class="admin-view"><div class="admin-page-head"><div><h2>Proyectos</h2><p>Edita el contenido del portafolio y controla qué proyectos están publicados.</p></div></div><section class="admin-panel"><div>${data.items.length ? data.items.map(project => `<form class="quote-admin-card" data-project-form="${project.id}"><div class="admin-form-grid"><div class="admin-field"><span>Título</span><input name="title" value="${esc(project.title)}"></div><div class="admin-field"><span>Categoría</span><input name="category" value="${esc(project.category)}"></div><div class="admin-field full"><span>Resumen</span><textarea name="summary">${esc(project.summary)}</textarea></div><div class="admin-field full"><span>Descripción</span><textarea name="description">${esc(project.description)}</textarea></div><div class="admin-field"><span>Ubicación</span><input name="location" value="${esc(project.location || "")}"></div><div class="admin-field"><span>Año</span><input name="completed_year" type="number" min="1900" max="2200" value="${project.completed_year || ""}"></div><label class="admin-field"><span>Publicación</span><select name="is_published"><option value="1" ${project.is_published ? "selected" : ""}>Publicado</option><option value="0" ${!project.is_published ? "selected" : ""}>Oculto</option></select></label></div><div class="admin-editor-actions"><a class="admin-button secondary small" href="proyecto.html?id=${project.id}" target="_blank" rel="noreferrer">Ver ↗</a><button class="admin-button primary small">Guardar proyecto</button></div></form>`).join("") : '<div class="empty-admin">No hay proyectos.</div>'}</div></section></section>`;
    $$("[data-project-form]").forEach(form => form.addEventListener("submit", async event => {
      event.preventDefault();
      const fd = new FormData(form);
      const yearValue = String(fd.get("completed_year") || "").trim();
      const payload = {
        id: Number(form.dataset.projectForm), title: String(fd.get("title") || "").trim(),
        category: String(fd.get("category") || "").trim(), summary: String(fd.get("summary") || "").trim(),
        description: String(fd.get("description") || "").trim(), location: String(fd.get("location") || "").trim(),
        completed_year: yearValue ? Number(yearValue) : null, is_published: fd.get("is_published") === "1",
      };
      try { await api("/api/admin/projects/update", { method: "POST", body: JSON.stringify(payload) }); toast("Proyecto actualizado."); }
      catch (error) { toast(error.message, "error"); }
    }));
  }

  async function renderQuotes() {
    const data = await api("/api/admin/quotes");
    root.innerHTML = `<section class="admin-view"><div class="admin-page-head"><div><h2>Cotizaciones</h2><p>Revisa solicitudes, deja notas internas y cambia su estado.</p></div></div><section class="admin-panel">${data.items.length ? data.items.map(quote => `<article class="quote-admin-card" data-quote-row="${quote.id}"><div class="quote-admin-top"><div><strong>${esc(quote.name)}</strong><div class="muted">${esc(quote.contact)} · ${esc(quote.project_type)}</div></div><span class="status-pill ${statusClass(quote.status)}">${statusLabel(quote.status)}</span></div><p>${esc(quote.message)}</p><textarea data-quote-notes placeholder="Notas internas...">${esc(quote.internal_notes || "")}</textarea><div class="quote-admin-actions"><select data-quote-status>${["new", "contacted", "qualified", "closed", "archived"].map(s => `<option value="${s}" ${quote.status === s ? "selected" : ""}>${statusLabel(s)}</option>`).join("")}</select><button class="admin-button primary small" data-quote-save="${quote.id}">Guardar</button></div></article>`).join("") : '<div class="empty-admin">No hay cotizaciones.</div>'}</section></section>`;
    $$("[data-quote-save]").forEach(button => button.addEventListener("click", async () => {
      const row = button.closest("[data-quote-row]");
      const payload = { id: Number(button.dataset.quoteSave), status: $("[data-quote-status]", row).value, internal_notes: $("[data-quote-notes]", row).value.trim() };
      try { await api("/api/admin/quotes/update", { method: "POST", body: JSON.stringify(payload) }); toast("Cotización actualizada."); setView("quotes", true); }
      catch (error) { toast(error.message, "error"); }
    }));
  }

  async function renderOrders() {
    const data = await api("/api/admin/orders");
    root.innerHTML = `<section class="admin-view"><div class="admin-page-head"><div><h2>Pedidos</h2><p>Gestiona el ciclo operativo de cada pedido.</p></div></div><section class="admin-panel"><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Pedido</th><th>Cliente</th><th>Contacto</th><th>Total</th><th>Estado</th><th></th></tr></thead><tbody>${data.items.length ? data.items.map(order => `<tr data-order-row="${order.id}"><td><strong>${esc(order.public_id)}</strong><div class="muted">${esc(order.created_at)}</div></td><td>${esc(order.customer_name)}</td><td><div>${esc(order.email || "")}</div><div class="muted">${esc(order.phone || "")}</div></td><td>${money(order.total_cents)}</td><td><select data-order-status>${["pending", "paid", "processing", "ready", "shipped", "completed", "cancelled", "refunded"].map(s => `<option value="${s}" ${order.status === s ? "selected" : ""}>${statusLabel(s)}</option>`).join("")}</select></td><td><button class="admin-button small primary" data-order-save="${order.id}">Guardar</button></td></tr>`).join("") : '<tr><td colspan="6">No hay pedidos.</td></tr>'}</tbody></table></div></section></section>`;
    $$("[data-order-save]").forEach(button => button.addEventListener("click", async () => {
      const row = button.closest("[data-order-row]");
      try { await api("/api/admin/orders/update", { method: "POST", body: JSON.stringify({ id: Number(button.dataset.orderSave), status: $("[data-order-status]", row).value }) }); toast("Estado del pedido actualizado."); overviewCache = null; }
      catch (error) { toast(error.message, "error"); }
    }));
  }

  async function renderUsers(clientsOnly = false) {
    const data = await api("/api/admin/users");
    const items = clientsOnly ? data.items.filter(user => user.role === "user") : data.items;
    root.innerHTML = `<section class="admin-view"><div class="admin-page-head"><div><h2>${clientsOnly ? "Clientes" : "Usuarios"}</h2><p>${clientsOnly ? "Cuentas de clientes registradas en el sistema." : "Administra roles y acceso. El sistema impide eliminar el último administrador."}</p></div></div><section class="admin-panel"><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th>${clientsOnly ? "" : "<th></th>"}</tr></thead><tbody>${items.length ? items.map(user => `<tr data-user-row="${user.id}"><td><strong>${esc(user.display_name)}</strong><div class="muted">Creado ${esc(user.created_at)}</div></td><td>${esc(user.email)}</td><td>${clientsOnly ? esc(user.role) : `<select data-user-role><option value="user" ${user.role === "user" ? "selected" : ""}>Usuario</option><option value="admin" ${user.role === "admin" ? "selected" : ""}>Admin</option></select>`}</td><td>${clientsOnly ? `<span class="status-pill ${user.is_active ? "" : "off"}">${user.is_active ? "Activo" : "Inactivo"}</span>` : `<select data-user-active><option value="1" ${user.is_active ? "selected" : ""}>Activo</option><option value="0" ${!user.is_active ? "selected" : ""}>Inactivo</option></select>`}</td>${clientsOnly ? "" : `<td><button class="admin-button small primary" data-user-save="${user.id}">Guardar</button></td>`}</tr>`).join("") : `<tr><td colspan="5">No hay ${clientsOnly ? "clientes" : "usuarios"}.</td></tr>`}</tbody></table></div></section></section>`;
    if (!clientsOnly) {
      $$("[data-user-save]").forEach(button => button.addEventListener("click", async () => {
        const row = button.closest("[data-user-row]");
        const payload = { id: Number(button.dataset.userSave), role: $("[data-user-role]", row).value, is_active: $("[data-user-active]", row).value === "1" };
        try { await api("/api/admin/users/update", { method: "POST", body: JSON.stringify(payload) }); toast("Usuario actualizado."); }
        catch (error) { toast(error.message, "error"); }
      }));
    }
  }

  async function renderPromotions() {
    const data = await api("/api/admin/promotions");
    root.innerHTML = `<section class="admin-view"><div class="admin-page-head"><div><h2>Promociones</h2><p>Crea códigos de descuento y controla su vigencia.</p></div></div><form class="admin-editor-section" data-promo-form><h3>Nueva promoción</h3><div class="admin-form-grid"><div class="admin-field"><span>Nombre</span><input name="name" required></div><div class="admin-field"><span>Código</span><input name="code" placeholder="TIPS10"></div><div class="admin-field"><span>Tipo</span><select name="discount_type"><option value="percent">Porcentaje</option><option value="fixed">Monto fijo en centavos</option></select></div><div class="admin-field"><span>Valor</span><input name="discount_value" type="number" min="0" required></div></div><div class="admin-editor-actions"><button class="admin-button primary">Crear promoción</button></div></form><section class="admin-panel"><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Nombre</th><th>Código</th><th>Tipo</th><th>Valor</th><th>Estado</th></tr></thead><tbody>${data.items.length ? data.items.map(promo => `<tr><td>${esc(promo.name)}</td><td>${esc(promo.code || "—")}</td><td>${esc(promo.discount_type)}</td><td>${promo.discount_type === "percent" ? `${esc(promo.discount_value)}%` : money(promo.discount_value)}</td><td><span class="status-pill ${promo.is_active ? "" : "off"}">${promo.is_active ? "Activa" : "Inactiva"}</span></td></tr>`).join("") : '<tr><td colspan="5">No hay promociones.</td></tr>'}</tbody></table></div></section></section>`;
    $("[data-promo-form]")?.addEventListener("submit", async event => {
      event.preventDefault();
      const fd = new FormData(event.currentTarget);
      const payload = { name: String(fd.get("name") || "").trim(), code: String(fd.get("code") || "").trim(), discount_type: String(fd.get("discount_type") || "percent"), discount_value: Number(fd.get("discount_value") || 0), is_active: true };
      try { await api("/api/admin/promotions/save", { method: "POST", body: JSON.stringify(payload) }); toast("Promoción creada."); setView("promotions", true); }
      catch (error) { toast(error.message, "error"); }
    });
  }

  async function renderSales() {
    const data = await api("/api/admin/orders");
    const paid = data.items.filter(order => ["paid", "processing", "ready", "shipped", "completed"].includes(order.status));
    const total = paid.reduce((sum, order) => sum + Number(order.total_cents || 0), 0);
    root.innerHTML = `<section class="admin-view"><div class="admin-page-head"><div><h2>Ventas</h2><p>Resumen financiero derivado de los pedidos registrados.</p></div></div><div class="metrics-grid"><article class="metric-card"><div class="metric-top"><span>Ventas acumuladas</span><span class="metric-icon">$</span></div><strong>${money(total)}</strong><small>${paid.length} pedidos pagados</small></article><article class="metric-card"><div class="metric-top"><span>Ticket promedio</span><span class="metric-icon">↗</span></div><strong>${money(paid.length ? Math.round(total / paid.length) : 0)}</strong><small>Promedio por pedido</small></article></div><section class="admin-panel"><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Pedido</th><th>Cliente</th><th>Estado</th><th>Total</th></tr></thead><tbody>${paid.map(order => `<tr><td>${esc(order.public_id)}</td><td>${esc(order.customer_name)}</td><td>${statusLabel(order.status)}</td><td>${money(order.total_cents)}</td></tr>`).join("") || '<tr><td colspan="4">Sin ventas registradas.</td></tr>'}</tbody></table></div></section></section>`;
  }

  async function renderReports() {
    const [orders, products, quotes] = await Promise.all([api("/api/admin/orders"), api("/api/admin/products"), api("/api/admin/quotes")]);
    const low = products.items.filter(item => item.stock_quantity !== null && Number(item.stock_quantity) <= 5);
    const openQuotes = quotes.items.filter(item => ["new", "contacted", "qualified"].includes(item.status));
    root.innerHTML = `<section class="admin-view"><div class="admin-page-head"><div><h2>Reportes</h2><p>Lectura rápida de operación, inventario y oportunidades comerciales.</p></div></div><div class="metrics-grid"><article class="metric-card"><div class="metric-top"><span>Pedidos</span><span class="metric-icon">▤</span></div><strong>${orders.items.length}</strong><small>Total histórico</small></article><article class="metric-card"><div class="metric-top"><span>Stock bajo</span><span class="metric-icon">!</span></div><strong>${low.length}</strong><small>Variantes a revisar</small></article><article class="metric-card"><div class="metric-top"><span>Leads abiertos</span><span class="metric-icon">◇</span></div><strong>${openQuotes.length}</strong><small>Cotizaciones activas</small></article><article class="metric-card"><div class="metric-top"><span>Productos</span><span class="metric-icon">□</span></div><strong>${products.items.length}</strong><small>Catálogo total</small></article></div></section>`;
  }

  function bindNavigationShortcuts() {
    $$("[data-go-view],[data-alert-view]", root).forEach(button => {
      button.addEventListener("click", () => setView(button.dataset.goView || button.dataset.alertView || "overview"));
    });
  }

  async function setView(view, force = false) {
    const target = titles[view] ? view : "overview";
    title.textContent = titles[target];
    $$("[data-view]").forEach(button => button.classList.toggle("active", button.dataset.view === target));
    showSkeleton(target === "overview" ? "overview" : "panel");
    try {
      if (target === "overview") {
        if (!overviewCache || force) overviewCache = await api("/api/admin/overview");
        renderOverview(overviewCache);
      } else if (target === "content") await renderContent();
      else if (target === "settings") await renderAppearance();
      else if (target === "products") await renderProducts(false);
      else if (target === "inventory") await renderProducts(true);
      else if (target === "projects") await renderProjects();
      else if (target === "quotes") await renderQuotes();
      else if (target === "orders") await renderOrders();
      else if (target === "users") await renderUsers(false);
      else if (target === "clients") await renderUsers(true);
      else if (target === "promotions") await renderPromotions();
      else if (target === "sales") await renderSales();
      else if (target === "reports") await renderReports();
      history.replaceState(null, "", `#${target}`);
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        root.classList.add("hidden");
        authBox?.classList.remove("hidden");
      } else {
        root.innerHTML = `<section class="admin-view admin-panel"><div class="empty-admin"><strong>No se pudo cargar esta sección.</strong><p>${esc(error.message)}</p></div></section>`;
        toast(error.message, "error");
      }
    }
  }

  $$("[data-view]").forEach(button => button.addEventListener("click", () => setView(button.dataset.view)));
  $("[data-admin-logout]")?.addEventListener("click", async () => {
    try { await api("/api/auth/logout", { method: "POST", body: "{}" }); location.href = "cuenta.html"; }
    catch (error) { toast(error.message, "error"); }
  });

  document.addEventListener("input", event => {
    const textInput = event.target.closest("[data-color-text]");
    if (textInput && /^#[0-9a-fA-F]{6}$/.test(textInput.value)) {
      const color = $(`input[type='color'][name='${textInput.dataset.colorText}']`);
      if (color) color.value = textInput.value;
    }
    const colorInput = event.target.matches("input[type='color']") ? event.target : null;
    if (colorInput) {
      const text = $(`[data-color-text='${colorInput.name}']`);
      if (text) text.value = colorInput.value;
    }
  });

  setView(location.hash.replace("#", "") || "overview", true);
})();
