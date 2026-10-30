// =====================================================================
// Pythonerie — API de dessin
// ---------------------------------------------------------------------
// L'objet Pyt (window.Pyt) est appelé depuis LispE via evaljsc
// (voir basic/bibliothèque.lisp) : (evaljsc (list "Pyt.cercle" x y r false))
// exécute en JavaScript : Pyt.cercle(x, y, r, false);
//
// Le canevas a une taille logique (LARGEUR x HAUTEUR, 800 x 600 sauf appel à canevas) ; il est mis à
// l'échelle à l'écran. L'origine (0, 0) est en haut à gauche, y vers le bas.
// Une seconde couche transparente affiche la tortue sans laisser de trace.
// =====================================================================

const Pyt = (function () {
    // 800 x 600 par défaut ; canevas(largeur, hauteur) la change pour le programme en cours
    const LARGEUR_DÉFAUT = 800;
    const HAUTEUR_DÉFAUT = 600;
    const TAILLE_MAX = 4000;
    let LARGEUR = LARGEUR_DÉFAUT;
    let HAUTEUR = HAUTEUR_DÉFAUT;

    // Couleurs en français (toute couleur CSS reste utilisable : "#ff8800", "rgb(...)")
    const COULEURS = {
        rouge: '#e53935', vert: '#43a047', bleu: '#1e88e5', jaune: '#fdd835',
        orange: '#fb8c00', violet: '#8e24aa', rose: '#ec407a', marron: '#6d4c41',
        noir: '#000000', blanc: '#ffffff', gris: '#9e9e9e', cyan: '#00acc1',
        magenta: '#d81b60', turquoise: '#26a69a', beige: '#f5f0e1', or: '#ffb300',
        argent: '#bdbdbd', 'vert clair': '#9ccc65', 'bleu clair': '#64b5f6',
        'bleu marine': '#1a237e', 'gris clair': '#e0e0e0', 'gris foncé': '#424242',
        // les nuances : « clair » et « foncé » (invariables, comme dans « une robe vert foncé »)
        'rouge clair': '#ef9a9a', 'rouge foncé': '#b71c1c',
        'vert foncé': '#1b5e20', 'bleu foncé': '#0d47a1',
        'jaune clair': '#fff59d', 'jaune foncé': '#f9a825',
        'orange clair': '#ffcc80', 'orange foncé': '#e65100',
        'violet clair': '#ce93d8', 'violet foncé': '#4a148c',
        'rose clair': '#f8bbd0', 'rose foncé': '#ad1457',
        'marron clair': '#a1887f', 'marron foncé': '#3e2723',
        transparent: 'rgba(0,0,0,0)'
    };

    // Les noms des touches, en français : quand_touche(f) reçoit "gauche", "espace", "entrée"...
    // (une lettre, un chiffre ou un signe reste tel quel : "a", "7", "?")
    const NOMS_TOUCHES = {
        ArrowLeft: 'gauche', ArrowRight: 'droite', ArrowUp: 'haut', ArrowDown: 'bas',
        ' ': 'espace', Enter: 'entrée', Escape: 'échap', Backspace: 'retour arrière',
        Tab: 'tabulation', Delete: 'suppr', Insert: 'inser', Home: 'début', End: 'fin',
        PageUp: 'page haut', PageDown: 'page bas', Shift: 'maj', CapsLock: 'verr maj',
        Control: 'ctrl', Alt: 'alt', AltGraph: 'alt gr', Meta: 'cmd'
    };

    let canevas = null, ctx = null, couche = null, ctxTortue = null;
    let état = null, tortue = null;
    let minuteries = [];
    let gestionnaires = { clic: null, souris: null, glisse: null, touche: null, relâche: null, clicObjet: null };
    // Images et sons chargés par le programme : charge_image et charge_son renvoient leur numéro
    let images = [];
    let sons = [];
    // Dessins préparés par le programme (nouveau_dessin, montre_dessin) : leurs commandes, par numéro
    let dessins = new Map();
    let enLecture = [];        // lecteurs <audio> en cours (solution de repli)
    let sourcesActives = [];   // sons Web Audio en cours
    let audio = null;
    // Le contexte Web Audio est créé au premier son (pendant le clic sur « Exécuter »), et refait
    // si le navigateur l'a fermé (les sons déjà décodés servent dans le nouveau)
    function contexteAudio() {
        if (!audio || audio.state === 'closed') {
            const Contexte = window.AudioContext || window.webkitAudioContext;
            audio = Contexte ? new Contexte({ latencyHint: 'interactive' }) : null;
        }
        return audio;
    }
    // Réveille le son : le navigateur le garde « suspendu » tant que la page n'a pas reçu de geste,
    // et Safari le met en plus « interrompu » (interrupted, un état à lui) quand on change d'onglet,
    // quand l'ordinateur se met en veille, quand une autre application prend le son ou qu'un casque
    // se branche : sans resume(), il resterait muet jusqu'au rechargement de la page
    function réveilleAudio() {
        if (audio && audio.state !== 'running' && audio.state !== 'closed') audio.resume().catch(() => {});
    }
    // Augmente à chaque efface() ou fond() : une image qui finit de se charger après
    // un effacement n'est plus dessinée
    let génération = 0;
    // une scène 3D est montrée (montre_3d) : le canevas 2D devient une vitre transparente, posée
    // sur la couche 3D (voir scene3d.js) ; efface() et fond() en tiennent compte
    let mode3D = false;
    const scène3D = () => (typeof Scène3D !== 'undefined' ? Scène3D : null);
    // Fonction fournie par l'application pour exécuter du LispE : rappel(code)
    let rappel = null;
    let dessinTortuePrévu = false;

    function étatInitial() {
        return {
            trait: '#1a1a1a', remplissage: '#1a1a1a', épaisseur: 2,
            taille: 20, police: 'Inter, sans-serif'
        };
    }

    function tortueInitiale() {
        // La tortue n'apparaît qu'à la première commande de tortue (sauf si on l'a cachée)
        return { x: LARGEUR / 2, y: HAUTEUR / 2, cap: 0, crayon: true, visible: false, cachée: false };
    }

    function couleurCSS(c) {
        if (c === null || c === undefined) return '#000000';
        const nom = String(c).normalize('NFC').trim();
        return COULEURS[nom.toLowerCase()] || nom;
    }

    function nombre(v, défaut) {
        const n = Number(v);
        return Number.isFinite(n) ? n : (défaut === undefined ? 0 : défaut);
    }

    function appliqueStyle() {
        ctx.strokeStyle = état.trait;
        ctx.fillStyle = état.remplissage;
        ctx.lineWidth = état.épaisseur;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.font = état.taille + 'px ' + état.police;
        ctx.textBaseline = 'top';
    }

    function traceForme(plein) {
        if (plein) ctx.fill(); else ctx.stroke();
    }

    // ---------------- La tortue (couche séparée) ----------------
    function utiliseTortue() {
        if (!tortue.cachée) tortue.visible = true;
        prévoitTortue();
    }

    function prévoitTortue() {
        if (dessinTortuePrévu) return;
        dessinTortuePrévu = true;
        requestAnimationFrame(() => {
            dessinTortuePrévu = false;
            dessineTortue();
        });
    }

    function dessineTortue() {
        if (!ctxTortue) return;
        ctxTortue.clearRect(0, 0, LARGEUR, HAUTEUR);
        if (!tortue.visible) return;
        const a = tortue.cap * Math.PI / 180;
        const t = 14;
        ctxTortue.save();
        ctxTortue.translate(tortue.x, tortue.y);
        ctxTortue.rotate(a);
        ctxTortue.beginPath();
        ctxTortue.moveTo(t, 0);
        ctxTortue.lineTo(-t * 0.7, t * 0.6);
        ctxTortue.lineTo(-t * 0.35, 0);
        ctxTortue.lineTo(-t * 0.7, -t * 0.6);
        ctxTortue.closePath();
        ctxTortue.fillStyle = 'rgba(179, 92, 42, 0.85)';
        ctxTortue.strokeStyle = '#5a2a10';
        ctxTortue.lineWidth = 1.5;
        ctxTortue.fill();
        ctxTortue.stroke();
        ctxTortue.restore();
    }

    // ---------------- Événements ----------------
    function positionSouris(ev) {
        const r = canevas.getBoundingClientRect();
        return {
            x: Math.round((ev.clientX - r.left) * LARGEUR / r.width),
            y: Math.round((ev.clientY - r.top) * HAUTEUR / r.height)
        };
    }

    // Le nom d'une fonction de rappel arrive en texte (animer("image", 20) aussi bien
    // qu'animer(image, 20)) : le transpileur ne le voit pas. On n'appelle donc qu'un
    // identifiant, et jamais une instruction de instructions_interdites (basic/transpiler.lisp)
    const instructionsInterdites = new Set(['eval', 'atom', 'atoms', 'use', 'link',
        'evaljs', 'evaljs_i', 'evaljs_d', 'evaljs_b', 'evaljs_j', 'evaljs_li', 'evaljs_ld', 'evaljs_lf',
        'asyncjs', 'evaljsc', 'asyncjsc', 'loadcode', 'load']);

    function appelle(nom, args) {
        if (!nom || !rappel) return;
        if (!/^[\p{L}_][\p{L}\p{N}_]*$/u.test(nom) || instructionsInterdites.has(nom)) return;
        rappel('(' + nom + (args.length ? ' ' + args.join(' ') : '') + ')');
    }

    // ---------- Les attentes : demande, lire, lit_fichier ----------
    // Rien n'attend l'élève en bloquant la page : demande(question, f) pose la question dans
    // une petite fenêtre sur le canevas, lire(question, f) dans la console, lit_fichier(f)
    // ouvre la fenêtre de choix d'un fichier ; l'appel rend la main tout de suite, et le
    // programme continue. Quand l'élève a répondu, la valeur est gardée dans valeurReçue, puis
    // (_réponse_lue numéro) est évalué : bibliothèque.lisp y retrouve la fonction de rappel et
    // son argument, lit la valeur (Pyt.valeurReçue) et appelle f(valeur) ou f(valeur, a).
    // Les attentes sont servies l'une après l'autre, dans l'ordre. ■ Arrêter, ou une nouvelle
    // exécution, les oublie : la génération change, et une réponse tardive (un fichier choisi
    // après coup) ne va pas au programme suivant.
    let attentes = [];            // [{ genre, question, id }] : celles qui attendent leur tour
    let attenteEnCours = null;    // celle qui est posée, ou null
    let générationAttentes = 0;
    let valeurReçue = '';
    let cadreEnAttente = null;    // la fenêtre posée sur le canevas, ou null

    function prochaineAttente() {
        attenteEnCours = attentes.shift() || null;
        if (!attenteEnCours) return;
        const l = attenteEnCours, génération = générationAttentes;
        const répond = (valeur) => {
            if (génération !== générationAttentes) return;
            attenteEnCours = null;
            valeurReçue = String(valeur).normalize('NFC');
            if (rappel) rappel('(_réponse_lue ' + l.id + ')');
            valeurReçue = '';
            // la fonction de rappel a pu poser la question suivante
            if (!attenteEnCours) prochaineAttente();
        };
        const abandonne = (message) => {
            if (génération !== générationAttentes) return;
            attenteEnCours = null;
            if (message && window.Pythonerie && window.Pythonerie.info) window.Pythonerie.info(message);
            prochaineAttente();
        };
        if (l.genre === 'console') {
            if (window.Pythonerie && window.Pythonerie.afficheConsole) window.Pythonerie.afficheConsole();
            window.Pythonerie.poseQuestionConsole(l.question, répond, () => abandonne(''));
        } else if (l.genre === 'fichier') choisisFichier(répond, abandonne);
        else poseQuestionSurCanevas(l.question, répond, abandonne);
    }

    // ---------- Les échanges avec serveur.py (sauve_dans_serveur, liste_dans_serveur, lit_dans_serveur) ----------
    // fetch, sans bloquer la page ; le résultat revient comme une réponse (voir prochaineAttente),
    // mais sans attendre son tour : une sauvegarde ne doit pas attendre la fin d'une question.
    let échangesEnCours = 0;
    // les écritures partent l'une après l'autre, dans l'ordre du programme : sinon, deux
    // sauve_dans_serveur du même fichier pourraient arriver dans l'autre ordre
    let fileDesSauvegardes = Promise.resolve();
    const NOMS_ÉCHANGES = { sauve: 'sauve_dans_serveur', liste: 'liste_dans_serveur', lit: 'lit_dans_serveur', élèves: 'sauve_élèves' };

    // sauve_élèves : une liste de dictionnaires {"identifiant", "nom"}, ou de paires [identifiant, nom]
    function listeDesÉlèves(texteJSON) {
        let liste = [];
        try { liste = JSON.parse(texteJSON); } catch (e) { liste = null; }
        if (!Array.isArray(liste)) return null;
        return liste.map(e => Array.isArray(e) ? { identifiant: String(e[0] ?? ''), nom: String(e[1] ?? '') }
            : (e && typeof e === 'object') ? { identifiant: String(e.identifiant ?? ''), nom: String(e.nom ?? '') } : { identifiant: String(e), nom: '' });
    }

    async function échange(genre, p1, p2, p3, id) {
        const génération = générationAttentes;
        const nom = NOMS_ÉCHANGES[genre] || genre;
        const P = window.Pythonerie || {};
        const jeton = P.jetonAdmin ? P.jetonAdmin() : '';
        // en mode classe, l'élève vérifié (un nom d'en-tête n'accepte que l'ASCII : Eleve)
        const entêtes = { 'Content-Type': 'application/json', 'X-Pythonerie-Jeton': jeton || '',
            'X-Pythonerie-Eleve': (P.jetonÉlève ? P.jetonÉlève() : '') || '' };
        let requête;
        if (genre === 'sauve') {
            const corps = JSON.stringify({ professeur: p1, chemin: p2, élève: P.élève ? P.élève() : '', contenu: p3 });
            requête = fileDesSauvegardes.then(() => fetch('api/serveur/sauve', { method: 'POST', headers: entêtes, body: corps }));
            fileDesSauvegardes = requête.catch(() => null);
        } else if (genre === 'élèves') {
            const liste = listeDesÉlèves(p1);
            if (!liste) { if (P.erreur) P.erreur('sauve_élèves : il faut une liste d\'élèves'); return; }
            requête = fetch('api/admin/élèves', { method: 'POST', headers: entêtes, body: JSON.stringify({ élèves: liste }) });
        } else {
            requête = fetch('api/admin/' + genre + '?chemin=' + encodeURIComponent(p1), { headers: { 'X-Pythonerie-Jeton': jeton || '' } });
        }
        échangesEnCours++;
        let valeur = null, erreur = '';
        try {
            const r = await requête;
            let corps = null;
            try { corps = await r.json(); } catch (e) { corps = null; }
            if (!corps) erreur = 'pas de serveur de la Pythonerie ici (il faut la lancer avec python3 serveur.py)';
            else if (!r.ok || corps.erreur) erreur = corps.erreur || ('erreur ' + r.status);
            else valeur = genre === 'sauve' ? 'vrai' : genre === 'élèves' ? String(corps.nombre)
                : genre === 'liste' ? JSON.stringify(corps.entrées || []) : String(corps.contenu);
        } catch (e) {
            erreur = 'le serveur ne répond pas';
        }
        échangesEnCours--;
        if (P.signaleAnimation) P.signaleAnimation();
        if (génération !== générationAttentes) return;
        if (erreur) { if (P.erreur) P.erreur(nom + ' : ' + erreur); return; }
        if (!id) return;
        valeurReçue = valeur.normalize('NFC');
        if (rappel) rappel('(_réponse_lue ' + id + ')');
        valeurReçue = '';
    }

    function oublieAttentes() {
        générationAttentes++;
        attentes = [];
        if (attenteEnCours && attenteEnCours.genre === 'console' && window.Pythonerie && window.Pythonerie.fermeQuestionConsole)
            window.Pythonerie.fermeQuestionConsole();
        if (cadreEnAttente) { cadreEnAttente.remove(); cadreEnAttente = null; }
        attenteEnCours = null;
    }

    // Une petite fenêtre sur le canevas : un texte, puis un champ (demande) ou un bouton
    // (lit_fichier) ; Entrée ou le bouton valide, Échap abandonne
    function cadreSurCanevas(texte, avecChamp, libelléBouton, valide, abandonne) {
        const cadre = document.createElement('form');
        cadre.className = 'question-canevas';
        const t = document.createElement('div');
        t.textContent = texte;
        cadre.appendChild(t);
        let champ = null;
        if (avecChamp) {
            champ = document.createElement('input');
            champ.type = 'text';
            champ.spellcheck = false;
            cadre.appendChild(champ);
        } else {
            const b = document.createElement('button');
            b.type = 'submit';
            b.className = 'question-canevas-bouton';
            b.textContent = libelléBouton;
            cadre.appendChild(b);
        }
        const aide = document.createElement('div');
        aide.className = 'question-canevas-aide';
        aide.textContent = avecChamp ? 'Entrée : répondre — Échap : abandonner' : 'Échap : abandonner';
        cadre.appendChild(aide);
        const ferme = () => { cadre.remove(); if (cadreEnAttente === cadre) cadreEnAttente = null; };
        cadre.addEventListener('pointerdown', (ev) => ev.stopPropagation());
        const envoie = () => { const v = champ ? champ.value : ''; ferme(); valide(v); };
        cadre.addEventListener('submit', (ev) => { ev.preventDefault(); envoie(); });
        cadre.addEventListener('keydown', (ev) => {
            ev.stopPropagation();
            if (ev.key === 'Escape') { ev.preventDefault(); ferme(); abandonne('— Question abandonnée.'); }
            else if (ev.key === 'Enter' && champ) { ev.preventDefault(); envoie(); }
        });
        canevas.parentElement.appendChild(cadre);
        cadreEnAttente = cadre;
        (champ || cadre.querySelector('button')).focus();
    }

    function poseQuestionSurCanevas(question, répond, abandonne) {
        cadreSurCanevas(question || 'Ta réponse :', true, '', répond, abandonne);
    }

    // lit_fichier : la fenêtre de choix d'un fichier. Le navigateur ne l'ouvre que juste après
    // un geste de l'élève (▶ Exécuter, un clic, une touche) ; sinon, un bouton sur le canevas
    // demande ce geste.
    function choisisFichier(répond, abandonne) {
        const entrée = document.createElement('input');
        entrée.type = 'file';
        entrée.addEventListener('change', async () => {
            const f = entrée.files[0];
            if (!f) { abandonne('— Aucun fichier choisi.'); return; }
            try { répond(await f.text()); }
            catch (e) { abandonne('Impossible de lire le fichier « ' + f.name + ' » : ' + e.message); }
        });
        entrée.addEventListener('cancel', () => abandonne('— Aucun fichier choisi.'));
        if (!navigator.userActivation || navigator.userActivation.isActive) { entrée.click(); return; }
        cadreSurCanevas('Le programme a besoin d\'un fichier de ton ordinateur.', false, '📂 Choisir le fichier',
            () => entrée.click(), abandonne);
    }

    // une chaîne "..." de LispE : les sauts de ligne s'écrivent \n (un vrai saut de ligne
    // entre guillemets ne peut pas être relu par LispE)
    function chaîneLispE(s) {
        return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
            .replace(/\r\n?/g, '\n').replace(/\n/g, '\\n').replace(/\t/g, '\\t') + '"';
    }

    // GitHub Pages refuse parfois une requête (erreur 503) quand on en envoie beaucoup
    // à la fois (les 36 notes du piano) : on réessaie jusqu'à trois fois
    async function téléchargeAvecReprise(adresse, essais = 3) {
        for (let k = 1; ; k++) {
            const r = await fetch(adresse);
            if (r.ok) return r;
            if (k >= essais || r.status < 500) throw new Error(String(r.status));
            await new Promise(fin => setTimeout(fin, 300 * k));
        }
    }

    let dernièreErreur = '';

    // Le hasard de la Pythonerie (aléatoire, hasard, choisis) : un générateur à graine
    // (mulberry32). Quand le programme repart du début après une réponse à demande(), il
    // reprend la même graine : il refait les mêmes tirages, et pose les mêmes questions.
    let étatHasard = (Math.random() * 4294967296) >>> 0;
    function aléa() {
        étatHasard = (étatHasard + 0x6D2B79F5) >>> 0;
        let x = étatHasard;
        x = Math.imul(x ^ (x >>> 15), x | 1);
        x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    }
    // Les sons déjà décodés, par adresse (blob: d'un son du projet, fichier du site, https://).
    // Le programme s'exécute d'un seul trait, et demande() bloque la page : un son décodé
    // pendant que le programme tourne ne serait prêt qu'à la fin. Les sons nommés dans le
    // code sont donc décodés avant l'exécution (préchargeSons), et charge_son les trouve ici.
    const sonsDécodés = new Map();      // adresse -> AudioBuffer

    // Taille logique des deux calques ; le cadre suit les proportions (voir style.css)
    // ---------- Champs de saisie : saisie(clef, x, y, fonction) ----------
    // Un vrai champ <input>, posé sur le canevas en coordonnées du canevas (il suit
    // l'agrandissement et le plein écran). Entrée, ou un clic dans un autre champ,
    // appelle fonction(clef, valeur) ; la valeur est toujours un texte.
    const champs = new Map();     // clef -> { élément, fonction, x, y, l, envoyé }
    const LARGEUR_CHAMP = 200;    // en points du canevas ; largeur_saisie(l) la change
    let largeurChamp = LARGEUR_CHAMP;

    function placeChamp(champ) {
        const e = champ.élément;
        e.style.left = (champ.x * 100 / LARGEUR) + '%';
        e.style.top = (champ.y * 100 / HAUTEUR) + '%';
        // un bouton, une case ou un radio prend la largeur de son texte
        e.style.width = champ.l ? (champ.l * 100 / LARGEUR) + '%' : '';
        // les zones (zone_défilante, zone_texte) ont aussi une hauteur
        e.style.height = champ.h ? (champ.h * 100 / HAUTEUR) + '%' : '';
        // la police et la taille courantes (police, taille_texte) au moment de saisie() ;
        // la taille suit la largeur affichée du canevas (unités cqw)
        e.style.fontFamily = champ.police;
        e.style.fontSize = (champ.taille * 100 / LARGEUR) + 'cqw';
    }

    function envoieChamp(clef, toujours) {
        const champ = champs.get(clef);
        if (!champ) return;
        const valeur = champ.élément.value.normalize('NFC');
        // un clic dans un autre champ n'envoie la valeur que si elle a changé
        if (!toujours && valeur === champ.envoyé) return;
        champ.envoyé = valeur;
        // un instant plus tard : le champ peut être quitté pendant que le programme
        // s'exécute (active_saisie dans quand_touche), qu'on ne relance pas en plein milieu
        const fonction = champ.fonction;
        setTimeout(() => appelle(fonction, [chaîneLispE(clef), chaîneLispE(valeur)]), 0);
    }

    // Dans un champ, les flèches et Entrée vont aussi à quand_touche (pour passer d'un
    // champ à l'autre) ; gauche et droite seulement au bord du texte, pour pouvoir
    // encore déplacer le curseur pendant qu'on corrige
    function transmetTouche(ev) {
        if (!gestionnaires.touche) return;
        const e = ev.target, n = e.value.length, d = e.selectionStart, f = e.selectionEnd;
        const tout = d === 0 && f === n;
        let nom = null;
        if (ev.key === 'ArrowUp') nom = 'haut';
        else if (ev.key === 'ArrowDown') nom = 'bas';
        else if (ev.key === 'Enter') nom = 'entrée';
        else if (ev.key === 'ArrowLeft' && ((d === 0 && f === 0) || tout)) nom = 'gauche';
        else if (ev.key === 'ArrowRight' && ((d === n && f === n) || tout)) nom = 'droite';
        if (!nom) return;
        ev.preventDefault();
        appelle(gestionnaires.touche, [chaîneLispE(nom)]);
    }

    // ---------- Les objets du canevas : saisie, bouton, case à cocher, bouton radio,
    // glissière, zone d'édition. Ils partagent la table champs (une clef = un objet) ;
    // un nouvel appel avec la même clef déplace l'objet, ou le remplace s'il est d'un autre genre.
    function objetDe(clef, genre, fabrique) {
        let o = champs.get(clef);
        if (o && o.genre !== genre) { o.élément.remove(); champs.delete(clef); o = null; }
        if (!o) {
            o = { clef, genre, envoyé: null };
            o.élément = fabrique(o);
            // un clic sur l'objet ne doit pas être pris pour un clic dans le canevas
            o.élément.addEventListener('pointerdown', (ev) => ev.stopPropagation());
            canevas.parentElement.appendChild(o.élément);
            champs.set(clef, o);
        }
        return o;
    }

    function poseObjet(o, nom, x, y, l) {
        o.fonction = String(nom);
        o.x = nombre(x);
        o.y = nombre(y);
        o.l = l;
        o.police = état.police;
        o.taille = état.taille;
        placeChamp(o);
        if (window.Pythonerie) window.Pythonerie.signaleAnimation(true);
    }

    // une case à cocher ou un bouton radio : la case, puis son texte, dans un <label>
    function fabriqueCoche(o, type, quandChange) {
        const l = document.createElement('label');
        l.className = 'objet-canevas coche-canevas';
        const c = document.createElement('input');
        c.type = type;
        const t = document.createElement('span');
        l.append(c, t);
        // la case rend le focus : la barre d'espace d'un jeu ne la changera pas
        c.addEventListener('change', () => { c.blur(); quandChange(); });
        o.entrée = c;
        o.texte = t;
        return l;
    }

    // une valeur venue de LispE en JSON (liste imbriquée) ; sinon la valeur telle quelle
    function lisJSON(v, défaut) {
        if (typeof v !== 'string') return v === undefined || v === null ? défaut : v;
        try { return JSON.parse(v); } catch (e) { return v; }
    }

    // Les pixels d'une zone du dessin : quatre valeurs par point (rouge, vert, bleu, opacité, de 0 à
    // 255), ligne après ligne. evaljs_li en fait une liste d'entiers, sans passer par du texte.
    // Une zone qui déborde du canevas y lit des points transparents (0, 0, 0, 0).
    // Une image venue d'un autre site interdit au navigateur de lire le dessin : l'erreur est
    // signalée au programme (voir _erreur_navigateur dans bibliothèque.lisp).
    // Le dessin tel qu'on le voit : en 3D, la couche 3D, puis le canevas 2D (transparent) par-dessus ;
    // sinon, le canevas 2D lui-même. Pour le bouton Image, capture_image, couleur_pixel et pixels.
    function dessinComplet() {
        const couche3D = mode3D && scène3D() ? scène3D().canevas() : null;
        if (!couche3D) return canevas;
        const c = document.createElement('canvas');
        c.width = LARGEUR;
        c.height = HAUTEUR;
        const cc = c.getContext('2d');
        cc.drawImage(couche3D, 0, 0, LARGEUR, HAUTEUR);   // la couche 3D peut être plus fine (écran haute densité)
        cc.drawImage(canevas, 0, 0);
        return c;
    }

    function lisPixels(fonction, x, y, l, h) {
        dernièreErreur = '';
        l = Math.round(l); h = Math.round(h);
        if (!(l > 0 && h > 0)) {
            dernièreErreur = fonction + ' : la largeur et la hauteur doivent être plus grandes que 0';
            return new Uint8ClampedArray(0);
        }
        try {
            return dessinComplet().getContext('2d').getImageData(Math.round(x), Math.round(y), l, h).data;
        } catch (e) {
            dernièreErreur = fonction + ' : le dessin contient une image venue d\'un autre site, le navigateur interdit d\'en lire les pixels';
            return new Uint8ClampedArray(0);
        }
    }

    function valeurGlissière(o) {
        const v = Number(o.élément.value);
        return o.entiers ? Math.round(v) : Math.round(v * 1e6) / 1e6;
    }

    // l'appel au programme se fait un instant plus tard (voir envoieChamp)
    function appelleBientôt(fonction, args) {
        setTimeout(() => appelle(fonction, args), 0);
    }

    // Un bouton du canevas : à la souris, il agit au clic ; au doigt, dès qu'on le touche.
    // Un autre doigt peut alors rester posé sur le canevas (piloter le vaisseau d'une main,
    // tirer de l'autre) : les navigateurs ne font pas de « click » pour un toucher pendant
    // qu'un autre doigt est posé. Le click qui suit un toucher seul est ignoré : une seule fois.
    // (Chrome dit qu'un click vient du doigt, pointerType ; Safari non : on regarde alors s'il
    // suit de près un toucher.)
    function réagitAuClic(e, action) {
        let dernierToucher = -Infinity;
        e.addEventListener('pointerdown', (ev) => {
            if (ev.pointerType !== 'touch') return;
            dernierToucher = performance.now();
            action();
        });
        e.addEventListener('click', (ev) => {
            if (ev.pointerType === 'touch') return;
            if (!ev.pointerType && performance.now() - dernierToucher < 700) return;
            action();
        });
    }

    function retireChamps() {
        champs.forEach(c => c.élément.remove());
        champs.clear();
    }

    // portrait(l, h) — c'est canevas(l, h) — et paysage(l, h) : la taille du canevas selon le sens
    // de l'écran, pour une tablette ou un téléphone qu'on tourne (un ordinateur est en largeur).
    // Écran en largeur : la taille paysage, si le programme en a donné une ; sinon la taille
    // portrait (ou 800 × 600). Quand on tourne l'appareil, l'autre taille est prise aussitôt, et le
    // dessin est effacé, comme avec canevas(). Les deux tailles sont oubliées à chaque exécution.
    const formats = { portrait: null, paysage: null };
    const requêteLargeur = window.matchMedia ? window.matchMedia('(orientation: landscape)') : null;
    const enLargeur = () => !requêteLargeur || requêteLargeur.matches;
    const formatVoulu = () => (enLargeur() && formats.paysage) || formats.portrait || [LARGEUR_DÉFAUT, HAUTEUR_DÉFAUT];
    // prend la taille voulue : toujours si forcé, sinon seulement si elle change ; le dessin est effacé
    function appliqueFormat(forcé) {
        const [lg, ht] = formatVoulu();
        if (!forcé && lg === LARGEUR && ht === HAUTEUR) return;
        dimensionne(lg, ht);
        const t = tortueInitiale();
        tortue.x = t.x; tortue.y = t.y; tortue.cap = t.cap;
        window.Pyt.efface();
        prévoitTortue();
    }
    if (requêteLargeur) {
        const tourne = () => { if (formats.portrait || formats.paysage) appliqueFormat(false); };
        if (requêteLargeur.addEventListener) requêteLargeur.addEventListener('change', tourne);
        else if (requêteLargeur.addListener) requêteLargeur.addListener(tourne);
    }
    // la taille donnée à canevas, portrait ou paysage ; null (et dernièreErreur) si elle ne va pas
    function taille(l, h, nom) {
        const lg = Math.round(nombre(l, NaN)), ht = Math.round(nombre(h, NaN));
        if (lg >= 1 && lg <= TAILLE_MAX && ht >= 1 && ht <= TAILLE_MAX) return [lg, ht];
        dernièreErreur = (nom || 'canevas') + ' : la largeur et la hauteur sont des nombres entre 1 et ' + TAILLE_MAX
            + ' (« ' + l + ' », « ' + h + ' »)';
        return null;
    }

    function dimensionne(lg, ht) {
        LARGEUR = lg;
        HAUTEUR = ht;
        if (canevas.width !== lg) canevas.width = couche.width = lg;
        if (canevas.height !== ht) canevas.height = couche.height = ht;
        canevas.parentElement.style.aspectRatio = lg + ' / ' + ht;
        canevas.parentElement.style.setProperty('--ratio', String(lg / ht));
        if (scène3D()) scène3D().dimensionne(lg, ht);
        const étiquette = document.getElementById('tailleCanevas');
        if (étiquette) étiquette.textContent = lg + ' × ' + ht;
        champs.forEach(placeChamp);
    }

    // L'adresse d'une image ou d'un son : un simple nom (« chat.png ») désigne un fichier
    // du répertoire images ou sons du projet ; une adresse avec un « / » (médias/...)
    // ou complète (https://...) garde son sens. null : le nom n'est pas dans le projet.
    // Les médias du site sont dans médias/sounds et médias/images (comme dans l'Atelier). Les
    // anciens chemins y mènent encore : exemples/médias/ding.wav, puis médias/ding.wav (jusqu'au
    // 2026-10-25), et les notes du piano en français (piano/do_dièse_4.wav → piano/C_sharp_4.wav)
    const ANCIENNES_NOTES = {};
    ['do', 'do_dièse', 'ré', 'ré_dièse', 'mi', 'fa', 'fa_dièse', 'sol', 'sol_dièse', 'la', 'la_dièse', 'si'].forEach((n, i) => {
        ANCIENNES_NOTES[n] = ['C', 'C_sharp', 'D', 'D_sharp', 'E', 'F', 'F_sharp', 'G', 'G_sharp', 'A', 'A_sharp', 'B'][i];
    });
    function médiaDéplacé(a) {
        const m = /^(?:exemples\/)?médias\/(?!sounds\/|images\/)(.+)$/.exec(a);
        if (!m) return a;
        const note = /^piano\/(.+)_([345])\.wav$/.exec(m[1]);
        if (note && ANCIENNES_NOTES[note[1]]) return 'médias/sounds/piano/' + ANCIENNES_NOTES[note[1]] + '_' + note[2] + '.wav';
        return 'médias/' + (/\.(wav|mp3|ogg)$/i.test(m[1]) ? 'sounds/' : 'images/') + m[1];
    }
    function adresseMédia(adresse, répertoire) {
        const a = médiaDéplacé(String(adresse).normalize('NFC').trim());
        if (/^[a-z]+:/i.test(a)) return a;
        const chemin = a.startsWith(répertoire + '/') ? a : (a.includes('/') ? null : répertoire + '/' + a);
        // (FichiersProjet est une constante de fichiers-projet.js : elle n'est pas dans window)
        if (chemin && typeof FichiersProjet !== 'undefined' && FichiersProjet.existe(chemin)) return FichiersProjet.url(chemin);
        return a.includes('/') && !a.startsWith(répertoire + '/') ? a : null;
    }

    function signaleErreur(message) {
        if (window.Pythonerie && window.Pythonerie.erreur) window.Pythonerie.erreur(message);
        else console.error(message);
    }

    // ---------- Les glissés du doigt, sur une tablette ----------
    // Un doigt qui glisse sur le jeu ne doit pas faire défiler la page, ni être pris par le
    // navigateur pour un de ses gestes : quitter le plein écran en glissant vers le bas
    // (Safari sur iPad), tirer pour rafraîchir (Chrome sur Android), zoomer en pinçant.
    // touch-action (style.css) ne suffit pas toujours dans Safari : on annule aussi touchmove.
    // Les événements « pointer » du programme (quand_glisse, quand_souris) arrivent quand même.
    // Ce qui défile vraiment (la console sous le canevas, une zone d'édition, une liste)
    // garde son défilement.
    function défilable(élément, limite) {
        for (let e = élément; e && e !== limite; e = e.parentElement) {
            if (e.matches && e.matches('textarea, select, input')) return true;
            const s = getComputedStyle(e);
            if (/(auto|scroll)/.test(s.overflowY) && e.scrollHeight > e.clientHeight) return true;
            if (/(auto|scroll)/.test(s.overflowX) && e.scrollWidth > e.clientWidth) return true;
        }
        return false;
    }

    // actif() : la protection ne vaut que tant qu'il rend vrai (par exemple en plein écran)
    function retientGlissés(élément, actif) {
        élément.addEventListener('touchmove', (ev) => {
            if (actif && !actif()) return;
            if (défilable(ev.target, élément)) return;
            if (ev.cancelable) ev.preventDefault();
        }, { passive: false });
        // le pincement de Safari, qui zoome la page et peut faire sortir du plein écran
        élément.addEventListener('gesturestart', (ev) => {
            if (actif && !actif()) return;
            ev.preventDefault();
        });
    }

    function installeÉvénements() {
        // le doigt qui glisse sur le canevas joue, il ne fait pas défiler la page
        retientGlissés(couche);
        // Événements « pointer » : la souris, mais aussi le doigt sur une tablette
        couche.addEventListener('pointerdown', (ev) => {
            // on garde le pointeur même s'il sort du canevas pendant un glissé
            if (couche.setPointerCapture) couche.setPointerCapture(ev.pointerId);
            const p = positionSouris(ev);
            // quand_clic_objet(f) : f(numéro) reçoit l'objet 3D sous la souris
            if (gestionnaires.clicObjet && mode3D) {
                const n = scène3D().objetSous(p.x, p.y);
                if (n >= 0) appelle(gestionnaires.clicObjet, [n]);
            }
            if (!gestionnaires.clic) return;
            appelle(gestionnaires.clic, [p.x, p.y]);
        });
        couche.addEventListener('pointermove', (ev) => {
            const p = positionSouris(ev);
            const aff = document.getElementById('coordonnées');
            if (aff) aff.textContent = 'x : ' + p.x + '   y : ' + p.y;
            // les valeurs d'un graphique, sous la souris
            montreBulleGraphique(ev, p);
            if (gestionnaires.souris) appelle(gestionnaires.souris, [p.x, p.y]);
            // bouton appuyé (ou doigt posé) : on fait glisser
            if (gestionnaires.glisse && (ev.buttons & 1)) appelle(gestionnaires.glisse, [p.x, p.y]);
        });
        couche.addEventListener('pointerleave', () => {
            const aff = document.getElementById('coordonnées');
            if (aff) aff.textContent = '';
            cacheBulleGraphique();
        });
        window.addEventListener('keydown', (ev) => {
            // On laisse l'éditeur et les champs de saisie tranquilles
            const cible = ev.target;
            if (cible && (cible.closest && cible.closest('.CodeMirror, input, textarea, select'))) return;
            const nom = (NOMS_TOUCHES[ev.key] || ev.key).normalize('NFC');
            // la touche est tenue : on retient son nom sous sa position physique (event.code),
            // pour lui associer exactement un relâchement, avec le même nom
            if (!ev.repeat) enfoncées.set(ev.code || ev.key, nom);
            if (!gestionnaires.touche && !gestionnaires.relâche && !minuteries.length) return;
            if (ev.key.startsWith('Arrow') || ev.key === ' ') ev.preventDefault();
            // quand_touche reçoit aussi les répétitions du système, comme avant
            if (gestionnaires.touche) appelle(gestionnaires.touche, [chaîneLispE(nom)]);
        });
        // Le relâchement est toujours traité si l'appui a été retenu, même si le focus
        // est passé entre-temps à un champ de saisie : tout appui retenu reçoit un relâchement
        window.addEventListener('keyup', (ev) => {
            const code = ev.code || ev.key;
            if (!enfoncées.has(code)) return;
            const nom = enfoncées.get(code);
            enfoncées.delete(code);
            if (gestionnaires.relâche) appelle(gestionnaires.relâche, [chaîneLispE(nom)]);
        });
        // Une touche relâchée pendant que la page n'a pas le focus n'envoie pas de keyup :
        // on relâche tout quand la fenêtre perd le focus ou que l'onglet est caché
        window.addEventListener('blur', () => relâcheTout(true));
        // sortie du plein écran (Échap, ou le navigateur) : une question posée sur le canevas
        // est abandonnée
        document.addEventListener('visibilitychange', () => { if (document.hidden) relâcheTout(true); });
    }

    // Les touches tenues : event.code -> le nom transmis au programme lors de l'appui
    const enfoncées = new Map();

    // prévenir : appeler quand_relâche pour chacune (perte du focus) ; sinon (nouvelle
    // exécution, Arrêter), on oublie simplement les touches
    function relâcheTout(prévenir) {
        const noms = [...enfoncées.values()];
        enfoncées.clear();
        if (prévenir && gestionnaires.relâche) noms.forEach(nom => appelle(gestionnaires.relâche, [chaîneLispE(nom)]));
    }

    // ================= API publique =================
    // les messages des graphiques, avec leurs trous {0}, {1}… ; les nombres s'écrivent en français
    const T = (texte, ...args) => String(texte).replace(/\{(\d+)\}/g, (tout, i) => (args[Number(i)] !== undefined ? String(args[Number(i)]) : tout));
    const langueDesGraphiques = () => 'French';
    // ---------- Graphiques : graphique(genre, valeurs, étiquettes, options) ----------
    // Les graphiques d'un tableur : colonnes, barres (groupées, empilées, à 100 %), courbes,
    // aires, camembert, anneau, nuage de points, bulles, radar, répartition (histogramme des
    // classes), boîte à moustaches, cascade, entonnoir et mosaïque. Ils se dessinent dans tout
    // le canevas ou dans une zone [x, y, largeur, hauteur] (option zone), à partir d'un seul
    // texte JSON : [genre, valeurs, étiquettes, options], préparé par bibliothèque.lisp.
    // Le genre et les clés des options s'écrivent dans n'importe quelle langue du site (avec ou
    // sans accents) : GENRES_GRAPHIQUE et OPTIONS_GRAPHIQUE donnent le nom de chaque langue.
    // Les couleurs suivent une palette vérifiée pour les daltoniens, toujours dans le même ordre ;
    // au-delà de huit parts, un camembert regroupe les plus petites dans « Autre ». Les textes ne
    // prennent jamais la couleur d'une série. Le survol de la souris montre les valeurs
    // (survolsGraphiques, voir installeÉvénements).
    const PALETTE_GRAPHIQUE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
    // le texte posé sur une couleur : blanc, sauf sur le jaune
    const ENCRE_SUR = (couleur) => (couleur === '#eda100' ? '#0b0b0b' : '#ffffff');
    const ENCRE = { titre: '#0b0b0b', texte: '#52514e', discret: '#898781', grille: '#e1e0d9', axe: '#c3c2b7' };
    // une seule teinte, du plus foncé au plus clair (mosaïque, entonnoir)
    const RAMPE_BLEUE = ['#104281', '#184f95', '#1c5cab', '#256abf', '#2a78d6', '#3987e5', '#5598e7'];
    const HAUSSE = '#2a78d6', BAISSE = '#e34948', CUMUL = '#898781';
    const POLICE_GRAPHIQUE = 'system-ui, -apple-system, "Segoe UI", sans-serif';
    // [anglais, français, coréen, autres noms acceptés]
    const GENRES_GRAPHIQUE = [
        ['column', 'colonnes', '세로막대', ['colonne', 'histogramme', 'columns', '세로막대형', '막대']],
        ['bar', 'barres', '가로막대', ['barre', 'bars', '가로막대형']],
        ['stacked_column', 'colonnes_empilées', '누적세로막대', ['colonne_empilée', 'histogramme_empilé', 'stacked_columns', '누적세로막대형']],
        ['stacked_bar', 'barres_empilées', '누적가로막대', ['barre_empilée', 'stacked_bars', '누적가로막대형']],
        ['line', 'courbes', '꺾은선', ['courbe', 'lignes', 'lines', '꺾은선형', '선']],
        ['area', 'aires', '영역', ['aire', 'areas', '영역형']],
        ['stacked_area', 'aires_empilées', '누적영역', ['aire_empilée', 'stacked_areas', '누적영역형']],
        ['pie', 'camembert', '원형', ['secteurs', 'disque', 'pie_chart', '파이', '원그래프']],
        ['doughnut', 'anneau', '도넛', ['beignet', 'donut', '도넛형']],
        ['scatter', 'nuage', '분산형', ['nuage_de_points', 'points', 'dispersion', '분산', '산점도']],
        ['bubble', 'bulles', '거품형', ['bulle', 'bubbles', '거품', '버블']],
        ['radar', 'radar', '방사형', ['toile', 'spider', '레이더']],
        ['histogram', 'répartition', '히스토그램', ['repartition', 'distribution', 'classes', '도수분포']],
        ['box', 'boîte', '상자수염', ['boîte_à_moustaches', 'moustaches', 'boxplot', 'box_plot', '상자', '상자그림']],
        ['waterfall', 'cascade', '폭포', ['waterfall_chart', '폭포형']],
        ['funnel', 'entonnoir', '깔때기', ['funnel_chart', '깔때기형']],
        ['treemap', 'mosaïque', '트리맵', ['mosaique', 'carte_proportionnelle', 'tree_map']]
    ];
    const OPTIONS_GRAPHIQUE = [
        ['title', 'titre', '제목', []],
        ['series', 'séries', '계열', ['serie', 'série']],
        ['zone', 'zone', '위치', ['region', 'area']],
        ['colors', 'couleurs', '색', ['colours', 'couleur', 'color', '색상']],
        ['x_axis', 'axe_x', 'x축', ['xlabel', 'titre_x']],
        ['y_axis', 'axe_y', 'y축', ['ylabel', 'titre_y']],
        ['values', 'valeurs', '값', ['valeur', 'show_values']],
        ['legend', 'légende', '범례', []],
        ['percent', 'pourcentage', '백분율', ['pourcent', 'percentage', '100']],
        ['bins', 'classes', '구간', ['bin', 'intervalles']],
        ['trend', 'tendance', '추세선', ['trendline', 'droite']],
        ['total', 'total', '합계', []],
        ['min', 'min', '최소', ['minimum']],
        ['max', 'max', '최대', ['maximum']],
        ['background', 'fond', '배경', []],
        ['hover', 'survol', '툴팁', ['tooltips', 'infobulles', 'tooltip']],
        ['markers', 'points', '표식', ['marqueurs', 'marker']]
    ];
    const INDEX_LANGUE_GRAPHIQUE = { English: 0, French: 1, Korean: 2 };
    // sans accents, en minuscules, les espaces et les tirets deviennent _ : « Colonnes empilées »
    // et « colonnes_empilees » désignent le même genre
    const clefGraphique = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC')
        .toLowerCase().trim().replace(/[\s\-]+/g, '_');
    function indexeNoms(table) {
        const index = new Map();
        for (const [en, fr, ko, autres] of table) for (const nom of [en, fr, ko, ...autres]) index.set(clefGraphique(nom), en);
        return index;
    }
    const INDEX_GENRES = indexeNoms(GENRES_GRAPHIQUE);
    const INDEX_OPTIONS = indexeNoms(OPTIONS_GRAPHIQUE);
    const nomsDansLangue = (table) => table.map(l => l[INDEX_LANGUE_GRAPHIQUE[langueDesGraphiques()] ?? 1]).join(', ');
    const LOCALE_GRAPHIQUE = { French: 'fr-FR', English: 'en-US', Korean: 'ko-KR' };
    const localeGraphique = () => LOCALE_GRAPHIQUE[langueDesGraphiques()] || 'fr-FR';

    // Les zones survolées des graphiques du canevas : { x, y, l, h, texte } (un rectangle),
    // { cx, cy, r0, r1, a0, a1, texte } (une part) ou { cx, cy, r, texte } (un point).
    // efface() et fond() les oublient ; un graphique redessiné remplace ceux de sa zone.
    let survolsGraphiques = [];
    let bulleGraphique = null;
    function survolSous(x, y) {
        for (let i = survolsGraphiques.length - 1; i >= 0; i--) {
            const s = survolsGraphiques[i];
            if (s.l !== undefined) { if (x >= s.x && x <= s.x + s.l && y >= s.y && y <= s.y + s.h) return s; }
            else if (s.r0 !== undefined) {
                const d = Math.hypot(x - s.cx, y - s.cy);
                if (d < s.r0 || d > s.r1) continue;
                let a = Math.atan2(y - s.cy, x - s.cx);
                while (a < s.a0) a += 2 * Math.PI;
                if (a <= s.a1) return s;
            } else if (Math.hypot(x - s.cx, y - s.cy) <= s.r) return s;
        }
        return null;
    }
    function montreBulleGraphique(ev, p) {
        const s = survolsGraphiques.length ? survolSous(p.x, p.y) : null;
        if (!s) { cacheBulleGraphique(); return; }
        if (!bulleGraphique) {
            bulleGraphique = document.createElement('div');
            bulleGraphique.className = 'bulle-graphique';
            Object.assign(bulleGraphique.style, {
                position: 'fixed', zIndex: 50, pointerEvents: 'none', whiteSpace: 'pre', background: '#ffffff',
                color: ENCRE.titre, font: '12px/1.45 ' + POLICE_GRAPHIQUE, padding: '6px 9px', borderRadius: '6px',
                border: '1px solid rgba(11,11,11,0.10)', boxShadow: '0 2px 8px rgba(0,0,0,0.12)'
            });
        }
        // dans le cadre du canevas, pour rester visible en plein écran
        const parent = canevas.parentElement || document.body;
        if (bulleGraphique.parentElement !== parent) parent.appendChild(bulleGraphique);
        bulleGraphique.textContent = s.texte;
        bulleGraphique.hidden = false;
        const l = bulleGraphique.offsetWidth, h = bulleGraphique.offsetHeight;
        let gauche = ev.clientX + 14, haut = ev.clientY + 14;
        if (gauche + l > window.innerWidth - 4) gauche = ev.clientX - l - 14;
        if (haut + h > window.innerHeight - 4) haut = ev.clientY - h - 14;
        bulleGraphique.style.left = Math.max(4, gauche) + 'px';
        bulleGraphique.style.top = Math.max(4, haut) + 'px';
    }
    function cacheBulleGraphique() { if (bulleGraphique) bulleGraphique.hidden = true; }
    function oublieGraphiques() { survolsGraphiques = []; cacheBulleGraphique(); }

    function dessineGraphique(texte) {
        let spec;
        try { spec = typeof texte === 'string' ? JSON.parse(texte) : texte; } catch (e) { return T('graphique : données illisibles'); }
        let [genreDonné, valeurs, étiquettes, optionsDonnées] = Array.isArray(spec) ? spec : [];
        // graphique(genre, valeurs, options) : les options à la place des étiquettes
        if (étiquettes && typeof étiquettes === 'object' && !Array.isArray(étiquettes) && !optionsDonnées) {
            optionsDonnées = étiquettes; étiquettes = null;
        }
        if (typeof genreDonné !== 'string') return T('graphique : le genre est un texte, par exemple « {0} » (genres : {1})', GENRES_GRAPHIQUE[0][INDEX_LANGUE_GRAPHIQUE[langueDesGraphiques()] ?? 1], nomsDansLangue(GENRES_GRAPHIQUE));
        const genre = INDEX_GENRES.get(clefGraphique(genreDonné));
        if (!genre) return T('graphique : genre inconnu « {0} » (genres : {1})', genreDonné, nomsDansLangue(GENRES_GRAPHIQUE));
        const o = {};
        if (optionsDonnées !== null && optionsDonnées !== undefined) {
            if (typeof optionsDonnées !== 'object' || Array.isArray(optionsDonnées)) return T('graphique : les options sont un dictionnaire, par exemple {"titre": "Mon graphique"}');
            for (const [k, v] of Object.entries(optionsDonnées)) {
                const clef = INDEX_OPTIONS.get(clefGraphique(k));
                if (!clef) return T('graphique : option inconnue « {0} » (options : {1})', k, nomsDansLangue(OPTIONS_GRAPHIQUE));
                o[clef] = v;
            }
        }
        // la zone du graphique
        let zx = 0, zy = 0, zl = LARGEUR, zh = HAUTEUR;
        if (o.zone !== undefined && o.zone !== null) {
            const z = o.zone;
            if (!Array.isArray(z) || z.length !== 4 || z.some(v => typeof v !== 'number' || !Number.isFinite(v)) || z[2] < 40 || z[3] < 40)
                return T('graphique : la zone est [x, y, largeur, hauteur], avec une largeur et une hauteur d\'au moins 40');
            [zx, zy, zl, zh] = z;
        }
        const g = { genre, o, zx, zy, zl, zh, étiquettes: Array.isArray(étiquettes) ? étiquettes.map(e => (e === null || e === undefined ? '' : String(e))) : [] };
        const principal = ctx.canvas === canevas;
        if (principal) survolsGraphiques = survolsGraphiques.filter(s => !dansZone(s, g));
        g.survols = principal && o.hover !== false ? survolsGraphiques : [];
        ctx.save();
        try {
            ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash([]);
            ctx.globalAlpha = 1;
            const peintre = {
                column: graphiqueCatégories, bar: graphiqueCatégories, stacked_column: graphiqueCatégories,
                stacked_bar: graphiqueCatégories, line: graphiqueCatégories, area: graphiqueCatégories,
                stacked_area: graphiqueCatégories, pie: graphiqueCamembert, doughnut: graphiqueCamembert,
                scatter: graphiqueNuage, bubble: graphiqueNuage, radar: graphiqueRadar, histogram: graphiqueRépartition,
                box: graphiqueBoîte, waterfall: graphiqueCascade, funnel: graphiqueEntonnoir, treemap: graphiqueMosaïque
            }[genre];
            return peintre(g, valeurs) || '';
        } finally { ctx.restore(); }
    }
    const dansZone = (s, g) => {
        const x = s.l !== undefined ? s.x + s.l / 2 : s.cx, y = s.l !== undefined ? s.y + s.h / 2 : s.cy;
        return x >= g.zx && x <= g.zx + g.zl && y >= g.zy && y <= g.zy + g.zh;
    };

    // ---- les données ----
    const estNombre = (v) => typeof v === 'number' && Number.isFinite(v);
    // une liste de nombres (une série) ou une liste de listes (une série chacune) ; Rien est un trou
    function sériesDe(valeurs, max = PALETTE_GRAPHIQUE.length) {
        if (!Array.isArray(valeurs) || !valeurs.length) return T('graphique : il faut une liste de nombres, ou une liste de listes de nombres (une par série)');
        const séries = valeurs.every(v => Array.isArray(v)) ? valeurs : [valeurs];
        for (const s of séries) for (const v of s) {
            if (v !== null && !estNombre(v)) return T('graphique : « {0} » n\'est pas un nombre', Array.isArray(v) ? JSON.stringify(v) : v);
        }
        if (séries.length > max) return T('graphique : {0} séries au plus (il y en a {1})', max, séries.length);
        return séries;
    }
    const nomsSéries = (g, n) => Array.from({ length: n }, (_, i) =>
        (Array.isArray(g.o.series) && g.o.series[i] !== undefined && g.o.series[i] !== null) ? String(g.o.series[i]) : (n === 1 ? (g.o.title ? String(g.o.title) : T('Valeur')) : T('Série {0}', i + 1)));
    const étiquette = (g, i) => (g.étiquettes[i] !== undefined && g.étiquettes[i] !== '' ? g.étiquettes[i] : String(i + 1));
    function couleursSéries(g, n) {
        const données = Array.isArray(g.o.colors) ? g.o.colors : (typeof g.o.colors === 'string' ? [g.o.colors] : []);
        return Array.from({ length: n }, (_, i) => (données[i] !== undefined && données[i] !== null ? couleurCSS(données[i]) : PALETTE_GRAPHIQUE[i % PALETTE_GRAPHIQUE.length]));
    }
    function formatGraphique(v, options = {}) {
        if (!estNombre(v)) return '—';
        const opt = Math.abs(v) >= 10000 && options.compact !== false
            ? { notation: 'compact', maximumFractionDigits: 1 }
            : { maximumFractionDigits: options.décimales ?? (Math.abs(v) >= 100 ? 1 : 2) };
        try { return new Intl.NumberFormat(localeGraphique(), opt).format(v); } catch (e) { return String(Math.round(v * 100) / 100); }
    }
    const pourcent = (v) => { try { return new Intl.NumberFormat(localeGraphique(), { style: 'percent', maximumFractionDigits: 1 }).format(v); } catch (e) { return Math.round(v * 1000) / 10 + ' %'; } };

    // ---- l'échelle : des graduations rondes ----
    function pasRond(x) {
        const e = Math.floor(Math.log10(x)), f = x / 10 ** e;
        return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * 10 ** e;
    }
    function échelle(min, max, n = 5) {
        if (!(max > min)) { if (max === 0) max = 1; else if (max > 0) min = 0; else max = 0; }
        if (!(max > min)) { min -= 1; max += 1; }
        const pas = pasRond((max - min) / n);
        const bas = Math.floor(min / pas + 1e-9) * pas, haut = Math.ceil(max / pas - 1e-9) * pas;
        const décimales = Math.max(0, -Math.floor(Math.log10(pas) + 1e-9));
        const graduations = [];
        for (let v = bas; v <= haut + pas / 2; v += pas) graduations.push(Number(v.toFixed(décimales)));
        return { min: bas, max: haut, graduations, décimales };
    }
    const étiquetteGraduation = (v, é) => formatGraphique(v, { décimales: é.décimales, compact: true });

    // ---- le texte ----
    const police = (taille, gras) => (gras ? '600 ' : '') + taille + 'px ' + POLICE_GRAPHIQUE;
    function écritGraphique(texte, x, y, { taille = 12, gras = false, couleur = ENCRE.texte, align = 'left', base = 'middle', angle = 0 } = {}) {
        ctx.save();
        ctx.font = police(taille, gras);
        ctx.fillStyle = couleur;
        ctx.textAlign = align;
        ctx.textBaseline = base;
        if (angle) { ctx.translate(x, y); ctx.rotate(angle); ctx.fillText(texte, 0, 0); }
        else ctx.fillText(texte, x, y);
        ctx.restore();
    }
    function mesure(texte, taille = 12, gras = false) { ctx.save(); ctx.font = police(taille, gras); const l = ctx.measureText(texte).width; ctx.restore(); return l; }
    // le texte raccourci par « … » pour tenir dans la largeur
    function raccourci(texte, largeur, taille = 12, gras = false) {
        if (mesure(texte, taille, gras) <= largeur) return texte;
        let t = texte;
        while (t.length > 1 && mesure(t + '…', taille, gras) > largeur) t = t.slice(0, -1);
        return t.length > 1 ? t + '…' : '';
    }

    // ---- les marques ----
    // un rectangle aux coins arrondis là où sont les données (r : [haut-gauche, haut-droit, bas-droit, bas-gauche])
    function rectangleArrondi(x, y, l, h, r) {
        if (l < 0) { x += l; l = -l; }
        if (h < 0) { y += h; h = -h; }
        const m = Math.min(l / 2, h / 2);
        const [a, b, c, d] = r.map(v => Math.max(0, Math.min(v, m)));
        ctx.beginPath();
        ctx.moveTo(x + a, y);
        ctx.lineTo(x + l - b, y); if (b) ctx.arcTo(x + l, y, x + l, y + b, b);
        ctx.lineTo(x + l, y + h - c); if (c) ctx.arcTo(x + l, y + h, x + l - c, y + h, c);
        ctx.lineTo(x + d, y + h); if (d) ctx.arcTo(x, y + h, x, y + h - d, d);
        ctx.lineTo(x, y + a); if (a) ctx.arcTo(x, y, x + a, y, a);
        ctx.closePath();
    }
    function peintForme(couleur) { ctx.fillStyle = couleur; ctx.fill(); }
    function trait(x1, y1, x2, y2, couleur, épaisseur = 1) {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
        ctx.strokeStyle = couleur; ctx.lineWidth = épaisseur; ctx.stroke();
    }
    // un point de 4 de rayon, entouré de 2 points de la couleur du fond
    function marqueur(x, y, couleur, fond, r = 4) {
        ctx.beginPath(); ctx.arc(x, y, r + 2, 0, 2 * Math.PI); peintForme(fond);
        ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); peintForme(couleur);
    }
    const avecAlpha = (couleur, alpha) => { ctx.save(); ctx.globalAlpha = alpha; peintForme(couleur); ctx.restore(); };

    // ---- le cadre : le fond, le titre, la légende ; rend la place qui reste ----
    function cadreGraphique(g, légende) {
        const fond = g.o.background === undefined ? '#ffffff' : (g.o.background === null || g.o.background === false ? null : couleurCSS(g.o.background));
        g.fond = fond || '#ffffff';
        if (fond) { ctx.fillStyle = fond; ctx.fillRect(g.zx, g.zy, g.zl, g.zh); }
        const marge = Math.max(8, Math.min(16, g.zl / 30));
        let x = g.zx + marge, y = g.zy + marge, l = g.zl - 2 * marge, h = g.zh - 2 * marge;
        if (g.o.title !== undefined && g.o.title !== null && g.o.title !== '') {
            const taille = Math.max(13, Math.min(18, g.zl / 36));
            écritGraphique(raccourci(String(g.o.title), l, taille, true), x, y, { taille, gras: true, couleur: ENCRE.titre, base: 'top' });
            y += taille * 1.3 + 6; h -= taille * 1.3 + 6;
        }
        const avecLégende = g.o.legend === true || (g.o.legend !== false && légende.length >= 2);
        if (avecLégende && légende.length) {
            // les clés, en lignes : une pastille (ou un trait pour une courbe) puis le nom
            let cx = x, cy = y + 7;
            for (const é of légende) {
                const nom = raccourci(é.texte, l - 20);
                const largeur = 16 + mesure(nom) + 14;
                if (cx > x && cx + largeur > x + l) { cx = x; cy += 18; }
                if (é.trait) { trait(cx, cy, cx + 12, cy, é.couleur, 2); }
                else { rectangleArrondi(cx, cy - 5, 10, 10, [2, 2, 2, 2]); peintForme(é.couleur); }
                écritGraphique(nom, cx + 16, cy, { couleur: ENCRE.texte });
                cx += largeur;
            }
            const occupé = cy + 11 - y + 8;
            y += occupé; h -= occupé;
        }
        return { x, y, l, h };
    }

    // ---- les axes d'un graphique à catégories ----
    // horizontal : les catégories de haut en bas (barres) ; sinon de gauche à droite
    function axesCatégories(g, place, n, min, max, horizontal) {
        const é = échelle(estNombre(g.o.min) ? g.o.min : min, estNombre(g.o.max) ? g.o.max : max);
        if (estNombre(g.o.min)) é.min = g.o.min;
        if (estNombre(g.o.max)) é.max = g.o.max;
        é.graduations = é.graduations.filter(v => v >= é.min - 1e-9 && v <= é.max + 1e-9);
        const noms = Array.from({ length: n }, (_, i) => étiquette(g, i));
        const titreX = g.o.x_axis ? String(g.o.x_axis) : '', titreY = g.o.y_axis ? String(g.o.y_axis) : '';
        const largeurGrad = Math.max(...é.graduations.map(v => mesure(étiquetteGraduation(v, é) + (g.pourCent ? ' %' : ''))));
        let gauche, bas, angle = 0, maxÉtiquette;
        if (horizontal) {
            maxÉtiquette = Math.min(Math.max(...noms.map(t => mesure(t))), place.l * 0.3);
            gauche = maxÉtiquette + 10 + (titreY ? 20 : 0);
            bas = 22 + (titreX ? 20 : 0);
        } else {
            gauche = largeurGrad + 10 + (titreY ? 20 : 0);
            const caseL = (place.l - gauche - 6) / n;
            const plusLarge = Math.max(...noms.map(t => mesure(t)));
            if (plusLarge > caseL - 4) {
                angle = -Math.PI / 4;
                maxÉtiquette = Math.min(plusLarge, place.h * 0.3 / 0.71);
                bas = maxÉtiquette * 0.71 + 14 + (titreX ? 20 : 0);
            } else { maxÉtiquette = caseL - 4; bas = 22 + (titreX ? 20 : 0); }
        }
        const zone = { x: place.x + gauche, y: place.y + 6, l: place.l - gauche - 6, h: place.h - bas - 6 };
        const val = horizontal
            ? (v) => zone.x + (v - é.min) / (é.max - é.min) * zone.l
            : (v) => zone.y + zone.h - (v - é.min) / (é.max - é.min) * zone.h;
        const caseT = (horizontal ? zone.h : zone.l) / n;
        const centre = horizontal ? (i) => zone.y + (i + 0.5) * caseT : (i) => zone.x + (i + 0.5) * caseT;
        // la grille : des traits fins, discrets, à chaque graduation
        for (const v of é.graduations) {
            const p = val(v);
            if (horizontal) {
                trait(p, zone.y, p, zone.y + zone.h, ENCRE.grille);
                écritGraphique(étiquetteGraduation(v, é) + (g.pourCent ? ' %' : ''), p, zone.y + zone.h + 6, { couleur: ENCRE.discret, align: 'center', base: 'top' });
            } else {
                trait(zone.x, p, zone.x + zone.l, p, ENCRE.grille);
                écritGraphique(étiquetteGraduation(v, é) + (g.pourCent ? ' %' : ''), zone.x - 8, p, { couleur: ENCRE.discret, align: 'right' });
            }
        }
        // la ligne de base : zéro s'il est dans l'échelle
        const zéro = Math.min(é.max, Math.max(é.min, 0));
        const base = val(zéro);
        if (horizontal) trait(base, zone.y, base, zone.y + zone.h, ENCRE.axe);
        else trait(zone.x, base, zone.x + zone.l, base, ENCRE.axe);
        // les noms des catégories, raccourcis s'il le faut ; en biais quand ils sont trop larges
        const pasNoms = horizontal ? Math.max(1, Math.ceil(16 / caseT)) : 1;
        noms.forEach((t, i) => {
            if (i % pasNoms) return;
            const court = raccourci(t, maxÉtiquette);
            if (horizontal) écritGraphique(court, zone.x - 8, centre(i), { align: 'right', couleur: ENCRE.texte });
            else if (angle) écritGraphique(court, centre(i) + 4, zone.y + zone.h + 8, { align: 'right', base: 'middle', angle });
            else écritGraphique(court, centre(i), zone.y + zone.h + 7, { align: 'center', base: 'top' });
        });
        if (titreY) écritGraphique(raccourci(titreY, horizontal ? zone.h : zone.h), place.x + 6, zone.y + zone.h / 2, { align: 'center', angle: -Math.PI / 2, couleur: ENCRE.texte });
        if (titreX) écritGraphique(raccourci(titreX, zone.l), zone.x + zone.l / 2, place.y + place.h - 6, { align: 'center', base: 'bottom', couleur: ENCRE.texte });
        return { zone, val, base, centre, caseT, noms, é };
    }

    // ---- colonnes, barres, courbes, aires (groupées ou empilées) ----
    function graphiqueCatégories(g, valeurs, réglages = {}) {
        const séries = sériesDe(valeurs);
        if (typeof séries === 'string') return séries;
        const genre = g.genre;
        const horizontal = genre === 'bar' || genre === 'stacked_bar';
        const empilé = genre.startsWith('stacked_');
        const enCourbe = genre === 'line' || genre === 'area' || genre === 'stacked_area';
        const pourCent = g.pourCent = empilé && (g.o.percent === true);
        const n = Math.max(...séries.map(s => s.length), 1);
        const noms = réglages.noms || nomsSéries(g, séries.length);
        const couleurs = réglages.couleurs || couleursSéries(g, séries.length);
        const val = (s, i) => (estNombre(séries[s][i]) ? séries[s][i] : null);
        // les piles : le haut et le bas de chaque segment, les positifs vers le haut, les négatifs vers le bas
        let min = 0, max = 0;
        const piles = [];
        if (empilé) {
            for (let i = 0; i < n; i++) {
                let total = 0;
                if (pourCent) for (let s = 0; s < séries.length; s++) total += Math.abs(val(s, i) || 0);
                let haut = 0, bas = 0;
                piles.push(séries.map((_, s) => {
                    let v = val(s, i);
                    if (v === null) return null;
                    if (pourCent) v = total ? v / total * 100 : 0;
                    const seg = v >= 0 ? [haut, haut += v] : [bas, bas += v];
                    return seg;
                }));
                max = Math.max(max, haut); min = Math.min(min, bas);
            }
        } else {
            for (const s of séries) for (const v of s) if (estNombre(v)) { max = Math.max(max, v); min = Math.min(min, v); }
        }
        if (pourCent) { min = Math.min(min, 0); max = Math.max(max, 0) > 0 ? 100 : 0; }
        const légende = noms.map((t, s) => ({ texte: t, couleur: couleurs[s], trait: genre === 'line' }));
        const place = cadreGraphique(g, réglages.légende || légende);
        const a = axesCatégories(g, place, n, min, max, horizontal);
        const fond = g.fond;
        const montreValeurs = g.o.values === true;
        const texteValeur = (v) => (pourCent ? formatGraphique(v, { décimales: 0 }) + ' %' : formatGraphique(v));
        if (enCourbe) {
            // les aires d'abord, puis les traits, puis les points
            const pts = séries.map((_, s) => Array.from({ length: n }, (_, i) => {
                const seg = empilé ? piles[i][s] : null;
                const v = empilé ? (seg ? seg[1] : null) : val(s, i);
                return v === null ? null : { x: a.centre(i), y: a.val(v), bas: empilé ? a.val(seg[0]) : a.base, v: val(s, i) };
            }));
            const morceaux = (liste) => { const m = []; let c = []; for (const p of liste) { if (p) c.push(p); else if (c.length) { m.push(c); c = []; } } if (c.length) m.push(c); return m; };
            if (genre !== 'line') {
                pts.forEach((liste, s) => morceaux(liste).forEach(m => {
                    ctx.beginPath();
                    m.forEach((p, j) => (j ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
                    for (let j = m.length - 1; j >= 0; j--) ctx.lineTo(m[j].x, m[j].bas);
                    ctx.closePath();
                    avecAlpha(couleurs[s], empilé ? 0.35 : 0.12);
                }));
            }
            pts.forEach((liste, s) => morceaux(liste).forEach(m => {
                ctx.beginPath();
                m.forEach((p, j) => (j ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
                ctx.strokeStyle = couleurs[s]; ctx.lineWidth = 2; ctx.stroke();
            }));
            const avecPoints = g.o.markers === true || (g.o.markers !== false && genre === 'line' && n <= 24);
            pts.forEach((liste, s) => liste.forEach(p => { if (p && (avecPoints || liste.filter(Boolean).length === 1)) marqueur(p.x, p.y, couleurs[s], fond); }));
            if (montreValeurs) pts.forEach(liste => liste.forEach(p => { if (p) écritGraphique(texteValeur(p.v), p.x, p.y - 10, { align: 'center', base: 'bottom' }); }));
            else if (genre === 'line' && séries.length <= 4) {
                // la dernière valeur de chaque courbe, au bout
                pts.forEach(liste => { const p = [...liste].reverse().find(Boolean); if (p && p.x + 40 < place.x + place.l + 16) écritGraphique(texteValeur(p.v), p.x + 8, p.y, { couleur: ENCRE.texte }); });
            }
        } else {
            // les colonnes : 24 points au plus, un espace de 2 points de la couleur du fond entre deux voisines
            const k = empilé ? 1 : séries.length;
            const groupe = réglages.serré ? a.caseT - 2 : a.caseT * 0.72;
            const épaisseur = réglages.serré ? groupe : Math.max(1, Math.min(24 * Math.max(1, Math.min(2, (horizontal ? a.zone.h : a.zone.l) / 600)), (groupe - 2 * (k - 1)) / k));
            const largeurGroupe = réglages.serré ? groupe : épaisseur * k + 2 * (k - 1);
            for (let i = 0; i < n; i++) {
                const début = a.centre(i) - largeurGroupe / 2;
                séries.forEach((_, s) => {
                    let de, à;
                    if (empilé) { const seg = piles[i][s]; if (!seg) return; [de, à] = seg; }
                    else { const v = val(s, i); if (v === null) return; de = 0; à = v; }
                    if (à === de) return;
                    const p0 = a.val(Math.max(a.é.min, Math.min(a.é.max, de))), p1 = a.val(Math.max(a.é.min, Math.min(a.é.max, à)));
                    const pos = début + (empilé ? 0 : s * (épaisseur + 2));
                    // l'arrondi au bout des données seulement : au sommet de la pile, ou de chaque colonne
                    const auBout = !empilé || piles[i].every((seg, t) => t <= s || !seg || Math.sign(seg[1] - seg[0]) !== Math.sign(à - de));
                    const r = auBout ? 4 : 0;
                    const positif = à > de;
                    if (horizontal) {
                        rectangleArrondi(Math.min(p0, p1), pos, Math.abs(p1 - p0), épaisseur, positif ? [0, r, r, 0] : [r, 0, 0, r]);
                    } else {
                        rectangleArrondi(pos, Math.min(p0, p1), épaisseur, Math.abs(p1 - p0), positif ? [r, r, 0, 0] : [0, 0, r, r]);
                    }
                    peintForme(couleurs[s]);
                    // l'espace entre deux segments d'une pile
                    if (empilé && Math.abs(p1 - p0) > 3) {
                        if (horizontal) trait(p1, pos, p1, pos + épaisseur, fond, 2);
                        else trait(pos, p1, pos + épaisseur, p1, fond, 2);
                    }
                    if (montreValeurs) {
                        const t = texteValeur(empilé ? (pourCent ? à - de : val(s, i)) : à);
                        const lt = mesure(t);
                        if (empilé) {
                            const place = Math.abs(p1 - p0);
                            if (horizontal ? place > lt + 8 : place > 16 && épaisseur > lt + 6) {
                                const cx = horizontal ? (p0 + p1) / 2 : pos + épaisseur / 2, cy = horizontal ? pos + épaisseur / 2 : (p0 + p1) / 2;
                                écritGraphique(t, cx, cy, { align: 'center', couleur: ENCRE_SUR(couleurs[s]) });
                            }
                        } else if (horizontal) écritGraphique(t, p1 + (positif ? 5 : -5), pos + épaisseur / 2, { align: positif ? 'left' : 'right' });
                        else écritGraphique(t, pos + épaisseur / 2, p1 + (positif ? -4 : 4), { align: 'center', base: positif ? 'bottom' : 'top' });
                    }
                });
            }
        }
        // le survol : toute la case de la catégorie, avec la valeur de chaque série
        for (let i = 0; i < n; i++) {
            const lignes = [réglages.titreCase ? réglages.titreCase(i) : a.noms[i]];
            séries.forEach((_, s) => {
                const v = val(s, i);
                if (v === null) return;
                lignes.push((séries.length > 1 || réglages.noms ? noms[s] + ' : ' : '') + formatGraphique(v, { compact: false }) + (pourCent && piles[i][s] ? '  (' + formatGraphique(piles[i][s][1] - piles[i][s][0], { décimales: 1 }) + ' %)' : ''));
            });
            if (horizontal) g.survols.push({ x: a.zone.x, y: a.centre(i) - a.caseT / 2, l: a.zone.l, h: a.caseT, texte: lignes.join('\n') });
            else g.survols.push({ x: a.centre(i) - a.caseT / 2, y: a.zone.y, l: a.caseT, h: a.zone.h, texte: lignes.join('\n') });
        }
        return '';
    }

    // ---- répartition : les valeurs comptées par classes de même largeur ----
    function graphiqueRépartition(g, valeurs) {
        const séries = sériesDe(valeurs);
        if (typeof séries === 'string') return séries;
        const toutes = séries.flat().filter(estNombre);
        if (!toutes.length) return T('graphique : il faut une liste de nombres, ou une liste de listes de nombres (une par série)');
        let min = Math.min(...toutes), max = Math.max(...toutes);
        const k = estNombre(g.o.bins) && g.o.bins >= 1 ? Math.min(100, Math.round(g.o.bins)) : Math.ceil(Math.log2(toutes.length) + 1);
        if (max === min) { min -= 0.5; max += 0.5; }
        const pas = pasRond((max - min) / k);
        const début = Math.floor(min / pas) * pas;
        // la plus grande valeur entre dans la dernière classe, comme dans un tableur
        const nb = Math.max(1, Math.ceil((max - début) / pas - 1e-9));
        const décimales = Math.max(0, -Math.floor(Math.log10(pas) + 1e-9));
        const bornes = Array.from({ length: nb + 1 }, (_, i) => Number((début + i * pas).toFixed(décimales)));
        const comptes = séries.map(s => {
            const c = new Array(nb).fill(0);
            for (const v of s) if (estNombre(v)) c[Math.min(nb - 1, Math.floor((v - début) / pas + 1e-9))]++;
            return c;
        });
        const nf = (v) => formatGraphique(v, { décimales, compact: false });
        g.étiquettes = bornes.slice(0, -1).map((b, i) => nf(b) + '–' + nf(bornes[i + 1]));
        const titreCase = (i) => '[' + nf(bornes[i]) + ' ; ' + nf(bornes[i + 1]) + '[';
        if (g.o.y_axis === undefined) g.o.y_axis = T('Effectif');
        g.genre = 'column';
        return graphiqueCatégories(g, comptes, { serré: séries.length === 1, titreCase, noms: séries.length > 1 ? nomsSéries(g, séries.length) : [T('Effectif')] });
    }

    // ---- cascade : les variations, puis le total ----
    function graphiqueCascade(g, valeurs) {
        const séries = sériesDe(valeurs, 1);
        if (typeof séries === 'string') return séries;
        const v = séries[0].map(x => (estNombre(x) ? x : 0));
        const avecTotal = g.o.total !== false;
        const n = v.length + (avecTotal ? 1 : 0);
        const noms = Array.from({ length: v.length }, (_, i) => étiquette(g, i));
        if (avecTotal) noms.push(typeof g.o.total === 'string' ? g.o.total : T('Total'));
        g.étiquettes = noms;
        let cumul = 0, min = 0, max = 0;
        const marches = v.map(x => { const de = cumul; cumul += x; min = Math.min(min, cumul); max = Math.max(max, cumul); return [de, cumul, x]; });
        if (avecTotal) marches.push([0, cumul, cumul]);
        const place = cadreGraphique(g, [{ texte: T('Hausse'), couleur: HAUSSE }, { texte: T('Baisse'), couleur: BAISSE }].concat(avecTotal ? [{ texte: noms[n - 1], couleur: CUMUL }] : []));
        const a = axesCatégories(g, place, n, min, max, false);
        const épaisseur = Math.min(a.caseT * 0.72, 24 * Math.max(1, Math.min(2, a.zone.l / 600)));
        marches.forEach(([de, à, x], i) => {
            const total = avecTotal && i === n - 1;
            const p0 = a.val(de), p1 = a.val(à), pos = a.centre(i) - épaisseur / 2;
            if (à !== de) { rectangleArrondi(pos, Math.min(p0, p1), épaisseur, Math.max(1, Math.abs(p1 - p0)), [2, 2, 2, 2]); peintForme(total ? CUMUL : x >= 0 ? HAUSSE : BAISSE); }
            // le trait qui relie une marche à la suivante
            if (i < n - 1) trait(pos + épaisseur, p1, a.centre(i + 1) - épaisseur / 2, p1, ENCRE.axe);
            if (g.o.values !== false) {
                const t = (total || x < 0 ? '' : '+') + formatGraphique(x);
                écritGraphique(t, a.centre(i), Math.min(p0, p1) - 4, { align: 'center', base: 'bottom' });
            }
            g.survols.push({ x: a.centre(i) - a.caseT / 2, y: a.zone.y, l: a.caseT, h: a.zone.h,
                texte: noms[i] + '\n' + (total ? formatGraphique(à, { compact: false }) : (x >= 0 ? '+' : '') + formatGraphique(x, { compact: false }) + '  →  ' + formatGraphique(à, { compact: false })) });
        });
        return '';
    }

    // ---- camembert et anneau ----
    function graphiqueCamembert(g, valeurs) {
        const séries = sériesDe(valeurs, 1);
        if (typeof séries === 'string') return séries;
        let parts = séries[0].map((v, i) => ({ v: estNombre(v) ? v : 0, nom: étiquette(g, i), i }));
        if (parts.some(p => p.v < 0)) return T('graphique : un camembert ou un anneau ne montre que des nombres positifs ou nuls');
        const couleursDonnées = couleursSéries(g, parts.length);
        parts.forEach(p => { p.couleur = couleursDonnées[p.i]; });
        // au-delà de huit parts, les plus petites se regroupent dans « Autre »
        if (parts.length > PALETTE_GRAPHIQUE.length && !Array.isArray(g.o.colors)) {
            const gardées = new Set([...parts].sort((a, b) => b.v - a.v).slice(0, PALETTE_GRAPHIQUE.length - 1).map(p => p.i));
            const autres = parts.filter(p => !gardées.has(p.i));
            parts = parts.filter(p => gardées.has(p.i));
            parts.forEach((p, j) => { p.couleur = PALETTE_GRAPHIQUE[j]; });
            parts.push({ v: autres.reduce((s, p) => s + p.v, 0), nom: T('Autre'), couleur: CUMUL, détail: autres });
        }
        const total = parts.reduce((s, p) => s + p.v, 0);
        const anneau = g.genre === 'doughnut';
        const place = cadreGraphique(g, []);
        // la légende à droite quand la place est large, sinon dessous
        const àDroite = place.l > place.h * 1.25;
        const largeurLégende = àDroite ? Math.min(place.l * 0.4, Math.max(...parts.map(p => mesure(p.nom))) + 90) : place.l;
        const lignes = àDroite ? parts.length : Math.ceil(parts.length / Math.max(1, Math.floor(place.l / 150)));
        const hauteurLégende = àDroite ? 0 : lignes * 18 + 8;
        const disque = { x: place.x, y: place.y, l: place.l - (àDroite ? largeurLégende + 16 : 0), h: place.h - hauteurLégende };
        const r = Math.max(10, Math.min(disque.l, disque.h) / 2 - 4);
        const cx = disque.x + disque.l / 2, cy = disque.y + disque.h / 2;
        const r0 = anneau ? r * 0.58 : 0;
        // rien à partager (tous les nombres à 0) : un cercle vide
        if (!total) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2 * Math.PI); ctx.strokeStyle = ENCRE.axe; ctx.lineWidth = 1; ctx.stroke(); }
        let angle = -Math.PI / 2;
        parts.forEach(p => {
            const a0 = angle, a1 = angle + (total ? p.v / total : 0) * 2 * Math.PI;
            angle = a1;
            p.a0 = a0; p.a1 = a1;
            if (a1 - a0 <= 0) return;
            ctx.beginPath();
            ctx.arc(cx, cy, r, a0, a1);
            if (anneau) ctx.arc(cx, cy, r0, a1, a0, true); else ctx.lineTo(cx, cy);
            ctx.closePath();
            peintForme(p.couleur);
            ctx.strokeStyle = g.fond; ctx.lineWidth = 2; ctx.stroke();
        });
        // les pourcentages (ou les valeurs) dans les parts assez grandes
        parts.forEach(p => {
            const a = p.a1 - p.a0;
            if (!(a > 0)) return;
            const t = g.o.values === true ? formatGraphique(p.v) : pourcent(p.v / total);
            const rm = anneau ? (r + r0) / 2 : r * 0.64;
            const mx = cx + Math.cos(p.a0 + a / 2) * rm, my = cy + Math.sin(p.a0 + a / 2) * rm;
            const lt = mesure(t, 12, true);
            if (a * rm > lt + 10 && (anneau ? r - r0 : r) > 22) écritGraphique(t, mx, my, { align: 'center', gras: true, couleur: ENCRE_SUR(p.couleur) });
            g.survols.push({ cx, cy, r0, r1: r, a0: p.a0, a1: p.a1,
                texte: p.nom + '\n' + formatGraphique(p.v, { compact: false }) + '  (' + pourcent(p.v / total) + ')' + (p.détail ? '\n' + p.détail.map(d => d.nom + ' : ' + formatGraphique(d.v, { compact: false })).join('\n') : '') });
        });
        if (anneau && r0 > 30) {
            écritGraphique(formatGraphique(total), cx, cy - 2, { align: 'center', base: 'bottom', taille: Math.min(28, r0 * 0.45), gras: true, couleur: ENCRE.titre });
            écritGraphique(T('Total'), cx, cy + 4, { align: 'center', base: 'top', couleur: ENCRE.discret });
        }
        // la légende, toujours là : le nom, et la valeur à droite
        if (g.o.legend !== false) {
            if (àDroite) {
                const lx = place.x + place.l - largeurLégende, haut = Math.max(place.y, cy - parts.length * 11);
                parts.forEach((p, j) => {
                    const ly = haut + j * 22 + 8;
                    rectangleArrondi(lx, ly - 5, 10, 10, [2, 2, 2, 2]); peintForme(p.couleur);
                    const valeur = formatGraphique(p.v);
                    écritGraphique(raccourci(p.nom, largeurLégende - 30 - mesure(valeur)), lx + 16, ly);
                    écritGraphique(valeur, lx + largeurLégende, ly, { align: 'right', couleur: ENCRE.discret });
                });
            } else {
                const colonnes = Math.max(1, Math.floor(place.l / 150)), lc = place.l / colonnes;
                parts.forEach((p, j) => {
                    const lx = place.x + (j % colonnes) * lc, ly = disque.y + disque.h + 12 + Math.floor(j / colonnes) * 18;
                    rectangleArrondi(lx, ly - 5, 10, 10, [2, 2, 2, 2]); peintForme(p.couleur);
                    écritGraphique(raccourci(p.nom, lc - 22), lx + 16, ly);
                });
            }
        }
        return '';
    }

    // ---- nuage de points et bulles : [x, y] ou [x, y, taille] ----
    function graphiqueNuage(g, valeurs) {
        const bulles = g.genre === 'bubble';
        const attendu = bulles ? 3 : 2;
        const estPoint = (p) => Array.isArray(p) && p.length >= 2 && !Array.isArray(p[0]);
        if (!Array.isArray(valeurs) || !valeurs.length) return T('graphique : il faut des points [x, y] (ou [x, y, taille] pour des bulles)');
        const séries = estPoint(valeurs[0]) ? [valeurs] : valeurs;
        for (const s of séries) {
            if (!Array.isArray(s)) return T('graphique : il faut des points [x, y] (ou [x, y, taille] pour des bulles)');
            for (const p of s) if (!estPoint(p) || p.length < attendu || p.slice(0, attendu).some(v => !estNombre(v)))
                return T('graphique : il faut des points [x, y] (ou [x, y, taille] pour des bulles), pas « {0} »', JSON.stringify(p));
        }
        if (séries.length > PALETTE_GRAPHIQUE.length) return T('graphique : {0} séries au plus (il y en a {1})', PALETTE_GRAPHIQUE.length, séries.length);
        const noms = nomsSéries(g, séries.length), couleurs = couleursSéries(g, séries.length);
        const tous = séries.flat();
        const xs = tous.map(p => p[0]), ys = tous.map(p => p[1]);
        // les bulles ont besoin d'air autour d'elles : l'échelle déborde un peu des données
        const marge = (v) => (bulles ? (Math.max(...v) - Math.min(...v) || 1) * 0.12 : 0);
        const éx = échelle(Math.min(...xs) - marge(xs), Math.max(...xs) + marge(xs));
        const éy = échelle(estNombre(g.o.min) ? g.o.min : Math.min(...ys) - marge(ys), estNombre(g.o.max) ? g.o.max : Math.max(...ys) + marge(ys));
        const place = cadreGraphique(g, noms.map((t, s) => ({ texte: t, couleur: couleurs[s] })));
        const titreX = g.o.x_axis ? String(g.o.x_axis) : '', titreY = g.o.y_axis ? String(g.o.y_axis) : '';
        const gauche = Math.max(...éy.graduations.map(v => mesure(étiquetteGraduation(v, éy)))) + 10 + (titreY ? 20 : 0);
        const zone = { x: place.x + gauche, y: place.y + 6, l: place.l - gauche - 12, h: place.h - 28 - (titreX ? 20 : 0) };
        const px = (v) => zone.x + (v - éx.min) / (éx.max - éx.min) * zone.l;
        const py = (v) => zone.y + zone.h - (v - éy.min) / (éy.max - éy.min) * zone.h;
        for (const v of éy.graduations) { trait(zone.x, py(v), zone.x + zone.l, py(v), ENCRE.grille); écritGraphique(étiquetteGraduation(v, éy), zone.x - 8, py(v), { couleur: ENCRE.discret, align: 'right' }); }
        for (const v of éx.graduations) { trait(px(v), zone.y, px(v), zone.y + zone.h, ENCRE.grille); écritGraphique(étiquetteGraduation(v, éx), px(v), zone.y + zone.h + 6, { couleur: ENCRE.discret, align: 'center', base: 'top' }); }
        trait(zone.x, zone.y + zone.h, zone.x + zone.l, zone.y + zone.h, ENCRE.axe);
        trait(zone.x, zone.y, zone.x, zone.y + zone.h, ENCRE.axe);
        if (titreY) écritGraphique(raccourci(titreY, zone.h), place.x + 6, zone.y + zone.h / 2, { align: 'center', angle: -Math.PI / 2 });
        if (titreX) écritGraphique(raccourci(titreX, zone.l), zone.x + zone.l / 2, place.y + place.h - 6, { align: 'center', base: 'bottom' });
        const tailleMax = bulles ? Math.max(...tous.map(p => Math.abs(p[2]))) || 1 : 1;
        const rayonMax = Math.max(8, Math.min(zone.l, zone.h) / 12);
        séries.forEach((s, k) => {
            // la droite de tendance (moindres carrés), en tirets
            if (g.o.trend === true && s.length >= 2) {
                const n = s.length, mx = s.reduce((t, p) => t + p[0], 0) / n, my = s.reduce((t, p) => t + p[1], 0) / n;
                const sxx = s.reduce((t, p) => t + (p[0] - mx) ** 2, 0);
                if (sxx > 0) {
                    const pente = s.reduce((t, p) => t + (p[0] - mx) * (p[1] - my), 0) / sxx, origine = my - pente * mx;
                    ctx.save(); ctx.beginPath(); ctx.rect(zone.x, zone.y, zone.l, zone.h); ctx.clip();
                    ctx.setLineDash([6, 4]);
                    trait(px(éx.min), py(origine + pente * éx.min), px(éx.max), py(origine + pente * éx.max), couleurs[k], 2);
                    ctx.restore();
                }
            }
            // les grosses bulles d'abord, pour que les petites restent visibles
            const ordre = bulles ? [...s].sort((a, b) => Math.abs(b[2]) - Math.abs(a[2])) : s;
            for (const p of ordre) {
                const x = px(p[0]), y = py(p[1]);
                const r = bulles ? Math.max(3, Math.sqrt(Math.abs(p[2]) / tailleMax) * rayonMax) : 4;
                if (bulles) {
                    ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI);
                    avecAlpha(couleurs[k], 0.55);
                    ctx.strokeStyle = couleurs[k]; ctx.lineWidth = 1.5; ctx.stroke();
                } else marqueur(x, y, couleurs[k], g.fond, r);
                g.survols.push({ cx: x, cy: y, r: Math.max(r, 4) + 6,
                    texte: (séries.length > 1 ? noms[k] + '\n' : '') + (titreX || 'x') + ' : ' + formatGraphique(p[0], { compact: false }) + '\n' + (titreY || 'y') + ' : ' + formatGraphique(p[1], { compact: false })
                        + (bulles ? '\n' + T('taille') + ' : ' + formatGraphique(p[2], { compact: false }) : '') });
            }
        });
        return '';
    }

    // ---- radar : une branche par catégorie ----
    function graphiqueRadar(g, valeurs) {
        const séries = sériesDe(valeurs);
        if (typeof séries === 'string') return séries;
        const n = Math.max(...séries.map(s => s.length));
        if (n < 3) return T('graphique : un radar a besoin d\'au moins trois valeurs (une par branche)');
        const noms = nomsSéries(g, séries.length), couleurs = couleursSéries(g, séries.length);
        const place = cadreGraphique(g, noms.map((t, s) => ({ texte: t, couleur: couleurs[s] })));
        const toutes = séries.flat().filter(estNombre);
        const é = échelle(Math.min(0, ...toutes), estNombre(g.o.max) ? g.o.max : Math.max(...toutes), 4);
        const étiq = Array.from({ length: n }, (_, i) => étiquette(g, i));
        const marge = Math.min(Math.max(...étiq.map(t => mesure(t))) + 12, place.l * 0.22);
        const r = Math.max(10, Math.min(place.l / 2 - marge, place.h / 2 - 18));
        const cx = place.x + place.l / 2, cy = place.y + place.h / 2;
        const angle = (i) => -Math.PI / 2 + i * 2 * Math.PI / n;
        const rayon = (v) => (v - é.min) / (é.max - é.min) * r;
        // la toile : un polygone par graduation, une branche par catégorie
        for (const v of é.graduations) {
            if (v === é.min) continue;
            ctx.beginPath();
            for (let i = 0; i < n; i++) { const x = cx + Math.cos(angle(i)) * rayon(v), y = cy + Math.sin(angle(i)) * rayon(v); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
            ctx.closePath(); ctx.strokeStyle = ENCRE.grille; ctx.lineWidth = 1; ctx.stroke();
            écritGraphique(étiquetteGraduation(v, é), cx + 5, cy - rayon(v), { couleur: ENCRE.discret, taille: 11 });
        }
        for (let i = 0; i < n; i++) {
            const x = cx + Math.cos(angle(i)) * r, y = cy + Math.sin(angle(i)) * r;
            trait(cx, cy, x, y, ENCRE.grille);
            const c = Math.cos(angle(i)), s = Math.sin(angle(i));
            écritGraphique(raccourci(étiq[i], marge - 8), cx + c * (r + 8), cy + s * (r + 10), { align: Math.abs(c) < 0.2 ? 'center' : c > 0 ? 'left' : 'right', base: Math.abs(s) < 0.2 ? 'middle' : s > 0 ? 'top' : 'bottom' });
        }
        séries.forEach((s, k) => {
            const pts = Array.from({ length: n }, (_, i) => { const v = estNombre(s[i]) ? s[i] : é.min; return [cx + Math.cos(angle(i)) * rayon(v), cy + Math.sin(angle(i)) * rayon(v), s[i]]; });
            ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
            avecAlpha(couleurs[k], 0.12);
            ctx.strokeStyle = couleurs[k]; ctx.lineWidth = 2; ctx.stroke();
            pts.forEach(([x, y, v], i) => {
                marqueur(x, y, couleurs[k], g.fond, 3.5);
                g.survols.push({ cx: x, cy: y, r: 10, texte: étiq[i] + '\n' + (séries.length > 1 ? noms[k] + ' : ' : '') + formatGraphique(v, { compact: false }) });
            });
        });
        return '';
    }

    // ---- boîte à moustaches : une boîte par liste de valeurs ----
    function quantile(triées, q) {
        const p = (triées.length - 1) * q, i = Math.floor(p);
        return i + 1 < triées.length ? triées[i] + (p - i) * (triées[i + 1] - triées[i]) : triées[i];
    }
    function graphiqueBoîte(g, valeurs) {
        const séries = sériesDe(valeurs, 100);
        if (typeof séries === 'string') return séries;
        const boîtes = séries.map((s, i) => {
            const t = s.filter(estNombre).sort((a, b) => a - b);
            if (!t.length) return null;
            const q1 = quantile(t, 0.25), méd = quantile(t, 0.5), q3 = quantile(t, 0.75), iqr = q3 - q1;
            const basM = t.find(v => v >= q1 - 1.5 * iqr), hautM = [...t].reverse().find(v => v <= q3 + 1.5 * iqr);
            return { i, t, q1, méd, q3, basM, hautM, moyenne: t.reduce((a, b) => a + b, 0) / t.length, isolées: t.filter(v => v < basM || v > hautM) };
        });
        const toutes = séries.flat().filter(estNombre);
        if (!toutes.length) return T('graphique : il faut une liste de nombres, ou une liste de listes de nombres (une par série)');
        const couleurs = couleursSéries(g, 1);
        const place = cadreGraphique(g, []);
        const a = axesCatégories(g, place, séries.length, Math.min(...toutes), Math.max(...toutes), false);
        const l = Math.min(a.caseT * 0.5, 48);
        boîtes.forEach(b => {
            if (!b) return;
            const x = a.centre(b.i), c = couleurs[0];
            trait(x, a.val(b.basM), x, a.val(b.q1), ENCRE.texte, 1.5);
            trait(x, a.val(b.q3), x, a.val(b.hautM), ENCRE.texte, 1.5);
            trait(x - l / 4, a.val(b.basM), x + l / 4, a.val(b.basM), ENCRE.texte, 1.5);
            trait(x - l / 4, a.val(b.hautM), x + l / 4, a.val(b.hautM), ENCRE.texte, 1.5);
            rectangleArrondi(x - l / 2, a.val(b.q3), l, Math.max(1, a.val(b.q1) - a.val(b.q3)), [4, 4, 4, 4]);
            avecAlpha(c, 0.18);
            ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.stroke();
            trait(x - l / 2, a.val(b.méd), x + l / 2, a.val(b.méd), c, 2.5);
            // la moyenne : une petite croix
            const ym = a.val(b.moyenne);
            trait(x - 4, ym - 4, x + 4, ym + 4, ENCRE.titre, 1.5); trait(x - 4, ym + 4, x + 4, ym - 4, ENCRE.titre, 1.5);
            for (const v of b.isolées) marqueur(x, a.val(v), c, g.fond, 3);
            const f = (v) => formatGraphique(v, { compact: false });
            g.survols.push({ x: x - a.caseT / 2, y: a.zone.y, l: a.caseT, h: a.zone.h,
                texte: a.noms[b.i] + '\n' + T('maximum') + ' : ' + f(b.t[b.t.length - 1]) + '\n' + T('3e quartile') + ' : ' + f(b.q3) + '\n' + T('médiane') + ' : ' + f(b.méd)
                    + '\n' + T('1er quartile') + ' : ' + f(b.q1) + '\n' + T('minimum') + ' : ' + f(b.t[0]) + '\n' + T('moyenne') + ' : ' + f(b.moyenne) });
        });
        return '';
    }

    // ---- entonnoir : des barres centrées, de la plus large à la plus étroite ----
    function graphiqueEntonnoir(g, valeurs) {
        const séries = sériesDe(valeurs, 1);
        if (typeof séries === 'string') return séries;
        const v = séries[0].map(x => (estNombre(x) ? Math.max(0, x) : 0));
        const place = cadreGraphique(g, []);
        const noms = v.map((_, i) => étiquette(g, i));
        const gauche = Math.min(Math.max(...noms.map(t => mesure(t))) + 12, place.l * 0.3);
        const zone = { x: place.x + gauche, y: place.y, l: place.l - gauche, h: place.h };
        const maxV = Math.max(...v) || 1, caseT = zone.h / v.length, épaisseur = Math.max(4, caseT - 4);
        const couleur = Array.isArray(g.o.colors) || typeof g.o.colors === 'string' ? couleursSéries(g, 1)[0] : PALETTE_GRAPHIQUE[0];
        v.forEach((x, i) => {
            const l = Math.max(2, x / maxV * zone.l), cy = zone.y + (i + 0.5) * caseT;
            rectangleArrondi(zone.x + (zone.l - l) / 2, cy - épaisseur / 2, l, épaisseur, [4, 4, 4, 4]);
            peintForme(couleur);
            écritGraphique(raccourci(noms[i], gauche - 12), zone.x - 12, cy, { align: 'right' });
            const t = formatGraphique(x) + (i ? '  (' + pourcent(x / (v[0] || 1)) + ')' : '');
            if (g.o.values !== false) {
                if (mesure(t, 12, true) + 12 < l) écritGraphique(t, zone.x + zone.l / 2, cy, { align: 'center', gras: true, couleur: ENCRE_SUR(couleur) });
                else écritGraphique(t, zone.x + (zone.l + l) / 2 + 6, cy, { gras: true });
            }
            g.survols.push({ x: zone.x, y: cy - caseT / 2, l: zone.l, h: caseT, texte: noms[i] + '\n' + formatGraphique(x, { compact: false }) + (i ? '\n' + T('par rapport au début') + ' : ' + pourcent(x / (v[0] || 1)) : '') });
        });
        return '';
    }

    // ---- mosaïque : des rectangles dont l'aire suit la valeur (disposition « squarified ») ----
    function graphiqueMosaïque(g, valeurs) {
        const séries = sériesDe(valeurs, 1);
        if (typeof séries === 'string') return séries;
        const éléments = séries[0].map((v, i) => ({ v: estNombre(v) ? v : 0, nom: étiquette(g, i), i })).filter(e => e.v > 0).sort((a, b) => b.v - a.v);
        if (!éléments.length) return T('graphique : une mosaïque a besoin de nombres plus grands que 0');
        const place = cadreGraphique(g, []);
        const total = éléments.reduce((s, e) => s + e.v, 0);
        const échelleAire = place.l * place.h / total;
        let reste = { x: place.x, y: place.y, l: place.l, h: place.h };
        let file = éléments.slice();
        const pire = (rangée, côté) => {
            const s = rangée.reduce((t, e) => t + e.v * échelleAire, 0), max = Math.max(...rangée.map(e => e.v * échelleAire)), min = Math.min(...rangée.map(e => e.v * échelleAire));
            return Math.max(côté * côté * max / (s * s), (s * s) / (côté * côté * min));
        };
        while (file.length) {
            const côté = Math.min(reste.l, reste.h);
            let rangée = [file[0]], k = 1;
            while (k < file.length && pire([...rangée, file[k]], côté) <= pire(rangée, côté)) rangée.push(file[k++]);
            file = file.slice(k);
            const aire = rangée.reduce((t, e) => t + e.v * échelleAire, 0);
            if (reste.l >= reste.h) {
                const l = aire / reste.h; let y = reste.y;
                for (const e of rangée) { const h = e.v * échelleAire / l; e.r = { x: reste.x, y, l, h }; y += h; }
                reste = { x: reste.x + l, y: reste.y, l: reste.l - l, h: reste.h };
            } else {
                const h = aire / reste.l; let x = reste.x;
                for (const e of rangée) { const l = e.v * échelleAire / h; e.r = { x, y: reste.y, l, h }; x += l; }
                reste = { x: reste.x, y: reste.y + h, l: reste.l, h: reste.h - h };
            }
        }
        const données = Array.isArray(g.o.colors) ? g.o.colors.map(couleurCSS) : null;
        éléments.forEach((e, rang) => {
            const { x, y, l, h } = e.r;
            const couleur = données ? données[e.i % données.length] : RAMPE_BLEUE[Math.min(RAMPE_BLEUE.length - 1, Math.floor(rang * RAMPE_BLEUE.length / éléments.length))];
            // 2 points de fond entre deux rectangles
            rectangleArrondi(x + 1, y + 1, Math.max(0, l - 2), Math.max(0, h - 2), [4, 4, 4, 4]);
            peintForme(couleur);
            const encre = données ? ENCRE_SUR(couleur) : '#ffffff';
            if (l > 40 && h > 22) {
                const nom = raccourci(e.nom, l - 14, 13, true);
                if (nom) écritGraphique(nom, x + 7, y + 7, { base: 'top', taille: 13, gras: true, couleur: encre });
                if (h > 42) écritGraphique(raccourci(formatGraphique(e.v), l - 14), x + 7, y + 25, { base: 'top', couleur: encre });
            }
            g.survols.push({ x, y, l, h, texte: e.nom + '\n' + formatGraphique(e.v, { compact: false }) + '  (' + pourcent(e.v / total) + ')' });
        });
        return '';
    }

    return {
        COULEURS,

        // Appelé une fois par l'application
        installe(élémentCanevas, élémentCouche, fonctionRappel) {
            canevas = élémentCanevas;
            couche = élémentCouche;
            ctx = canevas.getContext('2d');
            ctxTortue = couche.getContext('2d');
            rappel = fonctionRappel;
            if (scène3D()) scène3D().installe({
                cadre: canevas.parentElement, élémentÉvénements: couche, couleurCSS,
                image: (n) => (images[n] ? images[n].img : null),
                largeur: () => LARGEUR, hauteur: () => HAUTEUR,
                erreur: (m) => signaleErreur(m)
            });
            installeÉvénements();
            // Le son suspendu ou interrompu (voir réveilleAudio) : un clic ou une touche, n'importe où,
            // le réveille, comme le retour sur la page
            ['pointerdown', 'keydown', 'touchend'].forEach(type => window.addEventListener(type, réveilleAudio, { capture: true }));
            document.addEventListener('visibilitychange', () => { if (!document.hidden) réveilleAudio(); });
            window.addEventListener('pageshow', réveilleAudio);
            this.réinitialise();
        },

        // Avant chaque exécution : on arrête tout et on repart d'une page blanche
        réinitialise() {
            retireChamps();
            relâcheTout(false);
            largeurChamp = LARGEUR_CHAMP;
            formats.portrait = formats.paysage = null;
            dimensionne(LARGEUR_DÉFAUT, HAUTEUR_DÉFAUT);
            this.arrête();
            this.arrêteSons();
            gestionnaires = { clic: null, souris: null, glisse: null, touche: null, relâche: null, clicObjet: null };
            if (scène3D()) scène3D().réinitialise();
            mode3D = false;
            images = [];
            sons = [];
            dessins = new Map();
            état = étatInitial();
            tortue = tortueInitiale();
            this.efface();
            prévoitTortue();
        },

        // ---------- Console ----------
        // affiche_console() / cache_console() : voir pythonerie.js (ou appli.js)
        afficheConsole() { if (window.Pythonerie && window.Pythonerie.afficheConsole) window.Pythonerie.afficheConsole(); },
        cacheConsole() { if (window.Pythonerie && window.Pythonerie.cacheConsole) window.Pythonerie.cacheConsole(); },
        effaceConsole() {
            if (window.Pythonerie) window.Pythonerie.effaceConsole();
        },
        // écris() : texte sans retour à la ligne
        écris(texte) {
            if (window.Pythonerie) window.Pythonerie.écrisPartiel(String(texte));
        },
        // demande, lire, lit_fichier : genre "fenêtre", "console" ou "fichier" ; id : le numéro sous
        // lequel bibliothèque.lisp a rangé la fonction de rappel (voir prochaineAttente)
        attends(genre, question, id) {
            attentes.push({ genre: String(genre), question: String(question), id: Math.trunc(nombre(id)) });
            if (!attenteEnCours) prochaineAttente();
            return true;
        },
        // login() : le nom sous lequel l'élève travaille (« Unique » en mode utilisateur unique ;
        // "" s'il n'a pas encore dit qui il est, ou dans une application Web)
        login() { const P = window.Pythonerie; return (P && P.élève ? P.élève() : '') || ''; },
        // sauve_dans_serveur, liste_dans_serveur, lit_dans_serveur (voir échange)
        réseau(genre, p1, p2, p3, id) {
            échange(String(genre), String(p1), String(p2), String(p3), Math.trunc(nombre(id)));
            return true;
        },
        // la réponse (ou le contenu du fichier) que (_réponse_lue numéro) vient chercher
        valeurReçue() { return valeurReçue; },
        aléatoire(a, b) {
            a = Math.ceil(nombre(a)); b = Math.floor(nombre(b));
            if (b < a) [a, b] = [b, a];
            return Math.floor(aléa() * (b - a + 1)) + a;
        },
        hasard() { return aléa(); },
        graine(g) { étatHasard = g >>> 0; },

        // ---------- Styles ----------
        efface() {
            génération++;
            oublieGraphiques();
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, LARGEUR, HAUTEUR);
            // en 3D, le canevas 2D reste transparent : on voit la scène au travers
            if (!mode3D) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, LARGEUR, HAUTEUR);
            }
            ctx.restore();
        },
        fond(c) {
            génération++;
            oublieGraphiques();
            // en 3D, fond() colore le fond de la scène, et la 2D redevient transparente
            if (mode3D) {
                scène3D().fond(c);
                ctx.save();
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.clearRect(0, 0, LARGEUR, HAUTEUR);
                ctx.restore();
                return;
            }
            ctx.save();
            ctx.fillStyle = couleurCSS(c);
            ctx.fillRect(0, 0, LARGEUR, HAUTEUR);
            ctx.restore();
        },
        couleur(c) { état.trait = état.remplissage = couleurCSS(c); },
        couleurTrait(c) { état.trait = couleurCSS(c); },
        couleurRemplissage(c) { état.remplissage = couleurCSS(c); },
        épaisseur(e) { état.épaisseur = Math.max(0.1, nombre(e, 1)); },

        // ---------- Formes ----------
        point(x, y) {
            appliqueStyle();
            const r = Math.max(1, état.épaisseur / 2);
            ctx.beginPath();
            ctx.arc(nombre(x), nombre(y), r, 0, 2 * Math.PI);
            ctx.fillStyle = état.trait;
            ctx.fill();
        },
        ligne(x1, y1, x2, y2) {
            appliqueStyle();
            ctx.beginPath();
            ctx.moveTo(nombre(x1), nombre(y1));
            ctx.lineTo(nombre(x2), nombre(y2));
            ctx.stroke();
        },
        rectangle(x, y, l, h, plein) {
            appliqueStyle();
            ctx.beginPath();
            ctx.rect(nombre(x), nombre(y), nombre(l), nombre(h));
            traceForme(plein);
        },
        cercle(x, y, r, plein) {
            appliqueStyle();
            ctx.beginPath();
            ctx.arc(nombre(x), nombre(y), Math.abs(nombre(r)), 0, 2 * Math.PI);
            traceForme(plein);
        },
        ellipse(x, y, rx, ry, plein) {
            appliqueStyle();
            ctx.beginPath();
            ctx.ellipse(nombre(x), nombre(y), Math.abs(nombre(rx)), Math.abs(nombre(ry)), 0, 0, 2 * Math.PI);
            traceForme(plein);
        },
        polygone(points, plein) {
            if (typeof points === 'string') {
                try { points = JSON.parse(points); } catch (e) { return; }
            }
            if (!Array.isArray(points) || points.length < 2) return;
            appliqueStyle();
            ctx.beginPath();
            points.forEach((p, i) => {
                const x = nombre(p[0]), y = nombre(p[1]);
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.closePath();
            traceForme(plein);
        },

        // ---------- Pixels (voir lisPixels) ----------
        couleurPixel(x, y) { return lisPixels('couleur_pixel', nombre(x), nombre(y), 1, 1); },
        pixels(x, y, l, h) { return lisPixels('pixels', nombre(x), nombre(y), nombre(l), nombre(h)); },
        // pose_pixels : les valeurs arrivent en JSON ; Uint8ClampedArray arrondit et ramène
        // chaque valeur entre 0 et 255 (une moyenne comme 127.5 devient 128)
        posePixels(x, y, l, h, valeurs) {
            dernièreErreur = '';
            l = Math.round(nombre(l)); h = Math.round(nombre(h));
            if (!(l > 0 && h > 0)) {
                dernièreErreur = 'pose_pixels : la largeur et la hauteur doivent être plus grandes que 0';
                return;
            }
            const v = lisJSON(valeurs, []);
            const attendu = l * h * 4;
            if (!Array.isArray(v) || v.length !== attendu) {
                dernièreErreur = 'pose_pixels : il faut ' + attendu + ' valeurs (' + l + ' × ' + h + ' points, 4 valeurs par point), la liste en a ' + (Array.isArray(v) ? v.length : 0);
                return;
            }
            ctx.putImageData(new ImageData(Uint8ClampedArray.from(v, n => Number(n)), l, h), Math.round(nombre(x)), Math.round(nombre(y)));
        },

        // ---------- Texte ----------
        texte(x, y, message) {
            appliqueStyle();
            ctx.fillStyle = état.remplissage;
            String(message).split('\n').forEach((l, i) => {
                ctx.fillText(l, nombre(x), nombre(y) + i * état.taille * 1.2);
            });
        },
        // largeur_texte(message) : la largeur, en points du canevas, qu'aurait message écrit par
        // texte() avec la police et la taille du moment (la plus longue ligne, s'il y en a plusieurs)
        largeurTexte(message) {
            appliqueStyle();
            return Math.max(...String(message).split('\n').map(l => ctx.measureText(l).width));
        },
        // hauteur_texte(message) : du haut de la plus haute lettre au bas de la plus basse ; sur
        // plusieurs lignes, du haut de la première au bas de la dernière
        hauteurTexte(message) {
            appliqueStyle();
            const lignes = String(message).split('\n');
            const premier = ctx.measureText(lignes[0]), dernier = ctx.measureText(lignes[lignes.length - 1]);
            if (lignes.length === 1 && !lignes[0]) return 0;
            return Math.max(0, premier.actualBoundingBoxAscent + dernier.actualBoundingBoxDescent + (lignes.length - 1) * état.taille * 1.2);
        },
        tailleTexte(n) { état.taille = Math.max(4, nombre(n, 20)); },
        police(nom) { état.police = String(nom || 'Inter, sans-serif'); },

        // canevas(largeur, hauteur) : change la taille du canevas (le dessin est effacé et
        // la tortue revient au centre). À chaque exécution, il reprend sa taille de 800 x 600.
        // portrait(largeur, hauteur) est le même appel (nom : le nom de l'instruction, pour l'erreur)
        canevas(l, h, nom) {
            dernièreErreur = '';
            const f = taille(l, h, nom);
            if (!f) return;
            formats.portrait = f;
            appliqueFormat(formatVoulu() === f);
        },
        // paysage(largeur, hauteur) : la taille du canevas quand l'écran est en largeur
        paysage(l, h, nom) {
            dernièreErreur = '';
            const f = taille(l, h, nom || 'paysage');
            if (!f) return;
            formats.paysage = f;
            appliqueFormat(formatVoulu() === f);
        },
        largeur() { return LARGEUR; },
        hauteur() { return HAUTEUR; },
        // appareil() : sur quoi tourne le programme, pour l'adapter. Le genre d'appareil, puis la
        // largeur et la hauteur de l'écran (en points CSS), dans le sens où on le tient :
        // ["ordinateur", 1440, 900], ["tablette", 1180, 820], ["téléphone", 390, 844].
        // Le navigateur dit souvent ce qu'il est (iPhone, Android « Mobile », iPad) ; un iPad récent
        // se dit Mac, mais il est tactile ; sinon, un doigt (pointer: coarse) plutôt qu'une souris
        // fait une tablette ou un téléphone, selon la taille de l'écran. Un ordinateur portable à
        // écran tactile garde la souris ou le pavé comme pointeur principal : il reste un ordinateur.
        appareil() {
            const ua = navigator.userAgent || '';
            const tactile = (navigator.maxTouchPoints || 0) > 0;
            const doigt = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
            const petit = Math.min(screen.width, screen.height), grand = Math.max(screen.width, screen.height);
            let genre;
            if (/iPhone|iPod|Windows Phone|Android.*Mobile|Mobile.*Firefox/i.test(ua)) genre = 'téléphone';
            else if (/iPad|Android|Tablet|Silk|Kindle/i.test(ua) || (/Macintosh/.test(ua) && tactile)) genre = 'tablette';
            else if (tactile && doigt) genre = petit < 600 ? 'téléphone' : 'tablette';
            else genre = 'ordinateur';
            // l'écran d'un iPhone ou d'un iPad ne tourne pas avec l'appareil (screen.width reste
            // la largeur en portrait) : on suit l'orientation
            const paysage = !!(window.matchMedia && window.matchMedia('(orientation: landscape)').matches);
            return [genre, paysage ? grand : petit, paysage ? petit : grand];
        },

        // ---------- Tortue ----------
        avance(d) {
            d = nombre(d);
            const a = tortue.cap * Math.PI / 180;
            const nx = tortue.x + d * Math.cos(a);
            const ny = tortue.y + d * Math.sin(a);
            if (tortue.crayon) this.ligne(tortue.x, tortue.y, nx, ny);
            tortue.x = nx;
            tortue.y = ny;
            utiliseTortue();
        },
        // angle positif : on tourne dans le sens des aiguilles d'une montre (vers la droite)
        tourne(a) {
            tortue.cap = (tortue.cap + nombre(a)) % 360;
            utiliseTortue();
        },
        crayon(baisse) { tortue.crayon = !!baisse; },
        vaÀ(x, y) {
            x = nombre(x); y = nombre(y);
            if (tortue.crayon) this.ligne(tortue.x, tortue.y, x, y);
            tortue.x = x;
            tortue.y = y;
            utiliseTortue();
        },
        oriente(a) { tortue.cap = nombre(a) % 360; utiliseTortue(); },
        origine() {
            const { crayon, cachée } = tortue;
            tortue = tortueInitiale();
            tortue.crayon = crayon;
            tortue.cachée = cachée;
            utiliseTortue();
        },
        montreTortue(v) { tortue.visible = !!v; tortue.cachée = !v; prévoitTortue(); },
        tortueX() { return tortue.x; },
        tortueY() { return tortue.y; },
        tortueCap() { return tortue.cap; },
        // La scène en plein écran (pythonerie.js, appli.js) : voir retientGlissés plus haut
        retientGlissés(élément, actif) { retientGlissés(élément, actif); },

        // ---------- Dessins : voir nouveau_dessin et montre_dessin (bibliothèque.lisp) ----------
        // Les commandes d'un dessin arrivent en deux listes : nombres (un Float64Array : chaque
        // commande est un code suivi de ses nombres) et textes (couleurs, messages, polices, dans
        // l'ordre des commandes). Le dessin est gardé sous son numéro : redessine le rejoue sans
        // qu'il soit renvoyé. Chaque commande passe par la méthode du dessin immédiat.
        montreDessin(numéro, nombres, textes, zone) {
            dessins.set(numéro, { nombres, textes: Array.isArray(textes) ? textes : [] });
            this.redessine(numéro, zone);
        },
        // zone : la clef d'une zone_défilante, où le dessin est rejoué (sur sa surface, à sa taille)
        // graphique(genre, valeurs, étiquettes, options) : un seul texte JSON (voir dessineGraphique)
        graphique(texte) {
            dernièreErreur = dessineGraphique(texte);
        },
        redessine(numéro, zone) {
            dernièreErreur = '';
            const d = dessins.get(numéro);
            if (!d) return;
            if (zone !== undefined && zone !== null && String(zone) !== '') {
                const z = champs.get(String(zone).normalize('NFC'));
                if (!z || z.genre !== 'défilante') { dernièreErreur = 'montre_dessin : il n\'y a pas de zone_défilante « ' + zone + ' »'; return; }
                const sauvé = { ctx, LARGEUR, HAUTEUR, mode3D };
                ctx = z.ctx; LARGEUR = z.largeur; HAUTEUR = z.hauteur; mode3D = false;
                try {
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    ctx.clearRect(0, 0, LARGEUR, HAUTEUR);
                    this.redessine(numéro);
                } finally { ({ ctx, LARGEUR, HAUTEUR, mode3D } = sauvé); }
                return;
            }
            const n = d.nombres, t = d.textes;
            let i = 0, k = 0;
            while (i < n.length) {
                switch (n[i++]) {
                    case 1: this.efface(); break;
                    case 2: this.fond(t[k++]); break;
                    case 3: this.couleur(t[k++]); break;
                    case 4: this.couleurTrait(t[k++]); break;
                    case 5: this.couleurRemplissage(t[k++]); break;
                    case 6: this.épaisseur(n[i++]); break;
                    case 7: this.point(n[i], n[i + 1]); i += 2; break;
                    case 8: this.ligne(n[i], n[i + 1], n[i + 2], n[i + 3]); i += 4; break;
                    case 9: this.rectangle(n[i], n[i + 1], n[i + 2], n[i + 3], n[i + 4] === 1); i += 5; break;
                    case 10: this.cercle(n[i], n[i + 1], n[i + 2], n[i + 3] === 1); i += 4; break;
                    case 11: this.ellipse(n[i], n[i + 1], n[i + 2], n[i + 3], n[i + 4] === 1); i += 5; break;
                    case 12: {
                        // le nombre de points, leurs coordonnées, puis plein (1) ou non (0)
                        const nb = n[i++], points = [];
                        for (let p = 0; p < nb; p++, i += 2) points.push([n[i], n[i + 1]]);
                        this.polygone(points, n[i++] === 1);
                        break;
                    }
                    case 13: this.texte(n[i], n[i + 1], t[k++]); i += 2; break;
                    case 14: this.tailleTexte(n[i++]); break;
                    case 15: this.police(t[k++]); break;
                    case 16: this.avance(n[i++]); break;
                    case 17: this.tourne(n[i++]); break;
                    case 18: this.crayon(n[i++] === 1); break;
                    case 19: this.vaÀ(n[i], n[i + 1]); i += 2; break;
                    case 20: this.oriente(n[i++]); break;
                    case 21: this.origine(); break;
                    case 22: this.montreTortue(n[i++] === 1); break;
                    // une image inconnue arrête le dessin : son erreur remonte au programme
                    case 23: this.placeImage(n[i], n[i + 1], n[i + 2]); i += 3; if (dernièreErreur) return; break;
                    case 24: this.placeImage(n[i], n[i + 1], n[i + 2], n[i + 3]); i += 4; if (dernièreErreur) return; break;
                    case 25: this.placeImage(n[i], n[i + 1], n[i + 2], n[i + 3], n[i + 4]); i += 5; if (dernièreErreur) return; break;
                    // un graphique : son texte JSON ; une erreur arrête le dessin
                    case 26: this.graphique(t[k++]); if (dernièreErreur) return; break;
                    default: dernièreErreur = 'montre_dessin : commande inconnue ' + n[i - 1]; return;
                }
            }
        },

        // ---------- Animation et événements ----------
        animer(nom, délai) {
            const ms = Math.max(10, nombre(délai, 50));
            const id = setInterval(() => appelle(nom, []), ms);
            minuteries.push(id);
            if (window.Pythonerie) window.Pythonerie.signaleAnimation(true);
        },
        // appel_dans(f, délai) : f() toutes les délai millisecondes, au rythme d'une horloge
        appelDans(nom, délai) {
            const id = setInterval(() => appelle(nom, []), Math.max(10, nombre(délai, 1000)));
            minuteries.push(id);
            if (window.Pythonerie) window.Pythonerie.signaleAnimation(true);
        },
        // heure() : [heures, minutes, secondes, millisecondes], l'heure de l'appareil
        heure() {
            const d = new Date();
            return [d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds()];
        },
        // tri_localisé(liste, langue) : les textes dans l'ordre du dictionnaire (du français, par défaut)
        triLocalisé(texte, locale) {
            const liste = JSON.parse(String(texte)).map(x => String(x));
            let ordre;
            try { ordre = new Intl.Collator(String(locale || '').trim() || 'fr'); }
            catch (e) { ordre = new Intl.Collator('fr'); }
            return liste.sort(ordre.compare);
        },
        quandClic(nom) { gestionnaires.clic = nom; },
        quandClicObjet(nom) { gestionnaires.clicObjet = nom; },

        // ---------- La 3D (voir scene3d.js et les primitives de bibliothèque.lisp) ----------
        // montre_3d(scène) : la scène, décrite en JSON par la bibliothèque, devient visible
        montre3D(texteJSON) {
            dernièreErreur = '';
            if (!scène3D()) { dernièreErreur = 'la 3D n\'est pas disponible ici'; return; }
            mode3D = true;
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, LARGEUR, HAUTEUR);
            ctx.restore();
            scène3D().montre(String(texteJSON));
        },
        // une primitive appelée après montre_3d : parent est le numéro de sa scène ou de son groupe
        ajoute3D(parent, texteJSON) { if (scène3D()) scène3D().ajoute(Math.trunc(nombre(parent)), String(texteJSON)); },
        // déplace, tourne, oriente, colore, texture, cache, montre, regarde
        change3D(genre, numéro, a, b, c) { if (scène3D()) scène3D().change(String(genre), Math.trunc(nombre(numéro)), a, b, c); },
        caméraLibre() { if (scène3D()) scène3D().caméraLibre(); },
        quandSouris(nom) { gestionnaires.souris = nom; },
        quandGlisse(nom) { gestionnaires.glisse = nom; },
        quandTouche(nom) { gestionnaires.touche = nom; },
        // quand_relâche(f) : f(touche) au relâchement, avec le nom reçu à l'appui
        quandRelâche(nom) { gestionnaires.relâche = nom; },
        // touche_enfoncée(nom) : 1 si la touche est tenue, 0 sinon
        toucheEnfoncée(nom) {
            nom = String(nom).normalize('NFC');
            for (const n of enfoncées.values()) if (n === nom) return 1;
            return 0;
        },
        // à la sortie du plein écran (voir pythonerie.js)
        relâcheTouches() { relâcheTout(true); },
        arrête() {
            minuteries.forEach(clearInterval);
            minuteries = [];
            if (window.Pythonerie) window.Pythonerie.signaleAnimation(false);
        },
        enCours() {
            return minuteries.length > 0 || champs.size > 0 || attenteEnCours !== null || attentes.length > 0 || échangesEnCours > 0
                || !!(gestionnaires.clic || gestionnaires.souris || gestionnaires.glisse || gestionnaires.touche || gestionnaires.relâche || gestionnaires.clicObjet);
        },
        stoppeTout(gardeSons) {
            oublieAttentes();
            retireChamps();
            relâcheTout(false);
            this.arrête();
            if (!gardeSons) this.arrêteSons();
            gestionnaires = { clic: null, souris: null, glisse: null, touche: null, relâche: null, clicObjet: null };
        },

        // retire_objet(clef) : enlève un objet du canevas (rien s'il n'existe pas) ;
        // retire_objets() les enlève tous
        retireObjet(clef) {
            const o = champs.get(String(clef).normalize('NFC'));
            if (o) { o.élément.remove(); champs.delete(o.clef); }
        },
        retireObjets() { retireChamps(); },

        // ---------- Champs de saisie ----------
        // saisie(clef, x, y, fonction) : crée le champ « clef », ou le déplace s'il existe déjà
        saisie(clef, x, y, nom) {
            clef = String(clef).normalize('NFC');
            const o = objetDe(clef, 'saisie', () => {
                const e = document.createElement('input');
                e.type = 'text';
                e.className = 'saisie-canevas objet-canevas';
                e.spellcheck = false;
                e.autocomplete = 'off';
                e.setAttribute('aria-label', clef);
                e.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Enter') { ev.preventDefault(); envoieChamp(clef, true); }
                    transmetTouche(ev);
                });
                // on quitte ce champ pour un autre champ de saisie
                e.addEventListener('blur', (ev) => {
                    const vers = ev.relatedTarget;
                    if (vers && vers.classList && vers.classList.contains('saisie-canevas')) envoieChamp(clef, false);
                });
                return e;
            });
            poseObjet(o, nom, x, y, largeurChamp);
        },

        // bouton(clef, x, y, texte, f) : un clic appelle f(clef, texte) ; comme pour les autres
        // objets, la fonction reçoit toujours deux valeurs
        bouton(clef, x, y, texte, nom) {
            clef = String(clef).normalize('NFC');
            const o = objetDe(clef, 'bouton', (o) => {
                const e = document.createElement('button');
                e.type = 'button';
                e.className = 'objet-canevas bouton-canevas';
                // le bouton rend le focus : la barre d'espace d'un jeu ne le recliquera pas
                réagitAuClic(e, () => { e.blur(); appelleBientôt(o.fonction, [chaîneLispE(o.clef), chaîneLispE(e.textContent)]); });
                return e;
            });
            o.élément.textContent = String(texte).normalize('NFC');
            poseObjet(o, nom, x, y, null);
        },

        // bouton_image(clef, x, y, image, image_appuyée, f) : un bouton qui a l'aspect d'une image
        // (numéro rendu par charge_image ou capture_image), à sa taille ; image_appuyée (ou null) est
        // montrée tant qu'on appuie, sinon le bouton s'enfonce un peu. Un clic appelle f(clef, image).
        // Une image transparente (png, svg) donne un bouton de n'importe quelle forme.
        boutonImage(clef, x, y, numéro, appuyée, nom) {
            dernièreErreur = '';
            clef = String(clef).normalize('NFC');
            const inconnue = (n) => { dernièreErreur = 'bouton_image : image inconnue : ' + n + ' (utilise le numéro renvoyé par charge_image ou capture_image)'; };
            const normale = images[numéro];
            if (!normale) { inconnue(numéro); return; }
            const enfoncée = (appuyée === null || appuyée === undefined) ? null : images[appuyée];
            if (appuyée !== null && appuyée !== undefined && !enfoncée) { inconnue(appuyée); return; }
            const o = objetDe(clef, 'bouton_image', (o) => {
                const e = document.createElement('button');
                e.type = 'button';
                e.className = 'objet-canevas bouton-image-canevas';
                const img = document.createElement('img');
                img.alt = '';
                img.draggable = false;
                e.appendChild(img);
                o.montre = (bas) => {
                    img.src = (bas && o.appuyée ? o.appuyée : o.normale).img.src;
                    e.classList.toggle('enfoncé', bas && !o.appuyée);
                };
                e.addEventListener('pointerdown', () => o.montre(true));
                ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => e.addEventListener(t, () => o.montre(false)));
                // le bouton rend le focus : la barre d'espace d'un jeu ne le recliquera pas
                réagitAuClic(e, () => { e.blur(); appelleBientôt(o.fonction, [chaîneLispE(o.clef), o.numéro]); });
                return e;
            });
            o.normale = normale;
            o.appuyée = enfoncée;
            o.numéro = numéro;
            o.montre(false);
            poseObjet(o, nom, x, y, null);
            // la largeur de l'image, en points du canevas : le bouton suit ensuite l'échelle du canevas
            const àLaTaille = () => { o.l = normale.img.naturalWidth || normale.img.width; placeChamp(o); };
            if (normale.img.complete && normale.img.naturalWidth) àLaTaille();
            else normale.img.addEventListener('load', àLaTaille, { once: true });
        },

        // case_à_cocher(clef, x, y, texte, f) : f(clef, Vrai ou Faux) à chaque changement
        caseÀCocher(clef, x, y, texte, nom) {
            clef = String(clef).normalize('NFC');
            const o = objetDe(clef, 'case', (o) => fabriqueCoche(o, 'checkbox', () =>
                appelleBientôt(o.fonction, [chaîneLispE(o.clef), o.entrée.checked ? 'true' : 'false'])));
            o.texte.textContent = String(texte).normalize('NFC');
            o.élément.style.color = état.remplissage;
            poseObjet(o, nom, x, y, null);
        },

        // bouton_radio(clef, groupe, x, y, texte, f) : un seul bouton coché par groupe ;
        // choisir un bouton appelle f(groupe, clef)
        boutonRadio(clef, groupe, x, y, texte, nom) {
            clef = String(clef).normalize('NFC');
            groupe = String(groupe).normalize('NFC');
            const o = objetDe(clef, 'radio', (o) => fabriqueCoche(o, 'radio', () =>
                appelleBientôt(o.fonction, [chaîneLispE(o.groupe), chaîneLispE(o.clef)])));
            o.groupe = groupe;
            o.entrée.name = 'pythonerie-radio-' + groupe;
            o.texte.textContent = String(texte).normalize('NFC');
            o.élément.style.color = état.remplissage;
            poseObjet(o, nom, x, y, null);
        },

        // glissière(clef, x, y, mini, maxi, valeur, f) : f(clef, valeur) pendant qu'on la déplace ;
        // entre deux entiers, elle avance d'un en un, sinon par centièmes de l'intervalle
        glissière(clef, x, y, mini, maxi, valeur, nom) {
            clef = String(clef).normalize('NFC');
            const o = objetDe(clef, 'glissière', (o) => {
                const e = document.createElement('input');
                e.type = 'range';
                e.className = 'objet-canevas glissière-canevas';
                e.setAttribute('aria-label', clef);
                e.addEventListener('input', () => appelleBientôt(o.fonction, [chaîneLispE(o.clef), String(valeurGlissière(o))]));
                return e;
            });
            const a = nombre(mini, 0), b = nombre(maxi, 100), v = nombre(valeur, a);
            // entière si les bornes et la valeur de départ sont entières : glissière(…, 0, 1, 0.5, …) ne l'est pas
            o.entiers = Number.isInteger(a) && Number.isInteger(b) && Number.isInteger(v);
            o.élément.min = a;
            o.élément.max = b;
            o.élément.step = o.entiers ? 1 : (b - a) / 100;
            o.élément.value = v;
            poseObjet(o, nom, x, y, largeurChamp);
        },

        // zone_édition(clef, x, y, lignes, f) : un texte sur plusieurs lignes (Entrée passe
        // à la ligne) ; f(clef, texte) quand on quitte la zone, ou avec Ctrl+Entrée
        zoneÉdition(clef, x, y, lignes, nom) {
            clef = String(clef).normalize('NFC');
            const o = objetDe(clef, 'zone', () => {
                const e = document.createElement('textarea');
                e.className = 'saisie-canevas objet-canevas édition-canevas';
                e.spellcheck = false;
                e.setAttribute('aria-label', clef);
                e.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); envoieChamp(clef, true); }
                });
                e.addEventListener('blur', () => envoieChamp(clef, false));
                return e;
            });
            o.élément.rows = Math.max(1, Math.round(nombre(lignes, 4)));
            poseObjet(o, nom, x, y, largeurChamp);
        },

        // liste_déroulante(clef, x, y, éléments, f) : f(clef, choix) quand on choisit un élément
        // (les éléments arrivent en JSON : une liste de LispE imbriquée ne passe pas telle quelle)
        listeDéroulante(clef, x, y, éléments, nom) {
            clef = String(clef).normalize('NFC');
            const o = objetDe(clef, 'déroulante', (o) => {
                const e = document.createElement('select');
                e.className = 'objet-canevas déroulante-canevas';
                e.setAttribute('aria-label', clef);
                e.addEventListener('change', () => { e.blur(); appelleBientôt(o.fonction, [chaîneLispE(o.clef), chaîneLispE(e.value)]); });
                return e;
            });
            const liste = lisJSON(éléments, []);
            o.élément.innerHTML = '';
            (Array.isArray(liste) ? liste : [liste]).forEach(v => {
                const op = document.createElement('option');
                op.textContent = op.value = String(v).normalize('NFC');
                o.élément.appendChild(op);
            });
            poseObjet(o, nom, x, y, null);
        },

        // liste_hiérarchique(clef, x, y, lignes, arbre, f) : un arbre que l'on déplie ;
        // un élément est un texte (une feuille) ou [nom, [enfants...]] (une branche).
        // Un clic sur un élément appelle f(clef, chemin), chemin étant la liste des noms
        // depuis la racine : ["Légumes", "Racines", "carotte"]
        listeHiérarchique(clef, x, y, lignes, arbre, nom) {
            clef = String(clef).normalize('NFC');
            const o = objetDe(clef, 'arbre', () => {
                const e = document.createElement('div');
                e.className = 'objet-canevas arbre-canevas';
                e.setAttribute('role', 'tree');
                e.setAttribute('aria-label', clef);
                return e;
            });
            o.chemin = [];
            o.élément.innerHTML = '';
            const ajoute = (parent, éléments, chemin) => {
                (Array.isArray(éléments) ? éléments : [éléments]).forEach(él => {
                    const branche = Array.isArray(él) && él.length === 2 && !Array.isArray(él[0]) && Array.isArray(él[1]);
                    const nomÉl = String(branche ? él[0] : (Array.isArray(él) ? él.join(' ') : él)).normalize('NFC');
                    const ici = [...chemin, nomÉl];
                    const ligne = document.createElement(branche ? 'summary' : 'div');
                    ligne.className = 'arbre-élément' + (branche ? ' arbre-branche' : '');
                    ligne.textContent = nomÉl;
                    ligne.addEventListener('click', () => {
                        o.élément.querySelectorAll('.arbre-élément.choisi').forEach(x => x.classList.remove('choisi'));
                        ligne.classList.add('choisi');
                        o.chemin = ici;
                        appelleBientôt(o.fonction, [chaîneLispE(o.clef), '(list ' + ici.map(chaîneLispE).join(' ') + ')']);
                    });
                    if (branche) {
                        const d = document.createElement('details');
                        d.appendChild(ligne);
                        const enfants = document.createElement('div');
                        enfants.className = 'arbre-enfants';
                        ajoute(enfants, él[1], ici);
                        d.appendChild(enfants);
                        parent.appendChild(d);
                    } else parent.appendChild(ligne);
                });
            };
            ajoute(o.élément, lisJSON(arbre, []), []);
            o.lignes = Math.max(1, Math.round(nombre(lignes, 6)));
            poseObjet(o, nom, x, y, largeurChamp);
            o.élément.style.height = (o.lignes * 1.45 + 0.4) + 'em';
        },

        // zone_défilante(clef, x, y, l, h, largeur, hauteur, f) : une fenêtre de l × h (en points du
        // canevas) sur une surface de dessin de largeur × hauteur, qui défile verticalement si
        // hauteur > h, horizontalement si largeur > l (molette, pavé tactile, doigt, barres). Le
        // programme y dessine avec montre_dessin(d, clef). f (facultative) : f(clef, [x, y]) au clic,
        // en coordonnées de la surface.
        zoneDéfilante(clef, x, y, l, h, largeur, hauteur, nom) {
            dernièreErreur = '';
            clef = String(clef).normalize('NFC');
            const lv = Math.round(nombre(l, NaN)), hv = Math.round(nombre(h, NaN));
            const lc = Math.round(nombre(largeur, NaN)), hc = Math.round(nombre(hauteur, NaN));
            if (!(lv >= 1 && hv >= 1 && lc >= 1 && hc >= 1 && lc <= TAILLE_MAX && hc <= TAILLE_MAX * 4)) {
                dernièreErreur = 'zone_défilante : les tailles sont des nombres plus grands que 0 (« ' + l + ' », « ' + h + ' », « ' + largeur + ' », « ' + hauteur + ' »)';
                return;
            }
            const o = objetDe(clef, 'défilante', (o) => {
                const e = document.createElement('div');
                e.className = 'objet-canevas défilante-canevas';
                e.setAttribute('aria-label', clef);
                const c = document.createElement('canvas');
                e.appendChild(c);
                o.surface = c;
                o.ctx = c.getContext('2d');
                c.addEventListener('click', (ev) => {
                    if (!o.rappel) return;
                    const r = c.getBoundingClientRect();
                    const px = (ev.clientX - r.left) * o.largeur / r.width, py = (ev.clientY - r.top) * o.hauteur / r.height;
                    appelle(o.rappel, [chaîneLispE(clef), '(list ' + Math.round(px) + ' ' + Math.round(py) + ')']);
                });
                return e;
            });
            const c = o.surface;
            if (c.width !== lc || c.height !== hc) { c.width = lc; c.height = hc; }
            o.largeur = lc; o.hauteur = hc;
            // la surface, à l'échelle du canevas : largeur / l de la zone, hauteur / h
            c.style.width = (lc * 100 / lv) + '%';
            c.style.height = (hc * 100 / hv) + '%';
            o.élément.style.overflowX = lc > lv ? 'auto' : 'hidden';
            o.élément.style.overflowY = hc > hv ? 'auto' : 'hidden';
            o.rappel = String(nom || '') || null;
            o.h = hv;
            poseObjet(o, nom || '', x, y, lv);
        },
        // zone_texte(clef, x, y, l, h, texte) : un texte seul, en lecture seule, qui défile
        // verticalement, et horizontalement si des lignes dépassent (elles ne sont pas coupées)
        zoneTexte(clef, x, y, l, h, texte) {
            dernièreErreur = '';
            clef = String(clef).normalize('NFC');
            const lv = Math.round(nombre(l, NaN)), hv = Math.round(nombre(h, NaN));
            if (!(lv >= 1 && hv >= 1)) { dernièreErreur = 'zone_texte : la largeur et la hauteur sont des nombres plus grands que 0 (« ' + l + ' », « ' + h + ' »)'; return; }
            const o = objetDe(clef, 'texte', () => {
                const e = document.createElement('div');
                e.className = 'objet-canevas texte-défilant-canevas';
                e.setAttribute('role', 'document');
                e.setAttribute('aria-label', clef);
                e.tabIndex = 0;
                return e;
            });
            o.élément.textContent = String(texte === undefined || texte === null ? '' : texte).normalize('NFC');
            o.h = hv;
            poseObjet(o, '', x, y, lv);
        },

        // valeur_objet(clef) : le texte d'une saisie, d'une zone ou d'un bouton, le nombre
        // d'une glissière, Vrai / Faux pour une case ou un radio, le chemin d'une liste hiérarchique
        valeurObjet(clef) {
            dernièreErreur = '';
            const o = champs.get(String(clef).normalize('NFC'));
            if (!o) { dernièreErreur = 'valeur_objet : il n\'y a pas d\'objet « ' + clef + ' »'; return ''; }
            // evaljs_j rend la valeur telle quelle à LispE : booléen, nombre, texte ou liste
            if (o.genre === 'case' || o.genre === 'radio') return o.entrée.checked;
            if (o.genre === 'glissière') return valeurGlissière(o);
            if (o.genre === 'bouton') return o.élément.textContent;
            if (o.genre === 'bouton_image') return o.numéro;
            if (o.genre === 'arbre') return o.chemin;
            // une zone défilante : la position du défilement, [x, y] en points de sa surface
            if (o.genre === 'défilante') {
                const k = o.surface.clientWidth ? o.largeur / o.surface.clientWidth : 1;
                return [Math.round(o.élément.scrollLeft * k), Math.round(o.élément.scrollTop * k)];
            }
            if (o.genre === 'texte') return o.élément.textContent;
            return o.élément.value.normalize('NFC');
        },
        genreObjet(clef) {
            const o = champs.get(String(clef).normalize('NFC'));
            return o ? o.genre : '';
        },
        // change_objet(clef, valeur) : change la valeur sans appeler la fonction de l'objet
        changeObjet(clef, valeur) {
            dernièreErreur = '';
            const o = champs.get(String(clef).normalize('NFC'));
            if (!o) { dernièreErreur = 'change_objet : il n\'y a pas d\'objet « ' + clef + ' »'; return; }
            if (o.genre === 'case' || o.genre === 'radio') o.entrée.checked = !!valeur;
            else if (o.genre === 'glissière') o.élément.value = nombre(valeur, Number(o.élément.min));
            else if (o.genre === 'bouton') o.élément.textContent = String(valeur);
            else if (o.genre === 'texte') o.élément.textContent = String(valeur).normalize('NFC');
            else if (o.genre === 'défilante') {
                // valeur : [x, y], la position où faire défiler (en points de la surface)
                const [px, py] = lisJSON(valeur, [0, 0]);
                const k = o.largeur ? o.surface.clientWidth / o.largeur : 1;
                o.élément.scrollTo(nombre(px, 0) * k, nombre(py, 0) * k);
            }
            else if (o.genre === 'bouton_image') {
                // valeur : le numéro d'une autre image, qui devient l'aspect du bouton
                if (!images[valeur]) dernièreErreur = 'change_objet : l\'image ' + valeur + ' n\'existe pas';
                else { o.normale = images[valeur]; o.numéro = valeur; o.montre(false); }
            }
            else if (o.genre === 'arbre') {
                // valeur : le chemin de l'élément à choisir ; ses branches sont dépliées
                const chemin = lisJSON(valeur, []).map(v => String(v).normalize('NFC'));
                // on cherche d'abord : un chemin inconnu ne change rien
                let niveau = o.élément, trouvé = null;
                const àOuvrir = [];
                for (const n of chemin) {
                    trouvé = [...niveau.children].map(c => c.tagName === 'DETAILS' ? c.firstChild : c).find(c => c && c.textContent === n);
                    if (!trouvé) break;
                    if (trouvé.tagName === 'SUMMARY') { àOuvrir.push(trouvé.parentElement); niveau = trouvé.parentElement.lastChild; }
                }
                if (trouvé) {
                    o.élément.querySelectorAll('.arbre-élément.choisi').forEach(x => x.classList.remove('choisi'));
                    àOuvrir.forEach(d => { d.open = true; });
                    trouvé.classList.add('choisi');
                    o.chemin = chemin;
                }
                else dernièreErreur = 'change_objet : « ' + chemin.join(' > ') + ' » n\'est pas dans la liste « ' + clef + ' »';
            }
            else { o.élément.value = String(valeur); o.envoyé = o.élément.value; }
        },
        // largeur_saisie(l) : la largeur des champs créés ensuite (200 au départ)
        largeurSaisie(l) {
            largeurChamp = Math.max(20, nombre(l, LARGEUR_CHAMP));
        },
        // active_saisie(clef) : le champ prend la main, son contenu est sélectionné
        // (ce qu'on tape le remplace) ; le champ qu'on quitte envoie sa valeur
        activeSaisie(clef) {
            dernièreErreur = '';
            const champ = champs.get(String(clef).normalize('NFC'));
            if (!champ) { dernièreErreur = 'active_saisie : il n\'y a pas de champ « ' + clef + ' »'; return; }
            champ.élément.focus();
            champ.élément.select();
        },
        // saisie_active() : la clef du champ qui a la main ("" s'il n'y en a pas)
        saisieActive() {
            for (const [clef, champ] of champs) if (champ.élément === document.activeElement) return clef;
            return '';
        },

        // ---------- Fichiers ----------
        // ouvre_page(adresse) : la page https://... s'ouvre dans un nouvel onglet. Le navigateur ne
        // l'autorise que juste après un geste de l'élève (un clic, une touche, ▶ Exécuter) : sinon,
        // l'erreur le dit.
        ouvrePage(adresse) {
            dernièreErreur = '';
            const a = String(adresse).normalize('NFC').trim();
            if (!/^https:\/\/[^\s]+$/i.test(a)) {
                dernièreErreur = 'ouvre_page : « ' + a + ' » n\'est pas une adresse qui commence par https://';
                return;
            }
            const onglet = window.open(a, '_blank');
            if (!onglet) {
                dernièreErreur = 'ouvre_page : le navigateur a bloqué l\'ouverture de « ' + a + ' » ; appelle ouvre_page juste après un clic (un bouton, quand_clic) ou une touche';
                return;
            }
            onglet.opener = null;      // la page ouverte ne peut pas agir sur la Pythonerie
        },
        // écrit_fichier(nom, texte) : téléchargé dans le dossier Téléchargements,
        // ce qui fonctionne partout (en ligne, avec serveur.py, sur une tablette)
        écritFichier(nom, texte) {
            dernièreErreur = '';
            nom = String(nom).normalize('NFC').trim();
            if (!nom || /[\\/:*?"<>|]/.test(nom) || nom.startsWith('.')) {
                dernièreErreur = 'nom de fichier invalide : « ' + nom + ' » (un simple nom, sans répertoire)';
                return;
            }
            if (!nom.includes('.')) nom += '.txt';
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([String(texte)], { type: 'text/plain;charset=utf-8' }));
            a.download = nom;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        },
        // le message de la dernière erreur (lit_fichier, écrit_fichier, canevas...) ; '' si tout va bien
        dernièreErreur() {
            return dernièreErreur;
        },

        // liste_sons(), liste_images(), liste_données() : les noms des fichiers d'un répertoire
        // du projet, triés, tels qu'on les donne à charge_son, charge_image ou charge_données
        // (« ding.wav », ou « sons/bruits/ding.wav » dans un sous-répertoire). avecMédias : on
        // ajoute ceux des médias du site (« médias/sounds/ding.wav »). evaljs_j en fait une liste.
        listeFichiers(répertoire, avecMédias) {
            répertoire = String(répertoire).normalize('NFC');
            const début = répertoire + '/';
            const extensions = typeof FichiersProjet !== 'undefined' && FichiersProjet.RÉPERTOIRES && FichiersProjet.RÉPERTOIRES[répertoire]
                ? FichiersProjet.RÉPERTOIRES[répertoire].extensions : null;
            const projet = (typeof FichiersProjet !== 'undefined' ? FichiersProjet.liste() : [])
                .map(f => f.chemin).filter(c => c.startsWith(début))
                .map(c => c.slice(début.length).includes('/') ? c : c.slice(début.length))
                .sort((a, b) => a.localeCompare(b, 'fr'));
            if (!avecMédias || !window.Pythonerie || !window.Pythonerie.médias) return projet;
            const bonne = (c) => !extensions || extensions.includes(c.slice(c.lastIndexOf('.') + 1).toLowerCase());
            return projet.concat(window.Pythonerie.médias().filter(bonne));
        },

        // charge_programme, sauve_programme, vérifie_code : voir pythonerie.js ; une application Web
        // n'a ni programmes ni transpileur (son programme est déjà traduit en LispE)
        chargeProgramme(nom) {
            dernièreErreur = '';
            if (!window.Pythonerie.chargeProgramme) { dernièreErreur = 'charge_programme n\'est pas disponible dans une application Web'; return ''; }
            const r = window.Pythonerie.chargeProgramme(String(nom));
            if (r.erreur) { dernièreErreur = r.erreur; return ''; }
            return r.contenu;
        },
        sauveProgramme(nom, code) {
            dernièreErreur = window.Pythonerie.sauveProgramme ? window.Pythonerie.sauveProgramme(String(nom), String(code))
                : 'sauve_programme n\'est pas disponible dans une application Web';
        },
        vérifieCode(code) {
            return window.Pythonerie.vérifieCode ? window.Pythonerie.vérifieCode(String(code)) : '';
        },
        // sauve_données(nom, texte) : écrit le fichier dans le répertoire données du projet
        sauveDonnées(nom, texte) {
            dernièreErreur = window.Pythonerie.sauveDonnées(String(nom), String(texte));
        },
        // charge_données(nom) : un fichier du répertoire données du projet (voir pythonerie.js)
        chargeDonnées(nom) {
            dernièreErreur = '';
            const r = window.Pythonerie.chargeDonnées(nom);
            if (r.erreur) { dernièreErreur = r.erreur; return ''; }
            return r.contenu;
        },

        // ---------- Images ----------
        // capture_image(x, y, l, h) : un rectangle du dessin devient une nouvelle image (son numéro),
        // à placer avec place_image ou à donner à bouton_image ; -1 et une erreur si le navigateur
        // interdit de lire le dessin (une image venue d'un autre site)
        captureImage(x, y, l, h) {
            dernièreErreur = '';
            x = Math.round(nombre(x)); y = Math.round(nombre(y));
            l = Math.round(nombre(l)); h = Math.round(nombre(h));
            if (!(l > 0 && h > 0)) {
                dernièreErreur = 'capture_image : la largeur et la hauteur doivent être plus grandes que 0';
                return -1;
            }
            const copie = document.createElement('canvas');
            copie.width = l;
            copie.height = h;
            let source;
            try {
                copie.getContext('2d').putImageData(dessinComplet().getContext('2d').getImageData(x, y, l, h), 0, 0);
                source = copie.toDataURL('image/png');
            } catch (e) {
                dernièreErreur = 'capture_image : le dessin contient une image venue d\'un autre site, le navigateur interdit de le copier';
                return -1;
            }
            const img = new Image();
            img.src = source;
            images.push({ img, adresse: 'capture_image', erreur: false });
            return images.length - 1;
        },
        // charge_image(adresse) : renvoie le numéro de l'image (0, 1, 2...)
        chargeImage(adresse) {
            const img = new Image();
            const entrée = { img, adresse: String(adresse), erreur: false };
            const source = adresseMédia(adresse, 'images');
            images.push(entrée);
            if (!source) {
                entrée.erreur = true;
                signaleErreur('Erreur : l\'image « ' + entrée.adresse + ' » n\'est pas dans le répertoire images du projet');
                return images.length - 1;
            }
            img.onerror = () => {
                entrée.erreur = true;
                signaleErreur('Erreur : impossible de charger l\'image « ' + entrée.adresse + ' »');
            };
            img.src = source;
            return images.length - 1;
        },
        // place_image(numéro, x, y) ou place_image(numéro, x, y, largeur, hauteur) :
        // (x, y) est le coin en haut à gauche de l'image
        placeImage(numéro, x, y, l, h) {
            dernièreErreur = '';
            const entrée = images[numéro];
            if (!entrée) { dernièreErreur = 'place_image : image inconnue : ' + numéro + ' (utilise le numéro renvoyé par charge_image)'; return; }
            const dessine = () => {
                const lg = (l === null || l === undefined) ? entrée.img.naturalWidth : nombre(l);
                const ht = (h === null || h === undefined) ? entrée.img.naturalHeight * (lg / (entrée.img.naturalWidth || 1)) : nombre(h);
                ctx.drawImage(entrée.img, nombre(x), nombre(y), lg, ht);
            };
            if (entrée.img.complete && entrée.img.naturalWidth > 0) {
                dessine();
            } else if (!entrée.erreur) {
                // pas encore chargée : on la dessine dès qu'elle arrive, sauf si on a effacé entre-temps
                const gén = génération;
                entrée.img.addEventListener('load', () => { if (gén === génération) dessine(); }, { once: true });
            }
        },

        // ---------- Sons ----------
        // Les sons passent par l'API Web Audio : chaque son est décodé une fois en mémoire,
        // puis joué sans délai (un lecteur <audio> met plusieurs dizaines de millisecondes
        // à démarrer). Si le décodage est impossible (son d'un autre site sans autorisation,
        // format inconnu), on se replie sur un lecteur <audio>.
        // charge_son(adresse) : renvoie le numéro du son (0, 1, 2...)
        chargeSon(adresse) {
            const nom = adresseMédia(adresse, 'sons');
            const entrée = { nom: String(adresse), tampon: null, élément: null };
            if (!nom) {
                entrée.introuvable = true;
                signaleErreur('Erreur : le son « ' + adresse + ' » n\'est pas dans le répertoire sons du projet');
                sons.push(entrée);
                return sons.length - 1;
            }
            const créeÉlément = () => {
                const élément = new Audio();
                élément.preload = 'auto';
                élément.onerror = () => {
                    entrée.introuvable = true;
                    signaleErreur('Erreur : impossible de charger le son « ' + entrée.nom + ' »');
                };
                élément.src = nom;
                entrée.élément = élément;
            };
            const ctx = contexteAudio();
            if (sonsDécodés.has(nom)) {
                entrée.tampon = sonsDécodés.get(nom);       // décodé avant l'exécution : prêt à jouer
            } else if (!ctx) {
                créeÉlément();
            } else {
                entrée.prêt = téléchargeAvecReprise(nom)
                    .then(r => r.arrayBuffer())
                    .then(données => ctx.decodeAudioData(données))
                    .then(tampon => { entrée.tampon = tampon; sonsDécodés.set(nom, tampon); })
                    .catch(() => créeÉlément());
            }
            sons.push(entrée);
            return sons.length - 1;
        },
        // Avant l'exécution : décode les sons que le programme va charger (noms : les
        // arguments des charge_son("…") de son code). Renvoie une promesse, ou null s'il n'y a
        // rien à attendre ; on n'attend jamais plus de délai ms (réseau lent).
        préchargeSons(noms, délai = 3000) {
            const ctx = contexteAudio();
            if (!ctx) return null;
            // appelé pendant le clic sur « Exécuter » : le navigateur autorise alors le son
            réveilleAudio();
            const àDécoder = [...new Set(noms.map(n => adresseMédia(n, 'sons')).filter(a => a && !sonsDécodés.has(a)))];
            if (!àDécoder.length) return null;
            const tous = Promise.all(àDécoder.map(a => téléchargeAvecReprise(a)
                .then(r => r.arrayBuffer())
                .then(données => ctx.decodeAudioData(données))
                .then(tampon => { sonsDécodés.set(a, tampon); })
                .catch(() => { /* charge_son signalera l'erreur, ou passera par un lecteur <audio> */ })));
            return Promise.race([tous, new Promise(fin => setTimeout(fin, délai))]);
        },
        // joue_son(numéro) : les sons peuvent se superposer (accords, notes répétées)
        joueSon(numéro) {
            const entrée = sons[numéro];
            if (!entrée) throw new Error('Son inconnu : ' + numéro + ' (utilise le numéro renvoyé par charge_son)');
            const ctx = contexteAudio();
            if (entrée.tampon && ctx) {
                réveilleAudio();
                const source = ctx.createBufferSource();
                source.buffer = entrée.tampon;
                source.connect(ctx.destination);
                source.onended = () => { sourcesActives = sourcesActives.filter(s => s !== source); };
                sourcesActives.push(source);
                source.start();
            } else if (entrée.élément) {
                const son = entrée.élément;
                let lecture = son;
                if (!son.paused && !son.ended) lecture = son.cloneNode(true);
                else son.currentTime = 0;
                enLecture.push(lecture);
                lecture.onended = () => { enLecture = enLecture.filter(x => x !== lecture); };
                const promesse = lecture.play();
                // (un fichier introuvable a déjà été signalé au chargement)
                if (promesse && promesse.catch) promesse.catch(e => {
                    if (!entrée.introuvable) signaleErreur('Erreur : le son ne peut pas être joué (' + e.message + ')');
                });
            } else if (entrée.prêt) {
                // pas encore décodé (on vient juste de le charger) : il joue dès qu'il est prêt
                entrée.prêt.then(() => this.joueSon(numéro));
            }
        },
        arrêteSons() {
            sourcesActives.forEach(s => { try { s.stop(); } catch (e) { /* déjà fini */ } });
            sourcesActives = [];
            enLecture.forEach(x => { try { x.pause(); } catch (e) { /* rien */ } });
            enLecture = [];
        },

        // Image PNG du dessin (impossible si une image vient d'un autre site sans autorisation)
        image() { return dessinComplet().toDataURL('image/png'); }
    };
})();

window.Pyt = Pyt;
