const { EmbedBuilder } = require('discord.js');
const { fetchInventory, updateInventory } = require('./database/database');

// Misiones definidas en un array
const missions = [
    {
        task: 'Complete your daily mission by dropping 10 cards and burning 1 card.',
        reward: '500 Gold and 1 Shine',
        requirements: { daily_drops: 10, daily_burn: 1 },
        key: 'dailyMissionProgress'
    }
];

// Reducer para actualizar el oro y brillos
const updateResource = (currentValue, increment) => {
    return (currentValue || 0) + increment;
};

module.exports = {
    name: 'missions',
    description: 'Claim your daily mission task!',
    run: async (message) => {
        const userId = message.author.id;

        // Obtener el inventario del usuario
        const inventory = await fetchInventory(userId);
        if (!inventory) {
            return message.channel.send('❌ You have no inventory. Please start by acquiring cards!');
        }

        const lastMissionTimestamp = inventory.daily_mision || 0;
        const now = Date.now();
        const cooldownTime = 24 * 60 * 60 * 1000; // 24 horas en milisegundos

        // Verificar si el usuario está en cooldown
        if (now - lastMissionTimestamp < cooldownTime) {
            const remainingTime = cooldownTime - (now - lastMissionTimestamp);
            const hours = Math.floor(remainingTime / (60 * 60 * 1000));
            const minutes = Math.floor((remainingTime % (60 * 60 * 1000)) / (60 * 1000));
            return message.channel.send(`⏳ You need to wait ${hours}h ${minutes}m before starting a new mission.`);
        }

        // Asegurarse de que `daily_stats` exista y acceder al primer objeto en el array
        const dailyStats = (inventory.daily_stats && inventory.daily_stats[0]) || {};
        const progress = {
            daily_drops: dailyStats.daily_drops || 0,
            daily_burn: dailyStats.daily_burn || 0,
        };

        const currentMission = missions.length > 0 ? missions[0] : null;

        // Verificar si se cumplen los requisitos
        const isMissionComplete = currentMission ? (
            progress.daily_drops >= currentMission.requirements.daily_drops &&
            progress.daily_burn >= currentMission.requirements.daily_burn
        ) : false;

        const statusMessage = isMissionComplete ? '✅ Completed' : '❌ In Progress';

        const dailyEmbed = new EmbedBuilder()
            .setColor('#0099ff') 
            .setTitle('🎯 **Daily Mission Task** 🎯')
            .setDescription(currentMission ? `**Your daily mission is to:**\n${currentMission.task}` : '❌ No more missions available.')
            .addFields(
                { name: '🚀 Current Progress', value: `**Dropped Cards:** ${progress.daily_drops} / ${currentMission?.requirements.daily_drops || 0}\n**Burned Cards:** ${progress.daily_burn} / ${currentMission?.requirements.daily_burn || 0}`, inline: false },
                { name: '🎁 Reward for Completion', value: currentMission ? `**${currentMission.reward}**` : 'N/A', inline: true },
                { name: '✅ Status', value: statusMessage, inline: true }
            )
            .setFooter({ text: 'Complete your daily mission to earn rewards!', iconURL: 'https://example.com/your_icon.png' })
            .setTimestamp();

        // Comprobación de finalización de misión
        if (isMissionComplete) {
            // Usar el reducer para calcular los nuevos valores
            const newGold = updateResource(inventory.gold?.[0], 500);  // Añadir 500 oro
            const newShine = updateResource(inventory.shines?.[0], 1);  // Añadir 1 shine

            // Actualizar inventario con recompensas y reiniciar progreso
            await updateInventory(userId, {
                'daily_stats.0.daily_drops': 0,
                'daily_stats.0.daily_burn': 0, 
                lastMissionTimestamp: now,
                daily_mision: now,
                gold: [newGold],  // Guardamos como array para mantener la estructura
                shines: [newShine],  // Lo mismo para shines
            });

            dailyEmbed.addFields({ name: '🎉 Mission Status', value: '✅ Mission completed! Your progress has been reset.' });

            const sentMessage = await message.channel.send({ embeds: [dailyEmbed] });
            await sentMessage.react('✅');

            const filter = (reaction, user) => reaction.emoji.name === '✅' && user.id === message.author.id;
            const collector = sentMessage.createReactionCollector({ filter, time: cooldownTime });

            collector.on('collect', async () => {
                // Añadir recompensa al inventario y restablecer el cooldown
                await updateInventory(userId, {
                    gold: [newGold],
                    shines: [newShine],
                    lastMissionTimestamp: Date.now(),
                });
                message.channel.send('🎉 You have claimed your reward! Your progress has been reset.');
                collector.stop();
            });

            collector.on('end', async () => {
                await sentMessage.edit({ components: [] });
            });

            return;
        }

        const messageSent = await message.channel.send({ embeds: [dailyEmbed] });
    }
};
