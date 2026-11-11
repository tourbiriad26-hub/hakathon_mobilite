---
title: Gares et stations
---

```js
// Données chargées en entier (voir components/duckdb.js) : évite les erreurs de lecture sur GitHub Pages.
import {tablesCompletes} from "./components/duckdb.js";
const sql = DuckDBClient.sql(tablesCompletes({
  dim_gares: FileAttachment("./data/dim_gares.parquet"),
  dim_geo: FileAttachment("./data/dim_geo.parquet"),
  fact_mobilite: FileAttachment("./data/fact_mobilite.parquet"),
  fact_validations_jour: FileAttachment("./data/fact_validations_jour.parquet")
}));
```

```js
import {fmtInt, fmtPct, fmtCompact, toFeatureCollection, nomsDep} from "./components/format.js";
import {IDFM, carte, barresClassees} from "./components/graphiques.js";
import {recherche} from "./components/filtres.js";
import {lexique} from "./components/lexique.js";
import {piedSources} from "./components/sources.js";
```

# Où sont les gares, et lesquelles sont les plus fréquentées ?

Toutes les gares et stations de métro, RER, train et tramway d'Île-de-France, avec leur fréquentation sur 12 mois.
**Cherchez une gare par son nom** ou cliquez sur une barre du classement pour la repérer sur la carte.

```js
// Gare mise en avant sur la carte et dans la fiche (null = aucune).
const gareChoisie = Mutable(null);
const choisirGare = (id) => { gareChoisie.value = id; };
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

```sql id=gares
SELECT CAST(id_zdc AS VARCHAR) AS id, nom_pole, commune, codegeo_commune, departement, lon, lat, modes, nb_lignes, nb_validations_12m
FROM dim_gares WHERE lon IS NOT NULL
ORDER BY nb_validations_12m DESC NULLS LAST
```

```sql id=communes
SELECT codegeo, libgeo, departement, epci, geojson FROM dim_geo WHERE maille = 'Commune'
```

```sql id=departements
SELECT codegeo, libgeo, geojson FROM dim_geo WHERE maille = 'Département'
```

```js
const K = kpi.get(0);
const S = sansGare.get(0);
const fc = toFeatureCollection(communes);
const fcDep = toFeatureCollection(departements);
const toutesGares = gares.toArray();
const optionsGares = new Map(toutesGares.map((d) => [`${d.nom_pole} (${d.commune ?? "hors Île-de-France"})`, d.id]));
const zoomOptions = new Map([["Toute l'Île-de-France", ""], ...[...nomsDep].map(([code, nom]) => [nom, code])]);
const nomsModes = new Map([["Métro", "METRO"], ["RER", "RER"], ["Train", "TRAIN"], ["Tramway", "TRAMWAY"]]);
```

<div class="grid grid-cols-4">
  <div class="card kpi kpi--tc"><h2>Gares et stations</h2><div class="big">${fmtInt(K.nb_poles)}</div><div class="muted">en Île-de-France</div></div>
  <div class="card kpi"><h2>Validations en 12 mois</h2><div class="big">${fmtCompact(K.validations)}</div><div class="muted">passages de carte ou de ticket</div></div>
  <div class="card kpi kpi--alerte"><h2>Communes sans gare</h2><div class="big">${fmtInt(S.sans_gare)} sur ${fmtInt(S.communes)}</div><div class="muted">${fmtPct(100 * S.actifs_sans_gare / S.actifs)} des habitants ayant un emploi y vivent</div></div>
  <div class="card kpi"><h2>Communes avec une gare</h2><div class="big">${fmtInt(K.communes_desservies)}</div><div class="muted">au moins une gare ou station</div></div>
</div>

## La carte des gares

<div class="filtres">

```js
const modesChoisis = view(Inputs.checkbox(nomsModes, {label: "Type de transport", value: [...nomsModes.values()]}));
```

```js
const zoomCode = view(Inputs.select(zoomOptions, {label: "Zoom sur", value: ""}));
```

```js
display(recherche(optionsGares, {
  label: "Rechercher une gare",
  placeholder: "Tapez un nom, par exemple Châtelet",
  surChoix: choisirGare
}));
```

</div>

```js
const garesVisibles = toutesGares.filter((d) => modesChoisis.some((m) => (d.modes ?? "").includes(m)) && (!zoomCode || d.departement === zoomCode));
const codesDesservis = new Set(garesVisibles.map((d) => d.codegeo_commune).filter(Boolean));
const fcDesservies = {type: "FeatureCollection", features: fc.features.filter((f) => codesDesservis.has(f.properties.codegeo))};
const G = toutesGares.find((d) => d.id === gareChoisie);
const rang = G ? toutesGares.indexOf(G) + 1 : null;
```

<div class="grid grid-cols-3">
<div class="card grid-colspan-2">

```js
resize((width) => carte({
  fc, fcDep, width,
  zoom: zoomCode ? fcDep.features.find((f) => f.properties.codegeo === zoomCode) : null,
  echelles: {r: {range: [1.5, 18]}},
  marques: [
    Plot.geo(fcDesservies, {fill: IDFM.bleuPale, stroke: "white", strokeWidth: 0.3}),
    Plot.geo(fcDep, {stroke: IDFM.gris, strokeWidth: 0.8, fill: "none"}),
    Plot.dot(garesVisibles, {
      x: "lon", y: "lat", r: (d) => d.nb_validations_12m ?? 0,
      fill: IDFM.bleu, fillOpacity: 0.55, stroke: "white", strokeWidth: 0.5, tip: true,
      title: (d) => `${d.nom_pole}\n${d.commune ?? "hors Île-de-France"}\n${d.nb_validations_12m ? fmtInt(d.nb_validations_12m) + " validations en 12 mois" : "fréquentation non publiée"}`
    }),
    ...(G ? [
      Plot.dot([G], {x: "lon", y: "lat", r: 9, fill: "none", stroke: IDFM.rouge, strokeWidth: 3}),
      Plot.text([G], {x: "lon", y: "lat", text: "nom_pole", dy: -16, fill: IDFM.encre, stroke: "white", strokeWidth: 4, fontWeight: 700, fontSize: 13})
    ] : [])
  ]
}))
```

<div class="note"><b>Comment lire cette carte.</b> Chaque rond bleu est une gare ou une station : plus le rond est grand, plus elle est fréquentée. Les communes en bleu clair ont au moins une gare, celles en gris n'en ont pas. La gare recherchée est entourée en rouge. Passez la souris sur un rond pour lire son nom.</div>

</div>
<div class="card fiche">

<div class="fiche-titre">Fiche de la gare</div>

## ${G ? G.nom_pole : "Aucune gare choisie"}

```js
display(G
  ? html`<div>
      <div class="fiche-ligne"><span>Commune</span><b>${G.commune ?? "hors Île-de-France"}</b></div>
      <div class="fiche-ligne"><span>Type de transport</span><b>${String(G.modes ?? "–").toLowerCase()}</b></div>
      <div class="fiche-ligne"><span>Nombre de lignes</span><b>${G.nb_lignes ?? "–"}</b></div>
      <div class="fiche-ligne"><span>Validations en 12 mois</span><b>${G.nb_validations_12m ? fmtInt(G.nb_validations_12m) : "non publié"}</b></div>
      <div class="fiche-ligne"><span>Rang de fréquentation</span><b>${G.nb_validations_12m ? `${rang}ᵉ sur ${toutesGares.length}` : "–"}</b></div>
    </div>`
  : html`<p class="muted">Tapez le nom d'une gare dans le champ « Rechercher une gare », ou cliquez sur une barre du classement ci-dessous.</p>`);
```

</div>
</div>

<div class="grid grid-cols-2">
<div class="card">

## Les 10 gares les plus fréquentées

```js
resize((width) => barresClassees(garesVisibles.filter((d) => d.nb_validations_12m), {
  valeur: "nb_validations_12m", nom: "nom_pole", width,
  etiquette: (d) => `${fmtCompact(d.nb_validations_12m)} validations`,
  couleur: (d) => (d.id === gareChoisie ? IDFM.encre : IDFM.bleu),
  max: 10, margeGauche: 170, margeDroite: 130,
  surClic: (d) => choisirGare(d.id)
}))
```

<div class="note"><b>Comment lire ce graphique.</b> Les 10 gares qui comptent le plus de validations en 12 mois, parmi celles affichées sur la carte (les filtres s'appliquent). « M » signifie million. Cliquez sur une barre pour repérer la gare sur la carte.</div>

</div>
<div class="card">

## La fréquentation jour après jour

```sql id=jours
SELECT jour, nb_validations FROM fact_validations_jour ORDER BY jour
```

```js
resize((width) => Plot.plot({
  width,
  height: 350,
  marginLeft: 50,
  style: {fontSize: "12px"},
  x: {label: null},
  y: {label: "Validations par jour (moyenne sur 7 jours)", tickFormat: fmtCompact, grid: true},
  marks: [
    Plot.lineY(jours, Plot.windowY({k: 7, anchor: "end", strict: true}, {x: "jour", y: "nb_validations", stroke: IDFM.bleu, strokeWidth: 2.5})),
    Plot.ruleY([0], {stroke: IDFM.grisClair}),
    Plot.ruleX(jours, Plot.pointerX({x: "jour", stroke: IDFM.grisClair})),
    Plot.tip(jours, Plot.pointerX({x: "jour", y: "nb_validations", title: (d) => `${new Date(d.jour).toLocaleDateString("fr-FR", {weekday: "long", day: "numeric", month: "long", year: "numeric"})}\n${fmtInt(d.nb_validations)} validations ce jour-là`}))
  ]
}))
```

<div class="note"><b>Comment lire ce graphique.</b> La courbe suit le nombre de validations sur tout le réseau ferré. Chaque point est la moyenne des 7 derniers jours, pour gommer l'effet du week-end. Les creux correspondent aux vacances scolaires et aux jours fériés. Passez la souris pour lire le chiffre d'un jour précis.</div>

</div>
</div>

## Par département

```sql id=parDep
SELECT g.libgeo AS departement,
       MAX(CASE WHEN f.code_indicateur = 'nb_gares' THEN f.nombre END) AS gares,
       MAX(CASE WHEN f.code_indicateur = 'nb_validations_12m' THEN f.nombre END) AS validations,
       MAX(CASE WHEN f.code_indicateur = 'part_tc' THEN f.nombre END) AS part_tc
FROM fact_mobilite f
JOIN dim_geo g ON g.maille = f.maille AND g.codegeo = f.codegeo
WHERE f.maille = 'Département'
GROUP BY g.libgeo
```

<div class="filtres">

```js
const critereDep = view(Inputs.radio(new Map([["Nombre de gares", "gares"], ["Validations en 12 mois", "validations"], ["Habitants allant travailler en transports en commun (%)", "part_tc"]]), {label: "Comparer", value: "gares"}));
```

</div>

<div class="card">

```js
resize((width) => barresClassees(parDep, {
  valeur: critereDep, nom: "departement", width,
  etiquette: (d) => (critereDep === "part_tc" ? fmtPct(d.part_tc) : critereDep === "validations" ? fmtCompact(d.validations) : fmtInt(d.gares)),
  max: 8, margeGauche: 150, margeDroite: 90
}))
```

<div class="note"><b>Comment lire ce graphique.</b> Les 8 départements classés selon le critère choisi juste au-dessus. Paris concentre les validations parce que beaucoup de voyageurs venus d'ailleurs y passent.</div>

</div>

## Lexique

```js
display(lexique(["Gare ou station (pôle ferré)", "Validation", "Transports en commun", "Part d'un mode de transport", "Commune", "Département"]))
```

## Sources des données

```js
display(piedSources(["Île-de-France Mobilités", "INSEE", "Etalab", "IGN"], [
  "Emplacement des gares et stations (Île-de-France Mobilités).",
  "Validations sur le réseau ferré, 4 derniers trimestres publiés (Île-de-France Mobilités). La fréquentation n'est pas publiée pour environ une gare sur quatre, surtout des stations de tramway.",
  "Recensement de la population 2022 (INSEE) : habitants ayant un emploi et mode de transport.",
  "Contours des communes (Etalab, IGN) : fonds de carte."
]))
```
