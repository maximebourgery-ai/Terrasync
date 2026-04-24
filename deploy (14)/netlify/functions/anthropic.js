
// Exemple de gestion de PubSub pour éviter les doublons
if (typeof PubSub === 'undefined') {
    // Charge PubSub ici
    // Exemple : PubSub = require('pubsub-js');
    console.warn("PubSub n'est pas chargé.");
} else {
    console.log("PubSub est déjà chargé.");
}

// Fonction principale
async function handleRequest(body, respond) {
    // ... ton code existant ...
}
