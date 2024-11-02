const { EmbedBuilder } = require('discord.js');
const { fetchInventory } = require('./database/database');
const Canvas = require('canvas');
const { createCanvas, loadImage } = require('canvas');
const fetch = require('node-fetch');

const frameImageUrl = 'https://yashin.nyc3.cdn.digitaloceanspaces.com/frames/Frame_Default_Yashin.png';

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
    const canvas = createCanvas(cardWidth, cardHeight);
    const context = canvas.getContext('2d');

    context.fillStyle = '#36393F';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Load and draw character image
    if (character.img_url) {
        try {
            const characterImage = await loadImage(character.img_url);
            context.globalAlpha = 1.0;
            context.drawImage(characterImage, 10, 10, cardWidth - 20, cardHeight - 20);
        } catch (error) {
            console.error(`Error loading image for character ${character._id}:`, error);
        }
    }

    // Draw the frame
    const default_frame = character.default_frame && character.default_frame.replace(/^['"]|['"]$/g, '');
    if (default_frame && /^https?:\/\//i.test(default_frame)) {
        try {
            const frameImg = await loadImage(default_frame);
            context.drawImage(frameImg, 0, 0, cardWidth, cardHeight);
        } catch (error) {
            console.error(`Error loading frame image from URL ${default_frame}:`, error);
        }
    }

    // Determine text colors based on frame type
    const isDarkOrangeFrame = (default_frame === 'https://yashin.nyc3.cdn.digitaloceanspaces.com/Dark_Orange.png');
    const colorLetterName = isDarkOrangeFrame ? '#FFFFFF' : (character.color_letter_name || '#000000');
    const colorLetterSeries = isDarkOrangeFrame ? '#FFFFFF' : (character.color_letter_series || '#000000');
    const colorLetter = isDarkOrangeFrame ? '#FFFFFF' : (character.color_letter || '#000000');

    // Draw the version number and character name
    context.fillStyle = colorLetter;
    context.font = 'bold 22px "Bebas Neue"';
    context.textAlign = 'center';
    if (!isDarkOrangeFrame) {
        context.fillText(`#${character.__v}`, cardWidth / 2, cardHeight - 84);
    }

    context.fillStyle = colorLetterName;
    const characterName = character.name.length > 15 ? character.name.slice(0, 14) + '-' : character.name;
    const nameY = cardHeight - 50;
    context.fillText(characterName, cardWidth / 2, nameY);

    // Draw series name
    context.fillStyle = colorLetterSeries;
    const seriesText = character.series.length > 16 ? character.series.slice(0, 15) + '-' : character.series;
    wrapText(context, seriesText, cardWidth / 2, nameY + 30, cardWidth - 40, 24);

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

            const card = cards[cards.length - 1]; // Get the last card

            const canvas = await createCardCanvas(card);
            const finalImageBuffer = canvas.toBuffer();
            const rarityInitial = card.rarity ? card.rarity.charAt(0).toUpperCase() : 'Unknown';
            const __v = card.scratch ? 'Halloween 2024 🎃' : (card.__v !== undefined ? card.__v : 'Unknown');

            const embed = new EmbedBuilder()
                .setColor('#BEC2CB')
                .setTitle(`Viewing ${card.name}`)
                .setAuthor({
                    name: `Viewing card`,
                    iconURL: message.author.displayAvatarURL({ format: 'png', dynamic: true }),
                })
                .setDescription(
                    `\`${card.code}\` • \`${card.name}\` • \`${card.series}\` • \`${__v}\` • \`${rarityInitial}\``
                )
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
