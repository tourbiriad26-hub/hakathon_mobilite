// Configuration Observable Framework — https://observablehq.com/framework/config
export default {
  title: "Mobilité Île-de-France",
  root: "src",
  output: "dist",
  pages: [
    {name: "Vue d'ensemble", path: "/"},
    {name: "Emploi & bassins", path: "/emploi"},
    {name: "Flux domicile-travail", path: "/flux"},
    {name: "Inégalités & mobilité", path: "/inegalites"},
    {name: "Offre ferrée", path: "/transport"},
    {name: "Sources & méthode", path: "/sources"}
  ],
  head: '<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🚇</text></svg>">',
  toc: false,
  sidebar: true,
  search: false,
  footer: ({path}) =>
    `Données ouvertes INSEE, Île-de-France Mobilités, Etalab · pipeline dbt + DuckDB · <a href="https://github.com/tourbiriad26-hub/hakathon_mobilite">code source</a>`,
  style: "style.css"
};
