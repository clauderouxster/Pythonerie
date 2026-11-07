#!/usr/bin/env python3
"""Met à jour le numéro de version de la Pythonerie : v. aaaa.mm.jj.hh.MM

    python3 version.py

Le numéro (année.mois.jour.heure.minute) s'affiche dans l'en-tête de docs/index.html,
après « apprendre à programmer en français ». Le même numéro sert aux ?v=… des scripts,
de la feuille de style et de lispe.wasm : il force le navigateur à recharger les fichiers
modifiés, que GitHub Pages garde 10 minutes en cache.

À lancer après chaque modification du code.

Il écrit aussi docs/médias/index.json, la liste des médias du site (sons et images
partagés par tous les programmes) : un site comme GitHub Pages ne sait pas lister un répertoire, et liste_sons()
ou « Créer une application Web » ont besoin de connaître ces fichiers.

Il vérifie enfin que docs/basic/basic_opt.lisp (le parseur que charge le site, accéléré par
optimise.lisp) correspond toujours à docs/basic/basic.lisp (celui de compiler.lisp).
"""

import json
import unicodedata

import re
from datetime import datetime
from pathlib import Path

DOCS = Path(__file__).resolve().parent / "docs"
INDEX = DOCS / "index.html"
MÉDIAS = DOCS / "médias"


def liste_médias():
    """Les chemins des médias, depuis docs/ : médias/sounds/piano/C_4.wav, médias/images/étoile.svg..."""
    chemins = sorted(
        unicodedata.normalize("NFC", f.relative_to(DOCS).as_posix())
        for f in MÉDIAS.rglob("*")
        if f.is_file() and not f.name.startswith(".") and f.name != "index.json"
    )
    (MÉDIAS / "index.json").write_text(json.dumps(chemins, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    return len(chemins)


def état_parseur(basic):
    """basic_opt.lisp (le parseur accéléré par optimise.lisp, que le site charge) correspond-il à
    basic.lisp (celui de compiler.lisp) ? Son en-tête donne la date de sa source (compiler.lisp
    la renouvelle à chaque génération) et son nombre de fonctions.
    Rend '' si oui, sinon ce qui ne va pas."""
    opt = basic / "basic_opt.lisp"
    if not opt.is_file():
        return "basic_opt.lisp manque"
    source = (basic / "basic.lisp").read_text(encoding="utf-8").replace("\r", "")
    tête = opt.read_text(encoding="utf-8").split("\n", 1)[0]
    if tête.startswith(";Non optimisé"):
        return "basic_opt.lisp n'est pas optimisé (optimise.lisp a refusé sa version)"
    attendu = f"({source.count(chr(10) + '(defun ')} fonctions, {source.split(chr(10), 1)[0].strip()})"
    if not tête.startswith(";Optimisé") or not tête.endswith(attendu):
        return "basic_opt.lisp ne correspond plus à basic.lisp"
    return ""


def structure_compétence(texte):
    """La charpente de la compétence : les titres (niveau et numéro), les blocs de code et les cases de
    la check-list. Les deux versions (anglaise, française) disent la même chose : leur charpente est la même."""
    titres = [ligne.split()[0] + " " + (ligne.split()[1] if len(ligne.split()) > 1 and ligne.split()[1][0].isdigit() else "")
              for ligne in texte.splitlines() if ligne.startswith("#")]
    blocs = sum(1 for ligne in texte.splitlines() if ligne.lstrip().startswith("```"))
    cases = sum(1 for ligne in texte.splitlines() if ligne.lstrip().startswith("- [ ]"))
    return titres, blocs, cases


def état_compétence():
    """La compétence .claude/skills/…/SKILL.md décrit comment enrichir et corriger le langage : elle se
    maintient avec le code. Elle existe en deux versions qui disent la même chose : en anglais dans l'Atelier
    (enrich-the-language), en français dans la Pythonerie (enrichir-le-langage). Quand l'autre dépôt est à
    côté, on vérifie que leurs charpentes n'ont pas divergé."""
    ici = DOCS.parent / ".claude" / "skills" / "enrichir-le-langage" / "SKILL.md"
    autre = DOCS.parent.parent / "Atelier-of-the-Apps" / ".claude" / "skills" / "enrich-the-language" / "SKILL.md"
    if not ici.exists():
        return f"la compétence {ici.relative_to(DOCS.parent)} manque"
    if autre.exists():
        a = structure_compétence(ici.read_text(encoding="utf-8"))
        b = structure_compétence(autre.read_text(encoding="utf-8"))
        if a != b:
            return (f"la compétence {ici.relative_to(DOCS.parent)} n'a plus la même structure que sa version "
                    f"dans Atelier-of-the-Apps (titres, blocs de code ou cases de la check-list) : reporter les changements, traduits")
    return None

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
    problème = état_parseur(DOCS / "basic")
    if problème:
        print(f"ATTENTION : {problème} ; relancer : cd docs/basic && lispe optimise.lisp . ../exemples/*.pyf")

    compétence = état_compétence()
    if compétence:
        print(f"ATTENTION : {compétence}")


if __name__ == "__main__":
    main()
