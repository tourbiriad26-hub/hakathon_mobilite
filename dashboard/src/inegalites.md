---
title: Inégalités & mobilité
---

```js
// Données chargées en entier (voir components/duckdb.js) : évite les erreurs de lecture sur GitHub Pages.
import {tablesCompletes} from "./components/duckdb.js";
const sql = DuckDBClient.sql(tablesCompletes({
  fact_mobilite: FileAttachment("./data/fact_mobilite.parquet"),
  dim_geo: FileAttachment("./data/dim_geo.parquet")
}));
```

# Revenus, emploi et dépendance à la voiture

Les parts modales (RP 2022) croisées avec les revenus (Filosofi 2021) et le chômage (dernier trimestre publié).
Une bulle = une commune ; sa taille = son nombre d'actifs. Seules les communes à plus de 200 actifs sont tracées.

```js
import {fmtInt, fmtPct, fmtEur, fmtCompact, couleursDep, nomsDep} from "./components/format.js";
import {bandeauSources} from "./components/sources.js";
```

```js
display(bandeauSources(["INSEE", "Île-de-France Mobilités"]))
```

```sql id=communes
SELECT g.codegeo, g.libgeo, g.departement, g.epci,
       MAX(CASE WHEN code_indicateur = 'nb_actifs_occupes' THEN nombre END) AS nb_actifs,
       MAX(CASE WHEN code_indicateur = 'part_tc' THEN nombre END) AS part_tc,
       MAX(CASE WHEN code_indicateur = 'part_voiture' THEN nombre END) AS part_voiture,
       MAX(CASE WHEN code_indicateur = 'part_velo' THEN nombre END) AS part_velo,
       MAX(CASE WHEN code_indicateur = 'part_menages_sans_voiture' THEN nombre END) AS part_sans_voiture,
       MAX(CASE WHEN code_indicateur = 'part_hors_departement' THEN nombre END) AS part_hors_departement,
       MAX(CASE WHEN code_indicateur = 'mediane_niveau_vie' THEN nombre END) AS mediane,
       MAX(CASE WHEN code_indicateur = 'taux_pauvrete' THEN nombre END) AS taux_pauvrete,
       MAX(CASE WHEN code_indicateur = 'nb_gares' THEN nombre END) AS nb_gares,
       BOOL_AND(fiable) AS fiable
FROM fact_mobilite f
JOIN dim_geo g ON g.maille = f.maille AND g.codegeo = f.codegeo
WHERE f.maille = 'Commune'
GROUP BY g.codegeo, g.libgeo, g.departement, g.epci
HAVING MAX(CASE WHEN code_indicateur = 'nb_actifs_occupes' THEN nombre END) >= 200
```

```js
const axeY = view(Inputs.select(new Map([
  ["Part modale voiture (%)", "part_voiture"],
  ["Part modale transports en commun (%)", "part_tc"],
  ["Part modale vélo (%)", "part_velo"],
  ["Actifs dont le ménage n'a pas de voiture (%)", "part_sans_voiture"],
  ["Part travaillant hors du département (%)", "part_hors_departement"]
]), {label: "Axe vertical", value: "part_voiture"}));
const axeX = view(Inputs.select(new Map([
  ["Niveau de vie médian (€ / an)", "mediane"],
  ["Taux de pauvreté (%)", "taux_pauvrete"]
]), {label: "Axe horizontal", value: "mediane"}));
const depsChoisis = view(Inputs.checkbox(nomsDep, {label: "Départements", value: [...nomsDep.values()], format: ([k, v]) => `${k} ${v}`}));
```

```js
const rows = communes.toArray().filter((d) => d[axeX] != null && d[axeY] != null && depsChoisis.includes(nomsDep.get(d.departement)));
const libX = axeX === "mediane" ? "Niveau de vie médian (€ / an, 2021)" : "Taux de pauvreté (%, 2021)";
const libY = {part_voiture: "Voiture (%)", part_tc: "Transports en commun (%)", part_velo: "Vélo (%)", part_sans_voiture: "Ménages sans voiture (%)", part_hors_departement: "Travaillent hors département (%)"}[axeY];
```

<div class="card">

```js
Plot.plot({
  width,
  height: 520,
  grid: true,
  x: {label: libX, tickFormat: axeX === "mediane" ? fmtCompact : undefined},
  y: {label: libY},
  r: {range: [1.5, 22]},
  color: {domain: [...nomsDep.values()], range: [...nomsDep.keys()].map((k) => couleursDep.get(k)), legend: true},
  marks: [
    Plot.dot(rows, {
      x: axeX, y: axeY, r: "nb_actifs",
      fill: (d) => nomsDep.get(d.departement), fillOpacity: 0.55, stroke: "white", strokeWidth: 0.4,
      tip: true,
      title: (d) => `${d.libgeo} (${d.departement})\n${libX.split(" (")[0]} : ${axeX === "mediane" ? fmtEur(d.mediane) : fmtPct(d.taux_pauvrete)}\n${libY.split(" (")[0]} : ${fmtPct(d[axeY])}\n${fmtInt(d.nb_actifs)} actifs · ${d.nb_gares ?? 0} pôle(s) ferré(s)`
    }),
    Plot.linearRegressionY(rows, {x: axeX, y: axeY, stroke: "#25303b", strokeDasharray: "4 3", ci: 0})
  ]
})
```

<div class="note">La droite en pointillés est une régression linéaire simple sur les communes affichées. Elle décrit une association, pas une causalité : la desserte ferrée, la densité et la localisation des emplois jouent ensemble.</div>

</div>

## Pauvreté et dépendance à la voiture, par EPCI

```sql id=epci
SELECT g.libgeo, g.codegeo, g.departement,
       MAX(CASE WHEN code_indicateur = 'nb_actifs_occupes' THEN nombre END) AS nb_actifs,
       MAX(CASE WHEN code_indicateur = 'part_voiture' THEN nombre END) AS part_voiture,
       MAX(CASE WHEN code_indicateur = 'part_tc' THEN nombre END) AS part_tc,
       MAX(CASE WHEN code_indicateur = 'taux_pauvrete' THEN nombre END) AS taux_pauvrete,
       MAX(CASE WHEN code_indicateur = 'mediane_niveau_vie' THEN nombre END) AS mediane,
       MAX(CASE WHEN code_indicateur = 'nb_gares' THEN nombre END) AS nb_gares
FROM fact_mobilite f
JOIN dim_geo g ON g.maille = f.maille AND g.codegeo = f.codegeo
WHERE f.maille = 'EPCI'
GROUP BY g.libgeo, g.codegeo, g.departement
ORDER BY taux_pauvrete DESC NULLS LAST
```

<div class="grid grid-cols-2">
<div class="card">

```js
Plot.plot({
  width,
  height: 420,
  grid: true,
  x: {label: "Taux de pauvreté (%)"},
  y: {label: "Part modale voiture (%)"},
  r: {range: [3, 30]},
  marks: [
    Plot.dot(epci, {x: "taux_pauvrete", y: "part_voiture", r: "nb_actifs", fill: (d) => couleursDep.get(d.departement), fillOpacity: 0.6, stroke: "white", tip: true,
      title: (d) => `${d.libgeo}\npauvreté ${fmtPct(d.taux_pauvrete)} · voiture ${fmtPct(d.part_voiture)}\n${fmtInt(d.nb_actifs)} actifs · ${d.nb_gares ?? 0} pôles ferrés`}),
    Plot.text(epci.toArray().filter((d) => d.nb_actifs > 150000 || d.taux_pauvrete > 25), {x: "taux_pauvrete", y: "part_voiture", text: (d) => d.libgeo.replace(/^(CA|CC|CU|EPT) /, ""), dy: -12, fontSize: 10, fill: "#4e5864"})
  ]
})
```

</div>
<div class="card">

```js
Inputs.table(epci.toArray().map((d) => ({EPCI: d.libgeo, Actifs: d.nb_actifs, "Pauvreté %": d.taux_pauvrete, "Niveau de vie": d.mediane, "Voiture %": d.part_voiture, "TC %": d.part_tc, Gares: d.nb_gares ?? 0})), {
  format: {Actifs: fmtInt, "Pauvreté %": fmtPct, "Niveau de vie": fmtEur, "Voiture %": fmtPct, "TC %": fmtPct},
  select: false, rows: 14
})
```

</div>
</div>

## Chômage par zone d'emploi

```sql id=chomage
SELECT g.libgeo, f.nombre AS taux_chomage, f.periode,
       (SELECT nombre FROM fact_mobilite x WHERE x.maille = f.maille AND x.codegeo = f.codegeo AND x.code_indicateur = 'part_tc') AS part_tc,
       (SELECT nombre FROM fact_mobilite x WHERE x.maille = f.maille AND x.codegeo = f.codegeo AND x.code_indicateur = 'nb_actifs_occupes') AS nb_actifs
FROM fact_mobilite f
JOIN dim_geo g ON g.maille = f.maille AND g.codegeo = f.codegeo
WHERE f.maille = 'Zone d''emploi' AND f.code_indicateur = 'taux_chomage'
ORDER BY f.nombre DESC
```

<div class="card">

```js
Plot.plot({
  width,
  height: 380,
  marginLeft: 170,
  x: {label: `Taux de chômage (%, ${chomage.get(0)?.periode ?? ""})`},
  y: {label: null},
  color: {type: "linear", scheme: "blues", domain: [0, d3.max(chomage, (d) => d.taux_chomage)]},
  marks: [
    Plot.barX(chomage, {x: "taux_chomage", y: "libgeo", sort: {y: "x", reverse: true}, fill: "taux_chomage", tip: true,
      title: (d) => `${d.libgeo}\nchômage ${fmtPct(d.taux_chomage)} · TC ${fmtPct(d.part_tc)}\n${fmtInt(d.nb_actifs)} actifs`}),
    Plot.text(chomage, {x: "taux_chomage", y: "libgeo", text: (d) => fmtPct(d.taux_chomage), dx: 4, textAnchor: "start", fontSize: 11}),
    Plot.ruleX([0])
  ]
})
```

<div class="note">Taux de chômage localisés (INSEE), moyenne trimestrielle au sens du BIT, zonage en zones d'emploi 2020. Les zones d'emploi dépassant l'Île-de-France sont comptées pour leur partie francilienne.</div>

</div>
