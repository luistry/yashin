const { EmbedBuilder } = require('discord.js');
const { fetchInventory, updateInventory } = require('./database/database');

// Definir ítems para Box_title
const boxTitles = [
    { name: 'The Honored One', image: 'https://titles-yashin.b-cdn.net/honored%20one%20title.png', type: 'title' },
    { name: 'Hokage', image: 'https://titles-yashin.b-cdn.net/title%20naruto.png', type: 'title' },
    { name: 'King of Curses', image: 'https://titles-yashin.b-cdn.net/sukuna%20title.png', type: 'title' },
    { name: 'The Hero #1', image: 'https://titles-yashin.b-cdn.net/hero%20%231%20title.png', type: 'title' },
    { name: 'White Demon', image: 'https://titles-yashin.b-cdn.net/white%20demon%20title.png', type: 'title' },
    { name: 'King of Pirates', image: 'https://titles-yashin.b-cdn.net/king%20of%20pirates%20tititle.png', type: 'title' },
    { name: 'Soul Reaper', image: 'https://titles-yashin.b-cdn.net/soul%20reaper%20title.png', type: 'title' },
    { name: 'Vasto Lorde', image: 'https://titles-yashin.b-cdn.net/vasto%20lorde%20title.png', type: 'title' },
    { name: 'Pillar Of Love', image: 'https://titles-yashin.b-cdn.net/title%20mitsuri.png', type: 'title' },
    { name: 'Demon Slayer', image: 'https://titles-yashin.b-cdn.net/demon%20slayer%20title.png', type: 'title' },
    { name: 'The Traveler', image: 'https://titles-yashin.b-cdn.net/traveler%20title.png', type: 'title' },
    { name: 'The God Of Contracts', image: 'https://titles-yashin.b-cdn.net/zhongli%20title.png', type: 'title' }
];

// Definir ítems para Box_banner
const boxBanners = [
    { name: 'Gojo Satoru Banner', image: 'https://banners-yashin.b-cdn.net/Gojo%20Banner.jpg', type: 'banner' },
    { name: 'Naruto Banner', image: 'https://banners-yashin.b-cdn.net/Naruto%20banner.jpg', type: 'banner' },
    { name: 'Sukuna Banner', image: 'https://banners-yashin.b-cdn.net/sukuna%20wallpaper.jpg', type: 'banner' },
    { name: 'King Of Pirates Banner', image: 'https://banners-yashin.b-cdn.net/luffy%20wallpaper.jpg', type: 'banner' },
    { name: 'The Hero #1 banner', image: 'https://banners-yashin.b-cdn.net/hero%20%231.png', type: 'banner' },
    { name: 'White Demon Banner', image: 'https://banners-yashin.b-cdn.net/gintoki%20banner.jpg', type: 'banner' },
    { name: 'Soul Reaper Banner', image: 'https://banners-yashin.b-cdn.net/ichigo%20banner2.jpg', type: 'banner' },
    { name: 'Vasto Lorde banner', image: 'https://banners-yashin.b-cdn.net/ulquiorra%20banner.png', type: 'banner' },
    { name: 'Pillar of Love banner', image: 'https://banners-yashin.b-cdn.net/mitsuri%20banner.jpg', type: 'banner' },
    { name: 'Demon Slayer', image: 'https://banners-yashin.b-cdn.net/tanjiro%20banner.jpg', type: 'banner' },
    { name: 'The Traveler', image: 'https://banners-yashin.b-cdn.net/the%20traveler%20banner.png', type: 'banner' },
    { name: 'The God Of Contracts', image: 'https://banners-yashin.b-cdn.net/morax%20banner.jpeg', type: 'banner' }
];

module.exports = {
    name: 'open',
    description: 'Opens a box and adds a random item to the respective array.',
    run: async (message, args) => {
        try {
            // Validar si el usuario proporcionó un argumento para el tipo de caja
            if (!args[0] || (args[0] !== 'titles' && args[0] !== 'banner')) {
                return await message.channel.send('Please specify whether you want to open a `titles` box or a `banner` box.');
            }

            const boxType = args[0].toLowerCase(); // Obtener el tipo de caja (titles o banner)
            const mentionedUser = message.mentions.users.first() || message.author; // Obtener usuario

            // Obtener el inventario del usuario mencionado
            const inventory = await fetchInventory(mentionedUser.id);

            if (!inventory) {
                return await message.channel.send(`No inventory found for ${mentionedUser.username}.`);
            }

            // Destructurar campos del inventario
            let { Box_title, Box_banner, Titles, Banners } = inventory;

            // Validar si el usuario tiene cajas para abrir
            if (boxType === 'titles' && (!Box_title || Box_title.length === 0)) {
                return await message.channel.send('You don\'t have any title boxes to open.');
            } else if (boxType === 'banner' && (!Box_banner || Box_banner.length === 0)) {
                return await message.channel.send('You don\'t have any banner boxes to open.');
            }

            // Función para seleccionar un ítem aleatorio
            const getRandomItem = (array) => array[Math.floor(Math.random() * array.length)];

            // Variables para almacenar el ítem seleccionado y su imagen
            let selectedItem, imageURL;

            // Si el tipo es 'titles', abrir caja de títulos
            if (boxType === 'titles') {
                selectedItem = getRandomItem(boxTitles);
                imageURL = selectedItem.image;

                // Agregar el ítem al array de Titles
                Titles.push({ name: selectedItem.name, image: selectedItem.image, type: selectedItem.type });

                // Reducir el conteo de cajas de títulos
                Box_title[0] -= 1;
                if (Box_title[0] <= 0) {
                    Box_title.shift();
                }
            } 
            // Si el tipo es 'banner', abrir caja de banners
            else if (boxType === 'banner') {
                selectedItem = getRandomItem(boxBanners);
                imageURL = selectedItem.image;

                // Agregar el ítem al array de Banners
                Banners.push({ name: selectedItem.name, image: selectedItem.image, type: selectedItem.type });

                // Reducir el conteo de cajas de banners
                Box_banner[0] -= 1;
                if (Box_banner[0] <= 0) {
                    Box_banner.shift();
                }
            }

            // Actualizar el inventario
            await updateInventory(mentionedUser.id, { Box_title, Box_banner, Titles, Banners });

            // Crear y enviar el embed con la información del ítem
            const embed = new EmbedBuilder()
                .setColor('#efa94a')
                .setTitle('Opened Box')
                .setDescription(`You have opened a ${boxType} box and received: ${selectedItem.name}`)
                .setImage(imageURL)
                .setFooter({ text: 'Enjoy your new item!' });

            await message.channel.send({ embeds: [embed] });

        } catch (err) {
            console.error('Error executing open command:', err);
            await message.channel.send('There was an error opening the box.');
        }
    }
};
