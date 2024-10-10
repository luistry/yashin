const fs = require('fs');
const { handleInventory } = require('./database/database');
const { EmbedBuilder } = require('discord.js');

// Crear o cargar el archivo de usuarios baneados
const bannedUsersFile = './bannedUsers.json';
let bannedUsers = [];
if (fs.existsSync(bannedUsersFile)) {
    bannedUsers = JSON.parse(fs.readFileSync(bannedUsersFile));
} else {
    fs.writeFileSync(bannedUsersFile, JSON.stringify(bannedUsers));
}

// Función para enviar el embed al canal especificado
async function sendBannedUsersEmbed(channel) {
    const embed = new EmbedBuilder()
        .setTitle('Banned Users')
        .setDescription('The following users have been banned:')
        .addFields({ name: 'User IDs:', value: bannedUsers.join('\n') || 'No users banned yet.' })
        .setColor('#ff0000') // Color rojo para indicar advertencia
        .setTimestamp();

    await channel.send({ embeds: [embed] });
}

module.exports = {
    name: 'ban',
    description: 'Ban a user by mention or ID and transfer their cards to another user',
    async run(message, args) {
        let targetUser;

        if (message.mentions.users.first()) {
            // Si hay una mención, usamos la mención
            targetUser = message.mentions.users.first();
        } else if (args[0]) {
            // Si no, usamos el ID proporcionado en args[0]
            const targetId = args[0];
            targetUser = await message.client.users.fetch(targetId).catch(() => null);
        }

        if (!targetUser) {
            return message.channel.send('Please mention a valid user or provide a valid user ID to ban.');
        }

        const userId = targetUser.id;

        if (bannedUsers.includes(userId)) {
            return message.channel.send(`${targetUser.username} is already banned.`);
        }

        try {
            // Manejar el inventario, transfiriendo las cartas al inventario del destino
            await handleInventory(userId, '1272301985789640857');

            // Añadir el usuario a la lista de baneados
            bannedUsers.push(userId);
            fs.writeFileSync(bannedUsersFile, JSON.stringify(bannedUsers));

            // Enviar un mensaje de DM al usuario
            await targetUser.send('You have been included in the blacklist for alting. you can appeal here: https://forms.gle/BjAsCeeWCkMKxFTW7');

            // Mensaje de éxito al banear al usuario
            message.channel.send(`${targetUser.username} has been banned, and their cards have been transferred successfully.`);

            // Enviar embed con los IDs de los baneados al canal específico
            const bannedChannel = message.guild.channels.cache.get('1294015751027425310');
            if (bannedChannel) {
                await sendBannedUsersEmbed(bannedChannel);
            } else {
                console.log('Banned users channel not found.');
            }
        } catch (error) {
            console.error('Error banning user:', error);
            message.channel.send('An error occurred while banning the user.');
        }
    }
};
