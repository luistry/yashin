const { EmbedBuilder, Colors } = require("discord.js");

module.exports = {
    description: "Show Yashin's commands",
    run: async (message) => {
        const target = message.mentions.users.first() || message.author;
        const member = await message.guild.members.fetch(target.id);
        
        const embed = new EmbedBuilder()
            .setColor(Colors.Grey)
            .setTitle(`Commands of Yashin`)
            .setDescription("Here are some commands you can use:")
            .addFields(
                { name: 'Collection :flower_playing_cards:', value: '`Collection`, `View`, `Inventory`, `Burn`,`Viewlast`,`Tag`,`cardinfo`', inline: true },
                { name: 'Wishlist :heart_decoration:', value: '`Wishlist`, `Wishlistadd`, `Wishlistremove`, `LookupSeries`', inline: true },
                { name: 'Utility :thumbsup:', value: '`Avatar`, `Ping`, `Help`,`invite`', inline: true },
                { name: 'Basic :book:', value: '`Cooldown`, `Drop`, `Daily`, `Shop`, `Frameshop`, `Vote`,`tags`,`tagcreate`,`tagdelete`,`Give`', inline: true },
                { name: 'Profiles :frame_photo: ', value: '`profile`, `open`, `banners`, `titles`, `banner`, `title`', inline: true },
                { name: 'Settings :gear:', value: '`Register`, `Reminder`,`info`,`Referer`', inline: true }
            )
            .setFooter({ text: `Requested by ${member.user.username}`, iconURL: member.user.displayAvatarURL() });

        message.reply({ embeds: [embed] });
    }
};

