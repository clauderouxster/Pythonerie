// =====================================================================
// Zip : écrire et lire une archive .zip, le format des projets exportés.
//
// Sans bibliothèque : le navigateur compresse lui-même (CompressionStream et
// DecompressionStream, méthode « deflate »). Les noms sont écrits en UTF-8. On lit
// les archives faites par la Pythonerie, par Python (zipfile) ou par le système
// (« Compresser » du Finder, de l'Explorateur Windows) : méthodes 0 (sans
// compression) et 8 (deflate), sans chiffrement ni Zip64 (assez pour un projet).
// =====================================================================

const Zip = (function () {
    'use strict';

    const TABLE_CRC = (() => {
        const t = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            t[n] = c >>> 0;
        }
        return t;
    })();

    function crc32(octets) {
        let c = 0xffffffff;
        for (let i = 0; i < octets.length; i++) c = TABLE_CRC[(c ^ octets[i]) & 0xff] ^ (c >>> 8);
        return (c ^ 0xffffffff) >>> 0;
    }

    async function transforme(octets, flux) {
        return new Uint8Array(await new Response(new Blob([octets]).stream().pipeThrough(flux)).arrayBuffer());
    }

    // La date et l'heure, au format de MS-DOS (celui du zip)
    function dateDOS(d) {
        return {
            heure: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
            jour: ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
        };
    }

    // entrées : [{ nom, octets (Uint8Array) }] ; un nom qui finit par « / » est un répertoire.
    // Chaque fichier est compressé, sauf s'il n'y gagne rien (images, mp3...). Renvoie un Blob.
    async function écrit(entrées, date = new Date()) {
        const enc = new TextEncoder();
        const { heure, jour } = dateDOS(date);
        const morceaux = [], central = [];
        let position = 0;
        for (const e of entrées) {
            const nom = enc.encode(e.nom);
            const brut = e.octets || new Uint8Array(0);
            let données = brut, méthode = 0;
            if (brut.length && typeof CompressionStream !== 'undefined') {
                const c = await transforme(brut, new CompressionStream('deflate-raw'));
                if (c.length < brut.length) { données = c; méthode = 8; }
            }
            const crc = crc32(brut);
            const local = new DataView(new ArrayBuffer(30));
            local.setUint32(0, 0x04034b50, true);       // en-tête local
            local.setUint16(4, 20, true);               // version nécessaire : 2.0
            local.setUint16(6, 0x0800, true);           // noms en UTF-8
            local.setUint16(8, méthode, true);
            local.setUint16(10, heure, true);
            local.setUint16(12, jour, true);
            local.setUint32(14, crc, true);
            local.setUint32(18, données.length, true);
            local.setUint32(22, brut.length, true);
            local.setUint16(26, nom.length, true);
            morceaux.push(local.buffer, nom, données);
            const c = new DataView(new ArrayBuffer(46));
            c.setUint32(0, 0x02014b50, true);           // entrée du répertoire central
            c.setUint16(4, 20, true);
            c.setUint16(6, 20, true);
            c.setUint16(8, 0x0800, true);
            c.setUint16(10, méthode, true);
            c.setUint16(12, heure, true);
            c.setUint16(14, jour, true);
            c.setUint32(16, crc, true);
            c.setUint32(20, données.length, true);
            c.setUint32(24, brut.length, true);
            c.setUint16(28, nom.length, true);
            c.setUint32(38, e.nom.endsWith('/') ? 0x10 : 0, true);   // attribut « répertoire »
            c.setUint32(42, position, true);
            central.push(c.buffer, nom);
            position += 30 + nom.length + données.length;
        }
        const tailleCentral = central.reduce((s, m) => s + m.byteLength, 0);
        const fin = new DataView(new ArrayBuffer(22));
        fin.setUint32(0, 0x06054b50, true);             // fin du répertoire central
        fin.setUint16(8, entrées.length, true);
        fin.setUint16(10, entrées.length, true);
        fin.setUint32(12, tailleCentral, true);
        fin.setUint32(16, position, true);
        return new Blob([...morceaux, ...central, fin.buffer], { type: 'application/zip' });
    }

    // Lit une archive (ArrayBuffer) : [{ nom, octets }] ; un répertoire a un nom en « / »
    // et pas d'octets. garde(nom) choisit les fichiers à décompresser (tous par défaut) ;
    // tailleMax limite la taille d'un fichier décompressé.
    async function lit(tampon, { garde = () => true, tailleMax = 50 * 1024 * 1024 } = {}) {
        const o = new Uint8Array(tampon);
        const v = new DataView(o.buffer, o.byteOffset, o.byteLength);
        let fin = -1;
        for (let i = o.length - 22; i >= Math.max(0, o.length - 22 - 0xffff); i--) {
            if (v.getUint32(i, true) === 0x06054b50) { fin = i; break; }
        }
        if (fin < 0) throw new Error('ce n\'est pas un fichier zip');
        const nombre = v.getUint16(fin + 10, true);
        let p = v.getUint32(fin + 16, true);
        const utf8 = new TextDecoder('utf-8');
        const sortie = [];
        for (let k = 0; k < nombre; k++) {
            if (p + 46 > o.length || v.getUint32(p, true) !== 0x02014b50) throw new Error('le fichier zip est abîmé');
            const drapeaux = v.getUint16(p + 8, true), méthode = v.getUint16(p + 10, true);
            const crc = v.getUint32(p + 16, true), taille = v.getUint32(p + 20, true), tailleBrute = v.getUint32(p + 24, true);
            const lgNom = v.getUint16(p + 28, true), lgExtra = v.getUint16(p + 30, true), lgCom = v.getUint16(p + 32, true);
            const local = v.getUint32(p + 42, true);
            // macOS écrit les accents décomposés (é = e + ´) : on les recompose
            const nom = utf8.decode(o.subarray(p + 46, p + 46 + lgNom)).normalize('NFC').replace(/\\/g, '/');
            p += 46 + lgNom + lgExtra + lgCom;
            if (nom.endsWith('/')) { sortie.push({ nom, octets: null }); continue; }
            if (!garde(nom)) continue;
            if (drapeaux & 1) throw new Error('« ' + nom + ' » est protégé par un mot de passe');
            if (taille === 0xffffffff || tailleBrute > tailleMax) throw new Error('« ' + nom + ' » est trop gros');
            if (local + 30 > o.length || v.getUint32(local, true) !== 0x04034b50) throw new Error('le fichier zip est abîmé');
            const début = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
            const données = o.subarray(début, début + taille);
            let octets;
            if (méthode === 0) octets = données.slice();
            else if (méthode === 8) octets = await transforme(données, new DecompressionStream('deflate-raw'));
            else throw new Error('« ' + nom + ' » est compressé d\'une façon que la Pythonerie ne connaît pas');
            if (octets.length !== tailleBrute || crc32(octets) !== crc) {
                throw new Error('« ' + nom + ' » est abîmé dans le fichier zip');
            }
            sortie.push({ nom, octets });
        }
        return sortie;
    }

    return { écrit, lit };
})();
