// =====================================================================
// Application Web créée par la Pythonerie (menu ☰ : « Créer une application Web »).
// Le programme a été traduit en LispE au moment de l'export (programme.js : APPLI.lispe,
// avec ses programmes importés et les onglets de données). Il s'exécute ici avec la
// bibliothèque de la Pythonerie (APPLI.bibliothèque) et le canevas (js/canevas.js, le même
// fichier que dans la Pythonerie), sans éditeur ni transpileur.
// Ce fichier tient, pour canevas.js et bibliothèque.lisp, le rôle de pythonerie.js : la
// console, demande(), lire(), lit_fichier(), les données du projet et les événements du canevas.
// =====================================================================

// Les images, les sons et les données du projet sont à côté de la page, dans images/,
// sons/ et données/ : canevas.js les trouve par FichiersProjet, comme dans la Pythonerie
const FichiersProjet = (function () {
    const présents = new Set(APPLI.fichiers);
    return {
        existe: (chemin) => présents.has(String(chemin).normalize('NFC')),
        url: (chemin) => encodeURI(String(chemin).normalize('NFC')),
        // pour liste_sons, liste_images et liste_données
        liste: () => APPLI.fichiers.map(chemin => ({ chemin }))
    };
})();

const Pythonerie = (function () {
    const $ = (id) => document.getElementById(id);
    const nfc = (texte) => String(texte).normalize('NFC');
    const { nettoieErreur, LIGNE_PILE } = ErreursLispE;

    // ------------------------------------------------------------------
    // Console : elle n'apparaît que si le programme y écrit
    // ------------------------------------------------------------------
    let ligneOuverte = null;      // ligne commencée par écris() et pas encore terminée

    function nouvelleLigne(genre) {
        $('zoneConsole').hidden = false;
        const div = document.createElement('div');
        div.className = 'console-ligne ' + genre;
        $('console').appendChild(div);
        return div;
    }

    function défile() { $('console').scrollTop = $('console').scrollHeight; }

    function écrisPartiel(texte) {
        const morceaux = texte.split('\n');
        morceaux.forEach((m, i) => {
            const dernière = i === morceaux.length - 1;
            if (dernière && m === '') return;
            if (!ligneOuverte) ligneOuverte = nouvelleLigne('sortie');
            ligneOuverte.textContent += m;
            if (!dernière) ligneOuverte = null;
        });
        défile();
    }

    function écritConsole(texte, genre) {
        if (ligneOuverte && (genre || 'sortie') === 'sortie') {
            ligneOuverte.textContent += texte;
            ligneOuverte = null;
            défile();
            return;
        }
        ligneOuverte = null;
        nouvelleLigne(genre || 'sortie').textContent = texte;
        défile();
    }

    function effaceConsole() {
        ligneOuverte = null;
        $('console').innerHTML = '';
        $('zoneConsole').hidden = true;
    }

    // Sortie de affiche() (Module.print). En cas d'erreur, le WebAssembly y écrit aussi la
    // pile d'appels, une ligne vide et le message brut : on les avale, l'erreur est affichée
    // proprement (comme dans pythonerie.js)
    const MESSAGE_BRUT = /line: \d+ in: /;
    let aprèsPile = false;
    let ligneVide = null;
    function sortie(texte) {
        if (LIGNE_PILE.test(texte)) { aprèsPile = true; return; }
        if (aprèsPile) {
            if (MESSAGE_BRUT.test(texte)) aprèsPile = false;
            return;
        }
        if (/^Error: /.test(texte) && MESSAGE_BRUT.test(texte)) {
            if (ligneVide && ligneVide.parentNode && ligneVide === $('console').lastElementChild) ligneVide.remove();
            ligneVide = null;
            return;
        }
        écritConsole(texte, 'sortie');
        ligneVide = texte === '' ? $('console').lastElementChild : null;
    }

    // ------------------------------------------------------------------
    // Les attentes, comme dans la Pythonerie (voir Pyt.attends, dans canevas.js) : demande(),
    // lire() et lit_fichier() rendent la main tout de suite, puis la fonction de rappel reçoit
    // la réponse. Rien ne relance le programme. Ici, la question de lire(), dans la console.
    // ------------------------------------------------------------------

    function écritQuestion(question, réponse) {
        let ligne = ligneOuverte;
        ligneOuverte = null;
        if (!ligne) {
            ligne = nouvelleLigne('question');
            ligne.textContent = question;
        } else if (question) {
            ligne.appendChild(document.createTextNode(question));
        }
        if (réponse !== null) {
            const r = document.createElement('span');
            r.className = 'réponse-élève';
            r.textContent = (question && !/\s$/.test(question) ? ' ' : '') + réponse;
            ligne.appendChild(r);
        }
        défile();
        return ligne;
    }

    function poseQuestion() {
        $('saisieQuestion').hidden = false;
        $('réponse').value = '';
        $('réponse').focus();
    }

    function fermeQuestion() {
        $('saisieQuestion').hidden = true;
    }

    // La question de lire() attend sa réponse sous la console ; { ligne, répond, abandonne }, ou null
    let questionConsole = null;
    function poseQuestionConsole(question, répond, abandonne) {
        const ligne = écritQuestion(question, null);
        poseQuestion();
        questionConsole = { ligne, répond, abandonne };
    }
    function fermeQuestionConsole() {
        if (!questionConsole) return;
        questionConsole = null;
        fermeQuestion();
    }

    // ------------------------------------------------------------------
    // Les données du projet : les fichiers du répertoire données (charge_données), et les
    // onglets don0, don1… (prend_données, range_données), gardés le temps de la visite
    // ------------------------------------------------------------------
    const ONGLETS_MAX = 20;
    const onglets = APPLI.onglets.slice();
    let erreurDonnées = '';

    function chargeDonnées(nom) {
        nom = nfc(nom).trim().replace(/^données\//, '');
        const texte = APPLI.données['données/' + nom];
        if (texte === undefined) return { erreur: 'les données « ' + nom + ' » ne sont pas dans le répertoire données du projet' };
        return { contenu: texte };
    }

    // sauve_données : le fichier vit le temps de la visite (une page ne peut pas écrire sur le site)
    function sauveDonnées(nom, texte) {
        nom = nfc(nom).trim().replace(/^données\//, '');
        if (!nom || /[\\/:*?"<>|]/.test(nom) || nom.startsWith('.')) return 'sauve_données : nom de fichier invalide : « ' + nom + ' » (un simple nom, sans répertoire)';
        if (!nom.includes('.')) nom += '.txt';
        if (!/\.(txt|csv|tsv|json|md)$/i.test(nom)) return 'sauve_données : « ' + nom + ' » doit finir par .txt, .csv, .tsv, .json ou .md';
        const chemin = 'données/' + nom;
        APPLI.données[chemin] = nfc(texte).replace(/\r\n?/g, '\n');
        if (!APPLI.fichiers.includes(chemin)) APPLI.fichiers.push(chemin);
        return '';
    }

    function rangeDonnées(nom, texte) {
        const m = /^don(\d+)$/i.exec(nfc(nom).trim());
        if (!m) return 'range_données : « ' + nom + ' » n\'est pas un nom d\'onglet (don0, don1…)';
        const n = Number(m[1]);
        if (n > onglets.length || n >= ONGLETS_MAX) {
            return 'range_données : l\'onglet « ' + nom + ' » n\'existe pas ; le dernier est don'
                + (onglets.length - 1) + ', on peut seulement créer don' + onglets.length;
        }
        if (n === onglets.length) onglets.push('');
        onglets[n] = nfc(texte).replace(/\r\n?/g, '\n');
        return '';
    }

    function prendDonnées(nom) {
        erreurDonnées = '';
        const m = /^don(\d+)$/i.exec(nfc(nom).trim());
        if (!m) { erreurDonnées = 'prend_données : « ' + nom + ' » n\'est pas un nom d\'onglet (don0, don1…)'; return ''; }
        const n = Number(m[1]);
        if (n >= onglets.length) {
            erreurDonnées = 'prend_données : l\'onglet « ' + nom + ' » n\'existe pas ; le dernier est don' + (onglets.length - 1);
            return '';
        }
        return onglets[n];
    }

    // ------------------------------------------------------------------
    // Exécution
    // ------------------------------------------------------------------
    let idx = null;

    function évalue(i, code) {
        const r = callEvalLispE(i, nfc(code));
        if (typeof r === 'string' && /^Error:/.test(r)) throw new Error(r);
        return r;
    }

    function nouvelInterpréteur() {
        if (idx !== null) {
            try { callCleanLispE(idx); } catch (e) { /* rien */ }
        }
        idx = callCreateLispE();
        évalue(idx, APPLI.bibliothèque);
    }

    // Appelé par le canevas (animations, clics, touches)
    function rappel(code) {
        if (idx === null) return;
        try {
            évalue(idx, code);
        } catch (e) {
            Pyt.stoppeTout();
            écritConsole(nettoieErreur(e), 'erreur');
            metAJourBoutons();
        }
    }

    let numéroExécution = 0;
    async function lance() {
        Pyt.stoppeTout();
        Pyt.réinitialise();
        effaceConsole();
        aprèsPile = false;
        // les sons du programme sont décodés avant de commencer (voir pythonerie.js)
        const attente = APPLI.sons.length ? Pyt.préchargeSons(APPLI.sons) : null;
        if (attente) {
            const numéro = ++numéroExécution;
            await attente;
            if (numéro !== numéroExécution) return;
        }
        try {
            nouvelInterpréteur();
            évalue(idx, APPLI.lispe);
        } catch (e) {
            écritConsole(nettoieErreur(e), 'erreur');
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

    function metAJourBoutons() {
        $('btnArrêter').disabled = !Pyt.enCours();
    }

    // affiche_console() : la console devient visible ; en plein écran, elle est sous le canevas
    // (voir le changement de plein écran plus bas) ; cache_console() la cache
    function afficheConsole() {
        $('zoneConsole').hidden = false;
        if (!document.fullscreenElement) $('zoneConsole').scrollIntoView({ block: 'nearest' });
    }
    function cacheConsole() { $('zoneConsole').hidden = true; }

    function basculePleinÉcran() {
        if (document.fullscreenElement) document.exitFullscreen();
        else if ($('scène').requestFullscreen) $('scène').requestFullscreen().catch(() => { /* refusé */ });
    }

    // Appelé quand le WebAssembly de LispE est prêt
    function lispePrêt() {
        Pyt.installe($('canevas'), $('coucheTortue'), rappel);
        const lancer = $('btnLancer');
        lancer.textContent = '▶ Lancer';
        lancer.disabled = false;
        lancer.addEventListener('click', () => {
            lancer.hidden = true;
            $('btnRecommencer').disabled = false;
            lance();
        });
        $('btnRecommencer').addEventListener('click', () => lance());
        $('btnArrêter').addEventListener('click', arrête);
        $('btnPleinÉcran').addEventListener('click', basculePleinÉcran);
        // en plein écran, la console passe dans la scène, sous le canevas ; elle revient après
        document.addEventListener('fullscreenchange', () => {
            const plein = document.fullscreenElement === $('scène');
            if (plein) $('scène').appendChild($('zoneConsole'));
            else $('scène').after($('zoneConsole'));
        });
        $('réponse').addEventListener('keydown', (ev) => {
            if (questionConsole) {
                if (ev.key === 'Enter') {
                    ev.preventDefault();
                    const r = nfc($('réponse').value), q = questionConsole;
                    fermeQuestionConsole();
                    const span = document.createElement('span');
                    span.className = 'réponse-élève';
                    span.textContent = (/\s$/.test(q.ligne.textContent) ? '' : ' ') + r;
                    q.ligne.appendChild(span);
                    q.répond(r);
                } else if (ev.key === 'Escape') {
                    ev.preventDefault();
                    const q = questionConsole;
                    fermeQuestionConsole();
                    écritConsole('— Question abandonnée.', 'info');
                    q.abandonne();
                }
                return;
            }
        });
    }

    return {
        lispePrêt, sortie, effaceConsole, écrisPartiel,
        chargeDonnées, sauveDonnées, rangeDonnées, prendDonnées,
        erreurDonnées: () => erreurDonnées,
        erreur: (texte) => écritConsole(texte, 'erreur'),
        info: (texte) => écritConsole(texte, 'info'),
        signaleAnimation: () => metAJourBoutons(),
        afficheConsole, cacheConsole, poseQuestionConsole, fermeQuestionConsole,
        // les médias du site emportés avec l'application (exemples/médias/...)
        médias: () => APPLI.médias
    };
})();

window.Pythonerie = Pythonerie;
