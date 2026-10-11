// =====================================================================
// Application Web créée par la Pythonerie (menu ☰ : « Créer une application Web »).
// Le programme a été traduit en LispE au moment de l'export (programme.js : APPLI.lispe,
// avec ses programmes importés et les onglets de données). Il s'exécute ici avec la
// bibliothèque de la Pythonerie (APPLI.bibliothèque) et le canevas (js/canevas.js, le même
// fichier que dans la Pythonerie), sans éditeur ni transpileur.
// Ce fichier tient, pour canevas.js et bibliothèque.lisp, le rôle de pythonerie.js : la
// console, demande(), lit_fichier(), les données du projet et les événements du canevas.
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
    // demande(question) : comme dans la Pythonerie, la question est posée dans la console ;
    // le programme s'arrête à la première question sans réponse, puis repart du début avec
    // les réponses déjà données, la même graine pour le hasard et les sons de la partie
    // rejouée coupés. Échap abandonne.
    // ------------------------------------------------------------------
    let réponses = { liste: [], rang: 0 };
    let graine = 0;
    let dansProgramme = false;
    let questionPosée = null;

    function réponseÀ(question) {
        if (!dansProgramme) return null;     // pendant une animation : la fenêtre du navigateur
        const i = réponses.rang++;
        if (i < réponses.liste.length) {
            écritQuestion(question, réponses.liste[i]);
            if (i === réponses.liste.length - 1) Pyt.coupeSons(false);
            return { réponse: réponses.liste[i] };
        }
        questionPosée = question;
        return { manque: true };
    }

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
    }

    function poseQuestion(question) {
        écritQuestion(question, null);
        $('saisieQuestion').hidden = false;
        $('réponse').value = '';
        $('réponse').focus();
    }

    function fermeQuestion() {
        questionPosée = null;
        $('saisieQuestion').hidden = true;
    }

    // ------------------------------------------------------------------
    // lit_fichier() : le navigateur ne lit un fichier de l'ordinateur que si on le choisit
    // soi-même. Le programme s'arrête, on choisit le fichier, puis il repart du début ;
    // les fichiers choisis sont rendus dans l'ordre des appels.
    // ------------------------------------------------------------------
    let lecture = { fichiers: [], rang: 0 };
    let lectureÉvénements = { fichiers: [], rang: 0 };
    let fichierDemandé = false;
    let fichiersÉcrits = new Set();

    function litFichierLocal() {
        const i = lecture.rang++;
        if (i < lecture.fichiers.length) return { contenu: lecture.fichiers[i] };
        fichierDemandé = true;
        return { erreur: 'il faut choisir un fichier sur ton ordinateur' };
    }

    // écrit_fichier : un fichier déjà téléchargé pendant cette exécution ne repart pas
    function déjàÉcrit(nom, texte) {
        const clé = nom + '\u0000' + texte;
        if (fichiersÉcrits.has(clé)) return true;
        fichiersÉcrits.add(clé);
        return false;
    }

    // ouvre la fenêtre de sélection ; quand : ce qu'on fait du texte du fichier choisi
    function ouvreSélection(quand) {
        const entrée = $('fichierDonnées');
        entrée.onchange = async () => {
            const f = entrée.files[0];
            entrée.value = '';
            if (!f) return;
            try { quand(nfc(await f.text())); }
            catch (e) { écritConsole('Impossible de lire le fichier « ' + f.name + ' » : ' + e.message, 'erreur'); }
        };
        entrée.click();
    }

    // Le navigateur n'ouvre la fenêtre que juste après un clic : sinon, un bouton dans la console
    function demandeFichier() {
        fichierDemandé = false;
        Pyt.stoppeTout();
        const numéro = lecture.fichiers.length + 1;
        const quel = numéro === 1 ? 'un fichier' : 'un ' + numéro + 'e fichier';
        const relance = (texte) => { lecture.fichiers.push(texte); lance(true); };
        const ligne = nouvelleLigne('info');
        ligne.textContent = '— Le programme a besoin d\'' + quel + ' : choisis-le sur ton ordinateur.';
        if (navigator.userActivation && navigator.userActivation.isActive) { ouvreSélection(relance); return; }
        const bouton = document.createElement('button');
        bouton.className = 'btn';
        bouton.textContent = '📂 Choisir le fichier';
        bouton.addEventListener('click', () => ouvreSélection(relance));
        ligne.appendChild(bouton);
        défile();
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
        const lectureProgramme = lecture;
        lecture = lectureÉvénements;
        lecture.rang = 0;
        fichierDemandé = false;
        try {
            évalue(idx, code);
        } catch (e) {
            if (!fichierDemandé && !Pyt.questionEnAttente()) {
                Pyt.stoppeTout();
                écritConsole(nettoieErreur(e), 'erreur');
                metAJourBoutons();
            }
        }
        lecture = lectureProgramme;
        // lit_fichier dans une animation ou un clic : le fichier choisi servira la fois suivante
        if (fichierDemandé) {
            fichierDemandé = false;
            ouvreSélection((texte) => lectureÉvénements.fichiers.push(texte));
        }
    }

    // relancé : après une réponse ou le choix d'un fichier (on garde réponses et fichiers)
    let numéroExécution = 0;
    async function lance(relancé) {
        Pyt.stoppeTout();
        Pyt.réinitialise();
        effaceConsole();
        if (relancé !== true) {
            lecture = { fichiers: [], rang: 0 };
            lectureÉvénements = { fichiers: [], rang: 0 };
            fichiersÉcrits = new Set();
            réponses = { liste: [], rang: 0 };
            graine = (Math.random() * 4294967296) >>> 0;
        }
        lecture.rang = 0;
        fichierDemandé = false;
        réponses.rang = 0;
        if (questionPosée !== null) fermeQuestion();
        aprèsPile = false;
        // les sons du programme sont décodés avant de commencer (voir pythonerie.js)
        const attente = APPLI.sons.length ? Pyt.préchargeSons(APPLI.sons) : null;
        if (attente) {
            const numéro = ++numéroExécution;
            await attente;
            if (numéro !== numéroExécution) return;
        }
        Pyt.graine(graine);
        Pyt.coupeSons(réponses.liste.length > 0);
        try {
            nouvelInterpréteur();
            évalue(idx, '(random_seed ' + (graine % 2147483647) + ')');
            dansProgramme = true;
            try { évalue(idx, APPLI.lispe); } finally { dansProgramme = false; }
        } catch (e) {
            if (!fichierDemandé && questionPosée === null) écritConsole(nettoieErreur(e), 'erreur');
            Pyt.stoppeTout(questionPosée !== null);
        }
        Pyt.coupeSons(false);
        if (questionPosée !== null) { Pyt.stoppeTout(true); poseQuestion(questionPosée); }
        else if (fichierDemandé) demandeFichier();
        metAJourBoutons();
    }

    function arrête() {
        numéroExécution++;
        if (questionPosée !== null) fermeQuestion();
        Pyt.stoppeTout();
        écritConsole('— Programme arrêté', 'info');
        metAJourBoutons();
    }

    function metAJourBoutons() {
        $('btnArrêter').disabled = !Pyt.enCours();
    }

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
        $('réponse').addEventListener('keydown', (ev) => {
            if (questionPosée === null) return;
            if (ev.key === 'Enter') {
                ev.preventDefault();
                réponses.liste.push(nfc($('réponse').value));
                fermeQuestion();
                lance(true);
            } else if (ev.key === 'Escape') {
                ev.preventDefault();
                fermeQuestion();
                écritConsole('— Question abandonnée : le programme est arrêté.', 'info');
            }
        });
    }

    return {
        lispePrêt, sortie, effaceConsole, écrisPartiel, réponseÀ, litFichierLocal, déjàÉcrit,
        chargeDonnées, sauveDonnées, rangeDonnées, prendDonnées,
        erreurDonnées: () => erreurDonnées,
        erreur: (texte) => écritConsole(texte, 'erreur'),
        signaleAnimation: () => metAJourBoutons(),
        // les médias du site emportés avec l'application (exemples/médias/...)
        médias: () => APPLI.médias
    };
})();

window.Pythonerie = Pythonerie;
