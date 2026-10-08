// =====================================================================
// Pythonerie — API de dessin
// ---------------------------------------------------------------------
// L'objet global Pyt est appelé depuis LispE via evaljs
// (voir basic/bibliotheque.lisp) : (evaljs (list "Pyt.cercle" x y r false))
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
    let etat = null, tortue = null;
    let minuteries = [];
    let gestionnaires = { clic: null, souris: null, touche: null };
    // Fonction fournie par l'application pour exécuter du LispE : rappel(code)
    let rappel = null;
    let dessinTortuePrevu = false;

    function etatInitial() {
        return {
            trait: '#1a1a1a', remplissage: '#1a1a1a', epaisseur: 2,
            taille: 20, police: 'Inter, sans-serif'
        };
    }

    function tortueInitiale() {
        // La tortue n'apparaît qu'à la première commande de tortue (sauf si on l'a cachée)
        return { x: LARGEUR / 2, y: HAUTEUR / 2, cap: 0, crayon: true, visible: false, cachee: false };
    }

    // Les noms de couleurs s'écrivent avec ou sans accents : "gris foncé" = "gris fonce"
    const sansAccents = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const COULEURS_SANS_ACCENTS = {};
    Object.keys(COULEURS).forEach(k => { COULEURS_SANS_ACCENTS[sansAccents(k)] = COULEURS[k]; });

    function couleurCSS(c) {
        if (c === null || c === undefined) return '#000000';
        const nom = String(c).trim();
        return COULEURS_SANS_ACCENTS[sansAccents(nom.toLowerCase())] || nom;
    }

    function nombre(v, defaut) {
        const n = Number(v);
        return Number.isFinite(n) ? n : (defaut === undefined ? 0 : defaut);
    }

    function appliqueStyle() {
        ctx.strokeStyle = etat.trait;
        ctx.fillStyle = etat.remplissage;
        ctx.lineWidth = etat.epaisseur;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.font = etat.taille + 'px ' + etat.police;
        ctx.textBaseline = 'top';
    }

    function traceForme(plein) {
        if (plein) ctx.fill(); else ctx.stroke();
    }

    // ---------------- La tortue (couche séparée) ----------------
    function utiliseTortue() {
        if (!tortue.cachee) tortue.visible = true;
        prevoitTortue();
    }

    function prevoitTortue() {
        if (dessinTortuePrevu) return;
        dessinTortuePrevu = true;
        requestAnimationFrame(() => {
            dessinTortuePrevu = false;
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

    function chaineLispE(s) {
        return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    }

    function installeEvenements() {
        couche.addEventListener('mousedown', (ev) => {
            if (!gestionnaires.clic) return;
            const p = positionSouris(ev);
            appelle(gestionnaires.clic, [p.x, p.y]);
        });
        couche.addEventListener('mousemove', (ev) => {
            const p = positionSouris(ev);
            const aff = document.getElementById('coordonnees');
            if (aff) aff.textContent = 'x : ' + p.x + '   y : ' + p.y;
            if (gestionnaires.souris) appelle(gestionnaires.souris, [p.x, p.y]);
        });
        couche.addEventListener('mouseleave', () => {
            const aff = document.getElementById('coordonnees');
            if (aff) aff.textContent = '';
        });
        window.addEventListener('keydown', (ev) => {
            if (!gestionnaires.touche) return;
            // On laisse l'éditeur et les champs de saisie tranquilles
            const cible = ev.target;
            if (cible && (cible.closest && cible.closest('.CodeMirror, input, textarea, select'))) return;
            if (ev.key.startsWith('Arrow') || ev.key === ' ') ev.preventDefault();
            appelle(gestionnaires.touche, [chaineLispE(ev.key)]);
        });
    }

    // ================= API publique =================
    return {
        LARGEUR, HAUTEUR, COULEURS,

        // Appelé une fois par l'application
        installe(elementCanevas, elementCouche, fonctionRappel) {
            canevas = elementCanevas;
            couche = elementCouche;
            canevas.width = couche.width = LARGEUR;
            canevas.height = couche.height = HAUTEUR;
            ctx = canevas.getContext('2d');
            ctxTortue = couche.getContext('2d');
            rappel = fonctionRappel;
            installeEvenements();
            this.reinitialise();
        },

        // Avant chaque exécution : on arrête tout et on repart d'une page blanche
        reinitialise() {
            this.arrete();
            gestionnaires = { clic: null, souris: null, touche: null };
            etat = etatInitial();
            tortue = tortueInitiale();
            this.efface();
            prevoitTortue();
        },

        // ---------- Console ----------
        effaceConsole() {
            if (window.Pythonerie) window.Pythonerie.effaceConsole();
        },
        // ecris() : texte sans retour à la ligne
        ecris(texte) {
            if (window.Pythonerie) window.Pythonerie.ecrisPartiel(String(texte));
        },
        demande(question) {
            const r = window.prompt(String(question || ''), '');
            return r === null ? '' : r;
        },
        aleatoire(a, b) {
            a = Math.ceil(nombre(a)); b = Math.floor(nombre(b));
            if (b < a) [a, b] = [b, a];
            return Math.floor(Math.random() * (b - a + 1)) + a;
        },

        // ---------- Styles ----------
        efface() {
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, LARGEUR, HAUTEUR);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, LARGEUR, HAUTEUR);
            ctx.restore();
        },
        fond(c) {
            ctx.save();
            ctx.fillStyle = couleurCSS(c);
            ctx.fillRect(0, 0, LARGEUR, HAUTEUR);
            ctx.restore();
        },
        couleur(c) { etat.trait = etat.remplissage = couleurCSS(c); },
        couleurTrait(c) { etat.trait = couleurCSS(c); },
        couleurRemplissage(c) { etat.remplissage = couleurCSS(c); },
        epaisseur(e) { etat.epaisseur = Math.max(0.1, nombre(e, 1)); },

        // ---------- Formes ----------
        point(x, y) {
            appliqueStyle();
            const r = Math.max(1, etat.epaisseur / 2);
            ctx.beginPath();
            ctx.arc(nombre(x), nombre(y), r, 0, 2 * Math.PI);
            ctx.fillStyle = etat.trait;
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
            ctx.fillStyle = etat.remplissage;
            String(message).split('\n').forEach((l, i) => {
                ctx.fillText(l, nombre(x), nombre(y) + i * etat.taille * 1.2);
            });
        },
        tailleTexte(n) { etat.taille = Math.max(4, nombre(n, 20)); },
        police(nom) { etat.police = String(nom || 'Inter, sans-serif'); },

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
        vaA(x, y) {
            x = nombre(x); y = nombre(y);
            if (tortue.crayon) this.ligne(tortue.x, tortue.y, x, y);
            tortue.x = x;
            tortue.y = y;
            utiliseTortue();
        },
        oriente(a) { tortue.cap = nombre(a) % 360; utiliseTortue(); },
        origine() {
            const { crayon, cachee } = tortue;
            tortue = tortueInitiale();
            tortue.crayon = crayon;
            tortue.cachee = cachee;
            utiliseTortue();
        },
        montreTortue(v) { tortue.visible = !!v; tortue.cachee = !v; prevoitTortue(); },
        tortueX() { return tortue.x; },
        tortueY() { return tortue.y; },
        tortueCap() { return tortue.cap; },

        // ---------- Animation et événements ----------
        animer(nom, delai) {
            const ms = Math.max(10, nombre(delai, 50));
            const id = setInterval(() => appelle(nom, []), ms);
            minuteries.push(id);
            if (window.Pythonerie) window.Pythonerie.signaleAnimation(true);
        },
        quandClic(nom) { gestionnaires.clic = nom; },
        quandSouris(nom) { gestionnaires.souris = nom; },
        quandTouche(nom) { gestionnaires.touche = nom; },
        arrete() {
            minuteries.forEach(clearInterval);
            minuteries = [];
            if (window.Pythonerie) window.Pythonerie.signaleAnimation(false);
        },
        enCours() {
            return minuteries.length > 0 || !!(gestionnaires.clic || gestionnaires.souris || gestionnaires.touche);
        },
        stoppeTout() {
            this.arrete();
            gestionnaires = { clic: null, souris: null, touche: null };
        },

        // Image PNG du dessin
        image() { return canevas.toDataURL('image/png'); }
    };
})();

window.Pyt = Pyt;
