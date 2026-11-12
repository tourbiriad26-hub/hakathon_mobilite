// Configuration Observable Framework — https://observablehq.com/framework/config

// Menu principal : affiché en haut de chaque page (onglets) et dans la barre latérale.
const MENU = [
  {name: "Accueil", path: "/", court: "Accueil"},
  {name: "Se déplacer", path: "/deplacements", court: "Se déplacer"},
  {name: "Trouver un emploi", path: "/emploi", court: "Emploi"},
  {name: "D'où viennent les travailleurs", path: "/flux", court: "Trajets"},
  {name: "Revenus et transports", path: "/inegalites", court: "Revenus"},
  {name: "Gares et stations", path: "/transport", court: "Gares"},
  {name: "Catalogue des données", path: "/catalogue", court: "Catalogue"},
  {name: "Sources et méthode", path: "/sources", court: "Sources"}
];

// Onglets du haut : l'onglet de la page affichée est mis en avant.
function onglets({path}) {
  const courant = path === "/index" ? "/" : path;
  const liens = MENU.map(
    (p) => `<a href=".${p.path === "/" ? "/" : p.path}"${p.path === courant ? ' class="actif" aria-current="page"' : ""}>${p.court}</a>`
  ).join("");
  return `<nav class="onglets" aria-label="Menu principal">${liens}</nav>`;
}

// Police Raleway, celle du site d'Île-de-France Mobilités.
const POLICE =
  '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Raleway:wght@400;500;600;700;800;900&display=swap">';

export default {
  title: "Mobilité Île-de-France",
  root: "src",
  output: "dist",
  pages: [
    {name: "Accueil", path: "/"},
    {
      name: "Explorer",
      pages: MENU.slice(1, 6).map(({name, path}) => ({name, path}))
    },
    {
      name: "Comprendre",
      pages: MENU.slice(6).map(({name, path}) => ({name, path}))
    }
  ],
  head: POLICE + '<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 rx=%2220%22 fill=%22%230268d5%22/><text x=%2250%22 y=%2268%22 font-size=%2252%22 font-family=%22Arial%22 font-weight=%22700%22 text-anchor=%22middle%22 fill=%22white%22>M</text></svg>">',
  toc: false,
  sidebar: true,
  search: true,
  pager: true,
  header: onglets,
  footer: () =>
    `Projet réalisé pour le Hackathon Mobilités 2026, défi 2 « mobilités et emploi ». Ce n'est pas un site officiel d'Île-de-France Mobilités. Données ouvertes : INSEE · Île-de-France Mobilités · Région Île-de-France · France Travail · DARES · Etalab / IGN (Licence Ouverte 2.0 et ODbL).<br>` +
    `Site mis à jour chaque lundi · <a href="https://github.com/tourbiriad26-hub/hakathon_mobilite">code source</a>`,
  style: "style.css"
};
