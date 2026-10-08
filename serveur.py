#!/usr/bin/env python3
"""Serveur local de Pythonerie.

Sert les fichiers de l'application et conserve les programmes des élèves
dans le répertoire programmes/ : un fichier .py par programme, rangés si on le
souhaite dans des sous-répertoires (programmes/Jeux/balle.py).

    python3 serveur.py            # http://localhost:8000
    python3 serveur.py --port 8080

Un chemin désigne un programme ou un répertoire : "Jeux/balle" (sans .py).

API :
    GET    /api/programmes             {"programmes": [{"chemin", "modifie"}], "dossiers": [chemin]}
    GET    /api/programmes/<chemin>    contenu du programme
    PUT    /api/programmes/<chemin>    enregistre le programme (corps = texte),
                                       crée les répertoires si besoin
    POST   /api/programmes/<chemin>    {"renomme": "nouveau/chemin"} renomme ou déplace
    DELETE /api/programmes/<chemin>    supprime le programme
    POST   /api/dossiers/<chemin>      crée le répertoire ({}) ou le renomme
                                       ({"renomme": "nouveau/chemin"})
    DELETE /api/dossiers/<chemin>      supprime le répertoire : son contenu remonte
                                       dans le répertoire parent (rien n'est perdu)

Aucune dépendance : seulement la bibliothèque standard de Python.
"""

import argparse
import json
import mimetypes
import re
import shutil
import webbrowser
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

RACINE = Path(__file__).resolve().parent
PROGRAMMES = RACINE / "programmes"
TAILLE_MAX = 1_000_000  # 1 Mo par programme
PROFONDEUR_MAX = 8

# Un nom de programme ou de répertoire : lettres (accents compris), chiffres,
# espace, tiret, souligné, parenthèses et point (mais pas au début)
NOM_VALIDE = re.compile(r"^[\w \-.()]{1,60}$", re.UNICODE)

mimetypes.add_type("application/wasm", ".wasm")
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/plain", ".lisp")
mimetypes.add_type("text/plain", ".py")


def morceaux_valides(chemin):
    """Découpe "Jeux/balle" en ["Jeux", "balle"] ; None si un morceau est invalide."""
    morceaux = [m.strip() for m in chemin.strip().strip("/").split("/")]
    if not morceaux or len(morceaux) > PROFONDEUR_MAX:
        return None
    for m in morceaux:
        if not NOM_VALIDE.match(m) or m.startswith("."):
            return None
    return morceaux


def dans_programmes(chemin):
    """Vérifie que le chemin reste à l'intérieur de programmes/."""
    try:
        chemin.resolve().relative_to(PROGRAMMES.resolve())
        return True
    except ValueError:
        return False


def chemin_programme(chemin):
    """Fichier .py d'un programme, ou None si le chemin est invalide."""
    if chemin.lower().endswith(".py"):
        chemin = chemin[:-3]
    morceaux = morceaux_valides(chemin)
    if not morceaux:
        return None
    fichier = PROGRAMMES.joinpath(*morceaux[:-1], morceaux[-1] + ".py")
    return fichier if dans_programmes(fichier) else None


def chemin_dossier(chemin):
    """Répertoire désigné par le chemin, ou None si le chemin est invalide."""
    morceaux = morceaux_valides(chemin)
    if not morceaux:
        return None
    dossier = PROGRAMMES.joinpath(*morceaux)
    return dossier if dans_programmes(dossier) else None


def relatif(chemin, suffixe=""):
    """Chemin "Jeux/balle" à partir du fichier ou du répertoire."""
    r = chemin.relative_to(PROGRAMMES).as_posix()
    return r[: -len(suffixe)] if suffixe and r.endswith(suffixe) else r


def nom_libre(cible):
    """cible si elle n'existe pas, sinon « nom 2 », « nom 3 »..."""
    if not cible.exists():
        return cible
    base, ext = (cible.stem, cible.suffix) if cible.is_file() or cible.suffix == ".py" else (cible.name, "")
    i = 2
    while True:
        autre = cible.with_name(f"{base} {i}{ext}")
        if not autre.exists():
            return autre
        i += 1


class Gestionnaire(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(RACINE), **kwargs)

    # Pas de cache : l'élève voit toujours la dernière version des fichiers
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, format, *args):
        pass

    # ------------------------------------------------------------------
    def _reponse(self, statut, corps=b"", type_contenu="text/plain; charset=utf-8"):
        if isinstance(corps, str):
            corps = corps.encode("utf-8")
        self.send_response(statut)
        self.send_header("Content-Type", type_contenu)
        self.send_header("Content-Length", str(len(corps)))
        self.end_headers()
        self.wfile.write(corps)

    def _json(self, statut, valeur):
        self._reponse(statut, json.dumps(valeur, ensure_ascii=False), "application/json; charset=utf-8")

    def _corps(self):
        taille = int(self.headers.get("Content-Length") or 0)
        if taille > TAILLE_MAX:
            return None
        return self.rfile.read(taille).decode("utf-8")

    def _demande_json(self):
        try:
            return json.loads(self._corps() or "{}")
        except json.JSONDecodeError:
            return None

    def _route(self):
        """("programmes" | "dossiers" | None, chemin ou None)."""
        chemin = urlparse(self.path).path
        for genre in ("programmes", "dossiers"):
            prefixe = f"/api/{genre}"
            if chemin.rstrip("/") == prefixe:
                return genre, None
            if chemin.startswith(prefixe + "/"):
                return genre, unquote(chemin[len(prefixe) + 1:])
        return None, None

    # ------------------------------------------------------------------
    def do_GET(self):
        genre, chemin = self._route()
        if genre is None:
            return super().do_GET()
        if genre == "programmes" and chemin is None:
            programmes = [
                {"chemin": relatif(f, ".py"), "modifie": f.stat().st_mtime}
                for f in sorted(PROGRAMMES.rglob("*.py"))
                if not any(p.startswith(".") for p in f.relative_to(PROGRAMMES).parts)
            ]
            dossiers = [
                relatif(d) for d in sorted(PROGRAMMES.rglob("*"))
                if d.is_dir() and not any(p.startswith(".") for p in d.relative_to(PROGRAMMES).parts)
            ]
            return self._json(HTTPStatus.OK, {"programmes": programmes, "dossiers": dossiers})
        fichier = chemin_programme(chemin or "") if genre == "programmes" else None
        if not fichier or not fichier.is_file():
            return self._reponse(HTTPStatus.NOT_FOUND, "Programme introuvable")
        return self._reponse(HTTPStatus.OK, fichier.read_text(encoding="utf-8"))

    def do_PUT(self):
        genre, chemin = self._route()
        fichier = chemin_programme(chemin) if genre == "programmes" and chemin else None
        if not fichier:
            return self._reponse(HTTPStatus.BAD_REQUEST, "Nom de programme invalide")
        code = self._corps()
        if code is None:
            return self._reponse(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, "Programme trop long")
        fichier.parent.mkdir(parents=True, exist_ok=True)
        fichier.write_text(code, encoding="utf-8")
        return self._json(HTTPStatus.OK, {"chemin": relatif(fichier, ".py")})

    def do_POST(self):
        genre, chemin = self._route()
        if not chemin:
            return self._reponse(HTTPStatus.BAD_REQUEST, "Chemin manquant")
        demande = self._demande_json()
        if demande is None:
            return self._reponse(HTTPStatus.BAD_REQUEST, "Requête invalide")

        if genre == "programmes":
            fichier = chemin_programme(chemin)
            if not fichier or not fichier.is_file():
                return self._reponse(HTTPStatus.NOT_FOUND, "Programme introuvable")
            cible = chemin_programme(str(demande.get("renomme", "")))
            if not cible:
                return self._reponse(HTTPStatus.BAD_REQUEST, "Nouveau nom invalide")
            if cible.exists():
                return self._reponse(HTTPStatus.CONFLICT, "Ce nom existe déjà")
            cible.parent.mkdir(parents=True, exist_ok=True)
            fichier.rename(cible)
            return self._json(HTTPStatus.OK, {"chemin": relatif(cible, ".py")})

        if genre == "dossiers":
            dossier = chemin_dossier(chemin)
            if not dossier:
                return self._reponse(HTTPStatus.BAD_REQUEST, "Nom de répertoire invalide")
            if "renomme" not in demande:
                dossier.mkdir(parents=True, exist_ok=True)
                return self._json(HTTPStatus.OK, {"chemin": relatif(dossier)})
            if not dossier.is_dir():
                return self._reponse(HTTPStatus.NOT_FOUND, "Répertoire introuvable")
            cible = chemin_dossier(str(demande.get("renomme", "")))
            if not cible:
                return self._reponse(HTTPStatus.BAD_REQUEST, "Nouveau nom invalide")
            if cible.exists():
                return self._reponse(HTTPStatus.CONFLICT, "Ce nom existe déjà")
            if cible.resolve().is_relative_to(dossier.resolve()):
                return self._reponse(HTTPStatus.BAD_REQUEST, "Un répertoire ne peut pas aller dans lui-même")
            cible.parent.mkdir(parents=True, exist_ok=True)
            dossier.rename(cible)
            return self._json(HTTPStatus.OK, {"chemin": relatif(cible)})

        return self._reponse(HTTPStatus.NOT_FOUND, "Inconnu")

    def do_DELETE(self):
        genre, chemin = self._route()
        if genre == "programmes" and chemin:
            fichier = chemin_programme(chemin)
            if not fichier or not fichier.is_file():
                return self._reponse(HTTPStatus.NOT_FOUND, "Programme introuvable")
            fichier.unlink()
            return self._json(HTTPStatus.OK, {"supprime": relatif(fichier, ".py")})
        if genre == "dossiers" and chemin:
            dossier = chemin_dossier(chemin)
            if not dossier or not dossier.is_dir():
                return self._reponse(HTTPStatus.NOT_FOUND, "Répertoire introuvable")
            # Comme dans TamedAgents : le contenu remonte dans le répertoire parent
            for element in sorted(dossier.iterdir()):
                shutil.move(str(element), str(nom_libre(dossier.parent / element.name)))
            dossier.rmdir()
            return self._json(HTTPStatus.OK, {"supprime": relatif(dossier)})
        return self._reponse(HTTPStatus.NOT_FOUND, "Inconnu")


def main():
    parser = argparse.ArgumentParser(description="Serveur local de Pythonerie")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--hote", default="127.0.0.1", help="127.0.0.1 (défaut) ou 0.0.0.0 pour le réseau local")
    parser.add_argument("--sans-navigateur", action="store_true", help="ne pas ouvrir le navigateur")
    args = parser.parse_args()

    PROGRAMMES.mkdir(exist_ok=True)
    serveur = ThreadingHTTPServer((args.hote, args.port), Gestionnaire)
    adresse = f"http://{'localhost' if args.hote in ('127.0.0.1', '0.0.0.0') else args.hote}:{args.port}/"
    print(f"Pythonerie : {adresse}")
    print(f"Programmes conservés dans : {PROGRAMMES}")
    print("Ctrl+C pour arrêter.")
    if not args.sans_navigateur:
        webbrowser.open(adresse)
    try:
        serveur.serve_forever()
    except KeyboardInterrupt:
        print("\nAu revoir !")


if __name__ == "__main__":
    main()
