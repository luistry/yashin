const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageAttachment } = require('discord.js');
const { fetchInventory, updateInventory, fetchCharacterById } = require('./database/database');
const { createCanvas, loadImage } = require('canvas'); // Ensure you have canvas installed
const Canvas = require('canvas');
Canvas.registerFont('./commands/fonts/BebasNeue-Regular.ttf', { family: 'Bebas Neue' });

// Function to create card canvas
async function createCardCanvas(character) {
    const cardWidth = 350;
    const cardHeight = 550;
    const default_frame = character.default_frame?.replace(/^['"]|['"]$/g, ''); 

    const canvas = createCanvas(cardWidth, cardHeight);
    const context = canvas.getContext('2d');

    // Fill background
    context.fillStyle = '#36393F';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Load character image
    if (character.img_url) {
        try {
            const characterImage = await loadImage(character.img_url);
            context.drawImage(characterImage, 10, 10, cardWidth - 20, cardHeight - 20);
        } catch (error) {
            console.error(`Error loading image for character ${character._id}:`, error);
        }
    }

    // Load frame image
    if (default_frame && /^https?:\/\//i.test(default_frame)) {
        try {
            const frameImg = await loadImage(default_frame);
            context.drawImage(frameImg, 0, 0, cardWidth, cardHeight);
        } catch (error) {
            console.error(`Error loading frame image from URL ${default_frame}:`, error);
        }
    }

    // Draw text
    context.fillStyle = character.color_letter || '#000000';
    context.font = 'bold 22px "Bebas Neue"';
    context.fillText(`#${character.__v}`, cardWidth / 2, cardHeight - 84);

    context.fillStyle = character.color_letter_name || '#000000';
    context.font = 'bold 30px "Bebas Neue"';
    context.fillText(character.name.slice(0, 14) + (character.name.length > 15 ? '-' : ''), cardWidth / 2, cardHeight - 50);

    context.fillStyle = character.color_letter_series || '#000000';
    wrapText(context, character.series.slice(0, 15) + (character.series.length > 16 ? '-' : ''), cardWidth / 2, cardHeight - 20, cardWidth - 40, 24);

    return canvas;
}

// Helper function to wrap text
function wrapText(context, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let lineY = y;

    for (const word of words) {
        const testLine = line + word + ' ';
        if (context.measureText(testLine).width > maxWidth && line) {
            context.fillText(line, x, lineY);
            line = word + ' ';
            lineY += lineHeight;
        } else {
            line = testLine;
        }
    }
    context.fillText(line, x, lineY);
}

// Function to get a random rarity
function getRandomRarity() {
    const rarities = ['Bad', 'Good', 'Mid', 'Perfect', 'Legendary'];
    return rarities[Math.floor(Math.random() * rarities.length)];
}

// Function to generate a random code
function generateRandomCode(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

module.exports = {
    name: 'pack',
    description: 'Open a pack and receive a random Halloween card if you have at least 1 witch_dust.',
    async run(message) {
        try {
            // Fetch the user's inventory
            const inventory = await fetchInventory(message.author.id);
            const witchDustCount = inventory?.witch_dust || 0;

            // Check if the user has enough witch dust
            if (witchDustCount < 1) {
                return message.channel.send('❗ **You need at least 1 Witch Dust to open a pack!**');
            }

            // Deduct witch dust
            inventory.witch_dust -= 1;

            // Generate random card ID for Halloween cards (200000 to 200100)
            const cardId = Math.floor(Math.random() * 101) + 200000;

            // Fetch character details
            const character = await fetchCharacterById(cardId);
            if (!character) {
                return message.channel.send('❌ **Character not found!**');
            }

            // Create new card object
            const newCard = {
                id: cardId,
                name: character.name || `Halloween Card #${cardId}`,
                __v: character.__v || 0,
                rarity: getRandomRarity(), // Assign random rarity
                code: generateRandomCode(8) // Generate random code of length 8
            };

            // Add new card to inventory
            inventory.cards.push(newCard);

            // Update inventory in database
            await updateInventory(message.author.id, inventory);

            // Create card image
            const canvas = await createCardCanvas(character);
            const attachment = new MessageAttachment(canvas.toBuffer(), 'halloween_card.png');

            // Create and send an embed message
            const embed = new EmbedBuilder()
                .setTitle('🎉 You opened a Halloween Pack! 🎉')
                .setDescription(`✨ You received: **${newCard.name}** (ID: **${newCard.id}**)\n**Rarity:** ${newCard.rarity}\n**Code:** ${newCard.code}`)
                .setColor('#FF4500')
                .setImage('attachment://halloween_card.png')
                .setTimestamp()
                .setFooter({ text: `Witch Dust Remaining: ${inventory.witch_dust}`, iconURL: message.author.displayAvatarURL() });

            const sentMessage = await message.channel.send({ embeds: [embed], files: [attachment] });

            // React to the message
            await sentMessage.react('🎊');
            await sentMessage.react('🃏');

            // Button to open another pack
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('open_another_pack')
                        .setLabel('Open Another Pack')
                        .setStyle(ButtonStyle.Primary)
                );

            await message.channel.send({ content: 'Want to open another pack?', components: [row] });

            // Handle button interactions
            const filter = (i) => i.customId === 'open_another_pack' && i.user.id === message.author.id;
            const collector = message.channel.createMessageComponentCollector({ filter, time: 60000 });

            collector.on('collect', async (i) => {
                await this.run(i.message);
                await i.deferUpdate();
            });

            collector.on('end', () => {
                message.channel.send('⏳ Time is up! You can open more packs anytime!');
            });

        } catch (error) {
            console.error('Error opening pack:', error);
            message.channel.send('❌ An error occurred while trying to open the pack.');
        }
    }
};
