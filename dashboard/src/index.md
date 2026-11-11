---
title: Vue d'ensemble
sql:
  fact_mobilite: ./data/fact_mobilite.parquet
  dim_geo: ./data/dim_geo.parquet
  dim_indicateurs: ./data/dim_indicateurs.parquet
---

# Comment les Franciliens vont-ils travailler ?

Recensement 2022 (INSEE, fichier détail MOBPRO), 5,7 millions d'actifs occupés, 1 266 communes.
Chaque indicateur est recalculé à chaque échelle à partir des individus : rien n'est sommé à tort.

```js
import {fmtInt, fmtPct, fmtEur, fmtCompact, fmtIndicateur, toFeatureCollection, indexBy, nomsDep, couleursModes, schemeIndicateur} from "./components/format.js";
import {bandeauSources} from "./components/sources.js";
```

```js
display(bandeauSources(["INSEE", "Île-de-France Mobilités", "Etalab", "IGN"]))
```

```sql id=region
SELECT code_indicateur, nombre FROM fact_mobilite WHERE maille = 'Région'
```

```js
const R = indexBy(region, "code_indicateur", "nombre");
```

<div class="grid grid-cols-4">
  <div class="card kpi"><h2>Actifs occupés</h2><div class="big">${fmtCompact(R.get("nb_actifs_occupes"))}</div><div class="muted">résidant en Île-de-France</div></div>
  <div class="card kpi kpi--tc"><h2>Transports en commun</h2><div class="big">${fmtPct(R.get("part_tc"))}</div><div class="muted">des trajets domicile-travail</div></div>
  <div class="card kpi kpi--voiture"><h2>Voiture</h2><div class="big">${fmtPct(R.get("part_voiture"))}</div><div class="muted">camion ou fourgonnette</div></div>
  <div class="card kpi kpi--velo"><h2>Vélo</h2><div class="big">${fmtPct(R.get("part_velo"))}</div><div class="muted">y compris électrique</div></div>
</div>

<div class="grid grid-cols-4">
  <div class="card kpi kpi--marche"><h2>Travaillent hors de leur commune</h2><div class="big">${fmtPct(R.get("part_hors_commune"))}</div><div class="muted">${fmtPct(R.get("part_hors_departement"))} hors de leur département</div></div>
  <div class="card kpi kpi--neutre"><h2>Ménages sans voiture</h2><div class="big">${fmtPct(R.get("part_menages_sans_voiture"))}</div><div class="muted">parmi les actifs occupés</div></div>
  <div class="card kpi kpi--velo"><h2>Niveau de vie médian</h2><div class="big">${fmtEur(R.get("mediane_niveau_vie"))}</div><div class="muted">par an et par unité de consommation (2021)</div></div>
  <div class="card kpi kpi--tc"><h2>Pôles ferrés</h2><div class="big">${fmtInt(R.get("nb_gares"))}</div><div class="muted">${fmtCompact(R.get("nb_validations_12m"))} validations sur 12 mois</div></div>
</div>

## En un coup d'œil : comment vont-ils au travail ?

```js
const modesRegion = [
  {mode: "🚇 Transports en commun", v: R.get("part_tc")},
  {mode: "🚗 Voiture", v: R.get("part_voiture")},
  {mode: "🚶 Marche", v: R.get("part_marche")},
  {mode: "🚲 Vélo", v: R.get("part_velo")},
  {mode: "🛵 Deux-roues", v: R.get("part_2rm")}
].filter((d) => d.v != null);
```

<div class="card">

```js
Plot.plot({
  width,
  height: 110,
  marginLeft: 0,
  x: {axis: null, domain: [0, 100]},
  y: {axis: null},
  color: {domain: modesRegion.map((d) => d.mode), range: ["#1d4ed8", "#ea580c", "#9333ea", "#16a34a", "#64748b"], legend: true},
  marks: [
    Plot.barX(modesRegion, Plot.stackX({x: "v", fill: "mode", inset: 1, tip: true, title: (d) => `${d.mode} : ${fmtPct(d.v)}`})),
    Plot.textX(modesRegion, Plot.stackX({x: "v", z: "mode", text: (d) => d.v >= 6 ? `${Math.round(d.v)} %` : "", fill: "white", fontSize: 18, fontWeight: "bold"}))
  ]
})
```

<div class="note">Sur 100 Franciliens qui se déplacent pour travailler, voici leur moyen de transport principal.</div>

</div>

## Carte : un indicateur, une échelle

```sql id=indicateurs
SELECT code_indicateur, nom_indicateur, unite, type_mesure, description, famille_indicateur
FROM dim_indicateurs
WHERE code_indicateur NOT IN ('taux_chomage')
ORDER BY ordre
```

```js
const indicOptions = new Map(indicateurs.toArray().map((d) => [d.nom_indicateur, d.code_indicateur]));
const indicateur = view(Inputs.select(indicOptions, {label: "Indicateur", value: "part_tc"}));
const maille = view(Inputs.radio(["Commune", "Bassin d'emploi", "Département"], {label: "Échelle", value: "Commune"}));
const masquerNonFiable = view(Inputs.toggle({label: "Masquer les valeurs peu fiables (< 200 actifs)", value: true}));
```

```js
const indicInfo = indicateurs.toArray().find((d) => d.code_indicateur === indicateur);
```

```sql id=valeurs
SELECT f.codegeo, f.nombre, f.fiable, f.effectif_base, g.libgeo, g.departement
FROM fact_mobilite f
JOIN dim_geo g ON g.maille = f.maille AND g.codegeo = f.codegeo
WHERE f.maille = ${maille} AND f.code_indicateur = ${indicateur}
```

```sql id=geo
SELECT codegeo, libgeo, departement, epci, geojson FROM dim_geo WHERE maille = ${maille}
```

```sql id=departements
SELECT codegeo, libgeo, geojson FROM dim_geo WHERE maille = 'Département'
```

```js
const fc = toFeatureCollection(geo);
const fcDep = toFeatureCollection(departements);
const vals = indexBy(valeurs, "codegeo");
const valeur = (f) => {
  const v = vals.get(f.properties.codegeo);
  if (!v) return null;
  if (masquerNonFiable && !v.fiable) return null;
  return v.nombre;
};
const estMontant = indicInfo?.type_mesure === "effectif" || indicInfo?.type_mesure === "montant";
```

<div class="card">

```js
Plot.plot({
  width,
  height: Math.min(640, width * 0.8),
  projection: {type: "mercator", domain: fcDep},
  color: {
    type: estMontant && indicInfo?.type_mesure === "effectif" ? "log" : "quantile",
    n: 5,
    scheme: schemeIndicateur(indicInfo?.code_indicateur),
    legend: true,
    label: `${indicInfo?.nom_indicateur ?? ""} (${indicInfo?.unite ?? ""})`,
    tickFormat: estMontant ? fmtCompact : undefined
  },
  marks: [
    Plot.geo(fc, {
      fill: valeur,
      stroke: maille === "Commune" ? "white" : "none",
      strokeWidth: 0.3,
      tip: true,
      title: (f) => {
        const v = vals.get(f.properties.codegeo);
        return `${f.properties.libgeo}\n${indicInfo?.nom_indicateur}: ${fmtIndicateur(v?.nombre, indicInfo?.unite)}` +
          (v && v.effectif_base != null ? `\nbase: ${fmtInt(v.effectif_base)} actifs${v.fiable ? "" : " (peu fiable)"}` : "");
      }
    }),
    Plot.geo(fcDep, {stroke: "#333", strokeWidth: 0.8, fill: "none"})
  ]
})
```

<div class="note">${indicInfo?.description ?? ""} — Source : ${indicInfo?.famille_indicateur ?? ""}. Gris : donnée absente, secret statistique ou effectif trop faible.</div>

</div>

## Parts modales par département

```sql id=parts
SELECT g.libgeo AS departement, f.code_indicateur, f.nombre
FROM fact_mobilite f
JOIN dim_geo g ON g.maille = f.maille AND g.codegeo = f.codegeo
WHERE f.maille = 'Département'
  AND f.code_indicateur IN ('part_tc', 'part_voiture', 'part_velo', 'part_marche', 'part_2rm')
ORDER BY g.codegeo
```

```js
const libMode = new Map([["part_tc", "Transports en commun"], ["part_voiture", "Voiture"], ["part_velo", "Vélo"], ["part_marche", "Marche"], ["part_2rm", "Deux-roues motorisé"]]);
// Départements classés de la plus forte à la plus faible part de transports en commun :
// on lit d'un coup d'œil le passage de Paris à la petite puis à la grande couronne.
const ordreDep = parts.toArray().filter((d) => d.code_indicateur === "part_tc").sort((a, b) => b.nombre - a.nombre).map((d) => d.departement);
```

<div class="grid grid-cols-2">
<div class="card">

```js
Plot.plot({
  width,
  height: 360,
  marginLeft: 120,
  x: {label: "Part des actifs se déplaçant (%)", domain: [0, 100]},
  y: {label: null, domain: ordreDep},
  color: {
    domain: [...libMode.values()],
    range: [...libMode.values()].map((m) => couleursModes.get(m)),
    legend: true
  },
  marks: [
    Plot.barX(parts, {
      x: "nombre",
      y: "departement",
      fill: (d) => libMode.get(d.code_indicateur),
      order: (d) => [...libMode.keys()].indexOf(d.code_indicateur),
      tip: true,
      title: (d) => `${d.departement}\n${libMode.get(d.code_indicateur)} : ${fmtPct(d.nombre)}`
    }),
    // pourcentage écrit dans chaque segment assez large : plus besoin de lire l'axe
    Plot.textX(parts, Plot.stackX({
      x: "nombre",
      y: "departement",
      z: (d) => libMode.get(d.code_indicateur),
      order: (d) => [...libMode.keys()].indexOf(d.code_indicateur),
      text: (d) => d.nombre >= 8 ? `${Math.round(d.nombre)} %` : "",
      fill: "white",
      fontWeight: "bold"
    })),
    Plot.ruleX([0])
  ]
})
```

</div>
<div class="card">

```sql id=tableDep
SELECT g.libgeo AS "Département",
       MAX(CASE WHEN code_indicateur = 'nb_actifs_occupes' THEN nombre END) AS "Actifs",
       MAX(CASE WHEN code_indicateur = 'part_tc' THEN nombre END) AS "TC %",
       MAX(CASE WHEN code_indicateur = 'part_voiture' THEN nombre END) AS "Voiture %",
       MAX(CASE WHEN code_indicateur = 'part_hors_departement' THEN nombre END) AS "Hors dép. %",
       MAX(CASE WHEN code_indicateur = 'indice_concentration_emploi' THEN nombre END) AS "Emplois / 100 actifs",
       MAX(CASE WHEN code_indicateur = 'part_menages_sans_voiture' THEN nombre END) AS "Sans voiture %"
FROM fact_mobilite f
JOIN dim_geo g ON g.maille = f.maille AND g.codegeo = f.codegeo
WHERE f.maille = 'Département'
GROUP BY g.libgeo, g.codegeo
ORDER BY g.codegeo
```

```js
Inputs.table(tableDep, {
  format: {
    "Actifs": fmtInt,
    "TC %": (v) => fmtPct(v),
    "Voiture %": (v) => fmtPct(v),
    "Hors dép. %": (v) => fmtPct(v),
    "Emplois / 100 actifs": (v) => v?.toFixed(0),
    "Sans voiture %": (v) => fmtPct(v)
  },
  select: false
})
```

<div class="note">Un indice de concentration d'emploi supérieur à 100 signifie que le territoire accueille plus d'emplois que d'actifs résidents : il attire des navetteurs. Paris en accueille 178 pour 100 actifs résidents.</div>

</div>
</div>
