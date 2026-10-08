# 5. Listes et dictionnaires

notes = [12, 15, 9, 18]
notes.ajoute(14)
affiche("Notes :", notes)
affiche("Nombre de notes :", longueur(notes))
affiche("Première :", notes[0], " dernière :", notes[-1])
affiche("Les trois premières :", notes[0:3])
affiche("Moyenne :", arrondi(somme(notes) / longueur(notes), 2))
affiche("Meilleure :", maximum(notes), " moins bonne :", minimum(notes))
affiche("Triées :", trie(notes))

# Une liste en compréhension
carres = [x * x pour x dans intervalle(10)]
pairs = [x pour x dans carres si x % 2 == 0]
affiche(carres)
affiche(pairs)

si 18 dans notes:
    affiche("Il y a un 18 !")

# Un dictionnaire associe des clés à des valeurs
capitales = {"France": "Paris", "Italie": "Rome", "Japon": "Tokyo"}
capitales["Espagne"] = "Madrid"
pour pays dans capitales:
    affiche("La capitale de", pays, "est", capitales[pays])

# Les chaînes de caractères
phrase = "le petit chat dort"
mots = decoupe(phrase, " ")
affiche(mots, longueur(mots), "mots")
affiche(majuscules(phrase))
affiche("-".joindre(mots))
