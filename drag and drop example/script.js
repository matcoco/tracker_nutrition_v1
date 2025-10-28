// Sélection de toutes les vignettes et de toutes les colonnes
const vignettes = document.querySelectorAll('.vignette');
const colonnes = document.querySelectorAll('.colonne');

// Variable pour stocker la vignette en cours de déplacement
let draggedItem = null;

// Étape 1: Gérer le début du déplacement
vignettes.forEach(vignette => {
    vignette.addEventListener('dragstart', function() {
        // Stocker la référence de la vignette que l'on déplace
        draggedItem = this;
        // Ajouter une classe pour un retour visuel (optionnel)
        setTimeout(() => this.classList.add('dragging'), 0);
    });

    // Étape 4: Gérer la fin du déplacement (quand on relâche la souris)
    vignette.addEventListener('dragend', function() {
        // Retirer la classe visuelle
        this.classList.remove('dragging');
        draggedItem = null;
    });
});

colonnes.forEach(colonne => {
    // Étape 2: Gérer l'élément qui passe au-dessus de la colonne
    colonne.addEventListener('dragover', function(e) {
        // Comportement par défaut empêche le drop, il faut l'annuler
        e.preventDefault(); 
        // Ajouter une classe pour signaler que la zone est une cible valide
        this.classList.add('drag-over');
    });

    // Gérer le moment où l'élément quitte la zone de survol
    colonne.addEventListener('dragleave', function() {
        this.classList.remove('drag-over');
    });

    // Étape 3: Gérer le dépôt de la vignette
    colonne.addEventListener('drop', function(e) {
        e.preventDefault(); // Annuler le comportement par défaut (qui peut être d'ouvrir un lien)
        
        // S'assurer qu'un élément est bien en cours de déplacement
        if (draggedItem) {
            this.appendChild(draggedItem); // Ajouter la vignette à la nouvelle colonne
        }
        
        this.classList.remove('drag-over'); // Retirer le style de survol
    });
});