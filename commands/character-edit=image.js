const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { editAnimeCharacterImage, AnimeCharacter } = require('./database/database');
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
const notificationChannelId = '1284269392330494005';

// BunnyCDN configuration
const BUNNYCDN_HOSTNAME = 'https://yashin-images.b-cdn.net';
const BUNNYCDN_STORAGE_ZONE = 'images-cards'; // Updated storage zone
const BUNNYCDN_ACCESS_KEY = '785d7519-57df-405b-9e580f8444ac-7eed-49e4'; // Replace with your actual API key

module.exports = {
    name: 'character-edit=image',
    description: 'Edit the image of an existing anime character in the database',
    run: async (message, args) => {
        try {
            if (!authorizedUserIds.includes(message.author.id)) {
                return await message.channel.send('You are not authorized to use this command.');
            }

            const input = args.join(' ').split(',');
            if (input.length < 3) {
                return await message.channel.send('Please provide the character name, series, and new image URL.');
            }

            const name = input[0].trim();
            const series = input[1].trim();
            const new_img_url = input[2].trim();

            if (!isValidUrl(new_img_url)) {
                return await message.channel.send('The provided image URL is invalid. Please provide a valid URL.');
            }

            const characters = await AnimeCharacter.find({
                name: new RegExp(name, 'i'),
                series: new RegExp(series, 'i')
            }).limit(15);

            if (characters.length === 0) {
                return await message.channel.send(`Character with name "${name}" from the series "${series}" not found.`);
            }

            if (characters.length > 1) {
                // Handle multiple characters if necessary (e.g., by sending a list)
            } else {
                const character = characters[0];
                await handleCharacterEdit(character, new_img_url, message, notificationChannelId);
            }

        } catch (err) {
            console.error('Error editing character image:', err);
            await message.channel.send('There was an error editing the character image in the database.');
        }
    }
};

async function handleCharacterEdit(character, new_img_url, message, notificationChannelId) {
    const previewEmbed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('Character Image Edit Preview')
        .setDescription(`**Name**: ${character.name}\n**Series**: ${character.series}`)
        .setImage(character.img_url) // Current image
        .addFields({ name: '➔', value: 'New Image', inline: true })
        .setThumbnail(new_img_url) // New image
        .setTimestamp();

    const checkoutButton = new ButtonBuilder()
        .setCustomId('checkout')
        .setLabel('Update Image')
        .setStyle(ButtonStyle.Success);

    const cancelButton = new ButtonBuilder()
        .setCustomId('cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Danger);

    const messageSent = await message.channel.send({
        embeds: [previewEmbed],
        components: [new ActionRowBuilder().addComponents(checkoutButton, cancelButton)]
    });

    const filter = (interaction) => ['checkout', 'cancel'].includes(interaction.customId) && interaction.user.id === message.author.id;
    const collector = messageSent.createMessageComponentCollector({ filter, time: 60000 });

    collector.on('collect', async (interaction) => {
        if (interaction.customId === 'checkout') {
            try {
                // Generate filename based on character name and series
                const filename = `${character.name.replace(/\s+/g, '_')}-${character.series.replace(/\s+/g, '_')}.jpg`;

                const uploadedUrl = await uploadImageToBunnyCDN(new_img_url, filename);
                await editAnimeCharacterImage(character.name, character.series, uploadedUrl); // Update with the uploaded URL

                const confirmationEmbed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('Character Image Updated')
                    .setDescription(`**Character**: ${character.name}\n**Series**: ${character.series}`)
                    .addFields({ name: '➔', value: 'Image Updated', inline: true })
                    .setThumbnail(uploadedUrl)
                    .setImage(uploadedUrl)
                    .setTimestamp();

                await messageSent.edit({ embeds: [confirmationEmbed], components: [] });

                const notificationChannel = message.client.channels.cache.get(notificationChannelId);
                if (notificationChannel) {
                    await notificationChannel.send({ embeds: [confirmationEmbed] });
                }
            } catch (error) {
                console.error('Error uploading image:', error);
                await message.channel.send('Failed to upload the image.');
            }
        } else if (interaction.customId === 'cancel') {
            await messageSent.edit({ content: 'Character image update canceled.', components: [] });
        }
    });

    collector.on('end', async () => {
        await messageSent.edit({ components: [] });
    });
}

async function uploadImageToBunnyCDN(imageUrl, filename) {
    try {
        // Fetch the image
        const response = await axios({
            method: 'get',
            url: imageUrl,
            responseType: 'arraybuffer' // Get the image as an array buffer
        });

        // Upload the image to BunnyCDN
        const uploadResponse = await axios({
            method: 'PUT',
            url: `https://storage.bunnycdn.com/${BUNNYCDN_STORAGE_ZONE}/${filename}`, // Correct upload URL
            headers: {
                'AccessKey': BUNNYCDN_ACCESS_KEY, // Replace with your actual API key
                'Content-Type': 'application/octet-stream'
            },
            data: response.data // The image data to upload
        });

        // Check if the upload was successful
        if (uploadResponse.status === 201) {
            return `${BUNNYCDN_HOSTNAME}/${filename}`; // Return the uploaded URL
        } else {
            throw new Error(`Failed to upload image to BunnyCDN. Status: ${uploadResponse.status}`);
        }
    } catch (error) {
        console.error('Error uploading image to BunnyCDN:', error);
        throw new Error('Image upload failed.');
    }
}

// Updated function to validate URLs
function isValidUrl(urlString) {
    try {
        const url = new URL(urlString);
        return url.protocol.startsWith('http'); // Accept any URL using HTTP or HTTPS
    } catch (_) {
        return false;  
    }
}
