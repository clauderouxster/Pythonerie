;Date: 2026/11/02
;Author: Claude Roux
;Description: Optimiseur du parseur produit par compiler.lisp
;
; compiler.lisp écrit basic.lisp : un code régulier, aligné sur la grammaire, toujours utilisable
; seul. optimise.lisp le relit comme du code LispE et en écrit une version plus rapide,
; basic_opt.lisp, sans toucher à basic.lisp :
;   1. les règles identiques (à leur nom près) sont fusionnées ;
;   2. dans une alternative (or a b c…), le jeton courant aiguille (switch) vers les seules règles
;      qui peuvent commencer par lui ; les premiers jetons possibles de chaque règle sont calculés
;      d'après basic.lisp lui-même ;
;   3. quelques règles reçoivent une garde écrite à la main (voir « Les heuristiques ») : le jeton
;      suivant, ou un « : » avant le « ] » ;
;   4. les règles feuilles (Word, anumber…) peuvent garder leur réponse pour chaque jeton (un
;      cache, remis à zéro par abstract_tree ; aucune par défaut, voir feuilles_en_cache) ;
;   5. quelques règles réessayées souvent au même endroit gardent leur résultat pour chaque jeton
;      (voir règles_mémorisées).
; Puis il vérifie son travail : les arbres de basic.lisp et de basic_opt.lisp doivent être
; identiques sur un corpus de programmes, et sur quelques programmes fautifs (les messages
; d'erreur) ; sinon basic_opt.lisp n'est pas écrit. La vérification tourne dans deux
; interpréteurs neufs (lispe doit être dans le PATH).
;
; Utilisation :
;   lispe optimise.lisp <répertoire> <programmes…>
; lit <répertoire>/basic.lisp et écrit <répertoire>/basic_opt.lisp ; chaque programme est préparé
; comme dans compilepython (remplace_fchaînes, injecte_labels de <répertoire>/transpiler.lisp).
; Exemple : lispe optimise.lisp . ../exemples/*.pyf

; ------------------------------------------------------------------
; Les heuristiques : des gardes écrites à la main, qui découlent des règles de la grammaire.
; Chaque appel de la règle (n'importe où dans basic.lisp) devient (and (G_règle tokens p) appel) :
; la garde ne doit refuser que ce que la règle refuserait elle-même. Une règle absente de la
; grammaire est ignorée ; une heuristique fausse est repérée par la vérification.
; ------------------------------------------------------------------
(setq heuristiques '("C_walrus" "C_tojoin" "C_alapython" "C_call" "C_method" "C_interval"))
(setq code_heuristiques «
; --- Les gardes (optimise.lisp, "Les heuristiques") ---
(defun _suivant (tokens p)
   (if (< (+ p 1) (size tokens)) (@ tokens (+ p 1)) ""))

; walrus := Word %: %= …
(defun G_walrus (tokens p)
   (eq (_suivant tokens p) ":"))

; tojoin := [variable^astring] %. … (variable : Word, ou Word suivi de [ … ])
(defun G_tojoin (tokens p)
   (in '("." "[") (_suivant tokens p)))

; alapython := [astring^anumber] %. …
(defun G_alapython (tokens p)
   (eq (_suivant tokens p) "."))

; call := [lambda^Word] %( … (lambda commence par [)
(defun G_call (tokens p)
   (and (< p (size tokens))
      (or (eq (@ tokens p) "[") (eq (_suivant tokens p) "("))))

; method := variable callmethod … (callmethod commence par un point)
(defun G_method (tokens p)
   (in '("." "[") (_suivant tokens p)))

; interval := %[ computing? %: … %] : un ":" avant le "]" qui ferme ce crochet
(defun G_interval (tokens p)
   (setq trouvé nil)
   (if (and (< p (size tokens)) (eq (@ tokens p) "["))
      (block
         (setq prof 0)
         (setq n (size tokens))
         (+= p 1)
         (while (and (< p n) (not trouvé) (>= prof 0))
            (setq t (@ tokens p))
            (cond
               ((in '("[" "(" "{") t) (+= prof 1))
               ((in '("]" ")" "}") t) (-= prof 1))
               ((and (eq t ":") (eq prof 0)) (setq trouvé true)))
            (+= p 1))))
   trouvé)
»)

; Les règles feuilles écrites à la main dans compiler.lisp (le reste est généré). Celles de
; feuilles_en_cache gardent leur réponse pour chaque jeton (elles ne dépendent que de lui). Vide
; par défaut : une fois l'aiguillage fait, les feuilles ne sont presque plus essayées pour rien,
; et le cache coûte plus qu'il ne rapporte (Canopée : 74 ms sans, 83 ms avec
; '("C_Word" "C_anumber" "C_astring" "C_lispe")).
(setq feuilles '("C_any" "C_Pythonjoin" "C_Pythonword" "C_Word" "C_lispe" "C_astring" "C_anumber"))
(setq feuilles_en_cache ())

; Les règles générées dont le résultat est gardé pour chaque jeton (voir « 5. Les règles
; mémorisées ») : celles qu'on réessaie souvent au même endroit. Mesuré sur Canopée (aiguillage et
; gardes faits) : rien 74 ms ; computing 53 ; callitem 56 ; variable 58 ; computing et variable 46 ;
; y ajouter indexes, astring ou expressions n'apporte plus rien.
(setq règles_mémorisées '("C_computing" "C_variable"))

; Quelques programmes fautifs : les messages d'erreur doivent rester les mêmes
(setq fautes '("x = [1, 2" "print(l[1:)" "f = [lambda (x) x + 1" "a = 3 +" "y = {\"a\": 1, \"b\"" "z = l[2" "print(\"a\".join(" "w := "))

; ------------------------------------------------------------------
; Le mode de vérification : lispe optimise.lisp --arbres <grammaire> <transpileur> <programmes…>
; affiche l'arbre de chaque programme (une ligne chacun), puis le temps de l'analyse
; ------------------------------------------------------------------
; (grammaire et transpileur sont chargés avant, au premier niveau : chargés dans une fonction,
; leurs setq y resteraient locaux)
(defun affiche_arbres (programmes)
   (setg pythonmode true)
   (setq durée 0)
   (setq textes (mapcar (λ (f) (fread f)) programmes))
   (loop k (range 0 (size programmes) 1)
      (setq code (injecte_labels (remplace_fchaînes (@ textes k))))
      (setq t0 (chrono))
      (setq arbre (abstract_tree code))
      (+= durée (- (chrono) t0))
      (println (+ (@ programmes k) " " (string arbre))))
   (loop c fautes
      (println (+ "faute " (string (abstract_tree (injecte_labels (remplace_fchaînes c)))))))
   (println (+ "durée " (string durée))))

; ------------------------------------------------------------------
; La lecture de basic.lisp : chaque (defun …) de premier niveau, avec sa place dans le texte
; ------------------------------------------------------------------
(setq lecteur (tokenizer_main))

; ------------------------------------------------------------------
; Les tables, remplies par lit_grammaire
; ------------------------------------------------------------------
(setq noms ())            ; les fonctions, dans l'ordre du fichier
(setq débuts {})          ; nom -> indice du « (defun » dans le texte
(setq fins {})            ; nom -> indice qui suit la forme
(setq formes {})          ; nom -> la forme lue
(setq stats {"fusions":0 "aiguillages":0 "gardes":0})

; tokenize_full découpe comme le lecteur de LispE (les chaînes et les «…» sont des jetons entiers,
; les commentaires disparaissent) et rend les jetons, leurs bornes (début, fin exclue ; en
; caractères pour une string_) et leurs lignes. Une forme de premier niveau qui commence par
; « (defun » va de sa parenthèse ouvrante à celle qui la referme ; le texte entre les formes
; (commentaires, link…) est recopié tel quel. Un retour à la ligne est ajouté avant de tokeniser,
; comme dans abstract_tree : sans lui, la borne droite d'un jeton qui touche la fin du texte
; vaudrait sa borne gauche.
(defun lit_grammaire (txt)
   (setq lu (tokenize_full lecteur (+ txt "\n")))
   (setq jetons (@ lu 0))
   (setq bornes (@ lu 1))
   (setq profondeur 0)
   (setq ouverture -1)
   (loop k (range 0 (size jetons) 1)
      (setq jt (@ jetons k))
      (cond
         ((eq jt "(")
            (if (and (eq profondeur 0) (eq (@ jetons (+ k 1)) "defun")) (setq ouverture k))
            (+= profondeur 1))
         ((eq jt ")")
            (-= profondeur 1)
            (check (and (eq profondeur 0) (>= ouverture 0))
               (setq nom (@ jetons (+ ouverture 2)))
               (setq d (@ bornes (* 2 ouverture)))
               (setq f (@ bornes (+ 1 (* 2 k))))
               (push noms nom)
               (set@ débuts nom d)
               (set@ fins nom f)
               (set@ formes nom (eval (+ "(quote " (@@ txt d f) ")")))
               (setq ouverture -1))))))

(defun compte_stat (clé) (set@ stats clé (+ 1 (@ stats clé))))

; une règle générée par compiler.lisp (et non une feuille écrite à la main)
(defun générée (nom)
   (and (or (startwith nom "C_") (startwith nom "P_") (startwith nom "O_") (startwith nom "S_"))
      (not (in feuilles nom))))

(defun règle (nom) (or (générée nom) (in feuilles nom)))

; ------------------------------------------------------------------
; 1. La fusion des règles identiques (à leur nom près), jusqu'à ce qu'il n'y en ait plus
; ------------------------------------------------------------------
(setq fusionnées {})      ; nom supprimé -> nom gardé

; (return est un mot-clé de LispE : une fonction qui rendrait l'atome return l'exécuterait. Les
; listes sont donc reconstruites élément par élément, et seules les sous-listes passent par un appel)
(defun renomme (e table)
   (setq r ())
   (loop x e
      (cond
         ((consp x) (push r (renomme x table)))
         ((and (atomp x) (key@ table (string x))) (push r (key@ table (string x))))
         (true (push r x))))
   r)

(defun fusionne ()
   (setq encore true)
   (while encore
      (setq encore nil)
      (setq vues {})
      (setq table {})
      (loop nom noms
         (check (and (générée nom) (not (key@ fusionnées nom)))
            (setq clé (string (cddr (@ formes nom))))
            (setq gardé (key@ vues clé))
            (ife gardé
               (block
                  (set@ table nom (atom gardé))
                  (set@ fusionnées nom gardé)
                  (compte_stat "fusions")
                  (setq encore true))
               (set@ vues clé nom))))
      (check encore
         (loop nom noms
            (check (not (key@ fusionnées nom))
               (set@ formes nom (renomme (@ formes nom) table))))
         ; une fusion faite plus tôt peut viser une règle fusionnée maintenant
         (loop nom (keys@ fusionnées)
            (setq cible (@ fusionnées nom))
            (if (key@ table cible) (set@ fusionnées nom (string (@ table cible))))))))

; ------------------------------------------------------------------
; 2. Les premiers jetons possibles : (vide premiers), vide étant vrai si la règle peut réussir
; sans lire de jeton, premiers une liste de jetons en minuscules, ou tout (n'importe quel jeton)
; ------------------------------------------------------------------
(setq infos {})
(setq neutres '(setq setg set@ push pop nconc))

(defun réunit (a b)
   (ife (or (eq a 'tout) (eq b 'tout))
      'tout
      (block
         (setq r (clone a))
         (loop x b (if (not (in r x)) (push r x)))
         r)))

(defun séquence (l)
   (setq ens ())
   (setq vide true)
   (loop x l
      (check vide
         (setq p (premiers x))
         (setq ens (réunit ens (@ p 1)))
         (setq vide (@ p 0))))
   (list vide ens))

(defun alternatives (l)
   (setq ens ())
   (setq vide nil)
   (loop x l
      (setq p (premiers x))
      (setq ens (réunit ens (@ p 1)))
      (if (@ p 0) (setq vide true)))
   (list vide ens))

(defun premiers (e)
   (cond
      ((not (consp e)) (list true 'tout))
      ((eq (car e) 'compare)
         (ife (stringp (@ e 2)) (list nil (list (lower (@ e 2)))) (list true 'tout)))
      ((eq (car e) 'and) (séquence (cdr e)))
      ((eq (car e) 'or) (alternatives (cdr e)))
      ((eq (car e) 'if) (premiers (@ e 1)))
      ((eq (car e) 'while) (list true (@ (premiers (@ e 1)) 1)))
      ((in neutres (car e)) (list true ()))
      ; une garde (G_…) ne lit aucun jeton
      ((garde_p e) (list true ()))
      ((and (atomp (car e)) (règle (string (car e)))) (info (string (car e))))
      (true (list true 'tout))))

; la condition qui décide d'une règle générée : celle de son if (C_), de son check (P_, O_) ou
; de son while (S_), sous le check (and do_not_stop …) éventuel
(defun condition_de (corps)
   (setq trouvée nil)
   (loop f corps
      (check (and (nullp trouvée) (consp f))
         (cond
            ((and (eq (car f) 'check) (consp (@ f 1)) (eq (car (@ f 1)) 'and) (eq (@ (@ f 1) 1) 'do_not_stop))
               (setq trouvée (condition_de (cddr f))))
            ((in '(check while if) (car f)) (setq trouvée (@ f 1))))))
   trouvée)

(defun calcule_info (nom)
   (setq forme (key@ formes nom))
   (cond
      ((eq nom "C_Pythonjoin") (list nil '("join" "joindre")))
      ((or (nullp forme) (in feuilles nom)) (list nil 'tout))
      (true
         (setq corps (cdr (cddr forme)))
         (setq c (condition_de corps))
         (ife c
            (block
               (setq p (premiers c))
               ; O_ et S_ finissent par true : elles réussissent toujours
               (if (eq (@ corps -1) true) (list true (@ p 1)) p))
            (list true 'tout)))))

(defun info (nom)
   (setq nom (select (key@ fusionnées nom) nom))
   (setq déjà (key@ infos nom))
   (ife déjà
      déjà
      (block
         ; en cours de calcul (une règle qui revient sur elle-même) : prudence
         (set@ infos nom (list true 'tout))
         (setq r (calcule_info nom))
         (set@ infos nom r)
         r)))

; ------------------------------------------------------------------
; 3. L'aiguillage : (or a b c…) devient (switch jeton ("lit" (or …)) … (true (or …)))
; ------------------------------------------------------------------
; la liste-position (i0, i1…) d'une alternative, ou nil si ce n'est pas un appel de règle reconnu
(defun position_de (e)
   (cond
      ((not (consp e)) nil)
      ((eq (car e) 'compare) (@ e 3))
      ; un appel protégé par une garde : (and (G_règle tokens (car pos)) appel)
      ((and (eq (car e) 'and) (eq (size e) 3) (garde_p (@ e 1))) (position_de (@ e 2)))
      ((and (eq (car e) 'and) (consp (@ e 1)) (eq (car (@ e 1)) 'setq)
            (consp (@ (@ e 1) 2)) (eq (car (@ (@ e 1) 2)) 'clone))
         (@ (@ (@ e 1) 2) 1))
      ((and (atomp (car e)) (règle (string (car e)))) (@ e 2))
      (true nil)))

(defun ou_de (l)
   (cond
      ((nullp l) nil)
      ((eq (size l) 1) (car l))
      (true (cons 'or l))))

; le switch qui remplace (or alts…), ou nil s'il ne s'applique pas : andvalue rend la valeur de
; sa dernière expression (and rend un booléen) ; not s'applique élément par élément à une liste,
; nullp la teste
(defun aiguille (alts)
   (setq pos (position_de (car alts)))
   (setq ok (and pos (atomp pos) (> (size alts) 1)))
   (loop a alts (if (not (eq (position_de a) pos)) (setq ok nil)))
   (andvalue ok
      (block
         ; les jetons qui peuvent ouvrir chaque alternative (tout : n'importe lequel)
         (setq ensembles (mapcar (λ (a) (setq p (premiers a)) (if (@ p 0) 'tout (@ p 1))) alts))
         (setq littéraux ())
         (loop x ensembles (if (neq x 'tout) (setq littéraux (réunit littéraux x))))
         (>= (size (filterlist (λ (x) (neq x 'tout)) ensembles)) 2))
      (block
         (setq cas ())
         (loop l littéraux
            (setq choisies ())
            (loop k (range 0 (size alts) 1)
               (setq x (@ ensembles k))
               (if (or (eq x 'tout) (in x l)) (push choisies (@ alts k))))
            (push cas (list l (ou_de choisies))))
         (setq autres ())
         (loop k (range 0 (size alts) 1)
            (if (eq (@ ensembles k) 'tout) (push autres (@ alts k))))
         (push cas (list true (ou_de autres)))
         (compte_stat "aiguillages")
         ; le jeton n'est mis en minuscules que si un littéral a des lettres
         (setq jeton (list '@ 'tokens (list 'car pos)))
         (if (filterlist (λ (l) (neq (upper l) (lower l))) littéraux)
            (setq jeton (list 'lower jeton)))
         (cons 'switch
            (cons (list 'if (list '< (list 'car pos) (list 'size 'tokens)) jeton "")
               cas)))))

; la forme réécrite (une liste) : les sous-listes d'abord, puis l'aiguillage de ce or, puis les
; gardes ; les atomes restent dans la boucle (voir renomme)
(defun transforme (e)
   (setq r ())
   (loop x e
      (if (consp x) (push r (transforme x)) (push r x)))
   (garde (orvalue (andvalue (eq (car r) 'or) (aiguille (cdr r))) r)))

(defun garde_p (e)
   (and (consp e) (atomp (car e)) (startwith (string (car e)) "G_")))

; un appel d'une règle qui a une heuristique : (and (G_règle tokens (car pos)) appel)
(defun garde (e)
   (ife (and (consp e) (atomp (car e)) (in heuristiques (string (car e))) (atomp (@ e 2)))
      (block
         (compte_stat "gardes")
         (list 'and (list (atom (+ "G_" (@@ (string (car e)) 2))) 'tokens (list 'car (@ e 2))) e))
      e))

; ------------------------------------------------------------------
; 4. Les feuilles en cache : la feuille d'origine devient <nom>_brut ; la nouvelle garde, pour
; chaque jeton, 0 (pas encore essayé), 1 (réussite) ou 2 (échec)
; ------------------------------------------------------------------
(defun feuille_en_cache (nom)
   (+ "(defun " nom " (tokens i v)\n"
      "   (setq p (car i))\n"
      "   (setq c (@ cache_" nom " p))\n"
      "   (ife (eq c 0)\n"
      "      (block\n"
      "         (setq r (" nom "_brut tokens i v))\n"
      "         (set@ cache_" nom " p (if r 1 2))\n"
      "         r)\n"
      "      (and (eq c 1) (" nom "_brut tokens i v))))\n"))

; ------------------------------------------------------------------
; 5. Les règles mémorisées : pour chaque jeton, la règle garde son résultat (où elle s'arrête et
; ce qu'elle a produit) ou son échec ; un second essai au même endroit ne refait pas l'analyse.
; La règle d'origine devient <nom>_brut. Ce qu'elle produit est recopié (clone) à chaque usage.
; ------------------------------------------------------------------
(defun règle_mémorisée (nom)
   (+ "(defun " nom " (tokens i v)\n"
      "   (check do_not_stop\n"
      "      (setq p (car i))\n"
      "      (setq m (@ mémo_" nom " p))\n"
      "      (cond\n"
      "         ((eq m 0)\n"
      "            (setq w ())\n"
      "            (ife (" nom "_brut tokens i w)\n"
      "               (block\n"
      "                  (set@ mémo_" nom " p (list (car i) w))\n"
      "                  (nconc v (clone w))\n"
      "                  true)\n"
      "               (block\n"
      "                  (set@ mémo_" nom " p 1)\n"
      "                  nil)))\n"
      "         ((eq m 1) nil)\n"
      "         (true\n"
      "            (set@ i 0 (car m))\n"
      "            (nconc v (clone (@ m 1)))\n"
      "            true))))\n"))

; les caches et les mémoires sont remis à zéro dans abstract_tree, juste avant l'analyse (une fois
; les jetons connus, quelle que soit la façon de les obtenir : fusionne_hangul en coréen)
(setq ancre_analyse "(setq i '(0))")

; ------------------------------------------------------------------
; L'écriture de basic_opt.lisp
; ------------------------------------------------------------------
(defun optimise (txt source)
   (lit_grammaire txt)
   (fusionne)
   (setq morceaux ())
   (setq k 0)
   (setq caches (filterlist (λ (n) (key@ formes n)) feuilles_en_cache))
   (setq mémos (filterlist (λ (n) (and (key@ formes n) (not (key@ fusionnées n)))) règles_mémorisées))
   (setq ajouts code_heuristiques)
   (loop nom noms
      (setq d (@ débuts nom))
      (setq f (@ fins nom))
      (push morceaux (@@ txt k d))
      (setq texte (@@ txt d f))
      (cond
         ((key@ fusionnées nom)
            (push morceaux (+ "; " nom " : identique à " (@ fusionnées nom) " (optimise.lisp)")))
         ((in caches nom)
            (push morceaux (+ "(defun " nom "_brut" (@@ texte (+ 7 (size nom)))))
            (+= ajouts (+ "\n" (feuille_en_cache nom))))
         ((eq nom "abstract_tree")
            (setq init (+ (join (mapcar (λ (n) (+ "\n   (setg cache_" n " (rho (+ 1 (size tokens)) (list 0)))")) caches) "")
                  (join (mapcar (λ (n) (+ "\n   (setg mémo_" n " (rho (+ 1 (size tokens)) (list 0)))")) mémos) "")))
            (ife (find texte ancre_analyse)
               (push morceaux (replace texte ancre_analyse (+ (trim init) "\n   " ancre_analyse)))
               (block
                  (println (+ "abstract_tree : « " ancre_analyse " » est introuvable, impossible de préparer les caches"))
                  (exit 1))))
         ((générée nom)
            (setq nouvelle (transforme (@ formes nom)))
            (ife (in mémos nom)
               (block
                  (push morceaux (prettify (cons 'defun (cons (atom (+ nom "_brut")) (cddr nouvelle)))))
                  (+= ajouts (+ "\n" (règle_mémorisée nom))))
               (push morceaux (if (eq (string nouvelle) (string (eval (+ "(quote " texte ")")))) texte (prettify nouvelle)))))
         (true (push morceaux texte)))
      (setq k f))
   (push morceaux (@@ txt k))
   ; l'en-tête : la date que compiler.lisp écrit à chaque génération, et le nombre de fonctions
   ; (version.py s'en sert pour repérer un basic_opt.lisp périmé)
   (+ ";Optimisé par optimise.lisp, d'après " source " (" (string (size noms)) " fonctions, "
      (trim (@ (split txt "\n") 0)) ")\n"
      (join morceaux "")
      "\n" ajouts))

; les arbres d'une grammaire, calculés par un interpréteur neuf
(defun arbres (grammaire transpileur programmes)
   (setq cmd (+ "lispe \"" (@ _args 0) "\" --arbres \"" grammaire "\" \"" transpileur "\""
         (join (mapcar (λ (p) (+ " \"" p "\"")) programmes) "")))
   (command cmd))

(defun principal ()
   (setq rép (@ _args 1))
   (setq programmes (cdr (cdr _args)))
   (if (eq (size programmes) 0)
      (block
         (println "Utilisation : lispe optimise.lisp <répertoire> <programmes…>")
         (exit 1)))
   (setq source (+ rép "/basic.lisp"))
   (setq sortie (+ rép "/basic_opt.lisp"))
   (setq essai (+ rép "/basic_opt.essai.lisp"))
   (setq transpileur (+ rép "/transpiler.lisp"))
   (setq txt (replace (fread source) "\r" ""))
   (setq t0 (chrono))
   (setq résultat (optimise txt "basic.lisp"))
   (println (+ "Optimisation : " (string (@ stats "fusions")) " fusions, "
         (string (@ stats "aiguillages")) " aiguillages, " (string (@ stats "gardes")) " gardes, "
         (string (size (filterlist (λ (n) (key@ formes n)) feuilles_en_cache))) " feuilles en cache, "
         (string (size (filterlist (λ (n) (key@ formes n)) règles_mémorisées))) " règles mémorisées ("
         (string (- (chrono) t0)) " ms)"))
   ; la version essayée est écrite à sa place, pour que les deux interpréteurs neufs la chargent ;
   ; si elle est refusée, basic_opt.lisp redevient une copie de basic.lisp (toujours utilisable)
   (fwrite sortie résultat)
   (setq avant (lignes (arbres source transpileur programmes)))
   (setq après (lignes (arbres sortie transpileur programmes)))
   (setq durée_avant (durée_de avant))
   (setq durée_après (durée_de après))
   (setq avant (filterlist (λ (l) (not (startwith l "durée "))) avant))
   (setq après (filterlist (λ (l) (not (startwith l "durée "))) après))
   (ife (and durée_avant durée_après (eq (join avant "\n") (join après "\n")))
      (println (+ "Vérifié sur " (string (size programmes)) " programmes et " (string (size fautes))
            " fautes : mêmes arbres. Analyse : " durée_avant " ms -> " durée_après " ms.\nÉcrit : " sortie))
      (block
         (fwrite essai résultat)
         (fwrite sortie (+ ";Non optimisé : optimise.lisp a refusé sa version (voir basic_opt.essai.lisp)\n" txt))
         (println "ÉCHEC : les arbres diffèrent. basic_opt.lisp est une copie de basic.lisp ;")
         (println (+ "la version refusée est dans " essai "."))
         (if (not durée_avant) (println "  basic.lisp n'a pas fini son analyse"))
         (if (not durée_après) (println "  la version optimisée n'a pas fini son analyse"))
         (loop k (range 0 (min (size avant) (size après)) 1)
            (check (neq (@ avant k) (@ après k))
               (println (+ "  basic.lisp : " (@@ (@ avant k) 0 300)))
               (println (+ "  optimisée  : " (@@ (@ après k) 0 300)))
               (break)))
         (exit 1))))

; les lignes non vides de la sortie d'une commande
(defun lignes (sortie)
   (filterlist (λ (l) (neq l "")) (mapcar (λ (l) (trim l)) sortie)))

; le temps d'analyse affiché par --arbres (ligne « durée … »), ou nil
(defun durée_de (l)
   (setq d (filterlist (λ (x) (startwith x "durée ")) l))
   (if d (@@ (car d) 6) nil))

(ife (eq (@ _args 1) "--arbres")
   (block
      (load (@ _args 2))
      (load (@ _args 3))
      (affiche_arbres (cdr (cdr (cdr (cdr _args))))))
   (principal))
