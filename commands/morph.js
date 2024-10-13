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
    const totalWeight = frameMorphs.reduce((acc, frame) => acc + frame.chance, 0);
    const random = Math.random() * totalWeight;
    let cumulativeChance = 0;

    for (const frame of frameMorphs) {
        cumulativeChance += frame.chance;
        if (random < cumulativeChance) {
            return frame;
        }
    }
    return frameMorphs[frameMorphs.length - 1];
}
async function drawCardPreview(card, morphType, retries = 3) {
    const cardWidth = 350;
    const cardHeight = 500;

    // Extraer el frame directamente de la carta y limpiar comillas adicionales si las hay
    const default_frame = card.last_morph || (card.default_frame && card.default_frame.replace(/^['"]|['"]$/g, ''));

    // Crear el canvas principal para la carta
    const canvas = createCanvas(cardWidth, cardHeight);
    const context = canvas.getContext('2d');
    context.fillStyle = '#36393F'; // Color de fondo
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Cargar la imagen de la carta si está disponible
    if (card.img_url) {
        try {
            const cardImage = await loadImage(card.img_url);
            const imgAspectRatio = cardImage.width / cardImage.height;
            const imgWidth = cardWidth - 50; // Margen
            const imgHeight = imgWidth / imgAspectRatio; // Mantener la proporción

            context.globalAlpha = 1.0; // Asegurarse de que sea opaco
            context.drawImage(cardImage, 25, 50, imgWidth, imgHeight); // Ajustar las posiciones
        } catch (error) {
            console.error(`Error loading image for card ${card._id}:`, error);
        }
    } else {
        console.error('No image URL available for card:', card);
    }

    // Dibujar el frame si está presente y es una URL válida
    if (default_frame && /^https?:\/\//i.test(default_frame)) {
        try {
            const frameImg = await loadImage(default_frame);
            const frameAspectRatio = frameImg.width / frameImg.height;
            let frameWidth = cardWidth;
            let frameHeight = cardHeight;

            // Mantener la proporción del frame
            if (frameAspectRatio > 1) {
                frameHeight = cardHeight; // Alto fijo
                frameWidth = cardHeight * frameAspectRatio; // Ajustar el ancho según la altura
            } else {
                frameWidth = cardWidth; // Ancho fijo
                frameHeight = cardWidth / frameAspectRatio; // Ajustar la altura según el ancho
            }

            // Dibujar el frame en el canvas
            context.drawImage(frameImg, (cardWidth - frameWidth) / 2, (cardHeight - frameHeight) / 2, frameWidth, frameHeight);
        } catch (error) {
            console.error(`Error loading frame image from URL ${default_frame}:`, error);
        }
    } else {
        console.error('Invalid frame image URL or missing frame:', default_frame);
    }

    // Determinar los colores de los textos según los campos color_letter
    const colorLetterName =  card.last_color_letter_name || '#000000'; // Default a negro
    const colorLetterSeries =  card.last_color_letter_series || '#000000'; // Default a negro
    const colorLetter =  card.last_color_letter || '#000000'; // Default a negro

    // Dibujar el número de versión
    context.font = 'bold 22px "Bebas Neue"';
    context.fillStyle = colorLetter; // Usar color_letter para el número de versión
    context.textAlign = 'center';
    context.fillText(`#${card.__v}`, cardWidth / 2, cardHeight - 84);

    // Dibujar el nombre del personaje con el color correspondiente
    context.font = 'bold 30px "Bebas Neue"';
    context.fillStyle = colorLetterName; // Usar color_letter_name para el nombre
    context.textAlign = 'center';

    let cardName = card.name.length > 15 ? card.name.slice(0, 14) + '-' : card.name;
    const nameY = cardHeight - 50; // Posición ajustada para el nombre
    context.fillText(cardName, cardWidth / 2, nameY);

    // Dibujar el nombre de la serie con el color correspondiente
    context.font = '24px "Bebas Neue"';
    context.fillStyle = colorLetterSeries; // Usar color_letter_series para la serie
    let seriesText = card.series.length > 16 ? card.series.slice(0, 15) + '-' : card.series;

    const seriesY = nameY + 30; // Asegurarse de que no se superponga con el nombre
    wrapText(context, seriesText, cardWidth / 2, seriesY, cardWidth - 40, 24);

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

        // Step 1: Choose what to morph
        const morphEmbed = new EmbedBuilder()
            .setTitle('🌟 Morph Your Card! 🌟')
            .setDescription(`**${card.name}** is ready to be morphed! Select an attribute to transform:\n\n🔮 **Version** (v)\n🎨 **Series**\n📝 **Name**\n🎭 **Frame**\n\nThis will cost **250 gold**.`)
            .setColor('#FFD700')
            .setThumbnail(card.img_url)
            .setFooter({ text: 'Make your selection within 1 minute.' })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('morph_version')
                    .setLabel('Morph Version')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🔮'),
                new ButtonBuilder()
                    .setCustomId('morph_series')
                    .setLabel('Morph Series')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🎨'),
                new ButtonBuilder()
                    .setCustomId('morph_name')
                    .setLabel('Morph Name')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📝'),
                new ButtonBuilder()
                    .setCustomId('morph_frame')
                    .setLabel('Morph Frame')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🎭')
            );

        const morphMessage = await message.channel.send({ embeds: [morphEmbed], components: [row] });

        const filter = i => i.user.id === message.author.id;
        const collector = morphMessage.createMessageComponentCollector({ filter, time: 60000 }); // 1 minuto

        collector.on('collect', async i => {
            await i.deferUpdate(); // Defer update to avoid interaction not replied error

            if (i.customId.startsWith('morph_')) {
                const selectedMorph = i.customId.replace('morph_', '');

                // Step 2: Ask for confirmation
                const confirmEmbed = new EmbedBuilder()
                    .setTitle('Confirm Morph')
                    .setDescription(`You have selected to morph the **${selectedMorph}** of **${card.name}**. This will cost **250 gold**.\n\nAre you sure?`)
                    .setColor('#FFA500') // Orange for confirmation
                    .setThumbnail(card.img_url)
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

                await morphMessage.edit({ embeds: [confirmEmbed], components: [confirmRow] });

                const confirmCollector = morphMessage.createMessageComponentCollector({ filter, time: 60000 }); // 1 minuto

                confirmCollector.on('collect', async interaction => {
                    await interaction.deferUpdate(); // Defer update to avoid interaction not replied error
                    if (interaction.customId === 'confirm_morph') {
                        // Generate and send card preview
                        const canvas = await drawCardPreview(card, selectedMorph);
                        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'morphed_card.png' });

                        // Second confirmation
                        const verifyEmbed = new EmbedBuilder()
                            .setTitle('Preview of Morph')
                            .setDescription(`Here is the preview of your morphed card:\n**${card.name}** (Morphed: **${selectedMorph}**)\n\nAre you sure you want to apply this morph?`)
                            .setColor('#1E90FF') // Blue for preview
                            .setImage('attachment://morphed_card.png') // Set the preview image
                            .setTimestamp();

                        const verifyRow = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId('reroll_morph')
                                    .setLabel('Reroll')
                                    .setStyle(ButtonStyle.Secondary),
                                new ButtonBuilder()
                                    .setCustomId('final_confirm_morph')
                                    .setLabel('Verify Morph')
                                    .setStyle(ButtonStyle.Success)
                            );

                        await interaction.followUp({ embeds: [verifyEmbed], files: [attachment], components: [verifyRow] });

                        const verifyCollector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 }); // 1 minuto

                        verifyCollector.on('collect', async verifyInteraction => {
                            await verifyInteraction.deferUpdate(); // Defer update to avoid interaction not replied error
                            if (verifyInteraction.customId === 'final_confirm_morph') {
                                // Deduct gold and apply the morph
                                userInventory.gold -= 250;

                                // Apply the morph
                                switch (selectedMorph) {
                                    case 'version':
                                       
                                        card.last_color_letter = generateHexCode(); // Store last color letter
                                        
                                        break;
                                    case 'series':
                                        card.last_color_letter_series = card.color_letter_series; // Store last color letter series
                                        card.color_letter_series = generateHexCode();
                                        break;
                                    case 'name':
                                        card.last_color_letter_name = card.color_letter_name; // Store last color letter name
                                        card.color_letter_name = generateHexCode();
                                        break;
                                    case 'frame':
                                        const randomFrame = getRandomFrame();
                                        card.last_morph = card.default_frame; // Store previous frame
                                        card.default_frame = randomFrame.url; // Apply new frame
                                        card.morph_apply = randomFrame.url; // Save applied morph
                                        break;
                                }

                                // Update the inventory
                                await updateInventory(userId, userInventory);

                                // Generate and send updated card preview
                                const updatedCanvas = await drawCardPreview(card, selectedMorph);
                                const updatedAttachment = new AttachmentBuilder(updatedCanvas.toBuffer(), { name: 'updated_morphed_card.png' });

                                await verifyInteraction.followUp({ content: 'Morph applied successfully!', files: [updatedAttachment] });
                            } else if (verifyInteraction.customId === 'reroll_morph') {
                                const newColorHex = generateHexCode();
                                
                                // Actualizar el color de la carta
                                card.color_letter = newColorHex; // Actualiza el color de la carta
                                
                                // Generar y enviar la vista previa de la carta después del reroll
                                const rerollCanvas = await drawCardPreview(card, selectedMorph);
                                const rerollAttachment = new AttachmentBuilder(rerollCanvas.toBuffer(), { name: 'rerolled_card.png' });

                                const rerollEmbed = new EmbedBuilder()
                                    .setTitle('Reroll Successful!')
                                    .setDescription(`New color applied: ${newColorHex}. Here is the updated preview of your card:`)
                                    .setColor('#32CD32') // Verde para el reroll
                                    .setImage('attachment://rerolled_card.png')
                                    .setTimestamp();

                                const rerollRow = new ActionRowBuilder()
                                    .addComponents(
                                        new ButtonBuilder()
                                            .setCustomId('reroll_morph')
                                            .setLabel('Reroll Again')
                                            .setStyle(ButtonStyle.Secondary),
                                        new ButtonBuilder()
                                            .setCustomId('final_confirm_morph')
                                            .setLabel('Verify Morph')
                                            .setStyle(ButtonStyle.Success)
                                    );

                                await verifyInteraction.followUp({ embeds: [rerollEmbed], files: [rerollAttachment], components: [rerollRow] });

                                verifyCollector.stop();
                                return;
                            }

                            // Switch for verify morph case
                            switch (selectedMorph) {
                                case 'version':
                                    // Handle specific logic for verifying version morph
                                    card.last_color_letter = card.last_color_letter
                                    break;
                                case 'series':
                                     card.last_color_letter_series = card.color_letter_series;
                                    
                                    break;
                                case 'name':
                                    card.last_color_letter_name = card.color_letter_name;
                                    break;
                                case 'frame':
                                    card.last_morph =  card.morph_apply;
                                    break;
                            }

                            verifyCollector.stop();
                        });
                    } else {
                        await interaction.followUp({ content: 'Morphing process canceled.' });
                    }

                    confirmCollector.stop();
                });
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                morphMessage.edit({ content: 'Interaction timed out.', components: [] });
            }
        });
    },
};
