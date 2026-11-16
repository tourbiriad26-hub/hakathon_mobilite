"""Transforme les fichiers du diaporama (deck.json, deck.css, slides/*.html) en une page HTML autonome.

Les éléments propres à l'éditeur de diapositives (<x-shape>, <x-connector>) sont remplacés par du SVG,
pour que la page s'affiche telle quelle dans n'importe quel navigateur.
Usage (depuis la racine du dépôt) : python presentation/export_html.py presentation/source presentation/index.html
"""
import html as htmllib
import json, pathlib, re, sys

src = pathlib.Path(sys.argv[1])
if (src / "project").is_dir():
    src = src / "project"
sortie = pathlib.Path(sys.argv[2])
deck = json.loads((src / "deck.json").read_text(encoding="utf-8"))
css = (src / "deck.css").read_text(encoding="utf-8")

GRIS = "#7C8A9A"


def fleche(kind, classes):
    # Flèche pleine dessinée en SVG, dans la boîte que lui donne sa classe CSS.
    if kind == "arrow-right":
        forme = '<svg viewBox="0 0 40 20" preserveAspectRatio="none" width="100%" height="100%"><path d="M0 6 H24 V0 L40 10 L24 20 V14 H0 Z" fill="currentColor"/></svg>'
    else:
        forme = '<svg viewBox="0 0 20 32" preserveAspectRatio="none" width="100%" height="100%"><path d="M6 0 H14 V18 H20 L10 32 L0 18 H6 Z" fill="currentColor"/></svg>'
    return f'<div class="{classes} forme" aria-hidden="true">{forme}</div>'


def remplacer_shapes(texte):
    def rep(m):
        attrs = m.group(1)
        kind = re.search(r'kind="([^"]+)"', attrs).group(1)
        classes = (re.search(r'class="([^"]+)"', attrs) or [None, ""])[1]
        return fleche(kind, classes)
    return re.sub(r"<x-shape([^>]*)></x-shape>", rep, texte)


def remplacer_connecteurs(texte):
    def rep(m):
        a = m.group(1)
        g = lambda k, d=None: (re.search(rf'{k}="([^"]+)"', a) or [None, d])[1]
        x1, y1, x2, y2 = (float(g(k)) for k in ("x1", "y1", "x2", "y2"))
        route, tete = g("route", "straight"), g("head", "end")
        if route == "hv":
            d = f"M{x1} {y1} H{x2} V{y2}"
        elif route == "vh":
            d = f"M{x1} {y1} V{y2} H{x2}"
        else:
            d = f"M{x1} {y1} L{x2} {y2}"
        marqueur = ' marker-end="url(#tete)"' if tete in ("end", "both") else ""
        return (f'<svg class="connecteur" aria-hidden="true" width="1" height="1"><path d="{d}" fill="none" stroke="{GRIS}" '
                f'stroke-width="3" stroke-linecap="round" stroke-linejoin="round"{marqueur}/></svg>')
    return re.sub(r"<x-connector([^>]*)></x-connector>", rep, texte)


diapos = []
for i in deck["order"]:
    t = (src / "slides" / f"{i}.html").read_text(encoding="utf-8")
    t = re.sub(r"<!--.*?-->", "", t, flags=re.S)
    t = remplacer_connecteurs(remplacer_shapes(t))
    # Les notes de l'orateur restent dans la page, masquées (touche N pour les afficher).
    t = t.replace("<aside>", '<aside class="notes">')
    diapos.append(t)

polices = "".join(f'<link rel="stylesheet" href="{f["href"]}">' for f in deck["faces"].values() if "href" in f)
titre = htmllib.escape(deck["title"])

page = f"""<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{titre}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
{polices}
<style>
* {{ margin:0; }}
html, body {{ height:100%; background:#1B232C; overflow:hidden; }}
#scene {{ position:absolute; left:0; top:0; width:1920px; height:1080px; transform-origin:0 0; }}
#scene > section {{ position:absolute; left:0; top:0; width:1920px; height:1080px; overflow:hidden; display:none; }}
#scene > section.active {{ display:flex; }}
.forme {{ color:{GRIS}; flex:none; }}
svg.connecteur {{ position:absolute; left:0; top:0; overflow:visible; pointer-events:none; }}
aside.notes {{ display:none; }}
body.voir-notes #scene > section.active aside.notes {{ display:block; position:absolute; left:0; right:0; bottom:0; padding:24px 128px; background:#25303BF2; color:#F2F6FB; font:24px/1.45 'Public Sans', Arial, sans-serif; }}
#aide {{ position:fixed; right:16px; bottom:12px; font:14px 'Public Sans', Arial, sans-serif; color:#AEB9C6; }}
@media print {{
  html, body {{ background:none; overflow:visible; height:auto; }}
  #scene {{ position:static; transform:none !important; width:auto; height:auto; }}
  #scene > section {{ position:relative; display:flex !important; page-break-after:always; break-after:page; }}
  #aide {{ display:none; }}
  @page {{ size:1920px 1080px; margin:0; }}
}}
{css}
</style>
</head>
<body>
<svg width="0" height="0" style="position:absolute"><defs><marker id="tete" orient="auto" markerWidth="5" markerHeight="5" refX="2" refY="2" overflow="visible"><path d="M0 0 L4 2 L0 4 Z" fill="{GRIS}"/></marker></defs></svg>
<div id="scene">
{"".join(diapos)}
</div>
<p id="aide">← → pour changer de diapositive · N : notes · F : plein écran</p>
<script>
const diapos = [...document.querySelectorAll('#scene > section')];
let n = Math.max(0, Math.min(diapos.length - 1, (parseInt(location.hash.slice(1), 10) || 1) - 1));
const scene = document.getElementById('scene');
function ajuster() {{
  const e = Math.min(innerWidth / 1920, innerHeight / 1080);
  scene.style.transform = `translate(${{(innerWidth - 1920 * e) / 2}}px, ${{(innerHeight - 1080 * e) / 2}}px) scale(${{e}})`;
}}
function montrer(i) {{
  n = Math.max(0, Math.min(diapos.length - 1, i));
  diapos.forEach((d, k) => d.classList.toggle('active', k === n));
  history.replaceState(null, '', '#' + (n + 1));
}}
addEventListener('resize', ajuster);
addEventListener('keydown', (e) => {{
  if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) montrer(n + 1);
  else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) montrer(n - 1);
  else if (e.key === 'Home') montrer(0);
  else if (e.key === 'End') montrer(diapos.length - 1);
  else if (e.key === 'n' || e.key === 'N') document.body.classList.toggle('voir-notes');
  else if (e.key === 'f' || e.key === 'F') document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
}});
addEventListener('click', (e) => {{ if (!e.target.closest('a')) montrer(e.clientX > innerWidth / 3 ? n + 1 : n - 1); }});
ajuster(); montrer(n);
</script>
</body>
</html>
"""
sortie.parent.mkdir(parents=True, exist_ok=True)
sortie.write_text(page, encoding="utf-8")
print("diapositives :", len(diapos), "· taille :", len(page), "caractères")
