// =====================================================================
// Pythonerie — API de dessin
// ---------------------------------------------------------------------
// L'objet Pyt (window.Pyt) est appelé depuis LispE via evaljs
// (voir basic/bibliothèque.lisp) : (evaljs (list "Pyt.cercle" x y r false))
// exécute en JavaScript : Pyt.cercle(x, y, r, false);
//
// Le canevas a une taille logique fixe (LARGEUR x HAUTEUR) ; il est mis à
// l'échelle à l'écran. L'origine (0, 0) est en haut à gauche, y vers le bas.
// Une seconde couche transparente affiche la tortue sans laisser de trace.
// =====================================================================

const Pyt = (function () {
    const LARGEUR = 800;
    const HAUTEUR = 600;

    // Couleurs en français (toute couleur CSS reste utilisable : "#ff8800", "rgb(...)")
    const COULEURS = {
        rouge: '#e53935', vert: '#43a047', bleu: '#1e88e5', jaune: '#fdd835',
        orange: '#fb8c00', violet: '#8e24aa', rose: '#ec407a', marron: '#6d4c41',
        noir: '#000000', blanc: '#ffffff', gris: '#9e9e9e', cyan: '#00acc1',
        magenta: '#d81b60', turquoise: '#26a69a', beige: '#f5f0e1', or: '#ffb300',
        argent: '#bdbdbd', 'vert clair': '#9ccc65', 'bleu clair': '#64b5f6',
        'bleu marine': '#1a237e', 'gris clair': '#e0e0e0', 'gris foncé': '#424242',
        transparent: 'rgba(0,0,0,0)'
    };

    let canevas = null, ctx = null, couche = null, ctxTortue = null;
    let état = null, tortue = null;
    let minuteries = [];
    let gestionnaires = { clic: null, souris: null, glisse: null, touche: null };
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

    function chaîneLispE(s) {
        return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
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
            if (!gestionnaires.touche) return;
            // On laisse l'éditeur et les champs de saisie tranquilles
            const cible = ev.target;
            if (cible && (cible.closest && cible.closest('.CodeMirror, input, textarea, select'))) return;
            if (ev.key.startsWith('Arrow') || ev.key === ' ') ev.preventDefault();
            appelle(gestionnaires.touche, [chaîneLispE(ev.key.normalize('NFC'))]);
        });
    }

    // ================= API publique =================
    return {
        LARGEUR, HAUTEUR, COULEURS,

        // Appelé une fois par l'application
        installe(élémentCanevas, élémentCouche, fonctionRappel) {
            canevas = élémentCanevas;
            couche = élémentCouche;
            canevas.width = couche.width = LARGEUR;
            canevas.height = couche.height = HAUTEUR;
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
            this.arrête();
            this.arrêteSons();
            gestionnaires = { clic: null, souris: null, glisse: null, touche: null };
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
        demande(question) {
            const r = window.prompt(String(question || ''), '');
            return r === null ? '' : r.normalize('NFC');
        },
        aléatoire(a, b) {
            a = Math.ceil(nombre(a)); b = Math.floor(nombre(b));
            if (b < a) [a, b] = [b, a];
            return Math.floor(Math.random() * (b - a + 1)) + a;
        },

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
        arrête() {
            minuteries.forEach(clearInterval);
            minuteries = [];
            if (window.Pythonerie) window.Pythonerie.signaleAnimation(false);
        },
        enCours() {
            return minuteries.length > 0 || !!(gestionnaires.clic || gestionnaires.souris || gestionnaires.glisse || gestionnaires.touche);
        },
        stoppeTout() {
            this.arrête();
            this.arrêteSons();
            gestionnaires = { clic: null, souris: null, glisse: null, touche: null };
        },

        // ---------- Images ----------
        // charge_image(adresse) : renvoie le numéro de l'image (0, 1, 2...)
        chargeImage(adresse) {
            const img = new Image();
            const entrée = { img, adresse: String(adresse), erreur: false };
            img.onerror = () => {
                entrée.erreur = true;
                signaleErreur('Erreur : impossible de charger l\'image « ' + entrée.adresse + ' »');
            };
            img.src = entrée.adresse;
            images.push(entrée);
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
            const nom = String(adresse);
            const entrée = { nom, tampon: null, élément: null };
            const créeÉlément = () => {
                const élément = new Audio();
                élément.preload = 'auto';
                élément.onerror = () => {
                    entrée.introuvable = true;
                    signaleErreur('Erreur : impossible de charger le son « ' + nom + ' »');
                };
                élément.src = nom;
                entrée.élément = élément;
            };
            const ctx = contexteAudio();
            if (!ctx) {
                créeÉlément();
            } else {
                entrée.prêt = téléchargeAvecReprise(nom)
                    .then(r => r.arrayBuffer())
                    .then(données => ctx.decodeAudioData(données))
                    .then(tampon => { entrée.tampon = tampon; })
                    .catch(() => créeÉlément());
            }
            sons.push(entrée);
            return sons.length - 1;
        },
        // joue_son(numéro) : les sons peuvent se superposer (accords, notes répétées)
        joueSon(numéro) {
            const entrée = sons[numéro];
            if (!entrée) throw new Error('Son inconnu : ' + numéro + ' (utilise le numéro renvoyé par charge_son)');
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
