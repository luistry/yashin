const { EmbedBuilder } = require('discord.js');
const { fetchInventory, updateInventory } = require('./database/database');
const Canvas = require('canvas');
const { createCanvas, loadImage } = require('canvas');
const fetch = require('node-fetch');

module.exports = {
    name: 'g',
    description: 'Give a card to another user',
    async run(message, args) {
        try {
            const cardCode = args.pop();
            const mentionedUser = message.mentions.users.first();

            if (!mentionedUser || !cardCode) {
                return message.channel.send('Please mention a user and provide a valid card code.');
            }

            const giverId = message.author.id;
            const recipientId = mentionedUser.id;

            // Fetch the giver's inventory
            let giverInventory = await fetchInventory(giverId);
            if (!giverInventory) {
                return message.channel.send('Error fetching your inventory.');
            }

            // Backup giver's inventory before modifying it
            const giverInventoryBackup = JSON.parse(JSON.stringify(giverInventory));

            // Check if card exists in inventory
            const card = giverInventory.cards.find(c => c.code === cardCode);
            if (!card) {
                return message.channel.send('Card not found in your inventory. Please check the code and try again.');
            }

            // Preload the necessary font for the card canvas
            Canvas.registerFont('./commands/fonts/BebasNeue-Regular.ttf', { family: 'Bebas Neue' });

            // Function to create the card canvas
            async function createCardCanvas(character) {
                const frameImageUrl = 'https://yashin.nyc3.cdn.digitaloceanspaces.com/frames/Frame_Default_Yashin.png';
                const cardWidth = 350;
                const cardHeight = 550;

                // Fetch the frame image
                const frameImage = await fetch(frameImageUrl).then(res => res.buffer());
                const canvas = createCanvas(cardWidth, cardHeight);
                const context = canvas.getContext('2d');

                // Fill the background
                context.fillStyle = '#36393F';
                context.fillRect(0, 0, canvas.width, canvas.height);

                // Draw the character's image
                if (character.img_url) {
                    try {
                        const characterImage = await loadImage(character.img_url);
                        context.drawImage(characterImage, 10, 10, cardWidth - 20, cardHeight - 20);
                    } catch (error) {
                        console.error(`Error loading character image ${character._id}:`, error);
                    }
                }

                // Draw the frame over the character
                const frameImg = await loadImage(frameImage);
                context.drawImage(frameImg, 0, 0, cardWidth, cardHeight);

                // Add card details to canvas (number, name, series)
                context.font = 'bold 22px Arial';
                context.fillStyle = '#000000';
                context.textAlign = 'center';
                context.fillText(`#${character.__v}`, cardWidth / 2, cardHeight - 100);

                // Add character's name
                context.font = 'bold 30px Arial';
                context.fillStyle = '#000000';
                context.textAlign = 'center';
                let characterName = character.name.length > 15 ? character.name.slice(0, 14) + '-' : character.name;
                const nameY = cardHeight - 70;
                context.fillText(characterName, cardWidth / 2, nameY);

                // Add series text
                context.font = '24px Arial';
                context.fillStyle = '#000000';
                let seriesText = character.series.length > 16 ? character.series.slice(0, 15) + '-' : character.series;
                const seriesY = nameY + 30;
                wrapText(context, seriesText, cardWidth / 2, seriesY, cardWidth - 40, 24);

                return canvas;
            }

            // Function to wrap text in canvas (for series)
            function wrapText(context, text, x, y, maxWidth, lineHeight) {
                const words = text.split(' ');
                let line = '';
                let lineY = y;

                // Word wrapping logic for series text
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

            // Generate the card image
            const cardCanvas = await createCardCanvas(card);
            const finalImageBuffer = cardCanvas.toBuffer();

            // Prepare the initial embed for card offer
            const embed = new EmbedBuilder()
                .setColor('#36393F')
                .setTitle(`${message.author.username} wants to give you a card`)
                .setAuthor({
                    name: `Yashin: ${message.author.username} offers ${mentionedUser.username} the card ${cardCode}, do you accept?`,
                    iconURL: message.author.displayAvatarURL({ format: 'png', dynamic: true, size: 128 })
                })
                .setDescription(`:black_large_square: ${card.name} • ${card.series} • #${card.__v} E • 1`)
                .setImage('attachment://card.png')
                .setTimestamp();

            // Send the offer message
            const msg = await message.channel.send({
                content: `${mentionedUser}, ${message.author.username} wants to give you a card. Accept?`,
                embeds: [embed],
                files: [{ attachment: finalImageBuffer, name: 'card.png' }]
            });

            // Add reactions for accept/decline
            await msg.react('✅');
            await msg.react('❌');

            // Reaction filter to handle responses
            const filter = (reaction, user) => {
                return (
                    (reaction.emoji.name === '✅' && (user.id === recipientId || user.id === giverId)) ||
                    (reaction.emoji.name === '❌' && user.id === giverId)
                );
            };

            // Set up reaction collector
            const collector = msg.createReactionCollector({ filter, time: 60000 });

            let acceptedByGiver = false;
            let acceptedByRecipient = false;

            // Reaction handling logic
            collector.on('collect', async (reaction, user) => {
                if (reaction.emoji.name === '❌' && user.id === giverId) {
                    // If giver cancels
                    await msg.edit({
                        content: '',
                        embeds: [
                            new EmbedBuilder()
                                .setColor('#FF0000')
                                .setTitle('Card Transfer Canceled')
                                .setDescription(`${message.author.username} has canceled the transfer.`)
                                .setImage('attachment://card.png')
                                .setTimestamp()
                        ]
                    });
                    collector.stop();
                } else if (reaction.emoji.name === '✅') {
                    // If accepted by giver and recipient
                    if (user.id === giverId) acceptedByGiver = true;
                    if (user.id === recipientId) acceptedByRecipient = true;

                    if (acceptedByGiver && acceptedByRecipient) {
                        const freshGiverInventory = await fetchInventory(giverId);
                        const freshCard = freshGiverInventory.cards.find(c => c.code === cardCode);

                        if (!freshCard) {
                            return msg.edit('The card no longer exists in your inventory. Transaction failed.');
                        }

                        giverInventory.cards = giverInventory.cards.filter(c => c.code !== card.code);
                        await updateInventory(giverId, giverInventory);

                        let recipientInventory = await fetchInventory(recipientId);
                        if (!recipientInventory) {
                            recipientInventory = { userId: recipientId, cards: [] };
                        }

                        recipientInventory.cards.push(card);
                        await updateInventory(recipientId, recipientInventory);

                        await msg.edit({
                            content: `Card successfully transferred to ${mentionedUser}!`,
                            embeds: [embed.setColor('#00FF00')]
                        });
                        collector.stop();
                    }
                }
            });

            // Collector end handling
            collector.on('end', collected => {
                if (collected.size === 0 || !acceptedByGiver || !acceptedByRecipient) {
                    msg.edit('The card transfer was not completed.');
                }
            });

        } catch (error) {
            console.error('Error giving card:', error);

            // Restore giver's inventory in case of error
            await updateInventory(message.author.id, giverInventoryBackup);
            message.channel.send('An error occurred while trying to give the card.');
        }
    }
};
