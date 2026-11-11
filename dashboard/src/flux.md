---
title: Flux domicile-travail
sql:
  fact_flux: ./data/fact_flux.parquet
  dim_geo: ./data/dim_geo.parquet
  modes_transport: ./data/modes_transport.parquet
---

# D'où viennent les actifs qui travaillent ici ?

Choisissez un territoire d'emploi : la carte colore chaque commune de résidence selon le nombre
d'actifs qui viennent y travailler, et les flèches relient les 40 principales origines.

```js
import {fmtInt, fmtPct, fmtCompact, toFeatureCollection, indexBy, couleursModes} from "./components/format.js";
import {bandeauSources} from "./components/sources.js";
```

```js
display(bandeauSources(["INSEE", "Etalab", "IGN"]))
```

```sql id=territoires
SELECT maille, codegeo, libgeo, lon, lat FROM dim_geo
WHERE maille IN ('Bassin d''emploi', 'EPCI', 'Département', 'Commune')
ORDER BY CASE maille WHEN 'Département' THEN 1 WHEN 'Bassin d''emploi' THEN 2 WHEN 'EPCI' THEN 3 ELSE 4 END, libgeo
```

```js
const terrRows = territoires.toArray();
const terrOptions = new Map(terrRows.map((d) => [`${d.libgeo} (${d.maille})`, `${d.maille}|${d.codegeo}`]));
const choix = view(Inputs.select(terrOptions, {label: "Territoire d'emploi", value: "EPCI|200054781", width: 420}));
const sens = view(Inputs.radio(new Map([["Qui vient y travailler ?", "entrant"], ["Où vont travailler ses résidents ?", "sortant"]]), {label: "Sens", value: "entrant"}));
```

```js
const [mailleChoisie, codeChoisi] = choix.split("|");
const terr = terrRows.find((d) => d.maille === mailleChoisie && d.codegeo === codeChoisi);
// Colonne de dim_geo (maille Commune) qui rattache une commune au territoire choisi
const colonne = mailleChoisie === "EPCI" ? "epci" : mailleChoisie === "Département" ? "departement" : mailleChoisie === "Bassin d'emploi" ? "bassin_emploi" : "codegeo";
```

```sql id=flux
WITH cibles AS (
  SELECT codegeo FROM dim_geo WHERE maille = 'Commune'
    AND ((${mailleChoisie} = 'EPCI' AND epci = ${codeChoisi})
      OR (${mailleChoisie} = 'Département' AND departement = ${codeChoisi})
      OR (${mailleChoisie} = 'Bassin d''emploi' AND bassin_emploi = ${codeChoisi})
      OR (${mailleChoisie} = 'Commune' AND codegeo = ${codeChoisi}))
),
f AS (
  SELECT
    CASE WHEN ${sens} = 'entrant' THEN commune_residence ELSE commune_travail END AS commune,
    code_trans, nb_actifs
  FROM fact_flux
  WHERE (${sens} = 'entrant' AND commune_travail IN (SELECT codegeo FROM cibles)
         AND commune_residence NOT IN (SELECT codegeo FROM cibles))
     OR (${sens} = 'sortant' AND commune_residence IN (SELECT codegeo FROM cibles)
         AND commune_travail NOT IN (SELECT codegeo FROM cibles))
)
SELECT f.commune, g.libgeo, g.departement, g.lon, g.lat,
       SUM(nb_actifs) AS nb_actifs,
       100.0 * SUM(CASE WHEN code_trans = '6' THEN nb_actifs END) / NULLIF(SUM(CASE WHEN code_trans <> '1' THEN nb_actifs END), 0) AS part_tc,
       100.0 * SUM(CASE WHEN code_trans = '5' THEN nb_actifs END) / NULLIF(SUM(CASE WHEN code_trans <> '1' THEN nb_actifs END), 0) AS part_voiture
FROM f
LEFT JOIN dim_geo g ON g.maille = 'Commune' AND g.codegeo = f.commune
GROUP BY f.commune, g.libgeo, g.departement, g.lon, g.lat
ORDER BY nb_actifs DESC
```

```sql id=interne
WITH cibles AS (
  SELECT codegeo FROM dim_geo WHERE maille = 'Commune'
    AND ((${mailleChoisie} = 'EPCI' AND epci = ${codeChoisi})
      OR (${mailleChoisie} = 'Département' AND departement = ${codeChoisi})
      OR (${mailleChoisie} = 'Bassin d''emploi' AND bassin_emploi = ${codeChoisi})
      OR (${mailleChoisie} = 'Commune' AND codegeo = ${codeChoisi}))
)
SELECT
  SUM(CASE WHEN commune_residence IN (SELECT codegeo FROM cibles) AND commune_travail IN (SELECT codegeo FROM cibles) THEN nb_actifs END) AS internes,
  SUM(CASE WHEN commune_travail IN (SELECT codegeo FROM cibles) AND commune_residence NOT IN (SELECT codegeo FROM cibles) THEN nb_actifs END) AS entrants,
  SUM(CASE WHEN commune_residence IN (SELECT codegeo FROM cibles) AND commune_travail NOT IN (SELECT codegeo FROM cibles) THEN nb_actifs END) AS sortants
FROM fact_flux
```

```sql id=modes
WITH cibles AS (
  SELECT codegeo FROM dim_geo WHERE maille = 'Commune'
    AND ((${mailleChoisie} = 'EPCI' AND epci = ${codeChoisi})
      OR (${mailleChoisie} = 'Département' AND departement = ${codeChoisi})
      OR (${mailleChoisie} = 'Bassin d''emploi' AND bassin_emploi = ${codeChoisi})
      OR (${mailleChoisie} = 'Commune' AND codegeo = ${codeChoisi}))
)
SELECT m.mode_court AS mode, m.ordre, SUM(f.nb_actifs) AS nb_actifs
FROM fact_flux f
JOIN modes_transport m ON m.code_trans = f.code_trans
WHERE f.code_trans <> '1'
  AND ((${sens} = 'entrant' AND f.commune_travail IN (SELECT codegeo FROM cibles) AND f.commune_residence NOT IN (SELECT codegeo FROM cibles))
    OR (${sens} = 'sortant' AND f.commune_residence IN (SELECT codegeo FROM cibles) AND f.commune_travail NOT IN (SELECT codegeo FROM cibles)))
GROUP BY m.mode_court, m.ordre
ORDER BY m.ordre
```

```js
const I = interne.get(0);
const totalFlux = sens === "entrant" ? I.entrants : I.sortants;
```

<div class="grid grid-cols-3">
  <div class="card"><h2>Travaillent et résident dans le territoire</h2><div class="big">${fmtCompact(I.internes)}</div><div class="muted">actifs « internes »</div></div>
  <div class="card"><h2>Entrants</h2><div class="big">${fmtCompact(I.entrants)}</div><div class="muted">résident ailleurs, travaillent ici</div></div>
  <div class="card"><h2>Sortants</h2><div class="big">${fmtCompact(I.sortants)}</div><div class="muted">résident ici, travaillent ailleurs</div></div>
</div>

```sql id=communes
SELECT codegeo, libgeo, departement, epci, bassin_emploi, geojson FROM dim_geo WHERE maille = 'Commune'
```

```sql id=departements
SELECT codegeo, libgeo, geojson FROM dim_geo WHERE maille = 'Département'
```

```js
const fc = toFeatureCollection(communes);
const fcDep = toFeatureCollection(departements);
const fluxRows = flux.toArray().filter((d) => d.lon != null);
const parCommune = indexBy(fluxRows, "commune");
const top = fluxRows.slice(0, 40);
const cibleSet = new Set(communes.toArray().filter((d) => d[colonne] === codeChoisi).map((d) => d.codegeo));
```

<div class="card">

```js
Plot.plot({
  width,
  height: Math.min(680, width * 0.8),
  projection: {type: "mercator", domain: fcDep},
  color: {type: "log", scheme: "blues", legend: true, label: `Actifs ${sens === "entrant" ? "venant travailler dans" : "résidant dans"} ${terr?.libgeo ?? ""}`, tickFormat: fmtCompact},
  marks: [
    Plot.geo(fc, {
      fill: (f) => cibleSet.has(f.properties.codegeo) ? "#fbbf24" : (parCommune.get(f.properties.codegeo)?.nb_actifs ?? null),
      stroke: "white", strokeWidth: 0.25,
      tip: true,
      title: (f) => {
        const v = parCommune.get(f.properties.codegeo);
        if (cibleSet.has(f.properties.codegeo)) return `${f.properties.libgeo}\n(territoire choisi)`;
        return v ? `${f.properties.libgeo}\n${fmtInt(v.nb_actifs)} actifs\nTC ${fmtPct(v.part_tc)} · voiture ${fmtPct(v.part_voiture)}` : f.properties.libgeo;
      }
    }),
    Plot.geo(fcDep, {stroke: "#333", strokeWidth: 0.8, fill: "none"}),
    Plot.arrow(top, {
      x1: (d) => sens === "entrant" ? d.lon : terr.lon,
      y1: (d) => sens === "entrant" ? d.lat : terr.lat,
      x2: (d) => sens === "entrant" ? terr.lon : d.lon,
      y2: (d) => sens === "entrant" ? terr.lat : d.lat,
      strokeWidth: (d) => Math.max(0.6, Math.sqrt(d.nb_actifs) / 12),
      stroke: "#b91c1c", strokeOpacity: 0.6, bend: 15, headLength: 6
    }),
    Plot.dot([terr], {x: "lon", y: "lat", r: 5, fill: "#b91c1c", stroke: "white"})
  ]
})
```

<div class="note">Jaune : territoire choisi. Les flèches représentent les 40 flux les plus importants ; l'épaisseur est proportionnelle à la racine du nombre d'actifs. Seuls les flux de plus de quelques dizaines d'actifs sont statistiquement solides (fichier détail au 1/5).</div>

</div>

<div class="grid grid-cols-2">
<div class="card">

## Mode de transport de ces ${fmtCompact(totalFlux)} actifs

```js
Plot.plot({
  width,
  height: 240,
  marginLeft: 150,
  x: {label: "Actifs", tickFormat: fmtCompact},
  y: {label: null},
  marks: [
    Plot.barX(modes, {x: "nb_actifs", y: "mode", sort: {y: "x", reverse: true}, fill: (d) => couleursModes.get(d.mode) ?? "#94a3b8", tip: true,
      title: (d) => `${d.mode} : ${fmtInt(d.nb_actifs)} (${fmtPct(100 * d.nb_actifs / d3.sum(modes, (m) => m.nb_actifs))})`}),
    Plot.ruleX([0])
  ]
})
```

</div>
<div class="card">

## Principales communes ${sens === "entrant" ? "d'origine" : "de destination"}

```js
Inputs.table(fluxRows.slice(0, 25).map((d) => ({Commune: d.libgeo, Dép: d.departement, Actifs: d.nb_actifs, "TC %": d.part_tc, "Voiture %": d.part_voiture})), {
  format: {Actifs: fmtInt, "TC %": fmtPct, "Voiture %": fmtPct},
  select: false,
  rows: 25
})
```

</div>
</div>
