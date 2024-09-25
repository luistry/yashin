const { EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { addAnimeCharacter } = require('./database/database');

// Solo este usuario está autorizado
const authorizedUserIds = ['346799501878755342','123864968461287428','339869018439548938','300619060729610258','270681503665618954','955254487629561887','755635893938815067','1133740727151632475'];

// ID del canal para notificaciones
const notificationChannelId = '1284269392330494005';

module.exports = {
    name: 'characteradd',
    description: 'Adds a new anime character to the database',
    run: async (message, args) => {
        try {
            // Verificar si el usuario está autorizado
            if (!authorizedUserIds.includes(message.author.id)) {
                return await message.channel.send('You are not authorized to use this command.');
            }

            // Unir los argumentos y luego dividirlos por comas
            const input = args.join(' ').split(',');
            
            // Verificar que haya al menos tres partes (nombre, serie, URL)
            if (input.length < 3) {
                return await message.channel.send('Please provide the character name, series, and image URL.');
            }

            // Extraer el nombre, la serie y la URL de la imagen
            const name = input[0].trim();
            const series = input[1].trim();
            const img_url = input[2].trim();

            // Imprimir los datos del personaje en la consola
            console.log(`Previewing new character:\nName: ${name}\nSeries: ${series}\nImage URL: ${img_url}`);

            // Crear el embed de vista previa
            const previewEmbed = new EmbedBuilder()
                .setColor('#FFA500') // Color naranja para la vista previa
                .setTitle('Character Preview')
                .setDescription(`**Name**: ${name}\n**Series**: ${series}`)
                .setImage(img_url)
                .setTimestamp();

            // Crear los botones
            const checkoutButton = new ButtonBuilder()
                .setCustomId('checkout')
                .setLabel('Checkout')
                .setStyle(ButtonStyle.Success);

            const cancelButton = new ButtonBuilder()
                .setCustomId('cancel')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger);

            // Enviar la vista previa al canal donde se ejecutó el comando
            const messageSent = await message.channel.send({
                embeds: [previewEmbed],
                components: [
                    {
                        type: 1, // ActionRow
                        components: [checkoutButton, cancelButton]
                    }
                ]
            });

            // Manejar la interacción del usuario con los botones
            const filter = (interaction) => {
                return ['checkout', 'cancel'].includes(interaction.customId) && interaction.user.id === message.author.id;
            };

            const collector = messageSent.createMessageComponentCollector({ filter, time: 60000 });

            collector.on('collect', async (interaction) => {
                if (interaction.customId === 'checkout') {
                    // Confirmar adición del personaje
                    await addAnimeCharacter(name, series, img_url);

                    // Crear el embed de confirmación
                    const confirmationEmbed = new EmbedBuilder()
                        .setColor('#00FF00') // Color verde para la confirmación
                        .setTitle('Character Added')
                        .setDescription(`**Character**: ${name}\n**Series**: ${series}`)
                        .setImage(img_url)
                        .setTimestamp();
                    
                    // Editar el mensaje original con la confirmación
                    await messageSent.edit({ embeds: [confirmationEmbed], components: [] });

                    // Enviar una vista previa al canal de notificaciones
                    const notificationChannel = message.client.channels.cache.get(notificationChannelId);
                    if (notificationChannel) {
                        await notificationChannel.send({
                            embeds: [confirmationEmbed] // Vista previa confirmada
                        });
                    } else {
                        console.error('Notification channel not found.');
                    }

                } else if (interaction.customId === 'cancel') {
                    // Cancelar adición del personaje
                    await messageSent.edit({ content: 'Character addition canceled.', components: [] });
                }
            });

            collector.on('end', collected => {
                // Mensaje de timeout
                if (collected.size === 0) {
                    message.channel.send('You did not respond in time, operation canceled.');
                    messageSent.edit({ components: [] });
                }
            });

        } catch (err) {
            console.error('Error adding character:', err);
            await message.channel.send('There was an error adding the character to the database.');
        }
    }
};