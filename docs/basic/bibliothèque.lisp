;Date: 08/10/2026
;Description: Bibliothèque d'exécution de Pythonerie
; Ce fichier est chargé dans l'interpréteur LispE avant chaque programme.
; Les noms suivent l'orthographe française : épaisseur, aléatoire, carré, va_à...
; Il définit les fonctions françaises du langage et les instructions de dessin,
; qui appellent l'objet JavaScript "Pyt" (voir js/canevas.js) via evaljs.
;
; (evaljs (list "Pyt.cercle" x y r)) exécute en JavaScript : Pyt.cercle(x, y, r);
; les arguments sont convertis en JSON.

; Une valeur renvoyée par JavaScript est toujours une chaîne : on la convertit en nombre
(defun js_nombre (s) (float s))

;------------------------------------------------------------------
; Console
;------------------------------------------------------------------
(defun efface_console () (evaljs "Pyt.effaceConsole()") nil)

; écris(a, b, ...) écrit sans passer à la ligne. Dans le WebAssembly, chaque print de
; LispE arrive comme une ligne complète : on passe donc par la console JavaScript.
; defpat permet d'accepter de 1 à 8 arguments sous le même nom.
(defun _écris_liste (valeurs)
   (evaljs (list "Pyt.écris" (join (maplist '_texte valeurs false) " ")))
   nil)
(defpat écris (a) (_écris_liste (list a)))
(defpat écris (a b) (_écris_liste (list a b)))
(defpat écris (a b c) (_écris_liste (list a b c)))
(defpat écris (a b c d) (_écris_liste (list a b c d)))
(defpat écris (a b c d e) (_écris_liste (list a b c d e)))
(defpat écris (a b c d e f) (_écris_liste (list a b c d e f)))
(defpat écris (a b c d e f g) (_écris_liste (list a b c d e f g)))
(defpat écris (a b c d e f g h) (_écris_liste (list a b c d e f g h)))

; Pose une question à l'utilisateur et renvoie sa réponse (une chaîne)
(defun demande ((question ""))
   (evaljs (list "Pyt.demande" (string question))))

; Pose une question et renvoie la réponse sous forme de nombre
(defun demande_nombre ((question ""))
   (float (demande question)))

; Synonymes : lire("Ton nom ?"), lire_nombre(...), et input(...) comme en Python
(defun lire ((question "")) (demande question))
(defun lire_nombre ((question "")) (demande_nombre question))
(defun input ((question "")) (demande question))

;------------------------------------------------------------------
; Conversions et utilitaires
;------------------------------------------------------------------
(defun longueur (x) (size x))
(defun entier (x) (integer x))
(defun réel (x) (float x))
; nombre(x) : un nombre à virgule, à partir d'un texte (« 2,5 » ou « 2.5 ») ; un texte
; vide ou qui n'est pas un nombre donne 0.0
(defun nombre (x)
   (if (stringp x)
      (number (replace (trim x) "," "."))
      (float x)))
(defun chaîne (x) (_texte x))
(defun chaine (x) (_texte x))
(defun type_de (x) (type x))

; intervalle(5) -> [0,1,2,3,4] ; intervalle(2, 5) -> [2,3,4] ; intervalle(0, 10, 2)
(defun intervalle (a (b nil) (pas 1))
   (if (nullp b)
      (range 0 a 1)
      (range a b pas)))

; Nombre entier au hasard entre a et b (inclus)
(defun aléatoire (a b)
   (integer (evaljs (list "Pyt.aléatoire" a b))))

; Nombre réel au hasard entre 0 et 1
(defun hasard ()
   (float (evaljs "Math.random()")))

; Choisit un élément au hasard dans une liste
(defun choisis (liste)
   (@ liste (aléatoire 0 (- (size liste) 1))))

(defun absolu (x) (fabs x))
(defun abs (x) (fabs x))
(defun racine (x) (sqrt x))
(defun puissance (x y) (** x y))
(defun somme (liste) (sum liste))
(defun maximum (a (b nil)) (if (nullp b) (max a) (max a b)))
(defun minimum (a (b nil)) (if (nullp b) (min a) (min a b)))

; arrondi(3.14159) -> 3 ; arrondi(3.14159, 2) -> 3.14
(defun arrondi (x (n 0))
   (ife (eq n 0)
      (round x)
      (setq p (** 10 n))
      (/ (round (* x p)) p)))

; Trigonométrie en degrés
(setq pi _pi)
(defun sinus (degrés) (sin (* (float degrés) (/ _pi 180))))
(defun cosinus (degrés) (cos (* (float degrés) (/ _pi 180))))

; Listes
(defun trie (liste) (sort '< (clone liste)))
(defun inverse (liste) (reverse liste))

; Chaînes de caractères
(defun majuscules (s) (upper s))
(defun minuscules (s) (lower s))
(defun remplace (s avant après) (replace s avant après))
(defun découpe (s (séparateur " ")) (split s séparateur))
(defun nettoie (s) (trim s))
(defun contient (conteneur x) (in_it conteneur x))

;------------------------------------------------------------------
; Couleurs
;------------------------------------------------------------------
; rgb(255, 0, 0) -> "rgb(255,0,0)"
(defun rgb (r g b) (+ "rgb(" (string (integer r)) "," (string (integer g)) "," (string (integer b)) ")"))

;------------------------------------------------------------------
; Dessin dans le canevas
; Comme en Python, les fonctions qui agissent sans calculer de valeur renvoient Rien
; (la console n'affiche donc rien après cercle(...) ou avance(...)).
;------------------------------------------------------------------
(defun efface () (evaljs "Pyt.efface()") nil)
(defun fond (c) (evaljs (list "Pyt.fond" c)) nil)
(defun couleur (c) (evaljs (list "Pyt.couleur" c)) nil)
(defun couleur_trait (c) (evaljs (list "Pyt.couleurTrait" c)) nil)
(defun couleur_remplissage (c) (evaljs (list "Pyt.couleurRemplissage" c)) nil)
(defun épaisseur (e) (evaljs (list "Pyt.épaisseur" e)) nil)

(defun point (x y) (evaljs (list "Pyt.point" x y)) nil)
(defun ligne (x1 y1 x2 y2) (evaljs (list "Pyt.ligne" x1 y1 x2 y2)) nil)
(defun rectangle (x y l h) (evaljs (list "Pyt.rectangle" x y l h false)) nil)
(defun rectangle_plein (x y l h) (evaljs (list "Pyt.rectangle" x y l h true)) nil)
(defun carré (x y côté) (evaljs (list "Pyt.rectangle" x y côté côté false)) nil)
(defun carré_plein (x y côté) (evaljs (list "Pyt.rectangle" x y côté côté true)) nil)
(defun cercle (x y r) (evaljs (list "Pyt.cercle" x y r false)) nil)
(defun disque (x y r) (evaljs (list "Pyt.cercle" x y r true)) nil)
(defun ellipse (x y rx ry) (evaljs (list "Pyt.ellipse" x y rx ry false)) nil)
(defun ellipse_pleine (x y rx ry) (evaljs (list "Pyt.ellipse" x y rx ry true)) nil)
(defun triangle (x1 y1 x2 y2 x3 y3) (evaljs (list "Pyt.polygone" (json (list (list x1 y1) (list x2 y2) (list x3 y3))) false)) nil)
(defun triangle_plein (x1 y1 x2 y2 x3 y3) (evaljs (list "Pyt.polygone" (json (list (list x1 y1) (list x2 y2) (list x3 y3))) true)) nil)
; points est une liste de couples : [[0,0], [100,0], [50,80]]
; Les listes imbriquées sont passées en JSON : evaljs réévaluerait chaque sous-liste
(defun polygone (points) (evaljs (list "Pyt.polygone" (json points) false)) nil)
(defun polygone_plein (points) (evaljs (list "Pyt.polygone" (json points) true)) nil)

; Texte
(defun texte (x y message) (evaljs (list "Pyt.texte" x y (string message))) nil)
(defun taille_texte (n) (evaljs (list "Pyt.tailleTexte" n)) nil)
(defun police (nom) (evaljs (list "Pyt.police" nom)) nil)

; Dimensions du canevas : 800 x 600, sauf si le programme appelle canevas(largeur, hauteur)
; (défini plus bas, avec les autres fonctions qui peuvent signaler une erreur)
(defun largeur () (float (evaljs "Pyt.largeur()")))
(defun hauteur () (float (evaljs "Pyt.hauteur()")))

;------------------------------------------------------------------
; La tortue
;------------------------------------------------------------------
(defun avance (d) (evaljs (list "Pyt.avance" d)) nil)
(defun recule (d) (evaljs (list "Pyt.avance" (* -1 d))) nil)
(defun gauche (a) (evaljs (list "Pyt.tourne" (* -1 a))) nil)
(defun droite (a) (evaljs (list "Pyt.tourne" a)) nil)
(defun lève_crayon () (evaljs (list "Pyt.crayon" false)) nil)
(defun baisse_crayon () (evaljs (list "Pyt.crayon" true)) nil)
(defun va_à (x y) (evaljs (list "Pyt.vaÀ" x y)) nil)
(defun oriente (angle) (evaljs (list "Pyt.oriente" angle)) nil)
(defun origine () (evaljs "Pyt.origine()") nil)
(defun montre_tortue () (evaljs (list "Pyt.montreTortue" true)) nil)
(defun cache_tortue () (evaljs (list "Pyt.montreTortue" false)) nil)
(defun position_x () (float (evaljs "Pyt.tortueX()")))
(defun position_y () (float (evaljs "Pyt.tortueY()")))
(defun cap () (float (evaljs "Pyt.tortueCap()")))

;------------------------------------------------------------------
; Animation et événements
; La fonction peut être donnée par son nom : animer(bouge, 30) ou animer("bouge", 30)
;------------------------------------------------------------------
(defmacro animer (fonction délai) (block (evaljs (list "Pyt.animer" (string (quote fonction)) délai)) nil))
(defmacro quand_clic (fonction) (block (evaljs (list "Pyt.quandClic" (string (quote fonction)))) nil))
(defmacro quand_souris (fonction) (block (evaljs (list "Pyt.quandSouris" (string (quote fonction)))) nil))
(defmacro quand_touche (fonction) (block (evaljs (list "Pyt.quandTouche" (string (quote fonction)))) nil))
; quand_relâche(f) : f(touche) quand on relâche une touche (même nom qu'à l'appui)
(defmacro quand_relâche (fonction) (block (evaljs (list "Pyt.quandRelâche" (string (quote fonction)))) nil))
; touche_enfoncée(nom) : Vrai tant que la touche est tenue (à appeler dans la fonction d'animer)
(defun touche_enfoncée (nom) (> (evaljs (list "Pyt.toucheEnfoncée" (string nom))) 0))
(defmacro quand_glisse (fonction) (block (evaljs (list "Pyt.quandGlisse" (string (quote fonction)))) nil))
; saisie(clef, x, y, fonction) : un champ de saisie dans le canevas ; Entrée (ou un clic
; dans un autre champ) appelle fonction(clef, valeur), la valeur étant un texte
(defmacro saisie (clef x y fonction) (block (evaljs (list "Pyt.saisie" (string clef) x y (string (quote fonction)))) nil))
; largeur_saisie(l) : la largeur des champs créés ensuite (200 au départ)
(defun largeur_saisie (l) (evaljs (list "Pyt.largeurSaisie" l)) nil)
; active_saisie(clef) : donne la main au champ (le champ quitté envoie sa valeur)
(defun active_saisie (clef)
   (evaljs (list "Pyt.activeSaisie" (string clef)))
   (_erreur_navigateur)
   nil)
; saisie_active() : la clef du champ qui a la main ("" s'il n'y en a pas)
(defun saisie_active () (evaljs "Pyt.saisieActive()"))
(defun arrête () (evaljs "Pyt.arrête()") nil)

;------------------------------------------------------------------
; Images et sons
; charge_image et charge_son renvoient un numéro, à donner ensuite à place_image et joue_son.
; L'adresse est celle d'un fichier du site (exemples/médias/étoile.svg) ou une adresse
; complète (https://...).
;------------------------------------------------------------------
(defun charge_image (adresse) (integer (evaljs (list "Pyt.chargeImage" (string adresse)))))
; place_image(numéro, x, y) ou place_image(numéro, x, y, largeur, hauteur)
(defun place_image (image x y (l nil) (h nil)) (evaljs (list "Pyt.placeImage" image x y l h)) nil)
(defun charge_son (adresse) (integer (evaljs (list "Pyt.chargeSon" (string adresse)))))
(defun joue_son (son) (evaljs (list "Pyt.joueSon" son)) nil)

;------------------------------------------------------------------
; Fichiers (sans le système de fichiers du WASM)
; lit_fichier() : contenu d'un fichier du disque, que l'élève choisit dans une fenêtre
; (le programme est relancé une fois le fichier choisi) ;
; lit_fichier("https://...") : le texte d'une adresse Internet.
; écrit_fichier(nom, texte) : le fichier est téléchargé (dossier Téléchargements).
;------------------------------------------------------------------
; Une erreur côté navigateur (fichier absent, nom invalide, taille impossible) devient une erreur du
; programme, que l'élève peut attraper avec essaie / sauf.
(defun _erreur_navigateur ()
   (setq e (evaljs "Pyt.dernièreErreur()"))
   (if (!= e "") (throw e)))

(defun lit_fichier ((adresse nil))
   (setq contenu
      (if (nullp adresse)
         (evaljs "Pyt.litFichier()")
         (evaljs (list "Pyt.litFichier" (string adresse)))))
   (_erreur_navigateur)
   contenu)

; canevas(largeur, hauteur) : nouvelle taille du canevas (efface le dessin)
(defun canevas (l h)
   (evaljs (list "Pyt.canevas" l h))
   (_erreur_navigateur)
   nil)

; charge_données(nom) : un fichier du répertoire Matériels du site (matériel de cours)
(defun charge_données (nom)
   (setq contenu (evaljs (list "Pyt.chargeDonnées" (string nom))))
   (_erreur_navigateur)
   contenu)

; range_données("don0", valeur) : range la valeur (écrite comme affiche l'écrirait) dans
; l'onglet don0 de la section Données ; l'onglet est créé s'il vient juste après le dernier
(defun range_données (nom valeur)
   (setq e (evaljs (list "Pythonerie.rangeDonnées" (string nom) (_texte valeur))))
   (if (!= e "") (throw e))
   nil)

; prend_données("don0") : le texte actuel de l'onglet don0 de la section Données ("" s'il est vide)
(defun prend_données (nom)
   (setq contenu (evaljs (list "Pythonerie.prendDonnées" (string nom))))
   (setq e (evaljs "Pythonerie.erreurDonnées()"))
   (if (!= e "") (throw e))
   contenu)

(defun écrit_fichier (nom texte)
   (evaljs (list "Pyt.écritFichier" (string nom) (_texte texte)))
   (_erreur_navigateur)
   nil)

;------------------------------------------------------------------
; Opérateurs « à la Python »
; En LispE, le type du premier argument l'emporte : (+ 1 0.5) vaut 1.
; Le transpileur utilise ces fonctions quand il ne peut pas garantir le type des valeurs.
;------------------------------------------------------------------
; a est un entier et b un nombre réel : il faut convertir a en réel
(defun _mixte (a b) (and (eq (type a) 'integer_) (numberp b) (neq (type b) 'integer_)))

(defun _plus (a b)
   (cond
      ((consp a) (p+ a b))
      ((_mixte a b) (+ (float a) b))
      (true (+ a b))))
(defun _moins (a b) (if (_mixte a b) (- (float a) b) (- a b)))
(defun _fois (a b) (if (_mixte a b) (* (float a) b) (* a b)))
(defun _divise (a b) (/ (float a) b))
(defun _inf (a b) (if (_mixte a b) (< (float a) b) (< a b)))
(defun _infeg (a b) (if (_mixte a b) (<= (float a) b) (<= a b)))
(defun _sup (a b) (if (_mixte a b) (> (float a) b) (> a b)))
(defun _supeg (a b) (if (_mixte a b) (>= (float a) b) (>= a b)))
(defun _égal (a b) (if (_mixte a b) (= (float a) b) (= a b)))
(defun _diff (a b) (if (_mixte a b) (!= (float a) b) (!= a b)))

; Message d'une erreur attrapée par sauf(e), sans la pile d'appels LispE
; ("[12] (throw ...)") ni la position dans le code LispE (", line: ...")
(defun _message_erreur (e)
   (setq s (string e))
   ; la pile, une ligne vide, puis le message : une entrée de la pile peut s'étendre
   ; sur plusieurs lignes (une chaîne de données), on garde ce qui suit la dernière ligne vide
   (if (in s "\n\n") (setq s (@ (split s "\n\n") -1)))
   (setq lignes ())
   (loop l (split s "\n")
      (check (and (trim l) (not (and (= (@@ l 0 1) "[") (in l "] ("))))
         (push lignes l)))
   (setq m (join lignes "\n"))
   (if (in m ", line:") (setq m (@@ m 0 ", line:")))
   (if (= (@@ m 0 7) "Error: ") (setq m (@@ m 7 (size m))))
   m)

;------------------------------------------------------------------
; Affichage « à la Python », en français : [1, 2, 3], Vrai, Faux, Rien, {"a": 1}
; Le transpileur l'applique aux arguments de affiche() et écris(), et chaîne() l'utilise.
;------------------------------------------------------------------
(setq _types_listes '("list_" "integers_" "floats_" "numbers_" "strings_" "shorts_" "llist_" "enum"))

(defun _repr (x)
   (if (stringp x)
      (+ "\"" x "\"")
      (_texte x)))

(defun _texte (x)
   (setq ty (string (type x)))
   (cond
      ((eq ty "string_") x)
      ((or (in _types_listes ty) (= (@@ ty 0 7) "matrix_") (= (@@ ty 0 7) "tensor_"))
         (setq morceaux ())
         (loop e x (push morceaux (_repr e)))
         (+ "[" (join morceaux ", ") "]"))
      ; ensembles : {1, 2}
      ((= (@@ ty 0 4) "set_")
         (setq morceaux ())
         (loop e x (push morceaux (_repr e)))
         (+ "{" (join morceaux ", ") "}"))
      ((in ty "dictionary")
         (setq morceaux ())
         (loop k x (push morceaux (+ (_repr k) ": " (_repr (@ x k)))))
         (+ "{" (join morceaux ", ") "}"))
      ((eq x true) "Vrai")
      ((eq x false) "Faux")
      ((eq x nil) "Rien")
      (true (string x))))

;------------------------------------------------------------------
; La ligne de commande sous la console (>>>), comme l'invite de Python :
; la valeur d'une expression est affichée, sauf Rien et l'atome vide
; que renvoient affiche() et les fonctions qui ne retournent rien.
;------------------------------------------------------------------
(defun _console_valeur (v)
   ; on teste le type d'abord : sur une liste, eq et not agiraient élément par élément
   (setq rien (and (eq (string (type v)) "atom_") (or (eq v nil) (eq (string v) ""))))
   (if (not rien)
      (println (_repr v)))
   nil)
