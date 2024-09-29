const { EmbedBuilder } = require('discord.js');
const { fetchAllInventories } = require('./database/database');
const Canvas = require('canvas');
const { createCanvas, loadImage } = require('canvas');
const fetch = require('node-fetch');

// URL of the default frame image
const defaultFrameImageUrl = 'https://yashin.nyc3.cdn.digitaloceanspaces.com/frames/Frame_Default_Yashin.png';

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

async function createCardCanvas(character, frameImageUrl, frameName) {
    const cardWidth = 350;
    const cardHeight = 550;

    // Load the frame image if provided, or use the default frame
    const frameImage = frameImageUrl
        ? await fetchImage(frameImageUrl)
        : await fetchImage(defaultFrameImageUrl); // Default frame if no frame provided

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
    if (frameImage) {
        const frameCanvas = createCanvas(cardWidth, cardHeight);
        const frameContext = frameCanvas.getContext('2d');
        const frameImg = await loadImage(frameImage);
        frameContext.drawImage(frameImg, 0, 0, cardWidth, cardHeight);
        context.drawImage(frameCanvas, 0, 0, cardWidth, cardHeight);
    }

    // Determine text color based on frame name
    let textColor = '#000000'; // Default black text
    if (frameName === 'dragon shadow of the rock frame' || frameName === 'Starry Night Frame') {
        textColor = '#FFFFFF'; // White text for specified frames
    }

    // Draw the version number
    context.font = 'bold 22px "Bebas Neue"';
    context.fillStyle = textColor;
    context.textAlign = 'center';
    context.fillText(`#${character.__v}`, cardWidth / 2, cardHeight - 84);

    // Draw the character name
    context.font = 'bold 30px "Bebas Neue"';
    context.fillStyle = textColor;
    context.textAlign = 'center';

    let characterName = character.name.length > 15 ? character.name.slice(0, 14) + '-' : character.name;
    const nameY = cardHeight - 50; // Adjusted Y position for the name
    context.fillText(characterName, cardWidth / 2, nameY);

    // Draw the series name
    context.font = '24px "Bebas Neue"';
    context.fillStyle = textColor;
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
            let frameImageUrl = null;
            let frameName = null;

            for (const inventory of allInventories) {
                card = inventory.cards.find(c => c.code === cardCode);
                if (card) {
                    // Using _id to represent the card owner
                    cardOwner = inventory._id || 'Unknown'; 
                    // If the card has a frame, get the frame image and name
                    if (card.frame && card.frame.image_card) {
                        frameImageUrl = card.frame.image_card;
                        frameName = card.frame.name;
                    }
                    break;
                }
            }

            if (!card) {
                return message.channel.send('Card not found. Please check the code and try again.');
            }

            const canvas = await createCardCanvas(card, frameImageUrl, frameName);
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
