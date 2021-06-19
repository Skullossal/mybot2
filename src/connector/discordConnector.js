require('dotenv').config()
const {Client} = require("discord.js");
require("../discord/ExtAPIMessage");
const bot = new Client({
    allowedMentions: {
        // set repliedUser value to `false` to turn off the mention by default
        repliedUser: false
    }
});
const botService = require('../botService')
const translationService = require('../translationService')
const commandService = require("../commandService");
const {getInterval} = require("../utils");

const TOKEN = process.env.TOKEN;
bot.login(TOKEN);
const channels = []
let locked = false

bot.on('ready', () => {
    console.info(`Logged in as ${bot.user.tag}!`)

    bot.channels.fetch("852192504862605312")
        .then(channel => {
            channel.send(`Bot started. Current LMI: ${process.env.LMI}\n${translationService.botTranslations.introduction[0].msg}`)
        })
});

bot.on('message', async msg => {
    const channelName = msg.channel.type === "dm" ?
        "##" + msg.channel.id
        :"#" + msg.channel.name

    const originalMsg = msg
    if (!channels[channelName])
        channels[channelName] = originalMsg.channel

    // Prevents messages from the bot itself
    // Also cache the last bot message for later retries
    if (originalMsg.author.username === bot.user.username) {
        channels[channelName].lastBotMessage = originalMsg
        return
    }
    if (originalMsg.content === ";ai me") return                        // Prevents commands from other bots

    const cleanContent = originalMsg.cleanContent

    if (cleanContent.startsWith("²") && cleanContent.length === 1) {
        await originalMsg.react("🔄")
    } else if (cleanContent.startsWith(",") && cleanContent.length === 1) {
        await originalMsg.react("▶")
    } else if (cleanContent.startsWith("?") && cleanContent.length === 1) {
        await originalMsg.react("⏩")
    }

    locked = true
    const message = await botService.onChannelMessage(
        originalMsg.author.username,
        channelName,
        cleanContent,
        process.env.BOTNAME)
    locked = false
    if (message && message.message && message.message.trim().length > 0) {
        if (cleanContent.startsWith("²") && cleanContent.length === 1) {
            channels[channelName].lastBotMessage.edit(message.message)
            originalMsg.delete()
        } else if (cleanContent.startsWith(",") && cleanContent.length === 1) {
            channels[channelName].lastBotMessage.edit(channels[channelName].lastBotMessage.cleanContent + message.message)
            originalMsg.delete()
        } else if (cleanContent.startsWith("?") && cleanContent.length === 1) {
            await originalMsg.channel.send(message.message)
            originalMsg.delete()
        } else {
            await originalMsg.inlineReply(message.message)
        }
    }
});

async function loop() {
    if (locked) return setTimeout(loop, getInterval())

    for (let channel in channels) {
        const msg = await commandService.talk(channel)
        if (msg.message && msg.message.trim()) {
            channels[channel].send(msg.message)
        }
    }
    setTimeout(loop, getInterval())
}

setTimeout(loop, getInterval())

module.exports = {}