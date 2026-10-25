;Date: 08/10/2026
;Description: Bibliothèque d'exécution de Pythonerie
; Ce fichier est chargé dans l'interpréteur LispE avant chaque programme.
; Les noms suivent l'orthographe française : épaisseur, aléatoire, carré, va_à...
; Il définit les fonctions françaises du langage et les instructions de dessin,
; qui appellent l'objet JavaScript "Pyt" (voir js/canevas.js) via evaljsc.
;
; (evaljsc (list "Pyt.cercle" x y r)) exécute en JavaScript : Pyt.cercle(x, y, r);
; evaljsc compile une seule fois l'appel à Pyt.cercle, quels que soient les arguments :
; les nombres passent directement (sans texte, donc exacts), les autres valeurs en JSON.
; Un texte comme (evaljsc "Pyt.efface()") est aussi compilé une seule fois.
; Les variantes evaljs_i, evaljs_d, evaljs_b, evaljs_j, evaljs_li… n'ont pas de cache.

; Une valeur renvoyée par JavaScript est toujours une chaîne : on la convertit en nombre
(defun js_nombre (s) (number s))

;------------------------------------------------------------------
; Console
;------------------------------------------------------------------
(defun efface_console () (evaljsc "Pyt.effaceConsole()") nil)
; affiche_console() : rend la console visible, même quand le canevas est en plein écran (elle
; vient alors dessous) ; cache_console() la retire du plein écran
(defun affiche_console () (evaljsc "Pyt.afficheConsole()") nil)
(defun cache_console () (evaljsc "Pyt.cacheConsole()") nil)

; écris(a, b, ...) écrit sans passer à la ligne. Dans le WebAssembly, chaque print de
; LispE arrive comme une ligne complète : on passe donc par la console JavaScript.
; defpat permet d'accepter de 1 à 8 arguments sous le même nom.
(defun _écris_liste (valeurs)
   (evaljsc (list "Pyt.écris" (join (maplist '_texte valeurs false) " ")))
   nil)
(defpat écris (a) (_écris_liste (list a)))
(defpat écris (a b) (_écris_liste (list a b)))
(defpat écris (a b c) (_écris_liste (list a b c)))
(defpat écris (a b c d) (_écris_liste (list a b c d)))
(defpat écris (a b c d e) (_écris_liste (list a b c d e)))
(defpat écris (a b c d e f) (_écris_liste (list a b c d e f)))
(defpat écris (a b c d e f g) (_écris_liste (list a b c d e f g)))
(defpat écris (a b c d e f g h) (_écris_liste (list a b c d e f g h)))

; Les attentes : rien n'attend l'élève en bloquant la page (voir Pyt.attends, dans canevas.js).
;   demande(question, f)      une petite fenêtre sur le canevas pose la question
;   lire(question, f)         la question est posée dans la console
;   lit_fichier(f)            l'élève choisit un fichier de son ordinateur
; L'appel rend la main tout de suite : le programme continue. Quand l'élève a répondu (ou
; choisi le fichier), f(valeur) est appelée ; avec un argument de plus, demande(question, f, a),
; c'est f(valeur, a) : a, une valeur quelconque, permet à une même fonction de servir à
; plusieurs questions. demande_nombre et lire_nombre donnent un nombre ; input est un
; synonyme de demande. La fonction est donnée par son nom (sans parenthèses), comme pour bouton.
; La fonction et a sont gardés ici sous un numéro ; la réponse revient par (_réponse_lue numéro),
; qui lit la valeur avec Pyt.valeurReçue.
(setq _lectures {})
(setq _numéro_lecture 0)
(defun _attend (_genre _question _nom _a _en_nombre _avec_a)
   (+= _numéro_lecture 1)
   (set@ _lectures (string _numéro_lecture) (list _nom _a _en_nombre _avec_a))
   (evaljsc (list "Pyt.attends" _genre (string _question) _numéro_lecture))
   nil)
; la réponse arrive : la fonction de rappel la reçoit, avec a (quote : a n'est pas réévalué).
; Les noms commencent par « _ » : la fonction de l'élève peut s'appeler réponse ou numéro
(defun _réponse_lue (_numéro)
   (setq _numéro (string _numéro))
   (check (in_it _lectures _numéro)
      (setq _e (@ _lectures _numéro))
      (pop _lectures _numéro)
      (setq _réponse (evaljsc "Pyt.valeurReçue()"))
      ; la conversion : true (un nombre), "json" (une valeur décrite en JSON), "vrai" (Vrai)
      (setq _conversion (@ _e 2))
      (if (stringp _conversion)
         (cond
            ((= _conversion "json") (setq _réponse (json_parse _réponse)))
            ((= _conversion "vrai") (setq _réponse true)))
         (if _conversion (setq _réponse (nombre _réponse))))
      ; quote : une liste ou un dictionnaire (liste_dans_serveur, un .json) n'est pas réévalué
      (if (@ _e 3)
         (eval (list (atom (@ _e 0)) (list 'quote _réponse) (list 'quote (@ _e 1))))
         (eval (list (atom (@ _e 0)) (list 'quote _réponse)))))
   nil)
(defmacro demande (question) (throw "demande a besoin d'une fonction de rappel : demande(question, f), et f(réponse) reçoit la réponse (ou demande(question, f, a) : f(réponse, a))"))
(defmacro demande (question f) (_attend "fenêtre" question (string (quote f)) nil false false))
(defmacro demande (question f a) (_attend "fenêtre" question (string (quote f)) a false true))
(defmacro demande_nombre (question) (throw "demande_nombre a besoin d'une fonction de rappel : demande_nombre(question, f), et f(nombre) reçoit la réponse"))
(defmacro demande_nombre (question f) (_attend "fenêtre" question (string (quote f)) nil true false))
(defmacro demande_nombre (question f a) (_attend "fenêtre" question (string (quote f)) a true true))
(defmacro input (question) (throw "input a besoin d'une fonction de rappel : input(question, f), comme demande"))
(defmacro input (question f) (_attend "fenêtre" question (string (quote f)) nil false false))
(defmacro input (question f a) (_attend "fenêtre" question (string (quote f)) a false true))
(defmacro lire (question) (throw "lire a besoin d'une fonction de rappel : lire(question, f), et f(réponse) reçoit la réponse (ou lire(question, f, a) : f(réponse, a))"))
(defmacro lire (question f) (_attend "console" question (string (quote f)) nil false false))
(defmacro lire (question f a) (_attend "console" question (string (quote f)) a false true))
(defmacro lire_nombre (question) (throw "lire_nombre a besoin d'une fonction de rappel : lire_nombre(question, f), et f(nombre) reçoit la réponse"))
(defmacro lire_nombre (question f) (_attend "console" question (string (quote f)) nil true false))
(defmacro lire_nombre (question f a) (_attend "console" question (string (quote f)) a true true))
(defmacro lit_fichier () (throw "lit_fichier a besoin d'une fonction de rappel : lit_fichier(f), et f(contenu) reçoit le contenu du fichier (ou lit_fichier(f, a) : f(contenu, a))"))
(defmacro lit_fichier (f) (_attend "fichier" "" (string (quote f)) nil false false))
(defmacro lit_fichier (f a) (_attend "fichier" "" (string (quote f)) a false true))
; Les échanges avec serveur.py (voir Pyt.réseau, dans canevas.js) : eux aussi rendent la main
; tout de suite, et la fonction de rappel reçoit le résultat.
;   sauve_dans_serveur(professeur, chemin, valeur)       écrit le fichier chemin dans le répertoire
;   sauve_dans_serveur(professeur, chemin, valeur, f)    du professeur ; f(Vrai) quand c'est fait.
;       Une valeur qui n'est pas un texte est écrite en JSON. L'élève écrit, mais ne peut pas relire.
;   liste_dans_serveur(chemin, f)    f(entrées) : les fichiers reçus sous chemin ("" : tous), une
;       entrée par version, {"chemin", "élève", "date", "taille", "actuel"}
;   lit_dans_serveur(chemin, f)      f(contenu) : le texte du fichier, ou sa valeur pour un .json
; Les deux dernières ne marchent qu'en mode administrateur, une fois le professeur connecté ;
; chacune accepte un argument de plus, rendu à f : f(résultat, a).
; login() : le nom sous lequel l'élève travaille dans la Pythonerie (« Unique » en mode
; utilisateur unique, "" dans une application Web) ; pour l'écrire dans un chemin :
; sauve_dans_serveur("dupont", f"contrôle1/{login()}.json", réponses)
(defun login () (evaljsc "Pyt.login()"))
(defun _réseau (_genre _p1 _p2 _p3 _nom _a _conversion _avec_a)
   (setq _id 0)
   (check _nom
      (+= _numéro_lecture 1)
      (setq _id _numéro_lecture)
      (set@ _lectures (string _id) (list _nom _a _conversion _avec_a)))
   (evaljsc (list "Pyt.réseau" _genre (string _p1) (string _p2) _p3 _id))
   nil)
(defun _en_texte_ou_json (_v) (if (stringp _v) _v (json _v)))
(defun _conversion_lecture (_chemin) (if (= (right (string _chemin) 5) ".json") "json" ""))
(defmacro sauve_dans_serveur (professeur chemin valeur) (_réseau "sauve" professeur chemin (_en_texte_ou_json valeur) nil nil "vrai" false))
(defmacro sauve_dans_serveur (professeur chemin valeur f) (_réseau "sauve" professeur chemin (_en_texte_ou_json valeur) (string (quote f)) nil "vrai" false))
(defmacro sauve_dans_serveur (professeur chemin valeur f a) (_réseau "sauve" professeur chemin (_en_texte_ou_json valeur) (string (quote f)) a "vrai" true))
(defmacro liste_dans_serveur (chemin) (throw "liste_dans_serveur a besoin d'une fonction de rappel : liste_dans_serveur(chemin, f), et f(entrées) reçoit la liste"))
(defmacro liste_dans_serveur (chemin f) (_réseau "liste" chemin "" "" (string (quote f)) nil "json" false))
(defmacro liste_dans_serveur (chemin f a) (_réseau "liste" chemin "" "" (string (quote f)) a "json" true))
; sauve_élèves(liste) ou sauve_élèves(liste, f) : en mode administrateur, la liste des élèves
; autorisés du professeur connecté (élèves.json) ; un élève est {"identifiant": ..., "nom": ...}
; ou [identifiant, nom] ; f(nombre) reçoit le nombre d'élèves enregistrés. Le serveur refuse
; une liste où il manque un identifiant, ou dont deux identifiants sont pareils.
(defmacro sauve_élèves (liste) (_réseau "élèves" (json liste) "" "" nil nil true false))
(defmacro sauve_élèves (liste f) (_réseau "élèves" (json liste) "" "" (string (quote f)) nil true false))
(defmacro sauve_élèves (liste f a) (_réseau "élèves" (json liste) "" "" (string (quote f)) a true true))
(defmacro lit_dans_serveur (chemin) (throw "lit_dans_serveur a besoin d'une fonction de rappel : lit_dans_serveur(chemin, f), et f(contenu) reçoit le fichier"))
(defmacro lit_dans_serveur (chemin f) (_réseau "lit" chemin "" "" (string (quote f)) nil (_conversion_lecture chemin) false))
(defmacro lit_dans_serveur (chemin f a) (_réseau "lit" chemin "" "" (string (quote f)) a (_conversion_lecture chemin) true))
; assigne(nom, valeur) : range valeur dans la variable du programme qui s'appelle nom (un
; texte), comme nom =: valeur, mais le nom peut être calculé : une fonction de rappel de
; demande ou de lire s'en sert pour ranger la réponse dans la variable que lui donne a
(defun assigne (_nom _valeur)
   (eval (list 'setg (atom (string _nom)) (list 'quote _valeur)))
   nil)

;------------------------------------------------------------------
; Conversions et utilitaires
;------------------------------------------------------------------
(defun longueur (x) (size x))
(defun entier (x) (integer x))
(defun réel (x) (number x))
; nombre(x) : un nombre à virgule, à partir d'un texte (« 2,5 » ou « 2.5 ») ; un texte
; vide ou qui n'est pas un nombre donne 0.0
(defun nombre (x)
   (if (stringp x)
      (number (replace (trim x) "," "."))
      (number x)))
(defun chaîne (x) (_texte x))
(defun chaine (x) (_texte x))
(defun type_de (x) (type x))

; typede(x) : le genre de x en français, sous forme de texte, que l'on peut comparer :
; si typede(d) == "dictionnaire": ...  (type_de donne le nom de LispE, un atome anglais).
; Les noms de LispE sont ceux de code_to_string (lispe.cxx, Delegation::initialisation).
; Rien, Vrai et Faux sont tous trois des atomes pour LispE : on les reconnaît d'abord.
(setq _types_français {
   "integer_":"entier" "short_":"entier"
   "number_":"réel" "float_":"réel" "complex_":"complexe"
   "string_":"texte" "longstring_":"texte" "stringbyte_":"texte"
   "list_":"liste" "llist_":"liste" "integers_":"liste" "numbers_":"liste" "floats_":"liste"
   "shorts_":"liste" "strings_":"liste" "stringbytes_":"liste"
   "matrix_number_":"matrice" "matrix_float_":"matrice" "matrix_integer_":"matrice"
   "matrix_short_":"matrice" "matrix_string_":"matrice" "matrix_stringbyte_":"matrice"
   "tensor_number_":"tenseur" "tensor_float_":"tenseur" "tensor_integer_":"tenseur"
   "tensor_short_":"tenseur" "tensor_string_":"tenseur" "tensor_stringbyte_":"tenseur"
   "dictionary_":"dictionnaire" "dictionaryjson_":"dictionnaire" "dictionary_n_":"dictionnaire"
   "dictionary_i_":"dictionnaire" "dictionarytree_":"dictionnaire" "dictionarytree_n_":"dictionnaire"
   "dictionarytree_i_":"dictionnaire"
   "set_":"ensemble" "set_s_":"ensemble" "set_n_":"ensemble" "set_i_":"ensemble"
   "heap_":"tas" "atom_":"atome" "error_":"erreur" "file_element_":"fichier"
   "function_":"fonction" "library_function_":"fonction" "pattern_":"fonction"
   "predicate_":"fonction" "lambda_":"fonction" "thread_":"fonction"
   "data_":"donnée" "maybe_":"erreur"
})
(defun typede (x)
   (cond
      ((eq x nil) "rien")
      ((or (eq x true) (eq x false)) "booléen")
      (true
         (setq _t (string (type x)))
         ; un nom absent de la table est rendu sans le « _ » final de LispE :
         ; l'objet d'une classe Chat donne "Chat"
         (cond
            ((in_it _types_français _t) (@ _types_français _t))
            ((= (@ _t -1) "_") (@@ _t 0 -1))
            (true _t)))))

; intervalle(5) -> [0,1,2,3,4] ; intervalle(2, 5) -> [2,3,4] ; intervalle(0, 10, 2)
(defun intervalle (a (b nil) (pas 1))
   (if (nullp b)
      (range 0 a 1)
      (range a b pas)))

; Nombre entier au hasard entre a et b (inclus)
(defun aléatoire (a b)
   (evaljs_i (list "Pyt.aléatoire" a b)))

; Nombre réel au hasard entre 0 et 1
(defun hasard ()
   (evaljs_d "Pyt.hasard()"))

; tri_localisé(liste) : les textes triés selon l'ordre du français (« é » avec les « e », les majuscules
; avec les minuscules) ; tri_localisé(liste, "de") : selon une autre langue ("fr-CA", "ko"…)
(defun tri_localisé (liste (langue "")) (evaljs_j (list "Pyt.triLocalisé" (json liste) langue)))

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
(defun sinus (degrés) (sin (radian degrés)))
(defun cosinus (degrés) (cos (radian degrés)))

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
;------------------------------------------------------------------
; Les dessins : préparer un dessin, puis le montrer d'un coup
; d = nouveau_dessin() rend un dessin vide. Les instructions de dessin et de la tortue acceptent
; un dessin en premier argument : d.couleur("rouge"), d.disque(x, y, r), d.avance(10)...
; (ou disque(d, x, y, r)). Elles ne dessinent rien : elles ajoutent leur commande au dessin.
; montre_dessin(d) dessine toutes ses commandes, dans l'ordre, en un seul appel à JavaScript.
; Le navigateur garde le dessin : le montrer de nouveau (à chaque image d'une animation, pour
; un décor) ne renvoie pas ses commandes s'il n'a pas changé. vide_dessin(d) les retire toutes.
; Sans dessin, les instructions dessinent tout de suite, comme avant : cercle(x, y, r).
; Chaque commande est un code suivi de ses nombres, dans la liste "nombres" (des doubles, que
; evaljsc transmet sans texte) ; les couleurs, les messages et les polices vont dans "textes".
; Les codes sont ceux de Pyt.redessine (js/canevas.js).
;------------------------------------------------------------------
(setq _numéro_dessin 0)
(defun nouveau_dessin ()
   (+= _numéro_dessin 1)
   (dictionary "genre" "dessin" "numéro" _numéro_dessin "nombres" (numbers) "textes" (list) "envoyé" -1))
; la liste des nombres du dessin donné à une instruction ; une autre valeur est une erreur claire
(defun _dessin (_d _nom)
   (if (and (in_it _d "genre") (= (@ _d "genre") "dessin"))
      (@ _d "nombres")
      (throw (+ _nom " : il faut un dessin (nouveau_dessin()) devant le point, comme dans d." _nom "(...)"))))
(defun _polygone_dessin (_d _nom _points _plein)
   (setq _n (_dessin _d _nom))
   (push _n 12 (size _points))
   (loop _p _points (push _n (@ _p 0) (@ _p 1)))
   (push _n _plein))
; "envoyé" : le nombre de valeurs déjà envoyées au navigateur (-1 : rien) ; un dessin ne fait que
; grandir, sauf par vide_dessin, qui remet "envoyé" à -1
; montre_dessin(d, clef) : le dessin dans la zone_défilante clef, au lieu du canevas
(defun montre_dessin (_d (_zone ""))
   (setq _n (_dessin _d "montre_dessin"))
   (if (= (size _n) (@ _d "envoyé"))
      (evaljsc (list "Pyt.redessine" (@ _d "numéro") (string _zone)))
      (block
         (evaljsc (list "Pyt.montreDessin" (@ _d "numéro") _n (@ _d "textes") (string _zone)))
         (set@ _d "envoyé" (size _n))))
   (_erreur_navigateur)
   nil)
(defun vide_dessin (_d)
   (_dessin _d "vide_dessin")
   (set@ _d "nombres" (numbers))
   (set@ _d "textes" (list))
   (set@ _d "envoyé" -1)
   nil)
(defun efface ((_dd nil)) (if _dd (push (_dessin _dd "efface") 1) (evaljsc "Pyt.efface()")) nil)
(defpat fond (c) (evaljsc (list "Pyt.fond" c)) nil)
(defpat fond ((dictionary_ _dd) c) (push (_dessin _dd "fond") 2) (push (@ _dd "textes") c) nil)
(defpat couleur (c) (evaljsc (list "Pyt.couleur" c)) nil)
(defpat couleur ((dictionary_ _dd) c) (push (_dessin _dd "couleur") 3) (push (@ _dd "textes") c) nil)
(defpat couleur_trait (c) (evaljsc (list "Pyt.couleurTrait" c)) nil)
(defpat couleur_trait ((dictionary_ _dd) c) (push (_dessin _dd "couleur_trait") 4) (push (@ _dd "textes") c) nil)
(defpat couleur_remplissage (c) (evaljsc (list "Pyt.couleurRemplissage" c)) nil)
(defpat couleur_remplissage ((dictionary_ _dd) c) (push (_dessin _dd "couleur_remplissage") 5) (push (@ _dd "textes") c) nil)
(defpat épaisseur (e) (evaljsc (list "Pyt.épaisseur" e)) nil)
(defpat épaisseur ((dictionary_ _dd) e) (push (_dessin _dd "épaisseur") 6 e) nil)

(defpat point (x y) (evaljsc (list "Pyt.point" x y)) nil)
(defpat point ((dictionary_ _dd) x y) (push (_dessin _dd "point") 7 x y) nil)
(defpat ligne (x1 y1 x2 y2) (evaljsc (list "Pyt.ligne" x1 y1 x2 y2)) nil)
(defpat ligne ((dictionary_ _dd) x1 y1 x2 y2) (push (_dessin _dd "ligne") 8 x1 y1 x2 y2) nil)
(defpat rectangle (x y l h) (evaljsc (list "Pyt.rectangle" x y l h false)) nil)
(defpat rectangle ((dictionary_ _dd) x y l h) (push (_dessin _dd "rectangle") 9 x y l h 0) nil)
(defpat rectangle_plein (x y l h) (evaljsc (list "Pyt.rectangle" x y l h true)) nil)
(defpat rectangle_plein ((dictionary_ _dd) x y l h) (push (_dessin _dd "rectangle_plein") 9 x y l h 1) nil)
(defpat carré (x y côté) (evaljsc (list "Pyt.rectangle" x y côté côté false)) nil)
(defpat carré ((dictionary_ _dd) x y côté) (push (_dessin _dd "carré") 9 x y côté côté 0) nil)
(defpat carré_plein (x y côté) (evaljsc (list "Pyt.rectangle" x y côté côté true)) nil)
(defpat carré_plein ((dictionary_ _dd) x y côté) (push (_dessin _dd "carré_plein") 9 x y côté côté 1) nil)
(defpat cercle (x y r) (evaljsc (list "Pyt.cercle" x y r false)) nil)
(defpat cercle ((dictionary_ _dd) x y r) (push (_dessin _dd "cercle") 10 x y r 0) nil)
(defpat disque (x y r) (evaljsc (list "Pyt.cercle" x y r true)) nil)
(defpat disque ((dictionary_ _dd) x y r) (push (_dessin _dd "disque") 10 x y r 1) nil)
(defpat ellipse (x y rx ry) (evaljsc (list "Pyt.ellipse" x y rx ry false)) nil)
(defpat ellipse ((dictionary_ _dd) x y rx ry) (push (_dessin _dd "ellipse") 11 x y rx ry 0) nil)
(defpat ellipse_pleine (x y rx ry) (evaljsc (list "Pyt.ellipse" x y rx ry true)) nil)
(defpat ellipse_pleine ((dictionary_ _dd) x y rx ry) (push (_dessin _dd "ellipse_pleine") 11 x y rx ry 1) nil)
(defpat triangle (x1 y1 x2 y2 x3 y3) (evaljsc (list "Pyt.polygone" (json (list (list x1 y1) (list x2 y2) (list x3 y3))) false)) nil)
(defpat triangle ((dictionary_ _dd) x1 y1 x2 y2 x3 y3) (push (_dessin _dd "triangle") 12 3 x1 y1 x2 y2 x3 y3 0) nil)
(defpat triangle_plein (x1 y1 x2 y2 x3 y3) (evaljsc (list "Pyt.polygone" (json (list (list x1 y1) (list x2 y2) (list x3 y3))) true)) nil)
(defpat triangle_plein ((dictionary_ _dd) x1 y1 x2 y2 x3 y3) (push (_dessin _dd "triangle_plein") 12 3 x1 y1 x2 y2 x3 y3 1) nil)
; points est une liste de couples : [[0,0], [100,0], [50,80]]
; Les listes imbriquées sont passées en JSON : evaljs réévaluerait chaque sous-liste
(defpat polygone (points) (evaljsc (list "Pyt.polygone" (json points) false)) nil)
(defpat polygone ((dictionary_ _dd) points) (_polygone_dessin _dd "polygone" points 0) nil)
(defpat polygone_plein (points) (evaljsc (list "Pyt.polygone" (json points) true)) nil)
(defpat polygone_plein ((dictionary_ _dd) points) (_polygone_dessin _dd "polygone_plein" points 1) nil)

; Pixels : chaque point du dessin a quatre valeurs de 0 à 255 (rouge, vert, bleu, opacité).
; couleur_pixel(x, y) : la couleur du point (x, y), en liste [rouge, vert, bleu, opacité]
; pixels(x, y, l, h) : les points d'un rectangle, ligne après ligne, quatre valeurs par point
; (une liste de l * h * 4 entiers) ; pose_pixels(x, y, l, h, valeurs) les redessine.
; evaljs_li rend directement une liste d'entiers (integers_), sans passer par du texte.
(defun couleur_pixel (x y)
   (setq v (evaljs_li (list "Pyt.couleurPixel" x y)))
   (_erreur_navigateur)
   v)
(defun pixels (x y l h)
   (setq v (evaljs_li (list "Pyt.pixels" x y l h)))
   (_erreur_navigateur)
   v)
; les valeurs sont passées en JSON, comme les points d'un polygone
(defun pose_pixels (x y l h valeurs)
   (evaljsc (list "Pyt.posePixels" x y l h (json valeurs)))
   (_erreur_navigateur)
   nil)

; Texte
(defpat texte (x y message) (evaljsc (list "Pyt.texte" x y (string message))) nil)
(defpat texte ((dictionary_ _dd) x y message) (push (_dessin _dd "texte") 13 x y) (push (@ _dd "textes") (string message)) nil)
(defpat taille_texte (n) (evaljsc (list "Pyt.tailleTexte" n)) nil)
(defpat taille_texte ((dictionary_ _dd) n) (push (_dessin _dd "taille_texte") 14 n) nil)
; largeur_texte(message) : la largeur (en points du canevas) qu'aurait message écrit par texte(),
; avec la police et la taille du moment ; la plus longue ligne pour un texte sur plusieurs lignes
(defun largeur_texte (message) (evaljs_d (list "Pyt.largeurTexte" (string message))))
; hauteur_texte(message) : la hauteur (en points du canevas) des lettres de message écrit par texte(),
; du haut de la plus haute au bas de la plus basse (« a » est moins haut que « Ag ») ; sur plusieurs
; lignes, du haut de la première au bas de la dernière
(defun hauteur_texte (message) (evaljs_d (list "Pyt.hauteurTexte" (string message))))
(defpat police (nom) (evaljsc (list "Pyt.police" nom)) nil)
(defpat police ((dictionary_ _dd) nom) (push (_dessin _dd "police") 15) (push (@ _dd "textes") nom) nil)

;------------------------------------------------------------------
; Les graphiques d'un tableur : graphique(genre, valeurs, étiquettes, options)
; genre : "colonnes", "barres", "colonnes_empilées", "barres_empilées", "courbes", "aires",
; "aires_empilées", "camembert", "anneau", "nuage", "bulles", "radar", "répartition", "boîte",
; "cascade", "entonnoir" ou "mosaïque" ; valeurs : une liste de nombres, ou une liste de listes
; (une par série) ; étiquettes : les noms des catégories (facultatives) ; options : un
; dictionnaire {"titre": …, "séries": […], "zone": [x, y, l, h], "valeurs": Vrai…}, qui peut
; aussi venir à la place des étiquettes. Tout part en un seul texte JSON vers Pyt.graphique
; (js/canevas.js), qui dessine et renvoie les erreurs. Avec un dessin devant le point,
; d.graphique(...) ajoute la commande 26 au dessin, rejouée par montre_dessin.
;------------------------------------------------------------------
(defun graphique (_a _b (_c nil) (_e nil) (_f nil))
   (if (eq (type _a) 'dictionary_)
      (block
         (push (_dessin _a "graphique") 26)
         (push (@ _a "textes") (json (list _b _c _e _f))))
      (block
         (evaljsc (list "Pyt.graphique" (json (list _a _b _c _e))))
         (_erreur_navigateur)))
   nil)

; Dimensions du canevas : 800 x 600, sauf si le programme appelle canevas(largeur, hauteur)
; (défini plus bas, avec les autres fonctions qui peuvent signaler une erreur)
(defun largeur () (evaljs_d "Pyt.largeur()"))
(defun hauteur () (evaljs_d "Pyt.hauteur()"))
; appareil() : sur quoi tourne le programme, pour l'adapter : ["ordinateur", 1440, 900],
; ["tablette", 1180, 820] ou ["téléphone", 390, 844], le genre d'appareil, puis la largeur et la
; hauteur de l'écran (en points), dans le sens où on le tient. evaljs_j rend directement la liste.
(defun appareil () (evaljs_j "Pyt.appareil()"))

;------------------------------------------------------------------
; La tortue
;------------------------------------------------------------------
(defpat avance (d) (evaljsc (list "Pyt.avance" d)) nil)
(defpat avance ((dictionary_ _dd) d) (push (_dessin _dd "avance") 16 d) nil)
(defpat recule (d) (evaljsc (list "Pyt.avance" (* -1 d))) nil)
(defpat recule ((dictionary_ _dd) d) (push (_dessin _dd "recule") 16 (* -1 d)) nil)
(defpat gauche (a) (evaljsc (list "Pyt.tourne" (* -1 a))) nil)
(defpat gauche ((dictionary_ _dd) a) (push (_dessin _dd "gauche") 17 (* -1 a)) nil)
(defpat droite (a) (evaljsc (list "Pyt.tourne" a)) nil)
(defpat droite ((dictionary_ _dd) a) (push (_dessin _dd "droite") 17 a) nil)
(defun lève_crayon ((_dd nil)) (if _dd (push (_dessin _dd "lève_crayon") 18 0) (evaljsc (list "Pyt.crayon" false))) nil)
(defun baisse_crayon ((_dd nil)) (if _dd (push (_dessin _dd "baisse_crayon") 18 1) (evaljsc (list "Pyt.crayon" true))) nil)
(defpat va_à (x y) (evaljsc (list "Pyt.vaÀ" x y)) nil)
(defpat va_à ((dictionary_ _dd) x y) (push (_dessin _dd "va_à") 19 x y) nil)
(defpat oriente (angle) (evaljsc (list "Pyt.oriente" angle)) nil)
(defpat oriente ((dictionary_ _dd) angle) (push (_dessin _dd "oriente") 20 angle) nil)
(defun origine ((_dd nil)) (if _dd (push (_dessin _dd "origine") 21) (evaljsc "Pyt.origine()")) nil)
(defun montre_tortue ((_dd nil)) (if _dd (push (_dessin _dd "montre_tortue") 22 1) (evaljsc (list "Pyt.montreTortue" true))) nil)
(defun cache_tortue ((_dd nil)) (if _dd (push (_dessin _dd "cache_tortue") 22 0) (evaljsc (list "Pyt.montreTortue" false))) nil)
(defun position_x () (evaljs_d "Pyt.tortueX()"))
(defun position_y () (evaljs_d "Pyt.tortueY()"))
(defun cap () (evaljs_d "Pyt.tortueCap()"))
; position() : [x, y], où se trouve la tortue (une liste de deux réels)
(defun position () (evaljs_ld "[Pyt.tortueX(), Pyt.tortueY()]"))

;------------------------------------------------------------------
; Animation et événements
; La fonction peut être donnée par son nom : animer(bouge, 30) ou animer("bouge", 30)
;------------------------------------------------------------------
(defmacro animer (fonction délai) (block (evaljsc (list "Pyt.animer" (string (quote fonction)) délai)) nil))
; appel_dans(f, délai) : appelle f() toutes les délai millisecondes, au rythme d'une horloge, même
; quand l'écran n'est pas redessiné (une horloge, un compte à rebours) ; animer, lui, suit l'écran
(defmacro appel_dans (fonction délai) (block (evaljsc (list "Pyt.appelDans" (string (quote fonction)) délai)) nil))
; heure() : l'heure de l'appareil, [heures, minutes, secondes, millisecondes]
(defun heure () (evaljs_li "Pyt.heure()"))
(defmacro quand_clic (fonction) (block (evaljsc (list "Pyt.quandClic" (string (quote fonction)))) nil))
(defmacro quand_souris (fonction) (block (evaljsc (list "Pyt.quandSouris" (string (quote fonction)))) nil))
(defmacro quand_touche (fonction) (block (evaljsc (list "Pyt.quandTouche" (string (quote fonction)))) nil))
; quand_relâche(f) : f(touche) quand on relâche une touche (même nom qu'à l'appui)
(defmacro quand_relâche (fonction) (block (evaljsc (list "Pyt.quandRelâche" (string (quote fonction)))) nil))
; touche_enfoncée(nom) : Vrai tant que la touche est tenue (à appeler dans la fonction d'animer)
(defun touche_enfoncée (nom) (evaljs_b (list "Pyt.toucheEnfoncée" (string nom))))
(defmacro quand_glisse (fonction) (block (evaljsc (list "Pyt.quandGlisse" (string (quote fonction)))) nil))
; saisie(clef, x, y, fonction) : un champ de saisie dans le canevas ; Entrée (ou un clic
; dans un autre champ) appelle fonction(clef, valeur), la valeur étant un texte
(defmacro saisie (clef x y fonction) (block (evaljsc (list "Pyt.saisie" (string clef) x y (string (quote fonction)))) nil))
; Les autres objets du canevas (même règle : la fonction est donnée par son nom)
; bouton(clef, x, y, texte, f) : un clic appelle f(clef, texte)
(defmacro bouton (clef x y texte fonction) (block (evaljsc (list "Pyt.bouton" (string clef) x y (_texte texte) (string (quote fonction)))) nil))
; case_à_cocher(clef, x, y, texte, f) : f(clef, Vrai ou Faux) quand on la coche ou la décoche
(defmacro case_à_cocher (clef x y texte fonction) (block (evaljsc (list "Pyt.caseÀCocher" (string clef) x y (_texte texte) (string (quote fonction)))) nil))
; retire_objet(clef) : enlève un objet du canevas ; retire_objets() les enlève tous
(defun retire_objet (clef) (evaljsc (list "Pyt.retireObjet" (string clef))) nil)
(defun retire_objets () (evaljsc "Pyt.retireObjets()") nil)
; bouton_image(clef, x, y, image, f) : un bouton qui a l'aspect de l'image (numéro rendu par
; charge_image ou capture_image) ; bouton_image(clef, x, y, image, image_appuyée, f) lui donne un
; second aspect tant qu'on appuie. Un clic appelle f(clef, image). (deux macros : 5 ou 6 arguments)
(defmacro bouton_image (clef x y image fonction) (block (evaljsc (list "Pyt.boutonImage" (string clef) x y image nil (string (quote fonction)))) (_erreur_navigateur) nil))
(defmacro bouton_image (clef x y image appuyée fonction) (block (evaljsc (list "Pyt.boutonImage" (string clef) x y image appuyée (string (quote fonction)))) (_erreur_navigateur) nil))
; bouton_radio(clef, groupe, x, y, texte, f) : un seul coché par groupe ; f(groupe, clef) quand on le choisit
(defmacro bouton_radio (clef groupe x y texte fonction) (block (evaljsc (list "Pyt.boutonRadio" (string clef) (string groupe) x y (_texte texte) (string (quote fonction)))) nil))
; glissière(clef, x, y, mini, maxi, valeur, f) : f(clef, valeur) pendant qu'on la déplace
(defmacro glissière (clef x y mini maxi valeur fonction) (block (evaljsc (list "Pyt.glissière" (string clef) x y mini maxi valeur (string (quote fonction)))) nil))
; zone_édition(clef, x, y, lignes, f) : un texte sur plusieurs lignes ; f(clef, texte) quand on la quitte (ou Ctrl+Entrée)
(defmacro zone_édition (clef x y lignes fonction) (block (evaljsc (list "Pyt.zoneÉdition" (string clef) x y lignes (string (quote fonction)))) nil))
; zone_défilante(clef, x, y, l, h, largeur, hauteur) : une fenêtre de l × h points sur une surface de dessin de
; largeur × hauteur, qui défile verticalement si hauteur > h, horizontalement si largeur > l (molette, doigt,
; barres) ; on y dessine avec montre_dessin(d, clef), d étant un dessin préparé (nouveau_dessin). Avec une
; fonction de plus : f(clef, [x, y]) au clic, en points de la surface. valeur_objet(clef) rend la
; position du défilement [x, y] ; change_objet(clef, [x, y]) fait défiler.
(defmacro zone_défilante (clef x y l h largeur hauteur) (block (evaljsc (list "Pyt.zoneDéfilante" (string clef) x y l h largeur hauteur "")) (_erreur_navigateur) nil))
(defmacro zone_défilante (clef x y l h largeur hauteur fonction) (block (evaljsc (list "Pyt.zoneDéfilante" (string clef) x y l h largeur hauteur (string (quote fonction)))) (_erreur_navigateur) nil))
; zone_texte(clef, x, y, l, h, texte) : un texte seul, en lecture seule, qui défile verticalement, et
; horizontalement si des lignes dépassent (elles ne sont pas coupées) ; police et taille du moment ;
; change_objet(clef, texte) le remplace, valeur_objet(clef) le rend.
(defun zone_texte (_c _x _y _l _h _t)
   (evaljsc (list "Pyt.zoneTexte" (string _c) _x _y _l _h (_texte _t)))
   (_erreur_navigateur)
   nil)
; liste_déroulante(clef, x, y, éléments, f) : f(clef, choix) quand on choisit un élément
(defmacro liste_déroulante (clef x y éléments fonction) (block (evaljsc (list "Pyt.listeDéroulante" (string clef) x y (json éléments) (string (quote fonction)))) nil))
; liste_hiérarchique(clef, x, y, lignes, arbre, f) : un arbre ; un élément est un texte ou [nom, [enfants]] ;
; un clic appelle f(clef, chemin), chemin étant la liste des noms depuis la racine
(defmacro liste_hiérarchique (clef x y lignes arbre fonction) (block (evaljsc (list "Pyt.listeHiérarchique" (string clef) x y lignes (json arbre) (string (quote fonction)))) nil))
; valeur_objet(clef) : la valeur actuelle d'un objet (texte, nombre, Vrai / Faux pour une case ou
; un radio, le chemin choisi pour une liste hiérarchique)
; evaljs_j rend directement la valeur JavaScript : booléen, nombre, texte ou liste
(defun valeur_objet (clef)
   (setq v (evaljs_j (list "Pyt.valeurObjet" (string clef))))
   (_erreur_navigateur)
   v)
; change_objet(clef, valeur) : change la valeur d'un objet, sans appeler sa fonction
(defun change_objet (clef valeur)
   (evaljsc (list "Pyt.changeObjet" (string clef) (if (consp valeur) (json valeur) valeur)))
   (_erreur_navigateur)
   nil)
; largeur_saisie(l) : la largeur des champs créés ensuite (200 au départ)
(defun largeur_saisie (l) (evaljsc (list "Pyt.largeurSaisie" l)) nil)
; active_saisie(clef) : donne la main au champ (le champ quitté envoie sa valeur)
(defun active_saisie (clef)
   (evaljsc (list "Pyt.activeSaisie" (string clef)))
   (_erreur_navigateur)
   nil)
; saisie_active() : la clef du champ qui a la main ("" s'il n'y en a pas)
(defun saisie_active () (evaljsc "Pyt.saisieActive()"))
(defun arrête () (evaljsc "Pyt.arrête()") nil)

;------------------------------------------------------------------
; Images et sons
; charge_image et charge_son renvoient un numéro, à donner ensuite à place_image et joue_son.
; L'adresse est celle d'un fichier du site (médias/images/étoile.svg) ou une adresse
; complète (https://...).
;------------------------------------------------------------------
(defun charge_image (adresse) (evaljs_i (list "Pyt.chargeImage" (string adresse))))
; place_image(numéro, x, y) ou place_image(numéro, x, y, largeur, hauteur)
(defpat place_image (image x y) (evaljsc (list "Pyt.placeImage" image x y nil nil)) (_erreur_navigateur) nil)
(defpat place_image (image x y l) (evaljsc (list "Pyt.placeImage" image x y l nil)) (_erreur_navigateur) nil)
(defpat place_image (image x y l h) (evaljsc (list "Pyt.placeImage" image x y l h)) (_erreur_navigateur) nil)
(defpat place_image ((dictionary_ _dd) image x y) (push (_dessin _dd "place_image") 23 image x y) nil)
(defpat place_image ((dictionary_ _dd) image x y l) (push (_dessin _dd "place_image") 24 image x y l) nil)
(defpat place_image ((dictionary_ _dd) image x y l h) (push (_dessin _dd "place_image") 25 image x y l h) nil)
(defun charge_son (adresse) (evaljs_i (list "Pyt.chargeSon" (string adresse))))
(defun joue_son (son) (evaljsc (list "Pyt.joueSon" son)) nil)
; capture_image(x, y, l, h) : un rectangle du dessin devient une image (son numéro)
(defun capture_image (x y l h)
   (setq _n (evaljs_i (list "Pyt.captureImage" x y l h)))
   (_erreur_navigateur)
   _n)

; liste_sons(), liste_images(), liste_données() : les noms des fichiers du projet, triés,
; à donner tels quels à charge_son, charge_image ou charge_données ; liste_sons() et
; liste_images() y ajoutent les sons et les images des médias du site (« médias/sounds/ding.wav »,
; « médias/images/étoile.svg »). evaljs_j rend une liste de textes.
(defun liste_sons () (evaljs_j "Pyt.listeFichiers('sons', true)"))
(defun liste_images () (evaljs_j "Pyt.listeFichiers('images', true)"))
(defun liste_données () (evaljs_j "Pyt.listeFichiers('données', false)"))

;------------------------------------------------------------------
; La 3D (voir js/scene3d.js, avec three.js)
; scène = nouvelle_scène() rend une scène vide : un dictionnaire caché, avec sa liste d'objets.
; Chaque primitive y ajoute un dictionnaire et rend le numéro de l'objet :
;   scène.cube(x, y, z, côté, couleur)           scène.boîte(x, y, z, largeur, hauteur, profondeur, couleur)
;   scène.sphère(x, y, z, rayon, couleur)        scène.cylindre(x, y, z, rayon, hauteur, couleur)
;   scène.cône(x, y, z, rayon, hauteur, couleur)
;   scène.anneau(x, y, z, rayon_intérieur, rayon_extérieur, couleur)   (couché à plat)
;   scène.lumière(x, y, z) ou scène.lumière(x, y, z, intensité)
;   scène.caméra(x, y, z, vx, vy, vz) : où est la caméra, et le point qu'elle regarde
;   scène.groupe(x, y, z) rend un nouveau groupe : une scène dans la scène, qui se déplace et
;     tourne avec tous ses objets (la Lune dans le groupe de la Terre : orbite.sphère(...))
; L'écriture en méthode est celle de la documentation : le transpileur fait de scène.cube(...)
; l'appel (cube scène ...), comme cube(scène, ...), qui reste accepté.
; montre_3d(scène) l'envoie d'un coup (en JSON, que l'élève ne voit jamais) : la couche 3D
; apparaît sous le canevas 2D, devenu transparent. Ensuite, sur un numéro d'objet (ou un groupe) :
;   o.déplace(x, y, z)   o.tourne(ax, ay, az) (des degrés de plus)   o.oriente_3d(ax, ay, az)
;   o.colore(couleur)    o.texture(image) (le numéro rendu par charge_image)   o.lumineux()
;   o.cache_objet()      o.montre_objet()
;   regarde(x, y, z) : la caméra vise ce point ; caméra_libre() : la souris la fait tourner
;   quand_clic_objet(f) : f(numéro) reçoit l'objet cliqué
; Une primitive appelée après montre_3d ajoute aussitôt son objet à la scène montrée.
;------------------------------------------------------------------
(setq _numéro_3d 0)
(setq _3d_montrée false)
; la scène (ou le groupe) donnée à une primitive ; une autre valeur est une erreur claire
(defun _scène_3d (_s _nom)
   (if (in (string (type _s)) "dictionary")
      (if (in_it _s "objets") _s (throw (+ _nom " : il faut une scène (nouvelle_scène()) ou un groupe devant le point, comme dans scène." _nom "(...)")))
      (throw (+ _nom " : il faut une scène (nouvelle_scène()) ou un groupe devant le point, comme dans scène." _nom "(...)"))))
; le numéro d'un objet 3D : un nombre (rendu par une primitive), ou un groupe
(defun _numéro_objet_3d (_o _nom)
   (cond
      ((numberp _o) _o)
      ((in (string (type _o)) "dictionary") (@ _o "numéro"))
      (true (throw (+ _nom " : il faut un objet 3D devant le point (le numéro rendu par scène.cube, scène.sphère...) ou un groupe, comme dans terre." _nom "(...)")))))
(defun _nouveau_3d (_s _nom _entrée)
   (setq _parent (_scène_3d _s _nom))
   (+= _numéro_3d 1)
   (set@ _entrée "numéro" _numéro_3d)
   (push (@ _parent "objets") _entrée)
   (if _3d_montrée (evaljsc (list "Pyt.ajoute3D" (@ _parent "numéro") (json _entrée))))
   _numéro_3d)
(defun nouvelle_scène ()
   (+= _numéro_3d 1)
   (dictionary "genre" "groupe" "numéro" _numéro_3d "x" 0 "y" 0 "z" 0 "objets" (list)))
(defun cube (s x y z côté (c "blanc"))
   (_nouveau_3d s "cube" (dictionary "genre" "cube" "x" x "y" y "z" z "côté" côté "couleur" c)))
(defun boîte (s x y z l h p (c "blanc"))
   (_nouveau_3d s "boîte" (dictionary "genre" "boîte" "x" x "y" y "z" z "largeur" l "hauteur" h "profondeur" p "couleur" c)))
(defun sphère (s x y z r (c "blanc"))
   (_nouveau_3d s "sphère" (dictionary "genre" "sphère" "x" x "y" y "z" z "rayon" r "couleur" c)))
(defun cylindre (s x y z r h (c "blanc"))
   (_nouveau_3d s "cylindre" (dictionary "genre" "cylindre" "x" x "y" y "z" z "rayon" r "hauteur" h "couleur" c)))
(defun cône (s x y z r h (c "blanc"))
   (_nouveau_3d s "cône" (dictionary "genre" "cône" "x" x "y" y "z" z "rayon" r "hauteur" h "couleur" c)))
(defun anneau (s x y z intérieur extérieur (c "blanc"))
   (_nouveau_3d s "anneau" (dictionary "genre" "anneau" "x" x "y" y "z" z "intérieur" intérieur "extérieur" extérieur "couleur" c)))
(defun lumière (s x y z (intensité 2.5) (c "blanc"))
   (_nouveau_3d s "lumière" (dictionary "genre" "lumière" "x" x "y" y "z" z "intensité" intensité "couleur" c)))
(defun caméra (s x y z (vx 0) (vy 0) (vz 0))
   (_nouveau_3d s "caméra" (dictionary "genre" "caméra" "x" x "y" y "z" z "vx" vx "vy" vy "vz" vz)))
; un groupe est rendu tel quel : il sert de scène à ses objets, et d'objet à déplace ou tourne
(defun groupe (s (x 0) (y 0) (z 0))
   (setq _g (dictionary "genre" "groupe" "x" x "y" y "z" z "objets" (list)))
   (_nouveau_3d s "groupe" _g)
   _g)
(defun montre_3d (s)
   (setq _racine (_scène_3d s "montre_3d"))
   (evaljsc (list "Pyt.montre3D" (json _racine)))
   (_erreur_navigateur)
   (setq _3d_montrée true)
   nil)
(defun _change_3d (_genre _o _nom (_a 0) (_b 0) (_c 0))
   (evaljsc (list "Pyt.change3D" _genre (_numéro_objet_3d _o _nom) _a _b _c))
   nil)
(defun déplace (o x y z) (_change_3d "déplace" o "déplace" x y z))
(defun tourne (o ax ay az) (_change_3d "tourne" o "tourne" ax ay az))
(defun oriente_3d (o ax ay az) (_change_3d "oriente" o "oriente_3d" ax ay az))
(defun colore (o c) (_change_3d "colore" o "colore" (string c)))
(defun texture (o image) (_change_3d "texture" o "texture" image))
(defun lumineux (o) (_change_3d "lumineux" o "lumineux"))
(defun cache_objet (o) (_change_3d "cache" o "cache_objet"))
(defun montre_objet (o) (_change_3d "montre" o "montre_objet"))
(defun regarde (x y z) (evaljsc (list "Pyt.change3D" "regarde" 0 x y z)) nil)
(defun caméra_libre () (evaljsc "Pyt.caméraLibre()") nil)
(defmacro quand_clic_objet (fonction) (block (evaljsc (list "Pyt.quandClicObjet" (string (quote fonction)))) nil))

;------------------------------------------------------------------
; Fichiers (sans le système de fichiers du WASM)
; lit_fichier(f) : voir les attentes, plus haut (avec demande et lire).
; écrit_fichier(nom, texte) : le fichier est téléchargé (dossier Téléchargements).
;------------------------------------------------------------------
; Une erreur côté navigateur (fichier absent, nom invalide, taille impossible) devient une erreur du
; programme, que l'élève peut attraper avec essaie / sauf.
(defun _erreur_navigateur ()
   (setq e (evaljsc "Pyt.dernièreErreur()"))
   (if (!= e "") (throw e)))

; canevas(largeur, hauteur), ou portrait(largeur, hauteur) : la taille du canevas (efface le dessin).
; paysage(largeur, hauteur) : sa taille quand l'écran est en largeur ; ainsi, sur une tablette ou un
; téléphone qu'on tourne, le canevas prend aussitôt la taille du sens où on le tient (un ordinateur
; est en largeur). Sans paysage, la taille de canevas vaut dans les deux sens. Le nom de l'instruction
; sert au message d'erreur (voir Pyt.canevas et Pyt.paysage, dans js/canevas.js).
(defun canevas (l h)
   (evaljsc (list "Pyt.canevas" l h))
   (_erreur_navigateur)
   nil)
(defun portrait (l h)
   (evaljsc (list "Pyt.canevas" l h "portrait"))
   (_erreur_navigateur)
   nil)
(defun paysage (l h)
   (evaljsc (list "Pyt.paysage" l h "paysage"))
   (_erreur_navigateur)
   nil)

; charge_données(nom) : un fichier du répertoire données du projet
(defun charge_données (nom)
   (setq contenu (evaljsc (list "Pyt.chargeDonnées" (string nom))))
   (_erreur_navigateur)
   contenu)

; sauve_données(nom, valeur) : écrit (ou remplace) le fichier nom dans le répertoire données du
; projet : un texte tel quel, une autre valeur comme affiche l'écrirait (en_json(x) pour du JSON).
; charge_données(nom) le relit aussitôt ; sans extension, le nom reçoit « .txt ».
(defun sauve_données (nom valeur)
   (evaljsc (list "Pyt.sauveDonnées" (string nom) (_texte valeur)))
   (_erreur_navigateur)
   nil)

; charge_programme(nom) : le code d'un programme du projet ; sauve_programme(nom, code) l'écrit
; (ou le crée), sans l'ouvrir ; vérifie_code(code) : "" si le code se compile, sinon le message
; d'erreur (rien n'est exécuté). L'Éditeur des cartes s'en sert pour écrire biblios.pyf.
(defun charge_programme (nom)
   (setq _c (evaljsc (list "Pyt.chargeProgramme" (string nom))))
   (_erreur_navigateur)
   _c)
(defun sauve_programme (nom code)
   (evaljsc (list "Pyt.sauveProgramme" (string nom) (string code)))
   (_erreur_navigateur)
   nil)
(defun vérifie_code (code) (evaljsc (list "Pyt.vérifieCode" (string code))))

; range_données("don0", valeur) : range la valeur (écrite comme affiche l'écrirait) dans
; l'onglet don0 de la section Données ; l'onglet est créé s'il vient juste après le dernier
(defun range_données (nom valeur)
   (setq e (evaljsc (list "Pythonerie.rangeDonnées" (string nom) (_texte valeur))))
   (if (!= e "") (throw e))
   nil)

; prend_données("don0") : le texte actuel de l'onglet don0 de la section Données ("" s'il est vide)
(defun prend_données (nom)
   (setq contenu (evaljsc (list "Pythonerie.prendDonnées" (string nom))))
   (setq e (evaljsc "Pythonerie.erreurDonnées()"))
   (if (!= e "") (throw e))
   contenu)

; ouvre_page(adresse) : ouvre la page https://... dans un nouvel onglet ; le navigateur ne
; l'accepte que juste après un clic ou une touche (sinon, une erreur le dit)
(defun ouvre_page (adresse)
   (evaljsc (list "Pyt.ouvrePage" (string adresse)))
   (_erreur_navigateur)
   nil)

(defun écrit_fichier (nom texte)
   (evaljsc (list "Pyt.écritFichier" (string nom) (_texte texte)))
   (_erreur_navigateur)
   nil)


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
