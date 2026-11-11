---
title: Emploi & bassins
---

```js
// Données chargées en entier (voir components/duckdb.js) : évite les erreurs de lecture sur GitHub Pages.
import {tablesCompletes} from "./components/duckdb.js";
const sql = DuckDBClient.sql(tablesCompletes({
  fact_mobilite: FileAttachment("./data/fact_mobilite.parquet"),
  dim_geo: FileAttachment("./data/dim_geo.parquet"),
  fact_bmo: FileAttachment("./data/fact_bmo.parquet")
}));
```

# Où l'emploi se crée-t-il, et peut-on y aller sans voiture ?

Les 25 **bassins d'emploi** de la Région croisés avec les intentions d'embauche 2026 des employeurs
(enquête BMO, France Travail), les demandeurs d'emploi (DARES), le chômage (INSEE) et la façon dont
les actifs rejoignent déjà ces bassins (recensement 2022).

```js
import {fmtInt, fmtPct, fmtCompact, fmtIndicateur, toFeatureCollection, indexBy, couleursDep, nomsDep, schemeIndicateur} from "./components/format.js";
import {bandeauSources} from "./components/sources.js";
```

```js
display(bandeauSources(["France Travail", "DARES", "INSEE", "Région Île-de-France", "Île-de-France Mobilités"]))
```

```sql id=region
SELECT code_indicateur, nombre, periode FROM fact_mobilite WHERE maille = 'Région'
```

```sql id=demandeurs
SELECT SUM(nombre) AS total, MIN(periode) AS periode FROM fact_mobilite WHERE maille = 'Zone d''emploi' AND code_indicateur = 'nb_demandeurs_emploi_a'
```

```js
const R = indexBy(region, "code_indicateur");
const D = demandeurs.get(0);
```

<div class="grid grid-cols-4">
  <div class="card kpi"><h2>Projets de recrutement 2026</h2><div class="big">${fmtCompact(R.get("nb_projets_recrutement")?.nombre)}</div><div class="muted">intentions d'embauche déclarées (BMO)</div></div>
  <div class="card kpi kpi--alerte"><h2>Jugés difficiles</h2><div class="big">${fmtPct(R.get("part_recrutements_difficiles")?.nombre)}</div><div class="muted">des projets de recrutement</div></div>
  <div class="card kpi kpi--voiture"><h2>Demandeurs d'emploi (cat. A)</h2><div class="big">${fmtCompact(D.total)}</div><div class="muted">fin ${D.periode}, zones d'emploi franciliennes</div></div>
  <div class="card kpi kpi--tc"><h2>Offre de transport</h2><div class="big">${fmtInt(R.get("nb_lignes_bus")?.nombre)} bus</div><div class="muted">${fmtInt(R.get("nb_lignes_train")?.nombre)} train/RER · ${fmtInt(R.get("nb_lignes_metro")?.nombre)} métro · ${fmtInt(R.get("nb_lignes_tram")?.nombre)} tram (lignes actives)</div></div>
</div>

## Les bassins d'emploi

```sql id=bassins
SELECT g.codegeo, g.libgeo, g.departement, g.geojson, g.lon, g.lat, g.nb_communes,
       MAX(CASE WHEN code_indicateur = 'nb_projets_recrutement' THEN nombre END) AS projets,
       MAX(CASE WHEN code_indicateur = 'part_recrutements_difficiles' THEN nombre END) AS part_difficiles,
       MAX(CASE WHEN code_indicateur = 'part_recrutements_saisonniers' THEN nombre END) AS part_saisonniers,
       MAX(CASE WHEN code_indicateur = 'nb_actifs_occupes' THEN nombre END) AS actifs,
       MAX(CASE WHEN code_indicateur = 'nb_emplois' THEN nombre END) AS emplois,
       MAX(CASE WHEN code_indicateur = 'indice_concentration_emploi' THEN nombre END) AS concentration,
       MAX(CASE WHEN code_indicateur = 'part_tc' THEN nombre END) AS part_tc,
       MAX(CASE WHEN code_indicateur = 'part_voiture' THEN nombre END) AS part_voiture,
       MAX(CASE WHEN code_indicateur = 'part_menages_sans_voiture' THEN nombre END) AS part_sans_voiture,
       MAX(CASE WHEN code_indicateur = 'nb_gares' THEN nombre END) AS gares,
       MAX(CASE WHEN code_indicateur = 'taux_pauvrete' THEN nombre END) AS taux_pauvrete
FROM dim_geo g
LEFT JOIN fact_mobilite f ON f.maille = g.maille AND f.codegeo = g.codegeo
WHERE g.maille = 'Bassin d''emploi'
GROUP BY g.codegeo, g.libgeo, g.departement, g.geojson, g.lon, g.lat, g.nb_communes
ORDER BY projets DESC NULLS LAST
```

```js
const mesures = new Map([
  ["Projets de recrutement 2026", "projets"],
  ["Part de recrutements difficiles (%)", "part_difficiles"],
  ["Emplois pour 100 actifs résidents", "concentration"],
  ["Part modale TC des résidents (%)", "part_tc"],
  ["Part modale voiture des résidents (%)", "part_voiture"],
  ["Actifs dont le ménage n'a pas de voiture (%)", "part_sans_voiture"],
  ["Pôles ferrés", "gares"]
]);
const mesure = view(Inputs.select(mesures, {label: "Colorer par", value: "part_difficiles"}));
```

```sql id=departements
SELECT codegeo, libgeo, geojson FROM dim_geo WHERE maille = 'Département'
```

```js
const rows = bassins.toArray();
const fc = toFeatureCollection(rows);
const fcDep = toFeatureCollection(departements);
const byCode = indexBy(rows, "codegeo");
const libMesure = [...mesures].find(([, v]) => v === mesure)[0];
const estPct = libMesure.includes("%");
const fmtM = (v) => v == null ? "–" : estPct ? fmtPct(v) : mesure === "concentration" ? v.toFixed(0) : fmtInt(v);
```

<div class="grid grid-cols-2">
<div class="card">

```js
Plot.plot({
  width,
  height: Math.min(560, width * 0.9),
  projection: {type: "mercator", domain: fcDep},
  color: {type: mesure === "projets" ? "log" : "quantize", n: 6, scheme: schemeIndicateur(mesure), legend: true, label: libMesure, tickFormat: mesure === "projets" ? fmtCompact : undefined},
  marks: [
    Plot.geo(fc, {fill: (f) => byCode.get(f.properties.codegeo)?.[mesure] ?? null, stroke: "white", strokeWidth: 1, tip: true,
      title: (f) => { const b = byCode.get(f.properties.codegeo); return `${b.libgeo}\n${libMesure} : ${fmtM(b[mesure])}\n${fmtCompact(b.projets)} projets · ${fmtPct(b.part_difficiles)} difficiles\n${b.concentration?.toFixed(0)} emplois / 100 actifs · TC ${fmtPct(b.part_tc)} · ${b.gares ?? 0} pôles ferrés`; }}),
    Plot.geo(fcDep, {stroke: "#4e5864", strokeWidth: 0.6, fill: "none"}),
    Plot.text(rows, {x: "lon", y: "lat", text: (d) => d.libgeo.replace(/ \(.*\)$/, "").replace(/^(T\d+) .*/, "$1"), fontSize: 9, fill: "#25303b", stroke: "white", strokeWidth: 2.5})
  ]
})
```

</div>
<div class="card">

```js
Plot.plot({
  width,
  height: Math.min(560, width * 0.9),
  grid: true,
  x: {label: "Emplois pour 100 actifs résidents (RP 2022)"},
  y: {label: "Part modale TC des résidents (%)"},
  r: {range: [4, 32], label: "Projets de recrutement"},
  color: {domain: [...nomsDep.values()], range: [...nomsDep.keys()].map((k) => couleursDep.get(k)), legend: true},
  marks: [
    Plot.ruleX([100], {stroke: "#a9b4c2", strokeDasharray: "3 3"}),
    Plot.dot(rows, {x: "concentration", y: "part_tc", r: "projets", fill: (d) => nomsDep.get(d.departement), fillOpacity: 0.65, stroke: "white", tip: true,
      title: (d) => `${d.libgeo}\n${d.concentration?.toFixed(0)} emplois / 100 actifs · TC ${fmtPct(d.part_tc)}\n${fmtCompact(d.projets)} projets (${fmtPct(d.part_difficiles)} difficiles)`}),
    Plot.text(rows, {x: "concentration", y: "part_tc", text: (d) => d.libgeo.replace(/ \(.*\)$/, "").replace(/^(T\d+) .*/, "$1"), dy: -14, fontSize: 9, fill: "#4e5864"})
  ]
})
```

<div class="note">À droite de la ligne pointillée, le bassin accueille plus d'emplois qu'il n'a d'actifs : il dépend des navetteurs. En bas, ses résidents y vont peu en transports en commun. Les bassins « en bas à droite » (Roissy, Versailles-Saclay, Marne-la-Vallée) sont ceux où l'accès à l'emploi sans voiture est le plus contraint.</div>

</div>
</div>

<div class="card">

```js
Inputs.table(rows.map((d) => ({Bassin: d.libgeo, Dép: d.departement, "Projets 2026": d.projets, "Difficiles %": d.part_difficiles, "Emplois / 100 actifs": d.concentration, "TC %": d.part_tc, "Voiture %": d.part_voiture, "Sans voiture %": d.part_sans_voiture, "Pôles ferrés": d.gares ?? 0, "Pauvreté %": d.taux_pauvrete})), {
  format: {"Projets 2026": fmtInt, "Difficiles %": fmtPct, "Emplois / 100 actifs": (v) => v?.toFixed(0), "TC %": fmtPct, "Voiture %": fmtPct, "Sans voiture %": fmtPct, "Pauvreté %": fmtPct},
  select: false, rows: 26
})
```

</div>

## Quels métiers recrutent, et où est-ce difficile ?

```js
const bassinOptions = new Map(rows.map((d) => [d.libgeo, d.codegeo]));
const bassinChoisi = view(Inputs.select(bassinOptions, {label: "Bassin d'emploi", value: rows[0]?.codegeo, width: 380}));
```

```sql id=metiers
SELECT metier, famille, SUM(nb_projets) AS projets, SUM(nb_projets_difficiles) AS difficiles,
       100.0 * SUM(nb_projets_difficiles) / NULLIF(SUM(nb_projets), 0) AS part_difficiles
FROM fact_bmo WHERE code_be = ${bassinChoisi}
GROUP BY metier, famille
ORDER BY projets DESC
LIMIT 20
```

```sql id=familles
SELECT famille, SUM(nb_projets) AS projets, SUM(nb_projets_difficiles) AS difficiles
FROM fact_bmo WHERE code_be = ${bassinChoisi}
GROUP BY famille ORDER BY projets DESC
```

<div class="grid grid-cols-2">
<div class="card">

```js
Plot.plot({
  width,
  height: 520,
  marginLeft: 260,
  x: {label: "Projets de recrutement 2026", tickFormat: fmtCompact},
  y: {label: null},
  color: {legend: true, domain: ["Difficiles", "Autres"], range: ["#c52625", "#c9ddf5"]},
  marks: [
    Plot.barX(metiers.toArray().flatMap((d) => [{metier: d.metier, type: "Difficiles", n: d.difficiles ?? 0, p: d.part_difficiles}, {metier: d.metier, type: "Autres", n: (d.projets ?? 0) - (d.difficiles ?? 0), p: d.part_difficiles}]),
      {x: "n", y: "metier", fill: "type", sort: {y: "-x"}, tip: true, title: (d) => `${d.metier}\n${d.type} : ${fmtInt(d.n)} (${fmtPct(d.p)} jugés difficiles)`}),
    Plot.ruleX([0])
  ]
})
```

</div>
<div class="card">

```js
Plot.plot({
  width,
  height: 520,
  marginLeft: 200,
  x: {label: "Projets de recrutement 2026", tickFormat: fmtCompact},
  y: {label: null},
  marks: [
    Plot.barX(familles, {x: "projets", y: "famille", sort: {y: "-x"}, fill: "#0268d5", tip: true, title: (d) => `${d.famille}\n${fmtInt(d.projets)} projets · ${fmtPct(100 * d.difficiles / d.projets)} difficiles`}),
    Plot.text(familles, {x: "projets", y: "famille", text: (d) => fmtPct(100 * d.difficiles / d.projets), dx: 4, textAnchor: "start", fontSize: 10, fill: "#4e5864"}),
    Plot.ruleX([0])
  ]
})
```

<div class="note">Familles de métiers (nomenclature BMO) ; le chiffre à droite est la part de projets jugés difficiles. Les métiers de service à la personne, de la santé et de la construction sont régulièrement les plus difficiles : ce sont aussi ceux aux horaires les plus décalés, pour lesquels l'offre de transport tôt le matin ou tard le soir est déterminante.</div>

</div>
</div>

## Demandeurs d'emploi et chômage

```sql id=ze
SELECT g.libgeo,
       MAX(CASE WHEN code_indicateur = 'nb_demandeurs_emploi_a' THEN nombre END) AS demandeurs_a,
       MAX(CASE WHEN code_indicateur = 'nb_demandeurs_emploi_abc' THEN nombre END) AS demandeurs_abc,
       MAX(CASE WHEN code_indicateur = 'taux_chomage' THEN nombre END) AS taux_chomage,
       MAX(CASE WHEN code_indicateur = 'nb_actifs_occupes' THEN nombre END) AS actifs,
       MAX(CASE WHEN code_indicateur = 'part_tc' THEN nombre END) AS part_tc,
       MAX(CASE WHEN code_indicateur = 'part_menages_sans_voiture' THEN nombre END) AS part_sans_voiture,
       MAX(CASE WHEN code_indicateur = 'nb_demandeurs_emploi_a' THEN periode END) AS periode
FROM fact_mobilite f JOIN dim_geo g ON g.maille = f.maille AND g.codegeo = f.codegeo
WHERE f.maille = 'Zone d''emploi'
GROUP BY g.libgeo ORDER BY demandeurs_a DESC
```

```sql id=dep
SELECT g.libgeo, f.nombre AS taux_chomage, f.periode,
       (SELECT nombre FROM fact_mobilite x WHERE x.maille = f.maille AND x.codegeo = f.codegeo AND x.code_indicateur = 'part_recrutements_difficiles') AS part_difficiles,
       (SELECT nombre FROM fact_mobilite x WHERE x.maille = f.maille AND x.codegeo = f.codegeo AND x.code_indicateur = 'nb_projets_recrutement') AS projets
FROM fact_mobilite f JOIN dim_geo g ON g.maille = f.maille AND g.codegeo = f.codegeo
WHERE f.maille = 'Département' AND f.code_indicateur = 'taux_chomage'
ORDER BY f.nombre DESC
```

<div class="grid grid-cols-2">
<div class="card">

```js
Plot.plot({
  width,
  height: 400,
  marginLeft: 170,
  x: {label: `Demandeurs d'emploi (cat. A, fin ${ze.get(0)?.periode ?? ""})`, tickFormat: fmtCompact},
  y: {label: null},
  marks: [
    Plot.barX(ze, {x: "demandeurs_a", y: "libgeo", sort: {y: "-x"}, fill: "#0268d5", tip: true,
      title: (d) => `${d.libgeo}\n${fmtInt(d.demandeurs_a)} en catégorie A · ${fmtInt(d.demandeurs_abc)} en A, B, C\nchômage ${fmtPct(d.taux_chomage)} · ${fmtPct(d.part_sans_voiture)} des actifs sans voiture`}),
    Plot.ruleX([0])
  ]
})
```

</div>
<div class="card">

```js
Plot.plot({
  width,
  height: 400,
  marginLeft: 150,
  x: {label: `Taux de chômage (%, ${dep.get(0)?.periode ?? ""})`},
  y: {label: null},
  color: {type: "linear", scheme: "blues", domain: [0, d3.max(dep, (d) => d.taux_chomage)]},
  marks: [
    Plot.barX(dep, {x: "taux_chomage", y: "libgeo", sort: {y: "-x"}, fill: "taux_chomage", tip: true,
      title: (d) => `${d.libgeo}\nchômage ${fmtPct(d.taux_chomage)}\n${fmtCompact(d.projets)} projets de recrutement 2026, ${fmtPct(d.part_difficiles)} difficiles`}),
    Plot.text(dep, {x: "taux_chomage", y: "libgeo", text: (d) => fmtPct(d.taux_chomage), dx: 4, textAnchor: "start", fontSize: 11}),
    Plot.ruleX([0])
  ]
})
```

<div class="note">Seine-Saint-Denis : le chômage le plus élevé de la région, et pourtant les bassins voisins (Roissy – Le Bourget, Plaine Commune) comptent parmi ceux qui recrutent le plus et peinent le plus à recruter. Le lien entre ces deux cartes passe par les transports : c'est l'objet de la page Flux.</div>

</div>
</div>
