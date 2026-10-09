// =====================================================================
// Pythonerie — coloration syntaxique pour CodeMirror 5
// =====================================================================

const PYTHONERIE_MOTS_CLEFS = [
    'si', 'sinonsi', 'sinon', 'alors', 'tantque', 'pour', 'dans',
    'fonction', 'def', 'retourne', 'renvoie', 'sortir', 'continuer', 'lever',
    'classe', 'soi', 'essaie', 'sauf', 'attrape', 'selon', 'cas',
    'et', 'ou', 'oux', 'non', 'est', 'importe', 'comme', 'lambda',
    'règle', 'motif', 'prolog'
];

const PYTHONERIE_CONSTANTES = ['Vrai', 'Faux', 'Rien', 'True', 'False', 'None', 'pi'];

// Fonctions de la bibliothèque, avec une courte description (complétion et aide)
const PYTHONERIE_FONCTIONS = {
    // Console
    'affiche': 'affiche(a, b, ...) — écrit dans la console puis passe à la ligne',
    'écris': 'écris(a, ...) — écrit dans la console sans passer à la ligne (jusqu\'à 8 valeurs)',
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
    'réel': 'réel(x) — convertit en nombre à virgule',
    'chaîne': 'chaîne(x) — convertit en texte',
    'type_de': 'type_de(x) — le type d\'une valeur',
    'intervalle': 'intervalle(fin) ou intervalle(début, fin, pas) — liste de nombres',
    'range': 'range(fin) ou range(début, fin, pas) — liste de nombres',
    // Mathématiques
    'aléatoire': 'aléatoire(a, b) — entier au hasard entre a et b inclus',
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
    'découpe': 'découpe(texte, séparateur) — découpe en liste',
    'nettoie': 'nettoie(texte) — retire les espaces au début et à la fin',
    'contient': 'contient(conteneur, x) — Vrai si x est dedans',
    'joindre': 'séparateur.joindre(liste) — colle les éléments en un texte',
    // Dessin
    'efface': 'efface() — efface le canevas',
    'fond': 'fond(couleur) — peint tout le canevas',
    'couleur': 'couleur(c) — couleur du trait et du remplissage',
    'couleur_trait': 'couleur_trait(c)',
    'couleur_remplissage': 'couleur_remplissage(c)',
    'épaisseur': 'épaisseur(e) — épaisseur du trait',
    'rgb': 'rgb(r, g, b) — couleur à partir de rouge, vert, bleu (0 à 255)',
    'point': 'point(x, y)',
    'ligne': 'ligne(x1, y1, x2, y2)',
    'rectangle': 'rectangle(x, y, largeur, hauteur)',
    'rectangle_plein': 'rectangle_plein(x, y, largeur, hauteur)',
    'carré': 'carré(x, y, côté)',
    'carré_plein': 'carré_plein(x, y, côté)',
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
    'canevas': 'canevas(largeur, hauteur) — change la taille du canevas (800 × 600 sinon)',
    'largeur': 'largeur() — largeur du canevas (800 au départ)',
    'hauteur': 'hauteur() — hauteur du canevas (600 au départ)',
    // Tortue
    'avance': 'avance(distance) — la tortue avance',
    'recule': 'recule(distance) — la tortue recule',
    'gauche': 'gauche(angle) — tourne à gauche (degrés)',
    'droite': 'droite(angle) — tourne à droite (degrés)',
    'lève_crayon': 'lève_crayon() — la tortue se déplace sans dessiner',
    'baisse_crayon': 'baisse_crayon() — la tortue dessine à nouveau',
    'va_à': 'va_à(x, y) — déplace la tortue',
    'oriente': 'oriente(angle) — 0 = vers la droite, 90 = vers le bas',
    'origine': 'origine() — ramène la tortue au centre',
    'montre_tortue': 'montre_tortue()',
    'cache_tortue': 'cache_tortue()',
    'position_x': 'position_x() — abscisse de la tortue',
    'position_y': 'position_y() — ordonnée de la tortue',
    'cap': 'cap() — direction de la tortue en degrés',
    // Animation
    'animer': 'animer(fonction, délai) — appelle la fonction toutes les "délai" millisecondes',
    'arrête': 'arrête() — arrête les animations',
    'quand_clic': 'quand_clic(fonction) — appelle fonction(x, y) à chaque clic',
    'quand_souris': 'quand_souris(fonction) — appelle fonction(x, y) quand la souris bouge',
    'quand_touche': 'quand_touche(fonction) — appelle fonction(touche) à chaque touche : "gauche", "droite", "haut", "bas", "espace", "a"…',
    'quand_glisse': 'quand_glisse(fonction) — appelle fonction(x, y) quand la souris bouge avec le bouton appuyé',
    // Images et sons
    'charge_image': 'charge_image(adresse) — charge une image, renvoie son numéro',
    'place_image': 'place_image(numéro, x, y) ou place_image(numéro, x, y, largeur, hauteur) — dessine l\'image',
    'charge_son': 'charge_son(adresse) — charge un son, renvoie son numéro',
    'joue_son': 'joue_son(numéro) — joue le son',
    'charge_données': 'charge_données(nom) — texte d\'un fichier du répertoire Matériels',
    'lit_fichier': 'lit_fichier() — texte d\'un fichier de l\'ordinateur, choisi dans une fenêtre ; lit_fichier("https://…") — texte d\'une adresse Internet',
    'écrit_fichier': 'écrit_fichier(nom, texte) — enregistre le texte dans Téléchargements'
};

// Pour la complétion seulement : taper « mel » propose « mélange »
function sansAccents(mot) {
    return mot.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

CodeMirror.defineMode('pythonerie', function () {
    const motsClefs = new Set(PYTHONERIE_MOTS_CLEFS);
    const constantes = new Set(PYTHONERIE_CONSTANTES);
    const fonctions = new Set(Object.keys(PYTHONERIE_FONCTIONS));
    const opérateurs = /^(?:\*\*|\/\/|[+\-*\/%]=|[<>!=]=|<>|[+\-*\/%<>=^&|])/;

    function chaîne(stream, state) {
        const fin = state.chaîne;
        while (!stream.eol()) {
            if (fin.length === 3) {
                if (stream.match(fin)) { state.chaîne = null; return 'string'; }
                stream.next();
            } else {
                const c = stream.next();
                if (c === '\\') { stream.next(); continue; }
                if (c === fin) { state.chaîne = null; return 'string'; }
            }
        }
        // Une chaîne simple ne continue pas à la ligne suivante
        if (fin.length === 1) state.chaîne = null;
        return 'string';
    }

    return {
        startState() { return { chaîne: null, def: false }; },
        token(stream, state) {
            if (state.chaîne) return chaîne(stream, state);
            if (stream.eatSpace()) return null;

            if (stream.peek() === '#') { stream.skipToEnd(); return 'comment'; }

            // Chaînes : "..." '...' """...""" '''...''' f"..."
            if (stream.match(/^f?("""|''')/)) {
                state.chaîne = stream.current().replace(/^f/, '');
                return chaîne(stream, state);
            }
            if (stream.match(/^f?["']/)) {
                state.chaîne = stream.current().slice(-1);
                return chaîne(stream, state);
            }
            if (stream.peek() === '`') {
                stream.next();
                stream.skipTo('`') ? stream.next() : stream.skipToEnd();
                return 'string-2';
            }

            if (stream.match(/^(?:0x[0-9a-fA-F]+|\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?)/)) return 'number';
            if (stream.match(opérateurs)) return 'operator';

            const c = stream.peek();
            if ('()[]{},.:'.indexOf(c) !== -1) { stream.next(); return 'bracket'; }

            if (stream.match(/^[A-Za-zÀ-ÖØ-öø-ÿ_λ][A-Za-zÀ-ÖØ-öø-ÿ_0-9]*/)) {
                const mot = stream.current();
                const bas = mot.toLowerCase();
                if (state.def) { state.def = false; return 'def'; }
                if (motsClefs.has(bas)) {
                    if (bas === 'fonction' || bas === 'def' || bas === 'classe') state.def = true;
                    return 'keyword';
                }
                if (constantes.has(mot)) return 'atom';
                if (fonctions.has(mot)) return 'builtin';
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
function pythonerieComplétion(cm) {
    const cur = cm.getCursor();
    const ligne = cm.getLine(cur.line);
    let début = cur.ch, fin = cur.ch;
    while (début > 0 && /[\wÀ-ÿ]/.test(ligne.charAt(début - 1))) début--;
    while (fin < ligne.length && /[\wÀ-ÿ]/.test(ligne.charAt(fin))) fin++;
    const préfixe = sansAccents(ligne.slice(début, cur.ch).toLowerCase());
    if (!préfixe) return null;

    const vus = new Set();
    const liste = [];
    function ajoute(texte, affichage) {
        const t = sansAccents(texte.toLowerCase());
        if (vus.has(texte) || !t.startsWith(préfixe) || t === préfixe) return;
        vus.add(texte);
        liste.push({ text: texte, displayText: affichage || texte });
    }
    PYTHONERIE_MOTS_CLEFS.forEach(m => ajoute(m, m + '  (mot-clef)'));
    Object.entries(PYTHONERIE_FONCTIONS).forEach(([nom, desc]) => ajoute(nom, desc));
    PYTHONERIE_CONSTANTES.forEach(m => ajoute(m));
    const mots = cm.getValue().match(/[A-Za-zÀ-ÿ_][\wÀ-ÿ]*/g) || [];
    mots.forEach(m => ajoute(m));

    return {
        list: liste.slice(0, 40),
        from: CodeMirror.Pos(cur.line, début),
        to: CodeMirror.Pos(cur.line, fin)
    };
}
