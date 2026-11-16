# Présentation du projet

Diaporama de 19 diapositives qui détaille la démarche technique : la question, les six étapes de la chaîne
de traitement (collecter, ingérer, modéliser, contrôler, afficher, publier), les problèmes rencontrés et les résultats.

- **En ligne :** https://tourbiriad26-hub.github.io/hakathon_mobilite/presentation/
- **Hors ligne :** ouvrir `index.html` dans un navigateur.

Commandes : flèches ← → pour changer de diapositive, `N` pour afficher les notes de l'orateur, `F` pour le plein écran.
Pour un PDF : imprimer la page (`Ctrl+P`) et choisir « Enregistrer au format PDF ».

`source/` contient les diapositives d'origine (une par fichier) ; `index.html` en est généré par :

```bash
python presentation/export_html.py presentation/source presentation/index.html
```
