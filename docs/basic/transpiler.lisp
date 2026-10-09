;Date: 25/07/2022
;Author: Claude Roux
;Description: Transpileur du pseudo-Python francisé (Pythonerie) vers LispE
;Dérivé du transpileur BasAIc de TamedAgents

; shapes records the dimensions of a given variables

(defpat parsing( ['lispexp lispe_code])
   (car . to_list lispe_code)
)

(defpat parsing( ['importing path $ as_value])
   (list 'import (string . parsing path) (parsing as_value))
)

; Correspondance entre les mots-clefs français et les instructions LispE
(setq mots_retour {"retourne":'return "renvoie":'return "sortir":'break "continuer":'continue "lever":'throw})

(defpat parsing( ['returning x $ v])
   (setq x (if (in_it mots_retour x) (@ mots_retour x) (atom x)))
   (if v
      (list x (parsing v))
      (list x))
)

(defpat parsing ( ['tojoin sep cnt])
   (list 'join (parsing cnt) (parsing sep))
)

(defpat parsing ( ['alapython sep nm $ args])
   (setq r    
      (if args
         (nconcn (list (atom nm)) (mapcar 'parsing args))
         (list (atom nm))))
   (push r (parsing sep))
   r
)

(defpat parsing ( ['walrus nm $ d] )
   (list 'setqv (atom nm) (parsing d)))

(defpat parsing ( ['assignmenttopself $ d] )
   (setq letype (cadar d))
   (setq op (atom (join (cdr (@ d 1)))))
   (setq value (@ d 2))
   (if (consp letype)
      (nconcn (list op) (atom (@ letype 1)) (parsing (@ letype 2)) (parsing value))
      (list op (atom letype) (parsing value))))

(setq ops_affectation {"+=":'_plus "-=":'_moins "*=":'_fois "/=":'_divise})

(defpat parsing ( ['assignmentop $ d] )
   (setq letype (cadar d))
   (setq op (atom (join (cdr (@ d 1)))))
   (if (eq op '//=) (setq op '_/=))
   (if (eq op '%=) (setq op '_%=))
   (setq value (@ d 2))
   (setq k (string op))
   (setq v (parsing value))
   (cond
      ; x += 0.5 devient (_maj x (_plus x 0.5)) pour suivre les règles de Python.
      ; _maj est remplacé par setq ou setg selon la portée de la variable (voir résout_portée)
      ((and (not (consp letype)) (in_it ops_affectation k) (not (opération_sûre (atom letype) v)))
         (list '_maj (atom letype) (list (@ ops_affectation k) (atom letype) v)))
      ((consp letype)
         (nconcn (list op) (atom (@ letype 1)) (parsing (@ letype 2)) v))
      (true
         (list op (atom letype) v))))


(defpat container_assignment([ ['variable $ vari] value] asgn)
   (setq dimvar (car vari))
   (setq nm (@ dimvar 1))
   (setq indexes ())
   (setq letype nil)
   (loop i (cddr dimvar)
      (if (consp . car i)
         (setq letype (caar i))
         (setq letype 'indexes)
      )
      (nconc indexes (parsing i)))
   (if (eq letype 'indexes)
      (nconcn '(set@) (atom nm) indexes (list . parsing value))
      (nconcn '(set@@) (atom nm) indexes (list . parsing value))))

(defpat container_assignment([['multiassignment ['variables $ vari]] value] asgn)
   (list asgn (mapcar 'atom vari) (parsing value))
)

(defpat parsing ( ['parameters])
   ()
)

(defpat parsing ( ['parameters ['variables $ v]] )
   (mapcar 'atom v)
)


(defpat parsing ( ['assignmentself $ d] )
   (setq letype (cadar d))
   (setq value (cadr d))
   (if (consp letype)
      (container_assignment d 'setq) 
      (list 'setqi (atom letype) (parsing value))))

(defpat parsing ( ['assignment $ d] )
   (setq letype (cadar d))
   (setq value (cadr d))
   (if (consp letype)
      (container_assignment d 'setq) 
      (list 'setq (atom letype) (parsing value))))

(defpat parsing ( ['assignmentg $ d] )
   (setq letype (cadar d))
   (setq value (cadr d))
   (if (consp letype)
      (container_assignment d 'setg)
      (list 'setg (atom letype) (parsing value))))

; Indexes  10, 20, 30
(defpat parsing( ['interval "[" ":" "]"])
   '(0))

(defpat parsing( ['interval "[" n ":" "]"])
   (list (parsing n)))

(defpat parsing( ['interval "[" ":" n "]"])
   (list 0 (parsing n)))

(defpat parsing( ['interval "[" d1 ":" d2 "]"])
   (list (parsing d1) (parsing d2)))

(defpat parsing (['indexes $ d] )
   (mapcar 'parsing d)
)

(defpat parsing (['valuelist $ d] )
   (nconcn '(list) (mapcar 'parsing d))
)
(defpat parsing (['valuedictionary $ d] )
   (setq args '(dictionary))
   (loop a d
      (push args (parsing (@ a 1)) (parsing (@ a 2))))
   args
)

(defpat get_action(l)
   (setq d {"interval":'extract "indexes":'at})
   (if (atomp . car l)
      (@ d (car l))
      (@ d (caar l))))

(defpat container_at( ['dimvariable varname $ lst])
   (setq r ())
   (setq last nil)
   (loop l lst
      (setq idx (parsing l))
      (setq action (get_action l))
      (ncheck (not r)
         (setq r (nconcn (list action (atom varname)) idx))
         (if (and (= action 'at) (= action (car r)))
            (nconc r idx)
            (setq r (nconcn (list action r) idx))))
   )
   r
)

; un attribut d'objet : soi.valeur
(defpat parsing ( ['selfvariable d] )
   (if (consp d)
      (container_at d)
      (atom d)))

; a simple variable
(defpat parsing ( ['variable d] )
   (if (consp d)
      (container_at d)
      (atom d)))


(defpat parsing ( ['powerforminus v $ exp])
   (if exp
      (if (eq (size exp) 1)
         (list '** (parsing v) (parsing exp))      
         (list '** (parsing v) (parsing (cons 'powerforminus exp))))
      (parsing v)))

(defpat parsing ( ['minus v])
   (setq r (parsing v))
   (if (numberp r)
      (sign r)
      (list 'sign r))
)

; a numerical value: an integer stays an integer (7), a float stays a float (7.0)
(defpat parsing ( ['anumber d] )
   (if (numberp d) d (number d))
)

(defpat parsing ( ['f_ $ d] )
   (list 'f_ (parsing d))
)

; a, b = b, a + b
(defpat parsing ( ['tupleassign premier ['variables $ autres] $ valeurs] )
   (list 'setq
      (cons (atom premier) (mapcar 'atom autres))
      (if (eq (size valeurs) 1)
         (parsing (car valeurs))
         (cons 'list (maplist 'parsing valeurs false)))))

; a string value: "value"
(defpat parsing ( ['string d] )
    d
)

; a string value: "value"
(defpat parsing ( ['longstring d] )
   (aslongstring d)
)

; the comparison operator
; It can be made out of two pieces: == or <> or <= or >=
(defpat parsing ( ['comparator $ d] )
   (setq a (join (maplist 'parsing d false) ""))
   (switch a
      ("<>" '!=)
      ("==" '=)
      ("dans" 'in)
      ("nondans" 'notin)
      ("est" 'eq)
      (true (atom a))
   )
)


(defpat parsing ( ['catching kw "(" nm ")" $ inst])
   (setq v (list 'lambda (list (atom nm)) (list 'setq (atom nm) (list '_message_erreur (atom nm)))))
   (loop c inst
      (push v (parsing c)))
   (list v)
)

(defpat parsing ( ['catching kw $ inst])
   (setq v (list 'lambda (list 'e_)))
   (loop c inst
      (push v (parsing c)))
  (list v)
)

(defpat parsing(['amaybe $ ct])
   (nconcn '(maybe) (mapcar 'parsing (extract ct 0 -1)) (parsing (last@ ct)))
)

; Indexes  10, 20, 30
(defpat parsing( ['callinterval "[" ":" "]"])
   '(extract 0))

(defpat parsing( ['callinterval "[" n ":" "]"])
   (list 'extract (parsing n)))

(defpat parsing( ['callinterval "[" ":" n "]"])
   (list 'extract 0 (parsing n)))

(defpat parsing( ['callinterval "[" d1 ":" d2 "]"])
   (list 'extract (parsing d1) (parsing d2)))

(defpat parsing( ['callindexes $ args])
   (if args
      (nconcn (list 'at) (mapcar 'parsing args))
      (list 'at))
)

(defpat parsing( ['callmethod nm $ args])
   (if args
      (nconcn (list (atom nm)) (mapcar 'parsing args))
      (list (atom nm)))
)

; a method implementation: toto.method(...)
(defpat parsing ( ['method n $ mts] )
   (setq v (parsing n))
   (setq calls (mapcar 'parsing mts))
   (loop a calls
      (ife (eq (size a) 1)
         (if (not . consp v)
            (setq v (nconcn a (list v)))
            (setq v (nconcn a '. v)))
         (ife (and (consp v)  (eq (car a) (car v)) (eq (car a) 'at))
            (nconc v (cdr a))
            (insert a v 1)
            (setq v a))))
   v
)

; a function call: call(x,...)
(defpat parsing ( ['call n "(" ")" $ mts] )
   (if (consp n)
      (setq v (list (parsing n)))
      (setq v (list (atom n)))
   )
   (setq calls (mapcar 'parsing mts))
   (loop a calls
      (ife (eq (size a) 1)
         (if (not . consp v)
            (setq v (nconcn a (list v)))
            (setq v (nconcn a '. v)))
         (ife (and (consp v)  (eq (car a) (car v)) (eq (car a) 'at))
            (nconc v (cdr a))
            (insert a v 1)
            (setq v a))))
   v
)

(defpat parsing ( ['call n "(" arguments ")" $ mts] )
   (if (consp n)
      (setq v (cons (parsing n) (maplist 'parsing (cdr arguments) false)))
      (setq v (consb (atom n) (maplist 'parsing (cdr arguments) false)))
   )
   (setq calls (mapcar 'parsing mts))
   (loop a calls
      (ife (eq (size a) 1)
         (if (not . consp v)
            (setq v (nconcn a (list v)))
            (setq v (nconcn a '. v)))
         (ife (and (consp v)  (eq (car a) (car v)) (eq (car a) 'at))
            (nconc v (cdr a))
            (insert a v 1)
            (setq v a))))
   v
)


(defpat parsing ( ['acase chk exp])
   (list (parsing chk) (parsing exp))
)

(defpat parsing ( ['switch vari $ cs])
   (nconcn '(switch) (parsing vari) (mapcar 'parsing cs))
)

; a function definition
(defpat parsing ( ['classedef nm $ code] )
   (setq code (maplist 'parsing code false))   
   (setq fnd false)
   (setq methods ())
   (loop c code
      (if (eq (@ c 1) '__init__)
         (setq fnd (@ c 2))
         (push methods (list 'defpat (atom (@@ (string . @ c 1) 0 -1)) (cons (list (atom (+ nm "_")) 'r) (@ c 2)) (list 'r (cons (@ c 1) (@ c 2)))))))
   (ncheck fnd
      (setq r (nconcn (list 'class@ (atom (+ nm "_")) '()) code))
      (setq r (nconcn (list 'class@ (atom (+ nm "_")) '(init)) code))
      (setq initclass (list 'defun (atom nm) fnd (list (atom (+ nm "_")) (cons '__init__ fnd))))
      (setq r (list r initclass)))
   (nconcn r methods)
)

; a function definition
; Les paramètres d'une méthode : (soi, x, y) -> (x y)
(defpat parsing ( ['methparams] )
   ()
)

(defpat parsing ( ['methparams ['variables $ v]] )
   (mapcar 'atom v)
)

(defpat parsing ( ['classfunc nm parameters $ code] )
   (setq code (maplist 'parsing code false))   
   (if (neq nm "__init__")
      (+= nm "_"))
   (setq paramètres (parsing parameters))
   (nconcn (list 'defun (atom nm) paramètres) (corps_fonction paramètres code))
)


; Portée des variables, comme en Python : dans une fonction, une variable est locale
; si c'est un paramètre ou si elle reçoit une valeur (x = ...) dans la fonction.
; Pour modifier une variable du programme, on écrit x =: valeur (setg).
(defun collecte_locaux (code locaux)
   (check (consp code)
      (if (and (in '(setq loop) (car code)) (atomp (cadr code)))
         (push locaux (cadr code)))
      (loop e code
         (if (consp e)
            (collecte_locaux e locaux)))))

; (_maj x valeur), produit par x += valeur, devient (setq x valeur) pour une variable
; locale ou au niveau principal, et (setg x valeur) dans une fonction qui n'a pas
; de variable locale x : on modifie alors la variable du programme.
(defun résout_portée (code dans_fonction locaux)
   (ncheck (consp code)
      code
      (setq tête (car code))
      (ife (eq tête '_maj)
         (block
            (setq x (cadr code))
            (list
               (if (and dans_fonction (not (in locaux x))) 'setg 'setq)
               x
               (résout_portée (caddr code) dans_fonction locaux)))
         (setq r ())
         (loop e code
            ; attention : on ne renvoie jamais un atome comme 'return depuis une fonction,
            ; LispE l'interpréterait comme une instruction
            (ife (consp e)
               (push r (résout_portée e dans_fonction locaux))
               (push r e)))
         r)))

(defun corps_fonction (paramètres code)
   (setq locaux ())
   (loop p paramètres (push locaux p))
   (collecte_locaux code locaux)
   (résout_portée code true locaux))

; a function definition
(defpat parsing ( ['function nm parameters $ code] )
   (setq code (maplist 'parsing code false))   
   (setq paramètres (parsing parameters))
   (nconcn (list 'defun (atom nm) paramètres) (corps_fonction paramètres code))
)

; lambda sans paramètre : [lambda() 7]
(defpat parsing (['lambda code] )
   (list 'lambda () (parsing code))
)

; lambda
(defpat parsing (['lambda parameters code] )
   (setq code (maplist 'parsing (list code) false))   
   (nconcn (list 'lambda (mapcar 'atom (cdr parameters))) code)
)

(defpat parsing(['tail p])
   (list '$ (parsing p))
)

(defpat parsing (['patterndictionary $ d] )
   (setq args ())
   (push args '{)
   (loop a d
      (if (eq (car a) 'tail)
         (nconc args '$ (parsing (@ a 1)))
         (push args (parsing (@ a 1)) ': (parsing (@ a 2)))))
   (push args '})
   args
)

(defpat parsing(['patternlist $ pats])
   (setq pr ())
   (loop p pats
      (setq v (parsing p))
      (if (and (consp v) (eq (car v) '$))
         (nconc pr v)
         (push pr v)
      )
   )
   pr
)

(defpat parsing ( ['patterns $ pats])
   (setq pr ())
   (loop p pats
      (setq v (parsing p))
      (if (and (consp v) (eq (car v) '{))
         (nconc pr v)
         (push pr v)
      )
   )
   pr
)



; a function definition
(defpat parsing ( ['patternrule  nm parameters  $ code] )
   (setq code (maplist 'parsing code false))   
   (nconcn (list 'defpat (atom nm) (parsing parameters)) code)
)


; a function definition
(defpat parsing ( ['prologrule  nm parameters  $ code] )
   (setq code (maplist 'parsing code false))   
   (nconcn (list 'defprol (atom nm) (parsing parameters)) code)
)


; a function definition
(defpat parsing ( ['rule  nm parameters  $ code] )
   (setq code (maplist 'parsing code false))   
   (nconcn (list 'defpred (atom nm) (parsing parameters)) code)
)



(defpat parsing (['comprehension $ d])
   (setq vari (atom (@ d 1)))
   (ife (= (size d) 3)
      (nconcn (list 'mapcar (list 'lambda (list vari) (parsing (@ d 0))) (parsing (@ d 2))))
      (nconcn 
         (list 'mapcar 
            (list 'lambda (list vari) (parsing (@ d 0))) 
            (list 'filtercar (list 'lambda (list vari) (parsing (@ d 3))) (parsing (@ d 2))))))
)

; forin: For A in range(1,10,1)... EndFor
(defpat parsing ( ['forin init rg $ code] )
   (setq code (maplist 'parsing code))
   (nconcn (list 'loop (parsing init) (parsing rg)) code)
)

;for: For A = 0, A < 10 , A = A + 1... EndFor
(defpat parsing ( ['for init test inc $ code] )
   (setq code (maplist 'parsing code))
   (list 
      'block
      (parsing init)
      (nconc
         (list 
            'while
            (parsing test)
         )
         code
         (list (parsing inc))
      )
   )
)
; While x < 10 ... EndWhile
(defpat parsing ( ['while test $ code] )
   (setq code (maplist 'parsing code))
   (nconc
      (list 
         'while
         (parsing test)
      )
      code
   )
)

; Then...
(defpat parsing ( ['then $ code])
   (if (eq 1 (size code))
      (parsing code)
      (consb 'block (maplist 'parsing code false))
   )
)

; Else...
(defpat parsing ( ['else $ code])
   (if (eq 1 (size code))
      (parsing code)
      (consb 'block (maplist 'parsing code false))
   )
)

(defpat parsing ( ['elif test then $ else] )
   (setq test (parsing test))
   (setq then (parsing then))
   (ife else
      (block
         (setq else (parsing (car else)))
         (if
            (and
               (consp else)
               (eq (car else) 'block)
            )
            (nconcn (list 'ife test then) (cdr else))
            (list 'if test then else)
         )
      )
      (if
         (and
            (consp then)
            (eq (car then) 'block)
         )
         (nconcn (list 'check test) (cdr then))
         (list 'if test then)
      )
   )
)

; if A < 10 Then ... Else ... EndIf
(defpat parsing ( ['if test then $ else] )
   (setq test (parsing test))
   (setq then (parsing then))
   (ife else
      (block
         (setq else (parsing (car else)))
         (if
            (and
               (consp else)
               (eq (car else) 'block)
            )
            (nconcn (list 'ife test then) (cdr else))
            (list 'if test then else)
         )
      )
      (if
         (and
            (consp then)
            (eq (car then) 'block)
         )
         (nconcn (list 'check test) (cdr then))
         (list 'if test then)
      )
   )
)

; Priorités alignées sur Python (plus grand = plus prioritaire).
; A compléter pour ^ et ^^ selon leur sens dans LispE.
(setq op_prec {"or":1 "xor":2 "and":3 "orvalue":1 "andvalue":3 "|":1 "^":2 "&":3 "<<":4 ">>":4 "+":5 "-":5 "*":6 "/":6 "//":6 "%":6 "^^":8 "**":8})

(defun op_priority(o)
   (setq k (string o))
   (if (in_it op_prec k) (@ op_prec k) 6))

; Dépile un opérateur et ses deux opérandes, empile le résultat.
; On aplatit (- (- a b) c) en (- a b c), sauf pour ** (associatif à droite).
; En LispE, le type du premier argument l'emporte : (+ 1 0.5) vaut 1 et (< 1 1.5) est faux.
; Pour retrouver le comportement de Python, on remplace ces opérateurs par des fonctions
; de la bibliothèque (_plus, _inf...), sauf quand les valeurs littérales garantissent le résultat.
(setq ops_python {"+":'_plus "-":'_moins "*":'_fois "/":'_divise "<":'_inf "<=":'_infeg ">":'_sup ">=":'_supeg "=":'_égal "!=":'_diff})

; Un nombre entier écrit dans le programme (3, 10...)
(defun entier_littéral (x)
   (and (numberp x) (= x (float (integer x)))))

; Une expression dont on sait qu'elle produit une chaîne : "..." ou (string ...) ou (+ "..." ...)
(defun chaîne_certaine (x)
   (or
      (stringp x)
      (and (consp x) (in '("string" "_texte") (string (car x))))
      (and (consp x) (eq (car x) '+) (chaîne_certaine (cadr x)))))

; L'opération native donne le même résultat qu'en Python
(defun opération_sûre (a b)
   (or
      (entier_littéral b)
      (and (numberp a) (not (entier_littéral a)))
      (chaîne_certaine a)
      (chaîne_certaine b)))

; Construit l'opération (o a b) en tenant compte des règles de Python
(defun opération_python (o a b)
   (setq k (string o))
   (if (and (in_it ops_python k) (not (opération_sûre a b)))
      (list (@ ops_python k) a b)
      (list o a b)))

(defun reduce_op(vals ops)
   (setq o (last@ ops))
   (pop ops)
   (setq b (last@ vals))
   (pop vals)
   (setq a (last@ vals))
   (pop vals)
   (if (and (consp a) (eq (car a) o) (neq o '**) (opération_sûre a b))
      (block (push a b) (push vals a))
      (push vals (opération_python o a b))))

; calculus expression: A + 10 - 30
(defpat parsing ( ['computing $ reste] )
   (setq ope (maplist 'parsing (filterlist (\(x) (eq (car x) 'operator)) reste) false))
   (setq args (maplist 'parsing (filterlist (\(x) (neq (car x) 'operator)) reste) false))
   ; on normalise TOUS les opérateurs : ("*" "*") devient l'atome **
   (setq ope (maplist (\(o) (if (consp o) (atom (join o "")) (atom o))) ope))
   (ncheck ope
      (car args)
      (setq vals (list (car args)))
      (setq ops ())
      (setq args (cdr args))
      (loop o ope
         (setq p (op_priority o))
         (if (eq o '//) (setq o '_/))
         (if (eq o (atom "%")) (setq o '_%))
         (while (and ops
                     (or (> (op_priority (last@ ops)) p)
                         (and (= (op_priority (last@ ops)) p) (neq o '**))))
            (reduce_op vals ops))
         (push ops o)
         (push vals (car args))
         (setq args (cdr args)))
      (while ops (reduce_op vals ops))
      (car vals)))

(defpat parsing ( ['onecomparison "non" a1 ['comparator $ op] a2])
   (setq op (parsing (nconcn '(comparator) op)))
   (list 'not (opération_python op (parsing a1) (parsing a2)))
)

(defpat parsing ( ['onecomparison a1 ['comparator $ op] a2])
   (setq op (parsing (nconcn '(comparator) op)))
   (opération_python op (parsing a1) (parsing a2))
)

; a comparison: A < 10 or B > 10 and C <> 8
(defpat parsing ( ['comppar ['negation "non"] comparing] )
   (list 'not (parsing comparing))
)

(defpat parsing ( ['comppar comparing] )
   (parsing comparing)
)

; a comparison: A < 10 or B > 10 and C <> 8
; Tête d'un nœud comparing : (comparaison-analysée reste-de-la-chaîne)
(defpat cmp_split ( ['comparing "non" a1 ['comparator $ op] a2 $ d] )
   (setq op (parsing (nconcn '(comparator) op)))
   (list
      (if (eq op 'in)
         (list 'not (list 'in_it (parsing a2) (parsing a1)))
         (if (eq op 'notin)
            (list 'in_it (parsing a2) (parsing a1))
            (list 'not (opération_python op (parsing a1) (parsing a2)))))
      d))

(defpat cmp_split ( ['comparing a1 ['comparator $ op] a2 $ d] )
   (setq op (parsing (nconcn '(comparator) op)))
   (list
      (if (eq op 'in)
         (list 'in_it (parsing a2) (parsing a1))
         (if (eq op 'notin)
            (list 'not (list 'in_it (parsing a2) (parsing a1)))
            (opération_python op (parsing a1) (parsing a2))))
      d))

(defpat cmp_split ( ['comparing "non" a $ d] )
   (list (list 'not (parsing a)) d))

(defpat cmp_split ( ['comparing a $ d] )
   (list (parsing a) d))

; Aplatit la chaîne : acc = (v0 o1 v1 o2 v2 ...)
; Un nœud comparing suivant prolonge la chaîne, un comppar est un opérande.
(defun cmp_flat(node acc)
   (setq hd (cmp_split node))
   (push acc (car hd))
   (setq d (cadr hd))
   (check d
      (setq op (parsing (car d)))
      (if (eq op "ou") (setq op "orvalue"))
      (if (eq op "et") (setq op "andvalue"))
      (if (eq op "oux") (setq op "xor"))
      (push acc (atom op))
      (setq nxt (cadr d))
      (if (eq (car nxt) 'comparing)
         (cmp_flat nxt acc)
         (push acc (parsing nxt))))
   acc)

; Même algorithme à deux piles que pour l'arithmétique, tous opérateurs associatifs à gauche
(defun cmp_reduce(items)
   (setq vals (list (car items)))
   (setq ops ())
   (setq items (cdr items))
   (while items
      (setq o (car items))
      (setq p (op_priority o))
      (while (and ops (>= (op_priority (last@ ops)) p))
         (reduce_op vals ops))
      (push ops o)
      (push vals (cadr items))
      (setq items (cddr items)))
   (while ops (reduce_op vals ops))
   (car vals))

(defpat parsing ( ['comparing $ d] )
   (cmp_reduce (cmp_flat (cons 'comparing d) ())))

; print "Toto", 10, A
(defpat parsing ( ['multiop x $ arguments] )
   (consb (atom x) (maplist 'parsing arguments false))
)

; (A + 20)
(defpat parsing ( ['parenthetic $ code] )
   (parsing code)
)

; a simple atom, might be a variable
(defpat parsing ( [ [atom_ x] $ d] )
   (parsing d)
)

; argument is a list, we analyse x and d one after the other
(defpat parsing ( [ x $ d] )
   (setq n (parsing x))
   (setq nn (parsing d))
   (if (neq n ())
      (if (neq nn ())
         (cons n nn)
         n
      )
      nn
   )
)

(defpat parsing ( x )
   x
)

(defpat parsing ( () )
   ()
)

;------------------------------------------------------------------
; Noms réservés : LispE interdit de redéfinir une fonction ou une instruction.
; Si l'élève définit une fonction qui porte le nom d'une fonction de la bibliothèque
; (carré, somme...) ou d'une instruction LispE (sum, max...), on la renomme en nom_perso
; dans tout son programme. C'est l'équivalent du masquage de Python.
;------------------------------------------------------------------
(setq noms_bibliothèque ())

; Extrait les noms définis par (defun nom ...), (defpat nom ...) ou (defmacro nom ...) dans un source LispE
(defun noms_définis (source)
   (setq noms ())
   (loop ligne (split source "\n")
      (setq l (trim ligne))
      (check (or (= (@@ l 0 7) "(defun ") (= (@@ l 0 8) "(defpat ") (= (@@ l 0 10) "(defmacro "))
         (push noms (@ (split l " ") 1))))
   noms)

; Les noms des instructions de LispE : la liste (atoms) d'un interpréteur neuf,
; fournie au démarrage par charge_noms_lispe (voir js/pythonerie.js)
(setq noms_lispe {})

(defun charge_noms_lispe (texte)
   (setg noms_lispe {})
   (loop n (split texte "\n")
      (set@ noms_lispe n true)))

; Noms français des instructions (français.lisp) : instruction -> nom français.
; Sert à nommer lisiblement une variable ou une fonction de l'élève en collision :
; produit = 1 devient (setq produit_v 1) et non (setq ∏_v 1).
(setq noms_français {})

(defun charge_noms_français (texte)
   (setg noms_français {})
   (loop ligne (split texte "\n")
      (check (= (@@ ligne 0 7) "(link \"")
         (setq morceaux (split ligne "\""))
         (setq cible (trim (@@ (@ morceaux 2) "'" ")")))
         (if (not (in_it noms_français cible))
            (set@ noms_français cible (@ morceaux 1))))))

; Nom lisible d'un atome renommé : le nom français s'il existe
(defun nom_lisible (a suffixe)
   (setq s (string a))
   (+ (if (in_it noms_français s) (@ noms_français s) s) suffixe))

(defun est_instruction (a)
   (in_it noms_lispe (string a)))

(defun nom_réservé (a)
   (or (in noms_bibliothèque (string a)) (est_instruction a)))

(defun renomme_atomes (code table)
   (setq r ())
   (loop e code
      (cond
         ((consp e) (push r (renomme_atomes e table)))
         ((and (atomp e) (in_it table (string e))) (push r (atom (@ table (string e)))))
         (true (push r e))))
   r)

; Même problème pour les variables : LispE refuse (setq max 3) et un paramètre nommé
; comme une fonction (largeur, somme...). Une variable ainsi nommée devient nom_v
; partout où elle est utilisée comme valeur ; les appels de fonction ne changent pas.
(setq formes_affectation '("setq" "setg" "setqi" "setqv" "loop"))
(setq formes_fonction '("defun" "defpat" "defmacro"))
(setq formes_lambda '("lambda" "λ"))
(setq atomes_constants '("true" "false" "nil" "__root__"))

(defun variable_réservée (a table)
   (check (and (atomp a) (not (in atomes_constants (string a))) (nom_réservé a))
      (set@ table (string a) (nom_lisible a "_v"))))

; Première passe : les variables affectées ou les paramètres dont le nom est réservé
(defun collecte_variables (code table)
   (check (consp code)
      (setq tête (string (car code)))
      (cond
         ((and (in formes_affectation tête) (>= (size code) 2))
            (ife (consp (cadr code))
               (loop a (cadr code) (variable_réservée a table))
               (variable_réservée (cadr code) table)))
         ((and (in formes_fonction tête) (>= (size code) 3) (consp (caddr code)))
            (loop a (caddr code) (variable_réservée a table)))
         ((and (in formes_lambda tête) (>= (size code) 2) (consp (cadr code)))
            (loop a (cadr code) (variable_réservée a table))))
      (loop e code
         (if (consp e) (collecte_variables e table)))))

; Remplace un atome s'il fait partie de la table
(defun remplace_atome (a table)
   (if (and (atomp a) (in_it table (string a)))
      (atom (@ table (string a)))
      a))

; Seconde passe : tout sauf la position d'appel (le premier élément d'une liste)
(defun renomme_variables (code table)
   (setq r ())
   (setq tête (string (car code)))
   (setq position 0)
   (loop e code
      (cond
         ((consp e)
            (ife (or
                  (and (in formes_fonction tête) (eq position 2))
                  (and (in formes_lambda tête) (eq position 1))
                  (and (in formes_affectation tête) (eq position 1)))
               ; liste de paramètres ou affectation multiple
               (push r (maplist (λ (a) (remplace_atome a table)) e false))
               (push r (renomme_variables e table))))
         ((eq position 0) (push r e))
         ((and (in formes_fonction tête) (eq position 1)) (push r e))
         ((atomp e) (push r (remplace_atome e table)))
         (true (push r e)))
      (+= position 1))
   r)

; affiche(liste) doit montrer [1, 2] et Vrai, comme Python, et non (1 2) et true
(defun habille_affichage (code)
   (setq r ())
   (setq tête (if (atomp (car code)) (string (car code)) ""))
   (setq position 0)
   (loop e code
      (cond
         ((consp e) (setq e (habille_affichage e))))
      (if (and (> position 0) (in '("println" "print") tête) (not (chaîne_certaine e)) (not (numberp e)))
         (push r (list '_texte e))
         (push r e))
      (+= position 1))
   r)

; Les renommages faits lors d'une compilation sont mémorisés : la ligne de commande
; de la console (compileconsole) doit retrouver somme_v si le programme a défini somme.
; compilepython repart d'une mémoire vide.
(setq mémoire_fonctions {})
(setq mémoire_variables {})

(defun renomme_réservés (code)
   (setq table (clone mémoire_fonctions))
   (loop c code
      (check (and (consp c) (in '("defun" "defpat" "defmacro") (string (car c))) (atomp (cadr c)))
         (setq n (string (cadr c)))
         (if (nom_réservé (cadr c))
            (set@ table n (nom_lisible (cadr c) "_perso")))))
   (loop k table (set@ mémoire_fonctions k (@ table k)))
   (if table
      (setq code (renomme_atomes code table)))
   (setq table (clone mémoire_variables))
   (collecte_variables code table)
   (loop k table (set@ mémoire_variables k (@ table k)))
   ; (code n'est pas un programme quand transpile a produit un message d'erreur)
   (if (and table (eq (car code) '__root__))
      (setq code (cons '__root__ (maplist (λ (c) (if (consp c) (renomme_variables c table) (remplace_atome c table))) (cdr code) false))))
   code)

(defun transpile (code)
   ; Transpiling into LispE
   (setq tree (abstract_tree code))

   ; __root__ is a special function that defines the top block of a LispE program
   (setq code '(__root__))

   (ife (in (car tree) "Erreur")
      (setq code (list 'println (join tree " ")))
      (loop line (cdr tree)
         (setq c (parsing line))
         (if (consp c) (setq c (résout_portée c false ())))
         ; c peut être un simple atome (une ligne réduite à un nom) : on teste consp avant car
         (if (and (consp c) (consp (car c)) (eq (caar c) 'class@))
            (nconc code c)
	      (push code c))
      )
   )
   (renomme_réservés (habille_affichage code))
)

(defun compile(code)
   (setg pythonmode false)
   (setq lsp (transpile code))
   (ncheck (= (@ lsp 0) '__root__)
      (+ (replace (@ lsp 1) "> > >" ":\n>> ") " <<")
      (setq r (@@ (trim . prettify (cdr lsp) 100) 1 -1))
      (if (= (@ r 0) "\n")
         (désindente r)
         r)))

; ------------------------------------------------------------------------
; Partie Python : l'indentation est transformée en balises de fin (finsi, finpour...)
; ------------------------------------------------------------------------

; Indentation d'une ligne (déjà nettoyée à droite)
(defun espace(x) (- (size x) (size (trim x))))

; Mots-clefs qui ouvrent un bloc (la ligne doit se terminer par ":")
(setq mots_blocs '("si" "sinon" "sinonsi" "pour" "tantque" "fonction" "def" "classe" "essaie" "sauf" "attrape" "selon" "règle" "motif" "prolog"))
; Mots-clefs qui prolongent le bloc précédent (même indentation que le "si" ou le "essaie")
(setq mots_suite '("sinon" "sinonsi" "sauf" "attrape"))

; Le premier mot d'une ligne : "si", "pour", "def"...
(defun premier_mot(clr)
   (setq mot "")
   (loop c clr
      (if (in " \t(:[{=.,+-*/" c)
         (break))
      (+= mot c))
   (lower mot))

; Analyse une ligne : retire le commentaire final (#...) en dehors des chaînes
; et calcule la variation du nombre de parenthèses/crochets/accolades ouverts.
; Renvoie (texte variation)
(defun analyse_ligne(ligne)
   (setq texte "")
   (setq variation 0)
   (setq guillemet "")
   (setq échap false)
   (loop c ligne
      (ncheck guillemet
         (block
            (if (= c "#") (break))
            (cond
               ((in "([{" c) (+= variation 1))
               ((in ")]}" c) (-= variation 1))
               ; attention : c est réutilisé par loop, on en fait une copie
               ((in "\"'`" c) (setq guillemet (+ "" c)))))
         (cond
            (échap (setq échap false))
            ((= c "\\") (setq échap true))
            ((= c guillemet) (setq guillemet ""))))
      (+= texte c))
   (list texte variation))

; Ferme le dernier bloc ouvert : on ajoute "fin" + le mot-clef du bloc
(defun ferme_bloc(résultat pile)
   (setq bloc (last@ pile))
   (pop pile)
   (push résultat (+ (fill " " (car bloc)) "fin" (cadr bloc))))

; On transforme l'indentation en balises de fin explicites :
;   si x > 0:            si x > 0
;       affiche(x)   ->      affiche(x)
;   affiche("fin")       finsi
;                        affiche("fin")
(setq erreur_injection "")

; Les chaînes longues ("""...""" ou '''...''') sont mises de côté avant l'analyse des
; lignes, sous la forme d'un repère KX§0§, KX§1§... : leurs lignes (vides, décalées,
; terminées par « : ») ne doivent pas être prises pour du code. On les repère directement
; dans le texte : la chaîne commence au premier délimiteur rencontré et finit au même
; délimiteur. Renvoie (code-avec-repères table), la table associant chaque repère à sa chaîne.
(defun protège_chaînes_longues(code)
   (setq table {})
   (setq morceaux ())
   (setq position 0)
   (setq i 0)
   (setq encore true)
   (while encore
      (setq a (find code `"""` position))
      (setq b (find code "'''" position))
      (setq début (cond ((nullp a) b) ((nullp b) a) ((< a b) a) (true b)))
      (setq fin (if (nullp début) nil (find code (@@ code début (+ début 3)) (+ début 3))))
      (ife (nullp fin)
         (setq encore false)
         (block
            (setq lb (+ "KX§" i "§"))
            (push morceaux (@@ code position début))
            (push morceaux lb)
            (set@ table lb (@@ code début (+ fin 3)))
            (setq position (+ fin 3))
            (+= i 1))))
   (push morceaux (@@ code position (size code)))
   (list (join morceaux "") table))

(defun injecte_labels(code)
   (setg erreur_injection "")
   (setq dlongstrings {})
   (check (or (in code `"""`) (in code "'''"))
      (setq protégé (protège_chaînes_longues code))
      (setq code (car protégé))
      (setq dlongstrings (cadr protégé)))
   (setq code (replace (replace code "\r" "") "\t" "    "))
   (setq lignes (split code "\n"))
   (setq résultat ())
   ; pile des blocs ouverts : (indentation mot-clef numéro-de-ligne)
   (setq pile ())
   ; nombre de parenthèses encore ouvertes (expression sur plusieurs lignes)
   (setq profondeur 0)
   (setq numéro 0)
   (loop ligne lignes
      (+= numéro 1)
      (setq info (analyse_ligne ligne))
      (setq texte (trimright (car info)))
      (setq clr (trim texte))
      (ife (> profondeur 0)
         ; suite d'une expression commencée sur une ligne précédente
         (block
            (push résultat texte)
            (+= profondeur (cadr info)))
         (check (and clr (neq (upper (@@ (+ clr " ") 0 4)) "REM "))
            (setq cpt (espace texte))
            (setq mot (premier_mot clr))
            (setq suite (in mots_suite mot))
            (+= profondeur (cadr info))
            (setq ouvre (and (eq (@ clr -1) ":") (= profondeur 0)))
            ; On ferme les blocs dont l'indentation est supérieure (ou égale) à celle de la ligne
            (while (and pile
                  (if suite
                     (> (car (last@ pile)) cpt)
                     (>= (car (last@ pile)) cpt)))
               (ferme_bloc résultat pile))
            ; Les erreurs sont mémorisées dans erreur_injection (un throw est fragile dans le WebAssembly)
            (check (and suite (or (= (size pile) 0) (!= (car (last@ pile)) cpt)))
               (setg erreur_injection (+ "Erreur ligne " numéro " : \"" mot "\" n'est pas aligné avec un \"si\" ou un \"essaie\""))
               (break))
            (check (and (in mots_blocs mot) (not ouvre) (= profondeur 0))
               (setg erreur_injection (+ "Erreur ligne " numéro " : il manque \":\" à la fin de la ligne \"" clr "\""))
               (break))
            (ife ouvre
               (block
                  (push résultat (@@ texte 0 -1))
                  (if (not suite)
                     (push pile (list cpt mot numéro))))
               (push résultat texte)))))
   (while pile
      (ferme_bloc résultat pile))
   (setq result (join résultat "\n"))
   (loop a dlongstrings
      (setq result (replace result a (@ dlongstrings a))))
   result)

; f"Bonjour {nom}, dans un an tu auras {âge + 1} ans"
; devient : ("Bonjour " + _texte(nom) + ", dans un an tu auras " + _texte(âge + 1) + " ans")
; (_texte est défini dans bibliothèque.lisp : il affiche les listes comme Python)
; La réécriture se fait sur le texte, avant l'analyse, si bien que les expressions
; entre accolades suivent la syntaxe de Pythonerie.
(defun fchaîne_texte (tok)
   (setq s (@@ tok 2 -1))
   (setq morceaux ())
   (setq courant "")
   (setq expr "")
   (setq dedans false)
   (loop c s
      (cond
         ((and (not dedans) (= c "{"))
            (setq dedans true)
            (if courant (push morceaux (+ "\"" courant "\"")))
            (setq courant ""))
         ((and dedans (= c "}"))
            (setq dedans false)
            (push morceaux (+ "_texte(" expr ")"))
            (setq expr ""))
         (dedans (+= expr c))
         (true (+= courant c))))
   (if courant (push morceaux (+ "\"" courant "\"")))
   (if morceaux
      (+ "(" (join morceaux " + ") ")")
      "\"\""))

(defun remplace_fchaînes (code)
   (check (in code "f\"")
      (loop a (tokenize_rules parser_tok code)
         (if (= (@@ a 0 2) "f\"")
            (setq code (replace code a (fchaîne_texte a))))))
   code)

; We call this specific function to inject closing tags
; We then transform our Python into Lisp
; Le texte LispE d'une liste de formes
; Le code LispE mis en forme est décalé de 3 espaces (il était dans __root__) : on retire
; ce décalage ligne par ligne, mais pas à l'intérieur d'une chaîne `...` sur plusieurs lignes
; (une chaîne """...""" du programme, ou des données) : son contenu, lignes vides et
; espaces compris, doit rester intact. splite garde les lignes vides ; le "\n" final
; est nécessaire, car splite perd le dernier morceau quand la chaîne ne finit pas par "\n".
(defun désindente (r)
   (setq lignes ())
   (setq dedans false)
   (loop x (splite (+ r "\n") "\n")
      (if (and (not dedans) (>= (size x) 3) (eq (@ x 0) " ") (eq (@ x 1) " ") (eq (@ x 2) " "))
         (push lignes (@@ x 3))
         (push lignes x))
      (if (= (% (size (findall x "`")) 2) 1)
         (setq dedans (not dedans))))
   ; r commence par "\n" : la première ligne est vide
   (if (and lignes (= (car lignes) "")) (setq lignes (cdr lignes)))
   (join lignes "\n"))

(defun texte_lispe (formes)
   (setq r (@@ (trim . prettify formes 100) 1 -1))
   (if (= (@ r 0) "\n")
      (désindente r)
      r))

(defun compilepython(code)
   (setg pythonmode true)
   ; un nouveau programme : on oublie les renommages précédents
   (setg mémoire_fonctions {})
   (setg mémoire_variables {})
   (setq code (remplace_fchaînes code))
   (setq code (injecte_labels code))
   (if erreur_injection
      (return erreur_injection))
   (setq lsp (transpile code))
   (ncheck (= (@ lsp 0) '__root__)
      (+ (replace (@ lsp 1) "> > >" ":\n>> ") " <<")
      (texte_lispe (cdr lsp))))

; Ligne de commande de la console (>>>), comme l'invite de Python :
; si la dernière forme est une expression, sa valeur est affichée par _console_valeur
; (bibliothèque.lisp). Les instructions (affectation, boucle, si, définition, ajoute...)
; n'affichent rien.
(setq formes_instructions '("setq" "setg" "setqi" "setqv" "defun" "defpat" "defmacro" "class@"
      "loop" "while" "if" "ife" "check" "ncheck" "switch" "maybe" "block" "println" "print"
      "push" "pushfirst" "pushlast" "insert" "set@" "set@@" "return" "break" "continue" "throw"
      "_console_valeur"))

(defun expression_console (forme)
   (or (not (consp forme))
      (not (in formes_instructions (string (car forme))))))

(defun compileconsole(code)
   (setg pythonmode true)
   (setq code (remplace_fchaînes code))
   (setq code (injecte_labels code))
   (if erreur_injection
      (return erreur_injection))
   (setq lsp (transpile code))
   (ncheck (= (@ lsp 0) '__root__)
      (+ (replace (@ lsp 1) "> > >" ":\n>> ") " <<")
      (setq formes (cdr lsp))
      (check formes
         (setq dernière (last@ formes))
         (if (expression_console dernière)
            (set@ formes (- (size formes) 1) (list '_console_valeur dernière))))
      (texte_lispe formes)))

