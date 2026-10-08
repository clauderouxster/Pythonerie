#!/usr/bin/env python3
"""Serveur local de Pythonerie.

Sert l'application (répertoire docs/, le même que celui publié par GitHub Pages)
et conserve une copie des archives créées par les élèves dans le répertoire archives/.

    python3 serveur.py                         # http://localhost:8000
    python3 serveur.py --port 8080
    python3 serveur.py --hôte 0.0.0.0          # pour les postes d'une salle de classe
    python3 serveur.py --archives /un/dossier  # où ranger les archives

Les programmes des élèves restent dans leur navigateur. Quand un élève crée une archive,
elle est téléchargée sur son poste et une copie est envoyée ici. Le serveur ne remplace
ni ne supprime jamais une archive : seul l'enseignant décide de ce qu'il en fait, en
gérant lui-même le répertoire.

Le serveur n'exécute aucun programme : la traduction en LispE et l'exécution se font
dans le navigateur de chaque élève.

API :
    GET    /api/archives          {"archives": true} : indique que le serveur garde les archives
                                  (la liste des archives n'est jamais donnée aux élèves)
    POST   /api/archives/<nom>    enregistre l'archive (corps = JSON de l'archive) sous
                                  <nom>.json, ou <nom>_2.json... si le nom existe déjà

Aucune dépendance : seulement la bibliothèque standard de Python.
"""

import argparse
import json
import mimetypes
import re
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse
import webbrowser

RACINE = Path(__file__).resolve().parent
SITE = RACINE / "docs"            # l'application, publiée telle quelle par GitHub Pages
ARCHIVES = RACINE / "archives"    # peut être changé avec --archives
TAILLE_MAX = 20_000_000           # 20 Mo par archive
FORMAT_ARCHIVE = "archive-pythonerie"

# Un nom d'archive : identifiant_aaaa_mm_jj_hh_MM (lettres accentuées comprises)
NOM_VALIDE = re.compile(r"^[\w\-]{1,100}$", re.UNICODE)

mimetypes.add_type("application/wasm", ".wasm")
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/plain", ".lisp")
mimetypes.add_type("text/plain", ".py")


def enregistre(nom, contenu):
    """Écrit l'archive sans jamais écraser un fichier existant ; renvoie le nom choisi."""
    i = 1
    while True:
        fichier = ARCHIVES / (f"{nom}.json" if i == 1 else f"{nom}_{i}.json")
        try:
            # "x" : création exclusive, même si deux élèves envoient le même nom en même temps
            with open(fichier, "x", encoding="utf-8") as f:
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
        """(True, nom ou None) pour /api/archives[/nom], (False, None) sinon."""
        chemin = urlparse(self.path).path
        if chemin.rstrip("/") == "/api/archives":
            return True, None
        if chemin.startswith("/api/archives/"):
            return True, unquote(chemin[len("/api/archives/"):])
        return chemin.startswith("/api/"), None

    # ------------------------------------------------------------------
    def do_GET(self):
        api, nom = self._route()
        if not api:
            return super().do_GET()
        if nom is None and urlparse(self.path).path.rstrip("/") == "/api/archives":
            return self._json(HTTPStatus.OK, {"archives": True})
        return self._réponse(HTTPStatus.NOT_FOUND, "Inconnu")

    def do_POST(self):
        api, nom = self._route()
        if not api or not nom:
            return self._réponse(HTTPStatus.NOT_FOUND, "Inconnu")
        if nom.lower().endswith(".json"):
            nom = nom[:-5]
        if not NOM_VALIDE.match(nom):
            return self._réponse(HTTPStatus.BAD_REQUEST, "Nom d'archive invalide")
        taille = int(self.headers.get("Content-Length") or 0)
        if taille > TAILLE_MAX:
            return self._réponse(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, "Archive trop grosse")
        try:
            contenu = self.rfile.read(taille).decode("utf-8")
            archive = json.loads(contenu)
        except (UnicodeDecodeError, json.JSONDecodeError):
            return self._réponse(HTTPStatus.BAD_REQUEST, "Ce n'est pas une archive de la Pythonerie")
        if not isinstance(archive, dict) or archive.get("format") != FORMAT_ARCHIVE:
            return self._réponse(HTTPStatus.BAD_REQUEST, "Ce n'est pas une archive de la Pythonerie")
        return self._json(HTTPStatus.OK, {"nom": enregistre(nom, contenu)})

    # Rien ne se remplace ni ne s'efface depuis le navigateur
    def do_PUT(self):
        self._réponse(HTTPStatus.METHOD_NOT_ALLOWED, "Interdit")

    def do_DELETE(self):
        self._réponse(HTTPStatus.METHOD_NOT_ALLOWED, "Interdit")


def main():
    global ARCHIVES
    parser = argparse.ArgumentParser(description="Serveur local de Pythonerie")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--hôte", default="127.0.0.1", help="127.0.0.1 (défaut) ou 0.0.0.0 pour le réseau local")
    parser.add_argument("--archives", default=str(ARCHIVES), help="répertoire où ranger les archives des élèves")
    parser.add_argument("--sans-navigateur", action="store_true", help="ne pas ouvrir le navigateur")
    args = parser.parse_args()

    ARCHIVES = Path(args.archives).expanduser().resolve()
    ARCHIVES.mkdir(parents=True, exist_ok=True)
    serveur = ThreadingHTTPServer((args.hôte, args.port), Gestionnaire)
    adresse = f"http://{'localhost' if args.hôte in ('127.0.0.1', '0.0.0.0') else args.hôte}:{args.port}/"
    print(f"Pythonerie : {adresse}")
    print(f"Archives des élèves conservées dans : {ARCHIVES}")
    print("Ctrl+C pour arrêter.")
    if not args.sans_navigateur:
        webbrowser.open(adresse)
    try:
        serveur.serve_forever()
    except KeyboardInterrupt:
        print("\nAu revoir !")


if __name__ == "__main__":
    main()
