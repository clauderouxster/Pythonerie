#!/usr/bin/env python3
"""Serveur local de Pythonerie.

Sert l'application (répertoire docs/, le même que celui publié par GitHub Pages)
et conserve une copie des projets exportés par les élèves dans le répertoire projets/.

    python3 serveur.py                         # http://localhost:8000
    python3 serveur.py --port 8080
    python3 serveur.py --hôte 0.0.0.0          # pour les postes d'une salle de classe
    python3 serveur.py --projets /un/dossier   # où ranger les projets des élèves

Les projets des élèves restent dans leur navigateur. Quand un élève exporte son projet,
il est téléchargé sur son poste et une copie est envoyée ici. Le serveur ne remplace
ni ne supprime jamais un projet : seul l'enseignant décide de ce qu'il en fait, en
gérant lui-même le répertoire.

Le serveur n'exécute aucun programme : la traduction en LispE et l'exécution se font
dans le navigateur de chaque élève.

API :
    GET    /api/projets           {"projets": true} : indique que le serveur garde les projets
                                  (la liste des projets n'est jamais donnée aux élèves)
    POST   /api/projets/<nom>     enregistre le projet (corps = le fichier .zip du projet)
                                  sous <nom>.zip, ou <nom>_2.zip... si le nom existe déjà

Aucune dépendance : seulement la bibliothèque standard de Python.
"""

import argparse
import io
import json
import mimetypes
import re
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import zipfile
from urllib.parse import unquote, urlparse
import webbrowser

RACINE = Path(__file__).resolve().parent
SITE = RACINE / "docs"            # l'application, publiée telle quelle par GitHub Pages
PROJETS = RACINE / "projets"      # peut être changé avec --projets
TAILLE_MAX = 100_000_000          # 100 Mo par projet (il peut contenir des images et des sons)
FORMAT_PROJET = "projet-pythonerie"

# Un nom de projet : nom_du_projet[_élève]_aaaa_mm_jj_hh_MM (lettres accentuées comprises)
NOM_VALIDE = re.compile(r"^[\w\-]{1,100}$", re.UNICODE)

mimetypes.add_type("application/wasm", ".wasm")
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/plain", ".lisp")
mimetypes.add_type("text/plain", ".py")
mimetypes.add_type("text/plain", ".pyf")   # les programmes de la Pythonerie


def est_un_projet(contenu):
    """Vrai si les octets reçus sont le .zip d'un projet : un projet.json au bon format."""
    try:
        with zipfile.ZipFile(io.BytesIO(contenu)) as archive:
            fiche = json.loads(archive.read("projet.json").decode("utf-8"))
    except (zipfile.BadZipFile, KeyError, UnicodeDecodeError, json.JSONDecodeError, OSError):
        return False
    return isinstance(fiche, dict) and fiche.get("format") == FORMAT_PROJET


def enregistre(nom, contenu):
    """Écrit le projet sans jamais écraser un fichier existant ; renvoie le nom choisi."""
    i = 1
    while True:
        fichier = PROJETS / (f"{nom}.zip" if i == 1 else f"{nom}_{i}.zip")
        try:
            # "x" : création exclusive, même si deux élèves envoient le même nom en même temps
            with open(fichier, "xb") as f:
                f.write(contenu)
            return fichier.name
        except FileExistsError:
            i += 1


class Gestionnaire(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(SITE), **kwargs)

    # Pas de cache : l'élève voit toujours la dernière version des fichiers
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, format, *args):
        pass

    # ------------------------------------------------------------------
    def _réponse(self, statut, corps=b"", type_contenu="text/plain; charset=utf-8"):
        if isinstance(corps, str):
            corps = corps.encode("utf-8")
        self.send_response(statut)
        self.send_header("Content-Type", type_contenu)
        self.send_header("Content-Length", str(len(corps)))
        self.end_headers()
        self.wfile.write(corps)

    def _json(self, statut, valeur):
        self._réponse(statut, json.dumps(valeur, ensure_ascii=False), "application/json; charset=utf-8")

    def _route(self):
        """(True, nom ou None) pour /api/projets[/nom], (False, None) sinon."""
        chemin = urlparse(self.path).path
        if chemin.rstrip("/") == "/api/projets":
            return True, None
        if chemin.startswith("/api/projets/"):
            return True, unquote(chemin[len("/api/projets/"):])
        return chemin.startswith("/api/"), None

    # ------------------------------------------------------------------
    def do_GET(self):
        api, nom = self._route()
        if not api:
            return super().do_GET()
        if nom is None and urlparse(self.path).path.rstrip("/") == "/api/projets":
            return self._json(HTTPStatus.OK, {"projets": True})
        return self._réponse(HTTPStatus.NOT_FOUND, "Inconnu")

    def do_POST(self):
        api, nom = self._route()
        if not api or not nom:
            return self._réponse(HTTPStatus.NOT_FOUND, "Inconnu")
        if nom.lower().endswith(".zip"):
            nom = nom[:-4]
        if not NOM_VALIDE.match(nom):
            return self._réponse(HTTPStatus.BAD_REQUEST, "Nom de projet invalide")
        taille = int(self.headers.get("Content-Length") or 0)
        if taille > TAILLE_MAX:
            return self._réponse(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, "Projet trop gros")
        contenu = self.rfile.read(taille)
        if not est_un_projet(contenu):
            return self._réponse(HTTPStatus.BAD_REQUEST, "Ce n'est pas un projet de la Pythonerie")
        return self._json(HTTPStatus.OK, {"nom": enregistre(nom, contenu)})

    # Rien ne se remplace ni ne s'efface depuis le navigateur
    def do_PUT(self):
        self._réponse(HTTPStatus.METHOD_NOT_ALLOWED, "Interdit")

    def do_DELETE(self):
        self._réponse(HTTPStatus.METHOD_NOT_ALLOWED, "Interdit")


def main():
    global PROJETS
    parser = argparse.ArgumentParser(description="Serveur local de Pythonerie")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--hôte", default="127.0.0.1", help="127.0.0.1 (défaut) ou 0.0.0.0 pour le réseau local")
    parser.add_argument("--projets", default=str(PROJETS), help="répertoire où ranger les projets des élèves")
    parser.add_argument("--sans-navigateur", action="store_true", help="ne pas ouvrir le navigateur")
    args = parser.parse_args()

    PROJETS = Path(args.projets).expanduser().resolve()
    PROJETS.mkdir(parents=True, exist_ok=True)
    serveur = ThreadingHTTPServer((args.hôte, args.port), Gestionnaire)
    adresse = f"http://{'localhost' if args.hôte in ('127.0.0.1', '0.0.0.0') else args.hôte}:{args.port}/"
    print(f"Pythonerie : {adresse}")
    print(f"Projets des élèves conservés dans : {PROJETS}")
    print("Ctrl+C pour arrêter.")
    if not args.sans_navigateur:
        webbrowser.open(adresse)
    try:
        serveur.serve_forever()
    except KeyboardInterrupt:
        print("\nAu revoir !")


if __name__ == "__main__":
    main()
