const { EmbedBuilder } = require('discord.js');
const { fetchInventory, updateInventory,addFrame, Colors } = require('./database/database');

// Definir ítems para Box_title
const boxTitles = [
    { name: 'The Honored One', image: 'https://yashin.nyc3.cdn.digitaloceanspaces.com/titles/honored%20one%20title.png', type: 'title' },
    { name: 'Hokage', image: 'https://yashin.nyc3.cdn.digitaloceanspaces.com/titles/title%20naruto.png', type: 'title' },
    { name: 'King of Curses', image: 'https://yashin.nyc3.cdn.digitaloceanspaces.com/titles/sukuna%20title.png', type: 'title' },
    { name: 'The Hero #1', image: 'https://titles-yashin.b-cdn.net/hero%20%231%20title.png', type: 'title' },
    { name: 'White Demon', image: 'https://yashin.nyc3.cdn.digitaloceanspaces.com/titles/white%20demon%20title.png', type: 'title' },
    { name: 'King of Pirates', image: 'https://yashin.nyc3.cdn.digitaloceanspaces.com/titles/king%20of%20pirates%20tititle.png', type: 'title' },
    { name: 'Soul Reaper', image: 'https://yashin.nyc3.cdn.digitaloceanspaces.com/titles/soul%20reaper%20title.png', type: 'title' },
    { name: 'Vasto Lorde', image: 'https://yashin.nyc3.cdn.digitaloceanspaces.com/titles/vasto%20lorde%20title.png', type: 'title' },
    { name: 'Pillar Of Love', image: 'https://yashin.nyc3.cdn.digitaloceanspaces.com/titles/title%20mitsuri.png', type: 'title' },
    { name: 'Demon Slayer', image: 'https://yashin.nyc3.cdn.digitaloceanspaces.com/titles/demon%20slayer%20title.png', type: 'title' },
    { name: 'The Traveler', image: 'https://yashin.nyc3.cdn.digitaloceanspaces.com/titles/traveler%20title.png', type: 'title' },
    { name: 'The God Of Contracts', image: 'https://yashin.nyc3.cdn.digitaloceanspaces.com/titles/zhongli%20title.png', type: 'title' }
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
const boxBannersHalloween = [
    { name: 'Pumpkin crew', image: 'https://yashin.nyc3.cdn.digitaloceanspaces.com/halloween-banner/Pumpkin%20Crew.webp', type: 'banner' },
    { name: 'Nignt Latern Halloween', image: 'https://yashin.nyc3.cdn.digitaloceanspaces.com/halloween-banner/Night%20Lantern%20Halloween.webp', type: 'banner' },
    { name: 'Hunter Night', image: 'https://yashin.nyc3.cdn.digitaloceanspaces.com/halloween-banner/Hunters%20Night.webp', type: 'banner' },
    { name: 'Vampire Night', image: 'https://yashin.nyc3.cdn.digitaloceanspaces.com/halloween-banner/Vampire%20Night%20Out.webp', type: 'banner' },
    { name: 'Kirbyween', image: 'https://yashin.nyc3.cdn.digitaloceanspaces.com/halloween-banner/kirbyween.webp', type: 'banner' },
    { name: 'Clover-Like Halloween', image: 'https://yashin.nyc3.cdn.digitaloceanspaces.com/halloween-banner/Clover-Like%20Halloween.webp', type: 'banner' },
    { name: 'my Scary academia', image: 'https://yashin.nyc3.cdn.digitaloceanspaces.com/halloween-banner/My%20Scary%20Academia.webp', type: 'banner' },
    { name: 'Space witches', image: 'https://yashin.nyc3.cdn.digitaloceanspaces.com/halloween-banner/Space%20Witches.webp', type: 'banner' },
    { name: 'Magical Umi', image: 'https://yashin.nyc3.cdn.digitaloceanspaces.com/halloween-banner/Magical%20Umi.webp', type: 'banner' },
    { name: 'A Butlers Halloween Night.', image: 'https://yashin.nyc3.cdn.digitaloceanspaces.com/halloween-banner/A%20Butlers%20Halloween%20Night.webp', type: 'banner' },
    { name: 'Poppin Halloween Parade', image: 'https://yashin.nyc3.cdn.digitaloceanspaces.com/halloween-banner/Poppin%20Halloween%20Parade.webp', type: 'banner' },
    { name: 'spooky bride', image: 'https://yashin.nyc3.cdn.digitaloceanspaces.com/halloween-banner/Spooky%20Brides.webp', type: 'banner' }
];
const boxframeHalloween = [
    { name: 'Bat Frame ', image: 'https://yashin.nyc3.cdn.digitaloceanspaces.com/halloween-banner/frame/Bat_Frame.webp', type: 'Frame' },
];

module.exports = {
    name: 'open',
    description: 'Opens a box and adds a random item to the respective array.',
    run: async (message, args) => {
        try {
            // Validar si el usuario proporcionó un argumento para el tipo de caja
            const validBoxes = ['titles box', 'banner box', 'halloween banner box', 'halloween frame box'];
            const boxType = args.join(' ').toLowerCase(); // Obtener el tipo de caja

            if (!boxType || !validBoxes.includes(boxType)) {
                return await message.channel.send('Please specify whether you want to open a `titles box`, `banner box`, `halloween banner box`, or `halloween frame box`.');
            }

            const mentionedUser = message.mentions.users.first() || message.author; // Obtener usuario
            const inventory = await fetchInventory(mentionedUser.id); // Obtener el inventario

            if (!inventory) {
                return await message.channel.send(`No inventory found for ${mentionedUser.username}.`);
            }

            // Desestructurar campos del inventario
            let { Box_title, Box_banner, Titles, Banners, Halloween_Box_banner, Halloween_frame_box } = inventory;

            // Validar si el usuario tiene cajas para abrir
            const boxInventoryMap = {
                'titles box': Box_title,
                'banner box': Box_banner,
                'halloween banner box': Halloween_Box_banner,
                'halloween frame box': Halloween_frame_box
            };

            if (!boxInventoryMap[boxType] || boxInventoryMap[boxType].length === 0) {
                return await message.channel.send(`You don't have any ${boxType} to open.`);
            }

            // Función para seleccionar un ítem aleatorio
            const getRandomItem = (array) => array[Math.floor(Math.random() * array.length)];
            let item; // Variable para almacenar el ítem abierto
            let embed; // Variable para el embed

            // Manejo del tipo de caja
            switch (boxType) {
                case 'titles box':
                    item = getRandomItem(boxTitles); // Selecciona un título aleatorio
                    Titles.push({ name: item.name, image: item.image }); // Agrega el título como objeto al inventario
                    Box_title[0] -= 1; // Restar de la posición 0
                    if (Box_title[0] <= 0) Box_title.shift(); // Si llega a cero, eliminar el primer elemento
                    embed = new EmbedBuilder()
                        .setTitle(`You opened a Title Box! 🎉`)
                        .setDescription(`You received: **${item.name}**`)
                        .setImage(item.image)
                        .setColor(0x00FF00); // Color verde
                    break;

                case 'banner box':
                    item = getRandomItem(boxBanners); // Selecciona un banner aleatorio
                    Banners.push({ name: item.name, image: item.image }); // Agrega el banner como objeto al inventario
                    Box_banner[0] -= 1; // Restar de la posición 0
                    if (Box_banner[0] <= 0) Box_banner.shift(); // Si llega a cero, eliminar el primer elemento
                    embed = new EmbedBuilder()
                        .setTitle(`You opened a Banner Box! 🎉`)
                        .setDescription(`You received: **${item.name}**`)
                        .setImage(item.image)
                        .setColor(0x00FF00); // Color verde
                    break;

                case 'halloween banner box':
                    item = getRandomItem(boxBannersHalloween); // Selecciona un banner de Halloween aleatorio
                    Banners.push({ name: item.name, image: item.image }); // Agrega el banner de Halloween como objeto al inventario
                    Halloween_Box_banner[0] -= 1; // Restar de la posición 0
                    if (Halloween_Box_banner[0] <= 0) Halloween_Box_banner.shift(); // Si llega a cero, eliminar el primer elemento
                    embed = new EmbedBuilder()
                        .setTitle(`You opened a Halloween Banner Box! 🎉`)
                        .setDescription(`You received: **${item.name}**`)
                        .setImage(item.image)
                        .setColor(0x00FF00); // Color verde
                    break;

                    case 'halloween frame box':
                        item = getRandomItem(boxframeHalloween); // Selecciona un marco de Halloween aleatorio
                        // Llamada a addFrame para agregar el marco al inventario
                        await addFrame(mentionedUser.id, item.name, 1, item.image); // Pasamos item.image como parámetro
                        Halloween_frame_box[0] -= 1; // Restar de la posición 0
                        if (Halloween_frame_box[0] <= 0) Halloween_frame_box.shift(); // Si llega a cero, eliminar el primer elemento
                        embed = new EmbedBuilder()
                            .setTitle(`You opened a Halloween Frame Box! 🎉`)
                            .setDescription(`You received: **${item.name}**`)
                            .setImage(item.image)
                            .setColor(0x00FF00); // Color verde
                        break;
                    
                    
            }

            // Actualizar inventario en la base de datos
            await updateInventory(mentionedUser.id, { Box_title, Box_banner, Titles, Banners, Halloween_Box_banner, Halloween_frame_box });

            // Enviar mensaje con el resultado
            await message.channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('Error al abrir la caja:', error);
            await message.channel.send('There was an error trying to open the box. Please try again later.');
        }
    }
};
