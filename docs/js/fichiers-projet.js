// =====================================================================
// Les fichiers du projet : les répertoires images, sons et données.
//
// Ils sont rangés dans IndexedDB (le localStorage, limité à quelques Mo, garde
// seulement les programmes). Une copie est gardée en mémoire pour que le programme
// y accède tout de suite : une adresse blob: pour une image ou un son, le texte pour
// des données. Un fichier est désigné par son chemin : « images/chat.png ».
// =====================================================================

const FichiersProjet = (function () {
    'use strict';

    // Les trois répertoires du projet, et les fichiers qu'ils acceptent
    const RÉPERTOIRES = {
        images: { extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'], description: 'images (png, jpg, gif, svg, webp)' },
        sons: { extensions: ['wav', 'mp3', 'ogg'], description: 'sons (wav, mp3, ogg)' },
        données: { extensions: ['txt', 'csv', 'tsv', 'json', 'md'], description: 'données (txt, csv, tsv, json, md)' }
    };
    const TYPES = {
        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp',
        wav: 'audio/wav', mp3: 'audio/mpeg', ogg: 'audio/ogg',
        txt: 'text/plain', csv: 'text/csv', tsv: 'text/tab-separated-values', json: 'application/json', md: 'text/markdown'
    };
    const TAILLE_MAX = 5 * 1024 * 1024;     // 5 Mo par fichier
    const NOM_BASE = 'pythonerie';
    const MAGASIN = 'fichiers';             // chemin -> { chemin, type, blob, modifie }
    const RÉSERVE = 'réserve';              // la sauvegarde temporaire d'un projet (Annuler le chargement)

    const nfc = (s) => String(s).normalize('NFC');
    const extensionDe = (nom) => { const i = nom.lastIndexOf('.'); return i < 0 ? '' : nom.slice(i + 1).toLowerCase(); };

    let base = null;
    const fichiers = new Map();             // chemin -> { chemin, type, taille, blob, url, texte, modifie }

    function ouvreBase() {
        if (base) return Promise.resolve(base);
        return new Promise((résout, rejette) => {
            if (!window.indexedDB) { rejette(new Error('ce navigateur ne permet pas de garder les fichiers du projet')); return; }
            const r = indexedDB.open(NOM_BASE, 1);
            r.onupgradeneeded = () => {
                const b = r.result;
                if (!b.objectStoreNames.contains(MAGASIN)) b.createObjectStore(MAGASIN, { keyPath: 'chemin' });
                if (!b.objectStoreNames.contains(RÉSERVE)) b.createObjectStore(RÉSERVE);
            };
            r.onsuccess = () => { base = r.result; résout(base); };
            r.onerror = () => rejette(r.error || new Error('IndexedDB refuse de s\'ouvrir'));
        });
    }

    function transaction(magasin, mode, action) {
        return ouvreBase().then(b => new Promise((résout, rejette) => {
            const t = b.transaction(magasin, mode);
            const m = t.objectStore(magasin);
            let résultat;
            const r = action(m);
            if (r) r.onsuccess = () => { résultat = r.result; };
            t.oncomplete = () => résout(résultat);
            t.onerror = () => rejette(t.error);
            t.onabort = () => rejette(t.error || new Error('écriture interrompue (place insuffisante ?)'));
        }));
    }

    // La copie en mémoire d'un fichier : adresse blob: (image, son) ou texte (données)
    async function enMémoire(entrée) {
        const ancien = fichiers.get(entrée.chemin);
        if (ancien && ancien.url) URL.revokeObjectURL(ancien.url);
        const f = { chemin: entrée.chemin, type: entrée.type, taille: entrée.blob.size, blob: entrée.blob, modifie: entrée.modifie, url: null, texte: null };
        if (entrée.chemin.startsWith('données/')) f.texte = nfc(await entrée.blob.text()).replace(/\r\n?/g, '\n');
        else f.url = URL.createObjectURL(entrée.blob);
        fichiers.set(entrée.chemin, f);
    }

    function oublie(chemin) {
        const f = fichiers.get(chemin);
        if (f && f.url) URL.revokeObjectURL(f.url);
        fichiers.delete(chemin);
    }

    // Au démarrage : tous les fichiers du projet, en mémoire
    async function charge() {
        const tous = await transaction(MAGASIN, 'readonly', m => m.getAll());
        for (const chemin of [...fichiers.keys()]) oublie(chemin);
        for (const e of tous || []) await enMémoire(e);
    }

    // Le répertoire qui accepte ce nom de fichier (d'après son extension), ou null
    function répertoireDe(nom) {
        const ext = extensionDe(nom);
        for (const [r, info] of Object.entries(RÉPERTOIRES)) if (info.extensions.includes(ext)) return r;
        return null;
    }

    function nomValide(nom) {
        nom = nfc(nom).trim();
        if (!nom || nom.length > 80 || nom.startsWith('.') || /[\/\\:*?"<>|]/.test(nom)) return null;
        return nom;
    }

    // Ajoute (ou remplace) un fichier ; répertoire : celui où on l'a déposé (ou null : d'après l'extension)
    async function ajoute(fichier, répertoire) {
        const nom = nomValide(fichier.name);
        if (!nom) throw new Error('« ' + fichier.name + ' » : ce nom de fichier ne convient pas');
        const attendu = répertoireDe(nom);
        if (!attendu) throw new Error('« ' + nom + ' » : ce genre de fichier n\'est pas accepté dans un projet');
        if (répertoire && répertoire !== attendu) {
            throw new Error('« ' + nom + ' » ne va pas dans le répertoire ' + répertoire + ' : il accepte seulement des ' + RÉPERTOIRES[répertoire].description);
        }
        if (fichier.size > TAILLE_MAX) throw new Error('« ' + nom + ' » est trop gros (' + (fichier.size / 1048576).toFixed(1) + ' Mo ; 5 Mo au plus)');
        const type = TYPES[extensionDe(nom)] || fichier.type || 'application/octet-stream';
        const entrée = { chemin: attendu + '/' + nom, type, blob: new Blob([fichier], { type }), modifie: Date.now() / 1000 };
        await transaction(MAGASIN, 'readwrite', m => m.put(entrée));
        await enMémoire(entrée);
        return entrée.chemin;
    }

    async function supprime(chemin) {
        await transaction(MAGASIN, 'readwrite', m => m.delete(chemin));
        oublie(chemin);
    }

    // Renomme un fichier dans son répertoire (l'extension doit rester du même genre)
    async function renomme(chemin, nouveauNom) {
        const f = fichiers.get(chemin);
        if (!f) throw new Error('« ' + chemin + ' » n\'existe plus');
        const nom = nomValide(nouveauNom);
        const répertoire = chemin.slice(0, chemin.indexOf('/'));
        if (!nom || répertoireDe(nom) !== répertoire) throw new Error('« ' + nouveauNom + ' » : le répertoire ' + répertoire + ' accepte seulement des ' + RÉPERTOIRES[répertoire].description);
        const nouveau = répertoire + '/' + nom;
        if (nouveau === chemin) return chemin;
        if (fichiers.has(nouveau)) throw new Error('« ' + nom + ' » existe déjà');
        const entrée = { chemin: nouveau, type: f.type, blob: f.blob, modifie: Date.now() / 1000 };
        await transaction(MAGASIN, 'readwrite', m => { m.delete(chemin); return m.put(entrée); });
        oublie(chemin);
        await enMémoire(entrée);
        return nouveau;
    }

    // Tous les fichiers, triés par répertoire puis par nom
    function liste() {
        return [...fichiers.values()].sort((a, b) => a.chemin.localeCompare(b.chemin, 'fr', { numeric: true }));
    }

    // Un fichier lu dans un projet (chemin « sons/bravo.wav », octets) : l'entrée à ranger,
    // ou une erreur si le chemin, le genre ou la taille ne conviennent pas
    function entrée(c, octets) {
        const chemin = nfc(c);
        const i = chemin.indexOf('/');
        const répertoire = chemin.slice(0, i), nom = i < 0 ? null : nomValide(chemin.slice(i + 1));
        if (!RÉPERTOIRES[répertoire] || !nom) throw new Error('« ' + chemin + ' » n\'est pas un fichier des répertoires images, sons ou données');
        if (répertoireDe(nom) !== répertoire) throw new Error('« ' + chemin + ' » : le répertoire ' + répertoire + ' accepte seulement des ' + RÉPERTOIRES[répertoire].description);
        if (octets.length > TAILLE_MAX) throw new Error('« ' + chemin + ' » est trop gros (5 Mo au plus)');
        const type = TYPES[extensionDe(nom)] || 'application/octet-stream';
        return { chemin: répertoire + '/' + nom, type, blob: new Blob([octets], { type }), modifie: Date.now() / 1000 };
    }

    // Les fichiers tels qu'ils sont, pour une sauvegarde temporaire ou un remplacement
    function instantané() {
        return liste().map(f => ({ chemin: f.chemin, type: f.type, blob: f.blob, modifie: f.modifie }));
    }

    // Remplace tous les fichiers du projet par ceux-ci (liste d'entrées { chemin, type, blob })
    async function remplace(entrées) {
        await transaction(MAGASIN, 'readwrite', m => { m.clear(); entrées.forEach(e => m.put(e)); return null; });
        for (const chemin of [...fichiers.keys()]) oublie(chemin);
        for (const e of entrées) await enMémoire(e);
    }

    // La sauvegarde temporaire d'un projet entier (programmes et fichiers), pour « Annuler »
    async function gardeRéserve(projet) { await transaction(RÉSERVE, 'readwrite', m => m.put(projet, 'projet')); }
    async function litRéserve() { return transaction(RÉSERVE, 'readonly', m => m.get('projet')); }
    async function videRéserve() { await transaction(RÉSERVE, 'readwrite', m => m.delete('projet')); }

    return {
        RÉPERTOIRES, TAILLE_MAX,
        charge, liste, ajoute, supprime, renomme, répertoireDe,
        entrée, instantané, remplace,
        gardeRéserve, litRéserve, videRéserve,
        existe: (chemin) => fichiers.has(nfc(chemin)),
        // l'adresse blob: d'une image ou d'un son du projet ("" s'il n'y est pas)
        url: (chemin) => { const f = fichiers.get(nfc(chemin)); return f && f.url ? f.url : ''; },
        // le texte d'un fichier de données du projet (null s'il n'y est pas)
        texte: (chemin) => { const f = fichiers.get(nfc(chemin)); return f && f.texte !== null ? f.texte : null; },
        nombre: () => fichiers.size,
        blob: (chemin) => { const f = fichiers.get(nfc(chemin)); return f ? f.blob : null; }
    };
})();
