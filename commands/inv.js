const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { fetchInventory } = require('./database/database');

module.exports = {
    name: 'inv', 
    description: 'Displays the inventory data',
    run: async (message, args) => {
        try {
            // Extraer el usuario mencionado o usar el autor del mensaje si no hay mención
            const mentionedUser = message.mentions.users.first() || message.author;

            // Obtener el inventario para el usuario mencionado
            const inventory = await fetchInventory(mentionedUser.id);

            // Verificar si el inventario está vacío
            if (!inventory) {
                return await message.channel.send(`No inventory found for ${mentionedUser.username}.`);
            }

            // Destructuring de los campos relevantes del inventario
            const { shines, gold, stellar_dust, extra_drop, extra_grab, Frames, moons, SpeedOfReaction, GodofEvasion, FastHands, DivinityAbsolute, Glows, Box_title, Box_banner,candy,witch_dust,Halloween_Box_banner,Halloween_frame_box } = inventory;

            // Formatear la información de los frames
            let framesDescription = 'No frames found.';
            if (Frames && Frames.length > 0) {
                framesDescription = Frames.map(frame => {
                    const { name, quantity } = frame;
                    return `**• ${name}** • ${quantity} :frame_photo:`;
                }).join('\n');
            }

            // Formatear la información de box_titles y box_banners
            const boxTitleText = Box_title && Box_title.length > 0 ? `• Box Titles • ${Box_title.join(', ')} 📦` : null;
            const boxBannerText = Box_banner && Box_banner.length > 0 ? `• Box Banner • ${Box_banner.join(', ')} 📦` : null;

            // Condiciones para mostrar sólo si los valores son mayores a 0
            const shinesText = shines && shines.length > 0 ? `• Shines • ${shines.join(', ')} ✨` : null;
            const goldText = gold && gold.length > 0 ? `• Gold • ${gold.join(', ')} 🪙` : null;
            const moonstext = moons && moons.length > 0 ? `• Moons • ${moons.join(', ')} 🌙` : null;
            const stellarDustText = stellar_dust && stellar_dust.length > 0 ? `• Stellar Dust • ${stellar_dust.join(', ')} :dizzy:` : null;
            const extraDropText = extra_drop && extra_drop.length > 0 ? `• Extra Drops • ${extra_drop.join(', ')} :fist:` : null;
            const extraGrabText = extra_grab && extra_grab.length > 0 ? `• Extra Grabs • ${extra_grab.join(', ')} :wave:` : null;
            const DivinityAbsolutetext = DivinityAbsolute && DivinityAbsolute.length > 0 ? `• Divinity Absolute • ${DivinityAbsolute.join(', ')} 🌟` : null;
            const GodofEvasiontext = GodofEvasion && GodofEvasion.length > 0 ? `• God Of Evasion • ${GodofEvasion.join(', ')} :fingers_crossed:` : null;
            const FastHandstext = FastHands && FastHands.length > 0 ? `• Fast Hands • ${FastHands.join(', ')} 🙌` : null;
            const SpeedofReactiontext = SpeedOfReaction && SpeedOfReaction.length > 0 ? `• Speed Of Reaction • ${SpeedOfReaction.join(', ')} :open_hands:` : null;
            const Glowstext = Glows && Glows.length > 0 ? `• Radiance • ${Glows.join(', ')} :droplet:` : null;
            const Candytext = candy && candy.length > 0 ? `• Candys • ${candy.join(', ')} 🍬` : null;
            const witchtext = witch_dust && witch_dust.length > 0 ? `• Witch Dust • ${witch_dust.join(', ')}  🧹` : null; 
            const halloweenboxtext =  Halloween_Box_banner &&  Halloween_Box_banner.length > 0 ? `• Halloween banner box • ${ Halloween_Box_banner.join(', ')}  📦` : null; 
            const halloweeframe_boxtext =  Halloween_frame_box  &&  Halloween_frame_box .length > 0 ? `• Halloween frame box • ${ Halloween_frame_box .join(', ')}  📦` : null;  

            // Crear la lista de items para el embed
            const items = [
                shinesText,
                goldText,
                stellarDustText,
                extraDropText,
                extraGrabText,
                moonstext,
                DivinityAbsolutetext,
                GodofEvasiontext,
                FastHandstext,
                SpeedofReactiontext,
                Glowstext,
                boxTitleText,
                boxBannerText,
                Candytext,
                witchtext,
                halloweenboxtext,
                halloweeframe_boxtext,
                `\n**Frames**:\n${framesDescription}`
            ].filter(Boolean);

            const totalItems = items.length;
            const itemsPerPage = 8;
            const numPages = Math.ceil(totalItems / itemsPerPage);

            let currentPage = 1;

            const getPageEmbed = (page) => {
                const start = (page - 1) * itemsPerPage;
                const end = page * itemsPerPage;
                const pageItems = items.slice(start, end);

                return new EmbedBuilder()
                    .setColor('#efa94a')
                    .setAuthor({
                        name: `Yashin: Inventory of ${mentionedUser.username}`,
                        iconURL: mentionedUser.displayAvatarURL({ format: 'png', dynamic: true, size: 128 })
                    })
                    .setTitle(`Inventory Items - Page ${page}`)
                    .setDescription(pageItems.join('\n'))
                    .setFooter({ text: `Page ${page} of ${numPages}` })
                    .setTimestamp();
            };

            // Botones de paginación
            const getPaginationButtons = (page) => new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev-page')
                        .setLabel('Previous')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === 1),
                    new ButtonBuilder()
                        .setCustomId('next-page')
                        .setLabel('Next')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === numPages)
                );

            // Enviar el embed inicial con paginación
            const sentMessage = await message.channel.send({
                embeds: [getPageEmbed(currentPage)],
                components: [getPaginationButtons(currentPage)]
            });

            // Filtros y colectores para la paginación
            const filter = (i) => i.user.id === message.author.id;
            const collector = sentMessage.createMessageComponentCollector({ filter, time: 60000 });

            collector.on('collect', async (interaction) => {
                if (interaction.isButton()) {
                    if (interaction.customId === 'prev-page') currentPage--;
                    if (interaction.customId === 'next-page') currentPage++;

                    await interaction.update({
                        embeds: [getPageEmbed(currentPage)],
                        components: [getPaginationButtons(currentPage)]
                    });
                }
            });

            collector.on('end', () => {
                sentMessage.edit({
                    components: [] // Eliminar los botones cuando el colector termina
                });
            });

        } catch (err) {
            console.error('Error executing inventory command:', err);

            // Responder con un mensaje de error si algo sale mal
            await message.channel.send('There was an error fetching the inventory.');
        }
    }
};
