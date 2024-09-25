const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { fetchInventory, applyFrameToCard } = require('./database/database');
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

async function createCardCanvas(character, frameImageUrl, frameName) {
    const cardWidth = 350;
    const cardHeight = 550;

    // Load the frame image if provided
    const frameImage = frameImageUrl ? await fetchImage(frameImageUrl) : null;

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

    // Determine text color and series name visibility based on frame name
    let textColor = '#FFFFFF'; // Default white text
    let showSeriesName = true; // Default to showing series name

    if (frameName.toLowerCase() === 'dragon shadow of the rock frame' || frameName.toLowerCase() === 'starry night') {
        textColor = '#FFFFFF'; // White text for these frames
    } else if (frameName.toLowerCase() === 'retro arcade frame') {
        textColor = '#E0FFFF'; // Blue text for retro arcade frame
        showSeriesName = false; // Hide series name for retro arcade frame
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

    // Draw the series name if applicable
    if (showSeriesName) {
        context.font = '24px "Bebas Neue"';
        context.fillStyle = textColor;
        let seriesText = character.series.length > 16 ? character.series.slice(0, 15) + '-' : character.series;

        const seriesY = nameY + 30; // Ensure it doesn't overlap with the name
        wrapText(context, seriesText, cardWidth / 2, seriesY, cardWidth - 40, 24);
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
        const frameCanvas = await createCardCanvas(card, frame.image, frame.name);
        const finalImageBuffer = frameCanvas.toBuffer();

        // Create a single embed with the applied frame preview
        const embed = new EmbedBuilder()
            .setColor(frame.color_letter || '#BEC2CB') // Use color_letter from frame or default gray
            .setTitle(`Preview: Applying Frame to ${card.name}`)
            .setDescription(`Card code: **${cardCode}**\n\n**Preview:**\nFrame **${frame.name}** will be applied to the card.`)
            .setImage('attachment://card_final.png');

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
            files: [{ attachment: finalImageBuffer, name: 'card_final.png' }],
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
