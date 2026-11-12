---
title: Se déplacer
---

```js
// Données chargées en entier (voir components/duckdb.js) : évite les erreurs de lecture sur GitHub Pages.
import {tablesCompletes} from "./components/duckdb.js";
const sql = DuckDBClient.sql(tablesCompletes({
  fact_mobilite: FileAttachment("./data/fact_mobilite.parquet"),
  dim_geo: FileAttachment("./data/dim_geo.parquet")
}));
```

```js
import {fmtInt, fmtPct, fmtEur, toFeatureCollection, indexBy, nomsDep} from "./components/format.js";
import {IDFM, carte, echelleCarte, barresClassees, barresModes} from "./components/graphiques.js";
import {recherche} from "./components/filtres.js";
import {lexique} from "./components/lexique.js";
import {piedSources} from "./components/sources.js";
```

# Comment va-t-on travailler, commune par commune ?

La carte colore chaque territoire selon l'indicateur choisi. **Cliquez sur un territoire** pour afficher sa fiche à droite,
ou cherchez une commune par son nom.

```js
// Territoire affiché dans la fiche. Il change quand on clique sur la carte, sur une barre, ou via la recherche.
// Un lien « ?commune=93048 » (depuis la page d'accueil) ouvre directement la fiche d'une commune.
const codeInitial = new URLSearchParams(location.search).get("commune") ?? "";
const territoire = Mutable({maille: "Commune", codegeo: /^[0-9][0-9AB][0-9]{3}$/.test(codeInitial) ? codeInitial : "75056"});
const choisirTerritoire = (maille, codegeo) => { territoire.value = {maille, codegeo}; };
```

```sql id=region
SELECT code_indicateur, nombre FROM fact_mobilite WHERE maille = 'Région'
```

```sql id=listeCommunes
SELECT codegeo, libgeo, departement FROM dim_geo WHERE maille = 'Commune' ORDER BY libgeo
```

```js
const R = indexBy(region, "code_indicateur", "nombre");
const optionsCommunes = new Map(listeCommunes.toArray().map((d) => [`${d.libgeo} (${d.departement})`, d.codegeo]));
const indicOptions = new Map([
  ["Vont travailler en transports en commun (%)", "part_tc"],
  ["Vont travailler en voiture (%)", "part_voiture"],
  ["Vont travailler à vélo (%)", "part_velo"],
  ["Vont travailler à pied (%)", "part_marche"],
  ["N'ont pas de voiture (%)", "part_menages_sans_voiture"],
  ["Travaillent hors de leur commune (%)", "part_hors_commune"],
  ["Niveau de vie médian (€ par an)", "mediane_niveau_vie"]
]);
const zoomOptions = new Map([["Toute l'Île-de-France", ""], ...[...nomsDep].map(([code, nom]) => [nom, code])]);
```

<div class="filtres">

```js
const indicateur = view(Inputs.select(indicOptions, {label: "Indicateur", value: "part_tc"}));
```

```js
const maille = view(Inputs.radio(["Commune", "Département"], {label: "Découpage", value: "Commune"}));
```

```js
const zoomCode = view(Inputs.select(zoomOptions, {label: "Zoom sur", value: ""}));
```

```js
display(recherche(optionsCommunes, {
  label: "Rechercher une commune",
  placeholder: "Tapez un nom, par exemple Montreuil",
  surChoix: (code) => choisirTerritoire("Commune", code)
}));
```

</div>

```sql id=valeurs
SELECT f.codegeo, f.nombre, f.fiable, g.libgeo
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

```sql id=fiche
SELECT f.code_indicateur, f.nombre, g.libgeo
FROM fact_mobilite f
JOIN dim_geo g ON g.maille = f.maille AND g.codegeo = f.codegeo
WHERE f.maille = ${territoire.maille} AND f.codegeo = ${territoire.codegeo}
```

```js
const fc = toFeatureCollection(geo);
const fcDep = toFeatureCollection(departements);
const vals = indexBy(valeurs, "codegeo");
const libIndic = [...indicOptions].find(([, code]) => code === indicateur)[0];
const fmtVal = (v) => (v == null ? "non disponible" : indicateur === "mediane_niveau_vie" ? fmtEur(v) : fmtPct(v));
// Une valeur calculée sur trop peu de personnes n'est pas affichée (territoire en gris).
const valeurCarte = (f) => { const v = vals.get(f.properties.codegeo); return v && v.fiable ? v.nombre : null; };
const lignesClassement = valeurs.toArray().filter((d) => d.fiable && d.nombre != null);
```

```js
const F = indexBy(fiche, "code_indicateur", "nombre");
const nomFiche = fiche.get(0)?.libgeo ?? "Territoire";
const nb = (v) => (v == null ? "–" : fmtInt(v));
```

<div class="grid grid-cols-3">
<div class="card grid-colspan-2">

## ${libIndic}

```js
resize((width) => carte({
  fc, fcDep, width,
  zoom: zoomCode ? fcDep.features.find((f) => f.properties.codegeo === zoomCode) : null,
  valeur: valeurCarte,
  couleur: echelleCarte(fc.features.map(valeurCarte), {label: libIndic}),
  titre: (f) => `${f.properties.libgeo}\n${fmtVal(vals.get(f.properties.codegeo)?.nombre)}\nCliquez pour ouvrir la fiche`,
  contour: maille === "Commune" ? 0.3 : 1,
  selection: territoire.maille === maille ? territoire.codegeo : null,
  surClic: (p) => choisirTerritoire(maille, p.codegeo)
}))
```

<div class="note"><b>Comment lire cette carte.</b> Plus le bleu est foncé, plus la valeur est élevée. La légende au-dessus de la carte donne les limites de chaque couleur. En gris : pas de donnée, ou trop peu d'habitants pour un chiffre fiable. Le territoire entouré en noir est celui de la fiche.</div>

</div>
<div class="card fiche">

<div class="fiche-titre">Fiche du territoire</div>

## ${nomFiche}

<div class="fiche-ligne"><span>Habitants ayant un emploi</span><b>${nb(F.get("nb_actifs_occupes"))}</b></div>
<div class="fiche-ligne"><span>Vont travailler en transports en commun</span><b>${fmtPct(F.get("part_tc"))}</b></div>
<div class="fiche-ligne"><span>Vont travailler en voiture</span><b>${fmtPct(F.get("part_voiture"))}</b></div>
<div class="fiche-ligne"><span>Vont travailler à vélo</span><b>${fmtPct(F.get("part_velo"))}</b></div>
<div class="fiche-ligne"><span>Vont travailler à pied</span><b>${fmtPct(F.get("part_marche"))}</b></div>
<div class="fiche-ligne"><span>Travaillent hors de leur commune</span><b>${fmtPct(F.get("part_hors_commune"))}</b></div>
<div class="fiche-ligne"><span>N'ont pas de voiture</span><b>${fmtPct(F.get("part_menages_sans_voiture"))}</b></div>
<div class="fiche-ligne"><span>Niveau de vie médian (par an)</span><b>${fmtEur(F.get("mediane_niveau_vie"))}</b></div>
<div class="fiche-ligne"><span>Gares et stations</span><b>${nb(F.get("nb_gares") ?? 0)}</b></div>

<div class="fiche-titre">Comparé à l'Île-de-France</div>

```js
resize((width) => barresModes([
  {nom: nomFiche.length > 16 ? nomFiche.slice(0, 15) + "…" : nomFiche, tc: F.get("part_tc"), voiture: F.get("part_voiture")},
  {nom: "Île-de-France", tc: R.get("part_tc"), voiture: R.get("part_voiture")}
], {width, margeGauche: 110}))
```

<div class="muted">Sur 100 personnes qui se déplacent pour aller travailler.</div>

</div>
</div>

## Le classement : ${libIndic}

<div class="card">

```js
resize((width) => barresClassees(lignesClassement, {
  valeur: "nombre", nom: "libgeo", width,
  etiquette: (d) => fmtVal(d.nombre),
  couleur: (d) => (d.codegeo === territoire.codegeo && territoire.maille === maille ? IDFM.encre : IDFM.bleu),
  max: 10, margeGauche: 200, margeDroite: 80,
  surClic: (d) => choisirTerritoire(maille, d.codegeo)
}))
```

<div class="note"><b>Comment lire ce graphique.</b> Les 10 territoires où la valeur est la plus élevée, pour l'indicateur et le découpage choisis dans les filtres. Cliquez sur une barre pour ouvrir la fiche du territoire.</div>

</div>

## Transports en commun ou voiture : les 8 départements

```sql id=parts
SELECT g.libgeo AS nom,
       MAX(CASE WHEN f.code_indicateur = 'part_tc' THEN f.nombre END) AS tc,
       MAX(CASE WHEN f.code_indicateur = 'part_voiture' THEN f.nombre END) AS voiture
FROM fact_mobilite f
JOIN dim_geo g ON g.maille = f.maille AND g.codegeo = f.codegeo
WHERE f.maille = 'Département'
GROUP BY g.libgeo
ORDER BY tc DESC
```

<div class="card">

```js
resize((width) => barresModes(parts, {width, margeGauche: 150}))
```

<div class="note"><b>Comment lire ce graphique.</b> Une ligne par département. La barre représente 100 personnes qui se déplacent pour aller travailler : en bleu celles qui prennent les transports en commun, en foncé celles qui prennent la voiture, en clair celles qui marchent ou roulent à vélo ou en deux-roues. Les départements sont classés de celui qui utilise le plus les transports en commun à celui qui les utilise le moins.</div>

</div>

## Lexique

```js
display(lexique(["Actif occupé", "Part d'un mode de transport", "Transports en commun", "Commune", "Département", "Niveau de vie médian", "Ménage sans voiture", "Donnée peu fiable"]))
```

## Sources des données

```js
display(piedSources(["INSEE", "Île-de-France Mobilités", "Etalab", "IGN"], [
  "Recensement de la population 2022, fichier « mobilités professionnelles » (INSEE) : mode de transport, lieu de travail, voiture du ménage.",
  "Filosofi 2021 (INSEE) : niveau de vie médian.",
  "Emplacement des gares (Île-de-France Mobilités) : nombre de gares et stations par territoire.",
  "Contours des communes (Etalab, IGN) : fonds de carte."
]))
```
