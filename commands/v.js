const { EmbedBuilder } = require('discord.js');
const { fetchAllInventories } = require('./database/database');
const Canvas = require('canvas');
const { createCanvas, loadImage } = require('canvas');
const fetch = require('node-fetch');

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

    // Load the frame image from the default_frame property
    const frameImageUrl = character.default_frame;

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

    // Draw the frame with transparency over the card if provided
    if (frameImageUrl) {
        try {
            const frameImg = await loadImage(frameImageUrl);
            context.drawImage(frameImg, 0, 0, cardWidth, cardHeight);
        } catch (error) {
            console.error(`Error loading frame image:`, error);
        }
    }

    // Determine text colors based on color_letter fields
    const colorLetterName = character.color_letter_name || '#000000'; // Default to black if not provided
    const colorLetterSeries = character.color_letter_series || '#000000'; // Default to black if not provided
    const colorLetter = character.color_letter || '#000000'; // Default to black if not provided

    // Draw the version number
    context.font = 'bold 22px "Bebas Neue"';
    context.fillStyle = colorLetter; // Use color_letter for version number
    context.textAlign = 'center';
    context.fillText(`#${character.__v}`, cardWidth / 2, cardHeight - 84);

    // Draw the character name with the corresponding color
    context.font = 'bold 30px "Bebas Neue"';
    context.fillStyle = colorLetterName; // Use color_letter_name for character name
    context.textAlign = 'center';

    let characterName = character.name.length > 15 ? character.name.slice(0, 14) + '-' : character.name;
    const nameY = cardHeight - 50; // Adjusted Y position for the name
    context.fillText(characterName, cardWidth / 2, nameY);

    // Draw the series name with the corresponding color
    context.font = '24px "Bebas Neue"';
    context.fillStyle = colorLetterSeries; // Use color_letter_series for series name
    let seriesText = character.series.length > 16 ? character.series.slice(0, 15) + '-' : character.series;

    const seriesY = nameY + 30; // Ensure it doesn't overlap with the name
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
    name: 'v',
    description: 'View details of a specific card from the collection',
    async run(message, args) {
        try {
            const cardCode = args.join(' ').trim();

            // Fetch all inventories
            const allInventories = await fetchAllInventories();

            // Find the card across all inventories
            let card = null;
            let cardOwner = null;

            for (const inventory of allInventories) {
                card = inventory.cards.find(c => c.code === cardCode);
                if (card) {
                    // Using _id to represent the card owner
                    cardOwner = inventory._id || 'Unknown'; 
                    break;
                }
            }

            if (!card) {
                return message.channel.send('Card not found. Please check the code and try again.');
            }

            const canvas = await createCardCanvas(card);
            const finalImageBuffer = canvas.toBuffer();
            const rarityInitial = card.rarity ? card.rarity.charAt(0).toUpperCase() : 'Unknown';

            const embed = new EmbedBuilder()
                .setColor('#BEC2CB') // Gray color
                .setTitle(`Viewing ${card.name}`)
                .setAuthor({
                    name: `Viewing card`,
                    iconURL: message.author.displayAvatarURL({ format: 'png', dynamic: true }),
                })
                .setDescription(
                    `\`${card.code}\` • \`${card.name}\` • \`${card.series}\` • \`#${card.__v}\` • \`${rarityInitial}\`\n**Card Owner**: <@${cardOwner}>`
                ) // Displays the owner correctly using _id
                .setImage('attachment://card.png');

            await message.channel.send({
                embeds: [embed],
                files: [{ attachment: finalImageBuffer, name: 'card.png' }]
            });
        } catch (error) {
            console.error(error);
            message.channel.send('An error occurred while processing the request.');
        }
    }
};
