const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { AnimeCharacter } = require('./database/database');

module.exports = {
    name: 'lookup',
    description: 'Searches for anime characters by name.',
    run: async (message, args) => {
        try {
            const query = args.join(' ');
            if (!query) {
                return message.channel.send('Please provide a character name to search.');
            }

            // Buscar primero las versiones normales (sin evento)
            const normalCharacters = await AnimeCharacter.find({
                name: new RegExp(`^${query}$`, 'i'),
                $or: [{ event: { $exists: false } }, { event: "" }]
            }).sort({ _id: 1 });

            // Si no encuentra versiones normales, buscar versiones de evento
            const characters = normalCharacters.length > 0 ? normalCharacters : await AnimeCharacter.find({
                name: new RegExp(`^${query}$`, 'i'),
                event: { $exists: true, $ne: "" }
            }).sort({ _id: 1 });

            if (characters.length === 0) {
                return message.channel.send('No characters found with that name.');
            }

            const uniqueCharacters = [];
            const characterMap = new Map();

            characters.forEach(character => {
                if (!characterMap.has(character.name)) {
                    characterMap.set(character.name, character);
                    uniqueCharacters.push(character);
                }
            });

            const pages = [];
            const itemsPerPage = 10;

            for (let i = 0; i < uniqueCharacters.length; i += itemsPerPage) {
                const currentItems = uniqueCharacters.slice(i, i + itemsPerPage);

                const embed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('Character Lookup')
                    .setDescription(currentItems.map((character, index) =>
                        `${i + index + 1} • ❤️${character.wishlist || 0} • ${character.name} • ${character.series} (x${characters.filter(c => c.name === character.name && c.series === character.series).length})`
                    ).join('\n'))
                    .setFooter({ text: `Page ${Math.ceil(i / itemsPerPage) + 1} of ${Math.ceil(uniqueCharacters.length / itemsPerPage)}`, iconURL: message.author.displayAvatarURL() })
                    .setTimestamp();

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('select_character')
                    .setPlaceholder('Select a character')
                    .addOptions(
                        currentItems.map((character, index) =>
                            new StringSelectMenuOptionBuilder()
                                .setLabel(`${i + index + 1} • ${character.name}`)
                                .setValue(character._id.toString())
                        )
                    );

                const row = new ActionRowBuilder()
                    .addComponents(selectMenu);

                if (uniqueCharacters.length > itemsPerPage) {
                    const navigationRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('previous_page')
                                .setLabel('Previous')
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(true),
                            new ButtonBuilder()
                                .setCustomId('next_page')
                                .setLabel('Next')
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(uniqueCharacters.length <= itemsPerPage)
                        );

                    pages.push({ embed, row: [row, navigationRow] });
                } else {
                    pages.push({ embed, row: [row] });
                }
            }

            const sentMessage = await message.channel.send({ embeds: [pages[0].embed], components: pages[0].row });

            const filter = i => ['select_character', 'previous_page', 'next_page', 'event_button'].includes(i.customId);
            const collector = sentMessage.createMessageComponentCollector({ filter, time: 60000 });

            let pageIndex = 0;

            function updateNavigationButtons() {
                return new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('previous_page')
                            .setLabel('Previous')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(pageIndex === 0),
                        new ButtonBuilder()
                            .setCustomId('next_page')
                            .setLabel('Next')
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(pageIndex === pages.length - 1)
                    );
            }

            collector.on('collect', async i => {
                if (i.user.id !== message.author.id) {
                    return i.reply({ content: 'You are not allowed to use these buttons.', ephemeral: true });
                }

                if (i.customId === 'select_character') {
                    const selectedCharacterId = i.values[0];
                    const character = await AnimeCharacter.findOne({ _id: selectedCharacterId });

                    if (!character) {
                        return i.reply({ content: 'Character not found.', ephemeral: true });
                    }

                    // Buscar las versiones alternativas del personaje
                    const alternativeCharacters = await AnimeCharacter.find({ name: character.name, series: character.series });
                    const versionCount = alternativeCharacters.length;

                    const detailEmbed = new EmbedBuilder()
                        .setColor('#0099ff')
                        .setTitle(character.name)
                        .setDescription(`**Series:** ${character.series}\n**ID:** ${character._id}\n**Edition:** 1 \n**Wishlist:** ${character.wishlist || '0'}\n**Generated:** ${character.__v || 0}\n**Burned:** ${character.burned}\n**Event:** ${character.event || 'No Event'}`)
                        .setThumbnail(character.img_url)
                        .setImage(character.img_url)
                        .setFooter({ text: `Versions available: ${versionCount}`, iconURL: message.author.displayAvatarURL() })
                        .setTimestamp();

                    const eventButton = new ButtonBuilder()
                        .setCustomId('event_button')
                        .setLabel('Event')
                        .setStyle(ButtonStyle.Primary);

                    await i.update({ embeds: [detailEmbed], components: [new ActionRowBuilder().addComponents(eventButton)] });
                } else if (i.customId === 'event_button') {
                    const embed = i.message.embeds[0];

                    if (!embed || !embed.title) {
                        return i.reply({ content: 'No character details available.', ephemeral: true });
                    }

                    const characterName = embed.title;
                    const character = await AnimeCharacter.findOne({ name: characterName, event: { $exists: true, $ne: "" } });

                    // Filtrar por nombre para obtener versiones alternativas
                    const eventCharacters = await AnimeCharacter.find({ 
                        name: character.name, 
                        series: character.series,
                        event: { $exists: true, $ne: "" }
                    }).sort({ _id: 1 });

                    if (eventCharacters.length > 0) {
                        const eventEmbeds = eventCharacters.map(next =>
                            new EmbedBuilder()
                                .setColor('#0099ff')
                                .setTitle(next.name)
                                .setDescription(`**Series:** ${next.series}\n**ID:** ${next._id}\n**Edition:** 1 \n**Wishlist:** ${next.wishlist || '0'}\n**Generated:** ${next.__v || 0}\n**Burned:** ${next.burned}\n**Event:** ${next.event}`)
                                .setThumbnail(next.img_url)
                                .setImage(next.img_url)
                                .setFooter({ text: 'Character Details', iconURL: message.author.displayAvatarURL() })
                                .setTimestamp()
                        );

                        // Enviar los embeds de los personajes con eventos
                        await i.reply({ embeds: eventEmbeds, ephemeral: true });
                    } else {
                        await i.reply({ content: 'No event characters found for this character.', ephemeral: true });
                    }
                } else {
                    if (i.customId === 'next_page') {
                        pageIndex = Math.min(pageIndex + 1, pages.length - 1);
                    } else if (i.customId === 'previous_page') {
                        pageIndex = Math.max(pageIndex - 1, 0);
                    }

                    await i.update({ embeds: [pages[pageIndex].embed], components: [pages[pageIndex].row[0], updateNavigationButtons()] });
                }
            });

            collector.on('end', () => {
                const disabledRow = updateNavigationButtons();
                disabledRow.components.forEach(button => button.setDisabled(true));
                sentMessage.edit({ components: [pages[pageIndex].row[0], disabledRow] });
            });

        } catch (error) {
            console.error('Error searching for characters:', error);
            return message.channel.send('There was an error searching for the character. Please try again later.');
        }
    },
};
