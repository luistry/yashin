const { EmbedBuilder } = require('discord.js');
const { fetchInventory } = require('./database/database');
const Canvas = require('canvas');
const { createCanvas, loadImage } = require('canvas');
const fetch = require('node-fetch');

const frameImageUrl = 'https://frame-yashin.b-cdn.net/Frame_Default_Yashin.png';

async function fetchImage(url) {
    if (!/^https?:\/\//i.test(url)) {
        throw new Error('Invalid URL');
    }

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error('Failed to fetch image');
    }

    return response.buffer();
}

Canvas.registerFont('./commands/fonts/BebasNeue-Regular.ttf', { family: 'Bebas Neue' });

async function createCardCanvas(character) {
    const cardWidth = 350;
    const cardHeight = 550;

    // Load the frame image
    const frameImage = await fetchImage(frameImageUrl);

    // Create a temporary canvas for the frame
    const frameCanvas = createCanvas(cardWidth, cardHeight);
    const frameContext = frameCanvas.getContext('2d');
    const frameImg = await loadImage(frameImage);
    frameContext.drawImage(frameImg, 0, 0, cardWidth, cardHeight);

    // Create the main canvas for the card
    const canvas = createCanvas(cardWidth, cardHeight);
    const context = canvas.getContext('2d');
    context.fillStyle = '#36393F';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Draw the character image if available
    if (character.img_url) {
        try {
            const characterImage = await loadImage(character.img_url);
            context.globalAlpha = 1.0; // Ensure full opacity
            context.drawImage(characterImage, 10, 10, cardWidth - 20, cardHeight - 20);
        } catch (error) {
            console.error(`Error loading image for character ${character._id}:`, error);
        }
    }

    // Draw the frame with transparency over the card
    context.drawImage(frameCanvas, 0, 0, cardWidth, cardHeight);

    // Draw the version number
    context.font = 'bold 22px "Bebas Neue"';
    context.fillStyle = '#000000'; // Black text
    context.textAlign = 'center';
    context.fillText(`#${character.__v}`, cardWidth / 2, cardHeight - 84);

    // Draw the character name
    context.font = 'bold 30px "Bebas Neue"';
    context.fillStyle = '#000000'; // Black text
    context.textAlign = 'center';

    let characterName = character.name.length > 15 ? character.name.slice(0, 14) + '-' : character.name;
    const nameY = cardHeight - 50; // Adjusted Y position for the name
    context.fillText(characterName, cardWidth / 2, nameY);

    // Draw the series name
    context.font = '24px "Bebas Neue"';
    context.fillStyle = '#000000'; // Black text
    let seriesText = character.series.length > 16 ? character.series.slice(0, 15) + '-' : character.series;

    const seriesY = nameY + 30; // Ensure it doesn't overlap with the name
    wrapText(context, seriesText, cardWidth / 2, seriesY, cardWidth - 40, 24);

    return canvas;
}

// Helper function para el ajuste del texto
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
    name: 'viewlast',
    description: 'View the last card from your collection',
    async run(message) {
        try {
            const userId = message.author.id;

            // Fetch inventory for the user
            const inventory = await fetchInventory(userId);
            const cards = inventory ? inventory.cards : [];

            if (cards.length === 0) {
                return message.channel.send('You don\'t have any cards in your collection.');
            }

            const card = cards[cards.length - 1];

            const canvas = await createCardCanvas(card);
            const finalImageBuffer = canvas.toBuffer();
   const rarityInitial = card.rarity ? card.rarity.charAt(0).toUpperCase() : 'Unknown';
            const embed = new EmbedBuilder()
                .setColor('#36393F') // Gray color
                .setTitle(`Viewing ${card.name}`)
                .setAuthor({
                    name: `Viewing a card of ${message.author.username}`,
                    iconURL: message.author.displayAvatarURL({ format: 'png', dynamic: true, size: 128 })
                })
               .setDescription(`\`${card.code}\` • \`${card.name}\` • \`${card.series}\` • \`#${card.__v}\` • \`${rarityInitial}\``)

                .setImage('attachment://card.png')
                .setTimestamp();

            await message.channel.send({
                embeds: [embed],
                files: [{ attachment: finalImageBuffer, name: 'card.png' }]
            });

        } catch (error) {
            console.error('Error fetching inventory or generating image:', error);
            message.channel.send('An error occurred while trying to view the card.');
        }
    }
};
