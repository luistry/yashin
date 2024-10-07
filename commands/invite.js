const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'invite',
    description: 'Invite the bot to your server and join the Yashin Main server.',
    async run(message) {
        const embed = new EmbedBuilder()
            .setTitle('Invite Yashin to Your Server')
            .setDescription(`[Invite Yashin](https://discord.com/oauth2/authorize?client_id=1272301985789640857&integration_type=0&scope=applications.commands\n\n[Join Yashin Main Server](https://discord.gg/5g94Ky8Tm2)`)
            .setColor('#0099ff');

        message.channel.send({ embeds: [embed] });
    },
};
