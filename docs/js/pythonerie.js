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

    // Le texte de la console, une ligne par message (sans le texte d'accueil d'une console vide)
    function texteDeLaConsole() {
        return [...$('console').querySelectorAll('.console-ligne')].map(d => d.textContent).join('\n');
    }

    // Copie le texte dans le presse-papiers ; le bouton affiche « ✓ Copié » un instant
    async function copieTexte(texte, bouton) {
        let fait = false;
        try { await navigator.clipboard.writeText(texte); fait = true; }
        catch (e) {
            // sans l'API du presse-papiers (page servie en http par une autre machine, par exemple)
            const zone = document.createElement('textarea');
            zone.value = texte;
            zone.style.position = 'fixed';
            zone.style.opacity = '0';
            document.body.appendChild(zone);
            zone.select();
            try { fait = document.execCommand('copy'); } catch (x) { fait = false; }
            zone.remove();
        }
        if (!bouton) return;
        const avant = bouton.dataset.texte || bouton.textContent;
        bouton.dataset.texte = avant;
        bouton.textContent = fait ? '✓ Copié' : '✗ Impossible';
        clearTimeout(bouton._minuterie);
        bouton._minuterie = setTimeout(() => { bouton.textContent = avant; }, 1200);
    }

    function effaceConsole() {
        ligneOuverte = null;
        $('console').innerHTML = '<div class="console-vide">Les messages de ton programme s\'afficheront ici.</div>';
    }

    // Les messages d'erreur de LispE, traduits et simplifiés : voir js/erreurs.js
    const { nettoieErreur, pileDe, LIGNE_PILE } = ErreursLispE;

    // ------------------------------------------------------------------
    // Où une erreur d'exécution s'est produite. LispE donne la pile d'appels, avec la ligne
    // du code LispE de chaque étape (voir pileDe) ; chaque ligne tombe dans un (defun nom ...)
    // du code produit pour le programme (dernierLispE), et nom se retrouve dans le programme
    // de l'élève, ou dans un programme importé (« fonction nom(...) »). Le message dit alors :
    //    dans la fonction élèves_remplis (définie ligne 55 ; ligne 44 du code LispE)
    //    appelée par dessine, elle-même appelée par commande
    // et un clic sur l'erreur mène à la fonction. contexte : "programme" (une ligne hors de toute
    // fonction est le programme principal) ; "événement" ou "console" : le code évalué n'est pas
    // dernierLispE (l'appel d'une fonction par le canevas, ou une ligne >>>), ses lignes ne disent rien.
    // ------------------------------------------------------------------
    let fonctionsLispE = { code: null, liste: [] };

    // Les (defun nom ...) du code LispE : [{ nom, début, fin }] (lignes, à partir de 1)
    function fonctionsDuCode(code) {
        if (fonctionsLispE.code === code) return fonctionsLispE.liste;
        const liste = [], ouvertes = [];
        let ligne = 1, dansChaîne = false;
        for (let i = 0; i < code.length; i++) {
            const c = code[i];
            if (c === '\n') { ligne++; continue; }
            if (dansChaîne) {
                if (c === '\\') i++;
                else if (c === '"') dansChaîne = false;
                continue;
            }
            if (c === '"') dansChaîne = true;
            else if (c === '(') {
                const m = /^\((?:defun|defmacro|defpat)\s+([^\s()"]+)/.exec(code.slice(i, i + 120));
                ouvertes.push(m ? { nom: m[1], début: ligne } : null);
            } else if (c === ')') {
                const f = ouvertes.pop();
                if (f) liste.push({ nom: f.nom, début: f.début, fin: ligne });
            }
        }
        fonctionsLispE = { code, liste };
        return liste;
    }

    // La fonction (la plus intérieure) qui contient cette ligne du code LispE, ou null
    function fonctionDeLaLigne(liste, n) {
        let trouvée = null;
        for (const f of liste) {
            if (f.début <= n && n <= f.fin && (!trouvée || f.début >= trouvée.début)) trouvée = f;
        }
        return trouvée;
    }

    // Où est définie la fonction nom (du code LispE) : { chemin, ligne, nom } dans le programme
    // ouvert, puis dans les autres programmes du projet ; une fonction renommée par le
    // transpileur (une fonction de l'élève qui porte le nom d'une fonction de la
    // bibliothèque : somme -> somme_perso) est cherchée sous son nom d'origine
    function définitionDeFonction(nom) {
        const noms = [nom];
        if (nom.endsWith('_perso')) noms.push(nom.slice(0, -'_perso'.length));
        const programmes = [[courant, éditeur.getValue()]];
        const tout = StockageNavigateur._tout();
        Object.keys(tout).sort(compareNoms).forEach(c => { if (c !== courant) programmes.push([c, tout[c].code || '']); });
        for (const n of noms) {
            for (const [chemin, code] of programmes) {
                const p = positionDéfinition(code, n);
                if (p) return { chemin, nom: n, ligne: code.slice(0, p.début).split('\n').length };
            }
        }
        return null;
    }

    // { texte, aller } pour cette erreur, ou null si l'on ne sait pas où elle s'est produite
    function localiseErreur(e, contexte) {
        if (!dernierLispE) return null;
        const liste = fonctionsDuCode(dernierLispE);
        const étapes = [];      // [{ nom, ligne }] : la fonction de chaque étape, sans répétition
        for (const { ligne } of pileDe(e)) {
            if (ligne === null) continue;
            const f = fonctionDeLaLigne(liste, ligne);
            const nom = f ? f.nom : contexte === 'programme' ? null : undefined;
            if (nom === undefined) continue;
            if (étapes.length && étapes[étapes.length - 1].nom === nom) continue;
            étapes.push({ nom, ligne });
        }
        if (!étapes.length) return null;
        const [première, ...suite] = étapes;
        let texte, aller = null;
        if (première.nom === null) {
            texte = '   dans le programme principal (ligne ' + première.ligne + ' du code LispE)';
        } else {
            const déf = définitionDeFonction(première.nom);
            const où = déf ? 'définie ligne ' + déf.ligne + (déf.chemin !== courant ? ' de « ' + déf.chemin + ' »' : '') + ' ; ' : '';
            texte = '   dans la fonction ' + (déf ? déf.nom : première.nom) + ' (' + où + 'ligne ' + première.ligne + ' du code LispE)';
            if (déf) aller = async () => {
                retiensOùOnEst();
                if (déf.chemin !== courant) await ouvre(déf.chemin);
                const p = positionDéfinition(éditeur.getValue(), déf.nom);
                if (p) montreDéfinition(éditeur.getValue(), p);
            };
        }
        const appelants = suite.map(é => é.nom === null ? 'le programme principal' : (définitionDeFonction(é.nom) || { nom: é.nom }).nom);
        if (appelants.length) texte += '\n   appelée par ' + appelants.join(', elle-même appelée par ');
        return { texte, aller, fonction: aller ? (définitionDeFonction(première.nom) || {}).nom : null };
    }

    // Une erreur d'exécution, dans la console : le message, puis où elle s'est produite ;
    // un clic sur le message mène à la fonction
    function écritErreur(e, contexte) {
        let lieu = null;
        try { lieu = localiseErreur(e, contexte); } catch (x) { lieu = null; }
        écritConsole(nettoieErreur(e, lieu ? lieu.texte : ''), 'erreur');
        if (lieu && lieu.aller) {
            const div = $('console').lastElementChild;
            div.classList.add('erreur-cliquable');
            div.title = 'Aller à la fonction « ' + lieu.fonction + ' »';
            div.addEventListener('click', lieu.aller);
        }
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
        // les médias du site (médias/...), pour liste_sons() et les applications Web ;
        // la liste est écrite par version.py
        try {
            const r = await fetch('médias/index.json', { cache: 'no-cache' });
            médiasSite = r.ok ? (await r.json()).map(nfc) : [];
        } catch (e) { médiasSite = []; }
    }
    let médiasSite = [];

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
    function exécuteConsole(code) {
        if (!wasmPrêt) { écritConsole('LispE est encore en cours de chargement…', 'info'); return; }
        if (!exigeÉlève('Pour exécuter du code, il faut d\'abord dire qui tu es.')) {
            écritConsole(classe ? '— Connecte-toi avec ton identifiant (👤 en haut à droite), puis recommence.'
                                : '— Tape ton nom (👤 en haut à droite) pour exécuter du code.', 'info');
            return;
        }
        const lignes = code.split('\n');
        écritConsole(lignes.map((l, i) => (i ? '... ' : '>>> ') + l).join('\n'), 'commande');
        donnéesRetenues = false;
        oubliePile();
        // la console peut aussi importer un programme du projet
        let source = code;
        try { source = assembleProgramme(code, courant, []).source; }
        catch (e) { écritConsole('Erreur : ' + e.message, 'erreur'); return; }
        const c = compileConsole(source);
        if (c.erreur) { écritConsole(c.erreur, 'erreur'); return; }
        try {
            if (idxExécution === null) nouvelInterpréteur();
            évalue(idxExécution, c.lispe);
        } catch (e) {
            écritErreur(e, 'console');
        }
        metAJourBoutons();
    }

    // ------------------------------------------------------------------
    // importe "outils" (ou importe "jeux/outils") : le programme « outils » du projet est
    // placé avant celui qui l'importe, et le tout est compilé d'un bloc : ses fonctions et
    // ses variables deviennent disponibles. On le cherche à partir du répertoire du
    // programme qui importe, puis à la racine. Chaque programme n'est importé qu'une fois ;
    // un import en boucle est une erreur. La ligne importe reste en commentaire, pour
    // garder les numéros de ligne.
    // ------------------------------------------------------------------
    const LIGNE_IMPORTE = /^importe\s+(["'])(.+?)\1\s*(#.*)?$/;

    // le code d'un programme du projet (celui qui est ouvert : tel qu'il est dans l'éditeur)
    // « #__main__ » en première ligne : le programme principal (un commentaire, ignoré à l'exécution)
    const estPrincipal = (code) => /^\uFEFF?\s*#\s*__main__\s*$/.test(String(code || '').split('\n', 1)[0]);

    function codeDuProgramme(chemin) {
        if (chemin === courant) return éditeur.getValue();
        const tout = StockageNavigateur._tout();
        return tout[chemin] ? tout[chemin].code : null;
    }

    function trouveProgramme(nom, depuis) {
        nom = nfc(nom).trim().replace(/\.pyf?$/i, '').replace(/^\/+|\/+$/g, '');
        const tout = StockageNavigateur._tout();
        const existe = (c) => c in tout || c === courant;
        const ici = depuis ? parentDe(depuis) : '';
        if (ici && existe(joint(ici, nom))) return joint(ici, nom);
        return existe(nom) ? nom : null;
    }

    // les lignes que compte l'analyse : une chaîne longue sur plusieurs lignes en compte une
    function lignesLogiques(texte) {
        return texte.replace(/"{3}[\s\S]*?"{3}|'{3}[\s\S]*?'{3}/g, 'X').split('\n').length;
    }

    // { source, morceaux: [{ nom, lignes }] } ; nom : null pour les données, '' pour le programme
    function assembleProgramme(code, chemin, défs) {
        const faits = new Set();
        const modules = [];
        const traite = (cheminProg, texte, pile) => {
            const lignes = texte.split('\n');
            for (let i = 0; i < lignes.length; i++) {
                const m = LIGNE_IMPORTE.exec(lignes[i]);
                if (!m) continue;
                const où = (cheminProg && cheminProg !== chemin ? ' (dans « ' + cheminProg + ' », ligne ' : ' (ligne ') + (i + 1) + ')';
                const cible = trouveProgramme(m[2], cheminProg);
                if (!cible) throw new Error('importe : il n\'y a pas de programme « ' + m[2] + ' » dans le projet' + où);
                if (pile.includes(cible)) throw new Error('importe : les programmes s\'importent en boucle : ' + [...pile, cible].join(' → '));
                lignes[i] = '# ' + lignes[i];
                if (faits.has(cible)) continue;
                faits.add(cible);
                // un programme importé est placé après ceux qu'il importe lui-même
                modules.push({ chemin: cible, texte: traite(cible, codeDuProgramme(cible), [...pile, cible]) });
            }
            return lignes.join('\n');
        };
        const principal = traite(chemin, code, chemin ? [chemin] : []);
        const morceaux = [];
        let source = '';
        if (défs.length) { source += défs.join('\n') + '\n'; morceaux.push({ nom: null, lignes: défs.length }); }
        modules.forEach(m => { source += m.texte + '\n'; morceaux.push({ nom: m.chemin, lignes: lignesLogiques(m.texte) }); });
        source += principal;
        morceaux.push({ nom: '', lignes: Infinity });
        return { source, morceaux };
    }

    // « Erreur ligne 12 » : la ligne dans le programme, ou dans le programme importé
    function placeLignes(message, morceaux) {
        if (morceaux.length === 1) return message;
        return message.replace(/\b(ligne|line:?) (\d+)/g, (tout, mot, n) => {
            let k = Number(n);
            for (const m of morceaux) {
                if (k <= m.lignes) {
                    if (m.nom === null) return mot + ' ' + k + ' des données';
                    return m.nom ? mot + ' ' + k + ' de « ' + m.nom + ' »' : mot + ' ' + k;
                }
                k -= m.lignes;
            }
            return tout;
        });
    }

    // ------------------------------------------------------------------
    // Les attentes (demande, lire, lit_fichier) : rien ne bloque la page, et aucune ne relance
    // le programme (voir Pyt.attends, dans canevas.js). Ici, la question de lire(), qui attend
    // sa réponse dans la ligne sous la console ; { ligne, répond, abandonne }, ou null
    // ------------------------------------------------------------------
    let questionConsole = null;

    function poseQuestionConsole(question, répond, abandonne) {
        const ligne = écritQuestion(question, null);
        poseQuestion(question);
        questionConsole = { ligne, répond, abandonne };
    }

    function fermeQuestionConsole() {
        if (!questionConsole) return;
        questionConsole = null;
        fermeQuestion();
    }

    // La question dans la console, suivie de la réponse (null : pas encore de réponse) ;
    // renvoie la ligne de la question
    function écritQuestion(question, réponse) {
        let ligne = ligneOuverte;              // après écris("…"), la question continue la ligne
        ligneOuverte = null;
        if (!ligne) {
            écritConsole(question, 'question');
            ligne = $('console').lastElementChild;
        } else if (question) {
            ligne.appendChild(document.createTextNode(question));
        }
        if (réponse !== null) {
            const r = document.createElement('span');
            r.className = 'réponse-élève';
            r.textContent = (question && !/\s$/.test(question) ? ' ' : '') + réponse;
            ligne.appendChild(r);
        }
        $('console').scrollTop = $('console').scrollHeight;
        return ligne;
    }

    // La ligne sous la console attend la réponse à la question (déjà écrite dans la console)
    function poseQuestion(question) {
        const zone = $('saisieConsole');
        zone.closest('.saisie-console').classList.add('en-question');
        zone.closest('.saisie-console').querySelector('.invite').textContent = '?';
        zone.value = '';
        zone.style.height = '';
        zone.placeholder = 'Ta réponse, puis Entrée (Échap : abandonner la question)';
        zone.setAttribute('aria-label', 'Réponse à la question : ' + question);
        zone.focus();
    }

    function fermeQuestion() {
        const zone = $('saisieConsole');
        zone.closest('.saisie-console').classList.remove('en-question');
        zone.closest('.saisie-console').querySelector('.invite').textContent = '>>>';
        zone.placeholder = 'Tape un nom de variable ou du code, puis Entrée';
        zone.setAttribute('aria-label', 'Ligne de commande : tape un nom de variable ou une ligne de code, puis Entrée');
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
            // une question de lire() : Entrée répond (la fonction de rappel reçoit la réponse),
            // Échap abandonne la question
            if (questionConsole) {
                if (ev.key === 'Enter') {
                    ev.preventDefault();
                    const r = nfc(zone.value), q = questionConsole;
                    remplace('');
                    fermeQuestionConsole();
                    const span = document.createElement('span');
                    span.className = 'réponse-élève';
                    span.textContent = (/\s$/.test(q.ligne.textContent) ? '' : ' ') + r;
                    q.ligne.appendChild(span);
                    q.répond(r);
                } else if (ev.key === 'Escape') {
                    ev.preventDefault();
                    const q = questionConsole;
                    remplace('');
                    fermeQuestionConsole();
                    écritConsole('— Question abandonnée.', 'info');
                    q.abandonne();
                }
                return;
            }
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
        try {
            évalue(idxExécution, code);
        } catch (e) {
            Pyt.stoppeTout();
            écritErreur(e, 'événement');
            metAJourBoutons();
        }
    }

    let numéroExécution = 0;     // une exécution qui attend ses sons est abandonnée si une autre commence
    async function exécute() {
        if (!wasmPrêt) { écritConsole('LispE est encore en cours de chargement…', 'info'); return; }
        sauveFichier();                 // le fichier de données ouvert : charge_données le lira tel qu'on l'a tapé
        if (!exigeÉlève('Pour exécuter un programme, il faut d\'abord dire qui tu es.')) {
            écritConsole(classe ? '— Connecte-toi avec ton identifiant (👤 en haut à droite), puis clique de nouveau sur ▶ Exécuter.'
                                : '— Tape ton nom (👤 en haut à droite) pour exécuter le programme.', 'info');
            return;
        }
        if (!courant) {
            écritConsole('— Ton projet est vide : crée d\'abord un programme (bouton ＋ au-dessus de l\'éditeur).', 'info');
            return;
        }
        // en plein écran du code, on ne verrait ni la console ni le canevas
        if (zonePleine === 'code') quitteZonePleine();
        const code = éditeur.getValue();
        Pyt.stoppeTout();
        Pyt.réinitialise();
        effaceConsole();
        donnéesRetenues = false;
        oubliePile();

        // Le texte compilé : les données (onglets non vides, une ligne par onglet), les
        // programmes importés, puis le programme ; les numéros de ligne des erreurs sont
        // rapportés au bon morceau (voir placeLignes)
        let assemblé;
        try { assemblé = assembleProgramme(code, courant, définitionsDonnées()); }
        catch (e) {
            dernierLispE = '';
            afficheLispE();
            écritConsole('Erreur : ' + e.message, 'erreur');
            return;
        }
        // Les sons cités dans le code sont décodés avant de commencer : demande() bloque la
        // page, un son décodé pendant le programme ne serait prêt qu'à la fin
        const sonsCités = [...assemblé.source.matchAll(/charge_son\s*\(\s*(["'])([^"'\n]+)\1\s*\)/g)].map(m => m[2]);
        const attente = sonsCités.length ? Pyt.préchargeSons(sonsCités) : null;
        if (attente) {
            const numéro = ++numéroExécution;
            await attente;
            if (numéro !== numéroExécution) return;
        }
        const c = compile(assemblé.source);
        if (c.erreur) {
            dernierLispE = '';
            afficheLispE();
            écritConsole(placeLignes(c.erreur, assemblé.morceaux), 'erreur');
            return;
        }
        dernierLispE = c.lispe;
        afficheLispE();

        const début = performance.now();
        try {
            nouvelInterpréteur();
            évalue(idxExécution, c.lispe);
            const durée = Math.round(performance.now() - début);
            if (!Pyt.enCours()) écritConsole('— Programme terminé (' + durée + ' ms)', 'info');
            else écritConsole('— Programme en cours (animation, événements ou question en attente). Clique sur « Arrêter » pour le stopper.', 'info');
        } catch (e) {
            écritErreur(e, 'programme');
            Pyt.stoppeTout();
        }
        metAJourBoutons();
    }

    function arrête() {
        numéroExécution++;
        Pyt.stoppeTout();
        écritConsole('— Programme arrêté', 'info');
        metAJourBoutons();
    }

    // Le code LispE, une ligne par <span> : la numérotation vient d'un compteur CSS (::before),
    // qui ne part pas avec un copier-coller ; les erreurs citent ces numéros (« ligne 12 du code LispE »)
    function afficheLispE() {
        const zone = $('codeLispE');
        zone.textContent = '';
        zone.classList.toggle('numéroté', !!dernierLispE);
        if (!dernierLispE) { zone.textContent = '(pas encore de code LispE : exécute le programme)'; return; }
        dernierLispE.split('\n').forEach((ligne, i) => {
            if (i) zone.appendChild(document.createTextNode('\n'));
            const span = document.createElement('span');
            span.className = 'ligne-lispe';
            span.textContent = ligne;
            zone.appendChild(span);
        });
    }

    // Un seul bouton, dans l'éditeur comme en plein écran (du canevas ou de la console) :
    // ▶ Exécuter quand le programme est à l'arrêt, ■ Arrêter pendant qu'il tourne
    function metAJourBoutons() {
        const enCours = Pyt.enCours();
        actualiseExécuter();
        ['btnExécutionPlein', 'btnExécutionConsole'].forEach(id => {
            const b = $(id);
            b.textContent = enCours ? '■ Arrêter' : '▶ Exécuter';
            b.title = enCours ? 'Arrêter le programme' : 'Exécuter le programme';
            b.classList.toggle('danger', enCours);      // ■ Arrêter, en rouge
        });
    }

    function basculeExécution(ev) {
        // le bouton ne garde pas le clavier : Espace ou Entrée doivent aller au programme
        if (ev && ev.currentTarget && ev.currentTarget.blur) ev.currentTarget.blur();
        if (Pyt.enCours()) arrête();
        else exécute();
    }

    // ------------------------------------------------------------------
    // Plein écran du canevas. Le navigateur peut le refuser (iPhone, cadre intégré...) :
    // la scène occupe alors toute la fenêtre (« secours »). Échap revient dans les deux cas.
    // ------------------------------------------------------------------
    function enPleinÉcran() {
        return $('scèneCanevas').classList.contains('plein');
    }

    async function entrePleinÉcran() {
        const scène = $('scèneCanevas');
        // les touches doivent aller au programme, pas à l'éditeur ou à la console
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        scène.classList.add('plein');
        metAJourBoutons();
        try {
            if (!scène.requestFullscreen) throw new Error();
            await scène.requestFullscreen();
        } catch (e) {
            scène.classList.add('secours');
        }
    }

    function quittePleinÉcran() {
        const scène = $('scèneCanevas');
        consoleSousLeCanevas(false);
        Pyt.relâcheTouches();
        if (document.fullscreenElement === scène && document.exitFullscreen) document.exitFullscreen().catch(() => {});
        scène.classList.remove('plein', 'secours');
    }

    // ------------------------------------------------------------------
    // Plein écran du code ou de la console : la zone occupe toute la fenêtre (une classe
    // sur body) et le navigateur passe en plein écran s'il le permet. C'est la page entière
    // qui passe en plein écran, pas la zone seule : les propositions de l'éditeur
    // (Ctrl+Espace) et les fenêtres de dialogue restent visibles. La police ne change pas.
    // Exécuter quitte le plein écran du code, pour voir la console et le canevas.
    // ------------------------------------------------------------------
    let zonePleine = null;      // 'code', 'console' ou null

    function basculeZonePleine(zone) {
        if (zonePleine === zone) { quitteZonePleine(); return; }
        if (zonePleine) document.body.classList.remove('plein-' + zonePleine);
        zonePleine = zone;
        document.body.classList.add('plein-' + zone);
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(() => { /* la fenêtre suffit */ });
        }
        aprèsChangementZone();
    }

    function quitteZonePleine() {
        if (!zonePleine) return;
        document.body.classList.remove('plein-' + zonePleine);
        zonePleine = null;
        if (document.fullscreenElement === document.documentElement && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
        }
        aprèsChangementZone();
    }

    function aprèsChangementZone() {
        [['btnPleinCode', 'code', 'Le code en plein écran'], ['btnPleinConsole', 'console', 'La console en plein écran']].forEach(([id, zone, titre]) => {
            const b = $(id), dedans = zonePleine === zone;
            b.textContent = dedans ? '✕' : '⛶';
            b.title = dedans ? 'Quitter le plein écran (Échap)' : titre;
            b.setAttribute('aria-label', b.title);
        });
        requestAnimationFrame(() => {
            éditeur.refresh();
            $('console').scrollTop = $('console').scrollHeight;
            if (zonePleine === 'code') (modeDonnées ? $('texteDonnées') : éditeur).focus();
            else if (zonePleine === 'console') $('saisieConsole').focus();
        });
    }

    function installeZonesPleines() {
        $('btnPleinCode').addEventListener('click', () => basculeZonePleine('code'));
        $('btnPleinConsole').addEventListener('click', () => basculeZonePleine('console'));
        // Échap (ou le navigateur) a quitté le plein écran : la zone reprend sa place
        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement && zonePleine) quitteZonePleine();
        });
        // sans vrai plein écran (refusé par le navigateur), Échap ramène aussi l'affichage normal ;
        // mais pas quand Échap sert déjà : abandonner une question, fermer les propositions
        window.addEventListener('keydown', (ev) => {
            if (ev.key !== 'Escape' || !zonePleine || document.fullscreenElement) return;
            if (questionConsole || (éditeur.state && éditeur.state.completionActive)) return;
            quitteZonePleine();
        });
    }

    // En plein écran du canevas, la console peut venir sous le canevas (▤ Console, ou
    // affiche_console() dans le programme) : elle passe dans la scène, puis revient à sa place
    function consoleSousLeCanevas(oui) {
        const zone = $('zoneConsole'), scène = $('scèneCanevas');
        oui = !!oui && enPleinÉcran();
        if (oui && zone.parentElement !== scène) scène.appendChild(zone);
        if (!oui && zone.parentElement !== $('zoneCanevas')) $('zoneCanevas').appendChild(zone);
        scène.classList.toggle('avec-console', oui);
        $('btnConsolePlein').setAttribute('aria-pressed', String(oui));
        $('btnConsolePlein').textContent = oui ? '▤ Cacher la console' : '▤ Console';
        $('console').scrollTop = $('console').scrollHeight;
    }

    // affiche_console() : la console devient visible, quel que soit l'affichage
    function afficheConsole() {
        if (zonePleine === 'code') quitteZonePleine();
        if (enPleinÉcran()) consoleSousLeCanevas(true);
        else $('zoneConsole').scrollIntoView({ block: 'nearest' });
    }

    // cache_console() : en plein écran du canevas, la console s'en va (sinon, rien ne change)
    function cacheConsole() {
        if (enPleinÉcran()) consoleSousLeCanevas(false);
    }

    function installePleinÉcran() {
        $('btnPleinÉcran').addEventListener('click', entrePleinÉcran);
        // en plein écran, glisser le doigt (vers le bas surtout) ne doit pas le faire quitter
        Pyt.retientGlissés($('scèneCanevas'), enPleinÉcran);
        $('btnConsolePlein').addEventListener('click', () => consoleSousLeCanevas(!$('scèneCanevas').classList.contains('avec-console')));
        $('btnQuittePlein').addEventListener('click', quittePleinÉcran);
        $('btnExécutionPlein').addEventListener('click', basculeExécution);
        $('btnExécutionConsole').addEventListener('click', basculeExécution);
        // sortie par Échap (ou par le navigateur) du vrai plein écran
        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement && !$('scèneCanevas').classList.contains('secours')) quittePleinÉcran();
        });
        // Échap dans le mode de secours
        window.addEventListener('keydown', (ev) => {
            if (ev.key === 'Escape' && $('scèneCanevas').classList.contains('secours')) quittePleinÉcran();
        });
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
    // l'a pas tapé. Il est demandé pour exécuter du code et pour exporter le projet.
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

    // Le mode classe (serveur.py --professeur dupont) : l'élève se connecte avec l'identifiant
    // que son école lui a donné, et le serveur vérifie qu'il est dans la liste de la classe
    // (élèves.json). Le jeton reçu accompagne ses envois (sauve_dans_serveur), qui portent
    // alors son identité vérifiée. classe : l'identifiant du professeur, ou null.
    let classe = null;
    let jetonÉlève = null;
    let nomVérifié = '';
    try { jetonÉlève = sessionStorage.getItem('pythonerie.jetonÉlève'); } catch (e) { /* rien */ }

    function gardeJetonÉlève(jeton) {
        jetonÉlève = jeton || null;
        try { if (jetonÉlève) sessionStorage.setItem('pythonerie.jetonÉlève', jetonÉlève); else sessionStorage.removeItem('pythonerie.jetonÉlève'); } catch (e) { /* rien */ }
    }

    // Au démarrage : l'élève de l'onglet est-il toujours connu du serveur ?
    async function vérifieÉlèveClasse() {
        nomVérifié = '';
        let réponse = null;
        if (jetonÉlève) {
            try {
                const r = await fetch('api/élève/moi', { headers: { 'X-Pythonerie-Eleve': jetonÉlève } });
                réponse = r.ok ? await r.json() : null;
            } catch (e) { réponse = null; }
        }
        if (réponse && réponse.identifiant) { nomVérifié = réponse.nom || ''; if (élève !== réponse.identifiant) changeÉlève(réponse.identifiant); }
        else { gardeJetonÉlève(null); if (élève) changeÉlève(null); }
    }

    let connexionClasseOuverte = false;
    async function connecteÉlèveClasse(raison, message) {
        if (connexionClasseOuverte) return;
        connexionClasseOuverte = true;
        const formulaire = document.createElement('div');
        formulaire.className = 'formulaire-admin';
        const l = document.createElement('label');
        l.textContent = 'Identifiant';
        const champ = document.createElement('input');
        champ.type = 'text';
        champ.autocomplete = 'username';
        champ.spellcheck = false;
        l.appendChild(champ);
        formulaire.appendChild(l);
        formulaire.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') { ev.preventDefault(); $('dialogueBoutons').querySelector('button').click(); }
        });
        setTimeout(() => champ.focus(), 0);
        const choix = await dialogue('Connexion à la classe',
            (message ? message + '\n\n' : '') + (raison ? raison + '\n\n' : '')
            + 'Tape l\'identifiant que ton école t\'a donné (la classe de « ' + classe + ' »).',
            [{ texte: 'Se connecter', valeur: 'oui', genre: 'principal' }, { texte: 'Annuler', valeur: null }], formulaire);
        connexionClasseOuverte = false;
        if (!choix) return;
        let réponse = null;
        try {
            const r = await fetch('api/élève/connexion', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifiant: nfc(champ.value).trim() }) });
            réponse = await r.json();
        } catch (e) { réponse = { erreur: 'le serveur ne répond pas' }; }
        if (!réponse || réponse.erreur) return connecteÉlèveClasse(raison, '⚠️ ' + ((réponse && réponse.erreur) || 'erreur'));
        gardeJetonÉlève(réponse.jeton);
        nomVérifié = réponse.nom || '';
        const nouveau = réponse.identifiant !== élève;
        changeÉlève(réponse.identifiant);
        if (nouveau) prendPossession(réponse.identifiant);
        écritConsole('— Bienvenue' + (nomVérifié ? ', ' + nomVérifié : '') + ' ! Tu es connecté(e) à la classe de « ' + classe
            + ' » avec l\'identifiant « ' + réponse.identifiant + ' ».', 'info');
    }

    // Le nom sous lequel on travaille : « Unique », ou celui que l'élève a tapé
    function nomCourant() {
        return utilisateurUnique ? NOM_UNIQUE : élève;
    }

    function basculeUtilisateurUnique() {
        if (multiImposé) return;
        utilisateurUnique = !utilisateurUnique;
        try { localStorage.setItem(CLÉ_UNIQUE, utilisateurUnique ? 'oui' : 'non'); } catch (e) { /* rien */ }
        // dans les deux sens, on repart sans élève connecté : en mode plusieurs
        // élèves, le nom sera demandé à la première exécution. L'espace de travail passe à
        // « Unique », ou attend le prochain élève (voir prendPossession)
        changeÉlève(null);
        fermeDéroulante();
        if (utilisateurUnique) prendPossession(NOM_UNIQUE);
        else rafraîchitListeProjets();
    }

    function changeÉlève(nom) {
        élève = nom || null;
        if (!élève) { gardeJetonÉlève(null); nomVérifié = ''; }
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
            : élève ? 'Connecté : ' + (nomVérifié ? nomVérifié + ' (' + élève + ')' : élève) + ' (cliquer pour se déconnecter)'
            : classe ? 'Se connecter : taper son identifiant' : 'Se connecter : taper son nom';
        $('btnUtilisateurUnique').setAttribute('aria-checked', String(utilisateurUnique));
        $('btnUtilisateurUnique').disabled = multiImposé;
        if (multiImposé) $('btnUtilisateurUnique').title = classe ? 'Le serveur est en mode classe : chaque élève se connecte avec son identifiant'
            : 'Le mode plusieurs élèves est imposé par config.json';
        $('btnUtilisateurUnique').textContent = (utilisateurUnique ? '☑' : '☐') + ' Utilisateur unique (sans connexion)';
    }

    // Demande le nom de l'élève ; renvoie Vrai s'il est connecté à la fin
    function demandeÉlève(raison) {
        // en mode classe, le serveur vérifie l'identifiant : la réponse arrive plus tard
        if (classe) { connecteÉlèveClasse(raison); return !!élève; }
        const texte = (raison ? raison + '\n\n' : '') + 'Ton nom (ou ton identifiant) :';
        const réponse = prompt(texte, élève || '');
        if (réponse === null) return !!élève;
        const nom = nfc(réponse).trim().replace(/\s+/g, ' ');
        if (!nom) { changeÉlève(null); return false; }
        if (nom.length > 40 || !/^[\p{L}\p{N} _\-.]+$/u.test(nom)) {
            alert('Ce nom ne convient pas : utilise des lettres, des chiffres, des espaces, - ou _ (40 caractères au plus).');
            return demandeÉlève(raison);
        }
        const nouveau = nom !== élève;
        changeÉlève(nom);
        // ses projets apparaissent dans la liste ; un projet laissé par un autre est rangé chez lui
        if (nouveau) prendPossession(nom);
        return true;
    }

    function exigeÉlève(raison) {
        return utilisateurUnique || !!élève || demandeÉlève(raison);
    }

    // ------------------------------------------------------------------
    // Projets : un projet réunit tous les programmes, leurs répertoires et les fichiers
    // des répertoires images, sons et données (voir fichiers-projet.js), et les onglets
    // de données. On l'exporte dans un seul fichier .zip, pour le partager ou le retrouver
    // sur un autre ordinateur :
    //   projet.json                  { format, version, nom, élève, créé }
    //   programmes/Quiz.pyf          les programmes, rangés dans leurs répertoires
    //   programmes/jeux/outils.pyf
    //   onglets/don0.txt, don1.txt…  les onglets de données (bouton « Données »)
    //   images/, sons/, données/     les fichiers du projet
    // Un projet peut aussi être écrit en JSON (par Claude, par exemple : voir lisProjetJSON) ;
    // on le charge, mais l'export se fait toujours en .zip.
    // ------------------------------------------------------------------
    const FORMAT_PROJET = 'projet-pythonerie';

    // Le nom du projet : « Sans Nom » au départ ; il est affiché en tête de la colonne des
    // programmes (un clic ouvre la liste « Mes projets »), demandé à la création d'un
    // projet, à son premier export ou quand on le quitte, et il est gardé dans le projet exporté
    const SANS_NOM = 'Sans Nom';
    const CLÉ_NOM_PROJET = 'pythonerie.nomProjet';
    let nomDuProjet = SANS_NOM;
    try { nomDuProjet = localStorage.getItem(CLÉ_NOM_PROJET) || SANS_NOM; } catch (e) { /* rien */ }

    function changeNomProjet(nom) {
        nomDuProjet = nfc(nom || '').trim() || SANS_NOM;
        try { localStorage.setItem(CLÉ_NOM_PROJET, nomDuProjet); } catch (e) { /* rien */ }
        // un exemple qui change de nom devient un projet comme les autres
        const ex = exempleMarqué();
        if (ex && ex.nom !== nomDuProjet) marqueExemple(null);
        afficheNomProjet();
    }

    // Un exemple ouvert (voir chargeRépertoireSite) est un projet de passage : il n'entre pas
    // dans « Mes projets » tant qu'il garde son nom ; on le garde en le renommant. On retient
    // { nom, signature } : la signature de ses programmes et de ses fichiers au chargement,
    // pour savoir, quand on le quitte, s'il a changé. Ses onglets de données (le meilleur
    // score d'un jeu, dans don0) sont gardés à part, pour chaque exemple et chaque utilisateur.
    const CLÉ_EXEMPLE = 'pythonerie.exemple';
    const CLÉ_ONGLETS_EXEMPLES = 'pythonerie.ongletsExemples';
    function exempleMarqué() {
        try { return JSON.parse(localStorage.getItem(CLÉ_EXEMPLE) || 'null'); } catch (e) { return null; }
    }
    function marqueExemple(e) {
        try { if (e) localStorage.setItem(CLÉ_EXEMPLE, JSON.stringify(e)); else localStorage.removeItem(CLÉ_EXEMPLE); } catch (x) { /* rien */ }
    }
    // l'exemple ouvert, ou null si le projet ouvert n'est pas un exemple
    function exempleOuvert() {
        const e = exempleMarqué();
        return e && e.nom === nomDuProjet ? e : null;
    }
    const signatureExemple = (instant) => JSON.stringify([instant.programmes, instant.dossiers, (instant.fichiers || []).map(f => f.chemin)]);
    function ongletsExemples() {
        try { return JSON.parse(localStorage.getItem(CLÉ_ONGLETS_EXEMPLES) || '{}') || {}; } catch (e) { return {}; }
    }
    function gardeOngletsExemple(nom, liste) {
        const tous = ongletsExemples();
        const u = nomCourant() || '';
        tous[u] = tous[u] || {};
        if (liste.some(o => o !== '')) tous[u][nom] = liste; else delete tous[u][nom];
        try { localStorage.setItem(CLÉ_ONGLETS_EXEMPLES, JSON.stringify(tous)); } catch (e) { /* rien */ }
    }
    const ongletsDeLExemple = (nom) => (ongletsExemples()[nomCourant() || ''] || {})[nom] || null;

    function afficheNomProjet() {
        titreNouveau();
        const e = $('nomProjet');
        e.textContent = nomDuProjet + ' ▾';
        e.classList.toggle('sans-nom', nomDuProjet === SANS_NOM);
        e.title = 'Le projet « ' + nomDuProjet + ' » : cliquer pour voir tes projets';
    }

    // Demande un nom de projet ; null si l'on renonce. Le nom ne doit pas être celui d'un
    // autre projet de la liste (sauf : le nom actuel, quand on renomme)
    function demandeNomProjet(question, défaut, sauf) {
        const réponse = prompt(question, défaut || '');
        if (réponse === null) return null;
        const nom = nfc(réponse).trim().replace(/\s+/g, ' ');
        if (!nom || nom === SANS_NOM) return null;
        if (nom.length > 40 || !/^[\p{L}\p{N} _\-'.]+$/u.test(nom)) {
            alert('Ce nom ne convient pas : utilise des lettres, des chiffres, des espaces, - ou _ (40 caractères au plus).');
            return demandeNomProjet(question, nom, sauf);
        }
        if (nom !== sauf && projetExiste(nom)) {
            alert('Tu as déjà un projet « ' + nom + ' » : choisis un autre nom.');
            return demandeNomProjet(question, nom, sauf);
        }
        return nom;
    }

    // ------------------------------------------------------------------
    // Mes projets : chaque utilisateur (« Unique », ou le nom de l'élève) a sa liste de
    // projets, gardés dans le navigateur (IndexedDB, voir fichiers-projet.js), un seul par
    // nom. Le projet ouvert est l'espace de travail ; quand on en ouvre un autre (liste,
    // Nouveau projet, Charger, Matériels) ou qu'on se déconnecte, il est rangé dans la
    // liste sous son nom, à la place de sa version précédente. Un projet sans nom n'y entre
    // pas : c'est le seul cas où la Pythonerie demande quelque chose avant d'en changer.
    // L'espace de travail appartient à un utilisateur (CLÉ_PROPRIÉTAIRE) : quand un autre
    // se connecte, le projet laissé là est rangé chez son propriétaire, et l'espace est vidé.
    // ------------------------------------------------------------------
    const CLÉ_PRÉCÉDENT = 'pythonerie.projetPrécédent';    // { utilisateur, nom } : pour « Revenir »
    const CLÉ_PROPRIÉTAIRE = 'pythonerie.propriétaire';
    let listeProjets = [];          // [{ nom, modifié }] de l'utilisateur connecté

    const projetExiste = (nom) => listeProjets.some(p => p.nom === nom);
    const PROJETS_RÉCENTS = 10;     // au-delà, Mes projets replie les plus anciens (voir ouvreMesProjets)
    const ESPACE_VIDE = () => ({ programmes: {}, dossiers: [], fichiers: [], onglets: [''] });

    async function rafraîchitListeProjets() {
        const u = nomCourant();
        try { listeProjets = u ? await FichiersProjet.projets(u) : []; } catch (e) { listeProjets = []; }
        metAJourPrécédent();
    }

    // Range le projet ouvert dans la liste, sans rien demander (s'il a un nom et un utilisateur)
    async function gardeProjetOuvert(instant) {
        const u = nomCourant();
        if (!u || nomDuProjet === SANS_NOM) return;
        // un exemple n'entre pas dans la liste : seuls ses onglets de données sont gardés
        if (exempleOuvert()) { gardeOngletsExemple(nomDuProjet, (instant || { onglets }).onglets); return; }
        await FichiersProjet.gardeProjet(u, nomDuProjet, instant || await instantané());
        try { localStorage.setItem(CLÉ_PROPRIÉTAIRE, u); } catch (e) { /* rien */ }
    }

    // Avant de quitter le projet ouvert : il est rangé dans la liste. Renvoie Vrai si l'on
    // peut continuer (projet rangé, rien à ranger, ou l'élève accepte de le laisser), Faux
    // s'il renonce. Seul un projet sans nom fait l'objet d'une question.
    async function rangeProjetOuvert() {
        let instant;
        try { instant = await instantané(); } catch (e) {
            écritConsole('Impossible de lire le projet ouvert : ' + e.message, 'erreur');
            return false;
        }
        if (nomDuProjet === SANS_NOM) {
            if (espaceVide(instant)) return true;
            const choix = await dialogue('Ton projet n\'a pas de nom',
                'Pour le garder dans ta liste de projets, donne-lui un nom. Sinon, il sera effacé.',
                [{ texte: '✏️ Lui donner un nom…', valeur: 'nom', genre: 'principal' },
                 { texte: 'Ne pas le garder', valeur: 'effacer', genre: 'danger' },
                 { texte: 'Annuler', valeur: null }]);
            if (!choix) return false;
            if (choix === 'effacer') return true;
            if (!exigeÉlève('Pour garder ton projet, dis d\'abord qui tu es.')) return false;
            const nom = demandeNomProjet('Nom du projet :', '');
            if (!nom) return false;
            changeNomProjet(nom);
        }
        // un exemple : on l'oublie, sauf s'il a changé et que l'élève lui donne un nom
        const ex = exempleOuvert();
        if (ex) {
            gardeOngletsExemple(ex.nom, instant.onglets);
            if (signatureExemple(instant) === ex.signature) { marqueExemple(null); return true; }
            const choix = await dialogue('Tu as changé l\'exemple « ' + ex.nom + ' »',
                'Un exemple n\'entre pas dans ta liste de projets. Pour garder tes changements, donne-lui un nom. Sinon, ils seront effacés.',
                [{ texte: '✏️ Lui donner un nom…', valeur: 'nom', genre: 'principal' },
                 { texte: 'Ne pas le garder', valeur: 'effacer', genre: 'danger' },
                 { texte: 'Annuler', valeur: null }]);
            if (!choix) return false;
            if (choix === 'effacer') { marqueExemple(null); return true; }
            if (!exigeÉlève('Pour garder ton projet, dis d\'abord qui tu es.')) return false;
            const nom = demandeNomProjet('Nom du projet :', '');
            if (!nom) return false;
            changeNomProjet(nom);
        }
        if (!exigeÉlève('Pour garder ton projet « ' + nomDuProjet + ' », dis d\'abord qui tu es.')) return false;
        try {
            await gardeProjetOuvert(instant);
            localStorage.setItem(CLÉ_PRÉCÉDENT, JSON.stringify({ utilisateur: nomCourant(), nom: nomDuProjet }));
        } catch (e) {
            écritConsole('Impossible de garder le projet « ' + nomDuProjet + ' » : ' + e.message, 'erreur');
            return false;
        }
        return true;
    }

    // Ouvre un projet de la liste (le projet ouvert y est d'abord rangé)
    async function ouvreProjet(nom) {
        if (nom === nomDuProjet) return;
        if (!(await rangeProjetOuvert())) return;
        let p = null;
        try { p = await FichiersProjet.litProjet(nomCourant(), nom); } catch (e) { /* p reste null */ }
        if (!p) { écritConsole('Le projet « ' + nom + ' » est introuvable.', 'erreur'); await rafraîchitListeProjets(); return; }
        try {
            await remplaceTout({ programmes: p.programmes || {}, dossiers: p.dossiers || [], fichiers: p.fichiers || [], onglets: p.onglets || [''] });
        } catch (e) {
            écritConsole('Impossible d\'ouvrir le projet « ' + nom + ' » : ' + e.message, 'erreur');
            return;
        }
        changeNomProjet(nom);
        await rafraîchitListeProjets();
        écritConsole('— Le projet « ' + nom + ' » est ouvert.', 'info');
    }

    function renommeProjet() {
        const ancien = nomDuProjet;
        const exemple = !!exempleOuvert();
        const nom = demandeNomProjet('Nom du projet :', ancien === SANS_NOM ? '' : ancien, ancien);
        if (!nom || nom === ancien) return;
        // un exemple renommé devient un projet de la liste (changeNomProjet oublie qu'il était un exemple)
        changeNomProjet(nom);
        // la liste suit : le projet change de nom, il ne se dédouble pas
        (async () => {
            try {
                if (ancien !== SANS_NOM && !exemple && nomCourant()) await FichiersProjet.supprimeProjet(nomCourant(), ancien);
                await gardeProjetOuvert();
            } catch (e) { écritConsole('La liste des projets n\'a pas pu suivre : ' + e.message, 'erreur'); }
            await rafraîchitListeProjets();
        })();
    }

    // ＋ Nouveau : un projet « Sans Nom » reçoit un nom ; sinon, un nouveau projet
    function nouveauDepuisBouton() {
        if (nomDuProjet === SANS_NOM && !exempleOuvert()) renommeProjet();
        else nouveauProjet();
    }

    // son titre dit ce que fera le bouton
    function titreNouveau() {
        $('btnNouveau').title = nomDuProjet === SANS_NOM && !exempleOuvert() ? 'Donner un nom à ce projet' : 'Nouveau projet';
    }

    // Un nouveau projet, vide, avec un nom ; le projet ouvert est rangé dans la liste
    async function nouveauProjet() {
        const nom = demandeNomProjet('Nom du nouveau projet :', '');
        if (!nom) return;
        if (!(await rangeProjetOuvert())) return;
        try {
            await remplaceTout(ESPACE_VIDE());
        } catch (e) {
            écritConsole('Impossible de créer le projet : ' + e.message, 'erreur');
            return;
        }
        changeNomProjet(nom);
        try { await gardeProjetOuvert(); } catch (e) { /* il sera rangé plus tard */ }
        await rafraîchitListeProjets();
        écritConsole('— Le projet « ' + nom + ' » est créé.', 'info');
    }

    // Ferme le projet ouvert : il est rangé dans la liste comme quand on en change (un projet
    // sans nom ou un exemple modifié font l'objet d'une question, un exemple intact est
    // oublié), puis l'espace est vidé : « Sans Nom », sans programme
    async function fermeProjet() {
        let instant;
        try { instant = await instantané(); } catch (e) { return; }
        if (nomDuProjet === SANS_NOM && espaceVide(instant)) { écritConsole('— Il n\'y a pas de projet ouvert à fermer.', 'info'); return; }
        const nom = nomDuProjet;
        if (!(await rangeProjetOuvert())) return;
        const rangé = nomDuProjet !== SANS_NOM && !exempleOuvert() ? nomDuProjet : null;
        try {
            await remplaceTout(ESPACE_VIDE());
            changeNomProjet(SANS_NOM);
        } catch (e) {
            écritConsole('Impossible de fermer le projet : ' + e.message, 'erreur');
            return;
        }
        await rafraîchitListeProjets();
        écritConsole('— Le projet « ' + nom + ' » est fermé.'
            + (rangé && projetExiste(rangé) ? ' Il t\'attend dans « Mes projets »' + (rangé !== nom ? ', sous le nom « ' + rangé + ' »' : '') + '.' : ''), 'info');
    }

    // Supprime un projet de la liste ; si c'est le projet ouvert, l'espace est vidé
    async function supprimeProjet(nom) {
        const ouvert = nom === nomDuProjet;
        if (nom === SANS_NOM) {
            let instant;
            try { instant = await instantané(); } catch (e) { return; }
            if (espaceVide(instant)) return;
            if (!confirm('Effacer ce projet sans nom ?\n\nSes programmes, ses fichiers et ses données seront perdus.')) return;
        } else if (!confirm('Supprimer définitivement le projet « ' + nom + ' » ?\n\nSes programmes, ses fichiers et ses données seront perdus'
            + ' (sauf si tu l\'as exporté).')) return;
        try {
            if (nom !== SANS_NOM && nomCourant()) await FichiersProjet.supprimeProjet(nomCourant(), nom);
            if (ouvert) { await remplaceTout(ESPACE_VIDE()); changeNomProjet(SANS_NOM); }
        } catch (e) {
            écritConsole('Impossible de supprimer le projet : ' + e.message, 'erreur');
            return;
        }
        await rafraîchitListeProjets();
        écritConsole('— Le projet « ' + nom + ' » est supprimé.', 'info');
    }

    // Le projet quitté en dernier, s'il est encore dans la liste
    function projetPrécédent() {
        try {
            const p = JSON.parse(localStorage.getItem(CLÉ_PRÉCÉDENT) || 'null');
            if (p && p.utilisateur === nomCourant() && p.nom !== nomDuProjet && projetExiste(p.nom)) return p.nom;
        } catch (e) { /* rien */ }
        return null;
    }

    function revientProjetPrécédent() {
        const p = projetPrécédent();
        if (p) ouvreProjet(p);
    }

    function metAJourPrécédent() {
        const p = projetPrécédent();
        $('btnAnnuleProjet').disabled = !p;
        $('btnAnnuleProjet').textContent = '↶ Revenir au projet précédent' + (p ? ' (« ' + p + ' »)' : '');
    }

    // L'espace de travail passe à l'utilisateur u (connexion, ou changement de mode) : le
    // projet qu'un autre y a laissé est rangé chez lui, puis l'espace est vidé
    async function prendPossession(u) {
        let propriétaire = null;
        try { propriétaire = localStorage.getItem(CLÉ_PROPRIÉTAIRE); } catch (e) { /* rien */ }
        if (propriétaire && propriétaire !== u) {
            oubliePressePapiers();
            try {
                const instant = await instantané();
                if (nomDuProjet !== SANS_NOM && !exempleOuvert()) await FichiersProjet.gardeProjet(propriétaire, nomDuProjet, instant);
                if (!espaceVide(instant)) {
                    await remplaceTout(ESPACE_VIDE());
                    changeNomProjet(SANS_NOM);
                }
            } catch (e) { écritConsole('Impossible de ranger le projet précédent : ' + e.message, 'erreur'); }
        }
        try { localStorage.setItem(CLÉ_PROPRIÉTAIRE, u); } catch (e) { /* rien */ }
        await rafraîchitListeProjets();
    }

    // La liste « Mes projets », sous le nom du projet
    function ouvreMesProjets() {
        const u = nomCourant();
        const éléments = [{ section: 'Mes projets' + (utilisateurUnique ? '' : ' — ' + (u || '?')) }];
        if (!u) {
            éléments.push({ texte: 'Dis qui tu es (👤) pour retrouver tes projets', désactivé: true });
        } else {
            if (nomDuProjet === SANS_NOM) éléments.push({ texte: SANS_NOM + ' (ouvert)', classe: 'projet courant sans-nom', désactivé: true });
            if (exempleOuvert()) éléments.push({ texte: nomDuProjet + ' (exemple ouvert : renomme-le pour le garder)', classe: 'projet courant sans-nom', désactivé: true });
            const ligneProjet = (p) => ({
                texte: p.nom, classe: p.nom === nomDuProjet ? 'projet courant' : 'projet',
                titre: p.nom === nomDuProjet ? 'Le projet ouvert' : 'Ouvrir « ' + p.nom + ' » (modifié le ' + new Date(p.modifié * 1000).toLocaleString('fr') + ')',
                action: () => ouvreProjet(p.nom),
                supprime: () => supprimeProjet(p.nom)
            });
            if (listeProjets.length <= PROJETS_RÉCENTS) listeProjets.forEach(p => éléments.push(ligneProjet(p)));
            else {
                // les derniers ouverts (un projet est rangé, donc daté, quand on le quitte),
                // le projet ouvert en tête ; les autres, par ordre alphabétique, dans un groupe replié
                const ouvert = listeProjets.find(p => p.nom === nomDuProjet);
                const récents = listeProjets.filter(p => p !== ouvert).sort((a, b) => b.modifié - a.modifié)
                    .slice(0, PROJETS_RÉCENTS - (ouvert ? 1 : 0));
                if (ouvert) récents.unshift(ouvert);
                const autres = listeProjets.filter(p => !récents.includes(p));
                récents.forEach(p => éléments.push(ligneProjet(p)));
                éléments.push({ groupe: autres.length === 1 ? 'L\'autre projet' : 'Les ' + autres.length + ' autres projets',
                    éléments: autres.map(ligneProjet) });
            }
            if (!listeProjets.length && nomDuProjet !== SANS_NOM && !exempleOuvert()) éléments.push({ texte: nomDuProjet, classe: 'projet courant', désactivé: true });
        }
        éléments.push({ séparateur: true });
        éléments.push({ texte: '🆕 Nouveau projet…', action: nouveauProjet });
        éléments.push({ texte: '✏️ Renommer « ' + nomDuProjet + ' »…', action: renommeProjet });
        if (nomDuProjet !== SANS_NOM) éléments.push({ texte: '✖ Fermer « ' + nomDuProjet + ' »', action: fermeProjet });
        éléments.push({ texte: '📦 Exporter le projet', action: exporteProjet });
        éléments.push({ texte: '✉️ Exporter pour un courriel (.json)', action: exporteProjetTexte });
        éléments.push({ texte: '📤 Envoyer le projet…', action: partageProjet });
        éléments.push({ texte: '🌐 Créer une application Web…', action: créeApplicationWeb });
        ouvreDéroulante($('nomProjet'), éléments);
    }

    // Un morceau de nom de fichier : lettres, chiffres et tirets ; le reste devient « _ »
    const pourFichier = (texte) => nfc(texte).replace(/[^\p{L}\p{N}\-]+/gu, '_').replace(/^_+|_+$/g, '');

    // Tout le projet en cours : { programmes: {chemin: code}, dossiers: [...], fichiers: [{chemin, type, blob}],
    // onglets: [texte de Don0, de Don1...] }
    async function instantané() {
        await sauvegarde();
        const contenu = await stockage.liste();
        const progs = {};
        for (const p of contenu.programmes) progs[p.chemin] = await stockage.lit(p.chemin);
        return { programmes: progs, dossiers: contenu.dossiers, fichiers: FichiersProjet.instantané(), onglets: [...onglets] };
    }

    // Remplace tout le projet en cours par celui de l'instantané
    async function remplaceTout(instant) {
        // un autre projet : les sauts de ↩ Retour menaient à l'ancien
        sauts = [];
        afficheRetour();
        clearTimeout(minuterieSauvegarde);
        modifie = false;
        const tout = {};
        const maintenant = Date.now() / 1000;
        Object.entries(instant.programmes).forEach(([c, code]) => { tout[c] = { code, modifie: maintenant }; });
        StockageNavigateur._écrit(CLÉ_PROGRAMMES, tout);
        StockageNavigateur._écrit(CLÉ_DOSSIERS, instant.dossiers);
        await FichiersProjet.remplace(instant.fichiers || []);
        oublieFichierOuvert();
        remplaceOnglets(instant.onglets || ['']);
        courant = null;
        sélection = new Set();
        dossierCourant = '';
        Pyt.stoppeTout();
        await rafraichitListe();
        if (programmes.length) await ouvre(programmes[0].chemin);
        else aucunProgramme();
    }

    // Un chemin de programme est accepté seulement s'il est fait de noms valides
    function cheminValide(chemin) {
        const morceaux = nfc(String(chemin)).split('/');
        return morceaux.length <= 8 && morceaux.every(m => nomValide(m) === m) ? morceaux.join('/') : null;
    }

    // nom_du_projet_login_aaaa_mm_jj_hh_MM ; sans le login pour l'utilisateur « Unique »
    function nomFichierProjet(base = nomDuProjet) {
        const d = new Date();
        const n = (x) => String(x).padStart(2, '0');
        const login = nomCourant();
        return pourFichier(base) + (login && login !== NOM_UNIQUE ? '_' + pourFichier(login) : '')
            + '_' + d.getFullYear() + '_' + n(d.getMonth() + 1) + '_' + n(d.getDate()) + '_' + n(d.getHours()) + '_' + n(d.getMinutes());
    }

    // Exporte le projet dans Téléchargements (et en garde une copie sur le serveur de la classe)
    // Avant un export : un élève connu, et un projet qui a un nom ; rend l'instantané du projet
    async function prépareExport() {
        if (!exigeÉlève('Pour exporter ton projet, il faut d\'abord dire qui tu es.')) return null;
        // un projet sans nom en reçoit un avant de partir
        if (nomDuProjet === SANS_NOM) {
            const nom = demandeNomProjet('Ton projet n\'a pas encore de nom. Comment s\'appelle-t-il ?', '');
            if (!nom) { écritConsole('— Export annulé : le projet n\'a pas de nom.', 'info'); return null; }
            changeNomProjet(nom);
        }
        try { return await instantané(); }
        catch (e) { écritConsole('Impossible de préparer le projet : ' + e.message, 'erreur'); return null; }
    }

    async function exporteProjet() {
        const instant = await prépareExport();
        if (!instant) return null;
        let archive;
        try { archive = await archiveProjet(instant); }
        catch (e) { écritConsole('Impossible de préparer le projet : ' + e.message, 'erreur'); return null; }
        const nom = nomFichierProjet();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(archive);
        a.download = nom + '.zip';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        const nbF = instant.fichiers.length, nbD = instant.onglets.filter(o => o !== '').length;
        écritConsole('— Projet « ' + nomDuProjet + ' » exporté dans « ' + nom + '.zip » (' + pluriel(Object.keys(instant.programmes).length, 'programme')
            + (nbF ? ', ' + pluriel(nbF, 'fichier') : '') + (nbD ? ', ' + pluriel(nbD, 'onglet') + ' de données' : '')
            + ') : il est dans le dossier Téléchargements.', 'info');
        if (serveurProjets) await envoieProjet(nom, archive);
        try { await gardeProjetOuvert(instant); await rafraîchitListeProjets(); } catch (e) { /* rien */ }
        return nom + '.zip';
    }

    // ------------------------------------------------------------------
    // Créer une application Web : un .zip avec tout ce qu'il faut pour faire tourner un
    // programme du projet sans la Pythonerie. Le programme principal (choisi s'il y en a
    // plusieurs) est assemblé comme pour ▶ Exécuter (programmes importés, onglets de données)
    // et traduit en LispE dès maintenant : l'application n'a besoin ni du transpileur ni de
    // l'éditeur, seulement de LispE, de bibliothèque.lisp, de canevas.js et d'appli/appli.js,
    // qui joue le rôle de ce fichier. Les fichiers images, sons et données du projet suivent.
    // ------------------------------------------------------------------
    // Les polices du site (le texte du canevas est en Inter, comme dans la Pythonerie)
    const POLICES = ['polices.css', 'Inter-400-latin.woff2', 'Inter-400-latin-ext.woff2',
        'JetBrainsMono-400-latin.woff2', 'JetBrainsMono-400-latin-ext.woff2', 'OFL-Inter.txt', 'OFL-JetBrainsMono.txt'];

    // Le programme principal : celui qui est ouvert s'il est le seul, sinon on le demande
    async function choisitProgrammePrincipal() {
        let liste = programmes.map(p => p.chemin).sort((a, b) => a.localeCompare(b, 'fr'));
        // un programme principal peut le dire : « #__main__ » en première ligne (le même repère
        // que dans l'Atelier) ; le seul qui le porte part sans question, plusieurs sont proposés
        const repérés = liste.filter(c => estPrincipal(codeDuProgramme(c)));
        if (repérés.length) liste = repérés;
        if (liste.length === 1) return liste[0];
        const choix = document.createElement('select');
        choix.className = 'choix-programme';
        liste.forEach(c => {
            const o = document.createElement('option');
            o.value = o.textContent = c;
            if (c === courant) o.selected = true;
            choix.appendChild(o);
        });
        const zone = document.createElement('div');
        zone.style.marginTop = '10px';
        zone.appendChild(choix);
        const ok = await dialogue('Créer une application Web',
            'Le projet a ' + liste.length + ' programmes. Lequel est le programme principal, celui que l\'application lancera ? '
            + 'Les programmes qu\'il importe l\'accompagnent.',
            [{ texte: '🌐 Créer l\'application', valeur: true, genre: 'principal' }, { texte: 'Annuler', valeur: null }], zone);
        return ok ? choix.value : null;
    }

    async function créeApplicationWeb() {
        if (!wasmPrêt) { écritConsole('LispE est encore en cours de chargement…', 'info'); return null; }
        if (!exigeÉlève('Pour créer une application Web, il faut d\'abord dire qui tu es.')) return null;
        if (!programmes.length) { écritConsole('— Ton projet est vide : il n\'y a pas de programme à transformer en application.', 'info'); return null; }
        await sauvegarde();
        const principal = await choisitProgrammePrincipal();
        if (!principal) return null;

        // le programme, comme pour ▶ Exécuter : programmes importés et onglets de données
        let assemblé;
        try { assemblé = assembleProgramme(codeDuProgramme(principal), principal, définitionsDonnées()); }
        catch (e) { écritConsole('Impossible de créer l\'application : ' + e.message, 'erreur'); return null; }
        const c = compile(assemblé.source);
        if (c.erreur) {
            écritConsole('Impossible de créer l\'application : le programme « ' + principal + ' » contient une erreur.', 'erreur');
            écritConsole(placeLignes(c.erreur, assemblé.morceaux), 'erreur');
            return null;
        }

        const titre = nomDuProjet !== SANS_NOM ? nomDuProjet : nomDe(principal);
        const dossier = pourFichier(titre) || 'application';
        const enc = new TextEncoder();
        const lit = async (chemin, binaire) => {
            const r = await fetch(chemin, { cache: 'no-cache' });
            if (!r.ok) throw new Error('impossible de lire ' + chemin + ' (erreur ' + r.status + ')');
            return binaire ? new Uint8Array(await r.arrayBuffer()) : nfc(await r.text());
        };
        const remplit = (modèle, valeurs) => modèle.replace(/\{\{(\w+)\}\}/g, (tout, clé) => clé in valeurs ? valeurs[clé] : tout);
        const html = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

        let archive, nbFichiers;
        try {
            const fichiers = FichiersProjet.liste();
            const données = {};
            fichiers.filter(f => f.chemin.startsWith('données/')).forEach(f => { données[f.chemin] = FichiersProjet.texte(f.chemin); });
            const appli = {
                titre, programme: principal,
                lispe: c.lispe,
                bibliothèque: sources.bibliothèque,
                // les sons cités dans le code sont décodés avant de commencer (voir exécute)
                sons: [...new Set([...assemblé.source.matchAll(/charge_son\s*\(\s*(["'])([^"'\n]+)\1\s*\)/g)].map(m => m[2]))],
                fichiers: fichiers.map(f => f.chemin),
                // les médias du site (médias/...) partent tous si le programme s'en sert :
                // le piano compose leurs noms (f"médias/sounds/piano/{note}.wav"), et liste_sons()
                // ou liste_images() les citent ; ou les données du projet (une pile de cartes qui montre étoile.svg)
                médias: /médias\/|liste_(sons|images)\s*\(/.test(assemblé.source + '\n' + Object.values(données).join('\n')) ? médiasSite.slice() : [],
                données,
                onglets: onglets.slice()
            };
            const quand = new Date().toLocaleString('fr');
            const programme = '// Le programme « ' + principal + ' » du projet « ' + titre + ' », traduit en LispE par la Pythonerie le '
                + quand + '\nconst APPLI = ' + JSON.stringify(appli, null, 1) + ';\n';
            // la 3D : three.js part avec l'application si le programme montre une scène
            const avec3D = /\bmontre_3d\s*\(/.test(assemblé.source);
            const THREE_FICHIERS = ['three.module.min.js', 'OrbitControls.js', 'LICENSE.txt'];
            const fichiers3D = avec3D ? await Promise.all(THREE_FICHIERS.map(f => lit('vendor/three/' + f, true))) : [];
            const [page, style, moteur, lisezmoi, canevasJs, erreursJs, scène3DJs, lispeJs, lispeFonctions, wasm, ...polices] = await Promise.all([
                lit('appli/index.html'), lit('appli/appli.css'), lit('appli/appli.js'), lit('appli/LISEZMOI.txt'),
                lit('js/canevas.js'), lit('js/erreurs.js'), lit('js/scene3d.js'),
                lit('lispe/lispe.js'), lit('lispe/lispe_functions.js'), lit('lispe/lispe.wasm', true),
                ...POLICES.map(p => lit('vendor/fonts/' + p, true))
            ]);
            const d = dossier + '/';
            const entrées = [
                { nom: d },
                { nom: d + 'index.html', octets: enc.encode(remplit(page, { TITRE: html(titre) })) },
                { nom: d + 'appli.css', octets: enc.encode(style) },
                { nom: d + 'appli.js', octets: enc.encode(moteur) },
                { nom: d + 'programme.js', octets: enc.encode(programme) },
                { nom: d + 'LISEZMOI.txt', octets: enc.encode(remplit(lisezmoi, { TITRE: titre, PROGRAMME: principal, DATE: quand })) },
                { nom: d + 'js/' },
                { nom: d + 'js/canevas.js', octets: enc.encode(canevasJs) },
                { nom: d + 'js/erreurs.js', octets: enc.encode(erreursJs) },
                { nom: d + 'js/scene3d.js', octets: enc.encode(scène3DJs) },
                { nom: d + 'lispe/' },
                { nom: d + 'lispe/lispe.js', octets: enc.encode(lispeJs) },
                { nom: d + 'lispe/lispe_functions.js', octets: enc.encode(lispeFonctions) },
                { nom: d + 'lispe/lispe.wasm', octets: wasm },
                { nom: d + 'polices/' }
            ];
            POLICES.forEach((p, i) => entrées.push({ nom: d + 'polices/' + p, octets: polices[i] }));
            if (avec3D) {
                entrées.push({ nom: d + 'vendor/' }, { nom: d + 'vendor/three/' });
                THREE_FICHIERS.forEach((f, i) => entrées.push({ nom: d + 'vendor/three/' + f, octets: fichiers3D[i] }));
            }
            if (appli.médias.length) {
                const octetsMédias = await Promise.all(appli.médias.map(m => lit(encodeURI(m), true)));
                // les répertoires : exemples/, médias/, médias/sounds/piano/...
                const répertoiresMédias = new Set();
                appli.médias.forEach(m => {
                    const morceaux = m.split('/').slice(0, -1);
                    morceaux.forEach((_, i) => répertoiresMédias.add(morceaux.slice(0, i + 1).join('/') + '/'));
                });
                [...répertoiresMédias].sort().forEach(r => entrées.push({ nom: d + r }));
                appli.médias.forEach((m, i) => entrées.push({ nom: d + m, octets: octetsMédias[i] }));
            }
            const répertoires = [...new Set(fichiers.map(f => f.chemin.split('/')[0]))].sort();
            répertoires.forEach(r => entrées.push({ nom: d + r + '/' }));
            for (const f of fichiers) entrées.push({ nom: d + f.chemin, octets: new Uint8Array(await f.blob.arrayBuffer()) });
            nbFichiers = fichiers.length;
            archive = await Zip.écrit(entrées);
        } catch (e) {
            écritConsole('Impossible de créer l\'application : ' + e.message, 'erreur');
            return null;
        }
        const nom = dossier + '_application_web.zip';
        const a = document.createElement('a');
        a.href = URL.createObjectURL(archive);
        a.download = nom;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        const importés = assemblé.morceaux.filter(m => m.nom).length;
        écritConsole('— Application Web « ' + titre + ' » créée dans « ' + nom + ' » (dossier Téléchargements) : le programme « ' + principal + ' »'
            + (importés ? ' et ' + pluriel(importés, 'programme') + ' importé' + (importés > 1 ? 's' : '') : '')
            + (nbFichiers ? ', ' + pluriel(nbFichiers, 'fichier') + ' du projet' : '') + '. '
            + 'Décompresse-la et mets le dossier sur un site Web, ou lance un petit serveur dans le dossier (voir LISEZMOI.txt) : '
            + 'un navigateur refuse d\'ouvrir index.html d\'un double-clic.', 'info');
        return nom;
    }

    // Le fichier .zip du projet (voir plus haut)
    async function archiveProjet(instant, nom = nomDuProjet) {
        const enc = new TextEncoder();
        const fiche = { format: FORMAT_PROJET, version: 3, nom, élève: nomCourant(), créé: new Date().toISOString() };
        const entrées = [{ nom: 'projet.json', octets: enc.encode(JSON.stringify(fiche, null, 1) + '\n') }, { nom: 'programmes/' }];
        [...instant.dossiers].sort().forEach(d => entrées.push({ nom: 'programmes/' + d + '/' }));
        Object.keys(instant.programmes).sort().forEach(c => entrées.push({ nom: 'programmes/' + c + '.pyf', octets: enc.encode(instant.programmes[c]) }));
        if (instant.onglets.some(o => o !== '')) {
            entrées.push({ nom: 'onglets/' });
            instant.onglets.forEach((o, i) => entrées.push({ nom: 'onglets/don' + i + '.txt', octets: enc.encode(o) }));
        }
        for (const r of Object.keys(FichiersProjet.RÉPERTOIRES)) entrées.push({ nom: r + '/' });
        for (const f of instant.fichiers) entrées.push({ nom: f.chemin, octets: new Uint8Array(await f.blob.arrayBuffer()) });
        return Zip.écrit(entrées);
    }

    // Le projet en un seul fichier texte .json, au format de lisProjetJSON (plus bas) : les
    // messageries filtrent souvent les .zip, rarement un fichier texte. Les programmes, les
    // onglets, les données et les images SVG y sont en clair ; les autres images et les sons
    // en base64 (un tiers plus gros que dans le .zip).
    async function texteProjet(instant, nom = nomDuProjet) {
        const enBase64 = (blob) => new Promise((ok, échec) => {
            const lecteur = new FileReader();
            lecteur.onload = () => ok(String(lecteur.result).replace(/^data:[^,]*,/, ''));
            lecteur.onerror = () => échec(lecteur.error);
            lecteur.readAsDataURL(blob);
        });
        const fichiers = {};
        for (const f of instant.fichiers) {
            let texte = null;
            // en clair seulement ce que lisProjetJSON lit en clair, et si c'est bien du texte
            if (f.chemin.startsWith('données/') || /\.svg$/i.test(f.chemin)) {
                try { texte = new TextDecoder('utf-8', { fatal: true }).decode(await f.blob.arrayBuffer()); }
                catch (e) { texte = null; }
            }
            fichiers[f.chemin] = texte !== null ? texte : { base64: await enBase64(f.blob) };
        }
        const projet = { format: FORMAT_PROJET, version: 3, nom, élève: nomCourant(), créé: new Date().toISOString(),
            programmes: instant.programmes, dossiers: [...instant.dossiers].sort(), onglets: instant.onglets, fichiers };
        return JSON.stringify(projet, null, 1) + '\n';
    }

    // La taille d'un fichier, lisible
    function tailleLisible(octets) {
        return octets < 1024 * 1024 ? Math.max(1, Math.round(octets / 1024)) + ' Ko' : (octets / 1024 / 1024).toFixed(1) + ' Mo';
    }

    // Télécharge le projet en texte (le dossier Téléchargements) ; rend sa taille, lisible
    function téléchargeTexteProjet(texte, nom) {
        const blob = new Blob([texte], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = nom + '.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        return tailleLisible(blob.size);
    }

    // ☰ → Exporter pour un courriel : le projet en un seul fichier .json
    async function exporteProjetTexte() {
        const instant = await prépareExport();
        if (!instant) return null;
        let texte;
        try { texte = await texteProjet(instant); }
        catch (e) { écritConsole('Impossible de préparer le projet : ' + e.message, 'erreur'); return null; }
        const nom = nomFichierProjet();
        const taille = téléchargeTexteProjet(texte, nom);
        écritConsole('— Projet « ' + nomDuProjet + ' » exporté dans « ' + nom + '.json » (' + taille + '), un seul fichier texte à joindre à un courriel : il est dans le dossier Téléchargements. Pour l\'ouvrir : ☰ → Charger un projet, ou glisser le fichier dans la liste des programmes.', 'info');
        try { await gardeProjetOuvert(instant); await rafraîchitListeProjets(); } catch (e) { /* rien */ }
        return nom + '.json';
    }

    // ------------------------------------------------------------------
    // Envoyer le projet (le bouton « partager » : une boîte et une flèche) : la feuille de
    // partage de l'appareil (Mail, Messages, AirDrop…) reçoit le projet en un seul fichier
    // texte (voir texteProjet). Chrome ne partage qu'une liste de types de fichiers, où .json
    // manque mais pas .txt : le projet part alors en .txt, que Charger un projet lit aussi.
    // La feuille de partage ne s'ouvre que pendant un clic : on prépare d'abord le fichier,
    // puis le bouton « Envoyer… » d'une petite fenêtre l'ouvre. Sans partage (Firefox sur un
    // ordinateur), le fichier est téléchargé, à joindre soi-même au courriel.
    // ------------------------------------------------------------------
    const SITE_PROJET = 'https://clauderouxster.github.io/Pythonerie/';

    // Le fichier que ce navigateur accepte de partager : .json, sinon .txt, sinon null
    function fichierÀPartager(texte, nom) {
        if (!navigator.share || !navigator.canShare) return null;
        for (const [extension, type] of [['.json', 'application/json'], ['.txt', 'text/plain']]) {
            const f = new File([texte], nom + extension, { type });
            try { if (navigator.canShare({ files: [f] })) return f; } catch (e) { /* type refusé */ }
        }
        return null;
    }

    async function partageProjet() {
        const instant = await prépareExport();
        if (!instant) return;
        let texte;
        try { texte = await texteProjet(instant); }
        catch (e) { écritConsole('Impossible de préparer le projet : ' + e.message, 'erreur'); return; }
        const nom = nomFichierProjet();
        const fichier = fichierÀPartager(texte, nom);
        if (!fichier) {
            const taille = téléchargeTexteProjet(texte, nom);
            écritConsole('— Ce navigateur ne sait pas envoyer un fichier : le projet est téléchargé dans « ' + nom + '.json » (' + taille + '), dans le dossier Téléchargements. Joins-le à ton courriel ; pour l\'ouvrir : ☰ → Charger un projet.', 'info');
        } else {
            const taille = tailleLisible(fichier.size);
            const choix = await dialogue('Envoyer « ' + nomDuProjet + ' »', 'Le projet est prêt : « ' + fichier.name + ' » (' + taille + '), un seul fichier avec tous ses programmes, ses données, ses images et ses sons.\n« Envoyer… » ouvre le partage de ton appareil : Mail, Messages, AirDrop…\nPour l\'ouvrir, il suffira de le charger dans la Pythonerie (☰ → Charger un projet).',
                [{ texte: '✉️ Envoyer…', valeur: 'oui', genre: 'principal' }, { texte: 'Annuler', valeur: null }]);
            if (choix !== 'oui') return;
            // l'adresse du site, pour celui qui reçoit le projet
            const lien = location.protocol === 'https:' ? location.origin + location.pathname : SITE_PROJET;
            try {
                // appelé tout de suite, pendant le clic sur « Envoyer… »
                await navigator.share({ files: [fichier], title: 'Projet « ' + nomDuProjet + ' »', text: 'Mon projet « ' + nomDuProjet + ' », fait dans la Pythonerie' + (lien ? ' (' + lien + ')' : '') + '. Pour l\'ouvrir : ☰ → Charger un projet, puis choisir ce fichier.' });
                écritConsole('— Projet « ' + nomDuProjet + ' » envoyé (' + fichier.name + ').', 'info');
            } catch (e) {
                if (e.name === 'AbortError') écritConsole('— Envoi annulé.', 'info');
                else { téléchargeTexteProjet(texte, nom); écritConsole('— Le partage n\'a pas marché (' + e.message + ') : le projet est téléchargé dans le dossier Téléchargements, joins-le toi-même à ton courriel.', 'info'); }
            }
        }
        try { await gardeProjetOuvert(instant); await rafraîchitListeProjets(); } catch (e) { /* rien */ }
    }

    // Lit le .zip d'un projet : { nom, élève, instant, ignorés }, ou une erreur. projet.json
    // est à la racine, ou dans un répertoire (un dossier compressé tel quel par le système).
    async function lisProjet(tampon) {
        const caché = (n) => n.split('/').some(m => m.startsWith('.') || m === '__MACOSX');
        const entrées = (await Zip.lit(tampon, { garde: (n) => !caché(n) })).filter(e => !caché(e.nom));
        const fiche = entrées.filter(e => e.octets && /(^|\/)projet\.json$/.test(e.nom)).sort((x, y) => x.nom.length - y.nom.length)[0];
        if (!fiche) throw new Error('il ne contient pas de fichier projet.json');
        const texte = (octets) => nfc(new TextDecoder().decode(octets)).replace(/\r\n?/g, '\n');
        let info = null;
        try { info = JSON.parse(texte(fiche.octets)); } catch (e) { /* info reste null */ }
        if (!info || info.format !== FORMAT_PROJET) throw new Error('son fichier projet.json ne décrit pas un projet de la Pythonerie');
        const racine = fiche.nom.slice(0, -'projet.json'.length);
        const instant = { programmes: {}, dossiers: [], fichiers: [], onglets: [] };
        const ignorés = [];
        for (const e of entrées) {
            if (e === fiche || !e.nom.startsWith(racine)) continue;
            const nom = e.nom.slice(racine.length);
            let m;
            if (!e.octets) {                                        // un répertoire
                if ((m = /^programmes\/(.+)\/$/.exec(nom))) {
                    const c = cheminValide(m[1]);
                    if (c) instant.dossiers.push(c); else ignorés.push(nom);
                }
            } else if ((m = /^programmes\/(.+)\.pyf$/i.exec(nom))) {
                const c = cheminValide(m[1]);
                if (c) instant.programmes[c] = texte(e.octets); else ignorés.push(nom);
            } else if ((m = /^onglets\/don(\d+)\.txt$/i.exec(nom)) && Number(m[1]) < ONGLETS_MAX) {
                instant.onglets[Number(m[1])] = texte(e.octets);
            } else {
                try { instant.fichiers.push(FichiersProjet.entrée(nom, e.octets)); } catch (err) { ignorés.push(nom); }
            }
        }
        instant.onglets = Array.from(instant.onglets, o => o || '');   // un onglet absent est vide
        return {
            nom: typeof info.nom === 'string' ? nfc(info.nom).trim() : '',
            élève: typeof info.élève === 'string' ? nfc(info.élève) : '',
            instant, ignorés
        };
    }

    // Rien à garder : aucun programme, aucun fichier, aucune donnée
    function espaceVide(instant) {
        const codes = Object.values(instant.programmes);
        if (instant.fichiers && instant.fichiers.length) return false;
        if ((instant.onglets || []).some(o => o !== '')) return false;
        return codes.length === 0;
    }

    // Fenêtre de dialogue : renvoie la valeur du bouton choisi (null pour Échap) ;
    // contenu : un élément affiché sous le texte (l'aperçu d'une image, par exemple)
    function dialogue(titre, texte, boutons, contenu) {
        return new Promise(résout => {
            const fond = $('dialogue');
            $('dialogueTitre').textContent = titre;
            $('dialogueTexte').textContent = texte;
            if (contenu) $('dialogueTexte').appendChild(contenu);
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
                // action : le bouton agit sans fermer la fenêtre (« 📋 Copier »)
                bouton.addEventListener('click', () => (b.action ? b.action(bouton) : ferme(b.valeur)));
                zone.appendChild(bouton);
            });
            document.addEventListener('keydown', clavier, true);
            fond.classList.add('visible');
            zone.querySelector('button').focus();
        });
    }

    // ------------------------------------------------------------------
    // Déconnexion : le projet ouvert est rangé dans la liste de l'élève, puis l'espace de
    // travail est vidé (programmes, répertoires, fichiers, historique de la console) ; la
    // liste « Mes projets » se ferme, jusqu'à la prochaine connexion.
    // ------------------------------------------------------------------
    async function déconnecte() {
        if (utilisateurUnique || !élève) return;
        // le projet ouvert rejoint la liste de l'élève (un projet sans nom : on lui demande)
        if (!(await rangeProjetOuvert())) return;
        await videEspace();
    }

    // Efface du navigateur tout ce qu'a laissé l'élève ; renvoie Faux en cas d'échec
    async function effaceDonnées() {
        try {
            await remplaceTout(ESPACE_VIDE());
        } catch (e) {
            écritConsole('Impossible d\'effacer le projet : ' + e.message, 'erreur');
            return false;
        }
        [CLÉ_PROPRIÉTAIRE, CLÉ_PRÉCÉDENT, 'pythonerie.historique', 'pythonerie.dernier'].forEach(clé => {
            try { localStorage.removeItem(clé); } catch (e) { /* rien */ }
        });
        changeNomProjet(SANS_NOM);
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
        fermeDéroulante();
        oubliePressePapiers();
        await rafraîchitListeProjets();
        effaceConsole();
        écritConsole('— Au revoir, ' + ancien + ' ! L\'espace a été vidé.', 'info');
    }

    // Un projet écrit en JSON, d'un seul bloc de texte : les fichiers texte (données, images
    // SVG) y sont écrits tels quels, les autres en base64, ou par une adresse https:// où la
    // Pythonerie va les chercher (si le site le permet) pour les ranger dans le projet.
    //   { "format": "projet-pythonerie", "version": 3, "nom": "Mon jeu",
    //     "programmes": { "Jeu": "importe \"jeux/outils\"\n…", "jeux/outils": "…" },
    //     "dossiers": ["jeux"], "onglets": ["pays,capitale\nFrance,Paris"],
    //     "fichiers": { "données/notes.csv": "…", "images/fusée.svg": "<svg…>", "sons/bravo.wav": { "base64": "…" },
    //                   "images/chat.png": { "url": "https://…" } } }
    async function lisProjetJSON(texte) {
        let p;
        try { p = JSON.parse(nfc(texte)); } catch (e) { throw new Error('ce n\'est pas du JSON valide (' + e.message + ')'); }
        if (!p || typeof p !== 'object' || p.format !== FORMAT_PROJET) throw new Error('il y manque "format": "projet-pythonerie"');
        if (!p.programmes || typeof p.programmes !== 'object' || Array.isArray(p.programmes)) throw new Error('il y manque "programmes"');
        const instant = { programmes: {}, dossiers: [], fichiers: [], onglets: [] };
        const ignorés = [];
        const ligne = (s) => s.replace(/\r\n?/g, '\n');
        for (const [c, code] of Object.entries(p.programmes)) {
            const chemin = cheminValide(c.replace(/\.pyf?$/i, ''));
            if (chemin && typeof code === 'string') instant.programmes[chemin] = ligne(code); else ignorés.push('programmes/' + c);
        }
        (Array.isArray(p.dossiers) ? p.dossiers : []).forEach(d => { const c = cheminValide(String(d)); if (c) instant.dossiers.push(c); });
        if (Array.isArray(p.onglets)) instant.onglets = p.onglets.slice(0, ONGLETS_MAX).map(o => typeof o === 'string' ? ligne(o) : '');
        const fichiers = p.fichiers && typeof p.fichiers === 'object' && !Array.isArray(p.fichiers) ? p.fichiers : {};
        const àTélécharger = [];
        for (const [c, v] of Object.entries(fichiers)) {
            try {
                let octets;
                if (v && typeof v.url === 'string') {
                    if (!/^https:\/\//i.test(v.url)) throw new Error();
                    àTélécharger.push([c, v.url]);
                    continue;
                }
                if (typeof v === 'string') {
                    // en texte : des données, ou une image SVG ; une autre image, un son : en base64
                    if (!c.startsWith('données/') && !/\.svg$/i.test(c)) throw new Error();
                    octets = new TextEncoder().encode(ligne(v));
                } else if (v && typeof v.base64 === 'string') {
                    const binaire = atob(v.base64.replace(/^data:[^,]*,/, '').replace(/\s+/g, ''));
                    octets = Uint8Array.from(binaire, x => x.charCodeAt(0));
                } else throw new Error();
                instant.fichiers.push(FichiersProjet.entrée(c, octets));
            } catch (e) { ignorés.push(c); }
        }
        // les fichiers donnés par une adresse : tous en même temps
        if (àTélécharger.length) écritConsole('— Téléchargement de ' + pluriel(àTélécharger.length, 'fichier') + ' du projet…', 'info');
        await Promise.all(àTélécharger.map(async ([c, url]) => {
            try {
                const r = await fetch(url);
                if (!r.ok) throw new Error('réponse ' + r.status);
                instant.fichiers.push(FichiersProjet.entrée(c, new Uint8Array(await r.arrayBuffer())));
            } catch (e) {
                // le site refuse souvent qu'une autre page lise ses fichiers : le programme peut
                // alors utiliser l'adresse elle-même, charge_image("https://…")
                ignorés.push(c + ' (' + url + ' ne peut pas être téléchargé : ' + (e.message === 'Failed to fetch' ? 'le site ne le permet pas' : e.message) + ')');
            }
        }));
        return {
            nom: typeof p.nom === 'string' ? p.nom.trim() : '',
            élève: typeof p.élève === 'string' ? p.élève : '',
            instant, ignorés
        };
    }

    // ☰ → Coller un projet : un projet en JSON, copié depuis une conversation avec Claude
    async function colleProjet() {
        const zone = document.createElement('textarea');
        zone.className = 'collage-projet';
        zone.spellcheck = false;
        zone.placeholder = '{ "format": "projet-pythonerie", "nom": "…", "programmes": { … } }';
        const choix = dialogue('Coller un projet (JSON)', 'Colle ici un projet écrit en JSON (préparé par Claude, par exemple), puis clique sur « Charger le projet ».\n',
            [{ texte: 'Charger le projet', valeur: 'oui', genre: 'principal' }, { texte: 'Annuler', valeur: null }], zone);
        setTimeout(() => zone.focus(), 0);
        if (await choix !== 'oui') return;
        // le JSON est souvent copié avec ce qui l'entoure (```json … ```) : on garde de { à }
        const texte = zone.value, début = texte.indexOf('{'), fin = texte.lastIndexOf('}');
        let lu;
        try { lu = await lisProjetJSON(début < 0 ? texte : texte.slice(début, fin + 1)); }
        catch (e) { alert('Ce texte n\'est pas un projet de la Pythonerie : ' + e.message + '.'); return; }
        if (await chargeProjet(lu)) écritConsole('— Le projet « ' + nomDuProjet + ' » est chargé.', 'info');
    }

    // Charge un projet venu d'un fichier .zip ou .json (menu ☰, glissé dans la liste, ou
    // répertoire Matériels) ; il remplace tout le projet en cours
    async function chargeProjetFichier(fichier) {
        // une archive de tous les projets (voir chargeArchive), plutôt qu'un projet
        if (!/\.(json|txt)$/i.test(fichier.name) && await estArchive(fichier)) { await chargeArchive(fichier); return false; }
        let lu;
        // un projet envoyé par le partage peut arriver en .txt (voir partageProjet)
        try { lu = /\.(json|txt)$/i.test(fichier.name) ? await lisProjetJSON(await fichier.text()) : await lisProjet(await fichier.arrayBuffer()); }
        catch (e) {
            alert('« ' + fichier.name + ' » n\'est pas un projet de la Pythonerie : ' + e.message + '.');
            return false;
        }
        return chargeProjet(lu);
    }

    // ------------------------------------------------------------------
    // Archive : tous les projets de l'utilisateur dans un seul fichier .zip
    //   archive.json         { format: 'archive-pythonerie', version, utilisateur, créé,
    //                          projets: [{ nom, modifié, fichier }] }
    //   projets/Jardin.zip   chaque projet, tel que l'exporte « Exporter le projet »
    // Relire une archive fusionne ses projets avec ceux de la liste : un projet dont le nom
    // est déjà pris fait l'objet d'une question (garder le mien, prendre celui de
    // l'archive, ou garder les deux).
    // ------------------------------------------------------------------
    const FORMAT_ARCHIVE = 'archive-pythonerie';
    const dateLisible = (secondes) => secondes ? new Date(secondes * 1000).toLocaleString('fr', { dateStyle: 'long', timeStyle: 'short' }) : 'date inconnue';

    async function exporteArchive() {
        if (!exigeÉlève('Pour archiver tes projets, dis d\'abord qui tu es.')) return;
        // le projet ouvert rejoint d'abord la liste, avec ses derniers changements
        if (!(await rangeProjetOuvert())) return;
        await rafraîchitListeProjets();
        if (!listeProjets.length) { écritConsole('— Tu n\'as encore aucun projet à archiver.', 'info'); return; }
        const u = nomCourant();
        const fiche = { format: FORMAT_ARCHIVE, version: 1, utilisateur: u, créé: new Date().toISOString(), projets: [] };
        const entrées = [];
        const pris = new Set();
        try {
            for (const p of listeProjets) {
                const projet = await FichiersProjet.litProjet(u, p.nom);
                if (!projet) continue;
                let fichier = pourFichier(p.nom) || 'projet';
                while (pris.has(fichier.toLowerCase())) fichier += '_';
                pris.add(fichier.toLowerCase());
                const zip = await archiveProjet({ programmes: projet.programmes || {}, dossiers: projet.dossiers || [],
                    onglets: projet.onglets || [''], fichiers: projet.fichiers || [] }, p.nom);
                entrées.push({ nom: 'projets/' + fichier + '.zip', octets: new Uint8Array(await zip.arrayBuffer()) });
                fiche.projets.push({ nom: p.nom, modifié: projet.modifié, fichier: 'projets/' + fichier + '.zip' });
            }
        } catch (e) { écritConsole('Impossible de préparer l\'archive : ' + e.message, 'erreur'); return; }
        const archive = await Zip.écrit([{ nom: 'archive.json', octets: new TextEncoder().encode(JSON.stringify(fiche, null, 1) + '\n') },
            { nom: 'projets/' }, ...entrées]);
        const nom = nomFichierProjet('Mes projets') + '.zip';
        const a = document.createElement('a');
        a.href = URL.createObjectURL(archive);
        a.download = nom;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        écritConsole('— ' + pluriel(fiche.projets.length, 'projet') + ' archivé' + (fiche.projets.length > 1 ? 's' : '') + ' dans « ' + nom
            + ' » (' + fiche.projets.map(p => p.nom).join(', ') + ') : le fichier est dans le dossier Téléchargements.', 'info');
    }

    // Vrai si ce fichier .zip est une archive de projets (il contient archive.json)
    async function estArchive(fichier) {
        try {
            const entrées = await Zip.lit(await fichier.arrayBuffer(), { garde: (n) => n === 'archive.json' });
            return entrées.some(e => e.nom === 'archive.json' && e.octets);
        } catch (e) { return false; }
    }

    // Un nom pris : garder le mien, prendre celui de l'archive, ou les deux. Renvoie
    // { choix: 'mien' | 'archive' | 'deux' | null, pourTous }
    async function choisitDoublon(nom, mien, archivé, libre, autres) {
        let caseTous = null;
        if (autres > 0) {
            const étiquette = document.createElement('label');
            étiquette.className = 'case-dialogue';
            caseTous = document.createElement('input');
            caseTous.type = 'checkbox';
            étiquette.append(caseTous, document.createTextNode(' Faire de même pour ' + (autres > 1 ? 'les ' + autres + ' autres projets' : 'l\'autre projet') + ' en double'));
            caseTous = étiquette;
        }
        const plusRécent = (archivé || 0) > (mien || 0) ? ' (le plus récent)' : '';
        const choix = await dialogue('« ' + nom + ' » est déjà dans tes projets',
            'Ton projet : modifié le ' + dateLisible(mien) + '\nCelui de l\'archive : modifié le ' + dateLisible(archivé) + plusRécent + '\n',
            [{ texte: 'Garder le mien', valeur: 'mien', genre: 'principal' },
             { texte: 'Prendre celui de l\'archive' + plusRécent, valeur: 'archive' },
             { texte: 'Garder les deux (« ' + libre + ' » pour celui de l\'archive)', valeur: 'deux' },
             { texte: 'Arrêter là', valeur: null }], caseTous);
        return { choix, pourTous: !!(caseTous && caseTous.querySelector('input').checked) };
    }

    async function chargeArchive(fichier) {
        if (!exigeÉlève('Pour charger une archive, dis d\'abord qui tu es.')) return;
        let entrées, fiche = null;
        try {
            entrées = await Zip.lit(await fichier.arrayBuffer(), { garde: (n) => n === 'archive.json' || /^projets\/[^/]+\.(zip|json)$/i.test(n) });
            const f = entrées.find(e => e.nom === 'archive.json' && e.octets);
            if (f) fiche = JSON.parse(nfc(new TextDecoder().decode(f.octets)));
        } catch (e) { fiche = null; }
        if (!fiche || fiche.format !== FORMAT_ARCHIVE) {
            alert('« ' + fichier.name + ' » n\'est pas une archive de projets de la Pythonerie.');
            return;
        }
        // le projet ouvert rejoint d'abord la liste : il est comparé comme les autres
        if (!(await rangeProjetOuvert())) return;
        await rafraîchitListeProjets();
        const u = nomCourant();
        const infos = new Map((Array.isArray(fiche.projets) ? fiche.projets : []).map(p => [nfc(String(p.fichier || '')), p]));
        // les projets de l'archive, lus d'abord (pour savoir combien sont en double)
        const lus = [], erreurs = [];
        for (const e of entrées) {
            if (!e.octets || e.nom === 'archive.json') continue;
            try {
                const lu = /\.json$/i.test(e.nom) ? await lisProjetJSON(new TextDecoder().decode(e.octets)) : await lisProjet(e.octets);
                const info = infos.get(e.nom) || {};
                const nom = nfc(String(info.nom || lu.nom || '')).trim() || e.nom.replace(/^projets\//, '').replace(/\.(zip|json)$/i, '');
                lus.push({ nom: nom === SANS_NOM ? 'Projet de l\'archive' : nom, modifié: info.modifié, instant: lu.instant });
            } catch (err) { erreurs.push(e.nom.replace(/^projets\//, '')); }
        }
        const pris = new Set(listeProjets.map(p => p.nom));
        const datesMiennes = new Map(listeProjets.map(p => [p.nom, p.modifié]));
        let restants = lus.filter(p => pris.has(p.nom)).length;
        const bilan = { ajoutés: [], remplacés: [], gardés: [], doubles: [] };
        let pourTous = null, arrêt = false, ouvertRemplacé = null;
        for (const p of lus) {
            if (arrêt) break;
            let nom = p.nom, choix = 'ajouter';
            if (pris.has(nom)) {
                restants--;
                let libre = nom;
                for (let i = 2; pris.has(libre); i++) libre = nom + ' ' + i;
                if (pourTous) choix = pourTous;
                else {
                    const r = await choisitDoublon(nom, datesMiennes.get(nom), p.modifié, libre, restants);
                    if (!r.choix) { arrêt = true; break; }
                    choix = r.choix;
                    if (r.pourTous) pourTous = r.choix;
                }
                if (choix === 'deux') nom = libre;
            }
            if (choix === 'mien') { bilan.gardés.push(nom); continue; }
            try {
                await FichiersProjet.gardeProjet(u, nom, p.instant);
                pris.add(nom);
                (choix === 'archive' ? bilan.remplacés : choix === 'deux' ? bilan.doubles : bilan.ajoutés).push(nom);
                if (choix === 'archive' && nom === nomDuProjet) ouvertRemplacé = p.instant;
            } catch (e) { erreurs.push(nom + ' (' + e.message + ')'); }
        }
        // le projet ouvert a été remplacé par celui de l'archive : l'écran le montre
        if (ouvertRemplacé) {
            try { await remplaceTout(ouvertRemplacé); } catch (e) { écritConsole('Impossible de rouvrir « ' + nomDuProjet + ' » : ' + e.message, 'erreur'); }
        }
        await rafraîchitListeProjets();
        const parties = [];
        if (bilan.ajoutés.length) parties.push(pluriel(bilan.ajoutés.length, 'projet') + ' ajouté' + (bilan.ajoutés.length > 1 ? 's' : '') + ' (' + bilan.ajoutés.join(', ') + ')');
        if (bilan.remplacés.length) parties.push(bilan.remplacés.length + ' remplacé' + (bilan.remplacés.length > 1 ? 's' : '') + ' par celui de l\'archive (' + bilan.remplacés.join(', ') + ')');
        if (bilan.doubles.length) parties.push(bilan.doubles.length + ' gardé' + (bilan.doubles.length > 1 ? 's' : '') + ' en double (' + bilan.doubles.join(', ') + ')');
        if (bilan.gardés.length) parties.push(bilan.gardés.length + ' laissé' + (bilan.gardés.length > 1 ? 's' : '') + ' tel' + (bilan.gardés.length > 1 ? 's' : '') + ' quel' + (bilan.gardés.length > 1 ? 's' : '') + ' (' + bilan.gardés.join(', ') + ')');
        écritConsole('— Archive « ' + fichier.name + ' » : ' + (parties.join(' ; ') || 'rien n\'a changé') + (arrêt ? ' ; arrêté avant la fin' : '') + '.', 'info');
        if (erreurs.length) écritConsole('Illisible' + (erreurs.length > 1 ? 's' : '') + ' dans l\'archive : ' + erreurs.join(', ') + '.', 'erreur');
    }

    // Le projet lu remplace le projet ouvert, qui est d'abord rangé dans la liste. S'il porte
    // le nom d'un projet de la liste, on demande : ouvrir celui de la liste (pour un projet
    // des Matériels déjà chargé, c'est ce qu'on veut), le charger sous un autre nom, ou
    // remplacer celui de la liste.
    // exemple : le projet est un exemple (voir exempleOuvert), qui n'entre pas dans la liste
    async function chargeProjet({ nom: nomLu, instant, ignorés }, { exemple = false } = {}) {
        let nom = nomLu && nomLu !== SANS_NOM ? nomLu : SANS_NOM;
        // le même exemple, déjà ouvert : on le recharge (rangeProjetOuvert demande s'il a changé)
        const mêmeExemple = exemple && nom === nomDuProjet && exempleOuvert() && !projetExiste(nom);
        if (nom !== SANS_NOM && !mêmeExemple && (projetExiste(nom) || nom === nomDuProjet)) {
            let libre = nom;
            for (let i = 2; projetExiste(libre) || libre === nomDuProjet; i++) libre = nom + ' ' + i;
            const choix = await dialogue('Tu as déjà un projet « ' + nom + ' »', 'Le projet que tu charges porte le même nom.',
                [{ texte: 'Ouvrir mon projet « ' + nom + ' »', valeur: 'ouvrir', genre: 'principal' },
                 { texte: 'Charger le nouveau sous le nom « ' + libre + ' »', valeur: 'autre' },
                 { texte: 'Remplacer mon projet par le nouveau', valeur: 'remplacer', genre: 'danger' },
                 { texte: 'Annuler', valeur: null }]);
            if (!choix) return false;
            if (choix === 'ouvrir') { await ouvreProjet(nom); return false; }
            if (choix === 'autre') nom = libre;
        }
        if (!(await rangeProjetOuvert())) return false;
        // un exemple chargé sous son nom reste un exemple ; il retrouve ses onglets de données
        const enExemple = exemple && nom === nomLu;
        if (enExemple && ongletsDeLExemple(nom)) instant = { ...instant, onglets: ongletsDeLExemple(nom) };
        try {
            await remplaceTout(instant);
            changeNomProjet(nom);
            if (enExemple) marqueExemple({ nom, signature: signatureExemple(await instantané()) });
            else await gardeProjetOuvert();
        } catch (e) {
            écritConsole('Erreur pendant le chargement du projet : ' + e.message, 'erreur');
        }
        await rafraîchitListeProjets();
        if (ignorés.length) {
            écritConsole('— ' + pluriel(ignorés.length, 'fichier') + ' du projet ' + (ignorés.length > 1 ? 'ont été laissés' : 'a été laissé')
                + ' de côté (mal placé, mal nommé ou mal écrit) : ' + ignorés.slice(0, 6).join(', ') + (ignorés.length > 6 ? '…' : '') + '.', 'info');
        }
        return true;
    }

    // serveur.py garde une copie des projets exportés par les élèves (pour l'enseignant).
    // On ne lui envoie rien tant qu'il n'a pas répondu à cette question : en ligne,
    // aucun projet ne part donc sur le réseau.
    let serveurProjets = false;

    async function détecteServeurProjets() {
        // GitHub Pages ne sert que des fichiers : inutile de chercher serveur.py
        if (location.hostname.endsWith('.github.io')) return false;
        try {
            const r = await fetch('api/projets', { cache: 'no-cache' });
            const réponse = r.ok ? await r.json() : null;
            return !!(réponse && réponse.projets === true);
        } catch (e) { return false; }
    }

    // ------------------------------------------------------------------
    // Le mode administrateur : la Pythonerie ouverte sur le port administrateur de serveur.py
    // (8001, sur la machine du serveur). Un professeur y crée son compte ou s'y connecte ; le
    // jeton de sa session (gardé le temps de l'onglet) accompagne les lectures de ses
    // programmes (liste_dans_serveur, lit_dans_serveur : voir Pyt.réseau). Sur le port des
    // élèves, le bouton 🔑 n'existe pas, et le serveur refuse de toute façon ces lectures.
    // ------------------------------------------------------------------
    let modeAdmin = false;
    let professeur = null;          // l'identifiant du professeur connecté
    let jetonAdmin = null;
    try { jetonAdmin = sessionStorage.getItem('pythonerie.jetonAdmin'); } catch (e) { /* rien */ }

    // { serveur, admin } : serveur.py est là, et la page vient de son port administrateur
    async function détecteServeur() {
        if (location.hostname.endsWith('.github.io')) return { serveur: false, admin: false, classe: null };
        try {
            const r = await fetch('api/serveur', { cache: 'no-cache' });
            const réponse = r.ok ? await r.json() : null;
            if (réponse && réponse.serveur === true) return { serveur: true, admin: réponse.admin === true, classe: réponse.classe || null };
        } catch (e) { /* un serveur plus ancien : seulement la copie des projets */ }
        return { serveur: await détecteServeurProjets(), admin: false, classe: null };
    }

    function gardeJeton(jeton) {
        jetonAdmin = jeton;
        try { if (jeton) sessionStorage.setItem('pythonerie.jetonAdmin', jeton); else sessionStorage.removeItem('pythonerie.jetonAdmin'); } catch (e) { /* rien */ }
    }

    // La session gardée dans l'onglet est-elle toujours valable ?
    async function vérifieSessionAdmin() {
        professeur = null;
        if (!jetonAdmin) return;
        try {
            const r = await fetch('api/admin/moi', { headers: { 'X-Pythonerie-Jeton': jetonAdmin } });
            const réponse = await r.json();
            if (r.ok && réponse.identifiant) professeur = réponse.identifiant;
            else gardeJeton(null);
        } catch (e) { gardeJeton(null); }
    }

    function afficheAdmin() {
        const b = $('btnAdmin');
        b.hidden = !modeAdmin;
        document.body.classList.toggle('mode-admin', modeAdmin);
        $('nomAdmin').textContent = professeur ? 'Administrateur : ' + professeur : 'Mode administrateur : se connecter';
        b.title = professeur ? 'Connecté(e) en tant que « ' + professeur + ' » : cliquer pour se déconnecter'
                             : 'Se connecter, ou créer un compte de professeur';
    }

    async function ouvreAdmin(message) {
        if (professeur) {
            const choix = await dialogue('Mode administrateur', 'Tu es connecté(e) en tant que « ' + professeur + ' ».',
                [{ texte: 'Se déconnecter', valeur: 'sortie', genre: 'danger' }, { texte: 'Fermer', valeur: null }]);
            if (choix !== 'sortie') return;
            try { await fetch('api/admin/déconnexion', { method: 'POST', headers: { 'X-Pythonerie-Jeton': jetonAdmin || '' } }); } catch (e) { /* rien */ }
            // le programme en cours lisait peut-être les données du professeur : il s'arrête, et le
            // projet ouvert est fermé (rangé dans Mes projets, comme avec ✖ Fermer le projet)
            if (Pyt.enCours()) arrête();
            let vide = false;
            try { vide = nomDuProjet === SANS_NOM && espaceVide(await instantané()); } catch (e) { /* rien */ }
            if (!vide) await fermeProjet();
            écritConsole('— « ' + professeur + ' » est déconnecté(e) du mode administrateur.', 'info');
            gardeJeton(null);
            professeur = null;
            afficheAdmin();
            return;
        }
        // le formulaire : identifiant et mot de passe
        const formulaire = document.createElement('div');
        formulaire.className = 'formulaire-admin';
        const champ = (libellé, type) => {
            const l = document.createElement('label');
            l.textContent = libellé;
            const i = document.createElement('input');
            i.type = type;
            i.autocomplete = type === 'password' ? 'current-password' : 'username';
            i.spellcheck = false;
            l.appendChild(i);
            formulaire.appendChild(l);
            return i;
        };
        const identifiant = champ('Identifiant', 'text');
        const motDePasse = champ('Mot de passe', 'password');
        identifiant.value = ouvreAdmin.dernier || '';
        // Entrée, dans un champ : se connecter
        formulaire.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') { ev.preventDefault(); $('dialogueBoutons').querySelector('button').click(); }
        });
        setTimeout(() => (identifiant.value ? motDePasse : identifiant).focus(), 0);
        const choix = await dialogue('Mode administrateur',
            (message ? message + '\n\n' : '') + 'Connecte-toi avec ton compte de professeur, ou crée-le (la première fois). '
            + 'Le mot de passe n\'est jamais gardé sur le serveur : seulement son empreinte.',
            [{ texte: 'Se connecter', valeur: 'connexion', genre: 'principal' },
             { texte: 'Créer le compte', valeur: 'compte' },
             { texte: 'Annuler', valeur: null }], formulaire);
        if (!choix) return;
        ouvreAdmin.dernier = nfc(identifiant.value).trim();
        let réponse = null;
        try {
            const r = await fetch('api/admin/' + choix, { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifiant: ouvreAdmin.dernier, mot_de_passe: motDePasse.value }) });
            réponse = await r.json();
        } catch (e) { réponse = { erreur: 'le serveur ne répond pas' }; }
        if (!réponse || réponse.erreur) return ouvreAdmin('⚠️ ' + ((réponse && réponse.erreur) || 'erreur'));
        gardeJeton(réponse.jeton);
        professeur = réponse.identifiant;
        afficheAdmin();
        écritConsole('— Mode administrateur : ' + (choix === 'compte' ? 'compte « ' + professeur + ' » créé, et ' : '')
            + 'connecté(e) en tant que « ' + professeur + ' ». Les élèves t\'envoient des données avec sauve_dans_serveur("'
            + professeur + '", chemin, valeur) ; tes programmes les lisent avec liste_dans_serveur et lit_dans_serveur.', 'info');
    }

    // Envoie la copie du projet au serveur ; il ne remplace jamais un projet existant
    async function envoieProjet(nom, archive) {
        try {
            const r = await fetch('api/projets/' + encodeURIComponent(nom), {
                method: 'POST', headers: { 'Content-Type': 'application/zip' }, body: archive
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
        return nom.replace(/\.pyf?$/i, '');
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
    // le répertoire données, choisi d'un clic (sur lui ou sur l'un de ses fichiers) : ＋ y crée
    // alors un fichier de données (Données.txt), pas un programme. Une seule ligne de l'arbre est
    // surlignée comme choisie : le programme ouvert, le fichier de données ouvert, ou le répertoire
    // données lui-même (surRépertoireDonnées) ; un clic sur un programme le choisit de nouveau
    let dansDonnées = false;
    let surRépertoireDonnées = false;
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
    const SVG_COPIER = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" width="14" height="14"><rect x="5.5" y="5.5" width="8" height="8.5" rx="1.2"/><path d="M10.5 3.5V2.7c0-.7-.5-1.2-1.2-1.2H3.2c-.7 0-1.2.5-1.2 1.2v6.6c0 .7.5 1.2 1.2 1.2h.8"/></svg>';
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
    // répertoire : pour les répertoires images, sons, données du projet (fichiers de l'ordinateur seulement)
    function rendCible(element, dossier, répertoire = null) {
        element.addEventListener('dragover', (ev) => {
            const fichiers = ev.dataTransfer.types.includes('Files');
            if (!fichiers && (répertoire || !ev.dataTransfer.types.includes(TYPE_GLISSE))) return;
            ev.preventDefault();
            ev.stopPropagation();
            ev.dataTransfer.dropEffect = fichiers ? 'copy' : 'move';
            element.classList.add('cible');
        });
        element.addEventListener('dragleave', (ev) => {
            if (!element.contains(ev.relatedTarget)) element.classList.remove('cible');
        });
        element.addEventListener('drop', async (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            element.classList.remove('cible');
            // des fichiers de l'ordinateur : programmes .pyf (ou .py), images, sons, données
            if (ev.dataTransfer.files && ev.dataTransfer.files.length) {
                await importe(ev.dataTransfer.files, dossier, répertoire);
                return;
            }
            let objet;
            try { objet = JSON.parse(ev.dataTransfer.getData(TYPE_GLISSE)); } catch (e) { return; }
            await déplace(objet.genre, objet.chemin, dossier);
        });
    }

    // ------------------------------------------------------------------
    // Les répertoires du projet : images, sons, données (voir fichiers-projet.js).
    // Repliés au départ ; on y glisse des fichiers de l'ordinateur, ou on utilise ＋.
    // ------------------------------------------------------------------
    let ouvertsProjet = new Set();
    try { ouvertsProjet = new Set(JSON.parse(localStorage.getItem('pythonerie.ouvertsProjet') || '[]')); } catch (e) { /* rien */ }
    function enregistreOuvertsProjet() {
        try { localStorage.setItem('pythonerie.ouvertsProjet', JSON.stringify([...ouvertsProjet])); } catch (e) { /* rien */ }
    }
    let répertoireÀRemplir = null;      // le répertoire visé par le bouton ＋

    const SVG_RÉPERTOIRE_PROJET = '<svg viewBox="0 0 16 16" fill="none"><path d="M1.5 2h4.7l1 1H14.5v10h-13V2z" fill="#5b87b8"/><path d="M1.5 4.5h13V13h-13V4.5z" fill="#8fb4dc"/></svg>';
    const SVG_IMAGE = '<svg viewBox="0 0 16 16" fill="none"><rect x="1.5" y="2.5" width="13" height="11" rx="1" stroke="currentColor" stroke-width="1.1"/><circle cx="5.5" cy="6" r="1.3" fill="currentColor"/><path d="M2 12l4-4 3 3 2-2 3 3" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/></svg>';
    const SVG_SON = '<svg viewBox="0 0 16 16" fill="none"><path d="M2.5 6h2.5l3.5-3v10l-3.5-3H2.5z" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/><path d="M11 5.5c1.2 1.4 1.2 3.6 0 5M12.8 4c2 2.3 2 5.7 0 8" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>';
    const SVG_AJOUTER = '<svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M7.25 2h1.5v5.25H14v1.5H8.75V14h-1.5V8.75H2v-1.5h5.25z"/></svg>';
    const ICÔNES_FICHIERS = { images: SVG_IMAGE, sons: SVG_SON, données: SVG_DONNÉES };
    const EXPLICATIONS = {
        images: 'Glisse des images ici (png, jpg, gif, svg, webp) : charge_image("chat.png")',
        sons: 'Glisse des sons ici (wav, mp3, ogg) : charge_son("miaou.wav")',
        données: 'Glisse des données ici (txt, csv, json…) : charge_données("notes.csv")'
    };

    function afficheRépertoiresProjet(ul) {
        const tous = FichiersProjet.liste();
        Object.keys(FichiersProjet.RÉPERTOIRES).forEach(rép => {
            const contenu = tous.filter(f => f.chemin.startsWith(rép + '/'));
            const ouvert = ouvertsProjet.has(rép);
            const li = ligneArbre(0, 'dossier répertoire-projet');
            if (rép === 'données' && dansDonnées && surRépertoireDonnées) li.classList.add('actif');
            li.title = EXPLICATIONS[rép];
            const chevron = document.createElement('span');
            chevron.className = 'arbre-chevron' + (ouvert ? ' ouvert' : '');
            chevron.innerHTML = SVG_CHEVRON;
            const icône = document.createElement('span');
            icône.className = 'arbre-icône';
            icône.innerHTML = SVG_RÉPERTOIRE_PROJET;
            const nom = document.createElement('span');
            nom.className = 'programme-nom';
            nom.textContent = rép;
            const nombre = document.createElement('span');
            nombre.className = 'nombre-exemples';
            nombre.textContent = contenu.length;
            li.append(chevron, icône, nom, nombre, boutonsActions([
                [SVG_AJOUTER, 'Ajouter des fichiers dans « ' + rép + ' »', () => { répertoireÀRemplir = rép; $('fichierRépertoire').click(); }]
            ]));
            li.addEventListener('click', () => {
                if (ouvert) ouvertsProjet.delete(rép); else ouvertsProjet.add(rép);
                enregistreOuvertsProjet();
                dansDonnées = surRépertoireDonnées = rép === 'données';
                afficheArbre();
            });
            rendCible(li, '', rép);
            ul.appendChild(li);
            if (!ouvert) return;
            if (!contenu.length) {
                const vide = ligneArbre(1, 'liste-vide');
                vide.textContent = EXPLICATIONS[rép];
                rendCible(vide, '', rép);
                ul.appendChild(vide);
            }
            contenu.forEach(f => {
                const nomF = f.chemin.slice(rép.length + 1);
                const lf = ligneArbre(1, 'programme fichier-projet');
                lf.title = nomF + ' (' + (f.taille < 1024 ? f.taille + ' octets' : (f.taille / 1024).toFixed(0) + ' Ko') + ')';
                const espace = document.createElement('span');
                espace.className = 'arbre-chevron';
                const icôneF = document.createElement('span');
                icôneF.className = 'arbre-icône';
                icôneF.innerHTML = ICÔNES_FICHIERS[rép];
                const nomÉl = document.createElement('span');
                nomÉl.className = 'programme-nom';
                nomÉl.textContent = nomF;
                lf.append(espace, icôneF, nomÉl, boutonsActions([
                    [SVG_COPIER, 'Copier « ' + nomF + ' », pour le coller dans un autre projet', () => copieFichier(f.chemin)],
                    [SVG_RENOMMER, 'Renommer « ' + nomF + ' »', () => renommeFichier(f.chemin)],
                    [SVG_EXPORTER, 'Exporter « ' + nomF + ' » (le télécharger)', () => exporteFichier(f.chemin)],
                    [SVG_SUPPRIMER, 'Supprimer « ' + nomF + ' »', () => supprimeFichier(f.chemin)]
                ]));
                if (f.chemin === fichierOuvert && !surRépertoireDonnées) lf.classList.add('actif');
                // un fichier de données s'ouvre dans l'éditeur ; une image ou un son, en aperçu
                lf.addEventListener('click', () => {
                    if (rép === 'données') { ouvreFichierDonnées(f.chemin); return; }
                    // une image ou un son : un aperçu, et ＋ revient aux programmes
                    if (dansDonnées) { dansDonnées = surRépertoireDonnées = false; afficheArbre(); }
                    aperçuFichier(f.chemin);
                });
                rendCible(lf, '', rép);
                ul.appendChild(lf);
            });
        });
    }

    // Un clic sur un fichier : l'image en grand, le son joué, ou le début des données
    function aperçuFichier(chemin) {
        const nom = chemin.slice(chemin.indexOf('/') + 1);
        if (chemin.startsWith('sons/') || chemin.startsWith('images/')) {
            aperçuMédia(nom, FichiersProjet.url(chemin), nom, chemin.startsWith('sons/'));
            return;
        }
        const texte = FichiersProjet.texte(chemin) || '';
        const contenu = document.createElement('pre');
        contenu.className = 'aperçu-données';
        contenu.textContent = texte.length > 4000 ? texte.slice(0, 4000) + '\n…' : texte;
        dialogue(nom, 'Dans un programme : charge_données("' + nom + '")', [{ texte: 'Fermer', valeur: null, genre: 'principal' }], contenu);
    }

    // L'aperçu d'un son ou d'une image (du projet, ou des médias du site) : le son s'écoute avec
    // ses commandes (▶ : il ne part pas tout seul), l'image se montre ; dessous, la ligne qui le charge dans un programme
    // (son_ding = charge_son("médias/sounds/ding.wav")), que « 📋 Copier » met dans le presse-papiers,
    // pour la coller dans l'éditeur. adresse : ce qu'écrit le programme (un nom, ou médias/…)
    function aperçuMédia(nom, url, adresse, estSon) {
        const base = nfc(nom).replace(/\.[^.]+$/, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '') || 'média';
        const ligne = (estSon ? 'son_' : 'image_') + base + ' = ' + (estSon ? 'charge_son' : 'charge_image') + '("' + adresse + '")';
        const contenu = document.createElement('div');
        let lecteur = null;
        if (estSon) {
            lecteur = document.createElement('audio');
            lecteur.controls = true;
            lecteur.src = url;
            lecteur.className = 'aperçu-son';
            contenu.appendChild(lecteur);
        } else {
            const img = document.createElement('img');
            img.src = url;
            img.className = 'aperçu-image';
            img.alt = nom;
            contenu.appendChild(img);
        }
        const code = document.createElement('pre');
        code.className = 'aperçu-données aperçu-ligne';
        code.textContent = ligne;
        contenu.appendChild(code);
        dialogue(nom, 'Dans un programme :', [
            { texte: '📋 Copier', action: (bouton) => copieTexte(ligne, bouton) },
            { texte: 'Fermer', valeur: null, genre: 'principal' }
        ], contenu).then(() => { if (lecteur) lecteur.pause(); });
    }

    async function renommeFichier(chemin) {
        const ancien = chemin.slice(chemin.indexOf('/') + 1);
        const nouveau = prompt('Nouveau nom pour « ' + ancien + ' » :', ancien);
        if (!nouveau || nfc(nouveau).trim() === ancien) return;
        if (chemin === fichierOuvert) await sauveFichier();
        try {
            const n = await FichiersProjet.renomme(chemin, nouveau);
            if (chemin === fichierOuvert) { fichierOuvert = n; décritFichierOuvert(); }
        } catch (e) { écritConsole(e.message + '.', 'erreur'); }
        afficheArbre();
    }

    async function supprimeFichier(chemin) {
        const nom = chemin.slice(chemin.indexOf('/') + 1);
        if (!confirm('Supprimer « ' + nom + ' » du projet ?')) return;
        if (chemin === fichierOuvert) oublieFichierOuvert();      // sans l'enregistrer : il serait recréé
        try { await FichiersProjet.supprime(chemin); } catch (e) { écritConsole(e.message + '.', 'erreur'); }
        afficheArbre();
    }

    function exporteFichier(chemin) {
        const blob = FichiersProjet.blob(chemin);
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = chemin.slice(chemin.indexOf('/') + 1);
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
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
            if (d === dossierCourant && !dansDonnées) li.classList.add('sélection');
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
                dansDonnées = surRépertoireDonnées = false;
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
            if (p.chemin === courant && !fichierOuvert && !dansDonnées) li.classList.add('actif');
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
                [SVG_COPIER, 'Copier « ' + nomDe(p.chemin) + ' », pour le coller dans un autre projet', () => {
                    // l'icône d'un programme choisi copie toute la sélection
                    copieProgrammes(sélection.size > 1 && sélection.has(p.chemin) ? [...sélection] : [p.chemin]);
                }],
                [SVG_RENOMMER, 'Renommer « ' + nomDe(p.chemin) + ' »', () => renomme(p.chemin)],
                [SVG_EXPORTER, 'Exporter « ' + nomDe(p.chemin) + ' » (télécharger le fichier .pyf)', () => exporte(p.chemin)],
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
        if (dansDonnées) { dansDonnées = surRépertoireDonnées = false; afficheArbre(); }
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

    // ------------------------------------------------------------------
    // Copier-coller entre projets : l'icône ⧉ d'un programme ou d'un fichier du projet (ou
    // Cmd/Ctrl+C sur des programmes choisis) le met de côté ; le bandeau « Coller » (ou
    // Cmd/Ctrl+V) le recopie dans le projet ouvert, même après un changement de projet :
    // les programmes dans le répertoire courant, les fichiers dans leur répertoire. Un nom
    // déjà pris devient « nom 2 ». Ce qui est copié reste en mémoire le temps de la session,
    // et il est oublié à la déconnexion (l'élève suivant ne colle pas les fichiers d'un autre).
    // ------------------------------------------------------------------
    let pressePapiers = [];     // [{ genre: 'programme', nom, code } | { genre: 'fichier', chemin, blob }]

    const nomCopié = (e) => e.genre === 'programme' ? e.nom : e.chemin.slice(e.chemin.indexOf('/') + 1);
    const décrisCopie = () => pressePapiers.length === 1 ? '« ' + nomCopié(pressePapiers[0]) + ' »'
        : pressePapiers.length + ' éléments (' + pressePapiers.slice(0, 3).map(nomCopié).join(', ') + (pressePapiers.length > 3 ? '…' : '') + ')';

    async function copieProgrammes(chemins) {
        await sauvegarde();
        const éléments = [];
        for (const c of chemins) {
            try { éléments.push({ genre: 'programme', nom: nomDe(c), code: c === courant ? éditeur.getValue() : await stockage.lit(c) }); }
            catch (e) { écritConsole('Impossible de copier « ' + c + ' » : ' + e.message, 'erreur'); }
        }
        metDeCôté(éléments);
    }

    function copieFichier(chemin) {
        const blob = FichiersProjet.blob(chemin);
        if (blob) metDeCôté([{ genre: 'fichier', chemin, blob }]);
    }

    function metDeCôté(éléments) {
        if (!éléments.length) return;
        pressePapiers = éléments;
        afficheBandeauCollage();
        écritConsole('— Copié : ' + décrisCopie() + '. Pour le coller dans un autre projet, ouvre-le, puis clique sur « Coller ».', 'info');
    }

    function oubliePressePapiers() {
        pressePapiers = [];
        afficheBandeauCollage();
    }

    function afficheBandeauCollage() {
        const bandeau = $('bandeauCollage');
        bandeau.hidden = !pressePapiers.length;
        if (!pressePapiers.length) return;
        bandeau.innerHTML = '';
        const texte = document.createElement('span');
        texte.textContent = '📋 ' + décrisCopie();
        texte.title = 'Copié : ' + pressePapiers.map(nomCopié).join(', ');
        const coller = document.createElement('button');
        coller.className = 'btn btn-petit';
        coller.textContent = 'Coller';
        coller.title = 'Coller dans le projet ouvert (Cmd/Ctrl+V)';
        coller.addEventListener('click', colle);
        const oublier = document.createElement('button');
        oublier.className = 'btn btn-secondaire btn-petit btn-icône';
        oublier.textContent = '✕';
        oublier.title = 'Oublier ce qui a été copié';
        oublier.setAttribute('aria-label', oublier.title);
        oublier.addEventListener('click', oubliePressePapiers);
        bandeau.append(texte, coller, oublier);
    }

    // Un nom de fichier libre dans un répertoire du projet : « chat.png », « chat 2.png »...
    function fichierLibre(répertoire, nom) {
        if (!FichiersProjet.existe(répertoire + '/' + nom)) return nom;
        const i = nom.lastIndexOf('.');
        const base = i > 0 ? nom.slice(0, i) : nom, extension = i > 0 ? nom.slice(i) : '';
        for (let k = 2; ; k++) if (!FichiersProjet.existe(répertoire + '/' + base + ' ' + k + extension)) return base + ' ' + k + extension;
    }

    async function colle() {
        if (!pressePapiers.length) return;
        await sauvegarde();
        const collés = [];
        let premierProgramme = null;
        for (const e of pressePapiers) {
            try {
                if (e.genre === 'programme') {
                    const chemin = cheminLibre(dossierCourant, e.nom);
                    await stockage.écrit(chemin, e.code);
                    await rafraichitListe();         // le nom suivant doit voir celui-ci
                    collés.push(chemin);
                    if (!premierProgramme) premierProgramme = chemin;
                } else {
                    const répertoire = e.chemin.slice(0, e.chemin.indexOf('/'));
                    const nom = fichierLibre(répertoire, nomCopié(e));
                    const chemin = await FichiersProjet.ajoute(new File([e.blob], nom, { type: e.blob.type }), répertoire);
                    ouvertsProjet.add(répertoire);
                    collés.push(chemin);
                }
            } catch (err) {
                écritConsole('Impossible de coller « ' + nomCopié(e) + ' » : ' + err.message, 'erreur');
            }
        }
        enregistreOuvertsProjet();
        await rafraichitListe();
        // un projet vide : on ouvre le programme collé
        if (!courant && premierProgramme) await ouvre(premierProgramme);
        if (collés.length) écritConsole('— Collé dans « ' + nomDuProjet + ' » : ' + collés.join(', ') + '.', 'info');
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
        else aucunProgramme();
    }

    function afficheArbre() {
        // le fichier de données ouvert a pu être supprimé, ou remplacé (fichier ajouté du même nom)
        rechargeFichierOuvert();
        // la sélection ne garde que les programmes qui existent encore
        sélection = new Set([...sélection].filter(c => programmes.some(p => p.chemin === c)));
        afficheBandeau();
        const ul = $('listeProgrammes');
        ul.innerHTML = '';
        afficheRépertoiresProjet(ul);
        if (!programmes.length && !dossiers.length) {
            const vide = document.createElement('li');
            vide.className = 'liste-vide';
            vide.textContent = 'Aucun programme';
            ul.appendChild(vide);
        }
        afficheDossier(ul, '', 0);
        const ici = dossierCourant ? '« ' + dossierCourant + ' »' : 'la racine';
        $('btnNouveauFichier').title = dansDonnées ? 'Nouveau fichier de données dans « données »' : 'Nouveau programme dans ' + ici;
        $('btnNouveauFichier').setAttribute('aria-label', $('btnNouveauFichier').title);
        titreNouveau();
        $('btnNouveauDossier').title = 'Nouveau répertoire dans ' + ici;
        $('genreStockage').textContent = 'Enregistrés dans ce navigateur'
            + (serveurProjets ? ' — projets exportés aussi conservés sur le serveur de la classe' : '') + (dossierCourant ? ' — nouveaux programmes dans « ' + dossierCourant + ' »' : '');
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

    // ------------------------------------------------------------------
    // Les données du projet (bouton « Données ») : des onglets Don0, Don1...
    // À l'exécution, chaque onglet non vide devient une variable : don0 = """...""".
    // Ils appartiennent au projet, pas à un programme : tous les programmes (et ceux
    // qu'ils importent) voient les mêmes don0, don1... Ils sont enregistrés à part dans
    // le navigateur, et rangés dans le projet exporté (onglets/don0.txt, onglets/don1.txt...).
    // ------------------------------------------------------------------
    const CLÉ_ONGLETS = 'pythonerie.onglets';
    const ONGLETS_MAX = 20;
    let onglets = [''];
    let ongletActif = 0;
    let modeDonnées = false;

    const pluriel = (n, mot) => n + ' ' + mot + (n > 1 ? 's' : '');

    // Une liste d'onglets acceptable (au moins Don0, au plus ONGLETS_MAX, des textes)
    function ongletsValides(liste) {
        const l = Array.isArray(liste) ? liste.slice(0, ONGLETS_MAX).map(x => typeof x === 'string' ? nfc(x).replace(/\r\n?/g, '\n') : '') : [];
        return l.length ? l : [''];
    }

    function litOnglets() {
        try { return ongletsValides(JSON.parse(localStorage.getItem(CLÉ_ONGLETS) || '[""]')); } catch (e) { return ['']; }
    }

    function enregistreOnglets() {
        try {
            if (onglets.length === 1 && onglets[0] === '') localStorage.removeItem(CLÉ_ONGLETS);
            else localStorage.setItem(CLÉ_ONGLETS, JSON.stringify(onglets));
        } catch (e) {
            écritConsole('Les données n\'ont pas pu être enregistrées : ' + e.message, 'erreur');
        }
    }

    // Écrit un onglet comme une chaîne du programme. Les chaînes """...""" et '''...'''
    // gardent leur contenu tel quel (pas d'échappement) : on prend celle qui ne peut pas
    // être coupée par le contenu. Le contenu ne doit pas non plus contenir d'accent grave
    // (le délimiteur des chaînes LispE), ni de ligne commençant par « rem » (une ligne de
    // commentaire du BASIC, retirée avant l'analyse), ni f" (réécrit pour les f-chaînes).
    // Dans ces cas rares, on passe par le base64, qui transporte tout sans risque.
    function littéralDonnées(t) {
        const risqué = t.includes('`') || t.includes('KX§') || t.includes('f"')
            || t.split('\n').some(l => /^rem /i.test(l.trim()));
        const sûr = (d) => !risqué && !t.includes(d) && !t.endsWith(d[0]);
        if (sûr('"""')) return '"""' + t + '"""';
        if (sûr("'''")) return "'''" + t + "'''";
        return 'de_base64("' + base64(t) + '")';
    }

    // Les lignes ajoutées au début du programme : don0 = """...""", don1 = ...
    // (un onglet vide ne définit pas de variable)
    function définitionsDonnées() {
        const défs = [];
        onglets.forEach((t, i) => { if (t !== '') défs.push('don' + i + ' = ' + littéralDonnées(t)); });
        return défs;
    }

    function afficheOnglets() {
        const zone = $('ongletsDonnées');
        zone.innerHTML = '';
        onglets.forEach((t, i) => {
            const b = document.createElement('button');
            b.className = 'onglet' + (i === ongletActif ? ' actif' : '') + (t === '' ? ' vide' : '');
            b.textContent = 'Don' + i;
            b.setAttribute('role', 'tab');
            b.title = t === '' ? 'Onglet vide' : 'don' + i + ' : ' + pluriel(t.split('\n').length, 'ligne');
            b.addEventListener('click', () => { ongletActif = i; afficheOnglets(); $('texteDonnées').focus(); });
            zone.appendChild(b);
        });
        const texte = $('texteDonnées');
        if (texte.value !== onglets[ongletActif]) texte.value = onglets[ongletActif];
        // le nom de la variable est celui de l'onglet ouvert : don0, don1...
        texte.placeholder = 'Tape ou colle tes données ici, ou charge un fichier.\n'
            + 'Tu pourras les appeler dans ton code avec la variable don' + ongletActif + '.';
        afficheNoteDonnées();
        $('btnAjouteOnglet').disabled = onglets.length >= ONGLETS_MAX;
        $('btnRetireOnglet').disabled = ongletActif === 0 && onglets[0] === '';
        $('btnRetireOnglet').title = ongletActif === 0 ? 'Vider l\'onglet Don0 (il reste toujours là)' : 'Retirer l\'onglet Don' + ongletActif;
        $('btnAnnuleOnglet').disabled = !annulationsOnglets.length;
        libelléBoutonDonnées();
    }

    // En mode Données, le bouton ramène au code : il s'appelle alors « Code »
    function libelléBoutonDonnées() {
        const pleins = onglets.filter(t => t !== '').length;
        $('btnDonnées').textContent = modeDonnées ? '✎ Code' : '▦ Données' + (pleins ? ' (' + pleins + ')' : '');
    }

    function afficheNoteDonnées() {
        const t = onglets[ongletActif];
        const nom = 'don' + ongletActif;
        $('noteDonnées').innerHTML = t === ''
            ? 'Onglet vide : il ne crée pas de variable <code>' + nom + '</code>.'
            : 'Dans ton programme, ces données s\'appellent <code>' + nom + '</code> (' + pluriel(t.split('\n').length, 'ligne') + ').';
    }

    // Les onglets d'un autre projet (chargé, nouveau, revenu ou effacé)
    function remplaceOnglets(liste) {
        annulationsOnglets = [];
        onglets = ongletsValides(liste);
        ongletActif = 0;
        enregistreOnglets();
        afficheOnglets();
    }

    // ------------------------------------------------------------------
    // Un fichier du répertoire données, ouvert dans l'éditeur par un clic dans l'arbre du projet.
    // Il prend la place du code, comme les onglets de données ; le programme ouvert reste celui
    // qu'exécute ▶. Chaque modification est enregistrée toute seule, un instant après la frappe :
    // FichiersProjet.écritTexte la met aussitôt en mémoire (charge_données la relit), puis dans
    // le navigateur (IndexedDB).
    // ------------------------------------------------------------------
    let éditeurFichier = null;      // un second CodeMirror, créé au premier fichier ouvert
    let fichierOuvert = null;       // "données/notes.csv"
    let fichierModifié = false, minuterieFichier = null, chargementFichier = false;

    // Le bouton de l'éditeur : ■ Arrêter pendant que le programme tourne ; sinon ▶ Exécuter, prêt
    // quand LispE l'est, sauf pendant qu'un fichier de données est affiché (il s'arrête quand même)
    let titreExécuter = null;
    function actualiseExécuter() {
        const b = $('btnExécuter');
        if (titreExécuter === null) titreExécuter = b.title;
        const enCours = wasmPrêt && Pyt.enCours();
        b.disabled = !wasmPrêt || (!!fichierOuvert && !enCours);
        b.textContent = enCours ? '■ Arrêter' : '▶ Exécuter';
        b.classList.toggle('danger', enCours);      // ■ Arrêter, en rouge
        b.title = enCours ? 'Arrêter le programme'
            : fichierOuvert ? 'Un fichier de données ne s\'exécute pas : ✎ Code ramène au programme' : titreExécuter;
    }

    function installeÉditeurFichier() {
        if (éditeurFichier) return;
        éditeurFichier = CodeMirror.fromTextArea($('texteFichier'), {
            mode: null,
            theme: document.body.classList.contains('dark-mode') ? 'dracula' : 'default',
            lineNumbers: true,
            indentUnit: 4,
            tabSize: 4,
            indentWithTabs: false,
            styleActiveLine: true,
            extraKeys: {
                'Ctrl-S': () => { sauveFichier(); },
                'Cmd-S': () => { sauveFichier(); }
            }
        });
        // comme dans l'éditeur du code : tout ce qui entre est mis en NFC
        éditeurFichier.on('beforeChange', (cm, changement) => {
            if (!changement.update) return;
            const texte = changement.text.map(nfc);
            if (texte.some((ligne, i) => ligne !== changement.text[i])) changement.update(changement.from, changement.to, texte);
        });
        éditeurFichier.on('change', () => {
            if (chargementFichier) return;
            fichierModifié = true;
            étatFichier('Modifié…', '');
            clearTimeout(minuterieFichier);
            minuterieFichier = setTimeout(sauveFichier, 600);
        });
    }

    function étatFichier(texte, genre) {
        const e = $('étatFichier');
        e.textContent = texte;
        e.className = 'état-sauvegarde ' + (genre || '');
    }

    // Enregistre le fichier ouvert s'il a changé (le texte est en mémoire dès l'appel)
    async function sauveFichier() {
        clearTimeout(minuterieFichier);
        if (!fichierOuvert || !fichierModifié) return;
        const chemin = fichierOuvert;
        fichierModifié = false;
        try {
            await FichiersProjet.écritTexte(chemin, nfc(éditeurFichier.getValue()));
            if (chemin === fichierOuvert && !fichierModifié) étatFichier('Enregistré', 'ok');
        } catch (e) {
            if (chemin === fichierOuvert) étatFichier('Non enregistré', 'erreur');
            écritConsole('Erreur d\'enregistrement : ' + e.message, 'erreur');
        }
    }

    async function ouvreFichierDonnées(chemin) {
        // le fichier devient la ligne choisie (et ＋ crée un fichier de données)
        const surRépertoire = surRépertoireDonnées;
        dansDonnées = true;
        surRépertoireDonnées = false;
        if (chemin === fichierOuvert) { if (surRépertoire) afficheArbre(); éditeurFichier.focus(); return; }
        await sauvegarde();             // le programme ouvert, et le fichier ouvert avant celui-ci
        const texte = FichiersProjet.texte(chemin);
        if (texte === null || texte === undefined) return;
        installeÉditeurFichier();
        fichierOuvert = chemin;
        chargementFichier = true;
        éditeurFichier.setValue(texte);
        éditeurFichier.clearHistory();
        chargementFichier = false;
        fichierModifié = false;
        décritFichierOuvert();
        étatFichier('Enregistré', 'ok');
        $('panneauFichier').hidden = false;
        $('conteneurÉditeur').hidden = true;
        $('panneauDonnées').hidden = true;
        actualiseExécuter();
        éditeurFichier.refresh();
        afficheArbre();
        éditeurFichier.focus();
    }

    function décritFichierOuvert() {
        const nom = fichierOuvert.slice(fichierOuvert.indexOf('/') + 1);
        $('nomFichierOuvert').textContent = '📄 ' + fichierOuvert;
        $('nomFichierOuvert').title = fichierOuvert;
        const note = $('noteFichier');
        note.textContent = 'Dans un programme : ';
        const code = document.createElement('code');
        code.textContent = 'charge_données("' + nom + '")';
        note.appendChild(code);
    }

    // Retour au code (ou aux onglets de données, s'ils étaient affichés) ; enregistre d'abord
    function fermeFichier() {
        if (!fichierOuvert) return;
        sauveFichier();
        oublieFichierOuvert();
        if (!modeDonnées) { éditeur.refresh(); éditeur.focus(); }
    }

    // Le fichier n'est plus montré (fermé, supprimé, autre projet), sans rien enregistrer
    function oublieFichierOuvert() {
        if (!fichierOuvert) return;
        dansDonnées = surRépertoireDonnées = false;
        clearTimeout(minuterieFichier);
        fichierOuvert = null;
        fichierModifié = false;
        $('panneauFichier').hidden = true;
        $('conteneurÉditeur').hidden = modeDonnées;
        $('panneauDonnées').hidden = !modeDonnées;
        actualiseExécuter();
        afficheArbre();
    }

    // Le fichier ouvert a peut-être changé ailleurs (le programme, avec sauve_données) : on reprend
    // son texte, à moins qu'on soit en train de le taper
    function rechargeFichierOuvert(chemin) {
        if (!fichierOuvert || (chemin && chemin !== fichierOuvert)) return;
        if (!FichiersProjet.existe(fichierOuvert)) { oublieFichierOuvert(); return; }
        if (fichierModifié) return;
        const texte = FichiersProjet.texte(fichierOuvert);
        if (texte === éditeurFichier.getValue()) return;
        const curseur = éditeurFichier.getCursor(), haut = éditeurFichier.getScrollInfo().top;
        chargementFichier = true;
        éditeurFichier.setValue(texte);
        chargementFichier = false;
        éditeurFichier.setCursor(curseur);
        éditeurFichier.scrollTo(null, haut);
        étatFichier('Enregistré', 'ok');
    }

    function basculeDonnées() {
        // depuis un fichier de données : ▦ Données montre les onglets (ou y revient)
        if (fichierOuvert) {
            fermeFichier();
            if (modeDonnées) { $('texteDonnées').focus(); return; }
        }
        modeDonnées = !modeDonnées;
        $('panneauDonnées').hidden = !modeDonnées;
        $('conteneurÉditeur').hidden = modeDonnées;
        $('btnDonnées').title = modeDonnées ? 'Revenir au code du programme' : 'Les données du projet : don0, don1...';
        libelléBoutonDonnées();
        if (modeDonnées) $('texteDonnées').focus();
        else { éditeur.refresh(); éditeur.focus(); }
    }

    function ajouteOnglet() {
        if (onglets.length >= ONGLETS_MAX) return;
        onglets.push('');
        ongletActif = onglets.length - 1;
        enregistreOnglets();
        afficheOnglets();
        $('texteDonnées').focus();
    }

    // Annuler : avant chaque retrait, vidage ou remplacement par un fichier, on garde les
    // onglets tels qu'ils étaient ; ↶ les fait revenir (plusieurs fois de suite si besoin).
    // La pile est oubliée quand le projet change.
    let annulationsOnglets = [];

    function retientOnglets() {
        annulationsOnglets.push({ onglets: [...onglets], actif: ongletActif });
        if (annulationsOnglets.length > 30) annulationsOnglets.shift();
    }

    // range_données("don3", valeur) : le programme écrit dans un onglet de la section Données.
    // L'onglet doit exister, ou venir juste après le dernier (on le crée). Renvoie "" ou un
    // message d'erreur. La première écriture d'une exécution est mémorisée pour ↶.
    let donnéesRetenues = false;
    function rangeDonnées(nom, texte) {
        const m = /^don(\d+)$/i.exec(nfc(String(nom)).trim());
        if (!m) return 'range_données : « ' + nom + ' » n\'est pas un nom d\'onglet (don0, don1…)';
        const n = Number(m[1]);
        if (n > onglets.length || n >= ONGLETS_MAX) {
            return 'range_données : l\'onglet « ' + nom + ' » n\'existe pas ; le dernier est don'
                + (onglets.length - 1) + ', on peut seulement créer don' + onglets.length;
        }
        if (!donnéesRetenues) { retientOnglets(); donnéesRetenues = true; }
        if (n === onglets.length) onglets.push('');                         // don3 après don0..don2
        onglets[n] = nfc(String(texte)).replace(/\r\n?/g, '\n');
        afficheOnglets();          // l'onglet est mis à jour à l'écran
        enregistreOnglets();       // et enregistré dans le projet
        return '';
    }

    // prend_données("don0") : le contenu actuel d'un onglet (y compris ce que range_données
    // vient d'y ranger) ; "" pour un onglet vide. L'erreur éventuelle est lue ensuite par
    // erreurDonnées() (evaljs ne renvoie qu'une valeur).
    let erreurDonnées = '';
    function prendDonnées(nom) {
        erreurDonnées = '';
        const m = /^don(\d+)$/i.exec(nfc(String(nom)).trim());
        if (!m) { erreurDonnées = 'prend_données : « ' + nom + ' » n\'est pas un nom d\'onglet (don0, don1…)'; return ''; }
        const n = Number(m[1]);
        if (n >= onglets.length) {
            erreurDonnées = 'prend_données : l\'onglet « ' + nom + ' » n\'existe pas ; le dernier est don' + (onglets.length - 1);
            return '';
        }
        return onglets[n];
    }

    function annuleOnglet() {
        const avant = annulationsOnglets.pop();
        if (!avant) return;
        onglets = avant.onglets;
        ongletActif = avant.actif;
        afficheOnglets();
        enregistreOnglets();
    }

    // − retire l'onglet ouvert ; Don0 reste toujours là : il est seulement vidé
    function retireOnglet() {
        if (ongletActif === 0) {
            if (onglets[0] === '') return;
            retientOnglets();
            onglets[0] = '';
        } else {
            retientOnglets();
            const suivants = ongletActif < onglets.length - 1;
            onglets.splice(ongletActif, 1);
            if (suivants) {
                écritConsole('— Les onglets suivants ont changé de numéro : Don' + (ongletActif + 1) + ' est devenu Don' + ongletActif
                    + '… Pense à changer leurs noms dans ton programme (ou clique sur ↶ pour annuler).', 'info');
            }
            ongletActif = Math.min(ongletActif, onglets.length - 1);
        }
        afficheOnglets();
        enregistreOnglets();
    }

    // Comme dans TamedAgents : le fichier choisi remplit l'onglet affiché
    async function chargeOnglet(fichier) {
        let texte;
        try {
            texte = nfc(await fichier.text()).replace(/\r\n?/g, '\n');
        } catch (e) {
            écritConsole('Impossible de lire « ' + fichier.name + ' » : ' + e.message, 'erreur');
            return;
        }
        const nom = 'Don' + ongletActif;
        if (onglets[ongletActif] !== '') retientOnglets();
        onglets[ongletActif] = texte;
        afficheOnglets();
        enregistreOnglets();
        écritConsole('— « ' + fichier.name + ' » est dans l\'onglet ' + nom + ' : dans ton programme, c\'est la variable don' + ongletActif + '.', 'info');
    }

    function installeDonnées() {
        onglets = litOnglets();
        $('btnDonnées').addEventListener('click', basculeDonnées);
        $('btnFermeFichier').addEventListener('click', fermeFichier);
        $('btnAjouteOnglet').addEventListener('click', ajouteOnglet);
        $('btnRetireOnglet').addEventListener('click', retireOnglet);
        $('btnAnnuleOnglet').addEventListener('click', annuleOnglet);
        $('btnChargeOnglet').addEventListener('click', () => $('fichierOnglet').click());
        $('fichierOnglet').addEventListener('change', (ev) => {
            const f = ev.target.files[0];
            ev.target.value = '';
            if (f) chargeOnglet(f);
        });
        const texte = $('texteDonnées');
        texte.addEventListener('input', () => {
            const était = onglets[ongletActif];
            onglets[ongletActif] = nfc(texte.value);
            // vide <-> rempli : l'onglet change d'aspect
            if ((était === '') !== (onglets[ongletActif] === '')) afficheOnglets();
            else afficheNoteDonnées();
            enregistreOnglets();
        });
        texte.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); exécute(); }
            else if (ev.key === 's' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); modifie = true; sauvegarde(); }
            else if (ev.key === 'Tab' && !ev.shiftKey) {
                // une tabulation dans les données (fichiers séparés par des tabulations)
                ev.preventDefault();
                texte.setRangeText('\t', texte.selectionStart, texte.selectionEnd, 'end');
                texte.dispatchEvent(new Event('input'));
            }
        });
        afficheOnglets();
    }

    async function sauvegarde() {
        clearTimeout(minuterieSauvegarde);
        await sauveFichier();           // le fichier de données ouvert, s'il y en a un
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

    // Le projet n'a aucun programme : l'éditeur est vide et verrouillé, et un message
    // propose d'en créer un
    function aucunProgramme() {
        clearTimeout(minuterieSauvegarde);
        courant = null;
        modifie = false;
        chargementEnCours = true;
        éditeur.setValue('');
        éditeur.clearHistory();
        chargementEnCours = false;
        éditeur.setOption('readOnly', 'nocursor');
        $('éditeurVide').hidden = false;
        afficheTitre();
        étatSauvegarde('', '');
        retientCourant();
    }

    let chargementEnCours = false;
    async function ouvre(chemin) {
        fermeFichier();                 // un fichier de données ouvert laisse la place au code
        if (chemin === courant) return;
        await sauvegarde();
        try {
            const code = await stockage.lit(chemin);
            chargementEnCours = true;
            éditeur.setValue(code);
            éditeur.setOption('readOnly', false);
            $('éditeurVide').hidden = true;
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
        if (dansDonnées) { await nouveauFichierDonnées(); return; }
        const ici = dossierCourant ? ' (dans « ' + dossierCourant + ' »)' : '';
        const nom = nomValide(prompt('Nom du nouveau programme' + ici + ' :', nomDe(cheminLibre(dossierCourant, 'Programme'))));
        if (!nom) return;
        await crée(dossierCourant, nom, '# ' + nom + '\n\n');
    }

    // ＋ quand le répertoire données est choisi : un fichier de données vide (Données.txt,
    // Données 2.txt…), ouvert aussitôt dans l'éditeur ; son extension est celle d'un fichier de
    // données (.txt si on n'en donne pas), jamais celle d'un programme
    async function nouveauFichierDonnées() {
        const extensions = FichiersProjet.RÉPERTOIRES.données.extensions;
        let défaut = 'Données.txt';
        for (let i = 2; FichiersProjet.existe('données/' + défaut); i++) défaut = 'Données ' + i + '.txt';
        const réponse = prompt('Nom du nouveau fichier de données :', défaut);
        if (réponse === null) return;
        let nom = nfc(réponse).trim();
        if (!nom) return;
        if (!/\.[^.\s]+$/.test(nom)) nom += '.txt';
        const ext = nom.slice(nom.lastIndexOf('.') + 1).toLowerCase();
        if (nom.includes('/') || !extensions.includes(ext)) {
            alert('Un fichier de données a un simple nom qui finit par ' + extensions.map(e => '.' + e).join(', '));
            return;
        }
        const chemin = 'données/' + nom;
        if (FichiersProjet.existe(chemin)) { alert('Ce nom existe déjà ici.'); return; }
        try {
            await FichiersProjet.écritTexte(chemin, '');
        } catch (e) {
            écritConsole('Impossible de créer « ' + chemin + ' » : ' + ((e && e.message) || e), 'erreur');
            return;
        }
        ouvertsProjet.add('données');
        enregistreOuvertsProjet();
        await ouvreFichierDonnées(chemin);
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
        else aucunProgramme();
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
        if (!chemin) return;
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
        a.download = (chemin ? nomDe(chemin) : 'programme') + '.pyf';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    // Des fichiers venus de l'ordinateur (menu ☰ ou glisser-déposer) : un .pyf (ou .py) devient un
    // programme (dans le répertoire dossier), une image, un son ou des données vont dans
    // le répertoire du projet qui leur correspond (répertoire : imposé si l'on a déposé
    // les fichiers sur images, sons ou données)
    async function importe(fichiers, dossier = dossierCourant, répertoire = null) {
        let ajoutés = 0;
        for (const f of Array.from(fichiers)) {
            // un projet exporté : il remplace le projet en cours (après confirmation)
            if (/\.zip$/i.test(f.name)) { await chargeProjetFichier(f); continue; }
            // un projet en texte (.json, ou .txt quand il vient du partage) ; sinon, des données
            if (/\.(json|txt)$/i.test(f.name)) {
                let p = null;
                try { p = JSON.parse(await f.text()); } catch (e) { /* des données ordinaires */ }
                if (p && p.format === FORMAT_PROJET) { await chargeProjetFichier(f); continue; }
            }
            if (/\.pyf?$/i.test(f.name) && !répertoire) {
                const nom = nomValide(f.name.replace(/\.[^.]+$/, '')) || 'Programme importé';
                await crée(dossier, nom, nfc(await f.text()));
                continue;
            }
            try {
                const chemin = await FichiersProjet.ajoute(f, répertoire);
                ouvertsProjet.add(chemin.slice(0, chemin.indexOf('/')));
                ajoutés++;
            } catch (e) {
                écritConsole(e.message + '.', 'erreur');
            }
        }
        if (ajoutés) {
            enregistreOuvertsProjet();
            afficheArbre();
            écritConsole('— ' + pluriel(ajoutés, 'fichier') + ' ajouté' + (ajoutés > 1 ? 's' : '') + ' au projet.', 'info');
        }
    }

    // ------------------------------------------------------------------
    // Répertoires du site : « Matériels » (matériels/, préparé par l'enseignant) et
    // « Exemples » (exemples/). Chacun a son index.json : [{ "fichier", "titre", "description" }],
    // et s'ouvre en liste déroulante sous son bouton, au bas de la colonne des programmes.
    // Un clic sur un projet (.zip ou .json) l'ouvre à la place du projet en cours (qui rejoint
    // la liste). Dans Matériels, un clic sur un programme (.pyf) en crée une copie ; dans
    // Exemples (enProjet), chaque programme est un projet à lui seul, qui porte son nom
    // (« 15. Casse-briques » : le projet et le programme « Casse-briques » ; le champ "programme"
    // de index.json nomme le programme quand le titre ne convient pas) ; ses images et
    // ses sons restent dans médias, où il les désigne par leur chemin.
    // ------------------------------------------------------------------
    const SVG_PROJET = '<svg viewBox="0 0 16 16" fill="none"><path d="M2 4.5L8 1.5l6 3v7L8 14.5l-6-3z" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/><path d="M2 4.5l6 3 6-3M8 7.5v7" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/></svg>';

    async function chargeRépertoireSite({ idBouton, répertoire, nom, masquéSiVide, enProjet = false }) {
        const bouton = $(idBouton);
        let liste;
        try {
            const r = await fetch(répertoire + '/index.json', { cache: 'no-cache' });
            if (!r.ok) throw new Error();
            liste = await r.json();
            if (!Array.isArray(liste)) throw new Error();
        } catch (e) {
            liste = [];
        }
        liste = liste.filter(x => x && typeof x.fichier === 'string' && /\.(pyf|zip|json)$/i.test(x.fichier))
            .map(x => ({ ...x, fichier: nfc(x.fichier) }));
        bouton.hidden = !liste.length && masquéSiVide;
        bouton.disabled = !liste.length;
        bouton.querySelector('.nombre-exemples').textContent = liste.length || '';
        const adresse = (fichier) => répertoire + '/' + fichier.split('/').map(encodeURIComponent).join('/');
        const prend = async (élément) => {
            const projet = /\.(zip|json)$/i.test(élément.fichier);
            const titre = élément.titre || élément.fichier;
            if (projet) {
                try {
                    const r = await fetch(adresse(élément.fichier), { cache: 'no-cache' });
                    if (!r.ok) throw new Error('« ' + élément.fichier + ' » est introuvable');
                    const fichier = new File([await r.blob()], élément.fichier.split('/').pop());
                    if (await chargeProjetFichier(fichier)) {
                        écritConsole('— Le projet « ' + titre + ' » est chargé.' + (élément.description ? ' ' + élément.description : ''), 'info');
                    }
                } catch (e) {
                    écritConsole(e.message, 'erreur');
                }
                return;
            }
            if (enProjet) {
                try {
                    const rc = await fetch(adresse(élément.fichier), { cache: 'no-cache' });
                    if (!rc.ok) throw new Error('« ' + élément.fichier + ' » est introuvable');
                    const nomProjet = titre.replace(/\.pyf?$/i, '').replace(/^\d+\.\s*/, '');
                    // le nom du programme : "programme" dans index.json, sinon le titre sans les
                    // signes refusés dans un nom de programme (l'apostrophe de « L'atelier »...)
                    const nomProg = nomValide(élément.programme || '')
                        || nomValide(nomProjet.replace(/[^\p{L}\p{N} _\-.()]+/gu, ' ').replace(/\s+/g, ' '));
                    if (!nomProg) throw new Error('L\'exemple « ' + titre + ' » n\'a pas de nom de programme valide (champ "programme" de exemples/index.json)');
                    const lu = await lisProjetJSON(JSON.stringify({ format: FORMAT_PROJET, version: 3, nom: nomProjet,
                        programmes: { [nomProg]: await rc.text() } }));
                    const avant = nomDuProjet !== SANS_NOM && !exempleOuvert() ? nomDuProjet : null;
                    if (await chargeProjet(lu, { exemple: true })) {
                        écritConsole('— L\'exemple « ' + nomProjet + ' » est ouvert, dans un projet à son nom : change-le comme tu veux. '
                            + 'Il n\'entre pas dans « Mes projets » : pour garder tes changements, renomme le projet.'
                            + (avant ? ' Ton projet « ' + avant + ' » t\'attend dans « Mes projets ».' : ''), 'info');
                    }
                } catch (e) {
                    écritConsole(e.message, 'erreur');
                }
                return;
            }
            // Déjà copié (un programme du même nom, de préférence dans le répertoire
            // courant) : on l'ouvre, plutôt que d'en créer « 15. Casse-briques 2 »
            const nomProg = titre.replace(/\.pyf?$/i, '');
            const copies = programmes.filter(p => nomDe(p.chemin) === nomProg);
            if (copies.length) {
                const copie = copies.find(p => parentDe(p.chemin) === dossierCourant) || copies[0];
                await ouvre(copie.chemin);
                écritConsole('— « ' + nomProg + ' » est déjà dans tes programmes : le voici. '
                    + 'Pour repartir de l\'exemple d\'origine, renomme ou supprime ta copie.', 'info');
                return;
            }
            try {
                const rc = await fetch(adresse(élément.fichier), { cache: 'no-cache' });
                if (!rc.ok) throw new Error('« ' + élément.fichier + ' » est introuvable');
                await crée(dossierCourant, nomProg, nfc(await rc.text()));
            } catch (e) {
                écritConsole(e.message, 'erreur');
            }
        };
        bouton.onclick = (ev) => {
            ev.stopPropagation();
            basculeDéroulante(bouton, () => ouvreDéroulante(bouton, [{ section: nom }].concat(liste.map(élément => {
                const projet = enProjet || /\.(zip|json)$/i.test(élément.fichier);
                return {
                    texte: élément.titre || élément.fichier,
                    détail: élément.description || '',
                    icône: projet ? SVG_PROJET : SVG_PROGRAMME,
                    titre: (élément.description ? élément.description + ' — ' : '')
                        + (projet ? 'un projet : un clic l\'ouvre à la place de ton projet (qui reste dans « Mes projets »)'
                                  : 'un clic crée une copie que tu peux modifier (ou ouvre ta copie, si tu l\'as déjà)'),
                    action: () => prend(élément)
                };
            }))));
        };
    }

    function chargeRépertoiresSite() {
        chargeRépertoireSite({ idBouton: 'btnMatériels', répertoire: 'matériels', nom: 'Matériels de ton enseignant', masquéSiVide: true });
        chargeRépertoireSite({ idBouton: 'btnExemples', répertoire: 'exemples', nom: 'Exemples', masquéSiVide: false, enProjet: true });
        installeMédiasSite();
    }

    // « 🎨 Médias » : les sons et les images du site (docs/médias, liste dans médias/index.json),
    // que tous les programmes partagent : charge_son("médias/sounds/ding.wav"). La liste a deux
    // répertoires, sounds et images (le piano dans sounds), comme dans l'Atelier ; un clic ouvre
    // l'aperçu du son ou de l'image, avec la ligne qui le charge dans un programme (voir aperçuMédia).
    const SONS_SITE = /\.(wav|mp3|ogg)$/i;
    async function installeMédiasSite() {
        const bouton = $('btnMédias');
        // la liste est d'habitude déjà lue au démarrage (voir plus haut) ; sinon on la lit ici
        if (!médiasSite.length) {
            try {
                const r = await fetch('médias/index.json', { cache: 'no-cache' });
                if (r.ok) médiasSite = (await r.json()).map(nfc);
            } catch (e) { /* rien */ }
        }
        const sons = médiasSite.filter(m => SONS_SITE.test(m));
        const images = médiasSite.filter(m => !SONS_SITE.test(m));
        bouton.disabled = !médiasSite.length;
        bouton.querySelector('.nombre-exemples').textContent = médiasSite.length || '';
        const nom = (m) => m.slice(m.lastIndexOf('/') + 1);
        const élément = (m, son) => ({
            texte: nom(m),
            icône: son ? SVG_SON : SVG_IMAGE,
            titre: (son ? 'Écouter' : 'Voir') + ' — dans un programme : ' + (son ? 'charge_son' : 'charge_image') + '("' + m + '")',
            action: () => aperçuMédia(nom(m), m.split('/').map(encodeURIComponent).join('/'), m, son)
        });
        const piano = sons.filter(m => m.startsWith('médias/sounds/piano/'));
        const autres = sons.filter(m => !m.startsWith('médias/sounds/piano/'));
        bouton.onclick = (ev) => {
            ev.stopPropagation();
            basculeDéroulante(bouton, () => ouvreDéroulante(bouton, [
                { section: 'Médias du site (médias/…)' },
                { groupe: 'sounds (' + sons.length + ')', éléments: autres.map(m => élément(m, true))
                    .concat(piano.length ? [{ groupe: 'piano (' + piano.length + ')', éléments: piano.map(m => élément(m, true)) }] : []) },
                { groupe: 'images (' + images.length + ')', éléments: images.map(m => élément(m, false)) }
            ]));
        };
    }


    // charge_données(nom) : le texte d'un fichier du répertoire données du projet.
    // { contenu } ou { erreur }
    // charge_programme(nom) / sauve_programme(nom, code) : un programme du projet, lu ou écrit
    // par un programme (l'Éditeur des cartes écrit ainsi biblios.pyf, que le Lecteur importe).
    // sauve_programme n'ouvre pas le programme écrit ; s'il est ouvert, l'éditeur le montre.
    function chargeProgramme(nom) {
        const chemin = trouveProgramme(String(nom), courant);
        if (!chemin) return { erreur: 'charge_programme : il n\'y a pas de programme « ' + nom + ' » dans le projet' };
        return { contenu: nfc(codeDuProgramme(chemin)) };
    }

    function sauveProgramme(nom, code) {
        nom = nfc(String(nom)).trim().replace(/\.pyf?$/i, '');
        const chemin = trouveProgramme(nom, courant) || cheminValide(nom);
        if (!chemin) return 'sauve_programme : nom de programme invalide : « ' + nom + ' »';
        code = nfc(String(code));
        if (chemin === courant) { éditeur.setValue(code); return ''; }
        const nouveau = !programmes.some(p => p.chemin === chemin);
        stockage.écrit(chemin, code).catch(e => écritConsole('sauve_programme : « ' + chemin + ' » n\'a pas pu être enregistré : ' + e.message, 'erreur'));
        if (nouveau) rafraichitListe();
        return '';
    }

    // vérifie_code(code) : '' si le code se compile, sinon le message d'erreur (rien n'est exécuté)
    function vérifieCode(code) {
        const c = compile(String(code));
        return c.erreur || '';
    }

    // sauve_données(nom, valeur) : écrit (ou remplace) le fichier nom dans le répertoire données
    // du projet ; '' si tout va bien, sinon le message d'erreur
    function sauveDonnées(nom, texte) {
        nom = nfc(String(nom)).trim().replace(/^données\//, '');
        if (!nom || /[\\/:*?"<>|]/.test(nom) || nom.startsWith('.')) return 'sauve_données : nom de fichier invalide : « ' + nom + ' » (un simple nom, sans répertoire)';
        if (!nom.includes('.')) nom += '.txt';
        if (FichiersProjet.répertoireDe(nom) !== 'données') return 'sauve_données : « ' + nom + ' » doit finir par ' + FichiersProjet.RÉPERTOIRES.données.extensions.map(e => '.' + e).join(', ');
        texte = nfc(String(texte));
        if (new Blob([texte]).size > FichiersProjet.TAILLE_MAX) return 'sauve_données : « ' + nom + ' » est trop gros (5 Mo au plus)';
        const chemin = 'données/' + nom;
        const nouveau = !FichiersProjet.existe(chemin);
        FichiersProjet.écritTexte(chemin, texte).catch(e => écritConsole('sauve_données : « ' + nom + ' » n\'a pas pu être gardé : ' + e.message, 'erreur'));
        rechargeFichierOuvert(chemin);
        if (nouveau) { ouvertsProjet.add('données'); enregistreOuvertsProjet(); afficheArbre(); }
        return '';
    }

    function chargeDonnées(nom) {
        nom = nfc(String(nom)).trim().replace(/^données\//, '');
        const texte = FichiersProjet.texte('données/' + nom);
        if (texte === null) return { erreur: 'les données « ' + nom + ' » ne sont pas dans le répertoire données du projet' };
        return { contenu: texte };
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
        éditeur.on('cursorActivity', montreSignature);
        éditeur.getWrapperElement().addEventListener('contextmenu', allerÀLaDéfinition);
        $('btnRetourDéfinition').addEventListener('click', revientDuSaut);
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
    // La signature de la fonction sélectionnée : quand la sélection est un nom de fonction,
    // une ligne sous l'éditeur montre ses arguments. Fonctions de la Pythonerie et noms
    // français de LispE (PYTHONERIE_FONCTIONS), ou fonctions de l'élève : celles du programme
    // ouvert, puis celles des autres programmes du projet (ceux qu'il peut importer).
    // ------------------------------------------------------------------
    const DÉFINITION = /^([ \t]*)(?:fonction|def)[ \t]+([A-Za-zÀ-ÖØ-öø-ÿ_λ][\wÀ-ÖØ-öø-ÿ]*)[ \t]*\(([^)]*)\)/gm;

    function définitionDans(code, nom) {
        DÉFINITION.lastIndex = 0;
        let m;
        while ((m = DÉFINITION.exec(code))) {
            if (m[2] === nom) return { signature: nom + '(' + m[3].trim().replace(/\s*,\s*/g, ', ') + ')', méthode: m[1].length > 0 };
        }
        return null;
    }

    function montreSignature() {
        const zone = $('signature');
        const choisi = éditeur.getSelection();
        const nom = /^[A-Za-zÀ-ÖØ-öø-ÿ_λ][\wÀ-ÖØ-öø-ÿ]*$/.test(choisi) ? nfc(choisi) : '';
        let texte = '';
        if (nom) {
            const ici = définitionDans(éditeur.getValue(), nom);
            if (ici) texte = (ici.méthode ? 'méthode ' : 'fonction ') + ici.signature + ' — définie dans ce programme';
            else if (PYTHONERIE_FONCTIONS[nom]) texte = PYTHONERIE_FONCTIONS[nom].replace(/  \[LispE : ([^\]]+)\]$/, '   (LispE : $1)');
            else {
                const tout = StockageNavigateur._tout();
                for (const chemin of Object.keys(tout).sort()) {
                    if (chemin === courant) continue;
                    const ailleurs = définitionDans(tout[chemin].code || '', nom);
                    if (ailleurs) { texte = (ailleurs.méthode ? 'méthode ' : 'fonction ') + ailleurs.signature + ' — définie dans « ' + chemin + ' »'; break; }
                }
            }
        }
        zone.textContent = texte;
        zone.hidden = !texte;
    }

    // ------------------------------------------------------------------
    // Clic droit sur le nom d'une fonction (ou d'une classe) : on va à sa définition, dans le
    // programme ouvert, sinon dans un autre programme du projet, qui s'ouvre. Une fonction
    // prédéfinie (Pythonerie, noms français de LispE), ou un mot qui n'est pas défini : rien,
    // le menu habituel du clic droit apparaît.
    // ------------------------------------------------------------------
    // la position du nom défini : { début, fin } (indices dans le code), ou null
    function positionDéfinition(code, nom) {
        const échappé = nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const m = new RegExp('^[ \\t]*(?:fonction|def|classe)[ \\t]+(' + échappé + ')(?![\\wÀ-ÖØ-öø-ÿ])', 'm').exec(code);
        if (!m) return null;
        const début = m.index + m[0].length - nom.length;
        return { début, fin: début + nom.length };
    }

    function montreDéfinition(code, p) {
        const a = éditeur.posFromIndex(p.début), b = éditeur.posFromIndex(p.fin);
        éditeur.focus();
        éditeur.setSelection(a, b);
        éditeur.scrollIntoView({ from: a, to: b }, Math.round(éditeur.getScrollInfo().clientHeight / 2));
    }

    // Les sauts déjà faits, pour ↩ Retour : [{ chemin, curseur, haut }], le dernier à la fin
    let sauts = [];

    function retiensOùOnEst() {
        sauts.push({ chemin: courant, curseur: éditeur.getCursor(), haut: éditeur.getScrollInfo().top });
        if (sauts.length > 50) sauts.shift();
        afficheRetour();
    }

    function afficheRetour() {
        $('btnRetourDéfinition').hidden = sauts.length === 0;
    }

    // ↩ Retour : là où l'on était avant le dernier saut (un programme disparu entre-temps est sauté)
    async function revientDuSaut() {
        while (sauts.length) {
            const s = sauts.pop();
            if (s.chemin !== courant && !programmes.some(p => p.chemin === s.chemin)) continue;
            if (s.chemin !== courant) await ouvre(s.chemin);
            éditeur.focus();
            éditeur.setCursor(s.curseur);
            éditeur.scrollTo(null, s.haut);
            break;
        }
        afficheRetour();
    }

    async function allerÀLaDéfinition(ev) {
        const pos = éditeur.coordsChar({ left: ev.clientX, top: ev.clientY }, 'window');
        const mot = éditeur.findWordAt(pos);
        const nom = nfc(éditeur.getRange(mot.anchor, mot.head));
        if (!/^[A-Za-zÀ-ÖØ-öø-ÿ_λ][\wÀ-ÖØ-öø-ÿ]*$/.test(nom)) return;
        // dans le programme ouvert (une fonction de l'élève passe avant celle de la bibliothèque)
        const ici = positionDéfinition(éditeur.getValue(), nom);
        if (ici) { ev.preventDefault(); retiensOùOnEst(); montreDéfinition(éditeur.getValue(), ici); return; }
        if (PYTHONERIE_FONCTIONS[nom]) return;          // prédéfinie : le menu habituel
        const tout = StockageNavigateur._tout();
        for (const chemin of Object.keys(tout).sort(compareNoms)) {
            if (chemin === courant) continue;
            const ailleurs = positionDéfinition(tout[chemin].code || '', nom);
            if (!ailleurs) continue;
            ev.preventDefault();
            retiensOùOnEst();
            await ouvre(chemin);
            const p = positionDéfinition(éditeur.getValue(), nom);
            if (p) montreDéfinition(éditeur.getValue(), p);
            return;
        }
    }

    // ------------------------------------------------------------------
    // Interface
    // ------------------------------------------------------------------
    function basculeThème() {
        const sombre = document.body.classList.toggle('dark-mode');
        éditeur.setOption('theme', sombre ? 'dracula' : 'default');
        if (éditeurFichier) éditeurFichier.setOption('theme', sombre ? 'dracula' : 'default');
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

    // Glisser une séparation (souris, doigt ou stylet) : la largeur est gardée dans le navigateur
    function glisseSéparation(sep, { variable, clé, largeur, sens, mini, maxi }) {
        const grille = $('espace');
        let départ = null;
        sep.addEventListener('pointerdown', (ev) => {
            départ = { x: ev.clientX, largeur: largeur() };
            sep.setPointerCapture(ev.pointerId);
            document.body.classList.add('redimensionne');
            ev.preventDefault();
        });
        sep.addEventListener('pointermove', (ev) => {
            if (!départ) return;
            const l = Math.min(Math.max(départ.largeur + sens * (ev.clientX - départ.x), mini), maxi());
            grille.style.setProperty(variable, l + 'px');
            éditeur.refresh();
        });
        const fin = () => {
            if (!départ) return;
            départ = null;
            document.body.classList.remove('redimensionne');
            try { localStorage.setItem(clé, grille.style.getPropertyValue(variable)); } catch (e) { /* rien */ }
        };
        sep.addEventListener('pointerup', fin);
        sep.addEventListener('pointercancel', fin);
        try {
            const l = localStorage.getItem(clé);
            if (l) grille.style.setProperty(variable, l);
        } catch (e) { /* rien */ }
    }

    // Les deux séparations : programmes | éditeur, et éditeur | canevas
    function installeSéparateur() {
        glisseSéparation($('séparateurProgrammes'), {
            variable: '--largeur-programmes', clé: 'pythonerie.largeurProgrammes', sens: 1, mini: 170,
            largeur: () => document.querySelector('.programmes').getBoundingClientRect().width,
            maxi: () => Math.max(170, window.innerWidth * 0.45)
        });
        glisseSéparation($('séparateur'), {
            variable: '--largeur-canevas', clé: 'pythonerie.largeurCanevas', sens: -1, mini: 260,
            largeur: () => $('zoneCanevas').getBoundingClientRect().width,
            maxi: () => window.innerWidth * 0.7
        });
        // sur un écran étroit, la liste des programmes (au-dessus de l'éditeur) se replie
        const panneau = document.querySelector('.programmes'), bouton = $('btnReplieProgrammes');
        const replie = (oui) => {
            panneau.classList.toggle('replié', oui);
            bouton.textContent = oui ? '▾' : '▴';
            bouton.title = oui ? 'Déplier la liste' : 'Replier la liste';
            bouton.setAttribute('aria-label', bouton.title);
            bouton.setAttribute('aria-expanded', String(!oui));
        };
        try { replie(localStorage.getItem('pythonerie.programmesRepliés') === 'oui'); } catch (e) { /* rien */ }
        bouton.addEventListener('click', () => {
            const oui = !panneau.classList.contains('replié');
            replie(oui);
            try { localStorage.setItem('pythonerie.programmesRepliés', oui ? 'oui' : 'non'); } catch (e) { /* rien */ }
        });
    }

    // ------------------------------------------------------------------
    // Listes déroulantes (Mes projets, Matériels, Exemples) : sous le bouton, ou au-dessus
    // s'il n'y a pas la place ; elles se ferment sur un choix, un clic ailleurs ou Échap.
    // éléments : [{ section }, { séparateur }, { texte, détail, icône (svg), titre, classe,
    // désactivé, action, supprime }] ; supprime ajoute une petite corbeille à la ligne.
    // ------------------------------------------------------------------
    let déroulante = null;      // { menu, bouton }

    function fermeDéroulante() {
        if (!déroulante) return;
        déroulante.menu.remove();
        déroulante.bouton.setAttribute('aria-expanded', 'false');
        déroulante = null;
    }

    function basculeDéroulante(bouton, ouvre) {
        if (déroulante && déroulante.bouton === bouton) { fermeDéroulante(); return; }
        ouvre();
    }

    // Un élément { groupe: texte, éléments: [...] } est un groupe replié : sa ligne « ▸ texte »
    // le déroule, dans une zone de hauteur limitée qui défile (les projets au-delà des derniers ouverts)
    function ouvreDéroulante(bouton, éléments) {
        fermeDéroulante();
        const menu = document.createElement('div');
        menu.className = 'menu déroulante';
        menu.setAttribute('role', 'menu');
        let place = () => {};
        const ajoute = (parent, e) => {
            if (e.groupe) {
                const ligne = document.createElement('div');
                ligne.className = 'ligne-déroulante';
                const b = document.createElement('button');
                b.className = 'menu-item menu-groupe-titre';
                b.setAttribute('role', 'menuitem');
                b.setAttribute('aria-expanded', 'false');
                b.textContent = '▸ ' + e.groupe;
                ligne.appendChild(b);
                parent.appendChild(ligne);
                const zone = document.createElement('div');
                zone.className = 'menu-groupe';
                zone.hidden = true;
                e.éléments.forEach(x => ajoute(zone, x));
                parent.appendChild(zone);
                b.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    zone.hidden = !zone.hidden;
                    b.textContent = (zone.hidden ? '▸ ' : '▾ ') + e.groupe;
                    b.setAttribute('aria-expanded', String(!zone.hidden));
                    place();
                    // le groupe déroulé reste visible : la liste défile jusqu'à lui (pas la page)
                    if (!zone.hidden) {
                        const bas = zone.offsetTop + zone.offsetHeight - menu.clientHeight;
                        if (bas > menu.scrollTop) menu.scrollTop = Math.min(bas, zone.offsetTop - b.offsetHeight);
                    }
                });
                return;
            }
            if (e.section) {
                const s = document.createElement('div');
                s.className = 'menu-section';
                s.textContent = e.section;
                parent.appendChild(s);
                return;
            }
            if (e.séparateur) {
                const s = document.createElement('div');
                s.className = 'menu-séparateur';
                parent.appendChild(s);
                return;
            }
            const ligne = document.createElement('div');
            ligne.className = 'ligne-déroulante';
            const b = document.createElement('button');
            b.className = 'menu-item' + (e.classe ? ' ' + e.classe : '');
            b.setAttribute('role', 'menuitem');
            b.disabled = !!e.désactivé;
            if (e.titre) b.title = e.titre;
            if (e.icône) {
                const i = document.createElement('span');
                i.className = 'arbre-icône';
                i.innerHTML = e.icône;
                b.appendChild(i);
            }
            const texte = document.createElement('span');
            texte.className = 'menu-texte';
            texte.textContent = e.texte;
            if (e.détail) {
                const d = document.createElement('span');
                d.className = 'menu-détail';
                d.textContent = e.détail;
                texte.appendChild(d);
            }
            b.appendChild(texte);
            if (e.action) b.addEventListener('click', () => { fermeDéroulante(); e.action(); });
            ligne.appendChild(b);
            if (e.supprime) {
                const x = document.createElement('button');
                x.className = 'menu-supprime';
                x.title = 'Supprimer « ' + e.texte + ' »';
                x.setAttribute('aria-label', x.title);
                x.textContent = '🗑';
                x.addEventListener('click', (ev) => { ev.stopPropagation(); fermeDéroulante(); e.supprime(); });
                ligne.appendChild(x);
            }
            parent.appendChild(ligne);
        };
        éléments.forEach(e => ajoute(menu, e));
        document.body.appendChild(menu);
        // sous le bouton, ou au-dessus s'il y a plus de place ; jamais hors de la fenêtre
        const r = bouton.getBoundingClientRect();
        const dessous = window.innerHeight - r.bottom - 12, dessus = r.top - 12;
        const enHaut = dessous < 220 && dessus > dessous;
        menu.style.maxHeight = Math.max(120, enHaut ? dessus : dessous) + 'px';
        place = () => {
            menu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - menu.offsetWidth - 8)) + 'px';
            if (enHaut) menu.style.top = Math.max(8, r.top - 4 - menu.offsetHeight) + 'px';
            else menu.style.top = (r.bottom + 4) + 'px';
        };
        place();
        déroulante = { menu, bouton, ouverte: performance.now() };
        bouton.setAttribute('aria-expanded', 'true');
        const premier = menu.querySelector('.menu-item:not(:disabled)');
        if (premier) premier.focus({ preventScroll: true });
    }

    function installeDéroulantes() {
        document.addEventListener('click', (ev) => {
            if (déroulante && !déroulante.menu.contains(ev.target) && !déroulante.bouton.contains(ev.target)) fermeDéroulante();
        });
        document.addEventListener('keydown', (ev) => {
            if (ev.key === 'Escape' && déroulante) { const b = déroulante.bouton; fermeDéroulante(); b.focus(); }
        });
        window.addEventListener('resize', fermeDéroulante);
        // la page défile : la liste ne suivrait pas son bouton (sauf juste après l'ouverture,
        // quand un toucher fait parfois bouger la page de quelques pixels)
        document.addEventListener('scroll', (ev) => {
            if (déroulante && !déroulante.menu.contains(ev.target) && performance.now() - déroulante.ouverte > 400) fermeDéroulante();
        }, true);
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
        $('btnExécuter').addEventListener('click', basculeExécution);
        $('btnPremierProgramme').addEventListener('click', nouveau);
        $('btnLispE').addEventListener('click', basculeLispE);
        installeDonnées();
        $('btnNouveau').addEventListener('click', nouveauDepuisBouton);
        $('btnNouveauFichier').addEventListener('click', nouveau);
        installeMenu('btnMenuProgrammes', 'menuProgrammes');
        installeDéroulantes();
        $('btnNouveauDossier').addEventListener('click', nouveauDossier);
        // Déposer dans la zone vide de l'arbre, ou sur le titre : vers la racine
        rendCible($('listeProgrammes'), '');
        rendCible($('titreProgrammes'), '');
        // Un clic dans la zone vide de l'arbre : les nouveaux programmes iront à la racine
        $('listeProgrammes').addEventListener('click', (ev) => {
            if (ev.target === $('listeProgrammes')) { dossierCourant = ''; dansDonnées = surRépertoireDonnées = false; afficheArbre(); }
        });
        $('btnRenommer').addEventListener('click', () => renomme());
        $('btnDupliquer').addEventListener('click', duplique);
        $('btnSupprimer').addEventListener('click', () => supprime());
        $('btnExporter').addEventListener('click', () => exporte());
        $('btnImporter').addEventListener('click', () => $('fichierImport').click());
        // une première fois pour se connecter, une deuxième fois pour se déconnecter
        $('btnÉlève').addEventListener('click', () => { if (élève) déconnecte(); else demandeÉlève(); });
        $('btnExporteProjet').addEventListener('click', exporteProjet);
        $('btnExporteProjetTexte').addEventListener('click', exporteProjetTexte);
        $('btnPartageProjet').addEventListener('click', partageProjet);
        $('btnMenuPartage').addEventListener('click', partageProjet);
        $('btnApplicationWeb').addEventListener('click', créeApplicationWeb);
        $('btnNouveauProjet').addEventListener('click', nouveauProjet);
        $('btnRenommeProjet').addEventListener('click', renommeProjet);
        $('nomProjet').addEventListener('click', (ev) => { ev.stopPropagation(); basculeDéroulante($('nomProjet'), ouvreMesProjets); });
        $('btnFermeProjet').addEventListener('click', fermeProjet);
        $('btnSupprimeProjet').addEventListener('click', () => supprimeProjet(nomDuProjet));
        $('btnChargeProjet').addEventListener('click', () => $('fichierProjet').click());
        $('fichierProjet').addEventListener('change', (ev) => {
            const f = ev.target.files[0];
            ev.target.value = '';
            if (f) chargeProjetFichier(f);
        });
        $('btnColleProjet').addEventListener('click', colleProjet);
        $('btnExporteArchive').addEventListener('click', exporteArchive);
        $('btnChargeArchive').addEventListener('click', () => $('fichierArchive').click());
        $('fichierArchive').addEventListener('change', (ev) => {
            const f = ev.target.files[0];
            ev.target.value = '';
            if (f) chargeArchive(f);
        });
        $('btnAnnuleProjet').addEventListener('click', revientProjetPrécédent);
        $('btnUtilisateurUnique').addEventListener('click', basculeUtilisateurUnique);
        $('fichierImport').addEventListener('change', (ev) => { importe(ev.target.files); ev.target.value = ''; });
        $('fichierRépertoire').addEventListener('change', (ev) => {
            const fichiers = [...ev.target.files];
            ev.target.value = '';
            if (fichiers.length && répertoireÀRemplir) importe(fichiers, '', répertoireÀRemplir);
        });
        $('btnEffaceConsole').addEventListener('click', effaceConsole);
        $('btnCopieConsole').addEventListener('click', (ev) => copieTexte(texteDeLaConsole(), ev.currentTarget));
        $('btnCopieCode').addEventListener('click', (ev) => copieTexte(fichierOuvert ? éditeurFichier.getValue() : modeDonnées ? (onglets[ongletActif] || '') : éditeur.getValue(), ev.currentTarget));
        $('btnEffaceCanevas').addEventListener('click', () => { Pyt.stoppeTout(); Pyt.réinitialise(); metAJourBoutons(); });
        $('btnImage').addEventListener('click', téléchargeImage);
        installePleinÉcran();
        installeZonesPleines();
        $('btnThème').addEventListener('click', basculeThème);
        $('btnAdmin').addEventListener('click', () => ouvreAdmin());
        $('btnAide').addEventListener('click', () => $('aide').classList.add('visible'));
        $('fermeAide').addEventListener('click', () => $('aide').classList.remove('visible'));
        $('aide').addEventListener('click', (ev) => { if (ev.target.id === 'aide') $('aide').classList.remove('visible'); });
        window.addEventListener('keydown', (ev) => {
            if (ev.key === 'Escape') $('aide').classList.remove('visible');
            // Suppr / Échap sur une sélection de programmes, sauf pendant la frappe
            const cible = ev.target;
            if (cible && cible.closest && cible.closest('.CodeMirror, input, textarea, select')) return;
            if (sélection.size > 1 && (ev.key === 'Delete' || ev.key === 'Backspace')) { ev.preventDefault(); supprimeSélection(); }
            // Cmd/Ctrl+C sur des programmes choisis, Cmd/Ctrl+V : copier-coller entre projets
            // (pas quand du texte de la page est sélectionné : c'est lui qu'on copie)
            else if ((ev.metaKey || ev.ctrlKey) && !ev.altKey && !String(window.getSelection())) {
                const touche = ev.key.toLowerCase();
                if (touche === 'c' && sélection.size) { ev.preventDefault(); copieProgrammes([...sélection]); }
                else if (touche === 'v' && pressePapiers.length) { ev.preventDefault(); colle(); }
            }
            else if (sélection.size > 1 && ev.key === 'Escape') annuleSélection();
        });
        window.addEventListener('beforeunload', () => { if (modifie || fichierModifié) sauvegarde(); });
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
        // les fichiers du projet (images, sons, données), rangés dans IndexedDB
        try { await FichiersProjet.charge(); } catch (e) { écritConsole('Les fichiers du projet ne sont pas disponibles : ' + e.message, 'erreur'); }
        const serveur = await détecteServeur();
        serveurProjets = serveur.serveur;
        modeAdmin = serveur.admin;
        classe = !modeAdmin && serveur.classe ? serveur.classe : null;
        if (modeAdmin) await vérifieSessionAdmin();
        afficheAdmin();
        await chargeConfig();
        // en mode classe, chaque élève se connecte avec son identifiant, vérifié par le serveur
        if (classe) {
            multiImposé = true;
            utilisateurUnique = false;
            await vérifieÉlèveClasse();
        }
        // Mode plusieurs élèves imposé par config.json : chaque nouvelle session (nouvel
        // onglet, navigateur relancé) commence avec un espace vide, même si l'élève
        // précédent est parti sans se déconnecter. Un simple rechargement de la page
        // (même onglet) garde le travail en cours.
        let nouvelleSession = true;
        try {
            nouvelleSession = !sessionStorage.getItem('pythonerie.session');
            sessionStorage.setItem('pythonerie.session', 'oui');
        } catch (e) { /* rien */ }
        if (multiImposé && nouvelleSession) {
            // le projet laissé par l'élève précédent (parti sans se déconnecter) est rangé chez lui
            try {
                const propriétaire = localStorage.getItem(CLÉ_PROPRIÉTAIRE);
                if (propriétaire && nomDuProjet !== SANS_NOM && !exempleOuvert()) await FichiersProjet.gardeProjet(propriétaire, nomDuProjet, await instantané());
            } catch (e) { /* rien */ }
            await effaceDonnées();
        }
        afficheÉlève();
        afficheNomProjet();
        if (nomCourant()) await prendPossession(nomCourant());
        else await rafraîchitListeProjets();
        await rafraichitListe();
        chargeRépertoiresSite();

        let dernier = null;
        try { dernier = localStorage.getItem('pythonerie.dernier'); } catch (e) { /* rien */ }
        if (dernier && programmes.some(p => p.chemin === dernier)) await ouvre(dernier);
        else if (programmes.length) await ouvre(programmes[0].chemin);
        else aucunProgramme();
    }

    // Appelé quand le WebAssembly de LispE est prêt
    async function lispePrêt() {
        try {
            await chargeSources();
            prépareCompilateur();
            wasmPrêt = true;
            actualiseExécuter();
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
    // Une entrée de la pile peut s'étendre sur plusieurs lignes (une chaîne de données) :
    // tout ce qui suit le début de la pile est avalé, jusqu'au message brut.
    const MESSAGE_BRUT = /line: \d+ in: /;
    let aprèsPile = false;
    let ligneVide = null;   // la dernière ligne écrite, si elle est vide
    function sortie(texte) {
        if (LIGNE_PILE.test(texte)) { aprèsPile = true; return; }
        if (aprèsPile) {
            if (MESSAGE_BRUT.test(texte)) aprèsPile = false;
            return;
        }
        if (/^Error: /.test(texte) && MESSAGE_BRUT.test(texte)) {
            // le WebAssembly écrit une ligne vide juste avant ce message : on la retire
            if (ligneVide && ligneVide.parentNode && ligneVide === $('console').lastElementChild) ligneVide.remove();
            ligneVide = null;
            return;
        }
        écritConsole(texte, 'sortie');
        ligneVide = texte === '' ? $('console').lastElementChild : null;
    }

    // Avant chaque exécution : une pile laissée incomplète n'avale pas la suite
    function oubliePile() { aprèsPile = false; }

    return {
        démarre, lispePrêt, exécute, effaceConsole, sortie, écrisPartiel, chargeDonnées, sauveDonnées, chargeProgramme, sauveProgramme, vérifieCode, rangeDonnées, prendDonnées,
        erreurDonnées: () => erreurDonnées,
        erreur: (texte) => écritConsole(texte, 'erreur'),
        info: (texte) => écritConsole(texte, 'info'),
        signaleAnimation: () => { if ($('btnExécuter')) metAJourBoutons(); },
        afficheConsole, cacheConsole, poseQuestionConsole, fermeQuestionConsole,
        // pour sauve_dans_serveur (le nom de l'élève) et les lectures du mode administrateur
        élève: () => nomCourant() || '',
        jetonAdmin: () => jetonAdmin,
        jetonÉlève: () => jetonÉlève,
        médias: () => médiasSite,
        compile // utile pour les tests depuis la console du navigateur
    };
})();

window.Pythonerie = Pythonerie;
