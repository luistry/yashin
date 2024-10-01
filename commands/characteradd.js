const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { addAnimeCharacter, AnimeCharacter } = require('./database/database');
const AWS = require('aws-sdk');
const axios = require('axios');

// Authorized user IDs
const authorizedUserIds = [
    '346799501878755342',
    '123864968461287428',
    '339869018439548938',
    '300619060729610258',
    '270681503665618954',
    '955254487629561887',
    '755635893938815067',
    '1133740727151632475'
];

// Digital Ocean Spaces configuration
const spacesEndpoint = new AWS.Endpoint('https://nyc3.digitaloceanspaces.com');
const s3 = new AWS.S3({
    endpoint: spacesEndpoint,
    accessKeyId: 'DO00NMRCRGM8X7MRBAAY',
    secretAccessKey: '0cvxIoWPHGCE94G0UUWw5xe6UXUDe2o903N7AKBLsTg',
    region: 'nyc3'
});

const SPACE_NAME = 'yashin'; // The name of your Digital Ocean Space
const notificationChannelId = '1284269392330494005'; // Notification channel ID

module.exports = {
    name: 'characteradd',
    description: 'Adds a new anime character to the database',
    run: async (message, args) => {
        try {
            // Verify if the user is authorized
            if (!authorizedUserIds.includes(message.author.id)) {
                return await message.channel.send('You are not authorized to use this command.');
            }

            // Parse input: character name, series, and image URL
            const input = args.join(' ').split(',');
            if (input.length < 3) {
                return await message.channel.send('Please provide the character name, series, and image URL.');
            }

            const name = input[0].trim();
            const series = input[1].trim();
            const img_url = input[2].trim();

            // Validate the image URL
            if (!isValidUrl(img_url)) {
                return await message.channel.send('The provided image URL is invalid. Please provide a valid URL.');
            }

            // Fetch the next available character ID from the database
            const newCharacterId = await getNextAvailableCharacterId();

            // Preview the character addition
            const previewEmbed = new EmbedBuilder()
                .setColor('#FFA500') // Orange for preview
                .setTitle('Character Preview')
                .setDescription(`**Name**: ${name}\n**Series**: ${series}`)
                .setImage(img_url)
                .setTimestamp();

            const checkoutButton = new ButtonBuilder()
                .setCustomId('checkout')
                .setLabel('Checkout')
                .setStyle(ButtonStyle.Success);

            const cancelButton = new ButtonBuilder()
                .setCustomId('cancel')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger);

            // Send preview to the channel
            const messageSent = await message.channel.send({
                embeds: [previewEmbed],
                components: [new ActionRowBuilder().addComponents(checkoutButton, cancelButton)]
            });

            // Handle button interactions
            const filter = (interaction) => ['checkout', 'cancel'].includes(interaction.customId) && interaction.user.id === message.author.id;
            const collector = messageSent.createMessageComponentCollector({ filter, time: 60000 });

            collector.on('collect', async (interaction) => {
                if (interaction.customId === 'checkout') {
                    try {
                        // Upload the image to Digital Ocean Spaces
                        const filename = `${name.replace(/\s+/g, '_')}-${series.replace(/\s+/g, '_')}.jpg`;
                        const uploadedUrl = await uploadImageToDigitalOcean(img_url, filename);

                        // Add the new character to the database
                        await addAnimeCharacter(newCharacterId, name, series, uploadedUrl);

                        // Confirm character addition
                        const confirmationEmbed = new EmbedBuilder()
                            .setColor('#00FF00') // Green for confirmation
                            .setTitle('Character Added')
                            .setDescription(`**Character**: ${name}\n**Series**: ${series}`)
                            .setImage(uploadedUrl)
                            .setTimestamp();

                        await messageSent.edit({ embeds: [confirmationEmbed], components: [] });

                        // Send a notification to the notification channel
                        const notificationChannel = message.client.channels.cache.get(notificationChannelId);
                        if (notificationChannel) {
                            await notificationChannel.send({ embeds: [confirmationEmbed] });
                        }
                    } catch (error) {
                        console.error('Error uploading image or adding character:', error);
                        await message.channel.send('Failed to add the character.');
                    }
                } else if (interaction.customId === 'cancel') {
                    await messageSent.edit({ content: 'Character addition canceled.', components: [] });
                }
            });

            collector.on('end', async () => {
                await messageSent.edit({ components: [] });
            });

        } catch (err) {
            console.error('Error adding character:', err);
            await message.channel.send('There was an error adding the character to the database.');
        }
    }
};

// Function to upload the image to Digital Ocean Spaces
async function uploadImageToDigitalOcean(imageUrl, filename) {
    try {
        const response = await axios({
            method: 'get',
            url: imageUrl,
            responseType: 'arraybuffer'
        });

        const uploadParams = {
            Bucket: SPACE_NAME,
            Key: filename,
            Body: response.data,
            ACL: 'public-read',
            ContentType: 'image/jpeg'
        };

        const data = await s3.upload(uploadParams).promise();
        return `https://yashin.nyc3.cdn.digitaloceanspaces.com/${filename}`;
    } catch (error) {
        console.error('Error uploading image to Digital Ocean:', error);
        throw new Error('Image upload failed.');
    }
}

// Function to validate URLs
function isValidUrl(urlString) {
    try {
        const url = new URL(urlString);
        return url.protocol.startsWith('http');
    } catch (_) {
        return false;
    }
}

// Function to get the next available character ID
async function getNextAvailableCharacterId() {
    let newId = 15409; // Start from the first valid ID
    while (true) {
        const existingCharacter = await AnimeCharacter.findOne({ _id: newId });
        if (!existingCharacter) {
            return newId; // Found an available ID
        }
        newId++;
        if (newId > 154408) {
            throw new Error('Character ID limit reached. Cannot add more characters.');
        }
    }
}
