// =====================================================================
// Pythonerie — API de dessin
// ---------------------------------------------------------------------
// L'objet Pyt (window.Pyt) est appelé depuis LispE via evaljs
// (voir basic/bibliothèque.lisp) : (evaljs (list "Pyt.cercle" x y r false))
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
    let gestionnaires = { clic: null, souris: null, glisse: null, touche: null, relâche: null };
    // Images et sons chargés par le programme : charge_image et charge_son renvoient leur numéro
    let images = [];
    let sons = [];
    let enLecture = [];        // lecteurs <audio> en cours (solution de repli)
    let sourcesActives = [];   // sons Web Audio en cours
    let audio = null;
    // Le contexte Web Audio est créé au premier son (pendant le clic sur « Exécuter »)
    function contexteAudio() {
        if (!audio) {
            const Contexte = window.AudioContext || window.webkitAudioContext;
            if (Contexte) audio = new Contexte({ latencyHint: 'interactive' });
        }
        return audio;
    }
    // Augmente à chaque efface() ou fond() : une image qui finit de se charger après
    // un effacement n'est plus dessinée
    let génération = 0;
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

    function appelle(nom, args) {
        if (!nom || !rappel) return;
        const code = '(' + nom + (args.length ? ' ' + args.join(' ') : '') + ')';
        rappel(code);
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
    // Pendant la partie rejouée d'un programme (voir demande), les sons sont coupés
    let sonsCoupés = false;

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

    function valeurGlissière(o) {
        const v = Number(o.élément.value);
        return o.entiers ? Math.round(v) : Math.round(v * 1e6) / 1e6;
    }

    // l'appel au programme se fait un instant plus tard (voir envoieChamp)
    function appelleBientôt(fonction, args) {
        setTimeout(() => appelle(fonction, args), 0);
    }

    function retireChamps() {
        champs.forEach(c => c.élément.remove());
        champs.clear();
    }

    function dimensionne(lg, ht) {
        LARGEUR = lg;
        HAUTEUR = ht;
        if (canevas.width !== lg) canevas.width = couche.width = lg;
        if (canevas.height !== ht) canevas.height = couche.height = ht;
        canevas.parentElement.style.aspectRatio = lg + ' / ' + ht;
        canevas.parentElement.style.setProperty('--ratio', String(lg / ht));
        const étiquette = document.getElementById('tailleCanevas');
        if (étiquette) étiquette.textContent = lg + ' × ' + ht;
        champs.forEach(placeChamp);
    }

    // L'adresse d'une image ou d'un son : un simple nom (« chat.png ») désigne un fichier
    // du répertoire images ou sons du projet ; une adresse avec un « / » (exemples/médias/...)
    // ou complète (https://...) garde son sens. null : le nom n'est pas dans le projet.
    function adresseMédia(adresse, répertoire) {
        const a = String(adresse).normalize('NFC').trim();
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

    function installeÉvénements() {
        // Événements « pointer » : la souris, mais aussi le doigt sur une tablette
        couche.addEventListener('pointerdown', (ev) => {
            // on garde le pointeur même s'il sort du canevas pendant un glissé
            if (couche.setPointerCapture) couche.setPointerCapture(ev.pointerId);
            if (!gestionnaires.clic) return;
            const p = positionSouris(ev);
            appelle(gestionnaires.clic, [p.x, p.y]);
        });
        couche.addEventListener('pointermove', (ev) => {
            const p = positionSouris(ev);
            const aff = document.getElementById('coordonnées');
            if (aff) aff.textContent = 'x : ' + p.x + '   y : ' + p.y;
            if (gestionnaires.souris) appelle(gestionnaires.souris, [p.x, p.y]);
            // bouton appuyé (ou doigt posé) : on fait glisser
            if (gestionnaires.glisse && (ev.buttons & 1)) appelle(gestionnaires.glisse, [p.x, p.y]);
        });
        couche.addEventListener('pointerleave', () => {
            const aff = document.getElementById('coordonnées');
            if (aff) aff.textContent = '';
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
    return {
        COULEURS,

        // Appelé une fois par l'application
        installe(élémentCanevas, élémentCouche, fonctionRappel) {
            canevas = élémentCanevas;
            couche = élémentCouche;
            ctx = canevas.getContext('2d');
            ctxTortue = couche.getContext('2d');
            rappel = fonctionRappel;
            installeÉvénements();
            // Le navigateur peut garder le son « suspendu » tant que la page n'a pas reçu de geste :
            // le premier clic ou la première touche, n'importe où, le réveille
            ['pointerdown', 'keydown', 'touchend'].forEach(type => window.addEventListener(type, () => {
                if (audio && audio.state === 'suspended') audio.resume();
            }, { capture: true }));
            this.réinitialise();
        },

        // Avant chaque exécution : on arrête tout et on repart d'une page blanche
        réinitialise() {
            retireChamps();
            relâcheTout(false);
            largeurChamp = LARGEUR_CHAMP;
            dimensionne(LARGEUR_DÉFAUT, HAUTEUR_DÉFAUT);
            this.arrête();
            this.arrêteSons();
            gestionnaires = { clic: null, souris: null, glisse: null, touche: null, relâche: null };
            images = [];
            sons = [];
            état = étatInitial();
            tortue = tortueInitiale();
            this.efface();
            prévoitTortue();
        },

        // ---------- Console ----------
        effaceConsole() {
            if (window.Pythonerie) window.Pythonerie.effaceConsole();
        },
        // écris() : texte sans retour à la ligne
        écris(texte) {
            if (window.Pythonerie) window.Pythonerie.écrisPartiel(String(texte));
        },
        // demande(question) : la question est posée dans la console (voir pythonerie.js).
        // Sans réponse, le programme s'arrête le temps que l'élève réponde, puis repart du
        // début. Pendant une animation ou un clic, on ne peut pas repartir : la fenêtre du
        // navigateur pose alors la question.
        demande(question) {
            dernièreErreur = '';
            const r = window.Pythonerie ? window.Pythonerie.réponseÀ(String(question)) : null;
            if (r && r.manque) { dernièreErreur = 'le programme attend une réponse'; return ''; }
            if (r) return r.réponse;
            const réponse = window.prompt(String(question || ''), '');
            return réponse === null ? '' : réponse.normalize('NFC');
        },
        aléatoire(a, b) {
            a = Math.ceil(nombre(a)); b = Math.floor(nombre(b));
            if (b < a) [a, b] = [b, a];
            return Math.floor(aléa() * (b - a + 1)) + a;
        },
        hasard() { return aléa(); },
        graine(g) { étatHasard = g >>> 0; },
        coupeSons(oui) { sonsCoupés = !!oui; },

        // ---------- Styles ----------
        efface() {
            génération++;
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, LARGEUR, HAUTEUR);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, LARGEUR, HAUTEUR);
            ctx.restore();
        },
        fond(c) {
            génération++;
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

        // ---------- Texte ----------
        texte(x, y, message) {
            appliqueStyle();
            ctx.fillStyle = état.remplissage;
            String(message).split('\n').forEach((l, i) => {
                ctx.fillText(l, nombre(x), nombre(y) + i * état.taille * 1.2);
            });
        },
        tailleTexte(n) { état.taille = Math.max(4, nombre(n, 20)); },
        police(nom) { état.police = String(nom || 'Inter, sans-serif'); },

        // canevas(largeur, hauteur) : change la taille du canevas (le dessin est effacé et
        // la tortue revient au centre). À chaque exécution, il reprend sa taille de 800 x 600.
        canevas(l, h) {
            dernièreErreur = '';
            const lg = Math.round(nombre(l, NaN)), ht = Math.round(nombre(h, NaN));
            if (!(lg >= 1 && lg <= TAILLE_MAX && ht >= 1 && ht <= TAILLE_MAX)) {
                dernièreErreur = 'canevas : la largeur et la hauteur sont des nombres entre 1 et ' + TAILLE_MAX
                    + ' (« ' + l + ' », « ' + h + ' »)';
                return;
            }
            dimensionne(lg, ht);
            const t = tortueInitiale();
            tortue.x = t.x; tortue.y = t.y; tortue.cap = t.cap;
            this.efface();
            prévoitTortue();
        },
        largeur() { return LARGEUR; },
        hauteur() { return HAUTEUR; },

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

        // ---------- Animation et événements ----------
        animer(nom, délai) {
            const ms = Math.max(10, nombre(délai, 50));
            const id = setInterval(() => appelle(nom, []), ms);
            minuteries.push(id);
            if (window.Pythonerie) window.Pythonerie.signaleAnimation(true);
        },
        quandClic(nom) { gestionnaires.clic = nom; },
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
            return minuteries.length > 0 || champs.size > 0
                || !!(gestionnaires.clic || gestionnaires.souris || gestionnaires.glisse || gestionnaires.touche || gestionnaires.relâche);
        },
        // gardeSons : le programme s'arrête sur une question (demande) ; le son qu'il vient
        // de lancer (« bravo ! ») continue pendant que l'élève lit la question
        stoppeTout(gardeSons) {
            retireChamps();
            relâcheTout(false);
            this.arrête();
            if (!gardeSons) this.arrêteSons();
            gestionnaires = { clic: null, souris: null, glisse: null, touche: null, relâche: null };
        },

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
                e.addEventListener('click', () => { e.blur(); appelleBientôt(o.fonction, [chaîneLispE(o.clef), chaîneLispE(e.textContent)]); });
                return e;
            });
            o.élément.textContent = String(texte).normalize('NFC');
            poseObjet(o, nom, x, y, null);
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

        // valeur_objet(clef) : le texte d'une saisie, d'une zone ou d'un bouton, le nombre
        // d'une glissière, 1 ou 0 pour une case ou un radio (genreObjet dit lequel)
        valeurObjet(clef) {
            dernièreErreur = '';
            const o = champs.get(String(clef).normalize('NFC'));
            if (!o) { dernièreErreur = 'valeur_objet : il n\'y a pas d\'objet « ' + clef + ' »'; return ''; }
            // evaljs rend un texte : bibliothèque.lisp le convertit selon le genre de l'objet
            if (o.genre === 'case' || o.genre === 'radio') return o.entrée.checked ? '1' : '0';
            if (o.genre === 'glissière') return String(valeurGlissière(o));
            if (o.genre === 'bouton') return o.élément.textContent;
            if (o.genre === 'arbre') return JSON.stringify(o.chemin);
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
        // lit_fichier() : un fichier du disque, choisi par l'élève (voir pythonerie.js)
        // lit_fichier("https://...") : le texte d'une adresse Internet (lecture synchrone :
        // le programme attend ; le site doit autoriser la lecture depuis une autre page)
        litFichier(adresse) {
            dernièreErreur = '';
            if (adresse === undefined || adresse === null) {
                const r = window.Pythonerie.litFichierLocal();
                if (r.erreur) { dernièreErreur = r.erreur; return ''; }
                return r.contenu;
            }
            adresse = String(adresse).normalize('NFC').trim();
            if (!/^https:\/\/[^\s]+$/i.test(adresse)) {
                dernièreErreur = 'lit_fichier : l\'adresse doit commencer par https:// (« ' + adresse + ' »). '
                    + 'Pour un fichier de ton ordinateur, écris lit_fichier() sans rien entre les parenthèses.';
                return '';
            }
            const requête = new XMLHttpRequest();
            try {
                requête.open('GET', adresse, false);
                requête.overrideMimeType('text/plain; charset=utf-8');
                requête.send();
            } catch (e) {
                dernièreErreur = 'impossible de lire « ' + adresse + ' » (pas de connexion, ou le site refuse d\'être lu par une autre page)';
                return '';
            }
            if (requête.status !== 200) {
                dernièreErreur = 'impossible de lire « ' + adresse + ' » (erreur ' + requête.status + ')';
                return '';
            }
            return requête.responseText.normalize('NFC');
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
            if (window.Pythonerie.déjàÉcrit(nom, String(texte))) return;
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

        // charge_données(nom) : un fichier du répertoire données du projet (voir pythonerie.js)
        chargeDonnées(nom) {
            dernièreErreur = '';
            const r = window.Pythonerie.chargeDonnées(nom);
            if (r.erreur) { dernièreErreur = r.erreur; return ''; }
            return r.contenu;
        },

        // ---------- Images ----------
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
            const entrée = images[numéro];
            if (!entrée) throw new Error('Image inconnue : ' + numéro + ' (utilise le numéro renvoyé par charge_image)');
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
            if (ctx.state === 'suspended') ctx.resume().catch(() => {});
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
            if (sonsCoupés) return;          // déjà entendu, avant la dernière réponse
            const ctx = contexteAudio();
            if (entrée.tampon && ctx) {
                // le navigateur suspend l'audio tant qu'on n'a pas cliqué : un clic le réveille
                if (ctx.state === 'suspended') ctx.resume();
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
        image() { return canevas.toDataURL('image/png'); }
    };
})();

window.Pyt = Pyt;
