const express = require('express');
const bodyParser = require('body-parser');
const { updateInventory } = require('./database/database'); // Asegúrate de tener esta función definida

const app = express();
const port = process.env.PORT || 3000; // Puedes usar una variable de entorno o un puerto específico

app.use(bodyParser.json()); // Para poder recibir JSON en el cuerpo de la solicitud

// Webhook para recibir votos
app.post('/webhook/topgg', async (req, res) => {
    const { user, bot, token } = req.body;

    // Verifica que el token sea válido
    const TOPGG_AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyNzIzMDE5ODU3ODk2NDA4NTciLCJib3QiOnRydWUsImlhdCI6MTcyNTQwNzkxN30.KSQ8Q7LpuhEsjoZg_MAdrIs07O9cg0omK_R-9Ga3HLo'; // Asegúrate de que el token coincida
   const weebhook_link = "https://discord.com/api/webhooks/1286908138620194816/QfS7eBKpFIrhlYztLbY2OFBFo3PdIzWqCiRB0vBvk5eo7a-8d3Pu_ZP_E1vfEvJ1PK-B"
    if (token !== TOPGG_AUTH_TOKEN) {
        return res.status(403).send('Forbidden: Invalid Token');
    }

    try {
        // Manejar el voto
        const userId = user; // ID del usuario que votó

        // Incrementar los brillos del usuario
        await updateInventory(userId, { $inc: { shines: 1, monthly_votes: 1 } }); // Ajusta según tu esquema

        res.status(200).send('Vote received and processed');
    } catch (error) {
        console.error('Error processing vote:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.listen(port, () => {
    console.log(`Webhook server running at http://localhost:${port}`);
});
