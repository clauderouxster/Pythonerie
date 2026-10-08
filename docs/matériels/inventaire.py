#!/usr/bin/env python3
"""Inventaire du répertoire Matériels de la Pythonerie (pour l'enseignant).

Déposez dans ce répertoire le matériel de cours de vos élèves : des programmes (.py),
que les élèves copient d'un clic, et des données (textes, listes, fichiers .csv...),
qu'un programme lit avec charge_données("nom du fichier"). Puis lancez :

    python3 inventaire.py           # demande une explication pour chaque nouveau fichier
    python3 inventaire.py --revoir  # permet aussi de changer les explications existantes

Le script parcourt le répertoire (et ses sous-répertoires), demande un titre et une
explication pour chaque fichier qu'il ne connaît pas encore, retire de la liste les
fichiers qui ont disparu, puis écrit index.json : c'est ce fichier que la Pythonerie lit
pour afficher le répertoire « Matériels » au-dessus des « Exemples ».

Aucune dépendance : seulement la bibliothèque standard de Python.
"""

import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path

ICI = Path(__file__).resolve().parent
INDEX = ICI / "index.json"
IGNORÉS = {"index.json", Path(__file__).name}


def nfc(texte):
    # macOS donne souvent les noms de fichiers sous forme décomposée (é = e + ´)
    return unicodedata.normalize("NFC", texte)


def tri_naturel(nom):
    # « 2. Tortue » avant « 10. Piano »
    return [int(m) if m.isdigit() else m.casefold() for m in re.split(r"(\d+)", nom)]


def fichiers_présents():
    trouvés = []
    for f in ICI.rglob("*"):
        relatif = f.relative_to(ICI)
        if not f.is_file() or any(p.startswith(".") or p == "__pycache__" for p in relatif.parts):
            continue
        if relatif.as_posix() in IGNORÉS:
            continue
        trouvés.append(nfc(relatif.as_posix()))
    return sorted(trouvés, key=tri_naturel)


def lit_index():
    if not INDEX.exists():
        return []
    try:
        liste = json.loads(INDEX.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        sys.exit(f"index.json est illisible ({e}) : corrigez-le ou supprimez-le.")
    return [dict(x, fichier=nfc(x["fichier"])) for x in liste if isinstance(x, dict) and "fichier" in x]


def demande(question, défaut=""):
    suffixe = f" [{défaut}]" if défaut else ""
    try:
        réponse = input(f"  {question}{suffixe} : ").strip()
    except EOFError:
        réponse = ""
    return nfc(réponse) or défaut


def titre_par_défaut(fichier):
    nom = Path(fichier).name
    # un programme prend un titre lisible ; des données gardent leur nom, celui que
    # les élèves donnent à charge_données
    return Path(nom).stem.replace("_", " ") if nom.lower().endswith(".py") else nom


def main():
    parser = argparse.ArgumentParser(description="Inventaire du répertoire Matériels de la Pythonerie")
    parser.add_argument("--revoir", action="store_true", help="proposer aussi de changer les explications existantes")
    args = parser.parse_args()

    connus = {x["fichier"]: x for x in lit_index()}
    présents = fichiers_présents()
    liste = []
    nouveaux = 0

    for fichier in présents:
        entrée = connus.get(fichier)
        if entrée is None or args.revoir:
            genre = "programme" if fichier.lower().endswith(".py") else "données"
            print(f"\n{'Nouveau fichier' if entrée is None else 'Fichier'} ({genre}) : {fichier}")
            if genre == "données":
                print(f'  Les élèves le liront avec : charge_données("{fichier}")')
            entrée = dict(entrée or {}, fichier=fichier)
            entrée["titre"] = demande("Titre affiché", entrée.get("titre") or titre_par_défaut(fichier))
            entrée["description"] = demande("Explication pour les élèves", entrée.get("description", ""))
            nouveaux += connus.get(fichier) is None
        liste.append({"fichier": entrée["fichier"], "titre": entrée.get("titre") or titre_par_défaut(fichier),
                      "description": entrée.get("description", "")})

    disparus = sorted(set(connus) - set(présents), key=tri_naturel)
    INDEX.write_text(json.dumps(liste, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print()
    for f in disparus:
        print(f"Retiré de la liste (fichier disparu) : {f}")
    print(f"index.json : {len(liste)} fichier(s), dont {nouveaux} nouveau(x).")


if __name__ == "__main__":
    main()
