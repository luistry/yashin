const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { fetchInventory, updateInventory } = require('./database/database');
const { createCanvas, loadImage } = require('canvas');

// Function to generate random hex codes
function generateHexCode() {
    return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
}

// Frame morphs with probabilities
const frameMorphs = [
    { name: 'Artic Morph', url: 'https://yashin.nyc3.cdn.digitaloceanspaces.com/morphs/Artic.png', chance: 11 },
    { name: 'Blue & White Morph', url: 'https://yashin.nyc3.cdn.digitaloceanspaces.com/morphs/Blue%20And%20White.png', chance: 8 },
    { name: 'Loyalty Blue Morph', url: 'https://yashin.nyc3.cdn.digitaloceanspaces.com/morphs/Loyalty%20Blue.png', chance: 10 },
    { name: 'Special Heatwave Morph', url: 'https://yashin.nyc3.cdn.digitaloceanspaces.com/morphs/Special%20HeatWave.png', chance: 2 },
    { name: 'Special Flame Fade Morph', url: 'https://yashin.nyc3.cdn.digitaloceanspaces.com/morphs/Special%20Flame%20Fade.png', chance: 2 },
    { name: 'Tundra White Morph', url: 'https://yashin.nyc3.cdn.digitaloceanspaces.com/morphs/Tundra%20white.png', chance: 5 }
];

// Function to select a frame based on probabilities
function getRandomFrame() {
    // Calculate the total chance to normalize
    const totalWeight = frameMorphs.reduce((acc, frame) => acc + frame.chance, 0);

    // Generate a random number between 0 and totalWeight
    const random = Math.random() * totalWeight;
    let cumulativeChance = 0;

    // Iterate through the frameMorphs to find the frame that corresponds to the random number
    for (const frame of frameMorphs) {
        cumulativeChance += frame.chance;
        if (random < cumulativeChance) {
            return frame;
        }
    }

    // Fallback in case of rounding issues, return the last frame
    return frameMorphs[frameMorphs.length - 1];
}
async function drawCardPreview(card, morphType, retries = 3) { 
    const cardWidth = 350;
    const cardHeight = 550;
    const canvas = createCanvas(cardWidth, cardHeight);
    const context = canvas.getContext('2d');

    context.fillStyle = '#36393F'; // Fondo gris oscuro
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Cargar y dibujar la imagen de la carta
    if (card.img_url) {
        try {
            const cardImage = await loadImage(card.img_url);
            context.globalAlpha = 1.0;
            context.drawImage(cardImage, 10, 10, cardWidth - 20, cardHeight - 20);
        } catch (error) {
            console.error(`Error loading image for card ${card._id}:`, error);
        }
    }

    // Determinar el frame predeterminado o último usado
    const default_frame = card.last_morph || (card.default_frame && card.default_frame.replace(/^['"]|['"]$/g, ''));
    const isDarkOrangeFrame = (default_frame === 'https://yashin.nyc3.cdn.digitaloceanspaces.com/Dark_Orange.png');

    // Dibujar el frame si es válido
    if (default_frame && /^https?:\/\//i.test(default_frame)) {
        try {
            const frameImg = await loadImage(default_frame);
            context.drawImage(frameImg, 0, 0, cardWidth, cardHeight);
        } catch (error) {
            console.error(`Error loading frame image from URL ${default_frame}:`, error);
        }
    }

    // Determinar colores de texto
    const colorLetterName = isDarkOrangeFrame ? '#FFFFFF' : (card.last_color_letter_name || '#000000');
    const colorLetterSeries = isDarkOrangeFrame ? '#FFFFFF' : (card.last_color_letter_series || '#000000');
    const colorLetter = isDarkOrangeFrame ? '#FFFFFF' : (card.last_color_letter || '#000000');

    // Definir posición del texto
    const textXPosition = cardWidth / 2;

    if (!isDarkOrangeFrame) {
        // Dibujar el número de versión
        context.fillStyle = colorLetter;
        context.font = 'bold 22px "Bebas Neue"';
        context.textAlign = 'center';
        context.fillText(`#${card.__v}`, textXPosition, cardHeight - 84);

        // Dibujar el nombre del personaje
        context.fillStyle = colorLetterName;
        context.font = 'bold 30px "Bebas Neue"';
        let cardName = card.name.length > 15 ? card.name.slice(0, 14) + '-' : card.name;
        context.fillText(cardName, textXPosition, cardHeight - 50);

        // Dibujar la serie
        context.font = '24px "Bebas Neue"';
        context.fillStyle = colorLetterSeries;
        let seriesText = card.series.length > 16 ? card.series.slice(0, 15) + '-' : card.series;
        wrapText(context, seriesText, textXPosition, cardHeight - 20, cardWidth - 40, 24);
    } else {
        // Si el frame es Dark Orange, omitir el número de versión
        context.font = 'bold 30px "Bebas Neue"';
        context.fillStyle = colorLetterName;
        context.textAlign = 'center';

        let cardName = card.name.length > 15 ? card.name.slice(0, 14) + '-' : card.name;
        const nameY = cardHeight - 50; // Posición ajustada para el nombre
        context.fillText(cardName, textXPosition, nameY);

        context.font = '24px "Bebas Neue"';
        context.fillStyle = colorLetterSeries;

        let seriesText = card.series.length > 16 ? card.series.slice(0, 15) + '-' : card.series;
        const seriesY = nameY + 30; // Espaciado entre nombre y serie
        wrapText(context, seriesText, textXPosition, seriesY, cardWidth - 40, 24);
    }

    return canvas;
}


// Helper function to wrap text
function wrapText(context, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let lineY = y;

    for (const word of words) {
        const testLine = line + word + ' ';
        const testWidth = context.measureText(testLine).width;
        if (testWidth > maxWidth && line !== '') {
            context.fillText(line, x, lineY);
            line = word + ' ';
            lineY += lineHeight;
        } else {
            line = testLine;
        }
    }
    context.fillText(line, x, lineY);
    return lineY + lineHeight;
}

module.exports = {
    name: 'morph',
    description: 'Morph different attributes of your card such as name, series, version, or frame.',
    async run(message, args) {
        if (!args.length) {
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

        // Step 1: Morph Selection
        const morphEmbed = new EmbedBuilder()
            .setTitle('🌟 Morph Your Card! 🌟')
            .setDescription(`**${card.name}** is ready to be morphed! Select an attribute to transform:\n\n🔮 **Version** (v)\n🎨 **Series**\n📝 **Name**\n🎭 **Frame**\n\nThis will cost **250 gold**.`)
            .setColor('#FFD700')
            .setThumbnail(card.img_url)
            .setFooter({ text: 'Make your selection within 1 minute.' })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('morph_version').setLabel('Morph Version').setStyle(ButtonStyle.Primary).setEmoji('🔮'),
                new ButtonBuilder().setCustomId('morph_series').setLabel('Morph Series').setStyle(ButtonStyle.Primary).setEmoji('🎨'),
                new ButtonBuilder().setCustomId('morph_name').setLabel('Morph Name').setStyle(ButtonStyle.Primary).setEmoji('📝'),
                new ButtonBuilder().setCustomId('morph_frame').setLabel('Morph Frame').setStyle(ButtonStyle.Primary).setEmoji('🎭')
            );

        const morphMessage = await message.channel.send({ embeds: [morphEmbed], components: [row] });

        const filter = i => i.user.id === message.author.id;
        const collector = morphMessage.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async interaction => {
            await interaction.deferUpdate();

            if (!interaction.customId.startsWith('morph_')) return;

            const selectedMorph = interaction.customId.replace('morph_', '');

            // Step 2: Confirm Morph
            const confirmEmbed = new EmbedBuilder()
                .setTitle('Confirm Morph')
                .setDescription(`You have selected to morph the **${selectedMorph}** of **${card.name}**. This will cost **250 gold**.\n\nAre you sure?`)
                .setColor('#FFA500')
                .setThumbnail(card.img_url)
                .setTimestamp();

            const confirmRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId('confirm_morph').setLabel('Confirm').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('cancel_morph').setLabel('Cancel').setStyle(ButtonStyle.Danger)
                );

            await morphMessage.edit({ embeds: [confirmEmbed], components: [confirmRow] });

            const confirmCollector = morphMessage.createMessageComponentCollector({ filter, time: 60000 });

            confirmCollector.on('collect', async confirmation => {
                await confirmation.deferUpdate();

                if (confirmation.customId === 'cancel_morph') {
                    return morphMessage.edit({ content: 'Morph process has been cancelled.', components: [] });
                }

                if (confirmation.customId === 'confirm_morph') {
                    if (userInventory.gold[0] < 250) {
                        return confirmation.followUp({ content: 'Not enough gold to complete the morph.' });
                    }

                    userInventory.gold[0] -= 250;
// Verificar si daily_stats y daily_morph existen antes de intentar actualizar
const increased = await fetchInventory(user.id)

if (!increased) {
    console.error('No se encontró el inventario del usuario.');
    return;
}

// Verificar si existe el campo `daily_stats` como un array
if (!Array.isArray(increased.daily_stats) || increased.daily_stats.length === 0) {
    // Si el array no existe o está vacío, inicializar con un objeto que contiene `daily_drops`
    increased.daily_stats = [{ daily_morph: 1 }];
} else {
    // Si ya existe, asegurarse de que `daily_drops` esté definido e incrementar su valor
    const stats = increased.daily_stats[0]; // Suponemos que trabajamos con el primer objeto del array
    stats.daily_drops = (stats.daily_morph || 0) + 1;
}

// Guardar los cambios en la base de datos
await increased.save();
console.log('Daily stats actualizado:', increased.daily_stats);

                    const newColorHex = generateHexCode();
                    switch (selectedMorph) {
                        case 'version':
                            card.last_color_letter = newColorHex;
                            break;
                        case 'series':
                            card.last_color_letter_series = newColorHex;
                            break;
                        case 'name':
                            card.last_color_letter_name = newColorHex;
                            break;
                        case 'frame':
                            card.last_morph = getRandomFrame();
                            break;
                    }

                    await updateInventory(userId, userInventory);

                    const updatedCanvas = await drawCardPreview(card, selectedMorph);
                    const updatedAttachment = new AttachmentBuilder(updatedCanvas.toBuffer(), { name: 'updated_morphed_card.png' });

                    const rerollEmbed = new EmbedBuilder()
                        .setTitle('Reroll Your Morph?')
                        .setDescription(`You morphed **${selectedMorph}**. Do you want to reroll for a different outcome?`)
                        .setColor('#1E90FF')
                        .setImage('attachment://updated_morphed_card.png')
                        .setTimestamp();

                    const rerollRow = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder().setCustomId('reroll_morph').setLabel('Reroll').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId('keep_morph').setLabel('Keep').setStyle(ButtonStyle.Success)
                        );

                    await confirmation.followUp({
                        embeds: [rerollEmbed],
                        files: [updatedAttachment],
                        components: [rerollRow]
                    });

                    const rerollCollector = morphMessage.createMessageComponentCollector({ filter, time: 120000 });

                    rerollCollector.on('collect', async rerollInteraction => {
                        await rerollInteraction.deferUpdate();

                        if (rerollInteraction.customId === 'reroll_morph') {
                            const rerollColorHex = generateHexCode();

                            switch (selectedMorph) {
                                case 'version':
                                    card.last_color_letter = rerollColorHex;
                                    break;
                                case 'series':
                                    card.last_color_letter_series = rerollColorHex;
                                    break;
                                case 'name':
                                    card.last_color_letter_name = rerollColorHex;
                                    break;
                                case 'frame':
                                    card.last_morph = getRandomFrame();
                                    break;
                            }

                            await updateInventory(userId, userInventory);

                            const rerollCanvas = await drawCardPreview(card, selectedMorph);
                            const rerollAttachment = new AttachmentBuilder(rerollCanvas.toBuffer(), { name: 'rerolled_card.png' });

                            await rerollInteraction.followUp({
                                content: 'Your morph was rerolled successfully!',
                                files: [rerollAttachment]
                            });
                        } else if (rerollInteraction.customId === 'keep_morph') {
                            await rerollInteraction.followUp({ content: 'You kept your current morph.', components: [] });
                        }
                    });
                }
            });
        });
    }
};
