// =====================================================================
// Pythonerie — application
// ---------------------------------------------------------------------
// 1. Les programmes : liste, création, renommage, import/export.
//    Ils sont conservés par serveur.py (répertoire programmes/) ou, à défaut,
//    dans le navigateur (localStorage).
// 2. L'éditeur (CodeMirror), toujours ouvert.
// 3. L'exécution : le pseudo-Python francisé est transpilé en LispE par
//    basic/transpiler.lisp, puis exécuté par LispE (WebAssembly) avec
//    basic/bibliothèque.lisp, qui dessine dans le canevas via Pyt (canevas.js).
// =====================================================================

const PROGRAMME_ACCUEIL = `# Bienvenue dans la Pythonerie !
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
    let wasmPrêt = false;
    const sources = { basic: '', transpileur: '', bibliothèque: '', français: '' };
    let idxCompilateur = null;   // interpréteur LispE qui contient le transpileur
    let idxExécution = null;     // interpréteur LispE du programme en cours
    let dernierLispE = '';

    let éditeur = null;
    let stockage = null;
    let programmes = [];          // [{chemin, modifie}]
    let courant = null;           // chemin du programme ouvert ("Jeux/Balle")
    let modifie = false;
    let minuterieSauvegarde = null;

    const $ = (id) => document.getElementById(id);

    // Forme Unicode normalisée (NFC) : « é » peut aussi arriver décomposé en « e » + accent
    // combinant (copier-coller, certains claviers, noms de fichiers macOS). LispE ne
    // reconnaîtrait alors ni « épaisseur » ni « élève » : tout texte est normalisé.
    const nfc = (texte) => String(texte).normalize('NFC');

    // ------------------------------------------------------------------
    // Console
    // ------------------------------------------------------------------
    // Ligne commencée par écris() et pas encore terminée
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

    // écris() : on complète la ligne ouverte ; chaque "\n" termine la ligne
    function écrisPartiel(texte) {
        const morceaux = texte.split('\n');
        morceaux.forEach((m, i) => {
            const dernière = i === morceaux.length - 1;
            if (dernière && m === '') return;
            if (!ligneOuverte) ligneOuverte = nouvelleLigneConsole('sortie');
            ligneOuverte.textContent += m;
            if (!dernière) ligneOuverte = null;
        });
        $('console').scrollTop = $('console').scrollHeight;
    }

    function écritConsole(texte, genre) {
        const zone = $('console');
        // affiche() après écris() : on termine la ligne commencée
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
    const LIGNE_PILE = /^\[(\d+|-)\] \(/;

    function nettoieErreur(message) {
        let m = String(message && message.message ? message.message : message);
        // Dans le WebAssembly, le message est précédé de la pile d'appels : "[12] (expression...)"
        // Pour une erreur levée exprès (lever, ou lit_fichier...), le haut de la pile est
        // le « throw » lui-même, et parfois un « if » et les fonctions internes de la bibliothèque (_...) :
        // inutile de les montrer, l'endroit utile est l'appel de l'élève qui suit.
        const pile = m.split('\n').filter(l => LIGNE_PILE.test(l));
        const levée = pile.length > 0 && /^\[(\d+|-)\] \(throw\b/.test(pile[0]);
        if (levée) {
            while (pile.length && /^\[(\d+|-)\] \((throw\b|if\b|_)/.test(pile[0])) pile.shift();
        }
        m = m.split('\n').filter(l => l.trim() && !LIGNE_PILE.test(l)).join('\n');
        m = m.replace(/^\s*(Error|Erreur)\s*:\s*/i, '');
        let ligne = null;
        const l = m.match(/line:\s*(\d+)/);
        if (l) ligne = l[1];
        m = m.replace(/,?\s*line:\s*\d+(\s*in:\s*[^,\n]*)?/g, '');
        for (const [motif, français] of TRADUCTIONS) {
            if (motif.test(m)) { m = m.replace(motif, français); break; }
        }
        let texte = /^Erreur/.test(m.trim()) ? m.trim() : 'Erreur : ' + m.trim();
        if (pile.length) texte += '\n   dans le code LispE : ' + pile[0].replace(LIGNE_PILE, '');
        else if (ligne && !levée && !/ligne \d/.test(m)) texte += '\n   (ligne ' + ligne + ' du code LispE)';
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
            return nfc(await r.text());
        };
        [sources.basic, sources.transpileur, sources.bibliothèque, sources.français] = await Promise.all([
            lit('basic/basic.lisp'), lit('basic/transpiler.lisp'), lit('basic/bibliothèque.lisp'),
            lit('basic/français.lisp')
        ]);
        ajouteNomsFrançais(sources.français);
    }

    // Les noms français de français.lisp : (link "nom" 'instruction)   ; description
    // Ils rejoignent la coloration, la complétion et l'aide.
    function ajouteNomsFrançais(texte) {
        const lignes = [];
        let section = '';
        texte.split('\n').forEach(l => {
            const titre = l.match(/^; (\S+\.cxx) — (.*)$/);
            if (titre) { section = titre[2]; return; }
            const m = l.match(/^\(link "([^"]+)" '(\S+?)\)\s*;\s*(.*)$/);
            if (!m) return;
            const [, nom, instruction, brut] = m;
            // La signature affichée porte toujours le nom du link (le commentaire peut
            // garder un ancien nom : « insère(l, x, i) » pour insère)
            const description = brut.replace(/^[^\s(:]+/, nom);
            PYTHONERIE_FONCTIONS[nom] = description + '  [LispE : ' + instruction + ']';
            lignes.push({ section, nom, instruction, description });
        });
        // La coloration reconnaît les nouveaux noms : changer de valeur force CodeMirror
        // à recréer le mode (pythonerie et text/x-pythonerie désignent le même)
        if (éditeur) éditeur.setOption('mode', éditeur.getOption('mode') === 'pythonerie' ? 'text/x-pythonerie' : 'pythonerie');
        afficheAideFrançais(lignes);
    }

    function afficheAideFrançais(lignes) {
        const zone = $('aideFrançais');
        if (!zone) return;
        zone.innerHTML = '';
        let table = null, section = null;
        lignes.forEach(l => {
            if (l.section !== section) {
                section = l.section;
                const h = document.createElement('h4');
                h.textContent = section.charAt(0).toUpperCase() + section.slice(1);
                zone.appendChild(h);
                table = document.createElement('table');
                table.className = 'table-aide';
                zone.appendChild(table);
            }
            const tr = document.createElement('tr');
            const td1 = document.createElement('td');
            const code = document.createElement('code');
            code.textContent = l.description.split(' : ')[0];
            td1.appendChild(code);
            const td2 = document.createElement('td');
            td2.textContent = (l.description.split(' : ').slice(1).join(' : ') || '');
            const td3 = document.createElement('td');
            td3.className = 'lispe';
            td3.textContent = l.instruction;
            tr.append(td1, td2, td3);
            table.appendChild(tr);
        });
        $('nbFrançais').textContent = lignes.length;
    }

    function prépareCompilateur() {
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
            '(setq noms_bibliothèque (noms_définis (atob «' + base64(sources.bibliothèque) + '»)))');
        callEvalLispE(idxCompilateur, '(charge_noms_lispe (atob «' + base64(instructions) + '»))');
        // Noms français des instructions LispE (français.lisp), chargés APRÈS le transpileur
        // pour que ses propres noms ne soient pas touchés
        callEvalLispE(idxCompilateur, sources.français);
        callEvalLispE(idxCompilateur, '(charge_noms_français (atob «' + base64(sources.français) + '»))');
    }

    // Renvoie {lispe} ou {erreur}
    function compile(code) {
        try {
            const r = callEvalLispE(idxCompilateur, '(compilepython (atob «' + base64(nfc(code) + '\n') + '»))');
            if (typeof r === 'string' && /^\s*(Erreur|Error)/.test(r)) {
                return { erreur: r.replace(/ :\n>> /g, '\n  ').replace(/ <<\s*$/, '').replace(/ ' /g, "'") };
            }
            return { lispe: r };
        } catch (e) {
            // Après une exception, on repart d'un compilateur neuf
            try { callCleanLispE(idxCompilateur); } catch (e2) { /* rien */ }
            prépareCompilateur();
            return { erreur: nettoieErreur(e) };
        }
    }

    // Ligne de commande de la console : comme compile, mais la valeur d'une expression
    // est affichée (compileconsole). Une comparaison seule (3 > 2) n'est acceptée par la
    // grammaire qu'en argument : on réessaie alors avec _console_valeur(...).
    function compileConsole(code) {
        const essaie = (texte) => {
            const r = callEvalLispE(idxCompilateur, '(compileconsole (atob «' + base64(nfc(texte) + '\n') + '»))');
            return (typeof r === 'string' && /^\s*(Erreur|Error)/.test(r))
                ? { erreur: r.replace(/ :\n>> /g, '\n  ').replace(/ <<\s*$/, '').replace(/ ' /g, "'") }
                : { lispe: r };
        };
        try {
            let c = essaie(code);
            if (c.erreur && /^Erreur de syntaxe/.test(c.erreur) && !code.includes('\n')) {
                const autre = essaie('_console_valeur(' + code + ')');
                if (!autre.erreur) c = autre;
            }
            return c;
        } catch (e) {
            try { callCleanLispE(idxCompilateur); } catch (e2) { /* rien */ }
            prépareCompilateur();
            return { erreur: nettoieErreur(e) };
        }
    }

    // Exécute une ligne de la console dans l'interpréteur du dernier programme :
    // ses variables et ses fonctions sont disponibles.
    function exécuteConsole(code, relancé) {
        if (!wasmPrêt) { écritConsole('LispE est encore en cours de chargement…', 'info'); return; }
        if (!exigeÉlève('Pour exécuter du code, il faut d\'abord dire qui tu es.')) {
            écritConsole('— Tape ton nom (👤 en haut à droite) pour exécuter du code.', 'info');
            return;
        }
        const lignes = code.split('\n');
        if (relancé !== true) {
            écritConsole(lignes.map((l, i) => (i ? '... ' : '>>> ') + l).join('\n'), 'commande');
            fichiersÉcrits = new Set();
            lecture = { fichiers: [], rang: 0 };
        }
        lecture.rang = 0;
        fichierDemandé = false;
        const c = compileConsole(code);
        if (c.erreur) { écritConsole(c.erreur, 'erreur'); return; }
        try {
            if (idxExécution === null) nouvelInterpréteur();
            évalue(idxExécution, c.lispe);
        } catch (e) {
            if (!fichierDemandé) écritConsole(nettoieErreur(e), 'erreur');
        }
        if (fichierDemandé) choisitFichier(() => exécuteConsole(code, true));
        metAJourBoutons();
    }

    // ------------------------------------------------------------------
    // lit_fichier() : un fichier du disque de l'élève. Le navigateur ne peut le lire
    // que si l'élève le choisit lui-même, et le programme ne peut pas attendre ce choix :
    // quand le programme arrive à un lit_fichier() sans fichier, il s'arrête, la fenêtre
    // de sélection s'ouvre, puis le programme repart depuis le début. Les fichiers choisis
    // sont rendus dans l'ordre des appels : le premier lit_fichier() reçoit le premier
    // fichier, le deuxième le deuxième... Ils ne servent que pour l'exécution en cours :
    // une nouvelle exécution les redemande (ils ont pu changer sur le disque).
    // ------------------------------------------------------------------
    let lecture = { fichiers: [], rang: 0 };        // programme et console
    let lectureÉvénements = { fichiers: [], rang: 0 };  // animations, clics, touches
    let fichierDemandé = false;
    // Les fichiers déjà téléchargés par écrit_fichier pendant cette exécution : quand le
    // programme repart après le choix d'un fichier, on ne les télécharge pas une seconde fois
    let fichiersÉcrits = new Set();

    // Appelé par Pyt.écritFichier : Vrai si ce fichier, avec ce texte, est déjà parti
    function déjàÉcrit(nom, texte) {
        const clé = nom + '\u0000' + texte;
        if (fichiersÉcrits.has(clé)) return true;
        fichiersÉcrits.add(clé);
        return false;
    }

    // Appelé par Pyt.litFichier : { contenu } ou { erreur }
    function litFichierLocal() {
        const i = lecture.rang++;
        if (i < lecture.fichiers.length) return { contenu: lecture.fichiers[i] };
        fichierDemandé = true;
        return { erreur: 'il faut choisir un fichier sur ton ordinateur' };
    }

    // Ouvre la fenêtre de sélection du fichier demandé, puis relance
    function choisitFichier(relancer) {
        fichierDemandé = false;
        const numéro = lecture.fichiers.length + 1;
        const quel = numéro === 1 ? 'un fichier' : 'un ' + numéro + 'e fichier';
        Pyt.stoppeTout();
        écritConsole('— Le programme a besoin d\'' + quel + ' : choisis-le sur ton ordinateur.', 'info');
        const entrée = $('fichierDonnées');
        const ouvre = () => {
            entrée.onchange = async () => {
                const f = entrée.files[0];
                entrée.value = '';
                if (!f) return;
                try {
                    lecture.fichiers.push(nfc(await f.text()));
                } catch (e) {
                    écritConsole('Impossible de lire le fichier « ' + f.name + ' » : ' + e.message, 'erreur');
                    return;
                }
                relancer();
            };
            entrée.oncancel = () => écritConsole('— Aucun fichier choisi : le programme est arrêté.', 'info');
            entrée.click();
        };
        // Le navigateur n'ouvre la fenêtre que juste après un clic ou une touche. Après une
        // relance (un deuxième fichier), ce n'est plus le cas : on demande un clic.
        if (!navigator.userActivation || navigator.userActivation.isActive) { ouvre(); return; }
        dialogue('Choisir un fichier', 'Le programme a besoin d\'' + quel + '.',
            [{ texte: '📂 Choisir le fichier', valeur: 'oui', genre: 'principal' }, { texte: 'Annuler', valeur: null }])
            .then(choix => {
                if (choix) ouvre();
                else écritConsole('— Aucun fichier choisi : le programme est arrêté.', 'info');
            });
    }

    function installeLigneDeCommande() {
        const zone = $('saisieConsole');
        let historique = [];
        try { historique = JSON.parse(localStorage.getItem('pythonerie.historique') || '[]'); } catch (e) { /* rien */ }
        let position = historique.length;
        let brouillon = '';
        // à la déconnexion, l'historique de l'élève est effacé
        window.addEventListener('pythonerie-vide', () => { historique = []; position = 0; brouillon = ''; });
        // hauteur : une ligne quand la zone est vide, puis elle grandit avec le texte
        const ajuste = () => {
            zone.style.height = '';
            if (zone.value.includes('\n')) zone.style.height = zone.scrollHeight + 'px';
        };
        // La console rétrécit quand la saisie grandit : si elle montrait ses dernières lignes,
        // elle continue de les montrer (comme un terminal)
        const console_ = $('console');
        let collée = true;
        console_.addEventListener('scroll', () => {
            collée = console_.scrollHeight - console_.scrollTop - console_.clientHeight < 4;
        });
        new ResizeObserver(() => {
            if (collée) console_.scrollTop = console_.scrollHeight;
        }).observe(console_);
        const remplace = (texte) => { zone.value = texte; ajuste(); zone.selectionStart = zone.selectionEnd = texte.length; };
        zone.addEventListener('input', ajuste);
        // un clic dans la console (sans sélectionner de texte) place le curseur dans la ligne de commande
        $('console').addEventListener('click', () => {
            if (!String(window.getSelection())) zone.focus();
        });
        zone.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter' && !ev.shiftKey) {
                // Entrée exécute ; Maj+Entrée passe à la ligne (pour un bloc : pour, si, fonction...)
                ev.preventDefault();
                const code = nfc(zone.value).replace(/\s+$/, '');
                if (!code.trim()) return;
                if (historique[historique.length - 1] !== code) historique.push(code);
                historique = historique.slice(-100);
                try { localStorage.setItem('pythonerie.historique', JSON.stringify(historique)); } catch (e) { /* rien */ }
                position = historique.length;
                brouillon = '';
                remplace('');
                exécuteConsole(code);
                $('console').scrollTop = $('console').scrollHeight;
            } else if (ev.key === 'Enter' && ev.shiftKey) {
                // décalage automatique après une ligne qui se termine par « : »
                ev.preventDefault();
                const avant = zone.value.slice(0, zone.selectionStart);
                const ligne = avant.slice(avant.lastIndexOf('\n') + 1);
                let retrait = ligne.match(/^\s*/)[0];
                if (/:\s*$/.test(ligne)) retrait += '    ';
                zone.setRangeText('\n' + retrait, zone.selectionStart, zone.selectionEnd, 'end');
                ajuste();
            } else if (ev.key === 'Tab') {
                ev.preventDefault();
                zone.setRangeText('    ', zone.selectionStart, zone.selectionEnd, 'end');
            } else if (ev.key === 'ArrowUp' && !zone.value.slice(0, zone.selectionStart).includes('\n')) {
                // les flèches parcourent les commandes déjà tapées
                if (position === 0) return;
                ev.preventDefault();
                if (position === historique.length) brouillon = zone.value;
                position--;
                remplace(historique[position]);
            } else if (ev.key === 'ArrowDown' && !zone.value.slice(zone.selectionEnd).includes('\n')) {
                if (position >= historique.length) return;
                ev.preventDefault();
                position++;
                remplace(position === historique.length ? brouillon : historique[position]);
            }
        });
    }

    function évalue(idx, code) {
        const r = callEvalLispE(idx, nfc(code));
        if (typeof r === 'string' && /^Error:/.test(r)) throw new Error(r);
        return r;
    }

    function nouvelInterpréteur() {
        if (idxExécution !== null) {
            try { callCleanLispE(idxExécution); } catch (e) { /* rien */ }
        }
        idxExécution = callCreateLispE();
        évalue(idxExécution, sources.bibliothèque);
    }

    // Appelé par le canevas (animations, clics, touches)
    function rappel(code) {
        if (idxExécution === null) return;
        // pendant un événement, lit_fichier() puise dans les fichiers choisis pour les événements
        const lectureProgramme = lecture;
        lecture = lectureÉvénements;
        lecture.rang = 0;
        fichierDemandé = false;
        try {
            évalue(idxExécution, code);
        } catch (e) {
            if (!fichierDemandé) {
                Pyt.stoppeTout();
                écritConsole(nettoieErreur(e), 'erreur');
                metAJourBoutons();
            }
        }
        lecture = lectureProgramme;
        // lit_fichier dans une animation ou un clic : le fichier choisi servira la fois suivante
        if (fichierDemandé) choisitFichierPendantAnimation();
    }

    function choisitFichierPendantAnimation() {
        fichierDemandé = false;
        const entrée = $('fichierDonnées');
        entrée.onchange = async () => {
            const f = entrée.files[0];
            entrée.value = '';
            if (f) lectureÉvénements.fichiers.push(nfc(await f.text()));
        };
        entrée.oncancel = null;
        entrée.click();
    }

    // relancé : après le choix d'un fichier pour lit_fichier (on garde les fichiers choisis)
    function exécute(relancé) {
        if (!wasmPrêt) { écritConsole('LispE est encore en cours de chargement…', 'info'); return; }
        if (!exigeÉlève('Pour exécuter un programme, il faut d\'abord dire qui tu es.')) {
            écritConsole('— Tape ton nom (👤 en haut à droite) pour exécuter le programme.', 'info');
            return;
        }
        const code = éditeur.getValue();
        Pyt.stoppeTout();
        Pyt.réinitialise();
        effaceConsole();
        if (relancé !== true) {
            lecture = { fichiers: [], rang: 0 };
            lectureÉvénements = { fichiers: [], rang: 0 };
            fichiersÉcrits = new Set();
        }
        lecture.rang = 0;
        fichierDemandé = false;

        const c = compile(code);
        if (c.erreur) {
            dernierLispE = '';
            afficheLispE();
            écritConsole(c.erreur, 'erreur');
            return;
        }
        dernierLispE = c.lispe;
        afficheLispE();

        const début = performance.now();
        try {
            nouvelInterpréteur();
            évalue(idxExécution, c.lispe);
            const durée = Math.round(performance.now() - début);
            if (fichierDemandé) { /* rien : la fenêtre de sélection s'ouvre ci-dessous */ }
            else if (!Pyt.enCours()) écritConsole('— Programme terminé (' + durée + ' ms)', 'info');
            else écritConsole('— Programme en cours (animation ou événements). Clique sur « Arrêter » pour le stopper.', 'info');
        } catch (e) {
            if (!fichierDemandé) écritConsole(nettoieErreur(e), 'erreur');
            Pyt.stoppeTout();
        }
        if (fichierDemandé) choisitFichier(() => exécute(true));
        metAJourBoutons();
    }

    function arrête() {
        Pyt.stoppeTout();
        écritConsole('— Programme arrêté', 'info');
        metAJourBoutons();
    }

    function afficheLispE() {
        $('codeLispE').textContent = dernierLispE || '(pas encore de code LispE : exécute le programme)';
    }

    function metAJourBoutons() {
        $('btnArrêter').disabled = !Pyt.enCours();
    }

    // ------------------------------------------------------------------
    // Stockage des programmes : toujours dans le navigateur (localStorage)
    // Un programme est désigné par son chemin : "Jeux/Balle" (répertoire Jeux).
    // ------------------------------------------------------------------
    // Tri naturel à la française : « 7. Tortue » avant « 14. Piano », « École » entre « Dessin » et « Fusée »
    const compareNoms = new Intl.Collator('fr', { numeric: true }).compare;
    const parentDe = (chemin) => chemin.includes('/') ? chemin.slice(0, chemin.lastIndexOf('/')) : '';
    const nomDe = (chemin) => chemin.slice(chemin.lastIndexOf('/') + 1);
    const joint = (dossier, nom) => dossier ? dossier + '/' + nom : nom;
    // chemin est-il dans le répertoire dossier (ou est-il ce répertoire) ?
    const estDans = (chemin, dossier) => chemin === dossier || chemin.startsWith(dossier + '/');

    const CLÉ_PROGRAMMES = 'pythonerie.programmes';
    const CLÉ_DOSSIERS = 'pythonerie.dossiers';
    const StockageNavigateur = {
        genre: 'navigateur',
        _lit(clé, défaut) {
            try { return JSON.parse(localStorage.getItem(clé) || défaut); }
            catch (e) { return JSON.parse(défaut); }
        },
        _écrit(clé, valeur) {
            try { localStorage.setItem(clé, JSON.stringify(valeur)); }
            catch (e) { throw new Error('Le navigateur refuse d\'enregistrer (mode privé ?)'); }
        },
        _tout() { return this._lit(CLÉ_PROGRAMMES, '{}'); },
        // Mémorise les répertoires qui n'existent qu'à travers leurs programmes,
        // pour qu'un répertoire vidé ne disparaisse pas (comme un vrai répertoire)
        async _figeDossiers() {
            this._écrit(CLÉ_DOSSIERS, (await this.liste()).dossiers);
        },
        async liste() {
            const tout = this._tout();
            const dossiers = new Set(this._lit(CLÉ_DOSSIERS, '[]'));
            // Les répertoires qui contiennent des programmes existent aussi
            Object.keys(tout).forEach(c => {
                for (let d = parentDe(c); d; d = parentDe(d)) dossiers.add(d);
            });
            return {
                programmes: Object.keys(tout).map(chemin => ({ chemin: nfc(chemin), modifie: tout[chemin].modifie || 0 })),
                dossiers: [...dossiers].map(nfc)
            };
        },
        async lit(chemin) {
            const p = this._tout()[chemin];
            if (!p) throw new Error('Programme introuvable : ' + chemin);
            return p.code;
        },
        async écrit(chemin, code) {
            const tout = this._tout();
            tout[chemin] = { code, modifie: Date.now() / 1000 };
            this._écrit(CLÉ_PROGRAMMES, tout);
        },
        async supprime(chemin) {
            await this._figeDossiers();
            const tout = this._tout();
            delete tout[chemin];
            this._écrit(CLÉ_PROGRAMMES, tout);
        },
        async renomme(ancien, nouveau) {
            await this._figeDossiers();
            const tout = this._tout();
            if (tout[nouveau]) throw new Error('Ce nom existe déjà');
            tout[nouveau] = tout[ancien];
            delete tout[ancien];
            this._écrit(CLÉ_PROGRAMMES, tout);
        },
        async créeDossier(chemin) {
            const dossiers = new Set(this._lit(CLÉ_DOSSIERS, '[]'));
            dossiers.add(chemin);
            this._écrit(CLÉ_DOSSIERS, [...dossiers]);
        },
        // Applique transforme(chemin) -> nouveau chemin aux programmes et aux répertoires
        _déplace(transforme) {
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
            this._écrit(CLÉ_PROGRAMMES, nouveau);
            this._écrit(CLÉ_DOSSIERS, [...new Set(this._lit(CLÉ_DOSSIERS, '[]').map(transforme).filter(d => d))]);
        },
        async renommeDossier(ancien, nouveau) {
            const { programmes: p, dossiers: d } = await this.liste();
            if (d.includes(nouveau) || p.some(x => x.chemin === nouveau)) throw new Error('Ce nom existe déjà');
            if (estDans(nouveau, ancien)) throw new Error('Un répertoire ne peut pas aller dans lui-même');
            await this._figeDossiers();
            this._déplace(c => estDans(c, ancien) ? nouveau + c.slice(ancien.length) : c);
        },
        async supprimeDossier(chemin) {
            const parent = parentDe(chemin);
            await this._figeDossiers();
            this._déplace(c => {
                if (c === chemin) return '';
                return c.startsWith(chemin + '/') ? joint(parent, c.slice(chemin.length + 1)) : c;
            });
        }
    };

    // ------------------------------------------------------------------
    // L'élève : son nom (le « login ») s'affiche en haut ; « inconnu » tant qu'il ne
    // l'a pas tapé. Il est demandé pour exécuter du code et pour créer une archive.
    // Il est gardé pour l'onglet (sessionStorage) : sur un ordinateur partagé,
    // fermer l'onglet déconnecte l'élève.
    // Mode « Utilisateur unique » (par défaut, gardé dans le localStorage) : pas de
    // login, l'utilisateur s'appelle « Unique » et il est connecté en permanence ;
    // le bouton 👤 est désactivé. Décoché dans le menu ☰, on passe en mode
    // « plusieurs élèves », où chacun doit taper son nom.
    // Si config.json contient "multi_utilisateur": true, le mode plusieurs élèves
    // est imposé à tout le monde : la case du menu est désactivée.
    // ------------------------------------------------------------------
    const NOM_UNIQUE = 'Unique';
    const CLÉ_UNIQUE = 'pythonerie.utilisateurUnique';
    let utilisateurUnique = true;
    try { utilisateurUnique = localStorage.getItem(CLÉ_UNIQUE) !== 'non'; } catch (e) { /* rien */ }
    let multiImposé = false;

    // Lit config.json (absent ou illisible : on garde les réglages par défaut)
    async function chargeConfig() {
        let config = {};
        try {
            const r = await fetch('config.json', { cache: 'no-cache' });
            if (r.ok) config = await r.json();
        } catch (e) { /* rien */ }
        if (config && config.multi_utilisateur === true) {
            multiImposé = true;
            utilisateurUnique = false;
        }
    }

    let élève = null;
    try { élève = sessionStorage.getItem('pythonerie.élève'); } catch (e) { /* rien */ }

    // Le nom sous lequel on travaille : « Unique », ou celui que l'élève a tapé
    function nomCourant() {
        return utilisateurUnique ? NOM_UNIQUE : élève;
    }

    function basculeUtilisateurUnique() {
        if (multiImposé) return;
        utilisateurUnique = !utilisateurUnique;
        try { localStorage.setItem(CLÉ_UNIQUE, utilisateurUnique ? 'oui' : 'non'); } catch (e) { /* rien */ }
        // dans les deux sens, on repart sans élève connecté : en mode plusieurs
        // élèves, le nom sera demandé à la première exécution
        changeÉlève(null);
    }

    function changeÉlève(nom) {
        élève = nom || null;
        try {
            if (élève) sessionStorage.setItem('pythonerie.élève', élève);
            else sessionStorage.removeItem('pythonerie.élève');
        } catch (e) { /* rien */ }
        afficheÉlève();
    }

    function afficheÉlève() {
        const nom = nomCourant();
        $('nomÉlève').textContent = nom || 'inconnu';
        $('btnÉlève').classList.toggle('inconnu', !nom);
        $('btnÉlève').disabled = utilisateurUnique;
        $('btnÉlève').title = utilisateurUnique ? 'Mode utilisateur unique : pas besoin de se connecter (voir le menu ☰)'
            : élève ? 'Connecté : ' + élève + ' (cliquer pour se déconnecter)' : 'Se connecter : taper son nom';
        $('btnUtilisateurUnique').setAttribute('aria-checked', String(utilisateurUnique));
        $('btnUtilisateurUnique').disabled = multiImposé;
        if (multiImposé) $('btnUtilisateurUnique').title = 'Le mode plusieurs élèves est imposé par config.json';
        $('btnUtilisateurUnique').textContent = (utilisateurUnique ? '☑' : '☐') + ' Utilisateur unique (sans connexion)';
    }

    // Demande le nom de l'élève ; renvoie Vrai s'il est connecté à la fin
    function demandeÉlève(raison) {
        const texte = (raison ? raison + '\n\n' : '') + 'Ton nom (ou ton identifiant) :';
        const réponse = prompt(texte, élève || '');
        if (réponse === null) return !!élève;
        const nom = nfc(réponse).trim().replace(/\s+/g, ' ');
        if (!nom) { changeÉlève(null); return false; }
        if (nom.length > 40 || !/^[\p{L}\p{N} _\-.]+$/u.test(nom)) {
            alert('Ce nom ne convient pas : utilise des lettres, des chiffres, des espaces, - ou _ (40 caractères au plus).');
            return demandeÉlève(raison);
        }
        changeÉlève(nom);
        return true;
    }

    function exigeÉlève(raison) {
        return utilisateurUnique || !!élève || demandeÉlève(raison);
    }

    // ------------------------------------------------------------------
    // Archives : tous les programmes (et les répertoires) dans un seul fichier,
    // pour les partager ou les retrouver sur un autre ordinateur.
    // ------------------------------------------------------------------
    const FORMAT_ARCHIVE = 'archive-pythonerie';
    const CLÉ_SAUVEGARDE = 'pythonerie.sauvegarde';

    // Tous les programmes en cours : { programmes: {chemin: code}, dossiers: [...] }
    async function instantané() {
        await sauvegarde();
        const contenu = await stockage.liste();
        const progs = {};
        for (const p of contenu.programmes) progs[p.chemin] = await stockage.lit(p.chemin);
        return { programmes: progs, dossiers: contenu.dossiers };
    }

    // Remplace tous les programmes en cours par ceux de l'instantané
    async function remplaceTout(instant) {
        clearTimeout(minuterieSauvegarde);
        modifie = false;
        const tout = {};
        const maintenant = Date.now() / 1000;
        Object.entries(instant.programmes).forEach(([c, code]) => { tout[c] = { code, modifie: maintenant }; });
        StockageNavigateur._écrit(CLÉ_PROGRAMMES, tout);
        StockageNavigateur._écrit(CLÉ_DOSSIERS, instant.dossiers);
        courant = null;
        sélection = new Set();
        dossierCourant = '';
        Pyt.stoppeTout();
        await rafraichitListe();
        if (programmes.length) await ouvre(programmes[0].chemin);
        else await crée('', 'Mon premier programme', PROGRAMME_ACCUEIL);
    }

    // Un chemin d'archive est accepté seulement s'il est fait de noms valides
    function cheminValide(chemin) {
        const morceaux = nfc(String(chemin)).split('/');
        return morceaux.length <= 8 && morceaux.every(m => nomValide(m) === m) ? morceaux.join('/') : null;
    }

    function nomArchive() {
        const d = new Date();
        const n = (x) => String(x).padStart(2, '0');
        const identifiant = nomCourant().replace(/[^\p{L}\p{N}\-]+/gu, '_');
        return identifiant + '_' + d.getFullYear() + '_' + n(d.getMonth() + 1) + '_' + n(d.getDate()) + '_' + n(d.getHours()) + '_' + n(d.getMinutes());
    }

    async function créeArchive() {
        if (!exigeÉlève('Pour créer une archive, il faut d\'abord dire qui tu es.')) return null;
        let instant;
        try { instant = await instantané(); } catch (e) { écritConsole('Impossible de lire les programmes : ' + e.message, 'erreur'); return null; }
        const nom = nomArchive();
        const archive = {
            format: FORMAT_ARCHIVE, version: 1, élève: nomCourant(), créée: new Date().toISOString(),
            programmes: instant.programmes, dossiers: instant.dossiers
        };
        const texte = JSON.stringify(archive, null, 1);
        const blob = new Blob([texte], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = nom + '.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        écritConsole('— Archive « ' + nom + '.json » créée (' + Object.keys(instant.programmes).length
            + ' programmes) : elle est dans le dossier Téléchargements.', 'info');
        if (serveurArchives) await envoieArchive(nom, texte);
        mémoriseArchivé(instant);
        return nom + '.json';
    }

    // ------------------------------------------------------------------
    // Ce qui a été mis dans une archive : une empreinte des programmes au moment de
    // l'archive. À la déconnexion, on compare avec les programmes actuels pour savoir
    // si quelque chose a changé depuis.
    // ------------------------------------------------------------------
    const CLÉ_ARCHIVÉ = 'pythonerie.archivé';

    function empreinte(instant) {
        const chemins = Object.keys(instant.programmes).sort();
        const texte = JSON.stringify([chemins.map(c => [c, instant.programmes[c]]), [...instant.dossiers].sort()]);
        // empreinte FNV-1a sur 32 bits, plus la longueur du texte
        let h = 0x811c9dc5;
        for (let i = 0; i < texte.length; i++) { h ^= texte.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
        return h.toString(16) + '-' + texte.length;
    }

    function mémoriseArchivé(instant) {
        try { localStorage.setItem(CLÉ_ARCHIVÉ, empreinte(instant)); } catch (e) { /* rien */ }
    }

    // Rien à sauvegarder : aucun programme, ou seulement le programme d'accueil intact
    function espaceVide(instant) {
        const codes = Object.values(instant.programmes);
        return codes.length === 0 || (codes.length === 1 && codes[0].trim() === PROGRAMME_ACCUEIL.trim());
    }

    // Fenêtre de dialogue : renvoie la valeur du bouton choisi (null pour Échap)
    function dialogue(titre, texte, boutons) {
        return new Promise(résout => {
            const fond = $('dialogue');
            $('dialogueTitre').textContent = titre;
            $('dialogueTexte').textContent = texte;
            const zone = $('dialogueBoutons');
            zone.innerHTML = '';
            const ferme = (valeur) => {
                fond.classList.remove('visible');
                document.removeEventListener('keydown', clavier, true);
                résout(valeur);
            };
            const clavier = (ev) => { if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); ferme(null); } };
            boutons.forEach(b => {
                const bouton = document.createElement('button');
                bouton.className = 'btn' + (b.genre === 'danger' ? ' danger' : b.genre === 'principal' ? '' : ' btn-secondaire');
                bouton.textContent = b.texte;
                bouton.addEventListener('click', () => ferme(b.valeur));
                zone.appendChild(bouton);
            });
            document.addEventListener('keydown', clavier, true);
            fond.classList.add('visible');
            zone.querySelector('button').focus();
        });
    }

    // ------------------------------------------------------------------
    // Déconnexion : on vérifie que les programmes ont été mis dans une archive,
    // puis tout l'espace de l'élève est vidé (programmes, répertoires, sauvegarde
    // temporaire, historique de la console).
    // ------------------------------------------------------------------
    async function déconnecte() {
        if (utilisateurUnique || !élève) return;
        let instant;
        try { instant = await instantané(); } catch (e) { écritConsole('Impossible de lire les programmes : ' + e.message, 'erreur'); return; }
        let archivé = null;
        try { archivé = localStorage.getItem(CLÉ_ARCHIVÉ); } catch (e) { /* rien */ }
        const nb = Object.keys(instant.programmes).length;
        let choix;
        if (espaceVide(instant)) {
            choix = await dialogue('Te déconnecter, ' + élève + ' ?', 'Il n\'y a pas de programme à garder.',
                [{ texte: 'Me déconnecter', valeur: 'oui', genre: 'principal' }, { texte: 'Annuler', valeur: null }]);
        } else if (empreinte(instant) === archivé) {
            choix = await dialogue('Te déconnecter, ' + élève + ' ?',
                'Tes ' + nb + ' programmes sont dans ton archive, avec leurs dernières modifications.\n'
                + 'Une fois déconnecté, ils seront effacés de cet ordinateur.',
                [{ texte: 'Me déconnecter et effacer mes programmes', valeur: 'oui', genre: 'danger' },
                 { texte: '📦 Créer une nouvelle archive avant', valeur: 'archive' },
                 { texte: 'Annuler', valeur: null }]);
        } else {
            choix = await dialogue('Attention, ' + élève + ' !',
                (archivé ? 'Tu as modifié tes programmes depuis ta dernière archive.'
                         : 'Tu n\'as pas encore créé d\'archive de tes programmes.')
                + '\nUne fois déconnecté, tes ' + nb + ' programmes seront effacés de cet ordinateur.',
                [{ texte: '📦 Créer une archive, puis me déconnecter', valeur: 'archive', genre: 'principal' },
                 { texte: 'Me déconnecter sans archive (tout sera perdu)', valeur: 'oui', genre: 'danger' },
                 { texte: 'Annuler', valeur: null }]);
        }
        if (!choix) return;
        if (choix === 'archive') {
            const nom = await créeArchive();
            if (!nom) return;
            // on ne peut pas savoir si le navigateur a bien enregistré le fichier : on demande
            const suite = await dialogue('As-tu bien ton archive ?',
                'L\'archive « ' + nom + ' » vient d\'être créée.\nVérifie qu\'elle est dans ton dossier Téléchargements avant de te déconnecter.',
                [{ texte: 'Oui, me déconnecter et effacer mes programmes', valeur: 'oui', genre: 'danger' },
                 { texte: 'Annuler', valeur: null }]);
            if (!suite) return;
        }
        await videEspace();
    }

    // Efface du navigateur tout ce qu'a laissé l'élève ; renvoie Faux en cas d'échec
    async function effaceDonnées() {
        try {
            await remplaceTout({ programmes: {}, dossiers: [] });
        } catch (e) {
            écritConsole('Impossible d\'effacer les programmes : ' + e.message, 'erreur');
            return false;
        }
        ['pythonerie.sauvegarde', CLÉ_ARCHIVÉ, 'pythonerie.historique', 'pythonerie.dernier'].forEach(clé => {
            try { localStorage.removeItem(clé); } catch (e) { /* rien */ }
        });
        window.dispatchEvent(new Event('pythonerie-vide'));
        return true;
    }

    async function videEspace() {
        const ancien = élève;
        if (!(await effaceDonnées())) return;
        // l'interpréteur garde les variables du dernier programme : on l'oublie aussi
        if (idxExécution !== null) {
            try { callCleanLispE(idxExécution); } catch (e) { /* rien */ }
            idxExécution = null;
        }
        Pyt.stoppeTout();
        Pyt.réinitialise();
        changeÉlève(null);
        metAJourAnnulation();
        effaceConsole();
        écritConsole('— Au revoir, ' + ancien + ' ! L\'espace a été vidé.', 'info');
    }

    async function chargeArchive(fichier) {
        let archive;
        try {
            archive = JSON.parse(nfc(await fichier.text()));
            if (!archive || archive.format !== FORMAT_ARCHIVE || typeof archive.programmes !== 'object') throw new Error();
        } catch (e) {
            alert('« ' + fichier.name + ' » n\'est pas une archive de la Pythonerie.');
            return;
        }
        // on ne garde que des chemins valides
        const instant = { programmes: {}, dossiers: [] };
        Object.entries(archive.programmes).forEach(([c, code]) => {
            const chemin = cheminValide(c);
            if (chemin && typeof code === 'string') instant.programmes[chemin] = nfc(code);
        });
        (Array.isArray(archive.dossiers) ? archive.dossiers : []).forEach(d => {
            const chemin = cheminValide(d);
            if (chemin) instant.dossiers.push(chemin);
        });
        const nb = Object.keys(instant.programmes).length;
        const auteur = archive.élève ? ' de ' + archive.élève : '';
        let avant;
        try { avant = await instantané(); } catch (e) {
            écritConsole('Chargement abandonné : impossible de lire les programmes en cours (' + e.message + ').', 'erreur');
            return;
        }
        // Rien à perdre (aucun programme, ou le programme d'accueil intact) :
        // ni avertissement, ni sauvegarde temporaire
        const àProtéger = !espaceVide(avant);
        if (àProtéger) {
            if (!confirm('Charger l\'archive' + auteur + ' (' + nb + ' programmes) ?\n\n'
                + 'Elle remplace TOUS les programmes en cours. Tu pourras revenir en arrière avec « Annuler le chargement ».')) return;
            // sauvegarde temporaire des programmes en cours, pour pouvoir annuler
            try {
                localStorage.setItem(CLÉ_SAUVEGARDE, JSON.stringify({ élève, date: new Date().toISOString(), ...avant }));
            } catch (e) {
                écritConsole('Chargement abandonné : impossible de sauvegarder les programmes en cours (' + e.message + ').', 'erreur');
                return;
            }
        } else {
            // une ancienne sauvegarde ne correspond plus à rien : « Annuler » ne doit pas la ramener
            try { localStorage.removeItem(CLÉ_SAUVEGARDE); } catch (e) { /* rien */ }
        }
        try {
            await remplaceTout(instant);
            mémoriseArchivé(await instantané());
        } catch (e) {
            écritConsole('Erreur pendant le chargement de l\'archive : ' + e.message + '. Utilise « Annuler le chargement ».', 'erreur');
        }
        // Des programmes ont été remplacés : l'archive appartient peut-être à un autre élève,
        // on déconnecte (le nom sera redemandé à la prochaine exécution). Si l'espace était
        // vide, l'élève connecté vient simplement de charger son archive : il reste connecté.
        if (àProtéger) changeÉlève(null);
        metAJourAnnulation();
    }

    function sauvegardeTemporaire() {
        try { return JSON.parse(localStorage.getItem(CLÉ_SAUVEGARDE) || 'null'); } catch (e) { return null; }
    }

    async function annuleArchive() {
        const avant = sauvegardeTemporaire();
        if (!avant) return;
        if (!confirm('Revenir aux programmes d\'avant le chargement de l\'archive ?\n\nLes programmes actuels seront remplacés.')) return;
        try {
            await remplaceTout(avant);
        } catch (e) {
            écritConsole('Impossible de revenir en arrière : ' + e.message, 'erreur');
            return;
        }
        try { localStorage.removeItem(CLÉ_SAUVEGARDE); } catch (e) { /* rien */ }
        changeÉlève(avant.élève || null);
        metAJourAnnulation();
        écritConsole('— Les programmes d\'avant le chargement sont revenus.', 'info');
    }

    function metAJourAnnulation() {
        $('btnAnnuleArchive').disabled = !sauvegardeTemporaire();
    }

    // serveur.py garde une copie des archives des élèves (pour l'enseignant).
    // On ne lui envoie rien tant qu'il n'a pas répondu à cette question : en ligne,
    // aucune archive ne part donc sur le réseau.
    let serveurArchives = false;

    async function détecteServeurArchives() {
        // GitHub Pages ne sert que des fichiers : inutile de chercher serveur.py
        if (location.hostname.endsWith('.github.io')) return false;
        try {
            const r = await fetch('api/archives', { cache: 'no-cache' });
            const réponse = r.ok ? await r.json() : null;
            return !!(réponse && réponse.archives === true);
        } catch (e) { return false; }
    }

    // Envoie la copie de l'archive au serveur ; il ne remplace jamais une archive existante
    async function envoieArchive(nom, texte) {
        try {
            const r = await fetch('api/archives/' + encodeURIComponent(nom), {
                method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: texte
            });
            if (!r.ok) throw new Error(await r.text());
            écritConsole('— Une copie est aussi conservée sur le serveur de la classe.', 'info');
        } catch (e) {
            écritConsole('La copie pour l\'enseignant n\'a pas pu être enregistrée sur le serveur : ' + e.message, 'erreur');
        }
    }

    function nomValide(nom) {
        nom = nfc(nom || '').trim();
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
    let pliés = new Set();       // répertoires repliés
    try { pliés = new Set(JSON.parse(localStorage.getItem('pythonerie.pliés') || '[]')); } catch (e) { /* rien */ }
    function enregistrePliés() {
        try { localStorage.setItem('pythonerie.pliés', JSON.stringify([...pliés])); } catch (e) { /* rien */ }
    }

    // Icônes reprises de TamedAgents (app-sessions.js)
    const SVG_CHEVRON = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M5.7 13.7L5 13l4.6-4.6L5 3.7l.7-.7 5.3 5.3-5.3 5.4z"/></svg>';
    const SVG_DOSSIER_OUVERT = '<svg viewBox="0 0 16 16" fill="none"><path d="M1.5 2h4.7l1 1H14.5v1.5H1.5V2z" fill="#C09553"/><path d="M1 5h14l-1.5 9H2.5L1 5z" fill="#DCB67A"/></svg>';
    const SVG_DOSSIER_FERME = '<svg viewBox="0 0 16 16" fill="none"><path d="M1.5 2h4.7l1 1H14.5v10h-13V2z" fill="#C09553"/><path d="M1.5 4.5h13V13h-13V4.5z" fill="#DCB67A"/></svg>';
    const SVG_DONNÉES = '<svg viewBox="0 0 16 16" fill="none"><path d="M3.5 1.5h6l3 3v10h-9z" stroke="currentColor" stroke-width="1.1"/><path d="M9.5 1.5v3h3" stroke="currentColor" stroke-width="1.1"/><path d="M5.5 8h5M5.5 10h5M5.5 12h3" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>';
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
            await déplace(objet.genre, objet.chemin, dossier);
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
        const enfants = dossiers.filter(d => parentDe(d) === dossier).sort(compareNoms);
        const progs = programmes.filter(p => parentDe(p.chemin) === dossier)
            .sort((a, b) => compareNoms(a.chemin, b.chemin));

        enfants.forEach(d => {
            const plié = pliés.has(d);
            const li = ligneArbre(profondeur, 'dossier');
            if (d === dossierCourant) li.classList.add('sélection');
            li.title = d;
            const chevron = document.createElement('span');
            chevron.className = 'arbre-chevron' + (plié ? '' : ' ouvert');
            chevron.innerHTML = SVG_CHEVRON;
            const icône = document.createElement('span');
            icône.className = 'arbre-icône';
            icône.innerHTML = plié ? SVG_DOSSIER_FERME : SVG_DOSSIER_OUVERT;
            const nom = document.createElement('span');
            nom.className = 'programme-nom';
            nom.textContent = nomDe(d);
            li.append(chevron, icône, nom, boutonsActions([
                [SVG_RENOMMER, 'Renommer le répertoire « ' + nomDe(d) + ' »', () => renommeDossier(d)],
                [SVG_SUPPRIMER, 'Supprimer le répertoire « ' + nomDe(d) + ' » (son contenu remonte d\'un niveau)', () => supprimeDossier(d)]
            ]));
            // Un clic sélectionne le répertoire (pour y créer des programmes) et l'ouvre ou le replie
            li.addEventListener('click', () => {
                if (plié) pliés.delete(d); else pliés.add(d);
                enregistrePliés();
                dossierCourant = d;
                afficheArbre();
            });
            rendGlissable(li, 'dossier', d);
            rendCible(li, d);
            ul.appendChild(li);
            if (!plié) afficheDossier(ul, d, profondeur + 1);
        });

        progs.forEach(p => {
            const li = ligneArbre(profondeur, 'programme');
            li.dataset.chemin = p.chemin;
            if (p.chemin === courant) li.classList.add('actif');
            if (sélection.size > 1 && sélection.has(p.chemin)) li.classList.add('choisi');
            li.title = p.chemin;
            const espace = document.createElement('span');
            espace.className = 'arbre-chevron';
            const icône = document.createElement('span');
            icône.className = 'arbre-icône';
            icône.innerHTML = SVG_PROGRAMME;
            const nom = document.createElement('span');
            nom.className = 'programme-nom';
            nom.textContent = nomDe(p.chemin);
            li.append(espace, icône, nom, boutonsActions([
                [SVG_RENOMMER, 'Renommer « ' + nomDe(p.chemin) + ' »', () => renomme(p.chemin)],
                [SVG_EXPORTER, 'Exporter « ' + nomDe(p.chemin) + ' » (télécharger le fichier .py)', () => exporte(p.chemin)],
                [SVG_SUPPRIMER, 'Supprimer « ' + nomDe(p.chemin) + ' »', () => {
                    // la corbeille d'un programme choisi supprime toute la sélection
                    if (sélection.size > 1 && sélection.has(p.chemin)) supprimeSélection();
                    else supprime(p.chemin);
                }]
            ]));
            li.addEventListener('click', (ev) => choisitProgramme(p.chemin, ev));
            rendGlissable(li, 'programme', p.chemin);
            // Déposer sur un programme : on le range dans le même répertoire que lui
            rendCible(li, parentDe(p.chemin));
            ul.appendChild(li);
        });
    }

    // ------------------------------------------------------------------
    // Sélection de plusieurs programmes, comme dans un explorateur de fichiers :
    // Cmd+clic (ou Ctrl+clic) ajoute ou retire un programme, Maj+clic choisit
    // tous les programmes affichés entre le précédent et celui-ci.
    // ------------------------------------------------------------------
    let sélection = new Set();
    let ancre = null;           // le dernier programme choisi, point de départ de Maj+clic

    function programmesAffichés() {
        return [...document.querySelectorAll('#listeProgrammes li.arbre-ligne.programme')].map(li => li.dataset.chemin);
    }

    function choisitProgramme(chemin, ev) {
        if (ev.metaKey || ev.ctrlKey) {
            // discontinu : on ajoute ou on retire (le programme ouvert fait partie de la sélection)
            if (sélection.size === 0 && courant) sélection.add(courant);
            if (sélection.has(chemin)) sélection.delete(chemin); else sélection.add(chemin);
            ancre = chemin;
            afficheArbre();
            return;
        }
        if (ev.shiftKey) {
            // continu : tous les programmes affichés entre l'ancre et celui-ci
            const liste = programmesAffichés();
            const départ = liste.indexOf(ancre || courant);
            const arrivée = liste.indexOf(chemin);
            if (départ < 0) { sélection = new Set([chemin]); ancre = chemin; afficheArbre(); return; }
            const [a, b] = départ < arrivée ? [départ, arrivée] : [arrivée, départ];
            sélection = new Set(liste.slice(a, b + 1));
            afficheArbre();
            return;
        }
        // clic simple : on ouvre le programme et la sélection repart de lui
        sélection = new Set();
        ancre = chemin;
        dossierCourant = parentDe(chemin);
        ouvre(chemin);
    }

    function annuleSélection() {
        if (sélection.size === 0) return;
        sélection = new Set();
        afficheArbre();
    }

    function afficheBandeau() {
        const bandeau = $('bandeauSélection');
        const n = sélection.size;
        bandeau.hidden = n < 2;
        if (n < 2) return;
        bandeau.innerHTML = '';
        const texte = document.createElement('span');
        texte.textContent = n + ' programmes choisis';
        const supprimer = document.createElement('button');
        supprimer.className = 'btn btn-petit danger';
        supprimer.textContent = '🗑️ Supprimer';
        supprimer.title = 'Supprimer les ' + n + ' programmes choisis (touche Suppr)';
        supprimer.addEventListener('click', supprimeSélection);
        const annuler = document.createElement('button');
        annuler.className = 'btn btn-secondaire btn-petit';
        annuler.textContent = 'Annuler';
        annuler.title = 'Ne plus choisir ces programmes (touche Échap)';
        annuler.addEventListener('click', annuleSélection);
        bandeau.append(texte, supprimer, annuler);
    }

    async function supprimeSélection() {
        const chemins = [...sélection].filter(c => programmes.some(p => p.chemin === c));
        if (!chemins.length) return;
        const liste = chemins.slice(0, 12).map(c => '  • ' + c).join('\n') + (chemins.length > 12 ? '\n  …' : '');
        if (!confirm('Supprimer définitivement ces ' + chemins.length + ' programmes ?\n\n' + liste)) return;
        const ouvertSupprimé = chemins.includes(courant);
        if (ouvertSupprimé) clearTimeout(minuterieSauvegarde);
        const échecs = [];
        for (const c of chemins) {
            try { await stockage.supprime(c); } catch (e) { échecs.push(c + ' (' + e.message + ')'); }
        }
        if (échecs.length) écritConsole('Impossible de supprimer : ' + échecs.join(', '), 'erreur');
        sélection = new Set();
        ancre = null;
        if (ouvertSupprimé) { courant = null; modifie = false; }
        await rafraichitListe();
        if (!ouvertSupprimé) return;
        if (programmes.length) await ouvre(programmes[0].chemin);
        else await crée('', 'Mon premier programme', PROGRAMME_ACCUEIL);
    }

    function afficheArbre() {
        // la sélection ne garde que les programmes qui existent encore
        sélection = new Set([...sélection].filter(c => programmes.some(p => p.chemin === c)));
        afficheBandeau();
        const ul = $('listeProgrammes');
        ul.innerHTML = '';
        if (!programmes.length && !dossiers.length) {
            ul.innerHTML = '<li class="liste-vide">Aucun programme</li>';
        }
        afficheDossier(ul, '', 0);
        const ici = dossierCourant ? '« ' + dossierCourant + ' »' : 'la racine';
        $('btnNouveau').title = 'Nouveau programme dans ' + ici;
        $('btnNouveauDossier').title = 'Nouveau répertoire dans ' + ici;
        $('genreStockage').textContent = 'Enregistrés dans ce navigateur'
            + (serveurArchives ? ' — archives aussi conservées sur le serveur de la classe' : '') + (dossierCourant ? ' — nouveaux programmes dans « ' + dossierCourant + ' »' : '');
    }

    async function rafraichitListe() {
        try {
            const contenu = await stockage.liste();
            programmes = contenu.programmes;
            dossiers = contenu.dossiers;
        } catch (e) {
            programmes = [];
            dossiers = [];
            écritConsole('Impossible de lire la liste des programmes : ' + e.message, 'erreur');
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

    function étatSauvegarde(texte, genre) {
        const e = $('étatSauvegarde');
        e.textContent = texte;
        e.className = 'état-sauvegarde ' + (genre || '');
    }

    async function sauvegarde() {
        clearTimeout(minuterieSauvegarde);
        if (!courant || !modifie) return;
        try {
            await stockage.écrit(courant, éditeur.getValue());
            modifie = false;
            étatSauvegarde('Enregistré', 'ok');
        } catch (e) {
            étatSauvegarde('Non enregistré', 'erreur');
            écritConsole('Erreur d\'enregistrement : ' + e.message, 'erreur');
        }
    }

    function sauvegardePlusTard() {
        modifie = true;
        étatSauvegarde('Modifié…', '');
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
            éditeur.setValue(code);
            éditeur.clearHistory();
            chargementEnCours = false;
            courant = chemin;
            modifie = false;
            dossierCourant = parentDe(chemin);
            // On déplie les répertoires qui mènent au programme
            for (let d = parentDe(chemin); d; d = parentDe(d)) pliés.delete(d);
            enregistrePliés();
            afficheTitre();
            étatSauvegarde('Enregistré', 'ok');
            retientCourant();
            await rafraichitListe();
            éditeur.focus();
        } catch (e) {
            écritConsole(e.message, 'erreur');
        }
    }

    // Crée un programme nommé nom dans le répertoire dossier
    async function crée(dossier, nom, code) {
        await sauvegarde();
        const chemin = cheminLibre(dossier, nom);
        try {
            await stockage.écrit(chemin, code);
        } catch (e) {
            écritConsole('Impossible de créer « ' + chemin + ' » : ' + e.message, 'erreur');
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
        await crée(dossierCourant, nom, '# ' + nom + '\n\n');
    }

    async function nouveauDossier() {
        const ici = dossierCourant ? ' (dans « ' + dossierCourant + ' »)' : '';
        const nom = nomValide(prompt('Nom du nouveau répertoire' + ici + ' :', nomDe(cheminLibre(dossierCourant, 'Répertoire'))));
        if (!nom) return;
        const chemin = joint(dossierCourant, nom);
        if (existe(chemin)) { alert('Ce nom existe déjà ici.'); return; }
        try {
            await stockage.créeDossier(chemin);
            pliés.delete(chemin);
            dossierCourant = chemin;
            await rafraichitListe();
        } catch (e) {
            écritConsole('Impossible de créer le répertoire : ' + e.message, 'erreur');
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
            écritConsole('Impossible de renommer ou déplacer : ' + e.message, 'erreur');
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
            écritConsole('Impossible de supprimer : ' + e.message, 'erreur');
            return;
        }
        if (estOuvert) {
            courant = null;
            modifie = false;
        }
        await rafraichitListe();
        if (!estOuvert) return;
        if (programmes.length) await ouvre(programmes[0].chemin);
        else await crée('', 'Mon premier programme', PROGRAMME_ACCUEIL);
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
            écritConsole('Impossible de renommer ou déplacer le répertoire : ' + e.message, 'erreur');
            return;
        }
        const transforme = (c) => estDans(c, ancien) ? nouveau + c.slice(ancien.length) : c;
        if (courant) { courant = transforme(courant); afficheTitre(); retientCourant(); }
        pliés = new Set([...pliés].map(transforme));
        enregistrePliés();
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
            écritConsole('Impossible de supprimer le répertoire : ' + e.message, 'erreur');
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
    async function déplace(genre, chemin, dossier) {
        if (genre === 'programme') {
            if (parentDe(chemin) === dossier) return;
            await changeCheminProgramme(chemin, joint(dossier, nomDe(chemin)));
        } else if (genre === 'dossier') {
            if (parentDe(chemin) === dossier || estDans(dossier, chemin)) return;
            pliés.delete(dossier);
            await changeCheminDossier(chemin, joint(dossier, nomDe(chemin)));
        }
    }

    async function duplique() {
        if (!courant) return;
        await crée(parentDe(courant), nomDe(courant) + ' (copie)', éditeur.getValue());
    }

    async function exporte(chemin = courant) {
        let code;
        try {
            code = chemin === courant ? éditeur.getValue() : await stockage.lit(chemin);
        } catch (e) {
            écritConsole('Impossible d\'exporter : ' + e.message, 'erreur');
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
                await crée(dossierCourant, nom, nfc(lecteur.result));
            };
            lecteur.readAsText(f, 'utf-8');
        });
    }

    // ------------------------------------------------------------------
    // Répertoires du site : « Matériels » (matériels/, le matériel de cours déposé par
    // l'enseignant) et « Exemples » (exemples/). Chacun a son index.json :
    // [{ "fichier", "titre", "description" }]. Ils sont repliés par défaut pour ne pas
    // encombrer la colonne. Un clic sur un programme (.py) en crée une copie ; un clic
    // sur un autre fichier (des données) explique comment le lire avec charge_données.
    // ------------------------------------------------------------------
    async function chargeRépertoireSite({ idListe, répertoire, nom, clé, masquéSiVide }) {
        const ul = $(idListe);
        let ouvert = false;
        try { ouvert = localStorage.getItem(clé) === 'oui'; } catch (e) { /* rien */ }
        let liste;
        try {
            const r = await fetch(répertoire + '/index.json', { cache: 'no-cache' });
            if (!r.ok) throw new Error();
            liste = await r.json();
            if (!Array.isArray(liste)) throw new Error();
        } catch (e) {
            if (masquéSiVide) ul.hidden = true;
            else ul.innerHTML = '<li class="liste-vide">' + nom + ' indisponibles</li>';
            return;
        }
        liste = liste.filter(x => x && typeof x.fichier === 'string').map(x => ({ ...x, fichier: nfc(x.fichier) }));
        if (!liste.length && masquéSiVide) { ul.hidden = true; return; }
        ul.hidden = false;
        const affiche = () => {
            ul.innerHTML = '';
            // la ligne du répertoire
            const dossier = ligneArbre(0, 'dossier');
            dossier.title = ouvert ? 'Replier « ' + nom + ' »' : 'Voir « ' + nom + ' »';
            const chevron = document.createElement('span');
            chevron.className = 'arbre-chevron' + (ouvert ? ' ouvert' : '');
            chevron.innerHTML = SVG_CHEVRON;
            const icône = document.createElement('span');
            icône.className = 'arbre-icône';
            icône.innerHTML = ouvert ? SVG_DOSSIER_OUVERT : SVG_DOSSIER_FERME;
            const titreDossier = document.createElement('span');
            titreDossier.className = 'programme-nom';
            titreDossier.textContent = nom;
            const nombre = document.createElement('span');
            nombre.className = 'nombre-exemples';
            nombre.textContent = liste.length;
            dossier.append(chevron, icône, titreDossier, nombre);
            dossier.addEventListener('click', () => {
                ouvert = !ouvert;
                try { localStorage.setItem(clé, ouvert ? 'oui' : 'non'); } catch (e) { /* rien */ }
                affiche();
            });
            ul.appendChild(dossier);
            if (!ouvert) return;
            // le contenu, un cran plus loin, comme les programmes d'un répertoire
            liste.forEach(élément => {
                const programme = /\.py$/i.test(élément.fichier);
                const titre = élément.titre || élément.fichier;
                const li = ligneArbre(1, 'programme');
                li.title = (élément.description ? élément.description + ' — ' : '')
                    + (programme ? 'un clic crée une copie que tu peux modifier' : 'données : un clic montre comment les lire');
                const espace = document.createElement('span');
                espace.className = 'arbre-chevron';
                const icôneÉl = document.createElement('span');
                icôneÉl.className = 'arbre-icône';
                icôneÉl.innerHTML = programme ? SVG_PROGRAMME : SVG_DONNÉES;
                const texte = document.createElement('span');
                texte.className = 'programme-nom';
                texte.textContent = titre;
                li.append(espace, icôneÉl, texte);
                li.addEventListener('click', async () => {
                    if (!programme) {
                        écritConsole('— « ' + élément.fichier + ' »' + (élément.description ? ' : ' + élément.description : '')
                            + '\n   Pour le lire dans un programme : texte = charge_données("' + élément.fichier + '")', 'info');
                        return;
                    }
                    try {
                        const rc = await fetch(répertoire + '/' + élément.fichier.split('/').map(encodeURIComponent).join('/'), { cache: 'no-cache' });
                        if (!rc.ok) throw new Error('« ' + élément.fichier + ' » est introuvable');
                        await crée(dossierCourant, titre.replace(/\.py$/i, ''), nfc(await rc.text()));
                    } catch (e) {
                        écritConsole(e.message, 'erreur');
                    }
                });
                ul.appendChild(li);
            });
        };
        affiche();
    }

    function chargeRépertoiresSite() {
        chargeRépertoireSite({ idListe: 'listeMatériels', répertoire: 'matériels', nom: 'Matériels',
            clé: 'pythonerie.matérielsOuverts', masquéSiVide: true });
        chargeRépertoireSite({ idListe: 'listeExemples', répertoire: 'exemples', nom: 'Exemples',
            clé: 'pythonerie.exemplesOuverts', masquéSiVide: false });
    }

    // charge_données(nom) : un fichier du répertoire matériels/ du site (lecture synchrone :
    // le programme attend le contenu). { contenu } ou { erreur }
    function chargeDonnées(nom) {
        nom = nfc(String(nom)).trim().replace(/^matériels\//, '');
        const morceaux = nom.split('/');
        if (!nom || /^[a-z]+:/i.test(nom) || morceaux.some(m => !m || m === '.' || m === '..')) {
            return { erreur: 'nom de données invalide : « ' + nom + ' » (le nom d\'un fichier du répertoire Matériels)' };
        }
        const requête = new XMLHttpRequest();
        try {
            requête.open('GET', 'matériels/' + morceaux.map(encodeURIComponent).join('/'), false);
            requête.overrideMimeType('text/plain; charset=utf-8');
            requête.send();
        } catch (e) {
            return { erreur: 'impossible de lire les données « ' + nom + ' »' };
        }
        if (requête.status !== 200) return { erreur: 'les données « ' + nom + ' » ne sont pas dans le répertoire Matériels' };
        return { contenu: nfc(requête.responseText) };
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

    function installeÉditeur() {
        const sombre = document.body.classList.contains('dark-mode');
        éditeur = CodeMirror.fromTextArea($('éditeur'), {
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
                'Ctrl-Enter': exécute,
                'Cmd-Enter': exécute,
                'Ctrl-S': () => { modifie = true; sauvegarde(); },
                'Cmd-S': () => { modifie = true; sauvegarde(); },
                'Ctrl-Space': (cm) => cm.showHint({ hint: pythonerieComplétion, completeSingle: false }),
                'Ctrl-/': 'toggleComment',
                'Cmd-/': 'toggleComment'
            }
        });
        // Tout ce qui entre dans l'éditeur (frappe, collage, programme ouvert) est mis en NFC
        éditeur.on('beforeChange', (cm, changement) => {
            if (!changement.update) return;
            const texte = changement.text.map(nfc);
            if (texte.some((ligne, i) => ligne !== changement.text[i])) {
                changement.update(changement.from, changement.to, texte);
            }
        });
        éditeur.on('change', () => { if (!chargementEnCours) sauvegardePlusTard(); });
        éditeur.on('inputRead', (cm, ev) => {
            if (ev.origin !== '+input' || !/^[\wÀ-ÿ]$/.test(ev.text[0])) return;
            const cur = cm.getCursor();
            const avant = cm.getLine(cur.line).slice(0, cur.ch);
            if (/(^|[^\wÀ-ÿ"'])[\wÀ-ÿ]{3}$/.test(avant) && !/#/.test(avant)) {
                cm.showHint({ hint: pythonerieComplétion, completeSingle: false });
            }
        });
    }

    // ------------------------------------------------------------------
    // Interface
    // ------------------------------------------------------------------
    function basculeThème() {
        const sombre = document.body.classList.toggle('dark-mode');
        éditeur.setOption('theme', sombre ? 'dracula' : 'default');
        try { localStorage.setItem('pythonerie.thème', sombre ? 'sombre' : 'clair'); } catch (e) { /* rien */ }
    }

    function basculeLispE() {
        const panneau = $('panneauLispE');
        const visible = panneau.classList.toggle('visible');
        $('btnLispE').classList.toggle('actif', visible);
        afficheLispE();
    }

    function téléchargeImage() {
        const a = document.createElement('a');
        try {
            a.href = Pyt.image();
        } catch (e) {
            // une image chargée depuis un autre site, sans autorisation, « verrouille » le canevas
            écritConsole('Erreur : impossible d\'enregistrer le dessin, il contient une image venant d\'un autre site.', 'erreur');
            return;
        }
        a.download = (courant || 'dessin') + '.png';
        a.click();
    }

    // Glisser la séparation entre l'éditeur et le canevas
    function installeSéparateur() {
        const sep = $('séparateur');
        const grille = $('espace');
        let départ = null;
        sep.addEventListener('mousedown', (ev) => {
            départ = { x: ev.clientX, largeur: $('zoneCanevas').getBoundingClientRect().width };
            document.body.classList.add('redimensionne');
            ev.preventDefault();
        });
        window.addEventListener('mousemove', (ev) => {
            if (!départ) return;
            const l = Math.min(Math.max(départ.largeur - (ev.clientX - départ.x), 260), window.innerWidth * 0.7);
            grille.style.setProperty('--largeur-canevas', l + 'px');
            éditeur.refresh();
        });
        window.addEventListener('mouseup', () => {
            if (!départ) return;
            départ = null;
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
        $('btnExécuter').addEventListener('click', exécute);
        $('btnArrêter').addEventListener('click', arrête);
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
        // une première fois pour se connecter, une deuxième fois pour se déconnecter
        $('btnÉlève').addEventListener('click', () => { if (élève) déconnecte(); else demandeÉlève(); });
        $('btnCréeArchive').addEventListener('click', créeArchive);
        $('btnChargeArchive').addEventListener('click', () => $('fichierArchive').click());
        $('fichierArchive').addEventListener('change', (ev) => {
            const f = ev.target.files[0];
            ev.target.value = '';
            if (f) chargeArchive(f);
        });
        $('btnAnnuleArchive').addEventListener('click', annuleArchive);
        $('btnUtilisateurUnique').addEventListener('click', basculeUtilisateurUnique);
        $('fichierImport').addEventListener('change', (ev) => { importe(ev.target.files); ev.target.value = ''; });
        $('btnEffaceConsole').addEventListener('click', effaceConsole);
        $('btnEffaceCanevas').addEventListener('click', () => { Pyt.stoppeTout(); Pyt.réinitialise(); metAJourBoutons(); });
        $('btnImage').addEventListener('click', téléchargeImage);
        $('btnThème').addEventListener('click', basculeThème);
        $('btnAide').addEventListener('click', () => $('aide').classList.add('visible'));
        $('fermeAide').addEventListener('click', () => $('aide').classList.remove('visible'));
        $('aide').addEventListener('click', (ev) => { if (ev.target.id === 'aide') $('aide').classList.remove('visible'); });
        window.addEventListener('keydown', (ev) => {
            if (ev.key === 'Escape') $('aide').classList.remove('visible');
            // Suppr / Échap sur une sélection de programmes, sauf pendant la frappe
            const cible = ev.target;
            if (cible && cible.closest && cible.closest('.CodeMirror, input, textarea, select')) return;
            if (sélection.size > 1 && (ev.key === 'Delete' || ev.key === 'Backspace')) { ev.preventDefault(); supprimeSélection(); }
            else if (sélection.size > 1 && ev.key === 'Escape') annuleSélection();
        });
        window.addEventListener('beforeunload', () => { if (modifie) sauvegarde(); });
    }

    async function démarre() {
        try {
            if (localStorage.getItem('pythonerie.thème') === 'sombre') document.body.classList.add('dark-mode');
        } catch (e) { /* rien */ }
        installeÉditeur();
        installeBoutons();
        installeLigneDeCommande();
        installeSéparateur();
        effaceConsole();
        Pyt.installe($('canevas'), $('coucheTortue'), rappel);
        metAJourBoutons();

        stockage = StockageNavigateur;
        serveurArchives = await détecteServeurArchives();
        await chargeConfig();
        // Mode plusieurs élèves imposé par config.json : chaque nouvelle session (nouvel
        // onglet, navigateur relancé) commence avec un espace vide, même si l'élève
        // précédent est parti sans se déconnecter. Un simple rechargement de la page
        // (même onglet) garde le travail en cours.
        let nouvelleSession = true;
        try {
            nouvelleSession = !sessionStorage.getItem('pythonerie.session');
            sessionStorage.setItem('pythonerie.session', 'oui');
        } catch (e) { /* rien */ }
        if (multiImposé && nouvelleSession) await effaceDonnées();
        afficheÉlève();
        metAJourAnnulation();
        await rafraichitListe();
        chargeRépertoiresSite();

        let dernier = null;
        try { dernier = localStorage.getItem('pythonerie.dernier'); } catch (e) { /* rien */ }
        if (dernier && programmes.some(p => p.chemin === dernier)) await ouvre(dernier);
        else if (programmes.length) await ouvre(programmes[0].chemin);
        else await crée('', 'Mon premier programme', PROGRAMME_ACCUEIL);
    }

    // Appelé quand le WebAssembly de LispE est prêt
    async function lispePrêt() {
        try {
            await chargeSources();
            prépareCompilateur();
            wasmPrêt = true;
            $('btnExécuter').disabled = false;
            $('étatLispE').textContent = 'LispE prêt';
            $('étatLispE').className = 'état-lispe ok';
        } catch (e) {
            $('étatLispE').textContent = 'LispE indisponible';
            $('étatLispE').className = 'état-lispe erreur';
            écritConsole('Impossible de préparer LispE : ' + (e.message || e), 'erreur');
        }
    }

    // Sortie standard de LispE. En cas d'erreur, le WebAssembly y écrit aussi la pile
    // d'appels, une ligne vide et le message brut (« message, line: 3 in: main », précédé
    // de « Error: » sauf pour lever) : on ne les montre pas, l'erreur est affichée proprement.
    const MESSAGE_BRUT = /line: \d+ in: /;
    let aprèsPile = false;
    function sortie(texte) {
        if (LIGNE_PILE.test(texte) || /^Error: /.test(texte) && MESSAGE_BRUT.test(texte)) {
            aprèsPile = true;
            return;
        }
        if (aprèsPile && texte === '') return;
        if (aprèsPile && MESSAGE_BRUT.test(texte)) { aprèsPile = false; return; }
        aprèsPile = false;
        écritConsole(texte, 'sortie');
    }

    return {
        démarre, lispePrêt, exécute, effaceConsole, sortie, écrisPartiel, litFichierLocal, déjàÉcrit, chargeDonnées,
        erreur: (texte) => écritConsole(texte, 'erreur'),
        signaleAnimation: () => { if ($('btnArrêter')) metAJourBoutons(); },
        compile // utile pour les tests depuis la console du navigateur
    };
})();

window.Pythonerie = Pythonerie;
