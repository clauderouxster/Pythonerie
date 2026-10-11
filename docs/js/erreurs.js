// =====================================================================
// Les messages d'erreur de LispE, traduits et simplifiés pour un élève.
// Partagé par la Pythonerie (pythonerie.js) et par les applications Web qu'elle crée
// (appli/appli.js) : les deux montrent les mêmes messages.
// =====================================================================

const ErreursLispE = (function () {
    // Traduit et simplifie les messages d'erreur de LispE
    const TRADUCTIONS = [
        [/Unbound atom: '([^']*)'/i, '« $1 » est inconnu : variable pas encore définie ou nom mal orthographié ?'],
        [/Unknown function: '?([^'\s]*)'?/i, 'La fonction « $1 » n\'existe pas'],
        [/Division by zero/i, 'Division par zéro'],
        [/Function '([^']*)' already declared/i, 'La fonction « $1 » est définie deux fois (dans deux programmes importés, peut-être ?)'],
        [/Wrong number of arguments/i, 'Nombre d\'arguments incorrect'],
        [/Wrong parameter description/i, 'Paramètres mal décrits'],
        [/Index out of bounds|out of range/i, 'Indice en dehors de la liste'],
        [/Unknown key/i, 'Clé absente du dictionnaire'],
        [/Wrong type/i, 'Type de valeur inattendu'],
        [/Expecting a list/i, 'Une liste était attendue'],
        [/No more elements to traverse/i, 'Liste trop courte'],
        // en WebAssembly, LispE arrête un while après 10 millions de tours (sinon la page gèlerait)
        [/too many iterations in a while/i, 'une boucle « tantque » a fait plus de 10 millions de tours : elle ne s\'arrête sans doute jamais.\n   Vérifie que sa condition finit par devenir fausse (ou ajoute un « sortir »).']
    ];

    // Une ligne de la pile d'appels de LispE : "[12] (expression...)" ou "[-] (...)"
    const LIGNE_PILE = /^\[(\d+|-)\] \(/;

    function nettoieErreur(message) {
        let m = String(message && message.message ? message.message : message);
        // Dans le WebAssembly, le message est précédé de la pile d'appels : "[12] (expression...)"
        // Pour une erreur levée exprès (lever, ou lit_fichier...), le haut de la pile est
        // le « throw » lui-même, et parfois un « if » et les fonctions internes de la bibliothèque (_...) :
        // inutile de les montrer, l'endroit utile est l'appel de l'élève qui suit.
        // Le message brut : la pile, une ligne vide, puis le message. Une entrée de la pile
        // peut contenir des sauts de ligne (une chaîne de données, par exemple) : on coupe
        // à la dernière ligne vide.
        let avant = m;
        if (LIGNE_PILE.test(m.trim()) && m.includes('\n\n')) {
            const coupure = m.lastIndexOf('\n\n');
            avant = m.slice(0, coupure);
            m = avant.split('\n').filter(l => LIGNE_PILE.test(l)).join('\n') + '\n' + m.slice(coupure + 2);
        }
        // l'entrée __root__ (tout le programme) n'indique pas d'endroit utile
        const pile = avant.split('\n').filter(l => LIGNE_PILE.test(l) && !/^\[(\d+|-)\] \(__root__\b/.test(l));
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
        // une boucle sans fin : l'endroit donné par LispE ne désigne pas la boucle
        if (/too many iterations in a while/i.test(m)) { ligne = null; pile.length = 0; }
        for (const [motif, français] of TRADUCTIONS) {
            if (motif.test(m)) { m = m.replace(motif, français); break; }
        }
        let texte = /^Erreur/.test(m.trim()) ? m.trim() : 'Erreur : ' + m.trim();
        if (pile.length) texte += '\n   dans le code LispE : ' + pile[0].replace(LIGNE_PILE, '');
        else if (ligne && !levée && !/ligne \d/.test(m)) texte += '\n   (ligne ' + ligne + ' du code LispE)';
        return texte;
    }

    return { nettoieErreur, LIGNE_PILE };
})();
