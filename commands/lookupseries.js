const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { AnimeCharacter, fetchInventory } = require('./database/database');

module.exports = {
    name: 'LookupSeries',
    description: 'Lookup characters from a specific series and check how many you have collected.',
    options: [
        {
            name: 'seriesname',
            description: 'The name of the series you want to lookup',
            type: 3, // STRING type
            required: true
        }
    ],
    async run(message, args) {
        const userId = message.author.id;
        const seriesName = args.join(' ').toLowerCase();

        // Fetch the user's inventory
        const inventory = await fetchInventory(userId);

        // Fetch characters from the specified series (case insensitive)
        const characters = await AnimeCharacter.find({
            series: { $regex: new RegExp(seriesName, 'i') }
        });

        if (!characters.length) {
            return message.reply({ content: `No characters found for the series: **${seriesName}**.`, ephemeral: true });
        }

        // Calculate how many characters the user has collected from this series
        const collectedCharacters = characters.filter(character =>
            inventory.cards.some(card =>
                card.name && card.series &&
                card.name.toLowerCase() === character.name.toLowerCase() &&
                card.series.toLowerCase() === character.series.toLowerCase()
            )
        );

        const collectedCount = collectedCharacters.length;
        const totalCharacters = characters.length;
        const completionPercentage = ((collectedCount / totalCharacters) * 100).toFixed(2);

        // Pagination variables
        const itemsPerPage = 10;
        let currentPage = 0;
        const totalPages = Math.ceil(totalCharacters / itemsPerPage);

        // Function to generate the embed for a specific page
        const generateEmbed = (page) => {
            const start = page * itemsPerPage;
            const end = start + itemsPerPage;
            const characterList = characters.slice(start, end).map(character => {
                const isCollected = collectedCharacters.some(collected => collected.name === character.name);
                const status = isCollected ? '✅' : '❌';
                const name = character.name ? `**${character.name}**` : '';
                const rarity = character.rarity ? `(${character.rarity})` : '';
                return `${status} ${name} ${rarity}`.trim();
            }).join('\n');

            return new EmbedBuilder()
                .setTitle(`Series: ${seriesName}`)
                .setDescription(`Characters collected: **${collectedCount}/${totalCharacters}** (${completionPercentage}%)`)
                .addFields(
                    { name: 'Characters', value: characterList || 'No characters found.' }
                )
                .setFooter({ text: `Page ${page + 1} of ${totalPages}` })
                .setColor(0x00AE86); // Puedes elegir cualquier color
        };

        // Initial embed
        let embed = generateEmbed(currentPage);

        // Buttons for pagination
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('previous')
                    .setLabel('← Previous')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPage === 0),
                new ButtonBuilder()
                    .setCustomId('next')
                    .setLabel('Next →')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPage === totalPages - 1)
            );

        const sentMessage = await message.reply({ embeds: [embed], components: [row], ephemeral: true });

        // Create a collector to handle button interactions
        const filter = i => i.user.id === message.author.id;
        const collector = sentMessage.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async i => {
            if (i.customId === 'previous' && currentPage > 0) {
                currentPage--;
            } else if (i.customId === 'next' && currentPage < totalPages - 1) {
                currentPage++;
            }

            // Regenerate embed with new page
            embed = generateEmbed(currentPage);

            // Update buttons
            row.components[0].setDisabled(currentPage === 0);
            row.components[1].setDisabled(currentPage === totalPages - 1);

            await i.update({ embeds: [embed], components: [row] });
        });

        collector.on('end', collected => {
            // Disable buttons after the collector ends
            row.components.forEach(button => button.setDisabled(true));
            sentMessage.edit({ components: [row] });
        });
    },
};
