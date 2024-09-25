const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { fetchInventory } = require('./database/database'); // Ajusta el path a tu archivo

module.exports = {
    name: 'title',
    description: 'Apply a title from your inventory to your profile.',
    async run(message, args) {
        try {
            // Verificar si hay argumentos suficientes
            if (args.length === 0) {
                return await message.channel.send('Please provide the name of the title you want to use.');
            }

            // El nombre del título a aplicar
            const titleName = args.join(' ').trim().toLowerCase();

            if (!titleName) {
                return await message.channel.send('Please provide the name of the title you want to use.');
            }

            // Obtener el inventario del usuario
            const inventory = await fetchInventory(message.author.id);
            if (!inventory) {
                return await message.channel.send('Failed to fetch inventory.');
            }

            // Asegurarse de que el array Profile exista
            if (!inventory.Profile) {
                inventory.Profile = []; // Crear el array Profile si no existe
            }

            // Verificar si el usuario tiene títulos
            const itemArray = inventory.Titles;
            if (!itemArray || itemArray.length === 0) {
                return await message.channel.send("You don't have any titles in your inventory.");
            }

            // Buscar el título por nombre
            const selectedTitle = itemArray.find(i => i.name.toLowerCase() === titleName);

            if (!selectedTitle) {
                return await message.channel.send(`"${titleName}" is not a valid title.`);
            }

            // Crear el embed con botones
            const embed = new EmbedBuilder()
                .setColor('#00ff00') // Verde para éxito
                .setTitle('Confirm Title Application')
                .setDescription(`Do you want to apply the title "${selectedTitle.name}" to your profile?`)
                .setThumbnail(selectedTitle.image) // Agregar la imagen del título
                .setTimestamp();

            // Crear los botones
            const confirmButton = new ButtonBuilder()
                .setCustomId('confirm_title')
                .setLabel('Confirm')
                .setStyle(ButtonStyle.Success); // Estilo verde para éxito

            const cancelButton = new ButtonBuilder()
                .setCustomId('cancel_title')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger); // Estilo rojo para peligro

            // Crear la fila de botones
            const actionRow = new ActionRowBuilder()
                .addComponents(confirmButton, cancelButton);

            // Enviar el mensaje con el embed y los botones
            const sentMessage = await message.channel.send({ embeds: [embed], components: [actionRow] });

            // Crear un collector para los botones
            const filter = i => i.user.id === message.author.id;
            const collector = sentMessage.createMessageComponentCollector({ filter, time: 15000 }); // 15 segundos para responder

            collector.on('collect', async interaction => {
                if (interaction.customId === 'confirm_title') {
                    // Eliminar el título del array Titles
                    const index = itemArray.indexOf(selectedTitle);
                    if (index > -1) {
                        itemArray.splice(index, 1);
                    }

                    // Crear el objeto de título con el campo type
                    const titleObject = {
                        ...selectedTitle,
                        type: 'title'
                    };

                    // Reemplazar el primer objeto de tipo 'title' en el perfil, si existe
                    let replaced = false;
                    for (let i = 0; i < inventory.Profile.length; i++) {
                        if (inventory.Profile[i].type === 'title') {
                            inventory.Profile[i] = titleObject;
                            replaced = true;
                            break;
                        }
                    }

                    // Si no se reemplazó, agregar el nuevo título al perfil
                    if (!replaced) {
                        inventory.Profile.push(titleObject);
                    }

                    // Guardar el inventario actualizado
                    await inventory.save();

                    // Informar al usuario con un embed
                    const successEmbed = new EmbedBuilder()
                        .setColor('#00ff00') // Verde para éxito
                        .setTitle('Title Applied')
                        .setDescription(`The title "${selectedTitle.name}" has been applied to your profile.`)
                        .setThumbnail(selectedTitle.image) // Agregar la imagen del título
                        .setTimestamp();

                    await interaction.update({ embeds: [successEmbed], components: [] });
                } else if (interaction.customId === 'cancel_title') {
                    // Informar al usuario que la acción ha sido cancelada
                    const cancelEmbed = new EmbedBuilder()
                        .setColor('#ff0000') // Rojo para cancelar
                        .setTitle('Action Cancelled')
                        .setDescription('The title application has been cancelled.')
                        .setTimestamp();

                    await interaction.update({ embeds: [cancelEmbed], components: [] });
                }
            });

            collector.on('end', collected => {
                if (collected.size === 0) {
                    // Informar al usuario si no se ha respondido a tiempo
                    const timeoutEmbed = new EmbedBuilder()
                        .setColor('#ff0000') // Rojo para timeout
                        .setTitle('Action Timeout')
                        .setDescription('You took too long to respond. The title application has been cancelled.')
                        .setTimestamp();

                    sentMessage.edit({ embeds: [timeoutEmbed], components: [] });
                }
            });

        } catch (err) {
            console.error('Error executing title command:', err);
            await message.channel.send('There was an error processing your request.');
        }
    }
};
