const { EmbedBuilder, Colors } = require('discord.js');

module.exports = {
    description: "Show user's avatar",
    run: async (message) => {
        // Obtén el usuario mencionado o el autor del mensaje
        const target = message.mentions.users.first() || message.author;
        const member = await message.guild.members.fetch(target.id);

        if (!member) return message.reply("Incorrect user.");

        // Obtén la URL del avatar del usuario
        const avatar = member.user.displayAvatarURL({ size: 512 });

        // Crea el embed
        const embed = new EmbedBuilder()
            .setColor(Colors.Blue) // Color del borde del embed
            .setFooter({ 
                text: `Requested by ${message.author.username}`, 
                iconURL: message.author.displayAvatarURL() 
            }) // Pie del embed
            .setTitle(`Avatar of ${member.user.username}`) // Título del embed
            .setImage(avatar); // Imagen del embed

        // Envía el embed como respuesta al mensaje
        message.reply({ embeds: [embed] });
    }
};
