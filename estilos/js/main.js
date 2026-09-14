// Navegación accesible y pequeños comportamientos compartidos.
const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".nav-links");

menuButton?.addEventListener("click", () => {
  const isOpen = navigation?.classList.toggle("is-open") ?? false;
  menuButton.setAttribute("aria-expanded", String(isOpen));
  document.body.style.overflow = isOpen ? "hidden" : "";
});

navigation?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    navigation.classList.remove("is-open");
    menuButton?.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  });
});

// Comparador antes/después de la vista de remodelación.
const comparison = document.querySelector("[data-comparison]");
const comparisonInput = comparison?.querySelector("input");
comparisonInput?.addEventListener("input", (event) => {
  comparison.style.setProperty("--split", `${event.target.value}%`);
});

