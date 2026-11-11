// Formats français et petits utilitaires partagés par les pages.
import * as d3 from "npm:d3";

export const fr = d3.formatLocale({decimal: ",", thousands: " ", grouping: [3], currency: ["", " €"]});

export const fmtInt = fr.format(",.0f");
export const fmtPct = (v) => (v == null ? "–" : fr.format(".1f")(v) + " %");
export const fmtEur = (v) => (v == null ? "–" : fr.format(",.0f")(v) + " €");
export const fmtCompact = (v) => {
  if (v == null) return "–";
  if (Math.abs(v) >= 1e9) return fr.format(".2f")(v / 1e9) + " Md";
  if (Math.abs(v) >= 1e6) return fr.format(".1f")(v / 1e6) + " M";
  if (Math.abs(v) >= 1e3) return fr.format(",.0f")(v);
  return fr.format(".0f")(v);
};

// Formate selon l'unité déclarée dans dim_indicateurs.
export function fmtIndicateur(v, unite) {
  if (v == null) return "–";
  if (unite === "%") return fmtPct(v);
  if (unite && unite.startsWith("€")) return fmtEur(v);
  if (unite === "ratio") return fr.format(".1f")(v);
  if (unite === "emplois pour 100 actifs") return fr.format(".0f")(v);
  return fmtCompact(v);
}

// Transforme des lignes de dim_geo (avec geojson) en FeatureCollection.
export function toFeatureCollection(rows) {
  const features = [];
  for (const r of rows) {
    if (!r.geojson) continue;
    features.push({
      type: "Feature",
      properties: {codegeo: r.codegeo, libgeo: r.libgeo, departement: r.departement, epci: r.epci},
      geometry: JSON.parse(r.geojson)
    });
  }
  return {type: "FeatureCollection", features};
}

// Carte (Map) codegeo -> valeur à partir d'un résultat SQL.
export function indexBy(rows, key, value) {
  const m = new Map();
  for (const r of rows) m.set(r[key], value ? r[value] : r);
  return m;
}

// Une couleur par mode, la même sur toutes les pages (barres, légendes, cartes).
export const couleursModes = new Map([
  ["Transports en commun", "#1d4ed8"], ["Voiture", "#ea580c"], ["Vélo", "#16a34a"],
  ["Marche", "#9333ea"], ["Deux-roues motorisé", "#64748b"], ["Sans déplacement", "#cbd5e1"]
]);

// Palette de carte selon le sens de l'indicateur :
// - une part modale prend la teinte de son mode (TC bleu, voiture orange, vélo vert...) ;
// - un indicateur « défavorable » (pauvreté, chômage, recrutements difficiles, inégalités) va vers le rouge ;
// - les autres (effectifs, revenus, emplois, gares) restent en bleus.
const schemeModes = {part_tc: "blues", part_voiture: "oranges", part_velo: "greens", part_marche: "purples", part_2rm: "greys", part_sans_transport: "greys"};
const indicateursDefavorables = new Set(["taux_pauvrete", "taux_chomage", "rapport_interdecile", "part_recrutements_difficiles", "difficiles", "part_difficiles"]);
export function schemeIndicateur(code) {
  if (schemeModes[code]) return schemeModes[code];
  if (indicateursDefavorables.has(code)) return "reds";
  return "blues";
}

export const couleursDep = new Map([
  ["75", "#1d4ed8"], ["92", "#0891b2"], ["93", "#dc2626"], ["94", "#ea580c"],
  ["77", "#65a30d"], ["78", "#7c3aed"], ["91", "#ca8a04"], ["95", "#db2777"]
]);

export const nomsDep = new Map([
  ["75", "Paris"], ["77", "Seine-et-Marne"], ["78", "Yvelines"], ["91", "Essonne"],
  ["92", "Hauts-de-Seine"], ["93", "Seine-Saint-Denis"], ["94", "Val-de-Marne"], ["95", "Val-d'Oise"]
]);
