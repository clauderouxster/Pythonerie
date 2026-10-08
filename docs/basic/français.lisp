;Date: 08/10/2026
;Description: Noms français des instructions de LispE
;
; Chaque ligne (link "nom_français" 'instruction) fait de nom_français un autre nom
; de l'instruction LispE. Le fichier est chargé dans l'interpréteur qui transpile,
; APRÈS transpiler.lisp : le code produit garde donc les noms LispE d'origine
; (mélange(l) devient (shuffle l)).
;
; Instructions reprises de lispe.cxx (set_instruction), strings.cxx, maths.cxx et
; randoms.cxx (deflib).
;
; Règles suivies :
; - les noms suivent l'orthographe française (mélange, insère, clés@) ;
; - pas de traduction pour les noms déjà définis par bibliothèque.lisp (somme, longueur,
;   trie, inverse, arrondi, racine...), par la grammaire (affiche, ajoute) ou pour les
;   mots-clefs (si, pour, dans, et, ou, non...) ;
; - pas de traduction pour les instructions que le transpileur produit lui-même
;   (list, setq, if, loop, at, join, size, push, println...) : une fonction de l'élève
;   portant ce nom entrerait en conflit avec le code produit ;
; - les opérateurs (+, &, ⊂...), les instructions internes (%__void__%, addr_...),
;   les fils d'exécution et les définitions (defun, defpat...) ne sont pas traduits.
;
; Le commentaire de chaque ligne sert de description dans l'aide et la complétion.

;------------------------------------------------------------------
; lispe.cxx — tests
;------------------------------------------------------------------
(link "est_atome" 'atomp)                ; est_atome(x) : Vrai si x est un atome
(link "est_défini" 'boundp)              ; est_défini(x) : Vrai si la variable x a une valeur
(link "est_liste" 'consp)                ; est_liste(x) : Vrai si x est une liste
(link "est_conteneur" 'containerp)       ; est_conteneur(x) : Vrai si x est une liste ou un dictionnaire
(link "est_cyclique" 'cyclicp)           ; est_cyclique(l) : Vrai si la liste l se contient elle-même
(link "est_vide" 'emptyp)                ; est_vide(x) : Vrai si x est vide
(link "est_rien" 'nullp)                 ; est_rien(x) : Vrai si x vaut Rien
(link "est_nombre" 'numberp)             ; est_nombre(x) : Vrai si x est un nombre
(link "est_chaîne" 'stringp)             ; est_chaîne(x) : Vrai si x est une chaîne
(link "est_zéro" 'zerop)                 ; est_zéro(x) : Vrai si x vaut 0

;------------------------------------------------------------------
; lispe.cxx — listes
;------------------------------------------------------------------
;(link "tête" 'car)                       ; tête(l) : premier élément de la liste
;(link "queue" 'cdr)                      ; queue(l) : la liste sans son premier élément
;(link "deuxième" 'cadr)                  ; deuxième(l) : deuxième élément de la liste
;(link "construit" 'cons)                 ; construit(x, l) : la liste l précédée de x
;(link "construit_fin" 'consb)            ; construit_fin(x, l) : la liste l suivie de x
(link "dernier@" 'last@)                  ; dernier(l) : dernier élément de la liste
(link "insère" 'insert)                  ; insère(l, x, i) : insère x à la position i
(link "ajoute_début" 'pushfirst)         ; ajoute_début(l, x) : ajoute x au début de la liste
(link "ajoute_fin" 'pushlast)            ; ajoute_fin(l, x) : ajoute x à la fin de la liste
(link "retire_élément" 'pop)                     ; retire(l, i) : retire l'élément à la position i (le dernier sans i)
(link "retire_premier" 'popfirst)        ; retire_premier(l) : retire le premier élément
(link "retire_dernier" 'poplast)         ; retire_dernier(l) : retire le dernier élément
(link "colle_listes" 'nconc)             ; colle(l1, l2) : ajoute les éléments de l2 à la fin de l1
(link "aplatit@" 'flatten)                ; aplatit(l) : met à plat les listes imbriquées
(link "tranche@" 'slice@)                ; tranche(l, n) : découpe l en morceaux de n éléments
(link "compte@" 'count@)                 ; compte(x, y) : nombre de fois où y apparaît dans x
(link "cherche" 'find)                   ; cherche(x, y) : position de y dans x
(link "cherche_dernier" 'rfind)          ; cherche_dernier(x, y) : position de la dernière occurrence de y
(link "cherche_tout" 'findall)           ; cherche_tout(x, y) : positions de toutes les occurrences de y
(link "remplace_tout" 'replaceall)       ; remplace_tout(x, a, b) : remplace tous les a par b
(link "sans_doublons" 'unique)           ; sans_doublons(l) : la liste sans éléments répétés
(link "min_max" 'minmax)                 ; min_max(l) : [minimum, maximum]
(link "produit" '∏)                      ; produit(l) : produit des éléments
(link "apparie" 'zip)                    ; apparie(l1, l2) : liste des couples [a, b]
(link "apparie_avec" 'zipwith)           ; apparie_avec(f, l1, l2) : f appliquée à chaque couple
(link "énumère" 'enum)                   ; énumère(l) : liste des couples [position, élément]
;(link "copie" 'clone)                    ; copie(x) : une copie de la liste ou du dictionnaire
(link "étend" 'extend)                   ; étend(l1, l2) : ajoute les éléments de l2 à l1
(link "liste_chaînée" 'llist)            ; liste_chaînée(a, b, ...) : liste chaînée
(link "liste_entiers" 'integers)         ; liste_entiers(a, b, ...) : liste d'entiers
(link "liste_réels" 'floats)             ; liste_réels(a, b, ...) : liste de réels (simple précision)
(link "liste_nombres" 'numbers)          ; liste_nombres(a, b, ...) : liste de nombres réels
(link "liste_chaînes" 'strings)          ; liste_chaînes(a, b, ...) : liste de chaînes
(link "intervalle_infini" 'irange)       ; intervalle_infini(début, pas) : suite de nombres sans fin

;------------------------------------------------------------------
; lispe.cxx — dictionnaires et ensembles
;------------------------------------------------------------------
(link "clés@" 'keys@)                     ; clés(d) : liste des clés du dictionnaire
(link "clefs@" 'keys@)                     ; clés(d) : liste des clés du dictionnaire
(link "valeurs@" 'values@)                ; valeurs(d) : liste des valeurs du dictionnaire
(link "dictionnaire_entiers" 'dictionaryi)     ; dictionnaire_entiers() : dictionnaire à clés entières
(link "dictionnaire_nombres" 'dictionaryn)     ; dictionnaire_nombres() : dictionnaire à clés réelles
(link "dictionnaire_ordonné" 'dictionarytree)  ; dictionnaire_ordonne() : dictionnaire trié selon ses clés
(link "ensemble" 'set)                   ; ensemble(a, b, ...) : ensemble (sans doublons)
(link "ensemble_chaînes" 'sets)          ; ensemble_chaînes(a, b, ...) : ensemble de chaînes
(link "ensemble_entiers" 'seti)          ; ensemble_entiers(a, b, ...) : ensemble d'entiers
(link "ensemble_nombres" 'setn)          ; ensemble_nombres(a, b, ...) : ensemble de nombres

;------------------------------------------------------------------
; lispe.cxx — fonctions sur les listes (style Haskell)
;------------------------------------------------------------------
(link "applique" 'apply)                 ; applique(f, l) : appelle f avec les éléments de l comme arguments
(link "transforme" 'map)                 ; transforme(f, l) : applique f à chaque élément
(link "transforme_liste" 'maplist)       ; transforme_liste(f, l) : applique f à chaque élément
(link "filtre" 'filter)                  ; filtre(condition, l) : garde les éléments qui vérifient la condition
(link "filtre_liste" 'filterlist)        ; filtre_liste(condition, l) : garde les éléments qui vérifient la condition
(link "prend_éléments" 'take)                     ; prend(n, l) : les n premiers éléments
(link "prend_tant_que" 'takewhile)       ; prend_tant_que(condition, l) : les premiers éléments tant que la condition est vraie
(link "prend_liste" 'takelist)           ; prend_liste(condition, l) : les premiers éléments tant que la condition est vraie
(link "saute_éléments" 'drop)            ; saute(n, l) : la liste sans ses n premiers éléments
(link "saute_tant_que" 'dropwhile)       ; saute_tant_que(condition, l) : saute les éléments tant que la condition est vraie
(link "saute_liste" 'droplist)           ; saute_liste(condition, l) : saute les éléments tant que la condition est vraie
(link "replie_gauche" 'foldl)            ; replie_gauche(f, départ, l) : combine les éléments de gauche à droite
(link "replie_gauche1" 'foldl1)          ; replie_gauche1(f, l) : combine les éléments de gauche à droite
(link "replie_droite" 'foldr)            ; replie_droite(f, départ, l) : combine les éléments de droite à gauche
(link "replie_droite1" 'foldr1)          ; replie_droite1(f, l) : combine les éléments de droite à gauche
(link "cumule_gauche" 'scanl)            ; cumule_gauche(f, départ, l) : résultats intermédiaires de replie_gauche
(link "cumule_gauche1" 'scanl1)          ; cumule_gauche1(f, l) : résultats intermédiaires de replie_gauche1
(link "cumule_droite" 'scanr)            ; cumule_droite(f, départ, l) : résultats intermédiaires de replie_droite
(link "cumule_droite1" 'scanr1)          ; cumule_droite1(f, l) : résultats intermédiaires de replie_droite1
(link "réplique" 'replicate)             ; réplique(n, x) : liste de n fois x
(link "répète" 'loopcount)               ; répète(n, expression) : évalue l'expression n fois
(link "répète_sans_fin" 'repeat)         ; répète_sans_fin(x) : suite infinie de x
(link "cycle_sans_fin" 'cycle)           ; cycle_sans_fin(l) : répète la liste sans fin

;------------------------------------------------------------------
; lispe.cxx — conversions, évaluation, divers
;------------------------------------------------------------------
(link "en_nombre" 'number)               ; en_nombre(x) : convertit en nombre réel
(link "en_court" 'short)                 ; en_court(x) : convertit en entier court
(link "complexe" 'complex)               ; complexe(re, im) : nombre complexe
(link "partie_réelle" 'real)             ; partie_réelle(z) : partie réelle d'un complexe
(link "partie_imaginaire" 'imaginary)    ; partie_imaginaire(z) : partie imaginaire d'un complexe
(link "octets" 'bytes)                   ; octets(s) : les octets d'une chaîne
(link "atomes" 'atoms)                   ; atomes() : la liste des atomes connus
(link "évalue" 'eval)                    ; évalue(code) : évalue du code LispE
(link "évalue_js" 'evaljs)               ; évalue_js(code) : évalue du code JavaScript
(link "a_durée" 'elapse)                   ; a_durée(expression) : temps d'évaluation en millisecondes
(link "mise_en_forme" 'prettify)         ; mise_en_forme(code) : code LispE indenté
(link "affiche_erreur" 'printerrln)      ; affiche_erreur(a, ...) : écrit sur la sortie d'erreur
(link "constante" 'setconst)             ; constante(nom, valeur) : définit une constante
(link "charge" 'load)                    ; charge(fichier) : charge un fichier LispE
(link "lie" 'link)                       ; lie(nom, atome) : donne un autre nom à un atome
(link "matrice_entiers" 'matrix_integer)   ; matrice_entiers(l, c, valeur) : matrice d'entiers
(link "matrice_réels" 'matrix_float)       ; matrice_réels(l, c, valeur) : matrice de réels (simple précision)
(link "matrice_nombres" 'matrix_number)    ; matrice_nombres(l, c, valeur) : matrice de nombres
(link "matrice_chaînes" 'matrix_string)    ; matrice_chaînes(l, c, valeur) : matrice de chaînes
(link "tenseur_entiers" 'tensor_integer)   ; tenseur_entiers(d1, d2, ..., valeur) : tenseur d'entiers
(link "tenseur_réels" 'tensor_float)       ; tenseur_réels(d1, d2, ..., valeur) : tenseur de réels (simple précision)
(link "tenseur_nombres" 'tensor_number)    ; tenseur_nombres(d1, d2, ..., valeur) : tenseur de nombres
(link "tenseur_chaînes" 'tensor_string)    ; tenseur_chaînes(d1, d2, ..., valeur) : tenseur de chaînes
(link "résous" 'solve)                   ; résous(matrice, vecteur) : résout un système linéaire

;------------------------------------------------------------------
; lispe.cxx — fichiers (dans le navigateur : système de fichiers en mémoire)
;------------------------------------------------------------------
(link "ouvre_fichier" 'fopen)            ; ouvre_fichier(chemin, mode) : ouvre un fichier
(link "ferme_fichier" 'fclose)           ; ferme_fichier(f) : ferme un fichier
(link "ajoute_fichier" 'fappend)         ; ajoute_fichier(chemin, texte) : ajoute à la fin d'un fichier
(link "taille_fichier" 'fsize)           ; taille_fichier(f) : taille d'un fichier

;------------------------------------------------------------------
; strings.cxx — chaînes de caractères
;------------------------------------------------------------------
(link "nettoie_gauche" 'trimleft)        ; nettoie_gauche(s) : retire les espaces au début
(link "nettoie_droite" 'trimright)       ; nettoie_droite(s) : retire les espaces à la fin
(link "formate" 'format)                 ; formate("%1 et %2", a, b) : remplace %1, %2... par les valeurs
(link "extrait_gauche" 'left)            ; extrait_gauche(s, n) : les n premiers caractères
(link "extrait_droite" 'right)           ; extrait_droite(s, n) : les n derniers caractères
(link "extrait_milieu" 'middle)          ; extrait_milieu(s, début, n) : n caractères à partir de début
(link "ngrammes" 'ngrams)                ; ngrammes(s, n) : les suites de n caractères
(link "convertit_base" 'convert_in_base) ; convertit_base(n, base) : écrit n dans une autre base
(link "code_caractère" 'ord)             ; code_caractère(s) : codes Unicode des caractères
(link "caractère" 'chr)                  ; caractère(n) : le caractère de code Unicode n
(link "complète" 'padding)               ; complète(s, c, n) : complète s avec c jusqu'à n caractères
(link "remplit" 'fill)                   ; remplit(c, n) : chaîne de n fois c
(link "distance_édition" 'editdistance)  ; distance_édition(a, b) : nombre de modifications pour passer de a à b
(link "désaccentue" 'deaccentuate)       ; desaccentue(s) : retire les accents
(link "commence_par" 'startwith)         ; commence_par(s, début) : Vrai si s commence par début
(link "finit_par" 'endwith)              ; finit_par(s, fin) : Vrai si s finit par fin
(link "en_base64" 'btoa)                 ; en_base64(s) : encode en base64
(link "de_base64" 'atob)                 ; de_base64(s) : décode le base64
(link "est_minuscule" 'lowerp)           ; est_minuscule(s) : Vrai si s est en minuscules
(link "est_majuscule" 'upperp)           ; est_majuscule(s) : Vrai si s est en majuscules
(link "est_lettre" 'alphap)              ; est_lettre(s) : Vrai si s ne contient que des lettres
(link "est_chiffre" 'digitp)             ; est_chiffre(s) : Vrai si s ne contient que des chiffres
(link "est_emoji" 'emojip)               ; est_emoji(s) : Vrai si s est un emoji
(link "est_ponctuation" 'punctuationp)   ; est_ponctuation(s) : Vrai si s est un signe de ponctuation
(link "est_voyelle" 'vowelp)             ; est_voyelle(s) : Vrai si s ne contient que des voyelles
(link "est_consonne" 'consonantp)        ; est_consonne(s) : Vrai si s ne contient que des consonnes
(link "indente" 'indent)                 ; indente(code) : indente du code LispE
(link "segmente" 'segment)               ; segmente(s) : découpe en mots et ponctuations
(link "en_json" 'json)                   ; en_json(x) : texte JSON d'une valeur
(link "analyse_json" 'json_parse)        ; analyse_json(s) : valeur décrite par un texte JSON
(link "lit_json" 'json_read)             ; lit_json(chemin) : lit un fichier JSON
(link "écrit_json" 'json_write)          ; écrit_json(x, chemin) : écrit un fichier JSON

;------------------------------------------------------------------
; maths.cxx — mathématiques (angles en radians, sauf sinus/cosinus de la bibliothèque)
;------------------------------------------------------------------
(link "racine_cubique" 'cbrt)            ; racine_cubique(x) : racine cubique
(link "arccos" 'acos)                    ; arccos(x) : arc cosinus (radians)
(link "arcsin" 'asin)                    ; arcsin(x) : arc sinus (radians)
(link "arctan" 'atan)                    ; arctan(x) : arc tangente (radians)
(link "argch" 'acosh)                    ; argch(x) : argument cosinus hyperbolique
(link "argsh" 'asinh)                    ; argsh(x) : argument sinus hyperbolique
(link "argth" 'atanh)                    ; argth(x) : argument tangente hyperbolique
(link "ch" 'cosh)                        ; ch(x) : cosinus hyperbolique
(link "sh" 'sinh)                        ; sh(x) : sinus hyperbolique
(link "th" 'tanh)                        ; th(x) : tangente hyperbolique
(link "fonction_erreur" 'erf)            ; fonction_erreur(x) : fonction d'erreur de Gauss
(link "ln" 'log)                         ; ln(x) : logarithme népérien
(link "plancher" 'floor)                 ; plancher(x) : partie entière inférieure
(link "tronque" 'trunc)                  ; tronque(x) : partie entière (sans arrondir)
(link "pgcd" 'gcd)                       ; pgcd(a, b) : plus grand commun diviseur
(link "gamma" 'tgamma)                   ; gamma(x) : fonction gamma
(link "en_radians" 'radian)              ; en_radians(degrés) : convertit des degrés en radians
(link "en_degrés" 'degree)               ; en_degrés(radians) : convertit des radians en degrés
(link "similarité_cosinus" 'cosine)      ; similarité_cosinus(v1, v2) : similarité cosinus de deux vecteurs

;------------------------------------------------------------------
; randoms.cxx — hasard et lois de probabilité
;------------------------------------------------------------------
(link "au_hasard" 'random)               ; au_hasard(n) : nombre réel au hasard entre 0 et n
(link "mélange" 'shuffle)                ; mélange(l) : la liste dans un ordre au hasard
(link "identifiant_unique" 'uuid)        ; identifiant_unique() : identifiant unique (UUID)
(link "choix_aléatoire" 'random_choice)  ; choix_aléatoire(n, l, graine) : n éléments de l au hasard
(link "graine_aléatoire" 'random_seed)   ; graine_aléatoire(n) : fixe la graine du hasard
(link "loi_uniforme" 'uniform_distribution)                  ; loi_uniforme(n, a, b) : tirages selon la loi uniforme
(link "loi_bernoulli" 'bernoulli_distribution)               ; loi_bernoulli(n, p) : tirages selon la loi de Bernoulli
(link "loi_binomiale" 'binomial_distribution)                ; loi_binomiale(n, t, p) : tirages selon la loi binomiale
(link "loi_binomiale_négative" 'negative_binomial_distribution) ; loi_binomiale_négative(n, k, p)
(link "loi_géométrique" 'geometric_distribution)             ; loi_géométrique(n, p) : tirages selon la loi géométrique
(link "loi_poisson" 'poisson_distribution)                   ; loi_poisson(n, moyenne) : tirages selon la loi de Poisson
(link "loi_exponentielle" 'exponential_distribution)         ; loi_exponentielle(n, lambda) : tirages selon la loi exponentielle
(link "loi_gamma" 'gamma_distribution)                       ; loi_gamma(n, alpha, beta) : tirages selon la loi gamma
(link "loi_weibull" 'weibull_distribution)                   ; loi_weibull(n, a, b) : tirages selon la loi de Weibull
(link "loi_valeurs_extrêmes" 'extreme_value_distribution)    ; loi_valeurs_extrêmes(n, a, b) : loi des valeurs extrêmes
(link "loi_normale" 'normal_distribution)                    ; loi_normale(n, moyenne, écart_type) : tirages selon la loi normale
(link "loi_log_normale" 'lognormal_distribution)             ; loi_log_normale(n, m, s) : tirages selon la loi log-normale
(link "loi_khi_deux" 'chi_squared_distribution)              ; loi_khi_deux(n, k) : tirages selon la loi du khi deux
(link "loi_cauchy" 'cauchy_distribution)                     ; loi_cauchy(n, a, b) : tirages selon la loi de Cauchy
(link "loi_fisher" 'fisher_distribution)                     ; loi_fisher(n, m, k) : tirages selon la loi de Fisher
(link "loi_student" 'student_distribution)                   ; loi_student(n, k) : tirages selon la loi de Student
(link "loi_discrète" 'discrete_distribution)                 ; loi_discrète(n, poids) : tirages selon des poids donnés
(link "loi_constante_par_morceaux" 'piecewise_constant_distribution) ; loi_constante_par_morceaux(n, bornes, poids)
(link "loi_linéaire_par_morceaux" 'piecewise_linear_distribution)    ; loi_linéaire_par_morceaux(n, bornes, poids)
