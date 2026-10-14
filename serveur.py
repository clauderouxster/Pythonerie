#!/usr/bin/env python3
"""Serveur local de Pythonerie.

Sert l'application (répertoire docs/, le même que celui publié par GitHub Pages) sur
deux ports :

- le port des élèves (8000) : la Pythonerie, la copie des projets exportés (projets/),
  et l'écriture de données pour un professeur (sauve_dans_serveur) ;
- le port administrateur (8001), ouvert par défaut sur cette machine seulement : la même
  Pythonerie, en mode administrateur. Un professeur y crée son compte, s'y connecte, et ses
  programmes y lisent ce que les élèves lui ont envoyé (liste_dans_serveur, lit_dans_serveur).

    python3 serveur.py                         # élèves : http://localhost:8000, administrateur : http://localhost:8001
    python3 serveur.py --hôte 0.0.0.0          # les postes de la salle joignent le port des élèves
    python3 serveur.py --port 8080 --port-admin 8081
    python3 serveur.py --hôte-admin 0.0.0.0    # le mode administrateur, depuis une autre machine aussi
    python3 serveur.py --projets /un/dossier   # où ranger les projets des élèves
    python3 serveur.py --données /un/dossier   # où ranger les comptes et les données des professeurs
    python3 serveur.py --professeur dupont     # le mode classe : seuls les élèves de la liste de dupont
                                               # (élèves.json) se connectent (le mot de passe est demandé)

Les projets des élèves restent dans leur navigateur. Quand un élève exporte son projet,
il est téléchargé sur son poste et une copie est envoyée ici. Le serveur ne remplace
ni ne supprime jamais un projet, ni un fichier envoyé à un professeur : quand un élève
renvoie le même fichier, la version précédente est gardée à côté.

Le serveur n'exécute aucun programme : la traduction en LispE et l'exécution se font
dans le navigateur de chaque élève, et dans celui du professeur.

Les comptes des professeurs sont dans <données>/comptes.json : le mot de passe n'y est
jamais écrit, seulement son empreinte (scrypt, avec un sel propre à chaque compte).
Chaque professeur a son répertoire, <données>/professeurs/<identifiant>/, où les élèves
écrivent sans pouvoir lire, et son index.json, mis à jour à chaque écriture :
    [{"chemin", "élève", "nom", "date", "taille", "actuel"}, ...]
Sa liste d'élèves, élèves.json, [{"identifiant", "nom"}, ...], s'écrit depuis le mode
administrateur (le programme « Ma classe » des Matériels). Lancé avec --professeur, le serveur
est en mode classe : un élève se connecte avec son identifiant (donné par l'école), qui doit
être dans cette liste ; ses envois portent alors son identifiant et son nom vérifiés, et ne
peuvent aller qu'à ce professeur.

API, sur les deux ports :
    GET    /api/serveur           {"serveur": true, "admin": faux ou vrai}
    GET    /api/projets           {"projets": true} : indique que le serveur garde les projets
                                  (la liste des projets n'est jamais donnée aux élèves)
    POST   /api/projets/<nom>     enregistre le projet (corps = le fichier .zip du projet)
                                  sous <nom>.zip, ou <nom>_2.zip... si le nom existe déjà
    POST   /api/serveur/sauve     {"professeur", "chemin", "élève", "contenu"} : écrit le fichier
                                  chemin dans le répertoire du professeur (en mode classe :
                                  l'en-tête X-Pythonerie-Eleve donne l'élève vérifié)
    POST   /api/élève/connexion   {"identifiant"} : en mode classe -> {"jeton", "identifiant", "nom"}
    GET    /api/élève/moi         {"identifiant", "nom"} (en-tête X-Pythonerie-Eleve)
API, sur le port administrateur seulement (en-tête X-Pythonerie-Jeton, sauf pour se connecter) :
    POST   /api/admin/compte      {"identifiant", "mot_de_passe"} : crée le compte -> {"jeton"}
    POST   /api/admin/connexion   {"identifiant", "mot_de_passe"} -> {"jeton"}
    POST   /api/admin/déconnexion
    GET    /api/admin/moi         {"identifiant"}
    GET    /api/admin/liste?chemin=contrôle1      les entrées de l'index sous ce répertoire
    GET    /api/admin/lit?chemin=contrôle1/a.json {"contenu"} : le texte du fichier
    POST   /api/admin/élèves      {"élèves": [{"identifiant", "nom"}, ...]} : écrit élèves.json

Aucune dépendance : seulement la bibliothèque standard de Python.
"""

import argparse
import getpass
import hashlib
import sys
import hmac
import io
import json
import mimetypes
import os
import re
import secrets
import threading
import time
import unicodedata
from datetime import datetime
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import zipfile
from urllib.parse import parse_qs, unquote, urlparse
import webbrowser

RACINE = Path(__file__).resolve().parent
SITE = RACINE / "docs"            # l'application, publiée telle quelle par GitHub Pages
PROJETS = RACINE / "projets"      # peut être changé avec --projets
DONNÉES = RACINE / "serveur"      # comptes et répertoires des professeurs (--données)
TAILLE_MAX = 100_000_000          # 100 Mo par projet (il peut contenir des images et des sons)
TAILLE_FICHIER_MAX = 5_000_000    # 5 Mo par fichier envoyé à un professeur
DURÉE_SESSION = 12 * 3600         # une connexion (administrateur ou élève) dure 12 heures
CLASSE = None                     # en mode classe (--professeur) : l'identifiant du professeur
FICHIERS_RÉSERVÉS = {"index.json", "élèves.json"}   # à la racine du répertoire d'un professeur
FORMAT_PROJET = "projet-pythonerie"
EXTENSIONS = {".txt", ".json", ".csv", ".tsv", ".md"}

# Un nom de projet : nom_du_projet[_élève]_aaaa_mm_jj_hh_MM (lettres accentuées comprises)
NOM_VALIDE = re.compile(r"^[\w\-]{1,100}$", re.UNICODE)
# L'identifiant d'un professeur, qui est aussi le nom de son répertoire
IDENTIFIANT_VALIDE = re.compile(r"^[\w\-]{1,40}$", re.UNICODE)
# Un morceau de chemin : lettres, chiffres, espace, - _ . ( ) ; pas de « .. », pas de « / »
MORCEAU_VALIDE = re.compile(r"^[\w\- .()]{1,80}$", re.UNICODE)

mimetypes.add_type("application/wasm", ".wasm")
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/plain", ".lisp")
mimetypes.add_type("text/plain", ".py")
mimetypes.add_type("text/plain", ".pyf")   # les programmes de la Pythonerie

verrou = threading.Lock()         # les écritures (comptes, index) se font une par une
sessions = {}                     # jeton -> (identifiant, expiration) : les professeurs
sessions_élèves = {}              # jeton -> (identifiant, nom, expiration) : les élèves, en mode classe
# (les noms d'en-têtes HTTP n'acceptent que l'ASCII : X-Pythonerie-Eleve, sans accent)


def nfc(texte):
    return unicodedata.normalize("NFC", str(texte))


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


# ----------------------------------------------------------------------
# Lecture et écriture d'un fichier JSON du serveur (écriture atomique)
# ----------------------------------------------------------------------
def lit_json(fichier, défaut):
    try:
        return json.loads(fichier.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return défaut


def écrit_json(fichier, valeur):
    fichier.parent.mkdir(parents=True, exist_ok=True)
    provisoire = fichier.with_name(fichier.name + ".tmp")
    provisoire.write_text(json.dumps(valeur, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    os.replace(provisoire, fichier)


# ----------------------------------------------------------------------
# Comptes des professeurs
# ----------------------------------------------------------------------
def fichier_comptes():
    return DONNÉES / "comptes.json"


def empreinte(mot_de_passe, sel):
    return hashlib.scrypt(mot_de_passe.encode("utf-8"), salt=sel, n=2 ** 14, r=8, p=1, dklen=32).hex()


def crée_compte(identifiant, mot_de_passe):
    """None si le compte est créé, sinon le message d'erreur."""
    if not IDENTIFIANT_VALIDE.match(identifiant):
        return "identifiant invalide : des lettres, des chiffres, - ou _ (40 au plus)"
    if len(mot_de_passe) < 6:
        return "le mot de passe doit avoir au moins 6 caractères"
    with verrou:
        comptes = lit_json(fichier_comptes(), {})
        if identifiant in comptes:
            return f"le compte « {identifiant} » existe déjà"
        sel = secrets.token_bytes(16)
        comptes[identifiant] = {"sel": sel.hex(), "empreinte": empreinte(mot_de_passe, sel),
                                "créé": datetime.now().isoformat(timespec="seconds")}
        écrit_json(fichier_comptes(), comptes)
        (DONNÉES / "professeurs" / identifiant).mkdir(parents=True, exist_ok=True)
    return None


def vérifie_compte(identifiant, mot_de_passe):
    compte = lit_json(fichier_comptes(), {}).get(identifiant)
    if not compte:
        return False
    return hmac.compare_digest(compte["empreinte"], empreinte(mot_de_passe, bytes.fromhex(compte["sel"])))


def professeur_existe(identifiant):
    return IDENTIFIANT_VALIDE.match(identifiant) is not None and identifiant in lit_json(fichier_comptes(), {})


def nouvelle_session(identifiant):
    jeton = secrets.token_urlsafe(32)
    with verrou:
        maintenant = time.time()
        for j in [j for j, (_, fin) in sessions.items() if fin < maintenant]:
            del sessions[j]
        sessions[jeton] = (identifiant, maintenant + DURÉE_SESSION)
    return jeton


def session(jeton):
    """L'identifiant du professeur connecté avec ce jeton, ou None."""
    entrée = sessions.get(jeton or "")
    if not entrée or entrée[1] < time.time():
        return None
    return entrée[0]


def liste_des_élèves(identifiant):
    liste = lit_json(répertoire_de(identifiant) / "élèves.json", [])
    return liste if isinstance(liste, list) else []


def connecte_élève(identifiant):
    """(jeton, identifiant, nom) si cet identifiant est dans la liste de la classe, sinon None.
    Les majuscules et les espaces autour ne comptent pas."""
    cherché = nfc(identifiant).strip().casefold()
    for e in liste_des_élèves(CLASSE):
        if isinstance(e, dict) and nfc(e.get("identifiant", "")).strip().casefold() == cherché and cherché:
            jeton = secrets.token_urlsafe(32)
            with verrou:
                maintenant = time.time()
                for j in [j for j, v in sessions_élèves.items() if v[2] < maintenant]:
                    del sessions_élèves[j]
                sessions_élèves[jeton] = (e["identifiant"], e.get("nom", ""), maintenant + DURÉE_SESSION)
            return jeton, e["identifiant"], e.get("nom", "")
    return None


def session_élève(jeton):
    """(identifiant, nom) de l'élève connecté avec ce jeton, ou None."""
    entrée = sessions_élèves.get(jeton or "")
    if not entrée or entrée[2] < time.time():
        return None
    return entrée[0], entrée[1]


def valide_élèves(liste):
    """(la liste nettoyée, None) ou (None, le message d'erreur)."""
    if not isinstance(liste, list) or len(liste) > 2000:
        return None, "la liste des élèves doit être une liste (2000 élèves au plus)"
    propre, vus = [], set()
    for k, e in enumerate(liste, 1):
        if not isinstance(e, dict):
            return None, f"ligne {k} : un élève est un dictionnaire {{\"identifiant\", \"nom\"}}"
        identifiant = nfc(e.get("identifiant", "")).strip()
        nom = nfc(e.get("nom", "")).strip()
        if not identifiant or len(identifiant) > 60:
            return None, f"ligne {k} ({nom or 'sans nom'}) : il manque l'identifiant (60 caractères au plus)"
        if len(nom) > 100:
            return None, f"ligne {k} : le nom est trop long (100 caractères au plus)"
        if identifiant.casefold() in vus:
            return None, f"ligne {k} : l'identifiant « {identifiant} » est déjà dans la liste"
        vus.add(identifiant.casefold())
        propre.append({"identifiant": identifiant, "nom": nom})
    return propre, None


# ----------------------------------------------------------------------
# Les répertoires des professeurs
# ----------------------------------------------------------------------
def chemin_valide(chemin, fichier=True, lecture=False):
    """Le chemin relatif nettoyé (« contrôle1/réponses.json »), ou None s'il est refusé.
    Un fichier sans extension reçoit .txt ; seules les extensions de données sont acceptées.
    À la racine, index.json ne se lit ni ne s'écrit (liste_dans_serveur le donne), et
    élèves.json ne s'écrit qu'avec sauve_élèves (lecture : on peut le lire)."""
    morceaux = [m.strip() for m in nfc(chemin).replace("\\", "/").split("/") if m.strip()]
    if not morceaux and not fichier:
        return ""
    if not morceaux or len(morceaux) > 8:
        return None
    if any(not MORCEAU_VALIDE.match(m) or m.startswith(".") for m in morceaux):
        return None
    if fichier:
        nom = morceaux[-1]
        if "." not in nom:
            morceaux[-1] = nom + ".txt"
        if Path(morceaux[-1]).suffix.lower() not in EXTENSIONS:
            return None
        if len(morceaux) == 1 and morceaux[0] in FICHIERS_RÉSERVÉS:
            if not (lecture and morceaux[0] == "élèves.json"):
                return None
    return "/".join(morceaux)


def répertoire_de(identifiant):
    return DONNÉES / "professeurs" / identifiant


def sauve_pour_professeur(identifiant, chemin, élève, contenu, nom=""):
    """Écrit le fichier ; la version précédente (s'il y en a une) est gardée à côté,
    sous son nom suivi de sa date. Renvoie le chemin écrit."""
    racine = répertoire_de(identifiant)
    cible = racine / chemin
    maintenant = datetime.now()
    with verrou:
        index = lit_json(racine / "index.json", [])
        if cible.exists():
            # la version précédente prend le nom de sa date : réponses_2026-10-13_10-42-05.json
            ancienne = next((e for e in reversed(index) if e.get("chemin") == chemin and e.get("actuel")), None)
            date = (ancienne or {}).get("date") or datetime.fromtimestamp(cible.stat().st_mtime).isoformat(timespec="seconds")
            base = date.replace("T", "_").replace(":", "-")
            versionné = cible.with_name(f"{cible.stem}_{base}{cible.suffix}")
            k = 2
            while versionné.exists():
                versionné = cible.with_name(f"{cible.stem}_{base}_{k}{cible.suffix}")
                k += 1
            os.replace(cible, versionné)
            if ancienne:
                ancienne["chemin"] = versionné.relative_to(racine).as_posix()
                ancienne["actuel"] = False
        cible.parent.mkdir(parents=True, exist_ok=True)
        cible.write_text(contenu, encoding="utf-8")
        index.append({"chemin": chemin, "élève": élève or "inconnu", "nom": nom, "date": maintenant.isoformat(timespec="seconds"),
                      "taille": len(contenu.encode("utf-8")), "actuel": True})
        écrit_json(racine / "index.json", index)
    return chemin


# ----------------------------------------------------------------------
class Gestionnaire(SimpleHTTPRequestHandler):
    admin = False                 # Vrai pour le port administrateur

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

    def _erreur(self, statut, message):
        self._json(statut, {"erreur": message})

    def _chemin(self):
        return nfc(unquote(urlparse(self.path).path)).rstrip("/")

    def _corps_json(self, taille_max):
        taille = int(self.headers.get("Content-Length") or 0)
        if taille > taille_max:
            return None, "trop gros"
        try:
            valeur = json.loads(self.rfile.read(taille).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return None, "requête invalide"
        return (valeur, None) if isinstance(valeur, dict) else (None, "requête invalide")

    def _professeur_connecté(self):
        return session(self.headers.get("X-Pythonerie-Jeton"))

    # ------------------------------------------------------------------
    def do_GET(self):
        chemin = self._chemin()
        if not chemin.startswith("/api/"):
            return super().do_GET()
        if chemin == "/api/serveur":
            return self._json(HTTPStatus.OK, {"serveur": True, "admin": self.admin, "classe": CLASSE})
        if chemin == "/api/élève/moi":
            élève = session_élève(self.headers.get("X-Pythonerie-Eleve"))
            if not élève:
                return self._erreur(HTTPStatus.UNAUTHORIZED, "pas d'élève connecté")
            return self._json(HTTPStatus.OK, {"identifiant": élève[0], "nom": élève[1]})
        if chemin == "/api/projets":
            return self._json(HTTPStatus.OK, {"projets": True})
        if chemin.startswith("/api/admin/"):
            return self._get_admin(chemin[len("/api/admin/"):])
        return self._réponse(HTTPStatus.NOT_FOUND, "Inconnu")

    def do_POST(self):
        chemin = self._chemin()
        if chemin.startswith("/api/projets/"):
            return self._post_projet(chemin[len("/api/projets/"):])
        if chemin == "/api/serveur/sauve":
            return self._post_sauve()
        if chemin == "/api/élève/connexion":
            return self._post_connexion_élève()
        if chemin.startswith("/api/admin/"):
            return self._post_admin(chemin[len("/api/admin/"):])
        return self._réponse(HTTPStatus.NOT_FOUND, "Inconnu")

    # Rien ne se remplace ni ne s'efface depuis le navigateur
    def do_PUT(self):
        self._réponse(HTTPStatus.METHOD_NOT_ALLOWED, "Interdit")

    def do_DELETE(self):
        self._réponse(HTTPStatus.METHOD_NOT_ALLOWED, "Interdit")

    # ------------------------------------------------------------------
    def _post_projet(self, nom):
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

    # sauve_dans_serveur : un élève (ou un professeur) écrit, sans jamais pouvoir relire
    def _post_sauve(self):
        corps, erreur = self._corps_json(TAILLE_FICHIER_MAX * 2)
        if erreur:
            return self._erreur(HTTPStatus.BAD_REQUEST, erreur)
        professeur = nfc(corps.get("professeur", "")).strip()
        élève = nfc(corps.get("élève", "")).strip()[:60]
        nom = ""
        if CLASSE:
            # en mode classe : seulement le professeur de la classe, et un élève vérifié
            # (ou le professeur lui-même, connecté au mode administrateur)
            if professeur != CLASSE:
                return self._erreur(HTTPStatus.FORBIDDEN, f"le serveur est en mode classe : seul « {CLASSE} » reçoit des données")
            vérifié = session_élève(self.headers.get("X-Pythonerie-Eleve"))
            if vérifié:
                élève, nom = vérifié
            elif self.admin and self._professeur_connecté() == CLASSE:
                élève, nom = CLASSE, "(le professeur)"
            else:
                return self._erreur(HTTPStatus.UNAUTHORIZED, "connecte-toi d'abord avec ton identifiant (👤)")
        if not professeur_existe(professeur):
            return self._erreur(HTTPStatus.NOT_FOUND, f"il n'y a pas de professeur « {professeur} » sur ce serveur")
        chemin = chemin_valide(corps.get("chemin", ""))
        if chemin is None and chemin_valide(corps.get("chemin", ""), lecture=True) is not None or \
                nfc(corps.get("chemin", "")).strip().strip("/") in FICHIERS_RÉSERVÉS:
            return self._erreur(HTTPStatus.FORBIDDEN, "index.json et élèves.json sont réservés au serveur et au professeur")
        if chemin is None:
            return self._erreur(HTTPStatus.BAD_REQUEST, "chemin invalide : des répertoires et un nom de fichier "
                                "(.txt, .json, .csv, .tsv ou .md), sans « .. »")
        contenu = corps.get("contenu", "")
        if not isinstance(contenu, str):
            contenu = json.dumps(contenu, ensure_ascii=False)
        if len(contenu.encode("utf-8")) > TAILLE_FICHIER_MAX:
            return self._erreur(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, "fichier trop gros (5 Mo au plus)")
        return self._json(HTTPStatus.OK, {"chemin": sauve_pour_professeur(professeur, chemin, élève, nfc(contenu), nom)})

    def _post_connexion_élève(self):
        if not CLASSE:
            return self._erreur(HTTPStatus.BAD_REQUEST, "le serveur n'est pas en mode classe")
        corps, erreur = self._corps_json(10_000)
        if erreur:
            return self._erreur(HTTPStatus.BAD_REQUEST, erreur)
        résultat = connecte_élève(corps.get("identifiant", ""))
        if not résultat:
            time.sleep(0.5)             # ralentit les essais d'identifiants au hasard
            return self._erreur(HTTPStatus.FORBIDDEN, "cet identifiant n'est pas dans la liste de la classe")
        jeton, identifiant, nom = résultat
        return self._json(HTTPStatus.OK, {"jeton": jeton, "identifiant": identifiant, "nom": nom})

    # ------------------------------------------------------------------
    # Le mode administrateur : seulement sur le port administrateur
    def _post_admin(self, action):
        if not self.admin:
            return self._erreur(HTTPStatus.FORBIDDEN, "réservé au mode administrateur")
        if action in ("compte", "connexion"):
            corps, erreur = self._corps_json(10_000)
            if erreur:
                return self._erreur(HTTPStatus.BAD_REQUEST, erreur)
            identifiant = nfc(corps.get("identifiant", "")).strip()
            mot_de_passe = str(corps.get("mot_de_passe", ""))
            if action == "compte":
                erreur = crée_compte(identifiant, mot_de_passe)
                if erreur:
                    return self._erreur(HTTPStatus.BAD_REQUEST, erreur)
            elif not vérifie_compte(identifiant, mot_de_passe):
                time.sleep(0.5)         # ralentit les essais de mots de passe
                return self._erreur(HTTPStatus.FORBIDDEN, "identifiant ou mot de passe incorrect")
            return self._json(HTTPStatus.OK, {"jeton": nouvelle_session(identifiant), "identifiant": identifiant})
        if action == "déconnexion":
            with verrou:
                sessions.pop(self.headers.get("X-Pythonerie-Jeton") or "", None)
            return self._json(HTTPStatus.OK, {})
        if action == "élèves":
            identifiant = self._professeur_connecté()
            if not identifiant:
                return self._erreur(HTTPStatus.UNAUTHORIZED, "connecte-toi d'abord au mode administrateur")
            corps, erreur = self._corps_json(1_000_000)
            if erreur:
                return self._erreur(HTTPStatus.BAD_REQUEST, erreur)
            liste, erreur = valide_élèves(corps.get("élèves"))
            if erreur:
                return self._erreur(HTTPStatus.BAD_REQUEST, erreur)
            with verrou:
                écrit_json(répertoire_de(identifiant) / "élèves.json", liste)
            return self._json(HTTPStatus.OK, {"nombre": len(liste)})
        return self._réponse(HTTPStatus.NOT_FOUND, "Inconnu")

    def _get_admin(self, action):
        if not self.admin:
            return self._erreur(HTTPStatus.FORBIDDEN, "réservé au mode administrateur")
        identifiant = self._professeur_connecté()
        if not identifiant:
            return self._erreur(HTTPStatus.UNAUTHORIZED, "connecte-toi d'abord au mode administrateur")
        if action == "moi":
            return self._json(HTTPStatus.OK, {"identifiant": identifiant})
        demande = parse_qs(urlparse(self.path).query)
        racine = répertoire_de(identifiant)
        if action == "liste":
            préfixe = chemin_valide((demande.get("chemin") or [""])[0], fichier=False)
            if préfixe is None:
                return self._erreur(HTTPStatus.BAD_REQUEST, "chemin invalide")
            index = lit_json(racine / "index.json", [])
            entrées = [e for e in index if not préfixe or e.get("chemin", "").startswith(préfixe + "/")]
            return self._json(HTTPStatus.OK, {"entrées": entrées})
        if action == "lit":
            chemin = chemin_valide((demande.get("chemin") or [""])[0], lecture=True)
            fichier = (racine / chemin) if chemin else None
            if chemin == "élèves.json" and not fichier.is_file():
                return self._json(HTTPStatus.OK, {"contenu": "[]"})      # pas encore de liste
            if not fichier or not fichier.is_file():
                return self._erreur(HTTPStatus.NOT_FOUND, "fichier introuvable : « " + (demande.get("chemin") or [""])[0] + " »")
            return self._json(HTTPStatus.OK, {"contenu": fichier.read_text(encoding="utf-8")})
        return self._réponse(HTTPStatus.NOT_FOUND, "Inconnu")


class GestionnaireAdmin(Gestionnaire):
    admin = True


def adresse_de(hôte, port):
    return f"http://{'localhost' if hôte in ('127.0.0.1', '0.0.0.0') else hôte}:{port}/"


def main():
    global PROJETS, DONNÉES, CLASSE
    parser = argparse.ArgumentParser(description="Serveur local de Pythonerie")
    parser.add_argument("--port", type=int, default=8000, help="le port des élèves (8000)")
    parser.add_argument("--hôte", default="127.0.0.1", help="127.0.0.1 (défaut) ou 0.0.0.0 pour le réseau local")
    parser.add_argument("--port-admin", type=int, default=8001, help="le port du mode administrateur (8001)")
    parser.add_argument("--hôte-admin", default="127.0.0.1",
                        help="127.0.0.1 (défaut : cette machine seulement) ou 0.0.0.0")
    parser.add_argument("--projets", default=str(PROJETS), help="répertoire où ranger les projets des élèves")
    parser.add_argument("--données", default=str(DONNÉES),
                        help="répertoire des comptes et des données des professeurs")
    parser.add_argument("--professeur", help="le mode classe : l'identifiant du professeur (son mot de passe est demandé)")
    parser.add_argument("--sans-navigateur", action="store_true", help="ne pas ouvrir le navigateur")
    args = parser.parse_args()

    PROJETS = Path(args.projets).expanduser().resolve()
    PROJETS.mkdir(parents=True, exist_ok=True)
    DONNÉES = Path(args.données).expanduser().resolve()
    (DONNÉES / "professeurs").mkdir(parents=True, exist_ok=True)
    if args.professeur:
        identifiant = nfc(args.professeur).strip()
        if not professeur_existe(identifiant):
            sys.exit(f"Il n'y a pas de compte « {identifiant} » : crée-le d'abord en mode administrateur (port {args.port_admin}).")
        if not vérifie_compte(identifiant, getpass.getpass(f"Mot de passe de « {identifiant} » : ")):
            sys.exit("Mot de passe incorrect.")
        if not (répertoire_de(identifiant) / "élèves.json").is_file() or not liste_des_élèves(identifiant):
            sys.exit(f"« {identifiant} » n'a pas encore de liste d'élèves : lance le serveur sans --professeur, "
                     "puis, en mode administrateur, ouvre « Ma classe » dans les Matériels.")
        CLASSE = identifiant
    élèves = ThreadingHTTPServer((args.hôte, args.port), Gestionnaire)
    admin = ThreadingHTTPServer((args.hôte_admin, args.port_admin), GestionnaireAdmin)
    threading.Thread(target=admin.serve_forever, daemon=True).start()
    adresse = adresse_de(args.hôte, args.port)
    print(f"Pythonerie (élèves)        : {adresse}")
    print(f"Mode administrateur        : {adresse_de(args.hôte_admin, args.port_admin)}"
          + ("  (cette machine seulement)" if args.hôte_admin == "127.0.0.1" else ""))
    print(f"Projets des élèves         : {PROJETS}")
    print(f"Comptes et données des professeurs : {DONNÉES}")
    if CLASSE:
        print(f"Mode classe : les {len(liste_des_élèves(CLASSE))} élèves de « {CLASSE} » se connectent avec leur identifiant")
    print("Ctrl+C pour arrêter.")
    if not args.sans_navigateur:
        webbrowser.open(adresse)
    try:
        élèves.serve_forever()
    except KeyboardInterrupt:
        print("\nAu revoir !")


if __name__ == "__main__":
    main()
