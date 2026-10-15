// =====================================================================
// La 3D de la Pythonerie, avec three.js (docs/vendor/three, licence MIT).
//
// Le programme décrit une scène avec les primitives de la bibliothèque (nouvelle_scène,
// cube, sphère, groupe, lumière, caméra...) : chaque primitive ajoute un dictionnaire à
// la liste cachée de la scène. montre_3d(scène) l'envoie ici d'un coup (Pyt.montre3D) :
// la scène est construite, puis three.js la redessine tout seul, à chaque image du
// navigateur, avec son z-buffer. Ensuite, déplace, tourne, colore... (Pyt.change3D) agissent
// sur les objets par leur numéro ; animer() sert à la logique, comme en 2D.
//
// La couche 3D est un canevas posé SOUS le canevas 2D, qui devient transparent : un texte
// écrit en 2D (un score) reste au-dessus de la scène. Les événements arrivent sur la couche
// du haut (celle de la tortue) : les contrôles de caméra (caméra_libre) l'écoutent.
//
// three.js n'est chargé qu'à la première scène (import dynamique) : un programme 2D ne le
// télécharge pas. Ce qui arrive avant la fin du chargement attend son tour (enAttente).
// =====================================================================

const Scène3D = (function () {
    let THREE = null, OrbitControls = null, chargement = null;
    let options = null;           // { cadre, élémentÉvénements, couleurCSS, image(numéro), largeur(), hauteur() }
    let rendu = null, scène = null, caméra = null, contrôles = null, couche = null;
    let cible = null;             // le point que regarde la caméra
    let objets = new Map();       // numéro -> Object3D
    let textures = new Map();     // numéro d'image -> THREE.Texture : une image n'est envoyée qu'une fois à la carte graphique
    let enAttente = [];           // ce qui attend la fin du chargement de three.js
    let actif = false;            // une scène est montrée
    let boucle = null;
    let génération = 0;           // change à chaque réinitialisation : un chargement tardif ne construit rien
    let erreur = null;            // (message) => signale une erreur dans la console

    function installe(o) { options = o; erreur = o.erreur || null; }

    function charge() {
        if (!chargement) {
            const base = new URL('vendor/three/', document.baseURI).href;
            chargement = Promise.all([import(base + 'three.module.min.js'), import(base + 'OrbitControls.js')])
                .then(([t, o]) => { THREE = t; OrbitControls = o.OrbitControls; })
                .catch((e) => { chargement = null; throw e; });
        }
        return chargement;
    }

    // fait f tout de suite si three.js est prêt, sinon quand il le sera
    function quand(f) {
        if (THREE && rendu) { essaie(f); return; }
        enAttente.push(f);
    }

    function essaie(f) {
        try { f(); } catch (e) { if (erreur) erreur('Erreur dans la 3D : ' + e.message); }
    }

    const couleur = (c) => new THREE.Color(options.couleurCSS(c === undefined || c === null ? 'blanc' : c));
    const degrés = (a) => (Number(a) || 0) * Math.PI / 180;
    const nombre = (x, défaut = 0) => { const n = Number(x); return Number.isFinite(n) ? n : défaut; };

    // ---------- La construction d'un objet, d'après son dictionnaire ----------
    function matériau(e) {
        const m = e.lumineux ? new THREE.MeshBasicMaterial({ color: couleur(e.couleur) })
                             : new THREE.MeshStandardMaterial({ color: couleur(e.couleur), roughness: 0.8, metalness: 0.05 });
        if (e.genre === 'anneau') { m.side = THREE.DoubleSide; m.transparent = true; }
        return m;
    }

    function construit(e) {
        let o;
        switch (e.genre) {
            case 'groupe':
                o = new THREE.Group();
                (e.objets || []).forEach(enfant => { const x = construit(enfant); if (x) o.add(x); });
                break;
            case 'cube': {
                const c = nombre(e.côté, 1);
                o = new THREE.Mesh(new THREE.BoxGeometry(c, c, c), matériau(e));
                break;
            }
            case 'boîte':
                o = new THREE.Mesh(new THREE.BoxGeometry(nombre(e.largeur, 1), nombre(e.hauteur, 1), nombre(e.profondeur, 1)), matériau(e));
                break;
            case 'sphère': {
                // les facettes suivent la taille : une étoile minuscule n'a pas besoin de 1 500 triangles
                const r = nombre(e.rayon, 1), n = Math.max(10, Math.min(48, Math.round(12 + r * 10)));
                o = new THREE.Mesh(new THREE.SphereGeometry(r, n, Math.max(6, Math.round(n * 2 / 3))), matériau(e));
                break;
            }
            case 'cylindre':
                o = new THREE.Mesh(new THREE.CylinderGeometry(nombre(e.rayon, 1), nombre(e.rayon, 1), nombre(e.hauteur, 1), 48), matériau(e));
                break;
            case 'cône':
                o = new THREE.Mesh(new THREE.ConeGeometry(nombre(e.rayon, 1), nombre(e.hauteur, 1), 48), matériau(e));
                break;
            case 'anneau': {
                // couché à plat (dans le plan horizontal), comme l'anneau de Saturne
                const ri = nombre(e.intérieur, 1), re = nombre(e.extérieur, 2);
                const g = new THREE.RingGeometry(ri, re, 96);
                // une texture d'anneau est une bande : du bord intérieur (à gauche) au bord extérieur
                const pos = g.attributes.position, uv = g.attributes.uv;
                for (let i = 0; i < pos.count; i++) {
                    const r = Math.hypot(pos.getX(i), pos.getY(i));
                    uv.setXY(i, (r - ri) / Math.max(1e-6, re - ri), 0.5);
                }
                g.rotateX(-Math.PI / 2);
                o = new THREE.Mesh(g, matériau(e));
                break;
            }
            case 'lumière':
                // decay 0 : l'éclairage ne faiblit pas avec la distance (sinon les planètes lointaines seraient noires)
                o = new THREE.PointLight(couleur(e.couleur || 'blanc'), nombre(e.intensité, 2.5), 0, 0);
                break;
            case 'caméra':
                // la caméra de la scène : sa position, et le point qu'elle regarde
                caméra.position.set(nombre(e.x), nombre(e.y), nombre(e.z));
                cible.set(nombre(e.vx), nombre(e.vy), nombre(e.vz));
                caméra.lookAt(cible);
                if (contrôles) { contrôles.target.copy(cible); contrôles.update(); }
                objets.set(e.numéro, caméra);
                return null;
            default:
                return null;
        }
        o.position.set(nombre(e.x), nombre(e.y), nombre(e.z));
        if (e.texture !== undefined) appliqueTexture(o, e.texture);
        objets.set(e.numéro, o);
        return o;
    }

    function appliqueTexture(o, numéroImage) {
        if (!o.material) return;
        let t = textures.get(numéroImage);
        if (!t) {
            const img = options.image(numéroImage);
            if (!img) { if (erreur) erreur('texture : l\'image ' + numéroImage + ' n\'existe pas (utilise le numéro rendu par charge_image)'); return; }
            t = new THREE.Texture(img);
            t.colorSpace = THREE.SRGBColorSpace;
            if (img.complete && img.naturalWidth) t.needsUpdate = true;
            else img.addEventListener('load', () => { t.needsUpdate = true; }, { once: true });
            textures.set(numéroImage, t);
        }
        o.material.map = t;
        o.material.color = new THREE.Color(0xffffff);   // la texture garde ses vraies couleurs
        o.material.needsUpdate = true;
    }

    // ---------- La couche 3D ----------
    function créeLaCouche() {
        const L = options.largeur(), H = options.hauteur();
        couche = document.createElement('canvas');
        couche.className = 'couche-3d';
        options.cadre.insertBefore(couche, options.cadre.firstChild);
        rendu = new THREE.WebGLRenderer({ canvas: couche, antialias: true, preserveDrawingBuffer: true });
        rendu.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        rendu.setSize(L, H, false);
        scène = new THREE.Scene();
        scène.background = new THREE.Color(0x0b0e2a);
        scène.add(new THREE.AmbientLight(0xffffff, 0.35));
        caméra = new THREE.PerspectiveCamera(50, L / H, 0.1, 5000);
        caméra.position.set(0, 6, 18);
        cible = new THREE.Vector3(0, 0, 0);
        caméra.lookAt(cible);
        const image = () => {
            boucle = requestAnimationFrame(image);
            if (contrôles) contrôles.update();
            rendu.render(scène, caméra);
        };
        boucle = requestAnimationFrame(image);
    }

    // montre_3d(scène) : la scène (un groupe et ses objets, en JSON) devient visible
    function montre(texteJSON) {
        const description = JSON.parse(texteJSON);
        const g = génération;
        actif = true;
        charge().then(() => {
            if (g !== génération) return;
            if (!rendu) créeLaCouche();
            essaie(() => {
                const racine = construit(description);
                if (racine) scène.add(racine);
            });
            const suite = enAttente; enAttente = [];
            suite.forEach(essaie);
        }).catch((e) => { actif = false; if (erreur) erreur('La 3D n\'a pas pu démarrer : ' + e.message); });
    }

    // une primitive appelée après montre_3d : l'objet s'ajoute à la scène montrée
    function ajoute(parent, texteJSON) {
        const e = JSON.parse(texteJSON);
        quand(() => {
            const o = construit(e);
            const p = objets.get(parent);
            if (o) (p && p.isObject3D && p !== caméra ? p : scène).add(o);
        });
    }

    // déplace, tourne, colore, texture, lumineux, cache_objet, montre_objet
    function change(genre, numéro, a, b, c) {
        quand(() => {
            if (genre === 'regarde') {
                // la caméra regarde le point (a, b, c)
                cible.set(nombre(a), nombre(b), nombre(c));
                if (contrôles) contrôles.target.copy(cible);
                caméra.lookAt(cible);
                return;
            }
            const o = objets.get(numéro);
            if (!o) { if (erreur) erreur(genre + ' : il n\'y a pas d\'objet 3D numéro ' + numéro); return; }
            switch (genre) {
                case 'déplace':
                    o.position.set(nombre(a), nombre(b), nombre(c));
                    if (o === caméra) caméra.lookAt(cible);
                    break;
                case 'tourne': o.rotation.x += degrés(a); o.rotation.y += degrés(b); o.rotation.z += degrés(c); break;
                case 'oriente': o.rotation.set(degrés(a), degrés(b), degrés(c)); break;
                case 'colore': if (o.material) o.material.color = couleur(a); else if (o.color) o.color = couleur(a); break;
                case 'texture': appliqueTexture(o, a); break;
                case 'cache': o.visible = false; break;
                case 'montre': o.visible = true; break;
                case 'lumineux':
                    // éclairé par lui-même (le Soleil) : la couleur et la texture sans ombre
                    if (o.material && !o.material.isMeshBasicMaterial) {
                        const m = new THREE.MeshBasicMaterial({ color: o.material.color, map: o.material.map || null, side: o.material.side });
                        o.material.dispose();
                        o.material = m;
                    }
                    break;
            }
        });
    }

    function fond(c) { quand(() => { scène.background = couleur(c); }); }

    // caméra_libre() : la souris (ou le doigt) fait tourner la caméra autour de ce qu'elle regarde ; la molette zoome
    function caméraLibre() {
        quand(() => {
            if (contrôles) return;
            contrôles = new OrbitControls(caméra, options.élémentÉvénements);
            contrôles.target.copy(cible);
            contrôles.enableDamping = true;
            contrôles.update();
        });
    }

    // L'objet 3D sous le point (px, py) du canevas (en points du canevas), ou -1
    function objetSous(px, py) {
        if (!rendu || !actif) return -1;
        const L = options.largeur(), H = options.hauteur();
        const souris = new THREE.Vector2(px / L * 2 - 1, -(py / H) * 2 + 1);
        const rayon = new THREE.Raycaster();
        rayon.setFromCamera(souris, caméra);
        const touchés = rayon.intersectObjects(scène.children, true);
        for (const t of touchés) {
            // l'objet touché, ou le premier de ses parents qui a un numéro
            for (let o = t.object; o; o = o.parent) {
                for (const [n, x] of objets) if (x === o) return n;
            }
        }
        return -1;
    }

    // la taille du canevas a changé (canevas(l, h))
    function dimensionne(L, H) {
        if (!rendu) return;
        rendu.setSize(L, H, false);
        caméra.aspect = L / H;
        caméra.updateProjectionMatrix();
    }

    // Avant chaque exécution : plus de scène, plus de couche 3D
    function réinitialise() {
        génération++;
        actif = false;
        enAttente = [];
        if (boucle) cancelAnimationFrame(boucle);
        boucle = null;
        if (contrôles) contrôles.dispose();
        contrôles = null;
        if (rendu) {
            scène.traverse(o => {
                if (o.geometry) o.geometry.dispose();
                if (o.material) o.material.dispose();
            });
            textures.forEach(t => t.dispose());
            rendu.dispose();
            if (couche) couche.remove();
        }
        rendu = scène = caméra = couche = cible = null;
        objets = new Map();
        textures = new Map();
    }

    return { installe, montre, ajoute, change, fond, caméraLibre, objetSous, dimensionne, réinitialise, actif: () => actif };
})();
