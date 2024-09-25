const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { fetchInventory } = require('./database/database'); // Asegúrate de poner el path correcto

module.exports = {
    name: 'banners',
    description: 'Displays the banners in your inventory with pagination.',
    run: async (message, args) => {
        try {
            // Obtener el usuario mencionado o el autor del mensaje
            const mentionedUser = message.mentions.users.first() || message.author;

            // Obtener el inventario para el usuario mencionado
            const inventory = await fetchInventory(mentionedUser.id);

            // Verificar si el inventario existe y contiene banners
            if (!inventory || !inventory.Banners || inventory.Banners.length === 0) {
                return await message.channel.send(`${mentionedUser.username}, you don't have any banners in your inventory.`);
            }

            // Desestructurar el array de Banners
            const { Banners } = inventory;

            // Crear un objeto para contar las cantidades de cada banner
            const bannerCounts = Banners.reduce((acc, banner) => {
                const { name } = banner;
                if (acc[name]) {
                    acc[name].quantity += 1; // Incrementar la cantidad si ya existe
                } else {
                    acc[name] = { ...banner, quantity: 1 }; // Si no existe, agregarlo con quantity 1
                }
                return acc;
            }, {});

            // Crear una lista de banners con cantidad
            const bannerList = Object.values(bannerCounts)
                .map(banner => `${banner.name} x${banner.quantity}`);

            // Configuración de paginación
            const bannersPerPage = 8;
            const totalPages = Math.ceil(bannerList.length / bannersPerPage);

            // Función para generar el embed con la página actual
            const generateEmbed = (page) => {
                const start = (page - 1) * bannersPerPage;
                const end = start + bannersPerPage;
                const paginatedBanners = bannerList.slice(start, end).join('\n');

                return new EmbedBuilder()
                    .setColor('#efa94a')
                    .setTitle(`${mentionedUser.username}'s Banners`)
                    .setDescription(paginatedBanners || 'No banners found.')
                    .setFooter({ text: `Page ${page}/${totalPages}` });
            };

            // Función para generar los botones de paginación
            const generateButtons = (page) => new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('previous')
                        .setLabel('Previous')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === 1),
                    new ButtonBuilder()
                        .setCustomId('next')
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === totalPages)
                );

            let currentPage = 1;

            // Enviar el embed inicial
            const messageEmbed = await message.channel.send({
                embeds: [generateEmbed(currentPage)],
                components: [generateButtons(currentPage)]
            });

            // Crear un recolector para los componentes
            const collector = messageEmbed.createMessageComponentCollector({ time: 60000 });

            collector.on('collect', async interaction => {
                if (interaction.user.id !== mentionedUser.id) {
                    return interaction.reply({ content: "You can't interact with this pagination.", ephemeral: true });
                }

                if (interaction.customId === 'previous' && currentPage > 1) {
                    currentPage--;
                } else if (interaction.customId === 'next' && currentPage < totalPages) {
                    currentPage++;
                }

                await interaction.update({
                    embeds: [generateEmbed(currentPage)],
                    components: [generateButtons(currentPage)]
                });
            });

            collector.on('end', () => {
                messageEmbed.edit({ components: [] });
            });

        } catch (err) {
            console.error('Error executing banners command:', err);
            await message.channel.send('There was an error fetching your banners.');
        }
    }
};
