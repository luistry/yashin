const { fetchLastDaily, updateGoldAndShine } = require('./database/database'); // Ajusta el path si es necesario
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'daily',
    description: 'Claim your daily gold reward. Available once every 24 hours.',
    run: async (message, args) => {
        try {
            // Obtiene el ID del usuario que usó el comando
            const userId = message.author.id;

            // Obtiene la última fecha de uso del comando daily
            const lastDaily = await fetchLastDaily(userId);

            // Si el usuario ha reclamado en las últimas 24 horas, envía un mensaje
            if (lastDaily) {
                const now = new Date();
                const timeDifference = now - new Date(lastDaily);
                const hoursDifference = Math.floor(timeDifference / (1000 * 60 * 60));

                if (hoursDifference < 24) {
                    const remainingTime = 24 - hoursDifference;
                    return message.channel.send(`You can claim your next daily reward in ${remainingTime} hour(s).`);
                }
            }

            // Actualiza el oro y el shine del usuario en la base de datos
            await updateGoldAndShine(userId, 300); // 120 gold and 1 shine

            // Crea un embed para mostrar el mensaje de éxito
            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('Daily Reward Claimed!')
                .setDescription(`${message.author.username}, you have received 300 gold!`)
                .setThumbnail(message.author.displayAvatarURL({ format: 'png', dynamic: true, size: 128 }))
                .setTimestamp()
                .setFooter({ text: 'Come back tomorrow for more rewards!' });

            // Envía el embed al canal
            await message.channel.send({ embeds: [embed] });

        } catch (err) {
            console.error('Error executing daily command:', err);

            // Responde con un mensaje de error si algo sale mal
            await message.channel.send('There was an error claiming your daily reward.');
        }
    }
};
