// =====================================================================
// Pythonerie — application
// ---------------------------------------------------------------------
// 1. Les programmes : liste, création, renommage, import/export.
//    Ils sont conservés par serveur.py (répertoire programmes/) ou, à défaut,
//    dans le navigateur (localStorage).
// 2. L'éditeur (CodeMirror), toujours ouvert.
// 3. L'exécution : le pseudo-Python francisé est transpilé en LispE par
//    basic/transpiler.lisp, puis exécuté par LispE (WebAssembly) avec
//    basic/bibliotheque.lisp, qui dessine dans le canevas via Pyt (canevas.js).
// =====================================================================

const PROGRAMME_ACCUEIL = `# Bienvenue dans Pythonerie !
# Écris ton programme ici, puis clique sur « Exécuter » (ou Ctrl+Entrée).

nom = "Pythonerie"
affiche("Bonjour depuis", nom)

pour i dans intervalle(1, 6):
    affiche(i, "au carré vaut", i * i)

# On dessine dans le canevas à droite
fond("beige")
couleur("bleu")
disque(400, 300, 120)
couleur("blanc")
taille_texte(32)
texte(335, 284, "Bonjour !")
`;

const Pythonerie = (function () {
    // ------------------------------------------------------------------
    // État
    // ------------------------------------------------------------------
    let wasmPret = false;
    const sources = { basic: '', transpileur: '', bibliotheque: '' };
    let idxCompilateur = null;   // interpréteur LispE qui contient le transpileur
    let idxExecution = null;     // interpréteur LispE du programme en cours
    let dernierLispE = '';

    let editeur = null;
    let stockage = null;
    let programmes = [];          // [{chemin, modifie}]
    let courant = null;           // chemin du programme ouvert ("Jeux/Balle")
    let modifie = false;
    let minuterieSauvegarde = null;

    const $ = (id) => document.getElementById(id);

    // ------------------------------------------------------------------
    // Console
    // ------------------------------------------------------------------
    // Ligne commencée par ecris() et pas encore terminée
    let ligneOuverte = null;

    function nouvelleLigneConsole(genre) {
        const zone = $('console');
        const vide = zone.querySelector('.console-vide');
        if (vide) vide.remove();
        const div = document.createElement('div');
        div.className = 'console-ligne ' + genre;
        zone.appendChild(div);
        return div;
    }

    // ecris() : on complète la ligne ouverte ; chaque "\n" termine la ligne
    function ecrisPartiel(texte) {
        const morceaux = texte.split('\n');
        morceaux.forEach((m, i) => {
            const derniere = i === morceaux.length - 1;
            if (derniere && m === '') return;
            if (!ligneOuverte) ligneOuverte = nouvelleLigneConsole('sortie');
            ligneOuverte.textContent += m;
            if (!derniere) ligneOuverte = null;
        });
        $('console').scrollTop = $('console').scrollHeight;
    }

    function ecritConsole(texte, genre) {
        const zone = $('console');
        // affiche() après ecris() : on termine la ligne commencée
        if (ligneOuverte && (genre || 'sortie') === 'sortie') {
            ligneOuverte.textContent += texte;
            ligneOuverte = null;
            zone.scrollTop = zone.scrollHeight;
            return;
        }
        ligneOuverte = null;
        const vide = zone.querySelector('.console-vide');
        if (vide) vide.remove();
        const div = document.createElement('div');
        div.className = 'console-ligne ' + (genre || 'sortie');
        div.textContent = texte;
        zone.appendChild(div);
        zone.scrollTop = zone.scrollHeight;
    }

    function effaceConsole() {
        ligneOuverte = null;
        $('console').innerHTML = '<div class="console-vide">Les messages de ton programme s\'afficheront ici.</div>';
    }

    // Traduit et simplifie les messages d'erreur de LispE
    const TRADUCTIONS = [
        [/Unbound atom: '([^']*)'/i, '« $1 » est inconnu : variable pas encore définie ou nom mal orthographié ?'],
        [/Unknown function: '?([^'\s]*)'?/i, 'La fonction « $1 » n\'existe pas'],
        [/Division by zero/i, 'Division par zéro'],
        [/Wrong number of arguments/i, 'Nombre d\'arguments incorrect'],
        [/Wrong parameter description/i, 'Paramètres mal décrits'],
        [/Index out of bounds|out of range/i, 'Indice en dehors de la liste'],
        [/Unknown key/i, 'Clé absente du dictionnaire'],
        [/Wrong type/i, 'Type de valeur inattendu'],
        [/Expecting a list/i, 'Une liste était attendue'],
        [/No more elements to traverse/i, 'Liste trop courte']
    ];

    // Une ligne de la pile d'appels de LispE : "[12] (expression...)" ou "[-] (...)"
    const LIGNE_PILE = /^\[(\d+|-)\] /;

    function nettoieErreur(message) {
        let m = String(message && message.message ? message.message : message);
        // Dans le WebAssembly, le message est précédé de la pile d'appels : "[12] (expression...)"
        const pile = m.split('\n').filter(l => LIGNE_PILE.test(l));
        m = m.split('\n').filter(l => l.trim() && !LIGNE_PILE.test(l)).join('\n');
        m = m.replace(/^\s*(Error|Erreur)\s*:\s*/i, '');
        let ligne = null;
        const l = m.match(/line:\s*(\d+)/);
        if (l) ligne = l[1];
        m = m.replace(/,?\s*line:\s*\d+(\s*in:\s*[^,\n]*)?/g, '');
        for (const [motif, francais] of TRADUCTIONS) {
            if (motif.test(m)) { m = m.replace(motif, francais); break; }
        }
        let texte = /^Erreur/.test(m.trim()) ? m.trim() : 'Erreur : ' + m.trim();
        if (pile.length) texte += '\n   dans le code LispE : ' + pile[0].replace(LIGNE_PILE, '');
        else if (ligne && !/ligne \d/.test(m)) texte += '\n   (ligne ' + ligne + ' du code LispE)';
        return texte;
    }

    // ------------------------------------------------------------------
    // LispE : chargement, compilation, exécution
    // ------------------------------------------------------------------
    // Encode un texte unicode en base64 (pour le passer à LispE sans souci de guillemets)
    function base64(texte) {
        const octets = new TextEncoder().encode(texte);
        let binaire = '';
        for (let i = 0; i < octets.length; i += 0x8000) {
            binaire += String.fromCharCode.apply(null, octets.subarray(i, i + 0x8000));
        }
        return btoa(binaire);
    }

    async function chargeSources() {
        const lit = async (chemin) => {
            const r = await fetch(chemin, { cache: 'no-cache' });
            if (!r.ok) throw new Error('Impossible de charger ' + chemin);
            return r.text();
        };
        [sources.basic, sources.transpileur, sources.bibliotheque] = await Promise.all([
            lit('basic/basic.lisp'), lit('basic/transpiler.lisp'), lit('basic/bibliotheque.lisp')
        ]);
    }

    function prepareCompilateur() {
        // Les instructions de LispE : la liste des atomes d'un interpréteur neuf.
        // Une variable de l'élève qui porte un de ces noms (max, list...) sera renommée.
        const idxNeuf = callCreateLispE();
        const instructions = callEvalLispE(idxNeuf, '(join (maplist (λ (x) (string x)) (atoms) false) "\\n")');
        callCleanLispE(idxNeuf);

        idxCompilateur = callCreateLispE();
        callEvalLispE(idxCompilateur, sources.basic);
        callEvalLispE(idxCompilateur, sources.transpileur);
        // Noms des fonctions de la bibliothèque : une fonction de l'élève qui porte
        // le même nom sera renommée (LispE interdit les redéfinitions)
        callEvalLispE(idxCompilateur,
            '(setq noms_bibliotheque (noms_definis (atob «' + base64(sources.bibliotheque) + '»)))');
        callEvalLispE(idxCompilateur, '(charge_noms_lispe (atob «' + base64(instructions) + '»))');
    }

    // Renvoie {lispe} ou {erreur}
    function compile(code) {
        try {
            const r = callEvalLispE(idxCompilateur, '(compilepython (atob «' + base64(code + '\n') + '»))');
            if (typeof r === 'string' && /^\s*(Erreur|Error)/.test(r)) {
                return { erreur: r.replace(/ :\n>> /g, '\n  ').replace(/ <<\s*$/, '').replace(/ ' /g, "'") };
            }
            return { lispe: r };
        } catch (e) {
            // Après une exception, on repart d'un compilateur neuf
            try { callCleanLispE(idxCompilateur); } catch (e2) { /* rien */ }
            prepareCompilateur();
            return { erreur: nettoieErreur(e) };
        }
    }

    function evalue(idx, code) {
        const r = callEvalLispE(idx, code);
        if (typeof r === 'string' && /^Error:/.test(r)) throw new Error(r);
        return r;
    }

    function nouvelInterpreteur() {
        if (idxExecution !== null) {
            try { callCleanLispE(idxExecution); } catch (e) { /* rien */ }
        }
        idxExecution = callCreateLispE();
        evalue(idxExecution, sources.bibliotheque);
    }

    // Appelé par le canevas (animations, clics, touches)
    function rappel(code) {
        if (idxExecution === null) return;
        try {
            evalue(idxExecution, code);
        } catch (e) {
            Pyt.stoppeTout();
            ecritConsole(nettoieErreur(e), 'erreur');
            metAJourBoutons();
        }
    }

    function execute() {
        if (!wasmPret) { ecritConsole('LispE est encore en cours de chargement…', 'info'); return; }
        const code = editeur.getValue();
        Pyt.stoppeTout();
        Pyt.reinitialise();
        effaceConsole();

        const c = compile(code);
        if (c.erreur) {
            dernierLispE = '';
            afficheLispE();
            ecritConsole(c.erreur, 'erreur');
            return;
        }
        dernierLispE = c.lispe;
        afficheLispE();

        const debut = performance.now();
        try {
            nouvelInterpreteur();
            evalue(idxExecution, c.lispe);
            const duree = Math.round(performance.now() - debut);
            if (!Pyt.enCours()) ecritConsole('— Programme terminé (' + duree + ' ms)', 'info');
            else ecritConsole('— Programme en cours (animation ou événements). Clique sur « Arrêter » pour le stopper.', 'info');
        } catch (e) {
            ecritConsole(nettoieErreur(e), 'erreur');
            Pyt.stoppeTout();
        }
        metAJourBoutons();
    }

    function arrete() {
        Pyt.stoppeTout();
        ecritConsole('— Programme arrêté', 'info');
        metAJourBoutons();
    }

    function afficheLispE() {
        $('codeLispE').textContent = dernierLispE || '(pas encore de code LispE : exécute le programme)';
    }

    function metAJourBoutons() {
        $('btnArreter').disabled = !Pyt.enCours();
    }

    // ------------------------------------------------------------------
    // Stockage des programmes
    // Un programme est désigné par son chemin : "Jeux/Balle" (répertoire Jeux).
    // ------------------------------------------------------------------
    const url = (genre, chemin) => 'api/' + genre + '/' + chemin.split('/').map(encodeURIComponent).join('/');
    const parentDe = (chemin) => chemin.includes('/') ? chemin.slice(0, chemin.lastIndexOf('/')) : '';
    const nomDe = (chemin) => chemin.slice(chemin.lastIndexOf('/') + 1);
    const joint = (dossier, nom) => dossier ? dossier + '/' + nom : nom;
    // chemin est-il dans le répertoire dossier (ou est-il ce répertoire) ?
    const estDans = (chemin, dossier) => chemin === dossier || chemin.startsWith(dossier + '/');

    async function verifie(r) {
        if (!r.ok) throw new Error(await r.text());
        return r;
    }

    const StockageServeur = {
        genre: 'serveur',
        async liste() {
            return (await verifie(await fetch('api/programmes', { cache: 'no-cache' }))).json();
        },
        async lit(chemin) {
            const r = await fetch(url('programmes', chemin), { cache: 'no-cache' });
            if (!r.ok) throw new Error('Programme introuvable : ' + chemin);
            return r.text();
        },
        async ecrit(chemin, code) {
            await verifie(await fetch(url('programmes', chemin), {
                method: 'PUT', headers: { 'Content-Type': 'text/plain; charset=utf-8' }, body: code
            }));
        },
        async supprime(chemin) {
            await verifie(await fetch(url('programmes', chemin), { method: 'DELETE' }));
        },
        async renomme(ancien, nouveau) {
            await verifie(await fetch(url('programmes', ancien), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ renomme: nouveau })
            }));
        },
        async creeDossier(chemin) {
            await verifie(await fetch(url('dossiers', chemin), {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
            }));
        },
        async renommeDossier(ancien, nouveau) {
            await verifie(await fetch(url('dossiers', ancien), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ renomme: nouveau })
            }));
        },
        // Le contenu du répertoire remonte dans le répertoire parent
        async supprimeDossier(chemin) {
            await verifie(await fetch(url('dossiers', chemin), { method: 'DELETE' }));
        }
    };

    const CLE_PROGRAMMES = 'pythonerie.programmes';
    const CLE_DOSSIERS = 'pythonerie.dossiers';
    const StockageNavigateur = {
        genre: 'navigateur',
        _lit(cle, defaut) {
            try { return JSON.parse(localStorage.getItem(cle) || defaut); }
            catch (e) { return JSON.parse(defaut); }
        },
        _ecrit(cle, valeur) {
            try { localStorage.setItem(cle, JSON.stringify(valeur)); }
            catch (e) { throw new Error('Le navigateur refuse d\'enregistrer (mode privé ?)'); }
        },
        _tout() { return this._lit(CLE_PROGRAMMES, '{}'); },
        // Mémorise les répertoires qui n'existent qu'à travers leurs programmes,
        // pour qu'un répertoire vidé ne disparaisse pas (comme un vrai répertoire)
        async _figeDossiers() {
            this._ecrit(CLE_DOSSIERS, (await this.liste()).dossiers);
        },
        async liste() {
            const tout = this._tout();
            const dossiers = new Set(this._lit(CLE_DOSSIERS, '[]'));
            // Les répertoires qui contiennent des programmes existent aussi
            Object.keys(tout).forEach(c => {
                for (let d = parentDe(c); d; d = parentDe(d)) dossiers.add(d);
            });
            return {
                programmes: Object.keys(tout).map(chemin => ({ chemin, modifie: tout[chemin].modifie || 0 })),
                dossiers: [...dossiers]
            };
        },
        async lit(chemin) {
            const p = this._tout()[chemin];
            if (!p) throw new Error('Programme introuvable : ' + chemin);
            return p.code;
        },
        async ecrit(chemin, code) {
            const tout = this._tout();
            tout[chemin] = { code, modifie: Date.now() / 1000 };
            this._ecrit(CLE_PROGRAMMES, tout);
        },
        async supprime(chemin) {
            await this._figeDossiers();
            const tout = this._tout();
            delete tout[chemin];
            this._ecrit(CLE_PROGRAMMES, tout);
        },
        async renomme(ancien, nouveau) {
            await this._figeDossiers();
            const tout = this._tout();
            if (tout[nouveau]) throw new Error('Ce nom existe déjà');
            tout[nouveau] = tout[ancien];
            delete tout[ancien];
            this._ecrit(CLE_PROGRAMMES, tout);
        },
        async creeDossier(chemin) {
            const dossiers = new Set(this._lit(CLE_DOSSIERS, '[]'));
            dossiers.add(chemin);
            this._ecrit(CLE_DOSSIERS, [...dossiers]);
        },
        // Applique transforme(chemin) -> nouveau chemin aux programmes et aux répertoires
        _deplace(transforme) {
            const tout = this._tout();
            const nouveau = {};
            Object.keys(tout).forEach(c => {
                let n = transforme(c);
                if (n !== c) {
                    // en cas de conflit : « nom 2 », « nom 3 »...
                    const base = n;
                    for (let i = 2; nouveau[n] || (tout[n] && transforme(n) === n); i++) n = base + ' ' + i;
                }
                nouveau[n] = tout[c];
            });
            this._ecrit(CLE_PROGRAMMES, nouveau);
            this._ecrit(CLE_DOSSIERS, [...new Set(this._lit(CLE_DOSSIERS, '[]').map(transforme).filter(d => d))]);
        },
        async renommeDossier(ancien, nouveau) {
            const { programmes: p, dossiers: d } = await this.liste();
            if (d.includes(nouveau) || p.some(x => x.chemin === nouveau)) throw new Error('Ce nom existe déjà');
            if (estDans(nouveau, ancien)) throw new Error('Un répertoire ne peut pas aller dans lui-même');
            await this._figeDossiers();
            this._deplace(c => estDans(c, ancien) ? nouveau + c.slice(ancien.length) : c);
        },
        async supprimeDossier(chemin) {
            const parent = parentDe(chemin);
            await this._figeDossiers();
            this._deplace(c => {
                if (c === chemin) return '';
                return c.startsWith(chemin + '/') ? joint(parent, c.slice(chemin.length + 1)) : c;
            });
        }
    };

    async function choisitStockage() {
        try {
            const r = await fetch('api/programmes', { cache: 'no-cache' });
            const contenu = r.ok ? await r.json() : null;
            if (contenu && Array.isArray(contenu.programmes)) return StockageServeur;
        } catch (e) { /* pas de serveur */ }
        return StockageNavigateur;
    }

    function nomValide(nom) {
        nom = (nom || '').trim();
        if (!nom) return null;
        if (nom.length > 60 || !/^[\p{L}\p{N} _\-.()]+$/u.test(nom) || nom.startsWith('.')) return null;
        return nom.replace(/\.py$/i, '');
    }

    function existe(chemin) {
        return programmes.some(p => p.chemin === chemin) || dossiers.includes(chemin);
    }

    // Chemin libre dans un répertoire : « Programme », « Programme 2 »...
    function cheminLibre(dossier, base) {
        if (!existe(joint(dossier, base))) return joint(dossier, base);
        let i = 2;
        while (existe(joint(dossier, base + ' ' + i))) i++;
        return joint(dossier, base + ' ' + i);
    }

    // ------------------------------------------------------------------
    // L'arbre des programmes (comme dans TamedAgents)
    // ------------------------------------------------------------------
    let dossiers = [];           // chemins des répertoires
    let dossierCourant = '';     // où vont les nouveaux programmes ('' = racine)
    let plies = new Set();       // répertoires repliés
    try { plies = new Set(JSON.parse(localStorage.getItem('pythonerie.plies') || '[]')); } catch (e) { /* rien */ }
    function enregistrePlies() {
        try { localStorage.setItem('pythonerie.plies', JSON.stringify([...plies])); } catch (e) { /* rien */ }
    }

    // Icônes reprises de TamedAgents (app-sessions.js)
    const SVG_CHEVRON = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M5.7 13.7L5 13l4.6-4.6L5 3.7l.7-.7 5.3 5.3-5.3 5.4z"/></svg>';
    const SVG_DOSSIER_OUVERT = '<svg viewBox="0 0 16 16" fill="none"><path d="M1.5 2h4.7l1 1H14.5v1.5H1.5V2z" fill="#C09553"/><path d="M1 5h14l-1.5 9H2.5L1 5z" fill="#DCB67A"/></svg>';
    const SVG_DOSSIER_FERME = '<svg viewBox="0 0 16 16" fill="none"><path d="M1.5 2h4.7l1 1H14.5v10h-13V2z" fill="#C09553"/><path d="M1.5 4.5h13V13h-13V4.5z" fill="#DCB67A"/></svg>';
    const SVG_PROGRAMME = '<svg viewBox="0 0 16 16" fill="none"><path d="M3.5 1.5h6l3 3v10h-9z" stroke="currentColor" stroke-width="1.1"/><path d="M9.5 1.5v3h3" stroke="currentColor" stroke-width="1.1"/><path d="M5.5 8.5l-1.5 1.5 1.5 1.5M10.5 8.5l1.5 1.5-1.5 1.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const SVG_RENOMMER = '<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M13.23 1h-1.46L3.52 9.25l-.16.22L1 13.59 2.41 15l4.12-2.36.22-.16L15 4.23V2.77L13.23 1zM2.41 13.59l1.51-3 1.45 1.45-2.96 1.55zm3.83-2.06L4.47 9.76l8-8 1.77 1.77-8 8z"/></svg>';
    const SVG_SUPPRIMER = '<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M10 3h3v1h-1v9a1 1 0 01-1 1H5a1 1 0 01-1-1V4H3V3h3V2a1 1 0 011-1h2a1 1 0 011 1v1zM5 4v9h6V4H5zm2-1V2H7v1h2V2H7v1zm-1 2h1v7H6V5zm3 0h1v7H9V5z"/></svg>';
    const SVG_EXPORTER = '<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M8 1L4 5h3v5h2V5h3L8 1zM2 12v2h12v-2H2z"/></svg>';

    function boutonsActions(liste) {
        const actions = document.createElement('span');
        actions.className = 'programme-actions';
        liste.forEach(([svg, titre, action]) => {
            const b = document.createElement('button');
            b.innerHTML = svg;
            b.title = titre;
            b.setAttribute('aria-label', titre);
            b.addEventListener('click', (ev) => { ev.stopPropagation(); action(); });
            actions.appendChild(b);
        });
        return actions;
    }

    // Glisser-déposer : un programme ou un répertoire vers un répertoire (ou la racine)
    const TYPE_GLISSE = 'application/x-pythonerie';
    function rendGlissable(li, genre, chemin) {
        li.draggable = true;
        li.addEventListener('dragstart', (ev) => {
            ev.dataTransfer.setData(TYPE_GLISSE, JSON.stringify({ genre, chemin }));
            ev.dataTransfer.effectAllowed = 'move';
            li.classList.add('glisse');
        });
        li.addEventListener('dragend', () => li.classList.remove('glisse'));
    }
    function rendCible(element, dossier) {
        element.addEventListener('dragover', (ev) => {
            if (!ev.dataTransfer.types.includes(TYPE_GLISSE)) return;
            ev.preventDefault();
            ev.stopPropagation();
            ev.dataTransfer.dropEffect = 'move';
            element.classList.add('cible');
        });
        element.addEventListener('dragleave', (ev) => {
            if (!element.contains(ev.relatedTarget)) element.classList.remove('cible');
        });
        element.addEventListener('drop', async (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            element.classList.remove('cible');
            let objet;
            try { objet = JSON.parse(ev.dataTransfer.getData(TYPE_GLISSE)); } catch (e) { return; }
            await deplace(objet.genre, objet.chemin, dossier);
        });
    }

    function ligneArbre(profondeur, genre) {
        const li = document.createElement('li');
        li.className = 'arbre-ligne ' + genre;
        for (let i = 0; i < profondeur; i++) {
            const guide = document.createElement('span');
            guide.className = 'arbre-guide';
            li.appendChild(guide);
        }
        return li;
    }

    function afficheDossier(ul, dossier, profondeur) {
        const enfants = dossiers.filter(d => parentDe(d) === dossier).sort((a, b) => a.localeCompare(b, 'fr'));
        const progs = programmes.filter(p => parentDe(p.chemin) === dossier)
            .sort((a, b) => a.chemin.localeCompare(b.chemin, 'fr'));

        enfants.forEach(d => {
            const plie = plies.has(d);
            const li = ligneArbre(profondeur, 'dossier');
            if (d === dossierCourant) li.classList.add('selection');
            li.title = d;
            const chevron = document.createElement('span');
            chevron.className = 'arbre-chevron' + (plie ? '' : ' ouvert');
            chevron.innerHTML = SVG_CHEVRON;
            const icone = document.createElement('span');
            icone.className = 'arbre-icone';
            icone.innerHTML = plie ? SVG_DOSSIER_FERME : SVG_DOSSIER_OUVERT;
            const nom = document.createElement('span');
            nom.className = 'programme-nom';
            nom.textContent = nomDe(d);
            li.append(chevron, icone, nom, boutonsActions([
                [SVG_RENOMMER, 'Renommer le répertoire « ' + nomDe(d) + ' »', () => renommeDossier(d)],
                [SVG_SUPPRIMER, 'Supprimer le répertoire « ' + nomDe(d) + ' » (son contenu remonte d\'un niveau)', () => supprimeDossier(d)]
            ]));
            // Un clic sélectionne le répertoire (pour y créer des programmes) et l'ouvre ou le replie
            li.addEventListener('click', () => {
                if (plie) plies.delete(d); else plies.add(d);
                enregistrePlies();
                dossierCourant = d;
                afficheArbre();
            });
            rendGlissable(li, 'dossier', d);
            rendCible(li, d);
            ul.appendChild(li);
            if (!plie) afficheDossier(ul, d, profondeur + 1);
        });

        progs.forEach(p => {
            const li = ligneArbre(profondeur, 'programme');
            if (p.chemin === courant) li.classList.add('actif');
            li.title = p.chemin;
            const espace = document.createElement('span');
            espace.className = 'arbre-chevron';
            const icone = document.createElement('span');
            icone.className = 'arbre-icone';
            icone.innerHTML = SVG_PROGRAMME;
            const nom = document.createElement('span');
            nom.className = 'programme-nom';
            nom.textContent = nomDe(p.chemin);
            li.append(espace, icone, nom, boutonsActions([
                [SVG_RENOMMER, 'Renommer « ' + nomDe(p.chemin) + ' »', () => renomme(p.chemin)],
                [SVG_EXPORTER, 'Exporter « ' + nomDe(p.chemin) + ' » (télécharger le fichier .py)', () => exporte(p.chemin)],
                [SVG_SUPPRIMER, 'Supprimer « ' + nomDe(p.chemin) + ' »', () => supprime(p.chemin)]
            ]));
            li.addEventListener('click', () => {
                dossierCourant = parentDe(p.chemin);
                ouvre(p.chemin);
            });
            rendGlissable(li, 'programme', p.chemin);
            // Déposer sur un programme : on le range dans le même répertoire que lui
            rendCible(li, parentDe(p.chemin));
            ul.appendChild(li);
        });
    }

    function afficheArbre() {
        const ul = $('listeProgrammes');
        ul.innerHTML = '';
        if (!programmes.length && !dossiers.length) {
            ul.innerHTML = '<li class="liste-vide">Aucun programme</li>';
        }
        afficheDossier(ul, '', 0);
        const ici = dossierCourant ? '« ' + dossierCourant + ' »' : 'la racine';
        $('btnNouveau').title = 'Nouveau programme dans ' + ici;
        $('btnNouveauDossier').title = 'Nouveau répertoire dans ' + ici;
        $('genreStockage').textContent = (stockage.genre === 'serveur'
            ? 'Enregistrés dans le dossier programmes/'
            : 'Enregistrés dans ce navigateur') + (dossierCourant ? ' — nouveaux programmes dans « ' + dossierCourant + ' »' : '');
    }

    async function rafraichitListe() {
        try {
            const contenu = await stockage.liste();
            programmes = contenu.programmes;
            dossiers = contenu.dossiers;
        } catch (e) {
            programmes = [];
            dossiers = [];
            ecritConsole('Impossible de lire la liste des programmes : ' + e.message, 'erreur');
        }
        if (dossierCourant && !dossiers.includes(dossierCourant)) dossierCourant = '';
        afficheArbre();
    }

    function afficheTitre() {
        const titre = $('nomProgramme');
        titre.textContent = '';
        if (!courant) { titre.textContent = '—'; return; }
        const dossier = parentDe(courant);
        if (dossier) {
            const d = document.createElement('span');
            d.className = 'titre-dossier';
            d.textContent = dossier.split('/').join(' / ') + ' / ';
            titre.appendChild(d);
        }
        titre.appendChild(document.createTextNode(nomDe(courant)));
        titre.title = courant;
    }

    function retientCourant() {
        try { localStorage.setItem('pythonerie.dernier', courant || ''); } catch (e) { /* rien */ }
    }

    function etatSauvegarde(texte, genre) {
        const e = $('etatSauvegarde');
        e.textContent = texte;
        e.className = 'etat-sauvegarde ' + (genre || '');
    }

    async function sauvegarde() {
        clearTimeout(minuterieSauvegarde);
        if (!courant || !modifie) return;
        try {
            await stockage.ecrit(courant, editeur.getValue());
            modifie = false;
            etatSauvegarde('Enregistré', 'ok');
        } catch (e) {
            etatSauvegarde('Non enregistré', 'erreur');
            ecritConsole('Erreur d\'enregistrement : ' + e.message, 'erreur');
        }
    }

    function sauvegardePlusTard() {
        modifie = true;
        etatSauvegarde('Modifié…', '');
        clearTimeout(minuterieSauvegarde);
        minuterieSauvegarde = setTimeout(sauvegarde, 1200);
    }

    let chargementEnCours = false;
    async function ouvre(chemin) {
        if (chemin === courant) return;
        await sauvegarde();
        try {
            const code = await stockage.lit(chemin);
            chargementEnCours = true;
            editeur.setValue(code);
            editeur.clearHistory();
            chargementEnCours = false;
            courant = chemin;
            modifie = false;
            dossierCourant = parentDe(chemin);
            // On déplie les répertoires qui mènent au programme
            for (let d = parentDe(chemin); d; d = parentDe(d)) plies.delete(d);
            enregistrePlies();
            afficheTitre();
            etatSauvegarde('Enregistré', 'ok');
            retientCourant();
            await rafraichitListe();
            editeur.focus();
        } catch (e) {
            ecritConsole(e.message, 'erreur');
        }
    }

    // Crée un programme nommé nom dans le répertoire dossier
    async function cree(dossier, nom, code) {
        await sauvegarde();
        const chemin = cheminLibre(dossier, nom);
        try {
            await stockage.ecrit(chemin, code);
        } catch (e) {
            ecritConsole('Impossible de créer « ' + chemin + ' » : ' + e.message, 'erreur');
            return;
        }
        await rafraichitListe();
        courant = null;
        await ouvre(chemin);
    }

    async function nouveau() {
        const ici = dossierCourant ? ' (dans « ' + dossierCourant + ' »)' : '';
        const nom = nomValide(prompt('Nom du nouveau programme' + ici + ' :', nomDe(cheminLibre(dossierCourant, 'Programme'))));
        if (!nom) return;
        await cree(dossierCourant, nom, '# ' + nom + '\n\n');
    }

    async function nouveauDossier() {
        const ici = dossierCourant ? ' (dans « ' + dossierCourant + ' »)' : '';
        const nom = nomValide(prompt('Nom du nouveau répertoire' + ici + ' :', nomDe(cheminLibre(dossierCourant, 'Répertoire'))));
        if (!nom) return;
        const chemin = joint(dossierCourant, nom);
        if (existe(chemin)) { alert('Ce nom existe déjà ici.'); return; }
        try {
            await stockage.creeDossier(chemin);
            plies.delete(chemin);
            dossierCourant = chemin;
            await rafraichitListe();
        } catch (e) {
            ecritConsole('Impossible de créer le répertoire : ' + e.message, 'erreur');
        }
    }

    // Déplace (ou renomme) un programme ; met à jour le programme ouvert
    async function changeCheminProgramme(ancien, nouveau) {
        if (ancien === nouveau) return true;
        if (existe(nouveau)) { alert('« ' + nomDe(nouveau) + ' » existe déjà à cet endroit.'); return false; }
        if (ancien === courant) await sauvegarde();
        try {
            await stockage.renomme(ancien, nouveau);
        } catch (e) {
            ecritConsole('Impossible de renommer ou déplacer : ' + e.message, 'erreur');
            return false;
        }
        if (ancien === courant) {
            courant = nouveau;
            afficheTitre();
            retientCourant();
        }
        await rafraichitListe();
        return true;
    }

    // ancien : le programme visé (par défaut, celui qui est ouvert)
    async function renomme(ancien = courant) {
        if (!ancien) return;
        const nom = nomValide(prompt('Nouveau nom :', nomDe(ancien)));
        if (!nom || nom === nomDe(ancien)) return;
        await changeCheminProgramme(ancien, joint(parentDe(ancien), nom));
    }

    async function supprime(chemin = courant) {
        if (!chemin) return;
        if (!confirm('Supprimer définitivement « ' + chemin + ' » ?')) return;
        const estOuvert = chemin === courant;
        if (estOuvert) clearTimeout(minuterieSauvegarde);
        try {
            await stockage.supprime(chemin);
        } catch (e) {
            ecritConsole('Impossible de supprimer : ' + e.message, 'erreur');
            return;
        }
        if (estOuvert) {
            courant = null;
            modifie = false;
        }
        await rafraichitListe();
        if (!estOuvert) return;
        if (programmes.length) await ouvre(programmes[0].chemin);
        else await cree('', 'Mon premier programme', PROGRAMME_ACCUEIL);
    }

    // Déplace un répertoire ; met à jour le programme ouvert et les répertoires repliés
    async function changeCheminDossier(ancien, nouveau) {
        if (ancien === nouveau) return;
        if (estDans(nouveau, ancien)) { alert('Un répertoire ne peut pas aller dans lui-même.'); return; }
        if (existe(nouveau)) { alert('« ' + nomDe(nouveau) + ' » existe déjà à cet endroit.'); return; }
        if (courant && estDans(courant, ancien)) await sauvegarde();
        try {
            await stockage.renommeDossier(ancien, nouveau);
        } catch (e) {
            ecritConsole('Impossible de renommer ou déplacer le répertoire : ' + e.message, 'erreur');
            return;
        }
        const transforme = (c) => estDans(c, ancien) ? nouveau + c.slice(ancien.length) : c;
        if (courant) { courant = transforme(courant); afficheTitre(); retientCourant(); }
        plies = new Set([...plies].map(transforme));
        enregistrePlies();
        dossierCourant = transforme(dossierCourant);
        await rafraichitListe();
    }

    async function renommeDossier(ancien) {
        const nom = nomValide(prompt('Nouveau nom du répertoire :', nomDe(ancien)));
        if (!nom || nom === nomDe(ancien)) return;
        await changeCheminDossier(ancien, joint(parentDe(ancien), nom));
    }

    // Comme dans TamedAgents : le contenu du répertoire remonte d'un niveau, rien n'est perdu
    async function supprimeDossier(chemin) {
        const parent = parentDe(chemin);
        const nb = programmes.filter(p => estDans(p.chemin, chemin)).length;
        const message = 'Supprimer le répertoire « ' + chemin + ' » ?' +
            (nb ? '\nSes ' + nb + ' programme(s) remonteront dans ' + (parent ? '« ' + parent + ' »' : 'la racine') + '.' : '');
        if (!confirm(message)) return;
        const ouvertDedans = courant && estDans(courant, chemin);
        if (ouvertDedans) await sauvegarde();
        try {
            await stockage.supprimeDossier(chemin);
        } catch (e) {
            ecritConsole('Impossible de supprimer le répertoire : ' + e.message, 'erreur');
            return;
        }
        const avant = courant;
        if (dossierCourant && estDans(dossierCourant, chemin)) dossierCourant = parent;
        await rafraichitListe();
        if (ouvertDedans) {
            const attendu = joint(parent, avant.slice(chemin.length + 1));
            if (programmes.some(p => p.chemin === attendu)) {
                courant = attendu;
                afficheTitre();
                retientCourant();
                afficheArbre();
            } else {
                // le programme a été renommé (conflit de nom) : on ouvre le premier
                courant = null;
                if (programmes.length) await ouvre(programmes[0].chemin);
            }
        }
    }

    // Glisser-déposer vers le répertoire dossier ('' = racine)
    async function deplace(genre, chemin, dossier) {
        if (genre === 'programme') {
            if (parentDe(chemin) === dossier) return;
            await changeCheminProgramme(chemin, joint(dossier, nomDe(chemin)));
        } else if (genre === 'dossier') {
            if (parentDe(chemin) === dossier || estDans(dossier, chemin)) return;
            plies.delete(dossier);
            await changeCheminDossier(chemin, joint(dossier, nomDe(chemin)));
        }
    }

    async function duplique() {
        if (!courant) return;
        await cree(parentDe(courant), nomDe(courant) + ' (copie)', editeur.getValue());
    }

    async function exporte(chemin = courant) {
        let code;
        try {
            code = chemin === courant ? editeur.getValue() : await stockage.lit(chemin);
        } catch (e) {
            ecritConsole('Impossible d\'exporter : ' + e.message, 'erreur');
            return;
        }
        const blob = new Blob([code], { type: 'text/x-python;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = (chemin ? nomDe(chemin) : 'programme') + '.py';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    function importe(fichiers) {
        Array.from(fichiers).forEach(f => {
            const lecteur = new FileReader();
            lecteur.onload = async () => {
                const nom = nomValide(f.name.replace(/\.[^.]+$/, '')) || 'Programme importé';
                await cree(dossierCourant, nom, String(lecteur.result));
            };
            lecteur.readAsText(f, 'utf-8');
        });
    }

    // ------------------------------------------------------------------
    // Exemples (répertoire exemples/)
    // ------------------------------------------------------------------
    async function chargeExemples() {
        const ul = $('listeExemples');
        try {
            const r = await fetch('exemples/index.json', { cache: 'no-cache' });
            const liste = await r.json();
            ul.innerHTML = '';
            liste.forEach(ex => {
                const li = document.createElement('li');
                li.textContent = ex.titre;
                li.title = ex.description || ex.titre;
                li.addEventListener('click', async () => {
                    try {
                        const rc = await fetch('exemples/' + ex.fichier, { cache: 'no-cache' });
                        if (!rc.ok) throw new Error('Exemple introuvable');
                        await cree(dossierCourant, ex.titre, await rc.text());
                    } catch (e) {
                        ecritConsole(e.message, 'erreur');
                    }
                });
                ul.appendChild(li);
            });
        } catch (e) {
            ul.innerHTML = '<li class="liste-vide">Exemples indisponibles</li>';
        }
    }

    // ------------------------------------------------------------------
    // Éditeur
    // ------------------------------------------------------------------
    function nouvelleLigne(cm) {
        const cur = cm.getCursor();
        const avant = cm.getLine(cur.line).slice(0, cur.ch);
        let retrait = avant.match(/^\s*/)[0];
        if (/:\s*(#.*)?$/.test(avant)) retrait += '    ';
        else if (/^\s*(retourne|renvoie|sortir|continuer|lever)\b/.test(avant)) {
            retrait = retrait.slice(0, Math.max(0, retrait.length - 4));
        }
        cm.replaceSelection('\n' + retrait, 'end');
    }

    function tabulation(cm) {
        if (cm.somethingSelected()) cm.indentSelection('add');
        else cm.replaceSelection('    ', 'end');
    }

    function installeEditeur() {
        const sombre = document.body.classList.contains('dark-mode');
        editeur = CodeMirror.fromTextArea($('editeur'), {
            mode: 'pythonerie',
            theme: sombre ? 'dracula' : 'default',
            lineNumbers: true,
            indentUnit: 4,
            tabSize: 4,
            indentWithTabs: false,
            matchBrackets: true,
            autoCloseBrackets: true,
            styleActiveLine: true,
            extraKeys: {
                'Enter': nouvelleLigne,
                'Tab': tabulation,
                'Shift-Tab': (cm) => cm.indentSelection('subtract'),
                'Ctrl-Enter': execute,
                'Cmd-Enter': execute,
                'Ctrl-S': () => { modifie = true; sauvegarde(); },
                'Cmd-S': () => { modifie = true; sauvegarde(); },
                'Ctrl-Space': (cm) => cm.showHint({ hint: pythonerieCompletion, completeSingle: false }),
                'Ctrl-/': 'toggleComment',
                'Cmd-/': 'toggleComment'
            }
        });
        editeur.on('change', () => { if (!chargementEnCours) sauvegardePlusTard(); });
        editeur.on('inputRead', (cm, ev) => {
            if (ev.origin !== '+input' || !/^[\wÀ-ÿ]$/.test(ev.text[0])) return;
            const cur = cm.getCursor();
            const avant = cm.getLine(cur.line).slice(0, cur.ch);
            if (/(^|[^\wÀ-ÿ"'])[\wÀ-ÿ]{3}$/.test(avant) && !/#/.test(avant)) {
                cm.showHint({ hint: pythonerieCompletion, completeSingle: false });
            }
        });
    }

    // ------------------------------------------------------------------
    // Interface
    // ------------------------------------------------------------------
    function basculeTheme() {
        const sombre = document.body.classList.toggle('dark-mode');
        editeur.setOption('theme', sombre ? 'dracula' : 'default');
        try { localStorage.setItem('pythonerie.theme', sombre ? 'sombre' : 'clair'); } catch (e) { /* rien */ }
    }

    function basculeLispE() {
        const panneau = $('panneauLispE');
        const visible = panneau.classList.toggle('visible');
        $('btnLispE').classList.toggle('actif', visible);
        afficheLispE();
    }

    function telechargeImage() {
        const a = document.createElement('a');
        a.href = Pyt.image();
        a.download = (courant || 'dessin') + '.png';
        a.click();
    }

    // Glisser la séparation entre l'éditeur et le canevas
    function installeSeparateur() {
        const sep = $('separateur');
        const grille = $('espace');
        let depart = null;
        sep.addEventListener('mousedown', (ev) => {
            depart = { x: ev.clientX, largeur: $('zoneCanevas').getBoundingClientRect().width };
            document.body.classList.add('redimensionne');
            ev.preventDefault();
        });
        window.addEventListener('mousemove', (ev) => {
            if (!depart) return;
            const l = Math.min(Math.max(depart.largeur - (ev.clientX - depart.x), 260), window.innerWidth * 0.7);
            grille.style.setProperty('--largeur-canevas', l + 'px');
            editeur.refresh();
        });
        window.addEventListener('mouseup', () => {
            if (!depart) return;
            depart = null;
            document.body.classList.remove('redimensionne');
            try { localStorage.setItem('pythonerie.largeurCanevas', grille.style.getPropertyValue('--largeur-canevas')); } catch (e) { /* rien */ }
        });
        try {
            const l = localStorage.getItem('pythonerie.largeurCanevas');
            if (l) grille.style.setProperty('--largeur-canevas', l);
        } catch (e) { /* rien */ }
    }

    // Menu ☰ : s'ouvre avec le bouton, se ferme sur un choix, un clic ailleurs ou Échap
    function installeMenu(idBouton, idMenu) {
        const bouton = $(idBouton);
        const menu = $(idMenu);
        const ferme = () => { menu.hidden = true; bouton.setAttribute('aria-expanded', 'false'); };
        bouton.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const ouvrir = menu.hidden;
            menu.hidden = !ouvrir;
            bouton.setAttribute('aria-expanded', String(ouvrir));
            if (!ouvrir) return;
            // Sous le bouton, aligné sur son bord droit, sans sortir de la fenêtre
            const r = bouton.getBoundingClientRect();
            menu.style.top = (r.bottom + 4) + 'px';
            menu.style.left = Math.max(8, Math.min(r.right - menu.offsetWidth, window.innerWidth - menu.offsetWidth - 8)) + 'px';
            menu.querySelector('.menu-item').focus();
        });
        window.addEventListener('resize', ferme);
        document.addEventListener('scroll', ferme, true);
        menu.addEventListener('click', (ev) => { if (ev.target.closest('.menu-item')) ferme(); });
        document.addEventListener('click', (ev) => { if (!menu.contains(ev.target)) ferme(); });
        document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !menu.hidden) { ferme(); bouton.focus(); } });
    }

    function installeBoutons() {
        $('btnExecuter').addEventListener('click', execute);
        $('btnArreter').addEventListener('click', arrete);
        $('btnLispE').addEventListener('click', basculeLispE);
        $('btnNouveau').addEventListener('click', nouveau);
        installeMenu('btnMenuProgrammes', 'menuProgrammes');
        $('btnNouveauDossier').addEventListener('click', nouveauDossier);
        // Déposer dans la zone vide de l'arbre, ou sur le titre : vers la racine
        rendCible($('listeProgrammes'), '');
        rendCible($('titreProgrammes'), '');
        // Un clic dans la zone vide de l'arbre : les nouveaux programmes iront à la racine
        $('listeProgrammes').addEventListener('click', (ev) => {
            if (ev.target === $('listeProgrammes')) { dossierCourant = ''; afficheArbre(); }
        });
        $('btnRenommer').addEventListener('click', () => renomme());
        $('btnDupliquer').addEventListener('click', duplique);
        $('btnSupprimer').addEventListener('click', () => supprime());
        $('btnExporter').addEventListener('click', () => exporte());
        $('btnImporter').addEventListener('click', () => $('fichierImport').click());
        $('fichierImport').addEventListener('change', (ev) => { importe(ev.target.files); ev.target.value = ''; });
        $('btnEffaceConsole').addEventListener('click', effaceConsole);
        $('btnEffaceCanevas').addEventListener('click', () => { Pyt.stoppeTout(); Pyt.reinitialise(); metAJourBoutons(); });
        $('btnImage').addEventListener('click', telechargeImage);
        $('btnTheme').addEventListener('click', basculeTheme);
        $('btnAide').addEventListener('click', () => $('aide').classList.add('visible'));
        $('fermeAide').addEventListener('click', () => $('aide').classList.remove('visible'));
        $('aide').addEventListener('click', (ev) => { if (ev.target.id === 'aide') $('aide').classList.remove('visible'); });
        window.addEventListener('keydown', (ev) => {
            if (ev.key === 'Escape') $('aide').classList.remove('visible');
        });
        window.addEventListener('beforeunload', () => { if (modifie) sauvegarde(); });
    }

    async function demarre() {
        try {
            if (localStorage.getItem('pythonerie.theme') === 'sombre') document.body.classList.add('dark-mode');
        } catch (e) { /* rien */ }
        installeEditeur();
        installeBoutons();
        installeSeparateur();
        effaceConsole();
        Pyt.installe($('canevas'), $('coucheTortue'), rappel);
        metAJourBoutons();

        stockage = await choisitStockage();
        await rafraichitListe();
        chargeExemples();

        let dernier = null;
        try { dernier = localStorage.getItem('pythonerie.dernier'); } catch (e) { /* rien */ }
        if (dernier && programmes.some(p => p.chemin === dernier)) await ouvre(dernier);
        else if (programmes.length) await ouvre(programmes[0].chemin);
        else await cree('', 'Mon premier programme', PROGRAMME_ACCUEIL);
    }

    // Appelé quand le WebAssembly de LispE est prêt
    async function lispePret() {
        try {
            await chargeSources();
            prepareCompilateur();
            wasmPret = true;
            $('btnExecuter').disabled = false;
            $('etatLispE').textContent = 'LispE prêt';
            $('etatLispE').className = 'etat-lispe ok';
        } catch (e) {
            $('etatLispE').textContent = 'LispE indisponible';
            $('etatLispE').className = 'etat-lispe erreur';
            ecritConsole('Impossible de préparer LispE : ' + (e.message || e), 'erreur');
        }
    }

    // Sortie standard de LispE. En cas d'erreur, le WebAssembly y écrit aussi la pile
    // d'appels et le message brut : on ne les montre pas, l'erreur est affichée proprement.
    let apresPile = false;
    function sortie(texte) {
        if (LIGNE_PILE.test(texte) || /^Error: .*line: \d+ in: /.test(texte)) {
            apresPile = true;
            return;
        }
        if (apresPile && texte === '') { apresPile = false; return; }
        apresPile = false;
        ecritConsole(texte, 'sortie');
    }

    return {
        demarre, lispePret, execute, effaceConsole, sortie, ecrisPartiel,
        signaleAnimation: () => { if ($('btnArreter')) metAJourBoutons(); },
        compile // utile pour les tests depuis la console du navigateur
    };
})();

window.Pythonerie = Pythonerie;
