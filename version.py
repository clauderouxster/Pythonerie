#!/usr/bin/env python3
"""Met à jour le numéro de version de la Pythonerie : v. aaaa.mm.jj.hh.MM

    python3 version.py

Le numéro (année.mois.jour.heure.minute) s'affiche dans l'en-tête de docs/index.html,
après « apprendre à programmer en français ». Le même numéro sert aux ?v=… des scripts,
de la feuille de style et de lispe.wasm : il force le navigateur à recharger les fichiers
modifiés, que GitHub Pages garde 10 minutes en cache.

À lancer après chaque modification du code.

Il écrit aussi docs/exemples/médias/index.json, la liste des médias du site (sons et images
des exemples) : un site comme GitHub Pages ne sait pas lister un répertoire, et liste_sons()
ou « Créer une application Web » ont besoin de connaître ces fichiers.
"""

import json
import unicodedata

import re
from datetime import datetime
from pathlib import Path

DOCS = Path(__file__).resolve().parent / "docs"
INDEX = DOCS / "index.html"
MÉDIAS = DOCS / "exemples" / "médias"


def liste_médias():
    """Les chemins des médias, depuis docs/ : exemples/médias/piano/do_4.wav..."""
    chemins = sorted(
        unicodedata.normalize("NFC", f.relative_to(DOCS).as_posix())
        for f in MÉDIAS.rglob("*")
        if f.is_file() and not f.name.startswith(".") and f.name != "index.json"
    )
    (MÉDIAS / "index.json").write_text(json.dumps(chemins, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return len(chemins)


def main():
    numéro = datetime.now().strftime("%Y.%m.%d.%H.%M")
    texte = INDEX.read_text(encoding="utf-8")
    texte, n_affichage = re.subn(r'(<span class="version"[^>]*>)v\. [\d.]+(</span>)',
                                 rf"\g<1>v. {numéro}\g<2>", texte)
    texte, n_cache = re.subn(r"\?v=[\w.\-]+", f"?v={numéro}", texte)
    if n_affichage != 1:
        raise SystemExit("Numéro de version introuvable dans l'en-tête de docs/index.html")
    INDEX.write_text(texte, encoding="utf-8")
    print(f"Version v. {numéro} ({n_cache} fichiers marqués pour le cache, {liste_médias()} médias listés)")


if __name__ == "__main__":
    main()
