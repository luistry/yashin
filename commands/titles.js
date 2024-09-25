const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const {fetchInventory} = require('./database/database');; // Asegúrate de poner el path correcto

module.exports = {
    name: 'titles',
    description: 'Displays the titles in your inventory with pagination.',
    run: async (message, args) => {
        try {
            // Obtener el usuario mencionado o el autor del mensaje
            const mentionedUser = message.mentions.users.first() || message.author;

            // Obtener el inventario para el usuario mencionado
            const inventory = await fetchInventory(mentionedUser.id);

            // Verificar si el inventario existe
            if (!inventory || !inventory.Titles || inventory.Titles.length === 0) {
                return await message.channel.send(`${mentionedUser.username}, you don't have any titles in your inventory.`);
            }

            // Desestructurar el array de Titles
            const { Titles } = inventory;

            // Crear un objeto para contar las cantidades de cada título
            const titleCounts = Titles.reduce((acc, title) => {
                const { name } = title;
                if (acc[name]) {
                    acc[name].quantity += 1; // Si ya existe, incrementar la cantidad
                } else {
                    acc[name] = { ...title, quantity: 1 }; // Si no existe, agregarlo con quantity 1
                }
                return acc;
            }, {});

            // Convertir el objeto en una lista de títulos con cantidades
            const titleList = Object.values(titleCounts).map(title => `${title.name} x${title.quantity}`);

            // Configurar la paginación
            const titlesPerPage = 8; // Mostramos 8 títulos por página
            const totalPages = Math.ceil(titleList.length / titlesPerPage);

            // Función para generar el embed de la página actual
            const generateEmbed = (page) => {
                const start = (page - 1) * titlesPerPage;
                const end = start + titlesPerPage;
                const paginatedTitles = titleList.slice(start, end).join('\n');

                return new EmbedBuilder()
                    .setColor('#efa94a')
                    .setTitle(`${mentionedUser.username}'s Titles`)
                    .setDescription(paginatedTitles || 'No titles found.')
                    .setFooter({ text: `Page ${page}/${totalPages}` });
            };

            // Definir botones para navegar entre las páginas
            const generateButtons = (page) => new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('previous')
                        .setLabel('Previous')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === 1), // Deshabilitar si estamos en la primera página
                    new ButtonBuilder()
                        .setCustomId('next')
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === totalPages) // Deshabilitar si estamos en la última página
                );

            // Empezamos con la primera página
            let currentPage = 1;
            const messageEmbed = await message.channel.send({
                embeds: [generateEmbed(currentPage)],
                components: [generateButtons(currentPage)]
            });

            // Crear un collector para los botones
            const collector = messageEmbed.createMessageComponentCollector({ time: 60000 }); // 60 segundos para interactuar

            collector.on('collect', async interaction => {
                if (interaction.user.id !== mentionedUser.id) {
                    return interaction.reply({ content: "You can't interact with this pagination.", ephemeral: true });
                }

                // Actualizar la página según el botón pulsado
                if (interaction.customId === 'previous' && currentPage > 1) {
                    currentPage--;
                } else if (interaction.customId === 'next' && currentPage < totalPages) {
                    currentPage++;
                }

                // Actualizar el mensaje con la nueva página y botones
                await interaction.update({
                    embeds: [generateEmbed(currentPage)],
                    components: [generateButtons(currentPage)]
                });
            });

            collector.on('end', () => {
                // Deshabilitar los botones después de que expire el collector
                messageEmbed.edit({
                    components: []
                });
            });

        } catch (err) {
            console.error('Error executing titles command:', err);

            // Responder con un mensaje de error si algo sale mal
            await message.channel.send('There was an error fetching your titles.');
        }
    }
};
