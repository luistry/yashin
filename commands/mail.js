const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { fetchInventory, updateInventory } = require('./database/database');

module.exports = {
    name: 'mail',
    description: 'View your mail and manage it',
    async run(message, args) {
        const userId = message.author.id; // Usamos el ID correctamente

        // Obtener el inventario o los datos de mail del usuario
        let inventory;
        try {
            inventory = await fetchInventory(userId);
        } catch (error) {
            console.error('Error fetching inventory:', error);
            return message.channel.send('Could not fetch your emails at this time. Please try again later.');
        }

        // Verificar si el inventario o los mails existen
        if (!inventory || !inventory.mails || inventory.mails.length === 0) {
            return message.channel.send('You have no emails at the moment.');
        }

        const inventoryId = inventory._id;
        let mails = inventory.mails;

        // Ordenar los mails para que los no leídos aparezcan primero
        mails.sort((a, b) => (a.Readed ? 1 : 0) - (b.Readed ? 1 : 0));

        let currentIndex = 0;

        // Función para generar el embed del mail
        function generateMailEmbed(mail) {
            return new EmbedBuilder()
                .setTitle(mail.name)
                .setDescription(mail.description)
                .setFooter({ text: `Status: ${mail.Readed ? 'Already read' : 'Unread'}` })
                .setColor(mail.Readed ? 0x808080 : 0x0099ff); // Gris si ya fue leído, azul si no
        }

        // Embed inicial
        let currentMail = mails[currentIndex];
        let mailEmbed = generateMailEmbed(currentMail);

        // Enviar el mensaje inicial del mail con botones
        const mailMessage = await message.channel.send({
            embeds: [mailEmbed],
            components: [createMailActionRow()],
        });

        const filter = (i) => i.user.id === userId;
        const collector = mailMessage.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async (i) => {
            if (i.customId === 'next') {
                if (currentIndex < mails.length - 1) {
                    currentIndex++;
                    currentMail = mails[currentIndex];
                    mailEmbed = generateMailEmbed(currentMail);
                    await i.update({ embeds: [mailEmbed], components: [createMailActionRow()] });
                } else {
                    await i.reply({ content: 'You are already at the last email.', ephemeral: true });
                }
            } else if (i.customId === 'previous') {
                if (currentIndex > 0) {
                    currentIndex--;
                    currentMail = mails[currentIndex];
                    mailEmbed = generateMailEmbed(currentMail);
                    await i.update({ embeds: [mailEmbed], components: [createMailActionRow()] });
                } else {
                    await i.reply({ content: 'You are already at the first email.', ephemeral: true });
                }
            } else if (i.customId === 'read') {
                if (!currentMail.Readed) {
                    currentMail.Readed = true;

                    const { rewards } = currentMail;

                    // Actualizar el inventario con las recompensas
                    const updatedInventory = {
                        shines: parseInt(inventory.shines?.[0] || 0) + parseInt(rewards.shines || 0),
                        mails: inventory.mails,
                    };

                    await updateInventory(inventoryId, updatedInventory);

                    mailEmbed = generateMailEmbed(currentMail);
                    mailEmbed.setColor(0x00ff00); // Cambiar el color a verde al marcar como leído
                    await i.update({ embeds: [mailEmbed], components: [] });
                } else {
                    await i.reply({ content: 'This email has already been read.', ephemeral: true });
                }
            }
        });

        collector.on('end', () => {
            mailMessage.edit({ components: [] });
        });
    },
};

// Helper para crear botones de acción
function createMailActionRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('previous').setLabel('⬅️').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('next').setLabel('➡️').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('read').setLabel('✅ Mark as Read').setStyle(ButtonStyle.Success)
    );
}
