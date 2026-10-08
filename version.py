#!/usr/bin/env python3
"""Met à jour le numéro de version de la Pythonerie : v. aaaa.mm.jj.hh.MM

    python3 version.py

Le numéro (année.mois.jour.heure.minute) s'affiche dans l'en-tête de docs/index.html,
après « apprendre à programmer en français ». Le même numéro sert aux ?v=… des scripts,
de la feuille de style et de lispe.wasm : il force le navigateur à recharger les fichiers
modifiés, que GitHub Pages garde 10 minutes en cache.

À lancer après chaque modification du code.
"""

import re
from datetime import datetime
from pathlib import Path

INDEX = Path(__file__).resolve().parent / "docs" / "index.html"


def main():
    numéro = datetime.now().strftime("%Y.%m.%d.%H.%M")
    texte = INDEX.read_text(encoding="utf-8")
    texte, n_affichage = re.subn(r'(<span class="version"[^>]*>)v\. [\d.]+(</span>)',
                                 rf"\g<1>v. {numéro}\g<2>", texte)
    texte, n_cache = re.subn(r"\?v=[\w.\-]+", f"?v={numéro}", texte)
    if n_affichage != 1:
        raise SystemExit("Numéro de version introuvable dans l'en-tête de docs/index.html")
    INDEX.write_text(texte, encoding="utf-8")
    print(f"Version v. {numéro} ({n_cache} fichiers marqués pour le cache)")


if __name__ == "__main__":
    main()
