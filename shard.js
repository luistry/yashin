// shard.js
const { ShardingManager } = require('discord.js');

const manager = new ShardingManager('index.js', { 
    totalShards: 10, // Discord.js determinará automáticamente el número adecuado de shards
    token: 'MTI3MjMwMTk4NTc4OTY0MDg1Nw.Gb2FwH.XS4XcHUkKddYTvRNuXcjQElcgicGepf2lXayao' // Reemplaza con tu token de bot
});

manager.on('shardCreate', shard => {
    console.log(`Shard ${shard.id} ha sido creada.`);
});

manager.spawn(); // Inicia el número de shards
