# 1. Bonjour !
# affiche() écrit dans la console, en bas de l'éditeur.

affiche("Bonjour tout le monde !")

# Une variable garde une valeur en mémoire
prenom = "Léa"
age = 12
affiche("Je m'appelle", prenom, "et j'ai", age, "ans.")

# Les f-chaînes insèrent des variables dans un texte
affiche(f"Dans 5 ans, {prenom} aura {age + 5} ans.")

# Des calculs
affiche("7 + 3 =", 7 + 3)
affiche("7 / 2 =", 7 / 2)
affiche("7 // 2 =", 7 // 2, "(division entière)")
affiche("7 % 2 =", 7 % 2, "(reste)")
affiche("2 ** 10 =", 2 ** 10, "(puissance)")

# On pose une question : la réponse est lue au clavier
nom = demande("Comment t'appelles-tu ?")
affiche("Enchanté,", nom, "!")
annee = demande_nombre("En quelle année es-tu né(e) ?")
affiche("Tu as environ", 2026 - annee, "ans.")
