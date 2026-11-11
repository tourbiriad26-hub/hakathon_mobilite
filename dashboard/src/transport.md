---
title: Offre ferrée
sql:
  dim_gares: ./data/dim_gares.parquet
  dim_geo: ./data/dim_geo.parquet
  fact_mobilite: ./data/fact_mobilite.parquet
  fact_validations: ./data/fact_validations.parquet
  fact_validations_jour: ./data/fact_validations_jour.parquet
---

# Le réseau ferré : où sont les gares, qui les utilise ?

Pôles ferrés (métro, RER, Transilien, tramway) d'Île-de-France Mobilités et validations de titres
sur les quatre derniers trimestres publiés, croisés avec les parts modales des communes desservies.

```js
import {fmtInt, fmtPct, fmtCompact, toFeatureCollection, indexBy, couleursDep, nomsDep} from "./components/format.js";
import {bandeauSources} from "./components/sources.js";
```

```js
display(bandeauSources(["Île-de-France Mobilités", "INSEE", "Etalab", "IGN"]))
```

```sql id=kpi
SELECT COUNT(*) AS nb_poles,
       SUM(nb_validations_12m) AS validations,
       COUNT(DISTINCT codegeo_commune) AS communes_desservies,
       MIN(premier_trimestre) AS debut, MAX(dernier_trimestre) AS fin
FROM dim_gares WHERE codegeo_commune IS NOT NULL
```

```sql id=sansGare
SELECT COUNT(*) AS communes,
       SUM(CASE WHEN g.codegeo IS NULL THEN 1 ELSE 0 END) AS sans_gare,
       SUM(CASE WHEN g.codegeo IS NULL THEN a.nombre ELSE 0 END) AS actifs_sans_gare,
       SUM(a.nombre) AS actifs
FROM dim_geo d
LEFT JOIN (SELECT DISTINCT codegeo_commune AS codegeo FROM dim_gares) g ON g.codegeo = d.codegeo
LEFT JOIN fact_mobilite a ON a.maille = 'Commune' AND a.codegeo = d.codegeo AND a.code_indicateur = 'nb_actifs_occupes'
WHERE d.maille = 'Commune'
```

```js
const K = kpi.get(0); const S = sansGare.get(0);
```

<div class="grid grid-cols-4">
  <div class="card kpi kpi--tc"><h2>Pôles ferrés</h2><div class="big">${fmtInt(K.nb_poles)}</div><div class="muted">zones de correspondance en Île-de-France</div></div>
  <div class="card kpi kpi--tc"><h2>Validations</h2><div class="big">${fmtCompact(K.validations)}</div><div class="muted">${K.debut} → ${K.fin}</div></div>
  <div class="card kpi kpi--alerte"><h2>Communes sans gare</h2><div class="big">${fmtInt(S.sans_gare)} / ${fmtInt(S.communes)}</div><div class="muted">${fmtPct(100 * S.actifs_sans_gare / S.actifs)} des actifs y résident</div></div>
  <div class="card kpi kpi--velo"><h2>Communes desservies</h2><div class="big">${fmtInt(K.communes_desservies)}</div><div class="muted">au moins un pôle ferré</div></div>
</div>

```sql id=gares
SELECT id_zdc, nom_pole, commune, departement, lon, lat, modes, nb_lignes, nb_validations_12m, a_metro, a_rer, a_train, a_tram
FROM dim_gares WHERE lon IS NOT NULL
ORDER BY nb_validations_12m DESC NULLS LAST
```

```sql id=communes
SELECT g.codegeo, g.libgeo, g.departement, g.epci, g.geojson, f.nombre AS part_tc
FROM dim_geo g
LEFT JOIN fact_mobilite f ON f.maille = 'Commune' AND f.codegeo = g.codegeo AND f.code_indicateur = 'part_tc' AND f.fiable
WHERE g.maille = 'Commune'
```

```sql id=departements
SELECT codegeo, libgeo, geojson FROM dim_geo WHERE maille = 'Département'
```

```js
const modesChoisis = view(Inputs.checkbox(["METRO", "RER", "TRAIN", "TRAMWAY"], {label: "Modes", value: ["METRO", "RER", "TRAIN", "TRAMWAY"]}));
```

```js
const fc = toFeatureCollection(communes);
const fcDep = toFeatureCollection(departements);
const partTc = indexBy(communes, "codegeo", "part_tc");
const garesRows = gares.toArray().filter((d) => modesChoisis.some((m) => (d.modes ?? "").includes(m)));
```

<div class="card">

```js
Plot.plot({
  width,
  height: Math.min(680, width * 0.8),
  projection: {type: "mercator", domain: fcDep},
  color: {type: "quantile", n: 6, scheme: "blues", legend: true, label: "Part modale TC des résidents (%)"},
  r: {range: [1, 18], label: "Validations 12 mois"},
  marks: [
    Plot.geo(fc, {fill: (f) => partTc.get(f.properties.codegeo) ?? null, stroke: "white", strokeWidth: 0.2}),
    Plot.geo(fcDep, {stroke: "#333", strokeWidth: 0.8, fill: "none"}),
    Plot.dot(garesRows, {x: "lon", y: "lat", r: (d) => d.nb_validations_12m ?? 0, fill: "#b91c1c", fillOpacity: 0.45, stroke: "#7f1d1d", strokeWidth: 0.4, tip: true,
      title: (d) => `${d.nom_pole} (${d.commune ?? "hors IDF"})\n${d.modes} · ${d.nb_lignes} ligne(s)\n${d.nb_validations_12m ? fmtInt(d.nb_validations_12m) + " validations / 12 mois" : "validations non publiées"}`}),
    Plot.dot(garesRows.filter((d) => !d.nb_validations_12m), {x: "lon", y: "lat", r: 1.2, fill: "#7f1d1d"})
  ]
})
```

<div class="note">Fond : part des actifs résidents allant travailler en transports en commun (bleu foncé = forte, même couleur que les transports en commun sur les autres pages). Cercles : pôles ferrés, surface proportionnelle aux validations. Les validations ne sont pas publiées pour tous les pôles (petits points) : les données IDFM couvrent le réseau ferré hors certains tramways et hors bus.</div>

</div>

<div class="grid grid-cols-2">
<div class="card">

## Les 20 pôles les plus fréquentés

```js
Plot.plot({
  width,
  height: 460,
  marginLeft: 150,
  x: {label: "Validations sur 12 mois", tickFormat: fmtCompact},
  y: {label: null},
  color: {domain: [...nomsDep.values()], range: [...nomsDep.keys()].map((k) => couleursDep.get(k)), legend: true},
  marks: [
    Plot.barX(gares.toArray().slice(0, 20), {x: "nb_validations_12m", y: "nom_pole", sort: {y: "x", reverse: true}, fill: (d) => nomsDep.get(d.departement), tip: true,
      title: (d) => `${d.nom_pole} (${d.commune})\n${d.modes}\n${fmtInt(d.nb_validations_12m)} validations`}),
    Plot.ruleX([0])
  ]
})
```

</div>
<div class="card">

## Validations par jour sur le réseau ferré

```sql id=jours
SELECT jour, nb_validations FROM fact_validations_jour ORDER BY jour
```

```js
Plot.plot({
  width,
  height: 460,
  x: {label: null},
  y: {label: "Validations / jour", tickFormat: fmtCompact, grid: true},
  marks: [
    Plot.areaY(jours, {x: "jour", y: "nb_validations", fill: "#1d4ed8", fillOpacity: 0.12}),
    Plot.lineY(jours, {x: "jour", y: "nb_validations", stroke: "#1d4ed8", strokeWidth: 1.2, tip: true,
      title: (d) => `${d3.timeFormat("%a %d %b %Y")(d.jour)}\n${fmtInt(d.nb_validations)} validations`}),
    Plot.ruleY([0])
  ]
})
```

<div class="note">On lit la semaine (creux du week-end), les vacances scolaires et les jours fériés. Les grèves ou incidents majeurs apparaissent comme des creux isolés.</div>

</div>
</div>

## Desserte et usage par département

```sql id=parDep
SELECT g.libgeo AS "Département",
       MAX(CASE WHEN f.code_indicateur = 'nb_gares' THEN f.nombre END) AS "Pôles ferrés",
       MAX(CASE WHEN f.code_indicateur = 'nb_validations_12m' THEN f.nombre END) AS "Validations 12 mois",
       MAX(CASE WHEN f.code_indicateur = 'nb_actifs_occupes' THEN f.nombre END) AS "Actifs",
       MAX(CASE WHEN f.code_indicateur = 'nb_validations_12m' THEN f.nombre END) / MAX(CASE WHEN f.code_indicateur = 'nb_actifs_occupes' THEN f.nombre END) AS "Validations / actif",
       MAX(CASE WHEN f.code_indicateur = 'part_tc' THEN f.nombre END) AS "TC %",
       MAX(CASE WHEN f.code_indicateur = 'part_voiture' THEN f.nombre END) AS "Voiture %"
FROM fact_mobilite f
JOIN dim_geo g ON g.maille = f.maille AND g.codegeo = f.codegeo
WHERE f.maille = 'Département'
GROUP BY g.libgeo, g.codegeo
ORDER BY g.codegeo
```

<div class="card">

```js
Inputs.table(parDep, {
  format: {"Pôles ferrés": fmtInt, "Validations 12 mois": fmtCompact, "Actifs": fmtCompact, "Validations / actif": (v) => v?.toFixed(0), "TC %": fmtPct, "Voiture %": fmtPct},
  select: false
})
```

<div class="note">« Validations / actif » rapporte les validations enregistrées dans les gares du département au nombre d'actifs qui y résident : un ratio élevé traduit un territoire qui attire des voyageurs venus d'ailleurs (Paris) plutôt qu'un usage plus intense des résidents.</div>

</div>
