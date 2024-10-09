const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { fetchInventory, updateInventory } = require('./database/database');

// Función para generar códigos hexadecimales aleatorios
function generateHexCode() {
    return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
}

// Objeto de frames con probabilidades
const frames = [
    { name: 'Dragon Shadow of the Rock Frame', url: 'https://example.com/dragon_shadow_frame.png', chance: 2 },
    { name: 'Starry Night', url: 'https://example.com/starry_night_frame.png', chance: 2 },
    { name: 'Retro Arcade Frame', url: 'https://example.com/retro_arcade_frame.png', chance: 10 },
    { name: 'Golden Frame', url: 'https://example.com/golden_frame.png', chance: 10 },
    { name: 'Default Frame', url: 'https://yashin.nyc3.cdn.digitaloceanspaces.com/frames/Frame_Default_Yashin.png', chance: 76 }
];

// Función para seleccionar un frame basado en probabilidades
function getRandomFrame() {
    const totalWeight = frames.reduce((acc, frame) => acc + frame.chance, 0);
    const random = Math.random() * totalWeight;
    let cumulativeChance = 0;

    for (const frame of frames) {
        cumulativeChance += frame.chance;
        if (random < cumulativeChance) {
            return frame;
        }
    }
    return frames[frames.length - 1]; // Por defecto si algo falla, retornar el último frame
}

module.exports = {
    name: 'morph',
    description: 'Morph different attributes of your card such as name, series, version, or frame.',
    async run(message, args) {
        if (args.length < 1) {
            return message.channel.send('Please provide the card code.');
        }

        const cardCode = args[0].trim();
        const userId = message.author.id;

        // Fetch user inventory
        const userInventory = await fetchInventory(userId);
        if (!userInventory) {
            return message.channel.send('Could not fetch your inventory.');
        }

        // Find the card by code
        const card = userInventory.cards.find(c => c.code === cardCode);
        if (!card) {
            return message.channel.send('Card not found in your inventory.');
        }

        // Ensure user has enough gold for the morph (250 gold required)
        if (userInventory.gold < 250) {
            return message.channel.send('You don\'t have enough gold to perform a morph. You need 250 gold.');
        }

        // Step 1: Choose what to morph
        const morphEmbed = new EmbedBuilder()
            .setTitle('Morph Options')
            .setDescription(`You are about to morph the card **${card.name}** (Code: ${card.code}). Please choose an option to morph:\n\n1️⃣ __Version__ (__v)\n2️⃣ __Series__\n3️⃣ __Name__\n4️⃣ __Frame__\n\nThis will cost **250 gold**.`)
            .setColor('#FFD700') // Gold color for the morphing process
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('morph_version')
                    .setLabel('Morph Version')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('1️⃣'),
                new ButtonBuilder()
                    .setCustomId('morph_series')
                    .setLabel('Morph Series')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('2️⃣'),
                new ButtonBuilder()
                    .setCustomId('morph_name')
                    .setLabel('Morph Name')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('3️⃣'),
                new ButtonBuilder()
                    .setCustomId('morph_frame')
                    .setLabel('Morph Frame')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('4️⃣')
            );

        const morphMessage = await message.channel.send({ embeds: [morphEmbed], components: [row] });

        const filter = i => i.user.id === message.author.id;
        const collector = morphMessage.createMessageComponentCollector({ filter, time: 15000 });

        let selectedMorph = null;

        collector.on('collect', async i => {
            if (i.customId.startsWith('morph_')) {
                switch (i.customId) {
                    case 'morph_version':
                        selectedMorph = 'version';
                        break;
                    case 'morph_series':
                        selectedMorph = 'series';
                        break;
                    case 'morph_name':
                        selectedMorph = 'name';
                        break;
                    case 'morph_frame':
                        selectedMorph = 'frame';
                        break;
                }

                // Step 2: Ask for confirmation
                const confirmEmbed = new EmbedBuilder()
                    .setTitle('Confirm Morph')
                    .setDescription(`You have selected to morph the **${selectedMorph}** of your card **${card.name}**. This will cost **250 gold**.\n\nAre you sure you want to apply this morph?`)
                    .setColor('#FFA500') // Orange for confirmation
                    .setTimestamp();

                const confirmRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('confirm_morph')
                            .setLabel('Confirm')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId('cancel_morph')
                            .setLabel('Cancel')
                            .setStyle(ButtonStyle.Danger)
                    );

                await i.update({ embeds: [confirmEmbed], components: [confirmRow] });

                // Create a new collector for the confirmation
                const confirmCollector = i.channel.createMessageComponentCollector({ filter, time: 15000 });

                confirmCollector.on('collect', async interaction => {
                    if (interaction.customId === 'confirm_morph') {
                        // Apply the morph
                        userInventory.gold -= 250; // Deduct gold

                        switch (selectedMorph) {
                            case 'version':
                                card.last_morph = 'version';
                                card.__v = generateHexCode(); // New hex code for version
                                break;
                            case 'series':
                                card.last_morph = 'series';
                                card.last_color_letter_series = card.series;
                                card.series = generateHexCode(); // New hex code for series
                                break;
                            case 'name':
                                card.last_morph = 'name';
                                card.last_color_letter_name = card.name;
                                
                                card.name = generateHexCode(); // New hex code for name
                                break;
                            case 'frame':
                                card.last_morph = 'frame';
                                const randomFrame = getRandomFrame(); // Get random frame with probabilities
                                card.default_frame = randomFrame.url;
                                break;
                        }

                        // Save the updated inventory
                        await updateInventory(userId, userInventory);

                        // Send success message
                        await interaction.update({
                            content: `You successfully morphed the **${selectedMorph}** of your card **${card.name}**!`,
                            components: []
                        });
                        confirmCollector.stop(); // End the collector after confirmation
                    } else if (interaction.customId === 'cancel_morph') {
                        // Cancel the morph process
                        await interaction.update({ content: 'Morph cancelled.', components: [] });
                        confirmCollector.stop(); // End the collector after cancellation
                    }
                });

                confirmCollector.on('end', collected => {
                    if (collected.size === 0) {
                        i.update({ content: 'Confirmation timed out. Morph cancelled.', components: [] });
                    }
                });
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                morphMessage.edit({ content: 'Morph selection timed out.', components: [] });
            }
        });
    }
};
