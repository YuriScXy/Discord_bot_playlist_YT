const Discord = require("discord.js");
const { Client, Util } = require("discord.js");
const { TOKEN, PREFIX, GOOGLE_API_KEY } = require("./config");
const YouTube = require("simple-youtube-api");
const ytdl = require("ytdl-core");
require("./server.js")

const bot = new Client({ disableEveryone: true });

const youtube = new YouTube(GOOGLE_API_KEY);

const queue = new Map();

bot.on("warn", console.warn);

bot.on("error", console.error);

bot.on("ready", () => console.log(`${bot.user.tag} Okay, pai ta on!`));

bot.on("disconnect", () => console.log("Esta havendo erros , por favor tente de novo!"));

bot.on("reconnecting", () => console.log("Irei tentar mais uma vez"));

bot.on("message", async msg => { // eslint-disable-line
    if (msg.author.bot) return undefined;
    if (!msg.content.startsWith(PREFIX)) return undefined;

    const args = msg.content.split(" ");
    const searchString = args.slice(1).join(" ");
    const url = args[1] ? args[1].replace(/<(.+)>/g, "$1") : "";
    const serverQueue = queue.get(msg.guild.id);

    let command = msg.content.toLowerCase().split(" ")[0];
    command = command.slice(PREFIX.length)

    if (command === "help" || command == "cmd") {
        const helpembed = new Discord.RichEmbed()
            .setColor('#0099ff')
	          .setTitle('Lista de Comandos')
            .setAuthor('Villager ta on', 'https://i.imgur.com/dgAjR2M.jpg')
            .setDescription('Todos os comandos que este sistema oferece')
          	.setThumbnail('https://i.imgur.com/eIMpsDv.png')
            .addField('▶️ !play', 'Coloque o titulo e selecione para tocar', true )
            .addField('▶️ !play [title/url]', 'Coloque o link que ira entrar na fila', true )
            .addField('⏭ !skip', 'Pula a musica', true )
            .addBlankField()
            .addField('⏹ !stop', 'Para a seleção atual',true )
            .addField('⏸ !pause', 'Para a musica atual' ,true)
            .addField('🎶 !resume', 'Retoma a musica atual' ,true)
            .addBlankField()
            .addField('🎵 !nowplaying', 'Mostra a musica atual',true )
            .addField('📜 !queue', 'Mostra a playlist' ,true)
            .addField('🔊 !volume', 'Altera o Volume' ,true)
            .setFooter("©️ 2020 Yuri's Development", "https://api.zealcord.xyz/assets/images/logo.png")
        msg.channel.send(helpembed);
    }

    if (command === "play" || command === "p") {
        const voiceChannel = msg.member.voiceChannel;
        if (!voiceChannel) return msg.channel.send("Por favor entre em um canal de voz");
        const permissions = voiceChannel.permissionsFor(msg.client.user);
        if (!permissions.has("CONNECT")) {
            return msg.channel.send("Eu preciso me conectar");
        }
        if (!permissions.has("SPEAK")) {
            return msg.channel.send("Eu preciso de permissão para tocar");
        }

        if (url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
            const playlist = await youtube.getPlaylist(url);
            const videos = await playlist.getVideos();
            for (const video of Object.values(videos)) {
                const video2 = await youtube.getVideoByID(video.id); // eslint-disable-line no-await-in-loop
                await handleVideo(video2, msg, voiceChannel, true); // eslint-disable-line no-await-in-loop
            }
            return msg.channel.send(`<:yes:591629527571234819>  **|**  Playlist: **\`${playlist.title}\`** foi adicionado a playlist!`);
        } else {
            try {
                var video = await youtube.getVideo(url);
            } catch (error) {
                try {
                    var videos = await youtube.searchVideos(searchString, 10);
                    let index = 0;
                    msg.channel.send(`
__**Seleção da Musica:**__

${videos.map(video2 => `**\`${++index}\`  |**  ${video2.title}`).join("\n")}

Por favor selecione um numero de 1-10 para tocar o desejado.
					`);
                    // eslint-disable-next-line max-depth
                    try {
                        var response = await msg.channel.awaitMessages(msg2 => msg2.content > 0 && msg2.content < 11, {
                            maxMatches: 1,
                            time: 10000,
                            errors: ["time"]
                        });
                    } catch (err) {
                        console.error(err);
                        return msg.channel.send("Entrada Invalida");
                    }
                    const videoIndex = parseInt(response.first().content);
                    var video = await youtube.getVideoByID(videos[videoIndex - 1].id);
                } catch (err) {
                    console.error(err);
                    return msg.channel.send("🆘  **|**  Não foi encontrado nenhum resultado");
                }
            }
            return handleVideo(video, msg, voiceChannel);
        }

    } else if (command === "skip") {
        if (!msg.member.voiceChannel) return msg.channel.send("Você precisa entrar em um chat de voz para ouvir a musica animal");
        if (!serverQueue) return msg.channel.send("Não Há nada na fila para pular!");
        serverQueue.connection.dispatcher.end("Skip used!");
        msg.channel.send("⏭️  **|**  Skip used!");
        return undefined;

    } else if (command === "stop") {
        if (!msg.member.voiceChannel) return msg.channel.send("Você precisa entrar em um chat de voz para ouvir a musica animal");
        if (!serverQueue) return msg.channel.send("Não Há nada na fila para parar!");
        serverQueue.songs = [];
        serverQueue.connection.dispatcher.end("Stop used!");
        msg.channel.send("⏹️  **|**  Stop used!");
        return undefined;

    } else if (command === "volume" || command === "vol") {
        if (!msg.member.voiceChannel) return msg.channel.send("Você precisa entrar em um chat de voz para ouvir a musica animal");
        if (!serverQueue) return msg.channel.send("Não há nada tocando😓.");
        if (!args[1]) return msg.channel.send(`The current volume is: **\`${serverQueue.volume}%\`**`);
        serverQueue.volume = args[1];
        serverQueue.connection.dispatcher.setVolumeLogarithmic(args[1] / 5);
        return msg.channel.send(`I set the volume to: **\`${args[1]}%\`**`);

    } else if (command === "nowplaying" || command === "np") {
        if (!serverQueue) return msg.channel.send("Não há nada tocando😓.");
        return msg.channel.send(`🎶  **|**  Agora esta tocando: **\`${serverQueue.songs[0].title}\`**`);

    } else if (command === "queue" || command === "q") {
        if (!serverQueue) return msg.channel.send("Não há nada tocando😓.");
        return msg.channel.send(`
__**PLaylist 📜:**__

${serverQueue.songs.map(song => `**-** ${song.title}`).join("\n")}

**Tocando agora🎵 : \`${serverQueue.songs[0].title}\`**
        `);

    } else if (command === "pause") {
        if (serverQueue && serverQueue.playing) {
            serverQueue.playing = false;
            serverQueue.connection.dispatcher.pause();
            return msg.channel.send("⏸  **|**  Paused");
        }
        return msg.channel.send("Não há nada tocando😓.");

    } else if (command === "resume") {
        if (serverQueue && !serverQueue.playing) {
            serverQueue.playing = true;
            serverQueue.connection.dispatcher.resume();
            return msg.channel.send("▶  **|** Played");
        }
        return msg.channel.send("Não há nada tocando😓.");
    }
    return undefined;
});

async function handleVideo(video, msg, voiceChannel, playlist = false) {
    const serverQueue = queue.get(msg.guild.id);
    const song = {
        id: video.id,
        title: Util.escapeMarkdown(video.title),
        url: `https://www.youtube.com/watch?v=${video.id}`
    };
    if (!serverQueue) {
        const queueConstruct = {
            textChannel: msg.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 5,
            playing: true
        };
        queue.set(msg.guild.id, queueConstruct);

        queueConstruct.songs.push(song);

        try {
            var connection = await voiceChannel.join();
            queueConstruct.connection = connection;
            play(msg.guild, queueConstruct.songs[0]);
        } catch (error) {
            console.error(`Não consegui entrar no canal de voz: ${error}`);
            queue.delete(msg.guild.id);
            return msg.channel.send(`Não consegui entrar no canal de voz: **\`${error}\`**`);
        }
    } else {
        serverQueue.songs.push(song);
        console.log(serverQueue.songs);
        if (playlist) return undefined;
        else return msg.channel.send(`<:Add:591629527571234819>  **|** **\`${song.title}\`** Foi adicionado a playlist📜!`);
    }
    return undefined;
}

function play(guild, song) {
    const serverQueue = queue.get(guild.id);

    if (!song) {
        serverQueue.voiceChannel.leave();
        queue.delete(guild.id);
        return;
    }

    const dispatcher = serverQueue.connection.playStream(ytdl(song.url))
        .on("end", reason => {
            if (reason === "Stream is not generating quickly enough.") console.log("Song Ended.");
            else console.log(reason);
            serverQueue.songs.shift();
            play(guild, serverQueue.songs[0]);
        })
        .on("error", error => console.error(error));
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);

    serverQueue.textChannel.send(`🎶  **|**  Start Playing: **\`${song.title}\`**`);
};

bot.login(TOKEN);
