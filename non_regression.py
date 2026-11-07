#!/usr/bin/env python3
"""Non-régression du langage de la Pythonerie (grammaire, transpileur, bibliothèque).

À lancer après toute modification de basic.grm, transpiler.lisp, bibliothèque.lisp,
optimise.lisp ou des fichiers de noms :

    python3 non_regression.py                # toutes les langues
    python3 non_regression.py --accepte      # enregistre les résultats actuels comme références

Deux sortes de vérifications, chacune avec basic.lisp ET basic_opt.lisp (l'optimiseur ne
vérifie que son corpus : une forme nouvelle peut passer basic.lisp et échouer avec
basic_opt.lisp, à cause d'une garde écrite à la main) :

1. les formes : tests/formes/<Langue>/*.pye (ou .pyf, .pyk) sont traduits puis exécutés
   dans LispE ; ce qu'ils affichent doit être exactement le fichier .attendu du même nom.
   Un programme refusé affiche son message d'erreur : on teste aussi les refus.
   Pour ajouter une forme : écrire le programme, lancer avec --accepte, RELIRE le .attendu.
2. les traductions : les exemples, les programmes des matériels et les formes sont
   traduits en LispE et comparés à tests/références/<Langue>/. Une différence n'est pas
   forcément une faute (on a pu changer le transpileur exprès) : on la lit, puis --accepte.

Rien ne s'exécute dans le navigateur : banc.lisp remplace evaljsc par un simple print.
"""
import argparse
import concurrent.futures
import difflib
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

RACINE = Path(__file__).resolve().parent
TESTS = RACINE / 'tests'
BANC = TESTS / 'banc.lisp'
LISPE = shutil.which('lispe') or '/usr/local/bin/lispe'
ANALYSEURS = ['basic.lisp', 'basic_opt.lisp']

LANGUES = {
    'Pythonerie': dict(basic='docs/basic', noms='français.lisp',
                       exemples='docs/exemples', matériels='docs/matériels', ext='.pyf'),
}

def lance(args, timeout=300):
    r = subprocess.run([LISPE, str(BANC)] + [str(a) for a in args],
                       capture_output=True, text=True, timeout=timeout)
    return r.stdout + r.stderr


def nettoie(sortie):
    # les messages de LispE donnent la ligne et le fichier : ils changent d'une machine à l'autre
    sortie = re.sub(r',? line: \d+ in: \S+', '', sortie)
    return sortie.rstrip() + '\n'


def corpus(langue, conf, tmp):
    """(nom de la référence, chemin du programme) : exemples, matériels, formes."""
    ext = conf['ext']
    progs = []
    for f in sorted((RACINE / conf['exemples']).glob('*' + ext)):
        progs.append((f'exemples/{f.stem}.lisp', f))
    for z in sorted((RACINE / conf['matériels']).glob('*.zip')):
        with zipfile.ZipFile(z) as zf:
            for nom in sorted(zf.namelist()):
                if nom.startswith('programmes/') and nom.endswith(ext):
                    cible = tmp / 'matériels' / z.stem / nom
                    cible.parent.mkdir(parents=True, exist_ok=True)
                    cible.write_bytes(zf.read(nom))
                    progs.append((f'matériels/{z.stem}/{nom[len("programmes/"):-len(ext)]}.lisp', cible))
    for f in formes(langue, conf):
        progs.append((f'formes/{f.stem}.lisp', f))
    return progs


def formes(langue, conf):
    return sorted((TESTS / 'formes' / langue).glob('*' + conf['ext']))


def vérifie(langue, conf, accepte):
    basic = RACINE / conf['basic']
    fautes = []
    nouveaux = []
    with tempfile.TemporaryDirectory() as t:
        tmp = Path(t)
        progs = corpus(langue, conf, tmp)
        # 1. traductions, avec les deux analyseurs
        trad = {}
        for a in ANALYSEURS:
            sortie = tmp / a
            liste = tmp / f'liste_{a}.txt'
            lignes = []
            for i, (ref, src) in enumerate(progs):
                lignes.append(f'{src}\t{sortie}/{i}.lisp')
            sortie.mkdir()
            liste.write_text('\n'.join(lignes) + '\n', encoding='utf-8')
            lance(['traduis', f'{basic}/', a, conf['noms'], liste])
            trad[a] = {ref: (sortie / f'{i}.lisp').read_text(encoding='utf-8') if (sortie / f'{i}.lisp').exists() else 'ABSENT'
                       for i, (ref, src) in enumerate(progs)}
        for ref, _ in progs:
            if trad['basic.lisp'][ref] != trad['basic_opt.lisp'][ref]:
                fautes.append(f'{ref} : basic.lisp et basic_opt.lisp ne donnent pas la même traduction '
                              f'(revoir les gardes de optimise.lisp, puis relancer l\'optimiseur)')
        refs = TESTS / 'références' / langue
        for ref, _ in progs:
            actuel = trad['basic_opt.lisp'][ref]
            fichier = refs / ref
            ancien = fichier.read_text(encoding='utf-8') if fichier.exists() else None
            if ancien == actuel:
                continue
            if accepte:
                fichier.parent.mkdir(parents=True, exist_ok=True)
                fichier.write_text(actuel, encoding='utf-8')
                nouveaux.append(f'référence {"créée" if ancien is None else "remplacée"} : {ref}')
            elif ancien is None:
                fautes.append(f'{ref} : pas de référence (lancer avec --accepte)')
            else:
                diff = list(difflib.unified_diff(ancien.splitlines(), actuel.splitlines(),
                                                 'référence', 'maintenant', lineterm='', n=1))
                extrait = '\n      '.join(diff[2:14]) + ('\n      …' if len(diff) > 14 else '')
                fautes.append(f'{ref} : la traduction a changé\n      {extrait}')
        # 2. formes : exécution, avec les deux analyseurs
        travaux = [(f, a) for f in formes(langue, conf) for a in ANALYSEURS]
        with concurrent.futures.ThreadPoolExecutor(8) as ex:
            sorties = list(ex.map(lambda fa: nettoie(lance(['exécute', f'{basic}/', fa[1], conf['noms'], fa[0]])), travaux))
        résultats = {}
        for (f, a), s in zip(travaux, sorties):
            résultats.setdefault(f, {})[a] = s
        for f, r in résultats.items():
            if r['basic.lisp'] != r['basic_opt.lisp']:
                fautes.append(f'formes/{f.name} : basic.lisp et basic_opt.lisp ne donnent pas le même résultat\n'
                              f'      basic.lisp     : {r["basic.lisp"].strip()[:300]}\n'
                              f'      basic_opt.lisp : {r["basic_opt.lisp"].strip()[:300]}')
            actuel = r['basic_opt.lisp']
            attendu = f.with_suffix('.attendu')
            ancien = attendu.read_text(encoding='utf-8') if attendu.exists() else None
            if ancien == actuel:
                continue
            if accepte:
                attendu.write_text(actuel, encoding='utf-8')
                nouveaux.append(f'résultat {"créé" if ancien is None else "remplacé"} : formes/{attendu.name} (à relire)')
            elif ancien is None:
                fautes.append(f'formes/{f.name} : pas de résultat attendu (lancer avec --accepte, puis le relire)')
            else:
                diff = list(difflib.unified_diff(ancien.splitlines(), actuel.splitlines(),
                                                 'attendu', 'obtenu', lineterm='', n=1))
                fautes.append(f'formes/{f.name} : résultat différent\n      ' + '\n      '.join(diff[2:20]))
    return len(progs), len(résultats), fautes, nouveaux


def main():
    p = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    p.add_argument('langues', nargs='*', help=', '.join(LANGUES))
    p.add_argument('--accepte', action='store_true',
                   help='enregistre les résultats actuels comme références (à relire ensuite)')
    args = p.parse_args()
    langues = args.langues or list(LANGUES)
    total = 0
    for langue in langues:
        if langue not in LANGUES:
            sys.exit(f'Langue inconnue : {langue} ({", ".join(LANGUES)})')
        n, nf, fautes, nouveaux = vérifie(langue, LANGUES[langue], args.accepte)
        état = 'OK' if not fautes else f'{len(fautes)} faute(s)'
        print(f'{langue} : {n} traductions, {nf} formes exécutées : {état}')
        for x in nouveaux:
            print('   ', x)
        for x in fautes:
            print('  ✗', x)
        total += len(fautes)
    sys.exit(1 if total else 0)


if __name__ == '__main__':
    main()
