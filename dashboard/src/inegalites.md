---
title: Inégalités & mobilité
sql:
  fact_mobilite: ./data/fact_mobilite.parquet
  dim_geo: ./data/dim_geo.parquet
---

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
]), {label: "Ce qu'on compare", value: "part_voiture"}));
const axeX = view(Inputs.select(new Map([
  ["Niveau de vie médian (€ / an)", "mediane"],
  ["Taux de pauvreté (%)", "taux_pauvrete"]
]), {label: "Classer les communes selon", value: "mediane"}));
const depsChoisis = view(Inputs.checkbox(nomsDep, {label: "Départements", value: [...nomsDep.values()], format: ([k, v]) => `${k} ${v}`}));
```

```js
const rows = communes.toArray().filter((d) => d[axeX] != null && d[axeY] != null && depsChoisis.includes(nomsDep.get(d.departement)));
const libX = axeX === "mediane" ? "Niveau de vie médian (€ / an, 2021)" : "Taux de pauvreté (%, 2021)";
const libY = {part_voiture: "Voiture (%)", part_tc: "Transports en commun (%)", part_velo: "Vélo (%)", part_sans_voiture: "Ménages sans voiture (%)", part_hors_departement: "Travaillent hors département (%)"}[axeY];
// Communes rangées en 5 groupes de même taille, de la plus modeste à la plus aisée.
const tri = rows.slice().sort((a, b) => axeX === "mediane" ? a.mediane - b.mediane : b.taux_pauvrete - a.taux_pauvrete);
const nomsGroupes = ["😟 20 % des communes les plus modestes", "Plutôt modestes", "Dans la moyenne", "Plutôt aisées", "😊 20 % des communes les plus aisées"];
const groupes = nomsGroupes.map((groupe, q) => {
  const g = tri.slice(Math.floor(q * tri.length / 5), Math.floor((q + 1) * tri.length / 5));
  const actifs = d3.sum(g, (d) => d.nb_actifs);
  return {groupe, n: g.length, actifs, valeur: actifs ? d3.sum(g, (d) => d[axeY] * d.nb_actifs) / actifs : null};
});
```

<div class="card">

```js
Plot.plot({
  width,
  height: 340,
  marginLeft: 260,
  // marge à droite pour que l'étiquette de la plus longue barre ne soit pas coupée
  x: {label: `${libY} — moyenne du groupe`, grid: true, domain: [0, (d3.max(groupes, (d) => d.valeur) ?? 0) * 1.15]},
  y: {label: null, domain: groupes.map((d) => d.groupe)},
  // dégradé qui reste bien visible sur fond clair comme sur fond sombre
  color: {type: "linear", range: ["#93c5fd", "#1e3a8a"]},
  marks: [
    Plot.barX(groupes, {x: "valeur", y: "groupe", fill: "valeur", tip: true,
      title: (d) => `${d.groupe}\n${libY} : ${fmtPct(d.valeur)}\n${d.n} communes · ${fmtInt(d.actifs)} actifs`}),
    Plot.text(groupes, {x: "valeur", y: "groupe", text: (d) => fmtPct(d.valeur), dx: 6, textAnchor: "start", fontSize: 14, fontWeight: "bold", fill: "currentColor"}),
    Plot.ruleX([0])
  ]
})
```

<div class="note">Les communes affichées sont réparties en 5 groupes de même taille, de la plus modeste à la plus aisée. Chaque barre donne la moyenne du groupe, pondérée par le nombre d'actifs. C'est une association, pas une causalité : la desserte ferrée, la densité et la localisation des emplois jouent ensemble.</div>

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
    Plot.text(epci.toArray().filter((d) => d.nb_actifs > 150000 || d.taux_pauvrete > 25), {x: "taux_pauvrete", y: "part_voiture", text: (d) => d.libgeo.replace(/^(CA|CC|CU|EPT) /, ""), dy: -12, fontSize: 10, fill: "#333"})
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
  color: {type: "linear", scheme: "reds", domain: [0, d3.max(chomage, (d) => d.taux_chomage)]},
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
