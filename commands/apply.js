const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { fetchInventory, applyFrameToCard } = require('./database/database');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fetch = require('node-fetch');

async function fetchImage(url) {
    if (!/^https?:\/\//i.test(url)) {
        throw new Error('Invalid URL');
    }

    // Detecta si la URL pertenece a DigitalOcean y sigue redirecciones
    const isDigitalOcean = url.includes('digitaloceanspaces.com');
    const response = await fetch(url, { redirect: 'follow' });

    if (!response.ok) {
        throw new Error('Failed to fetch image');
    }

    // Valida el tipo de contenido si es una URL de DigitalOcean
    const contentType = response.headers.get('content-type');
    if (isDigitalOcean && !['image/png', 'image/jpeg', 'image/webp'].includes(contentType)) {
        throw new Error(`Unsupported content type: ${contentType}`);
    }

    return response.buffer();
}
async function createCardCanvas(character, frameImageUrl, frameName) {
    const cardWidth = 350;
    const cardHeight = 550;

    // Carga la imagen del marco si se proporciona
    const frameImage = frameImageUrl ? await fetchImage(frameImageUrl) : null;

    // Determina los colores de los textos según el marco
    const isDarkOrangeFrame = frameName.toLowerCase() === 'dark orange frame'; // Ejemplo de detección de un marco específico
    const colorLetterName = isDarkOrangeFrame ? '#FFFFFF' : (character.color_letter_name || '#000000');
    const colorLetterSeries = isDarkOrangeFrame ? '#FFFFFF' : (character.color_letter_series || '#000000');
    const colorLetter = isDarkOrangeFrame ? '#FFFFFF' : (character.color_letter || '#000000');

    // Crear el canvas principal para la carta
    const canvas = createCanvas(cardWidth, cardHeight);
    const context = canvas.getContext('2d');
    context.fillStyle = '#36393F';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Dibujar la imagen del personaje si está disponible
    if (character.img_url) {
        try {
            const characterImageBuffer = await fetchImage(character.img_url);
            const characterImage = await loadImage(characterImageBuffer);
            context.globalAlpha = 1.0;
            context.drawImage(characterImage, 10, 10, cardWidth - 20, cardHeight - 20);
        } catch (error) {
            console.error(`Error loading image for character ${character._id}:`, error);
        }
    }

    // Dibujar el marco con transparencia sobre la carta si se proporciona
    if (frameImage) {
        const frameCanvas = createCanvas(cardWidth, cardHeight);
        const frameContext = frameCanvas.getContext('2d');
        const frameImg = await loadImage(frameImage);
        frameContext.drawImage(frameImg, 0, 0, cardWidth, cardHeight);
        context.drawImage(frameCanvas, 0, 0, cardWidth, cardHeight);
    }

    // Dibujar el número de versión (`__v`)
    context.fillStyle = colorLetter;
    context.font = 'bold 22px "Bebas Neue"';
    context.textAlign = 'center';
    context.fillText(`#${character.__v}`, cardWidth / 2, cardHeight - 84);

    // Dibujar el nombre del personaje
    context.fillStyle = colorLetterName;
    context.font = 'bold 30px "Bebas Neue"';
    const characterName = character.name.length > 15 ? character.name.slice(0, 14) + '-' : character.name;
    context.fillText(characterName, cardWidth / 2, cardHeight - 50);

    // Dibujar el nombre de la serie
    context.fillStyle = colorLetterSeries;
    context.font = '24px "Bebas Neue"';
    const seriesText = character.series.length > 16 ? character.series.slice(0, 15) + '-' : character.series;
    wrapText(context, seriesText, cardWidth / 2, cardHeight - 20, cardWidth - 40, 24);

    // Devuelve el buffer de la imagen en formato webp
    return canvas.toBuffer('image/webp');
}

// Función auxiliar para ajustar el texto
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
    name: 'apply',
    description: 'Apply a frame to a card and view a preview.',
    async run(message, args) {
        if (args.length < 2) {
            return message.channel.send('Please provide both the frame name and the card code.');
        }

        const frameNameInput = args.slice(0, -1).join(' ').toLowerCase().trim();
        const cardCode = args[args.length - 1];

        const userId = message.author.id;
        const userInventory = await fetchInventory(userId);

        if (!userInventory) {
            return message.channel.send('Could not fetch your inventory.');
        }

        // Find the frame, ensuring case-insensitive match
        const frame = userInventory.Frames.find(f => f.name.toLowerCase().trim() === frameNameInput);
        if (!frame) {
            return message.channel.send('Frame not found in your inventory.');
        }

        const card = userInventory.cards.find(c => c.code === cardCode);
        if (!card) {
            return message.channel.send('Card not found in your inventory.');
        }

        // Create a canvas with the card and the frame applied
        const frameCanvasBuffer = await createCardCanvas(card, frame.image, frame.name);

        // Create a single embed with the applied frame preview
        const embed = new EmbedBuilder()
            .setColor(frame.color_letter || '#BEC2CB') // Use color_letter from frame or default gray
            .setTitle(`Preview: Applying Frame to ${card.name}`)
            .setDescription(`Card code: **${cardCode}**\n\n**Preview:**\nFrame **${frame.name}** will be applied to the card.`)
            .setImage('attachment://card_final.webp');

        // Create buttons for user action
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`confirm_${userId}_${cardCode}_${frameNameInput}`)
                    .setLabel('Confirm')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`cancel_${userId}_${cardCode}_${frameNameInput}`)
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Danger)
            );

        // Send preview with buttons
        const sentMessage = await message.channel.send({
            embeds: [embed],
            files: [{ attachment: frameCanvasBuffer, name: 'card_final.webp' }],
            components: [row]
        });

        // Create a collector to handle button interactions
        const filter = interaction => {
            return interaction.isButton() && interaction.user.id === userId;
        };

        const collector = message.channel.createMessageComponentCollector({ filter, time: 60000 }); // 1 minute timeout

        collector.on('collect', async (interaction) => {
            if (interaction.customId.startsWith('confirm_')) {
                const [_, collectorUserId, collectorCardCode, collectorFrameName] = interaction.customId.split('_');

                if (collectorUserId === userId && collectorCardCode === cardCode && collectorFrameName === frameNameInput) {
                    // Apply the frame to the card and update the inventory
                    const success = await applyFrameToCard(userId, cardCode, frameNameInput);
                    if (success) {
                        await interaction.update({ content: 'Frame applied successfully.', components: [] });
                    } else {
                        await interaction.update({ content: 'Failed to apply the frame.', components: [] });
                    }
                }
            } else if (interaction.customId.startsWith('cancel_')) {
                await interaction.update({ content: 'Frame application cancelled.', components: [] });
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                sentMessage.edit({ components: [] }); // Remove buttons after timeout
            }
        });
    }
};
