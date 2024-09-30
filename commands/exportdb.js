const { EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getDatabaseSnapshot } = require('./database/database'); // Asegúrate de tener esta función implementada

// Solo estos usuarios están autorizados
const authorizedUserIds = ['346799501878755342', '123864968461287428', '339869018439548938', '300619060729610258', '270681503665618954'];

module.exports = {
    name: 'exportdb',
    description: 'Exports the database contents to a text file',
    run: async (message) => {
        try {
            // Verificar si el usuario está autorizado
            if (!authorizedUserIds.includes(message.author.id)) {
                return await message.channel.send('You are not authorized to use this command.');
            }

            // Obtener un snapshot de la base de datos
            const data = await getDatabaseSnapshot(); // Implementa esta función para obtener todos los datos necesarios
            if (!data || data.length === 0) {
                return await message.channel.send('No data found in the database.');
            }

            // Crear el archivo de texto
            const fs = require('fs');
            const path = require('path');
            const filePath = path.join(__dirname, 'database_export.txt');
            const fileContent = data.map(item => `Name: ${item.name}, Series: ${item.series}, Image URL: ${item.img_url}`).join('\n');
            fs.writeFileSync(filePath, fileContent);

            // Enviar el archivo al canal
            await message.channel.send({
                content: 'Here is the exported database:',
                files: [filePath]
            });

            // Eliminar el archivo después de enviarlo
            fs.unlinkSync(filePath);

        } catch (err) {
            console.error('Error exporting database:', err);
            await message.channel.send('There was an error exporting the database.');
        }
    }
};
