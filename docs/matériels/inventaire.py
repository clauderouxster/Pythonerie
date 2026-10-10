#!/usr/bin/env python3
"""Inventaire du répertoire Matériels de la Pythonerie (pour l'enseignant).

Déposez dans ce répertoire le matériel de cours de vos élèves :

- des projets (.zip), exportés depuis la Pythonerie (menu ☰, « Exporter le projet ») :
  un projet réunit des programmes, ses onglets de données et les fichiers de ses
  répertoires images, sons et données. Un clic de l'élève le charge dans son espace,
  pour bien commencer. On peut aussi en préparer un à la main : un dossier qui contient
  projet.json ({"format": "projet-pythonerie", "version": 3, "nom": "Mon projet"}),
  programmes/*.pyf, et au besoin onglets/don0.txt..., images/, sons/, données/,
  compressé en .zip ;
- des projets écrits en JSON (.json), par exemple préparés par Claude (voir POUR_CLAUDE.md) :
  {"format": "projet-pythonerie", "nom": ..., "programmes": {...}, "onglets": [...], "fichiers": {...}} ;
- des programmes seuls (.pyf, pour « Python francisé »), que l'élève copie d'un clic.

Puis lancez :

    python3 inventaire.py           # demande une explication pour chaque nouveau fichier
    python3 inventaire.py --revoir  # permet aussi de changer les explications existantes

Le script parcourt le répertoire (et ses sous-répertoires), demande un titre et une
explication pour chaque fichier qu'il ne connaît pas encore, retire de la liste les
fichiers qui ont disparu, puis écrit index.json : c'est ce fichier que la Pythonerie lit
pour afficher le répertoire « Matériels » au-dessus des « Exemples ». Les autres fichiers
sont ignorés : des données, des images ou des sons se placent dans un projet.

Aucune dépendance : seulement la bibliothèque standard de Python.
"""

import argparse
import json
import re
import sys
import unicodedata
import zipfile
from pathlib import Path

ICI = Path(__file__).resolve().parent
INDEX = ICI / "index.json"
IGNORÉS = {"index.json", Path(__file__).name}
FORMAT_PROJET = "projet-pythonerie"


def nfc(texte):
    # macOS donne souvent les noms de fichiers sous forme décomposée (é = e + ´)
    return unicodedata.normalize("NFC", texte)


def tri_naturel(nom):
    # « 2. Tortue » avant « 10. Piano »
    return [int(m) if m.isdigit() else m.casefold() for m in re.split(r"(\d+)", nom)]


def fiche_projet(fichier):
    """La description d'un projet : projet.json d'un .zip (à la racine, ou dans un dossier),
    ou le projet .json lui-même ; None si ce n'est pas un projet de la Pythonerie."""
    if fichier.suffix.lower() == ".json":
        try:
            fiche = json.loads(fichier.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError):
            return None
        return fiche if isinstance(fiche, dict) and fiche.get("format") == FORMAT_PROJET else None
    try:
        with zipfile.ZipFile(fichier) as archive:
            noms = sorted((n for n in archive.namelist() if n == "projet.json" or n.endswith("/projet.json")), key=len)
            if not noms:
                return None
            fiche = json.loads(archive.read(noms[0]).decode("utf-8"))
    except (OSError, zipfile.BadZipFile, UnicodeDecodeError, json.JSONDecodeError):
        return None
    return fiche if isinstance(fiche, dict) and fiche.get("format") == FORMAT_PROJET else None


def genre(fichier):
    """« projet », « programme », ou None pour un fichier que la Pythonerie n'affiche pas."""
    if fichier.suffix.lower() == ".pyf":
        return "programme"
    if fichier.suffix.lower() in (".zip", ".json") and fiche_projet(fichier):
        return "projet"
    return None


def fichiers_présents():
    trouvés, ignorés = [], []
    for f in ICI.rglob("*"):
        relatif = f.relative_to(ICI)
        if not f.is_file() or any(p.startswith(".") or p == "__pycache__" for p in relatif.parts):
            continue
        if relatif.as_posix() in IGNORÉS:
            continue
        (trouvés if genre(f) else ignorés).append(nfc(relatif.as_posix()))
    return sorted(trouvés, key=tri_naturel), sorted(ignorés, key=tri_naturel)


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
    # un projet : son nom ; sinon « quiz_des_capitales.zip » -> « quiz des capitales »
    if Path(fichier).suffix.lower() in (".zip", ".json"):
        nom = (fiche_projet(ICI / fichier) or {}).get("nom")
        if isinstance(nom, str) and nom.strip() and nom.strip() != "Sans Nom":
            return nfc(nom.strip())
    return Path(fichier).stem.replace("_", " ")


def main():
    parser = argparse.ArgumentParser(description="Inventaire du répertoire Matériels de la Pythonerie")
    parser.add_argument("--revoir", action="store_true", help="proposer aussi de changer les explications existantes")
    args = parser.parse_args()

    connus = {x["fichier"]: x for x in lit_index()}
    présents, ignorés = fichiers_présents()
    liste = []
    nouveaux = 0

    for fichier in présents:
        entrée = connus.get(fichier)
        if entrée is None or args.revoir:
            g = genre(ICI / fichier)
            print(f"\n{'Nouveau fichier' if entrée is None else 'Fichier'} ({g}) : {fichier}")
            if g == "projet":
                print("  Un clic de l'élève chargera ce projet dans son espace.")
            else:
                print("  Un clic de l'élève en créera une copie qu'il pourra modifier.")
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
    for f in ignorés:
        print(f"Ignoré (ni un projet, ni un programme) : {f}")
    print(f"index.json : {len(liste)} fichier(s), dont {nouveaux} nouveau(x).")


if __name__ == "__main__":
    main()
