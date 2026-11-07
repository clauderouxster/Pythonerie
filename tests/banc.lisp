; Banc de la non-régression, lancé par non_regression.py (à la racine du projet).
;
;   lispe banc.lisp traduis <basic/> <analyseur> <noms> <liste>
;       chaque ligne de <liste> est « source<TAB>sortie » : le programme source est traduit
;       en LispE et écrit dans sortie (ou « ERREUR … » si la traduction échoue)
;   lispe banc.lisp exécute <basic/> <analyseur> <noms> <programme>
;       traduit le programme puis l'exécute ; ce qu'il affiche sort sur la sortie standard.
;       Une traduction refusée affiche son message d'erreur, comme la console.
;
; <analyseur> est basic.lisp (produit par compiler.lisp) ou basic_opt.lisp (produit par
; optimise.lisp) : les deux doivent donner la même chose.

(setq _mode (@ _args 1))
(setq _rep (@ _args 2))
(load (+ _rep (@ _args 3)))
(load (+ _rep "transpiler.lisp"))
(load (+ _rep (@ _args 4)))
(setq pythonmode true)

(defun _refusé (code)
   (setq code (trim code))
   (or (eq (left code 5) "Error") (eq (left code 6) "Erreur") (eq (left code 2) "오류")))

(if (eq _mode "traduis")
   (loop _ligne (split (trim (fread (@ _args 5))) "\n")
      (setq _paire (split _ligne "\t"))
      (setq _r (catch (prettify (compilepython (fread (@ _paire 0))))))
      (if (maybe _r) (setq _r (+ "ERREUR " (string _r))))
      (fwrite (@ _paire 1) (string _r)))
   (block
      (setq _lispe (catch (compilepython (fread (@ _args 5)))))
      (cond
         ((maybe _lispe) (println "ERREUR" (string _lispe)))
         ((_refusé _lispe) (println (trim _lispe)))
         (true
            ; dans le navigateur, evaljsc appelle le JavaScript : ici, Pyt.write 
            ; écrit son texte sans retour à la ligne
            (defun evaljsc (l) (print (@ l 1)))
            (load (+ _rep "bibliothèque.lisp"))
            (setq _r (catch (eval (+ "(block " _lispe ")"))))
            (if (maybe _r) (println "ERREUR" (string _r)))))))

; LispE affiche la valeur de la dernière expression du fichier : print "" la rend vide
(print "")
