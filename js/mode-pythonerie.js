// =====================================================================
// Pythonerie — coloration syntaxique pour CodeMirror 5
// =====================================================================

const PYTHONERIE_MOTS_CLEFS = [
    'si', 'sinonsi', 'sinon', 'alors', 'tantque', 'pour', 'dans',
    'fonction', 'def', 'retourne', 'renvoie', 'sortir', 'continuer', 'lever',
    'classe', 'soi', 'essaie', 'sauf', 'attrape', 'selon', 'cas',
    'et', 'ou', 'oux', 'non', 'est', 'importe', 'comme', 'lambda',
    'regle', 'motif', 'prolog'
];

const PYTHONERIE_CONSTANTES = ['Vrai', 'Faux', 'Rien', 'True', 'False', 'None', 'pi'];

// Fonctions de la bibliothèque, avec une courte description (complétion et aide)
const PYTHONERIE_FONCTIONS = {
    // Console
    'affiche': 'affiche(a, b, ...) — écrit dans la console puis passe à la ligne',
    'ecris': 'ecris(a, ...) — écrit dans la console sans passer à la ligne (jusqu\'à 8 valeurs)',
    'efface_console': 'efface_console() — vide la console',
    'demande': 'demande(question) — pose une question, renvoie la réponse (texte)',
    'demande_nombre': 'demande_nombre(question) — pose une question, renvoie un nombre',
    'lire': 'lire(question) — comme demande',
    'lire_nombre': 'lire_nombre(question) — comme demande_nombre',
    'input': 'input(question) — comme demande',
    // Conversions
    'longueur': 'longueur(x) — nombre d\'éléments d\'une liste ou d\'une chaîne',
    'len': 'len(x) — comme longueur',
    'entier': 'entier(x) — convertit en nombre entier',
    'reel': 'reel(x) — convertit en nombre à virgule',
    'chaine': 'chaine(x) — convertit en texte',
    'type_de': 'type_de(x) — le type d\'une valeur',
    'intervalle': 'intervalle(fin) ou intervalle(début, fin, pas) — liste de nombres',
    'range': 'range(fin) ou range(début, fin, pas) — liste de nombres',
    // Mathématiques
    'aleatoire': 'aleatoire(a, b) — entier au hasard entre a et b inclus',
    'hasard': 'hasard() — nombre au hasard entre 0 et 1',
    'choisis': 'choisis(liste) — un élément au hasard',
    'absolu': 'absolu(x) — valeur absolue',
    'racine': 'racine(x) — racine carrée',
    'puissance': 'puissance(x, y) — x à la puissance y',
    'arrondi': 'arrondi(x, n) — arrondi à n chiffres après la virgule',
    'somme': 'somme(liste) — somme des éléments',
    'maximum': 'maximum(liste) ou maximum(a, b)',
    'minimum': 'minimum(liste) ou minimum(a, b)',
    'sinus': 'sinus(angle) — angle en degrés',
    'cosinus': 'cosinus(angle) — angle en degrés',
    // Listes et chaînes
    'ajoute': 'liste.ajoute(x) — ajoute x à la fin de la liste',
    'trie': 'trie(liste) — renvoie une copie triée',
    'inverse': 'inverse(liste) — renvoie la liste à l\'envers',
    'majuscules': 'majuscules(texte)',
    'minuscules': 'minuscules(texte)',
    'remplace': 'remplace(texte, avant, après)',
    'decoupe': 'decoupe(texte, séparateur) — découpe en liste',
    'nettoie': 'nettoie(texte) — retire les espaces au début et à la fin',
    'contient': 'contient(conteneur, x) — Vrai si x est dedans',
    'joindre': 'séparateur.joindre(liste) — colle les éléments en un texte',
    // Dessin
    'efface': 'efface() — efface le canevas',
    'fond': 'fond(couleur) — peint tout le canevas',
    'couleur': 'couleur(c) — couleur du trait et du remplissage',
    'couleur_trait': 'couleur_trait(c)',
    'couleur_remplissage': 'couleur_remplissage(c)',
    'epaisseur': 'epaisseur(e) — épaisseur du trait',
    'rgb': 'rgb(r, g, b) — couleur à partir de rouge, vert, bleu (0 à 255)',
    'point': 'point(x, y)',
    'ligne': 'ligne(x1, y1, x2, y2)',
    'rectangle': 'rectangle(x, y, largeur, hauteur)',
    'rectangle_plein': 'rectangle_plein(x, y, largeur, hauteur)',
    'carre': 'carre(x, y, côté)',
    'carre_plein': 'carre_plein(x, y, côté)',
    'cercle': 'cercle(x, y, rayon)',
    'disque': 'disque(x, y, rayon) — cercle plein',
    'ellipse': 'ellipse(x, y, rx, ry)',
    'ellipse_pleine': 'ellipse_pleine(x, y, rx, ry)',
    'triangle': 'triangle(x1, y1, x2, y2, x3, y3)',
    'triangle_plein': 'triangle_plein(x1, y1, x2, y2, x3, y3)',
    'polygone': 'polygone([[x1, y1], [x2, y2], ...])',
    'polygone_plein': 'polygone_plein([[x1, y1], [x2, y2], ...])',
    'texte': 'texte(x, y, message) — écrit dans le canevas',
    'taille_texte': 'taille_texte(n) — taille des lettres en pixels',
    'police': 'police(nom) — "serif", "monospace", "Comic Sans MS"...',
    'largeur': 'largeur() — largeur du canevas (800)',
    'hauteur': 'hauteur() — hauteur du canevas (600)',
    // Tortue
    'avance': 'avance(distance) — la tortue avance',
    'recule': 'recule(distance) — la tortue recule',
    'gauche': 'gauche(angle) — tourne à gauche (degrés)',
    'droite': 'droite(angle) — tourne à droite (degrés)',
    'leve_crayon': 'leve_crayon() — la tortue se déplace sans dessiner',
    'baisse_crayon': 'baisse_crayon() — la tortue dessine à nouveau',
    'va_a': 'va_a(x, y) — déplace la tortue',
    'oriente': 'oriente(angle) — 0 = vers la droite, 90 = vers le bas',
    'origine': 'origine() — ramène la tortue au centre',
    'montre_tortue': 'montre_tortue()',
    'cache_tortue': 'cache_tortue()',
    'position_x': 'position_x() — abscisse de la tortue',
    'position_y': 'position_y() — ordonnée de la tortue',
    'cap': 'cap() — direction de la tortue en degrés',
    // Animation
    'animer': 'animer(fonction, délai) — appelle la fonction toutes les "délai" millisecondes',
    'arrete': 'arrete() — arrête les animations',
    'quand_clic': 'quand_clic(fonction) — appelle fonction(x, y) à chaque clic',
    'quand_souris': 'quand_souris(fonction) — appelle fonction(x, y) quand la souris bouge',
    'quand_touche': 'quand_touche(fonction) — appelle fonction(touche) à chaque touche'
};

// Les accents sont facultatifs : épaisseur = epaisseur, carré = carre, règle = regle
function sansAccents(mot) {
    return mot.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Formes accentuées proposées par la complétion (la bibliothèque est écrite sans accents)
const PYTHONERIE_ACCENTUES = [
    'aléatoire', 'arrête', 'carré', 'carré_plein', 'chaîne', 'découpe', 'écris',
    'épaisseur', 'lève_crayon', 'réel', 'va_à', 'règle'
];

CodeMirror.defineMode('pythonerie', function () {
    const motsClefs = new Set(PYTHONERIE_MOTS_CLEFS);
    const constantes = new Set(PYTHONERIE_CONSTANTES);
    const fonctions = new Set(Object.keys(PYTHONERIE_FONCTIONS));
    const operateurs = /^(?:\*\*|\/\/|[+\-*\/%]=|[<>!=]=|<>|[+\-*\/%<>=^&|])/;

    function chaine(stream, state) {
        const fin = state.chaine;
        while (!stream.eol()) {
            if (fin.length === 3) {
                if (stream.match(fin)) { state.chaine = null; return 'string'; }
                stream.next();
            } else {
                const c = stream.next();
                if (c === '\\') { stream.next(); continue; }
                if (c === fin) { state.chaine = null; return 'string'; }
            }
        }
        // Une chaîne simple ne continue pas à la ligne suivante
        if (fin.length === 1) state.chaine = null;
        return 'string';
    }

    return {
        startState() { return { chaine: null, def: false }; },
        token(stream, state) {
            if (state.chaine) return chaine(stream, state);
            if (stream.eatSpace()) return null;

            if (stream.peek() === '#') { stream.skipToEnd(); return 'comment'; }

            // Chaînes : "..." '...' """...""" '''...''' f"..."
            if (stream.match(/^f?("""|''')/)) {
                state.chaine = stream.current().replace(/^f/, '');
                return chaine(stream, state);
            }
            if (stream.match(/^f?["']/)) {
                state.chaine = stream.current().slice(-1);
                return chaine(stream, state);
            }
            if (stream.peek() === '`') {
                stream.next();
                stream.skipTo('`') ? stream.next() : stream.skipToEnd();
                return 'string-2';
            }

            if (stream.match(/^(?:0x[0-9a-fA-F]+|\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?)/)) return 'number';
            if (stream.match(operateurs)) return 'operator';

            const c = stream.peek();
            if ('()[]{},.:'.indexOf(c) !== -1) { stream.next(); return 'bracket'; }

            if (stream.match(/^[A-Za-zÀ-ÖØ-öø-ÿ_λ][A-Za-zÀ-ÖØ-öø-ÿ_0-9]*/)) {
                const mot = stream.current();
                const bas = sansAccents(mot.toLowerCase());
                if (state.def) { state.def = false; return 'def'; }
                if (motsClefs.has(bas)) {
                    if (bas === 'fonction' || bas === 'def' || bas === 'classe') state.def = true;
                    return 'keyword';
                }
                if (constantes.has(mot)) return 'atom';
                if (fonctions.has(mot) || fonctions.has(sansAccents(mot))) return 'builtin';
                return 'variable';
            }
            stream.next();
            return null;
        },
        lineComment: '#'
    };
});

CodeMirror.defineMIME('text/x-pythonerie', 'pythonerie');

// Complétion : mots-clefs, fonctions de la bibliothèque et mots déjà présents dans le programme
function pythonerieCompletion(cm) {
    const cur = cm.getCursor();
    const ligne = cm.getLine(cur.line);
    let debut = cur.ch, fin = cur.ch;
    while (debut > 0 && /[\wÀ-ÿ]/.test(ligne.charAt(debut - 1))) debut--;
    while (fin < ligne.length && /[\wÀ-ÿ]/.test(ligne.charAt(fin))) fin++;
    const prefixe = sansAccents(ligne.slice(debut, cur.ch).toLowerCase());
    if (!prefixe) return null;

    const vus = new Set();
    const liste = [];
    function ajoute(texte, affichage) {
        const t = sansAccents(texte.toLowerCase());
        if (vus.has(texte) || !t.startsWith(prefixe) || t === prefixe) return;
        vus.add(texte);
        liste.push({ text: texte, displayText: affichage || texte });
    }
    PYTHONERIE_MOTS_CLEFS.forEach(m => ajoute(m, m + '  (mot-clef)'));
    PYTHONERIE_ACCENTUES.forEach(m => {
        const base = sansAccents(m);
        ajoute(m, PYTHONERIE_FONCTIONS[base] ? m + '  — ' + PYTHONERIE_FONCTIONS[base].replace(/^[^—]*— ?/, '') : m + '  (mot-clef)');
    });
    Object.entries(PYTHONERIE_FONCTIONS).forEach(([nom, desc]) => ajoute(nom, desc));
    PYTHONERIE_CONSTANTES.forEach(m => ajoute(m));
    const mots = cm.getValue().match(/[A-Za-zÀ-ÿ_][\wÀ-ÿ]*/g) || [];
    mots.forEach(m => ajoute(m));

    return {
        list: liste.slice(0, 40),
        from: CodeMirror.Pos(cur.line, debut),
        to: CodeMirror.Pos(cur.line, fin)
    };
}
