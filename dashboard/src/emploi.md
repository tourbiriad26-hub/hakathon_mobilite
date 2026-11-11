---
title: Trouver un emploi
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

```js
import {fmtInt, fmtPct, fmtCompact, toFeatureCollection, indexBy} from "./components/format.js";
import {IDFM, carte, echelleCarte, barresClassees, etiquettesCarte} from "./components/graphiques.js";
import {recherche} from "./components/filtres.js";
import {lexique} from "./components/lexique.js";
import {piedSources} from "./components/sources.js";
```

# Où recrute-t-on, et peut-on y aller sans voiture ?

L'Île-de-France est découpée en 25 bassins d'emploi. Pour chacun : combien d'embauches les employeurs prévoient en 2026,
si elles sont difficiles à pourvoir, et comment les habitants vont travailler. **Cliquez sur un bassin** pour voir ses métiers.

```js
// Bassin affiché dans la fiche et le graphique des métiers (null = le bassin qui recrute le plus).
const bassinClique = Mutable(null);
const choisirBassin = (code) => { bassinClique.value = code; };
```

```sql id=region
SELECT code_indicateur, nombre, periode FROM fact_mobilite WHERE maille = 'Région'
```

```sql id=demandeurs
SELECT SUM(nombre) AS total, MIN(periode) AS periode FROM fact_mobilite WHERE maille = 'Zone d''emploi' AND code_indicateur = 'nb_demandeurs_emploi_a'
```

```sql id=bassins
SELECT g.codegeo, g.libgeo, g.departement, g.geojson, g.lon, g.lat,
       MAX(CASE WHEN code_indicateur = 'nb_projets_recrutement' THEN nombre END) AS projets,
       MAX(CASE WHEN code_indicateur = 'part_recrutements_difficiles' THEN nombre END) AS part_difficiles,
       MAX(CASE WHEN code_indicateur = 'part_tc' THEN nombre END) AS part_tc,
       MAX(CASE WHEN code_indicateur = 'part_voiture' THEN nombre END) AS part_voiture,
       MAX(CASE WHEN code_indicateur = 'part_menages_sans_voiture' THEN nombre END) AS part_sans_voiture,
       MAX(CASE WHEN code_indicateur = 'nb_gares' THEN nombre END) AS gares
FROM dim_geo g
LEFT JOIN fact_mobilite f ON f.maille = g.maille AND f.codegeo = g.codegeo
WHERE g.maille = 'Bassin d''emploi'
GROUP BY g.codegeo, g.libgeo, g.departement, g.geojson, g.lon, g.lat
ORDER BY projets DESC NULLS LAST
```

```sql id=departements
SELECT codegeo, libgeo, geojson FROM dim_geo WHERE maille = 'Département'
```

```js
const R = indexBy(region, "code_indicateur");
const D = demandeurs.get(0);
const lignesBassins = bassins.toArray();
const fcBassins = toFeatureCollection(lignesBassins);
const fcDep = toFeatureCollection(departements);
const parCode = indexBy(lignesBassins, "codegeo");
const codeBassin = bassinClique ?? lignesBassins[0]?.codegeo;
const B = parCode.get(codeBassin);
const optionsBassins = new Map(lignesBassins.map((d) => [d.libgeo, d.codegeo]));
const mesures = new Map([
  ["Nombre d'embauches prévues en 2026", "projets"],
  ["Embauches jugées difficiles (%)", "part_difficiles"],
  ["Habitants allant travailler en transports en commun (%)", "part_tc"],
  ["Habitants allant travailler en voiture (%)", "part_voiture"]
]);
const nb = (v) => (v == null ? "–" : fmtInt(v));
```

<div class="grid grid-cols-4">
  <div class="card kpi"><h2>Embauches prévues en 2026</h2><div class="big">${fmtCompact(R.get("nb_projets_recrutement")?.nombre)}</div><div class="muted">déclarées par les employeurs</div></div>
  <div class="card kpi kpi--alerte"><h2>Jugées difficiles</h2><div class="big">${fmtPct(R.get("part_recrutements_difficiles")?.nombre)}</div><div class="muted">l'employeur craint de ne pas trouver</div></div>
  <div class="card kpi"><h2>Demandeurs d'emploi</h2><div class="big">${fmtCompact(D.total)}</div><div class="muted">sans aucune activité, fin ${D.periode}</div></div>
  <div class="card kpi kpi--tc"><h2>Lignes de bus</h2><div class="big">${nb(R.get("nb_lignes_bus")?.nombre)}</div><div class="muted">et ${nb(R.get("nb_lignes_train")?.nombre)} lignes de train ou RER, ${nb(R.get("nb_lignes_metro")?.nombre)} de métro, ${nb(R.get("nb_lignes_tram")?.nombre)} de tramway</div></div>
</div>

## Les 25 bassins d'emploi

<div class="filtres">

```js
const mesure = view(Inputs.select(mesures, {label: "Indicateur", value: "projets"}));
```

```js
display(recherche(optionsBassins, {
  label: "Rechercher un bassin",
  placeholder: "Tapez un nom, par exemple Roissy",
  surChoix: choisirBassin
}));
```

</div>

```js
const libMesure = [...mesures].find(([, code]) => code === mesure)[0];
const fmtMesure = (v) => (v == null ? "non disponible" : mesure === "projets" ? `${fmtInt(v)} embauches` : fmtPct(v));
```

<div class="grid grid-cols-3">
<div class="card grid-colspan-2">

```js
resize((width) => carte({
  fc: fcBassins, fcDep, width,
  hauteur: Math.min(620, Math.max(420, width * 0.78)),
  valeur: (f) => parCode.get(f.properties.codegeo)?.[mesure] ?? null,
  couleur: echelleCarte(lignesBassins.map((d) => d[mesure]), {label: libMesure}),
  titre: (f) => `${f.properties.libgeo}\n${fmtMesure(parCode.get(f.properties.codegeo)?.[mesure])}\nCliquez pour voir les métiers`,
  contour: 1,
  selection: codeBassin,
  // Le nom de chaque bassin est écrit sur la carte (nom court : "T4 · Paris Ouest La Défense").
  marques: width >= 520 ? [etiquettesCarte(lignesBassins, {taille: width >= 800 ? 11 : 9})] : [],
  surClic: (p) => choisirBassin(p.codegeo)
}))
```

<div class="note"><b>Comment lire cette carte.</b> Chaque zone est un bassin d'emploi, avec son nom. Plus le bleu est foncé, plus la valeur de l'indicateur choisi est élevée. Passez la souris pour lire la valeur, cliquez pour choisir un bassin (entouré en noir).</div>

</div>
<div class="card">

```js
resize((width) => barresClassees(lignesBassins, {
  valeur: mesure, nom: "libgeo", width,
  etiquette: (d) => fmtMesure(d[mesure]),
  couleur: (d) => (d.codegeo === codeBassin ? IDFM.encre : IDFM.bleu),
  max: 10, margeGauche: Math.min(170, width * 0.42), margeDroite: 115,
  surClic: (d) => choisirBassin(d.codegeo)
}))
```

<div class="note"><b>Comment lire ce graphique.</b> Les 10 bassins où la valeur est la plus élevée. Le bassin choisi est en foncé. Cliquez sur une barre pour changer de bassin.</div>

</div>
</div>

## Le bassin choisi : ${B?.libgeo ?? ""}

```sql id=metiers
SELECT metier, SUM(nb_projets) AS projets, SUM(nb_projets_difficiles) AS difficiles,
       100.0 * SUM(nb_projets_difficiles) / NULLIF(SUM(nb_projets), 0) AS part_difficiles
FROM fact_bmo WHERE code_be = ${codeBassin}
GROUP BY metier
ORDER BY projets DESC NULLS LAST
LIMIT 10
```

<div class="grid grid-cols-4">
  <div class="card kpi"><h2>Embauches prévues</h2><div class="big">${nb(B?.projets)}</div><div class="muted">en 2026</div></div>
  <div class="card kpi kpi--alerte"><h2>Jugées difficiles</h2><div class="big">${fmtPct(B?.part_difficiles)}</div><div class="muted">des embauches prévues</div></div>
  <div class="card kpi kpi--tc"><h2>Transports en commun</h2><div class="big">${fmtPct(B?.part_tc)}</div><div class="muted">des habitants pour aller travailler (voiture : ${fmtPct(B?.part_voiture)})</div></div>
  <div class="card kpi"><h2>Gares et stations</h2><div class="big">${nb(B?.gares ?? 0)}</div><div class="muted">${fmtPct(B?.part_sans_voiture)} des habitants n'ont pas de voiture</div></div>
</div>

<div class="card">

## Les 10 métiers les plus recherchés

```js
resize((width) => barresClassees(metiers, {
  valeur: "projets", nom: "metier", width,
  etiquette: (d) => `${fmtInt(d.projets)} embauches, dont ${d.part_difficiles == null ? "–" : Math.round(d.part_difficiles) + " %"} difficiles`,
  max: 10, margeGauche: Math.min(320, width * 0.4), margeDroite: 230
}))
```

<div class="note"><b>Comment lire ce graphique.</b> Chaque barre est un métier. Plus la barre est longue, plus les employeurs du bassin prévoient d'embaucher dans ce métier en 2026. Le texte indique aussi la part des embauches que les employeurs jugent difficiles.</div>

</div>

## Où le chômage est-il le plus fort ?

```sql id=ze
SELECT g.libgeo,
       MAX(CASE WHEN code_indicateur = 'nb_demandeurs_emploi_a' THEN nombre END) AS demandeurs_a,
       MAX(CASE WHEN code_indicateur = 'nb_demandeurs_emploi_a' THEN periode END) AS periode
FROM fact_mobilite f JOIN dim_geo g ON g.maille = f.maille AND g.codegeo = f.codegeo
WHERE f.maille = 'Zone d''emploi'
GROUP BY g.libgeo ORDER BY demandeurs_a DESC
```

```sql id=dep
SELECT g.libgeo, f.nombre AS taux_chomage, f.periode
FROM fact_mobilite f JOIN dim_geo g ON g.maille = f.maille AND g.codegeo = f.codegeo
WHERE f.maille = 'Département' AND f.code_indicateur = 'taux_chomage'
ORDER BY f.nombre DESC
```

<div class="grid grid-cols-2">
<div class="card">

## Taux de chômage par département (${dep.get(0)?.periode ?? ""})

```js
resize((width) => barresClassees(dep, {
  valeur: "taux_chomage", nom: "libgeo", width,
  etiquette: (d) => fmtPct(d.taux_chomage),
  max: 8, margeGauche: 150, margeDroite: 70
}))
```

<div class="note"><b>Comment lire ce graphique.</b> Sur 100 personnes qui travaillent ou cherchent un emploi, le nombre de celles qui sont au chômage. Le département le plus touché est en haut.</div>

</div>
<div class="card">

## Demandeurs d'emploi par zone (fin ${ze.get(0)?.periode ?? ""})

```js
resize((width) => barresClassees(ze, {
  valeur: "demandeurs_a", nom: "libgeo", width,
  etiquette: (d) => fmtInt(d.demandeurs_a),
  max: 10, margeGauche: 170, margeDroite: 80
}))
```

<div class="note"><b>Comment lire ce graphique.</b> Le nombre de personnes inscrites à France Travail et sans aucune activité, dans les 10 zones d'emploi qui en comptent le plus.</div>

</div>
</div>

## Lexique

```js
display(lexique(["Bassin d'emploi", "Projet de recrutement", "Recrutement difficile", "Demandeur d'emploi (catégorie A)", "Taux de chômage", "Zone d'emploi", "Part d'un mode de transport"]))
```

## Sources des données

```js
display(piedSources(["France Travail", "DARES", "INSEE", "Région Île-de-France", "Île-de-France Mobilités"], [
  "Enquête « Besoins en main-d'œuvre » 2026 (France Travail) : embauches prévues par bassin et par métier.",
  "Demandeurs d'emploi inscrits à France Travail (DARES) : nombre par zone d'emploi.",
  "Taux de chômage localisés (INSEE) : taux par département.",
  "Recensement de la population 2022 (INSEE) : mode de transport des habitants.",
  "Bassins d'emploi 2021 (Région Île-de-France) : découpage des 25 bassins.",
  "Référentiel des lignes et emplacement des gares (Île-de-France Mobilités)."
]))
```
