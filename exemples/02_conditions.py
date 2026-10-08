# 2. Les conditions : si / sinonsi / sinon
# La ligne qui ouvre un bloc se termine par ":"
# et le contenu du bloc est décalé de 4 espaces.

note = aleatoire(0, 20)
affiche("Ta note :", note)

si note >= 16:
    affiche("Excellent !")
sinonsi note >= 12:
    affiche("Bien.")
sinonsi note >= 10:
    affiche("C'est juste.")
sinon:
    affiche("Il faut retravailler.")

# On combine les conditions avec et / ou / non
pluie = Vrai
temperature = 25
si temperature > 20 et non pluie:
    affiche("On va à la plage.")
sinon:
    affiche("On reste à la maison.")

affiche("Fin du programme")
