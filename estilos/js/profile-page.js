(() => {
  "use strict";
  if (document.body.dataset.page !== "profile") return;
  const $ = (s, c = document) => c.querySelector(s), $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const usd = cents => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((Number(cents) || 0) / 100);
  let csrf = "";
  async function api(path, options = {}) {
    const method = (options.method || "GET").toUpperCase();
    const headers = { Accept: "application/json", ...(options.headers || {}) };
    if (method !== "GET") {
      if (!csrf) { const r = await fetch("/api/csrf", { credentials: "same-origin" }); csrf = (await r.json()).csrf_token; }
      headers["X-CSRF-Token"] = csrf; headers["Content-Type"] = "application/json";
    }
    const response = await fetch(path, { credentials: "same-origin", ...options, method, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { const e = new Error(data.error || "No se pudo completar la acción."); e.status = response.status; throw e; }
    return data;
  }
  function esc(value){const d=document.createElement("div");d.textContent=String(value??"");return d.innerHTML}
  function show(name){$$('[data-profile-panel]').forEach(p=>p.classList.toggle("hidden",p.dataset.profilePanel!==name));$$('[data-profile-tab]').forEach(b=>b.classList.toggle("active",b.dataset.profileTab===name))}
  $$('[data-profile-tab]').forEach(b=>b.onclick=()=>show(b.dataset.profileTab));
  async function load(){try{const data=await api("/api/account");const u=data.user;show("datos");$("[data-profile-name]").textContent=u.display_name;$("[data-profile-email]").textContent=u.email;$("[data-profile-avatar]").textContent=(u.display_name||u.email).charAt(0).toUpperCase();const form=$("[data-profile-form]");form.elements.display_name.value=u.display_name;form.elements.email.value=u.email;$("[data-profile-orders]").innerHTML=data.recent_orders.length?data.recent_orders.map(o=>`<article class="profile-order"><div><strong>${esc(o.public_id)}</strong><small>${esc(String(o.created_at).slice(0,10))}</small></div><span>${esc(o.status)}</span><strong>${usd(o.total_cents)}</strong></article>`).join(""):'<div class="empty-state"><strong>Aún no tienes pedidos.</strong><p>Cuando completes una compra aparecerá aquí.</p></div>'}catch(e){if(e.status===401){location.href="cuenta.html";return}show("datos");$("[data-profile-panel="+CSS.escape("datos")+"]").innerHTML=`<div class="empty-state"><strong>No pudimos cargar tu cuenta.</strong><p>${esc(e.message)}</p></div>`}}
  $("[data-profile-form]").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget),m=$("[data-profile-message]");m.textContent="Guardando...";try{const r=await api("/api/account/profile",{method:"POST",body:JSON.stringify({display_name:f.get("display_name"),email:f.get("email"),current_password:f.get("current_password")})});m.textContent="Cambios guardados.";$("[data-profile-name]").textContent=r.user.display_name;$("[data-profile-email]").textContent=r.user.email;e.currentTarget.elements.current_password.value=""}catch(x){m.textContent=x.message}};
  $("[data-password-form]").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget),m=$("[data-password-message]");if(f.get("new_password")!==f.get("confirm_password")){m.textContent="Las contraseñas nuevas no coinciden.";return}m.textContent="Actualizando...";try{await api("/api/account/password",{method:"POST",body:JSON.stringify({current_password:f.get("current_password"),new_password:f.get("new_password")})});m.textContent="Contraseña actualizada. Las otras sesiones se cerraron.";e.currentTarget.reset()}catch(x){m.textContent=x.message}};
  $("[data-deactivate-form]").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.currentTarget),m=$("[data-deactivate-message]");if(String(f.get("confirmation")).trim().toUpperCase()!=="DESACTIVAR"){m.textContent="Escribe DESACTIVAR para continuar.";return}if(!confirm("¿Seguro que quieres desactivar tu cuenta?"))return;try{await api("/api/account/deactivate",{method:"POST",body:JSON.stringify({current_password:f.get("current_password"),confirmation:f.get("confirmation")})});location.href="index.html"}catch(x){m.textContent=x.message}};
  load();
})();
