const { EmbedBuilder, ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { fetchInventory, updateInventory, addCardToInventory, AnimeCharacter } = require('./database/database');
const { createCanvas, loadImage } = require('canvas');
const Canvas = require('canvas');

Canvas.registerFont('./commands/fonts/BebasNeue-Regular.ttf', { family: 'Bebas Neue' });

function generateRandomCode(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length }, () => characters.charAt(Math.floor(Math.random() * characters.length))).join('');
}

async function createCardCanvas(character) {
    const cardWidth = 350;
    const cardHeight = 550;
    const halloweenFrameUrl = 'https://yashin.nyc3.cdn.digitaloceanspaces.com/Dark_Orange.png';

    const canvas = createCanvas(cardWidth, cardHeight);
    const context = canvas.getContext('2d');

    context.fillStyle = '#36393F';
    context.fillRect(0, 0, canvas.width, canvas.height);

    if (character.img_url) {
        try {
            const characterImage = await loadImage(character.img_url);
            context.drawImage(characterImage, 10, 10, cardWidth - 20, cardHeight - 20);
        } catch (error) {
            console.error(`Error loading image for character ${character._id}:`, error);
        }
    }

    try {
        const frameImg = await loadImage(halloweenFrameUrl);
        context.drawImage(frameImg, 0, 0, cardWidth, cardHeight);
    } catch (error) {
        console.error(`Error loading Halloween frame image from URL ${halloweenFrameUrl}:`, error);
    }

    // Cambiar color del texto a blanco y ajustar posición del nombre y serie
    context.fillStyle = '#FFFFFF';

    context.font = 'bold 25px "Bebas Neue"';
    context.fillText(character.name.slice(0, 14) + (character.name.length > 15 ? '-' : ''), 90, cardHeight - 50);

    wrapText(context, character.series.slice(0, 15) + (character.series.length > 16 ? '-' : ''), 90, cardHeight - 20, cardWidth - 40, 24);

    return canvas.toBuffer();
}

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

async function createPackCanvas(cards) {
    const cardWidth = 350;
    const cardHeight = 550;
    const spacing = 20;
    const maxCards = 5;  // Limitar a 5 cartas
    const canvasWidth = (cardWidth + spacing) * maxCards;
    const canvasHeight = cardHeight;

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const context = canvas.getContext('2d');

    for (let i = 0; i < Math.min(cards.length, maxCards); i++) {
        const character = cards[i];
        const cardCanvas = await createCardCanvas(character);
        const cardImage = await loadImage(cardCanvas);
        context.drawImage(cardImage, i * (cardWidth + spacing), 0, cardWidth, cardHeight);
    }

    return canvas.toBuffer();
}

async function getRandomCharacterIds() {
    const ids = [];
    while (ids.length < 5) {
        const randomId = Math.floor(Math.random() * (200200 - 200000 + 1)) + 200000;
        if (!ids.includes(randomId)) {
            ids.push(randomId);
        }
    }
    return ids;
}

async function getValidCharacter(id) {
    return await AnimeCharacter.findById(id) || null;
}

async function getValidCharacters(ids) {
    const validCharacters = [];
    for (const id of ids) {
        const character = await getValidCharacter(id);
        if (character) {
            validCharacters.push(character);
        }
    }
    return validCharacters;
}

module.exports = {
    name: 'pack',
    description: 'Open a pack and receive random Halloween cards if you have at least 1 witch_dust.',
    async run(message) {
        try {
            const inventory = await fetchInventory(message.author.id);
            const witchDustCount = inventory?.witch_dust || 0;

            if (witchDustCount < 1) {
                return message.channel.send('❗ **You need at least 1 Witch Dust to open a pack!**');
            }

            inventory.witch_dust -= 1;

            const randomIds = await getRandomCharacterIds();
            const randomCards = await getValidCharacters(randomIds);

            while (randomCards.length < 5) {
                const moreIds = await getRandomCharacterIds();
                const moreCards = await getValidCharacters(moreIds);
                randomCards.push(...moreCards);
            }

            // Función para asignar una rareza aleatoria
            const rarityLevels = ['bad', 'mid', 'good', 'perfect', 'legendary'];
            function assignRandomRarity() {
                return rarityLevels[Math.floor(Math.random() * rarityLevels.length)];
            }

            // Función para generar un código de carta entre 3 y 7 caracteres
            function generateRandomCode(length) {
                const codeLength = Math.floor(Math.random() * (7 - 3 + 1)) + 3;
                const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                let code = '';
                for (let i = 0; i < codeLength; i++) {
                    code += characters.charAt(Math.floor(Math.random() * characters.length));
                }
                return code;
            }

            randomCards.forEach(card => {
                card.code = generateRandomCode();
                card.rarity = assignRandomRarity();
            });

            const packCanvasBuffer = await createPackCanvas(randomCards);
            const attachment = new AttachmentBuilder(packCanvasBuffer, { name: 'pack.webp' });

            const embed = new EmbedBuilder()
                .setTitle('🎃 Choose Your Halloween Card 🎃')
                .setDescription('You received 5 random cards! Select one to add to your inventory.')
                .setColor('#FF4500')
                .setImage('attachment://pack.webp')
                .setTimestamp();

            const actionRow = new ActionRowBuilder();
            const emojiList = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

            randomCards.forEach((card, index) => {
                const emoji = emojiList[index];
                if (emoji) {
                    const button = new ButtonBuilder()
                        .setCustomId(`select_card_${index}`)
                        .setEmoji(emoji)
                        .setStyle(ButtonStyle.Primary);
                    actionRow.addComponents(button);
                }
            });

            const messageWithCards = await message.channel.send({
                embeds: [embed],
                files: [attachment],
                components: [actionRow],
            });

            const filter = (i) => i.user.id === message.author.id;
            const collector = messageWithCards.createMessageComponentCollector({ filter, time: 60000, max: 1 });

            collector.on('collect', async (interaction) => {
                const selectedCardIndex = parseInt(interaction.customId.split('_')[2]);
                const selectedCard = randomCards[selectedCardIndex];

                await AnimeCharacter.findByIdAndUpdate(selectedCard._id, { $inc: { __v: 1 } });

                // Agregar la carta seleccionada al array `cards` del inventario con `default_frame` y rareza aleatoria
                inventory.cards.push({
                    _id: selectedCard._id,
                    name: selectedCard.name,
                    series: selectedCard.series,
                    img_url: selectedCard.img_url,
                    rarity: selectedCard.rarity,
                    code: selectedCard.code,
                    __v: selectedCard.__v,
                    packed_on: new Date(),
                    grabbed_by: message.author.id,
                    channel_id: message.channel.id,
                    guild_id: message.guild.id,
                    default_frame: 'https://yashin.nyc3.cdn.digitaloceanspaces.com/Dark_Orange.png',
                    morph_apply: "",
                    last_morph: "",
                    color_letter_name: "",
                    last_color_letter_name: "",
                    last_color_letter_series: "",
                    color_letter_series: "",
                    last_color_letter: "",
                    color_letter: "",
                    scratch: true,
                    event: "Halloween 2024"
                });

                await updateInventory(message.author.id, inventory);

                await interaction.reply(`✨ **You selected:** ${selectedCard.name} (Rarity: ${selectedCard.rarity}). It's now in your inventory!`);
            });

            collector.on('end', (collected) => {
                if (collected.size === 0) {
                    message.channel.send('❗ **Time is up! You didn\'t select a card.**');
                }
            });
        } catch (error) {
            console.error('Error in pack command:', error);
            message.channel.send('❗ **An error occurred while processing your request. Please try again later.**');
        }
    },
};
