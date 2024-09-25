const { fetchInventory } = require('../database/database');

async function checkUserMiddleware(message) {
    try {
        const userId = message.author.id;
        const inventory = await fetchInventory(userId);
        const commandName = message.content.split(' ')[0].slice(2).toLowerCase(); // Obtiene el nombre del comando

        if (inventory === null) {
            if (commandName !== 'register') {
                await message.reply('You are not registered. Please use `y!register` to register.');
                return false; // Usuario no registrado y no está usando el comando `y!register`
            }
        }
        return true; // Usuario registrado o está usando `y!register`
    } catch (error) {
        console.error('Error in user check middleware:', error);
        await message.reply('An error occurred while checking your registration status.');
        return false; // Error durante la verificación
    }
}

module.exports = checkUserMiddleware;
