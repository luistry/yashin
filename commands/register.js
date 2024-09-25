const { EmbedBuilder } = require('discord.js');
const { registerUser, checkUserExists } = require('./database/database'); // Ajusta la ruta según sea necesario

module.exports = {
    name: 'register', // Nombre del comando
    description: 'Register a user with reactions for confirmation',
    run: async (message, args) => {
        try {
            // Extrae el ID y nombre del usuario que ejecuta el comando
            const userId = message.author.id;
            const userName = message.author.username;

            // Verifica si el usuario ya está registrado
            const userExists = await checkUserExists(userId);

            if (userExists) {
                return message.channel.send(`You are already registered, ${userName}.`);
            }

            // Crea un embed para el registro
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('Registration Confirmation')
                .setDescription(`Are you sure you want to register with the username **${userName}**?`)
                .setFooter({ text: 'React with ✅ to confirm or ❌ to cancel' });

            // Envía el mensaje de registro
            const sentMessage = await message.channel.send({ embeds: [embed] });

            // Añade reacciones para confirmar o cancelar
            await sentMessage.react('✅');
            await sentMessage.react('❌');

            // Filtros para las reacciones
            const filter = (reaction, user) => ['✅', '❌'].includes(reaction.emoji.name) && user.id === message.author.id;
            const collector = sentMessage.createReactionCollector({ filter, time: 60000 }); // Tiempo para recoger reacciones (60 segundos)

            collector.on('collect', async (reaction) => {
                try {
                    if (reaction.emoji.name === '✅') {
                        // Registra al usuario en la base de datos
                        await registerUser(userId, userName);
                        await message.channel.send(`You have been successfully registered, ${userName}!`);
                    } else if (reaction.emoji.name === '❌') {
                        await message.channel.send('Registration cancelled.');
                    }

                    // Borra el mensaje de confirmación
                    if (sentMessage.deletable) {
                        await sentMessage.delete();
                    }
                    collector.stop();
                } catch (error) {
                    console.error('Error during reaction collection:', error);
                }
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'time') {
                    await message.channel.send('Registration timed out.');
                }
                try {
                    // Elimina las reacciones después de que el tiempo ha terminado
                    if (sentMessage.reactions.cache.size > 0) {
                        await sentMessage.reactions.removeAll();
                    }
                } catch (error) {
                    console.error('Error removing reactions:', error);
                }
            });

        } catch (err) {
            console.error('Error executing register command:', err);
            await message.channel.send('There was an error processing the registration.');
        }
    }
};
