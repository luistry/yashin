const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const { fetchInventory } = require('./database/database');

// Aquí puedes definir tus misiones en un array
const missions = [
    {
        task: 'Complete your daily mission by dropping 10 cards, burning 1 card, and morphing 1 card.',
        reward: '500 Gold and 1 Shine',
        key: 'dailyMissionProgress'
    },
    // Agrega más misiones aquí si es necesario
];

module.exports = {
    name: 'missions',
    description: 'Claim your daily mission task!',
    run: async (message) => {
        // Obtener el inventario del usuario actual
        const inventory = await fetchInventory(message.author.id);
        const progress = inventory ? {
            cardsDropped: inventory.cardsDropped || 0,
            cardsBurned: inventory.cardsBurned || 0,
            cardsMorphed: inventory.cardsMorphed || 0,
        } : { cardsDropped: 0, cardsBurned: 0, cardsMorphed: 0 };

        // Selecciona la misión actual
        const currentMission = missions.length > 0 ? missions[0] : null;

        const dailyEmbed = new EmbedBuilder()
            .setColor('#0099ff') // Color azul
            .setTitle('🎯 **Daily Mission Task** 🎯')
            .setDescription(currentMission ? `**Your daily mission is to:**\n${currentMission.task}` : '❌ No more missions available.')
            .addFields(
                { name: '🚀 Current Progress', value: `**Dropped Cards:** ${progress.cardsDropped} / 10\n**Burned Cards:** ${progress.cardsBurned} / 1\n**Morphed Cards:** ${progress.cardsMorphed} / 1`, inline: false },
                { name: '🎁 Reward for Completion', value: currentMission ? `**${currentMission.reward}**` : 'N/A', inline: true },
                { name: '✅ Status', value: 'In Progress', inline: true }
            )
            .setFooter({ text: 'Complete your daily mission to earn rewards!', iconURL: 'https://example.com/your_icon.png' })
            .setTimestamp();

        const button = new ButtonBuilder()
            .setCustomId('toggleMission')
            .setLabel('Next Mission ➡️')
            .setStyle(ButtonStyle.Success); // Cambia aquí a ButtonStyle.Success para un botón verde

        const row = new ActionRowBuilder().addComponents(button);

        const messageSent = await message.channel.send({ embeds: [dailyEmbed], components: [row] });

        // Función para manejar el botón de alternar misión
        const filter = (interaction) => interaction.customId === 'toggleMission' && interaction.user.id === message.author.id;

        const collector = message.channel.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async (interaction) => {
            await interaction.deferUpdate();
            // Alternar la misión
            const currentIndex = missions.indexOf(currentMission);
            const nextIndex = (currentIndex + 1) % missions.length; // Cicla a la siguiente misión
            const nextMission = missions[nextIndex];

            const updatedEmbed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('🎯 **Daily Mission Task** 🎯')
                .setDescription(nextMission ? `**Your daily mission is to:**\n${nextMission.task}` : '❌ No more missions available.')
                .addFields(
                    { name: '🚀 Current Progress', value: `**Dropped Cards:** ${progress.cardsDropped} / 10\n**Burned Cards:** ${progress.cardsBurned} / 1\n**Morphed Cards:** ${progress.cardsMorphed} / 1`, inline: false },
                    { name: '🎁 Reward for Completion', value: nextMission ? `**${nextMission.reward}**` : 'N/A', inline: true },
                    { name: '✅ Status', value: 'In Progress', inline: true }
                )
                .setFooter({ text: 'Complete your daily mission to earn rewards!', iconURL: 'https://example.com/your_icon.png' })
                .setTimestamp();

            await interaction.editReply({ embeds: [updatedEmbed], components: [row] });
        });

        collector.on('end', async () => {
            await messageSent.edit({ components: [] }); // Desactivar los botones después de que se acabe el tiempo
        });
    }
};
