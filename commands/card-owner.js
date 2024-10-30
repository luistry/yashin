const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { fetchAllInventories, AnimeCharacter } = require('./database/database');

module.exports = {
    name: 'card-owner',
    description: 'Displays the owners of a card based on the character name or series.',
    async run(message, args) {
        if (args.length === 0) {
            return message.channel.send('❗ **You need to provide the character\'s name or part of the series.**');
        }

        const query = args.join(' ').toLowerCase();

        try {
            // Fetch matching characters
            const characters = await AnimeCharacter.find({
                $or: [
                    { name: { $regex: new RegExp(query, 'i') } },
                    { series: { $regex: new RegExp(query, 'i') } }
                ]
            }).limit(15);

            if (characters.length === 0) {
                return message.channel.send(`⚠️ **No characters or series matching "${query}" found in the database.**`);
            }

            const selectMenu = createSelectMenu(characters);
            const sentMessage = await message.channel.send({
                content: 'Select a character to view their card owners:',
                components: [new ActionRowBuilder().addComponents(selectMenu)]
            });

            const collector = sentMessage.createMessageComponentCollector({ filter: i => i.customId === 'select_character' && i.user.id === message.author.id, time: 60000 });

            collector.on('collect', async i => {
                await i.deferUpdate(); // Acknowledge the interaction immediately
                const selectedCharacterId = i.values[0];
                const character = await AnimeCharacter.findById(selectedCharacterId);

                if (!character) {
                    return i.reply({ content: 'Character not found.', ephemeral: true });
                }

                // Fetch all inventories and prepare the owner list
                const allInventories = await fetchAllInventories();
                const cardOwners = await findCardOwners(allInventories, character);

                if (cardOwners.length === 0) {
                    return i.followUp({ content: `⚠️ **No owners found for "${character.name}".**`, ephemeral: true });
                }

                const pages = createPages(cardOwners, character.__v);
                let currentPageIndex = 0;

                await updateMessageWithEmbed(sentMessage, currentPageIndex, pages, character.name);
                const buttonCollector = sentMessage.createMessageComponentCollector({ filter: buttonFilter(i), time: 60000 });

                buttonCollector.on('collect', async buttonInteraction => {
                    currentPageIndex = handlePageChange(buttonInteraction.customId, currentPageIndex, pages.length);
                    await updateMessageWithEmbed(sentMessage, currentPageIndex, pages, character.name);
                });

                buttonCollector.on('end', () => disableButtons(sentMessage, currentPageIndex));
            });

        } catch (error) {
            console.error('Error fetching card owners:', error);
            message.channel.send('❌ An error occurred while searching for the card owners.');
        }
    }
};

// Helper Functions
function createSelectMenu(characters) {
    return new StringSelectMenuBuilder()
        .setCustomId('select_character')
        .setPlaceholder('Select a character or series')
        .addOptions(
            characters.map(character => 
                new StringSelectMenuOptionBuilder()
                    .setLabel(`${character.name} (${character.series})`)
                    .setValue(character._id.toString())
            )
        );
}

async function findCardOwners(allInventories, character) {
    return allInventories.flatMap(inventory =>
        inventory.cards?.filter(card => card?.name?.toLowerCase() === character.name.toLowerCase())
            .map(card => ({ card, owner: inventory._id })) || []
    );
}

function createPages(cardOwners, versionCount) {
    const ownersPerPage = 8;
    const pages = [];

    for (let i = 0; i < versionCount + 1; i++) {
        const pageCards = cardOwners.filter(entry => entry.card.__v === i);
        const currentPage = pageCards.length > 0
            ? pageCards.map((entry, index) => `${index + 1} • ${entry.card.name} [v${entry.card.__v}] • Owner: <@${entry.owner}>`).join('\n')
            : [`Despawned [v${i}]: No owners found.`];

        pages.push(currentPage);
    }

    return pages;
}

async function updateMessageWithEmbed(sentMessage, currentPageIndex, pages, characterName) {
    const embed = new EmbedBuilder()
        .setTitle(`✨ Owners of "${characterName}"`)
        .setDescription(pages[currentPageIndex])
        .setColor('#FFD700')
        .setFooter({ text: `Page ${currentPageIndex + 1} of ${pages.length}`, iconURL: sentMessage.author.displayAvatarURL() })
        .setTimestamp();

    const actionRow = createActionRow(currentPageIndex, pages.length);
    await sentMessage.edit({ embeds: [embed], components: [actionRow] });
}

function createActionRow(currentPageIndex, totalPages) {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('previous_page')
                .setLabel('Previous')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPageIndex === 0),
            new ButtonBuilder()
                .setCustomId('next_page')
                .setLabel('Next')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(currentPageIndex === totalPages - 1)
        );
}

function buttonFilter(i) {
    return i.user.id === message.author.id; // Only allow the message author to interact
}

function handlePageChange(customId, currentPageIndex, totalPages) {
    if (customId === 'next_page') {
        return Math.min(currentPageIndex + 1, totalPages - 1);
    } else if (customId === 'previous_page') {
        return Math.max(currentPageIndex - 1, 0);
    }
    return currentPageIndex;
}

function disableButtons(sentMessage, currentPageIndex) {
    const disabledActionRow = createActionRow(currentPageIndex, pages.length);
    disabledActionRow.components.forEach(button => button.setDisabled(true));
    sentMessage.edit({ components: [disabledActionRow] });
}
