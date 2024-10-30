const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { addHalloweenCard } = require('./database/database'); // Ensure correct model export
const AWS = require('aws-sdk');
const axios = require('axios');

// Authorized user IDs
const authorizedUserIds = [
    '346799501878755342', '123864968461287428', '339869018439548938', 
    '300619060729610258', '270681503665618954', '955254487629561887', 
    '755635893938815067', '1133740727151632475'
];

// Digital Ocean Spaces configuration
const spacesEndpoint = new AWS.Endpoint('https://nyc3.digitaloceanspaces.com');
const s3 = new AWS.S3({
    endpoint: spacesEndpoint,
    accessKeyId: 'DO00NMRCRGM8X7MRBAAY',
    secretAccessKey: '0cvxIoWPHGCE94G0UUWw5xe6UXUDe2o903N7AKBLsTg',
    region: 'nyc3'
});

const SPACE_NAME = 'yashin';
const notificationChannelId = '1284269392330494005';

module.exports = {
    name: 'characteradd-event',
    description: 'Adds a new Halloween card to the database',
    run: async (message, args) => {
        try {
            if (!authorizedUserIds.includes(message.author.id)) {
                return await message.channel.send('You are not authorized to use this command.');
            }

            const input = args.join(' ').split(',');
            if (input.length < 3) {
                return await message.channel.send('Please provide the card name, series, and image URL.');
            }

            const [name, series, img_url] = input.map(arg => arg.trim());
            if (!isValidUrl(img_url)) {
                return await message.channel.send('The provided image URL is invalid.');
            }

            const previewEmbed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('Card Preview')
                .setDescription(`**Name**: ${name}\n**Series**: ${series}`)
                .setImage(img_url)
                .setTimestamp();

            const messageSent = await message.channel.send({
                embeds: [previewEmbed],
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('checkout').setLabel('Checkout').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger)
                    )
                ]
            });

            const filter = (interaction) => ['checkout', 'cancel'].includes(interaction.customId) && interaction.user.id === message.author.id;
            const collector = messageSent.createMessageComponentCollector({ filter, time: 60000 });

            collector.on('collect', async (interaction) => {
                if (interaction.customId === 'checkout') {
                    try {
                        const filename = `${name.replace(/\s+/g, '_')}-${series.replace(/\s+/g, '_')}.jpg`;
                        const uploadedUrl = await uploadImageToDigitalOcean(img_url, filename);
                        await addHalloweenCard(name, series, uploadedUrl);

                        const confirmationEmbed = new EmbedBuilder()
                            .setColor('#00FF00')
                            .setTitle('Card Added')
                            .setDescription(`**Card**: ${name}\n**Series**: ${series}`)
                            .setImage(uploadedUrl)
                            .setTimestamp();

                        await messageSent.edit({ embeds: [confirmationEmbed], components: [] });

                        const notificationChannel = message.client.channels.cache.get(notificationChannelId);
                        if (notificationChannel) {
                            await notificationChannel.send({ embeds: [confirmationEmbed] });
                        }
                    } catch (error) {
                        console.error('Error uploading image or adding card:', error);
                        await message.channel.send('Failed to add the card.');
                    }
                } else if (interaction.customId === 'cancel') {
                    await messageSent.edit({ content: 'Card addition canceled.', components: [] });
                }
            });

            collector.on('end', async () => {
                await messageSent.edit({ components: [] });
            });
        } catch (err) {
            console.error('Error adding card:', err);
            await message.channel.send('There was an error adding the card to the database.');
        }
    }
};

// Function to upload the image to Digital Ocean Spaces
async function uploadImageToDigitalOcean(imageUrl, filename) {
    try {
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            headers: { 'Content-Type': 'image/jpeg' }
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
        console.error('Error uploading image to Digital Ocean:', error.message || error);
        throw new Error('Image upload failed.');
    }
}

// Function to validate URLs
function isValidUrl(urlString) {
    try {
        const url = new URL(urlString);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}
