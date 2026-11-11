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

export const couleursDep = new Map([
  ["75", "#1d4ed8"], ["92", "#0891b2"], ["93", "#dc2626"], ["94", "#ea580c"],
  ["77", "#65a30d"], ["78", "#7c3aed"], ["91", "#ca8a04"], ["95", "#db2777"]
]);

export const nomsDep = new Map([
  ["75", "Paris"], ["77", "Seine-et-Marne"], ["78", "Yvelines"], ["91", "Essonne"],
  ["92", "Hauts-de-Seine"], ["93", "Seine-Saint-Denis"], ["94", "Val-de-Marne"], ["95", "Val-d'Oise"]
]);
