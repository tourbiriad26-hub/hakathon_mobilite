// Graphiques communs à toutes les pages : mêmes formes, mêmes couleurs, mêmes étiquettes.
// Règles de lisibilité :
//   - une seule idée par graphique ;
//   - la valeur est écrite à côté de chaque barre (pas besoin de lire un axe) ;
//   - la couleur ne porte jamais l'information à elle seule (étiquettes, légende, infobulle) ;
//   - uniquement la palette d'Île-de-France Mobilités.
import * as Plot from "npm:@observablehq/plot";
import * as d3 from "npm:d3";
import {fmtInt} from "./format.js";

// Palette Île-de-France Mobilités (relevée sur iledefrance-mobilites.fr).
export const IDFM = {
  bleu: "#0268d5",       // couleur principale
  encre: "#25303b",      // texte, éléments forts
  gris: "#4e5864",       // texte secondaire
  grisClair: "#a9b4c2",  // éléments de comparaison
  grisPale: "#eef1f5",   // fond de carte, absence de donnée
  bordure: "#e0e5ec",
  bleuPale: "#cfe1f7",
  rouge: "#c52625"       // alerte uniquement
};

// Dégradé de cartes : du bleu IDFM très clair au bleu IDFM foncé (5 classes).
export const degradeBleu = ["#e6f0fb", "#b3d2f3", "#67a4e6", "#0268d5", "#01458d"];

const nombreFr = (v) => v.toLocaleString("fr-FR");
const raccourcir = (n) => (s) => (String(s).length > n ? String(s).slice(0, n - 1) + "…" : String(s));

// Seuils « ronds » pour une carte : on coupe les valeurs en 5 groupes de même taille,
// puis on arrondit chaque limite à 2 chiffres significatifs (23 %, 31 %, 21 000 €...).
export function seuilsRonds(valeurs, n = 5) {
  const v = Array.from(valeurs).filter((x) => x != null && Number.isFinite(x)).sort(d3.ascending);
  if (!v.length) return [1];
  const s = d3.range(1, n).map((i) => Number(d3.quantileSorted(v, i / n).toPrecision(2)));
  const uniques = [...new Set(s)].sort(d3.ascending);
  return uniques.length ? uniques : [1];
}

// Échelle de couleur d'une carte : 5 classes de bleu, légende avec les limites de classes.
export function echelleCarte(valeurs, {label, tickFormat = nombreFr} = {}) {
  const domain = seuilsRonds(valeurs);
  return {type: "threshold", domain, range: degradeBleu.slice(0, domain.length + 1), legend: true, label, tickFormat};
}

// Carte interactive.
//   - fond gris clair = pas de donnée ; territoires colorés selon `valeur` ; limites des départements ;
//   - survol : le territoire est entouré et une infobulle s'affiche (`titre`) ;
//   - clic : `surClic(properties)` est appelé avec le territoire cliqué ;
//   - `selection` : code(s) du ou des territoires à entourer en noir ;
//   - `zoom` : objet GeoJSON sur lequel cadrer la carte (par défaut, toute la région) ;
//   - `echelles` : autres échelles Plot (par exemple la taille des ronds : {r: {range: [1, 18]}}).
export function carte({fc, fcDep, width, valeur, couleur, titre, contour = 0.3, marques = [], surClic, selection, zoom, hauteur, echelles = {}}) {
  const codes = selection == null ? null : new Set(selection instanceof Set ? selection : [].concat(selection));
  const choisis = codes ? fc.features.filter((f) => codes.has(f.properties.codegeo)) : [];
  const interactif = Boolean(titre || surClic);
  const plot = Plot.plot({
    width,
    height: hauteur ?? Math.min(600, Math.max(320, width * 0.8)),
    projection: {type: "mercator", domain: zoom ?? fcDep, inset: 6},
    color: couleur,
    ...echelles,
    style: {fontSize: "12px"},
    marks: [
      Plot.geo(fc, {fill: IDFM.grisPale, stroke: "white", strokeWidth: contour}),
      ...(valeur ? [Plot.geo(fc, {fill: valeur, stroke: "white", strokeWidth: contour})] : []),
      Plot.geo(fcDep, {stroke: IDFM.gris, strokeWidth: 0.8, fill: "none"}),
      ...marques,
      ...(choisis.length ? [Plot.geo(choisis, {fill: "none", stroke: IDFM.encre, strokeWidth: 2.2})] : []),
      ...(interactif ? [Plot.geo(fc, {fill: "white", fillOpacity: 0, stroke: "none", ariaLabel: "zones", ...(titre ? {tip: true, title: titre} : {})})] : [])
    ]
  });
  if (surClic) {
    const zones = plot.querySelectorAll('g[aria-label="zones"] path');
    if (zones.length === fc.features.length) {
      zones.forEach((zone, i) => zone.addEventListener("click", () => surClic(fc.features[i].properties)));
      plot.classList.add("carte-cliquable");
    }
  }
  return plot;
}

// Classement en barres horizontales : du plus grand au plus petit, valeur écrite au bout de la barre.
//   valeur    : nom de la colonne numérique
//   nom       : nom de la colonne de libellé
//   etiquette : fonction (ligne) => texte affiché au bout de la barre
//   couleur   : couleur unique, ou fonction (ligne) => couleur
//   surClic   : fonction (ligne) appelée quand on clique sur une barre
export function barresClassees(donnees, {valeur, nom, etiquette, width, couleur = IDFM.bleu, max = 10, margeGauche = 180, margeDroite = 90, longueurNom = 34, infobulle, surClic} = {}) {
  const lignes = Array.from(donnees)
    .filter((d) => d[valeur] != null && Number.isFinite(d[valeur]))
    .sort((a, b) => d3.descending(a[valeur], b[valeur]))
    .slice(0, max);
  const texte = etiquette ?? ((d) => fmtInt(d[valeur]));
  const plot = Plot.plot({
    width,
    height: lignes.length * 32 + 30,
    marginLeft: margeGauche,
    marginRight: margeDroite,
    marginTop: 10,
    marginBottom: 10,
    style: {fontSize: "12px"},
    x: {axis: null},
    y: {label: null, domain: lignes.map((d) => d[nom]), tickSize: 0, tickFormat: raccourcir(longueurNom)},
    marks: [
      Plot.barX(lignes, {x: valeur, y: nom, fill: couleur, insetTop: 5, insetBottom: 5, title: infobulle ?? ((d) => `${d[nom]}\n${texte(d)}`), tip: true}),
      Plot.text(lignes, {x: valeur, y: nom, text: texte, dx: 6, textAnchor: "start", fill: IDFM.encre})
    ]
  });
  if (surClic) {
    const barres = plot.querySelectorAll('g[aria-label="bar"] rect');
    if (barres.length === lignes.length) {
      barres.forEach((barre, i) => barre.addEventListener("click", () => surClic(lignes[i])));
      plot.classList.add("barres-cliquables");
    }
  }
  return plot;
}

// Répartition des modes de transport : une barre de 100 % par ligne, découpée en 3 parts
// (transports en commun, voiture, autres), avec le pourcentage écrit dans chaque part.
//   lignes : [{nom, tc, voiture}] en pourcentage ; le reste jusqu'à 100 est « marche, vélo, deux-roues ».
const MODES3 = ["Transports en commun", "Voiture", "Marche, vélo, deux-roues"];
export function barresModes(donnees, {width, margeGauche = 150} = {}) {
  const lignes = Array.from(donnees);
  const parts = [];
  for (const d of lignes) {
    const valeurs = [d.tc ?? 0, d.voiture ?? 0, Math.max(0, 100 - (d.tc ?? 0) - (d.voiture ?? 0))];
    let x = 0;
    valeurs.forEach((v, i) => {
      parts.push({nom: d.nom, mode: MODES3[i], v, x1: x, x2: x + v, milieu: x + v / 2});
      x += v;
    });
  }
  const pct = (d) => `${Math.round(d.v)} %`;
  const lisibles = parts.filter((d) => d.v >= 7);
  return Plot.plot({
    width,
    height: lignes.length * 36 + 30,
    marginLeft: margeGauche,
    marginRight: 10,
    marginTop: 10,
    marginBottom: 10,
    style: {fontSize: "12px"},
    x: {axis: null, domain: [0, 100]},
    y: {label: null, domain: lignes.map((d) => d.nom), tickSize: 0},
    color: {domain: MODES3, range: [IDFM.bleu, IDFM.encre, IDFM.bleuPale], legend: true},
    marks: [
      Plot.barX(parts, {x1: "x1", x2: "x2", y: "nom", fill: "mode", insetTop: 5, insetBottom: 5, insetLeft: 1, tip: true,
        title: (d) => `${d.nom}\n${d.mode} : ${d.v.toFixed(1).replace(".", ",")} %`}),
      Plot.text(lisibles.filter((d) => d.mode !== MODES3[2]), {x: "milieu", y: "nom", text: pct, fill: "white", fontWeight: 600}),
      Plot.text(lisibles.filter((d) => d.mode === MODES3[2]), {x: "milieu", y: "nom", text: pct, fill: IDFM.encre, fontWeight: 600})
    ]
  });
}
