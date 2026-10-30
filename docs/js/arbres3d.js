// Des arbres de plusieurs essences, pour la 3D (scène.arbre(x, y, z, "chêne"), voir scene3d.js) ;
// le même fichier que celui de The Atelier of the Apps, à garder synchrones. Un module sans dépendance :
// three.js lui est donné. Ils sont faits ici de formes simples de three.js, à facettes comme les modèles de Kenney, en
// mètres, le pied du tronc en (0, 0, 0). Chaque arbre reçoit une graine (tirée de sa position) :
// deux chênes voisins n'ont pas tout à fait la même silhouette, mais un arbre reste le même d'un
// dessin à l'autre.
//   hauteur : la hauteur à peu près de l'arbre ; rayon : ce qui bloque le passage (le tronc)

export const ARBRES = {
    oak: { description: 'an oak: a thick trunk and a broad, rounded crown', hauteur: 7, rayon: 0.5 },
    poplar: { description: 'a poplar: tall and slender, like a green column', hauteur: 11, rayon: 0.35 },
    weeping_willow: { description: 'a weeping willow: long branches hanging down to the ground', hauteur: 7, rayon: 0.5 },
    birch: { description: 'a white birch: a white trunk with black marks, a light crown', hauteur: 8, rayon: 0.3 },
    fir: { description: 'a fir tree: a dark green cone', hauteur: 8, rayon: 0.45 },
    maple: { description: 'a maple in autumn, red and orange', hauteur: 7, rayon: 0.45 },
    cherry_tree: { description: 'a cherry tree in bloom, pink', hauteur: 5, rayon: 0.35 },
    apple_tree: { description: 'an apple tree with red apples', hauteur: 4.5, rayon: 0.35 },
    palm_tree: { description: 'a palm tree: a curved trunk and long leaves', hauteur: 7, rayon: 0.35 },
    cypress: { description: 'a cypress: very narrow and dark, like a flame', hauteur: 9, rayon: 0.35 }
};

// un tirage pseudo-aléatoire reproductible (mulberry32)
function hasard(graine) {
    let a = (graine >>> 0) || 1;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function fabriqueArbre(THREE, genre, graine = 1) {
    const aléa = hasard(graine * 2654435761 + genre.length * 97);
    const entre = (a, b) => a + (b - a) * aléa();
    const matériaux = new Map();
    const mat = (couleur) => {
        if (!matériaux.has(couleur)) matériaux.set(couleur, new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.9, flatShading: true }));
        return matériaux.get(couleur);
    };
    const g = new THREE.Group();
    g.name = genre;
    const ajoute = (géométrie, couleur, x, y, z) => {
        const m = new THREE.Mesh(géométrie, mat(couleur));
        m.position.set(x, y, z);
        m.castShadow = true;
        g.add(m);
        return m;
    };
    // une boule de feuillage bosselée : un icosaèdre dont les sommets sont un peu déplacés
    const boule = (r, couleur, x, y, z, sx = 1, sy = 1, sz = 1) => {
        const géo = new THREE.IcosahedronGeometry(r, 1);
        const p = géo.attributes.position, vus = new Map();
        for (let i = 0; i < p.count; i++) {
            // les sommets partagés bougent ensemble, sinon la boule se déchire
            const clé = p.getX(i).toFixed(3) + ',' + p.getY(i).toFixed(3) + ',' + p.getZ(i).toFixed(3);
            if (!vus.has(clé)) vus.set(clé, entre(0.85, 1.12));
            const k = vus.get(clé);
            p.setXYZ(i, p.getX(i) * k * sx, p.getY(i) * k * sy, p.getZ(i) * k * sz);
        }
        géo.computeVertexNormals();
        return ajoute(géo, couleur, x, y, z);
    };
    // un tronc ou une branche, d'un point à un autre
    const branche = (r1, r2, couleur, a, b, côtés = 7) => {
        const d = new THREE.Vector3().subVectors(b, a), l = d.length();
        const m = ajoute(new THREE.CylinderGeometry(r2, r1, l, côtés), couleur, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
        return m;
    };
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const couronne = (n, r, couleurs, cy, étalement, hauteur, taille) => {
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + entre(-0.3, 0.3), d = entre(0.3, 1) * étalement;
            boule(r * entre(0.75, 1.1) * taille, couleurs[i % couleurs.length], Math.cos(a) * d, cy + entre(-hauteur, hauteur), Math.sin(a) * d);
        }
    };

    switch (genre) {
    case 'oak': {
        const écorce = '#5a4128';
        branche(0.42, 0.3, écorce, V(0, 0, 0), V(0, 2.6, 0));
        for (let i = 0; i < 4; i++) {
            const a = i * Math.PI / 2 + entre(-0.4, 0.4);
            branche(0.2, 0.1, écorce, V(0, 2.4, 0), V(Math.cos(a) * 1.6, entre(3.6, 4.2), Math.sin(a) * 1.6), 6);
        }
        boule(2.3, '#3f6b2a', 0, 4.8, 0, 1.15, 0.8, 1.15);
        couronne(7, 1.4, ['#4a7a30', '#3a6326', '#557f34'], 4.6, 2.2, 0.6, 1);
        boule(1.4, '#4f7d32', 0, 6.1, 0);
        break;
    }
    case 'poplar': {
        branche(0.25, 0.12, '#7a6a55', V(0, 0, 0), V(0, 4, 0));
        boule(1.3, '#5f9a3a', 0, 6.8, 0, 1, 3.4, 1);
        for (let i = 0; i < 5; i++) {
            const a = entre(0, Math.PI * 2);
            boule(0.8, i % 2 ? '#6aa542' : '#548c33', Math.cos(a) * 0.6, entre(4.5, 9.5), Math.sin(a) * 0.6, 1, 1.6, 1);
        }
        break;
    }
    case 'weeping_willow': {
        const écorce = '#5e4a32';
        branche(0.38, 0.28, écorce, V(0, 0, 0), V(entre(-0.2, 0.2), 3, entre(-0.2, 0.2)));
        boule(2.2, '#8aa83e', 0, 5, 0, 1.2, 0.7, 1.2);
        boule(1.4, '#9ab64a', 0, 6, 0);
        // les longues branches qui tombent, en rideau autour de la couronne
        const n = 34;
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + entre(-0.08, 0.08), d = entre(1.9, 2.6), long = entre(3, 4.3);
            const m = ajoute(new THREE.ConeGeometry(entre(0.22, 0.34), long, 4), i % 3 ? '#8eae42' : '#a6c056',
                Math.cos(a) * d, 5.1 - long / 2, Math.sin(a) * d);
            m.rotation.x = Math.PI;                      // la pointe en bas
            m.rotation.y = a;
        }
        for (let i = 0; i < 14; i++) {
            const a = (i / 14) * Math.PI * 2 + entre(-0.2, 0.2), d = entre(0.9, 1.5), long = entre(2, 3);
            const m = ajoute(new THREE.ConeGeometry(0.25, long, 4), '#7f9f3a', Math.cos(a) * d, 4.7 - long / 2, Math.sin(a) * d);
            m.rotation.x = Math.PI;
        }
        break;
    }
    case 'birch': {
        const blanc = '#eeebe2', noir = '#2a2826';
        const haut = V(entre(-0.25, 0.25), 6, entre(-0.25, 0.25));
        branche(0.2, 0.1, blanc, V(0, 0, 0), haut);
        // les marques noires de l'écorce
        for (let i = 0; i < 14; i++) {
            const t = entre(0.05, 0.85), y = t * 6, r = 0.2 - 0.1 * t + 0.005;
            const a = entre(0, Math.PI * 2);
            const m = ajoute(new THREE.BoxGeometry(entre(0.08, 0.16), entre(0.04, 0.1), 0.03), noir,
                haut.x * t + Math.cos(a) * r, y, haut.z * t + Math.sin(a) * r);
            m.rotation.y = -a + Math.PI / 2;
        }
        for (let i = 0; i < 3; i++) {
            const a = i * 2.1 + entre(-0.3, 0.3);
            branche(0.06, 0.03, blanc, V(haut.x * 0.6, 3.6 + i * 0.6, haut.z * 0.6), V(Math.cos(a) * 1.1, 4.8 + i * 0.5, Math.sin(a) * 1.1), 5);
        }
        couronne(8, 0.9, ['#8fc04e', '#a2cc5c', '#7fb444'], 5.8, 1.1, 1.1, 1);
        boule(0.9, '#98c656', haut.x, 7.3, haut.z, 1, 1.2, 1);
        break;
    }
    case 'fir': {
        branche(0.22, 0.16, '#4e3a26', V(0, 0, 0), V(0, 1.4, 0));
        const étages = 5;
        for (let i = 0; i < étages; i++) {
            const t = i / étages, r = 2.2 * (1 - t * 0.78), h = 2.4 - t * 0.9;
            const m = ajoute(new THREE.ConeGeometry(r, h, 8), i % 2 ? '#2f5a34' : '#27502d', 0, 1.0 + i * 1.35 + h / 2, 0);
            m.rotation.y = entre(0, Math.PI);
        }
        break;
    }
    case 'maple': {
        branche(0.34, 0.22, '#4a3626', V(0, 0, 0), V(0, 2.8, 0));
        for (let i = 0; i < 3; i++) {
            const a = i * 2.1 + entre(-0.3, 0.3);
            branche(0.16, 0.08, '#4a3626', V(0, 2.6, 0), V(Math.cos(a) * 1.3, 4, Math.sin(a) * 1.3), 6);
        }
        boule(2.2, '#d2501e', 0, 4.9, 0, 1.05, 0.95, 1.05);
        couronne(7, 1.2, ['#e8742a', '#c43a1a', '#f0a02c', '#d85a22'], 5, 1.9, 0.8, 1);
        break;
    }
    case 'cherry_tree': {
        branche(0.22, 0.14, '#5a3a32', V(0, 0, 0), V(0, 1.8, 0));
        for (let i = 0; i < 4; i++) {
            const a = i * Math.PI / 2 + entre(-0.4, 0.4);
            branche(0.11, 0.06, '#5a3a32', V(0, 1.7, 0), V(Math.cos(a) * 1.3, entre(2.7, 3.2), Math.sin(a) * 1.3), 5);
        }
        boule(1.7, '#f2b8cf', 0, 3.5, 0, 1.15, 0.8, 1.15);
        couronne(8, 0.9, ['#f6c6d8', '#ea9cbc', '#fbdde8'], 3.5, 1.7, 0.6, 1);
        break;
    }
    case 'apple_tree': {
        branche(0.22, 0.15, '#5a4128', V(0, 0, 0), V(0, 1.6, 0));
        boule(1.7, '#4f8a32', 0, 3, 0, 1.15, 0.85, 1.15);
        couronne(6, 0.9, ['#5a963a', '#46802c'], 3.1, 1.5, 0.5, 1);
        // les pommes, sur le bord de la couronne
        for (let i = 0; i < 16; i++) {
            const a = entre(0, Math.PI * 2), h = entre(-0.7, 0.9);
            const d = 1.9 * Math.sqrt(1 - (h / 1.6) ** 2);
            ajoute(new THREE.SphereGeometry(0.11, 6, 4), '#d22a22', Math.cos(a) * d, 3 + h, Math.sin(a) * d);
        }
        break;
    }
    case 'palm_tree': {
        // un tronc courbé, en segments annelés
        const sens = entre(0, Math.PI * 2), cx = Math.cos(sens), cz = Math.sin(sens);
        let a = V(0, 0, 0);
        const n = 9;
        for (let i = 1; i <= n; i++) {
            const t = i / n;
            const b = V(cx * 1.2 * t * t, 6.2 * t, cz * 1.2 * t * t);
            branche(0.24 - 0.08 * t, 0.22 - 0.08 * t, i % 2 ? '#9a7a52' : '#8a6a44', a, b, 7);
            a = b;
        }
        // les palmes : de longues feuilles plates qui retombent
        for (let i = 0; i < 9; i++) {
            const ang = (i / 9) * Math.PI * 2 + entre(-0.15, 0.15);
            const palme = new THREE.Group();
            palme.position.copy(a);
            palme.rotation.y = -ang;
            // des segments qui se chevauchent et s'inclinent de plus en plus : la palme ploie
            let x = 0, y = 0;
            for (let k = 0; k < 5; k++) {
                const pente = 0.15 + k * 0.28, l = 0.85;
                const m = new THREE.Mesh(new THREE.BoxGeometry(l + 0.15, 0.05, 0.75 - k * 0.12), mat(k % 2 ? '#3f8a34' : '#4a9a3c'));
                m.position.set(x + Math.cos(pente) * l / 2, y - Math.sin(pente) * l / 2, 0);
                m.rotation.z = -pente;
                x += Math.cos(pente) * l; y -= Math.sin(pente) * l;
                m.castShadow = true;
                palme.add(m);
            }
            g.add(palme);
        }
        for (let i = 0; i < 4; i++) ajoute(new THREE.SphereGeometry(0.14, 6, 4), '#6a4a26', a.x + entre(-0.2, 0.2), a.y - 0.2, a.z + entre(-0.2, 0.2));
        break;
    }
    case 'cypress': {
        branche(0.18, 0.12, '#4a3a2a', V(0, 0, 0), V(0, 1, 0));
        boule(0.95, '#2c4a2a', 0, 4.8, 0, 1, 4.2, 1);
        for (let i = 0; i < 4; i++) {
            const a = entre(0, Math.PI * 2);
            boule(0.55, '#34552f', Math.cos(a) * 0.4, entre(2.5, 7), Math.sin(a) * 0.4, 1, 2, 1);
        }
        break;
    }
    }
    return g;
}
