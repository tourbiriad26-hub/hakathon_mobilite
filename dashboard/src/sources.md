---
title: Sources et méthode
---

```js
// Données chargées en entier (voir components/duckdb.js) : évite les erreurs de lecture sur GitHub Pages.
import {tablesCompletes} from "./components/duckdb.js";
const sql = DuckDBClient.sql(tablesCompletes({
  dim_indicateurs: FileAttachment("./data/dim_indicateurs.parquet"),
  catalogue_sources: FileAttachment("./data/catalogue_sources.parquet")
}));
```

# Sources de données et méthode

Toutes les données sont ouvertes (Licence Ouverte 2.0 ou ODbL) et téléchargées automatiquement
par [`scripts/ingest.py`](https://github.com/tourbiriad26-hub/hakathon_mobilite/blob/main/scripts/ingest.py).
Le site est reconstruit chaque semaine par GitHub Actions : validations IDFM, demandeurs d'emploi et
taux de chômage se mettent à jour seuls.

## Les producteurs

```js
import {logosProducteur, producteurs, tousLesProducteurs} from "./components/sources.js";
const tout = catalogue.toArray();
const parProducteur = new Map(tousLesProducteurs.map((p) => [p, tout.filter((d) => producteurs(d.producteur).includes(p))]));
```

<div class="grille-producteurs">
${[...parProducteur].filter(([, l]) => l.length).map(([p, l]) => html`<div class="card">${logosProducteur(p, 40)}<div><b>${p}</b></div><div class="n">${l.filter((d) => d.statut === "intégré").length} jeu(x) intégré(s) · ${l.length} au catalogue</div></div>`)}
</div>

## Les jeux de données du défi 2 « mobilités et emploi »

Liste officielle du Hackathon, avec ce que le projet en fait :
**intégré** (dans le pipeline), **couvert** (l'information est déjà portée par une autre source intégrée),
**disponible** (piste documentée, non branchée), **non retenu** (hors sujet ou sans maille territoriale).

```sql id=catalogue
SELECT ordre, titre, producteur, defis, statut, usage, url, licence FROM catalogue_sources ORDER BY ordre
```

<div class="filtres">

```js
const statutChoisi = view(Inputs.checkbox(["intégré", "couvert", "disponible", "non retenu"], {label: "Statut", value: ["intégré", "couvert", "disponible", "non retenu"]}));
```

```js
const texteCherche = view(Inputs.text({label: "Rechercher une source", placeholder: "Tapez un mot, par exemple gares", autocomplete: "off"}));
```

</div>

```js
const sansAccent = (t) => String(t ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const cat = catalogue.toArray().filter((d) => statutChoisi.includes(d.statut) && sansAccent(`${d.titre} ${d.producteur} ${d.usage}`).includes(sansAccent(texteCherche)));
```

```js
Inputs.table(cat.map((d) => ({Statut: d.statut, Source: d.titre, Producteur: d.producteur, Défis: d.defis, "Usage dans le projet": d.usage, Licence: d.licence, Lien: d.url})), {
  select: false,
  rows: 40,
  width: {Statut: 90, Source: 260, Producteur: 150, Défis: 120, "Usage dans le projet": 380, Licence: 90, Lien: 160},
  format: {Producteur: (p) => logosProducteur(p, 18), Lien: (u) => htl.html`<a href=${u} target="_blank" rel="noopener">ouvrir ↗</a>`}
})
```

<div class="note">${cat.filter((d) => d.statut === "intégré").length} sources intégrées, ${cat.filter((d) => d.statut === "couvert").length} couvertes par le fichier détail MOBPRO, ${cat.filter((d) => d.statut === "disponible").length} pistes documentées.</div>

## Lexique complet

Tous les mots utilisés sur le site, expliqués simplement.

```js
import {lexique, tousLesTermes} from "./components/lexique.js";
display(lexique(tousLesTermes));
```

## Indicateurs publiés

```sql id=indics
SELECT code_indicateur, nom_indicateur, description, type_mesure, unite, source FROM dim_indicateurs ORDER BY ordre
```

```js
Inputs.table(indics, {
  columns: ["code_indicateur", "nom_indicateur", "description", "type_mesure", "unite", "source"],
  header: {code_indicateur: "Code", nom_indicateur: "Indicateur", description: "Définition", type_mesure: "Type", unite: "Unité", source: "Source"},
  select: false,
  rows: 30,
  width: {description: 420}
})
```

## Méthode

- **Un schéma en étoile** : `dim_geo` (1 367 territoires, 6 mailles : commune, EPCI, zone d'emploi, bassin d'emploi, département, région), `dim_indicateurs`, `dim_gares`, et des faits au format long (`fact_mobilite` : territoire × indicateur × période) ou croisé (`fact_flux` : commune de résidence × commune de travail × mode ; `fact_bmo` : bassin × métier).
- **Les parts ne sont jamais sommées** : à chaque maille, elles sont recalculées à partir des effectifs pondérés (`IPONDI`). Une part modale rapporte les actifs d'un mode à ceux qui se déplacent (hors « pas de transport »).
- **Fiabilité** : MOBPRO est un fichier au 1/5. Une valeur calculée sur moins de 200 actifs pondérés est marquée `fiable = false` et grisée par défaut sur les cartes.
- **Géographie** : les lieux de travail à l'arrondissement (Paris, Lyon, Marseille) sont ramenés à la commune ; les communes fusionnées depuis le recensement (Pierrefitte-sur-Seine → Saint-Denis) sont recodées en COG 2025. Chaque commune est rattachée à son bassin d'emploi par intersection géographique avec les polygones de la Région.
- **Secret statistique** : les valeurs Filosofi confidentielles (`CONF_STATUS = C`) et les cases BMO marquées `*` sont absentes, pas remplacées.
- **BMO** : les bassins de France Travail sont rapprochés des bassins régionaux par libellé (un test dbt vérifie que les 25 correspondent). Les parts « difficiles » sont recalculées à partir des projets, jamais moyennées.
- **Gares** : une gare est rattachée à la commune qui contient son point (intersection exacte avec le contour IGN), puis remontée aux EPCI, zones et bassins d'emploi, départements. La clé entre gares et validations est la zone de correspondance (`id_zdc`) ; environ un quart des pôles (surtout tramway) n'ont pas de validations publiées.
- **Outils** : Python + DuckDB pour l'ingestion, dbt pour les transformations et les tests (61 contrôles), Observable Framework + DuckDB-wasm pour ce site, qui ne dépend d'aucun serveur. La même chaîne dbt tourne aussi sur PostgreSQL (`dbt build --target postgres`).

## Autres pistes d'enrichissement (données ouvertes)

| Jeu de données | Producteur | Apport |
|---|---|---|
| Fichier détail MOBSCO 2022 (mobilités scolaires) | INSEE | Mêmes variables pour les élèves et étudiants : même pipeline, un second public |
| Base permanente des équipements (BPE 2025) | INSEE | Accès aux commerces, écoles, santé par commune |
| Offre horaire GTFS / offre hebdomadaire moyenne par arrêt | Île-de-France Mobilités | Fréquences réelles par arrêt (bus inclus), premiers et derniers passages : l'accès à l'emploi en horaires décalés |
| Référentiel des arrêts (bus, tram) | Île-de-France Mobilités | Compléter la carte au-delà du ferré |
| Validations sur le réseau de surface | Île-de-France Mobilités | Usage du bus et du tramway |
| Isochrones 45 min TC depuis les gares du Grand Paris Express (2023 / 2030) | Ministère de l'Écologie | Nombre d'emplois accessibles avant / après le GPE |
| Accidents corporels de la circulation (BAAC) | ONISR | Sécurité des déplacements par commune et par mode |
| Parc automobile par commune et vignette Crit'Air | SDES | Dépendance à la voiture et exposition aux ZFE |
| Demandes de valeurs foncières (DVF) | DGFiP | Coût du logement et éloignement domicile-travail |
