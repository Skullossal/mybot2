require('dotenv').config()
const {Client} = require("discord.js")
require("../discord/ExtAPIMessage");
const voices = JSON.parse(JSON.stringify(require('../tts/languages.json')))

const bot = new Client({
    allowedMentions: {
        // set repliedUser value to `false` to turn off the mention by default
        repliedUser: false
    }
});

const botService = require('../botService')
const channelBotTranslationService = require('../channelBotTranslationService')
const {getInterval} = require("../utils")
const Utils = require("../utils")
const utils = require("../utils")
const updateBotInfo = require("./discordUtils");
const promptService = require("../promptService");
const aiService = require("../aiService");
const encoder = require("gpt-3-encoder")
const historyService = require("../historyService");
const messageCommands = require("../command/messageCommands");

bot.login(process.env.TOKEN)
const channels = []
let locked = false


let connection
let voiceChannel
let setJSONPersonality
let speak = null


function replaceAsterisksByBackQuotes(text) {
    return text.replace(/\*/g, '`')
}

function replaceBackQuotesByAsterisks(text) {
    return text.replace(/`/g, '*')
}

bot.on('ready', async () => {
    console.info(`Logged in as ${bot.user.tag}!`)
    process.env.BOTNAME = replaceAliases(bot.user.tag.replace(/#.*$/, ""))

    if (process.env.DISCORD_ACTIVITY_NAME) {
        const name = process.env.DISCORD_ACTIVITY_NAME
        const type = process.env.DISCORD_ACTIVITY_TYPE || "PLAYING"
        await bot.user.setActivity(name, {type})
    } else {
        await bot.user.setActivity()
    }

    setJSONPersonality = async function (msg, from, channel, roles) {
        const command = "!setJSONPersonality "

        if (msg.toLowerCase().startsWith(command.toLowerCase())) {

            if (!utils.checkPermissions(roles, process.env.ALLOW_SET_JSON_PERSONALITY, channel.startsWith("##"))) return true

            let success = true
            let errorMessages = ""

            if (!process.env.ENABLE_CUSTOM_AI || process.env.ENABLE_CUSTOM_AI.toLowerCase() !== "true") {
                return {message: "# Sorry, but this command is not enabled on this AI.", channel}
            }

            const personalityJSON = msg.replace(command, "")
            let personality
            try {
                personality = JSON.parse(personalityJSON)
            } catch (e) {
                return {message: "# JSON could not be parsed", channel}
            }

            const aiPersonality = channelBotTranslationService.getChannelBotTranslations(channel)

            if (personality.target !== undefined) {
                if (personality.target.toLowerCase() !== process.env.BOTNAME.toLowerCase()) {
                    return true
                }
            } else {
                return {
                    message: "# The `target` property is mandatory and should be a string containing the name of the target bot",
                    channel
                }
            }

            if (personality.username !== undefined && !channel.startsWith("##")) {
                try {
                    await bot.user.setUsername(personality.username)
                    process.env.BOTNAME = personality.username
                } catch (e) {
                    return {
                        message: `# Personality failed to load: Username already taken by too many people or was changed too recently`,
                        channel
                    }
                }
            }

            if (personality.avatar !== undefined && !channel.startsWith("##")) {
                try {
                    await bot.user.setAvatar(personality.avatar)
                } catch (e) {
                    return {
                        message: `# Personality failed to load: The avatar couldn't be loaded or was changed too recently`,
                        channel
                    }
                }
            }

            if (personality.description !== undefined) {
                aiPersonality.description = personality.description
            }

            if (personality.contextDm !== undefined) {
                aiPersonality.contextDm = personality.contextDm
            }

            if (personality.context !== undefined) {
                aiPersonality.context = personality.context
            }

            if (personality.noContextSentence !== undefined) {
                aiPersonality.noContextSentence = personality.noContextSentence
            }

            if (personality.noContextSentence !== undefined) {
                aiPersonality.noContextSentence = personality.noContextSentence
            }

            if (personality.voice !== undefined) {
                const selectedVoice = voices.voices
                    .find(v => v.name.toLowerCase() === personality.voice.toLowerCase())
                if (selectedVoice) {
                    aiPersonality.voice = selectedVoice
                } else {
                    success = false
                    errorMessages += "The voice isn't recognized\n"
                }
            }

            if (personality.introduction !== undefined) {
                aiPersonality.introduction = personality.introduction.split("\n").map((l) => {
                    return {
                        from: process.env.BOTNAME,
                        msg: l
                    }
                })
            }

            if (personality.introductionDm !== undefined) {
                aiPersonality.introductionDm = personality.introductionDm.split("\n").map((l) => {
                    return {
                        from: process.env.BOTNAME,
                        msg: l
                    }
                })
            }

            const JSONPersonality = JSON.parse(JSON.stringify(aiPersonality))

            if (personality.ENABLE_DM !== undefined) {
                process.env.ENABLE_DM = "" + personality.ENABLE_DM
                JSONPersonality.ENABLE_DM = "" + personality.ENABLE_DM
            }

            if (personality.ENABLE_TTS !== undefined) {
                process.env.ENABLE_TTS = "" + personality.ENABLE_TTS
                JSONPersonality.ENABLE_TTS = "" + personality.ENABLE_TTS
            }

            if (personality.ENABLE_INTRO !== undefined) {
                process.env.ENABLE_INTRO = "" + personality.ENABLE_INTRO
                JSONPersonality.ENABLE_INTRO = "" + personality.ENABLE_INTRO
            }

            if (personality.ENABLE_AUTO_ANSWER !== undefined) {
                process.env.ENABLE_AUTO_ANSWER = "" + personality.ENABLE_AUTO_ANSWER
                JSONPersonality.ENABLE_AUTO_ANSWER = "" + personality.ENABLE_AUTO_ANSWER
            }


            if (JSONPersonality?.voice?.name) {
                JSONPersonality.voice = JSONPersonality.voice.name
            }

            if (personality.voice !== undefined) {
                JSONPersonality.voice = aiPersonality.voice.name
            }

            if (JSONPersonality.introduction) {
                JSONPersonality.introduction = JSONPersonality.introduction.map(e => e.msg).join("\n")
            }

            if (JSONPersonality.introductionDm !== undefined) {
                JSONPersonality.introductionDm = JSONPersonality.introductionDm.map(e => e.msg).join("\n")
            }

            if (success && personality.avatar !== undefined) {
                JSONPersonality.avatar = personality.avatar
            }

            JSONPersonality.ENABLE_INTRO = process.env.ENABLE_INTRO
            JSONPersonality.ENABLE_DM = process.env.ENABLE_DM
            JSONPersonality.ENABLE_TTS = process.env.ENABLE_TTS
            JSONPersonality.ENABLE_AUTO_ANSWER = process.env.ENABLE_AUTO_ANSWER

            JSONPersonality.target = personality.target
            JSONPersonality.username = process.env.BOTNAME

            let stringJSONPersonality = JSON.stringify(JSONPersonality, null, 2)
            if (stringJSONPersonality.length > 1700) {
                stringJSONPersonality = JSON.stringify(JSONPersonality)
                if (stringJSONPersonality.length > 1700) {
                    stringJSONPersonality = "{ ...JSON was too long to fit into discord's 2000 character limit per message... }"
                }
            }
            return {
                message: "# " + (success ?
                        `Personality successfully loaded! `
                        : `Personality loaded, but there were errors while trying to edit the AI personality:\n${errorMessages}\n`)
                    + `Complete JSON for the loaded personality:\n${stringJSONPersonality}`
            }
        } else {
            return false
        }
    }

    speak = async function (msg, channel) {
        if (utils.getBoolFromString(process.env.ENABLE_TTS)) {
            if (!channelBotTranslationService.getChannelBotTranslations(channel)?.voice?.languageCode) return

            if (voiceChannel) {
                connection = bot.voice.connections.find((vc) => vc.channel.id === voiceChannel.id)
                if (!connection) {
                    console.log("No connection is present for TTS, getting connection...")
                    connection = await voiceChannel.join()
                    if (connection) {
                        console.log("TTS connection found!")
                    }
                }
                if (connection) {
                    await Utils.tts(connection, msg, channelBotTranslationService.getChannelBotTranslations(channel).voice)
                } else {
                    console.log("Could not establish TTS connection.")
                }
            }
        }
    }

    if (process.env.LOAD_CHANNEL_PERSONALITIES) {
        const personalityCodes = process.env.LOAD_CHANNEL_PERSONALITIES
            .split(",")
            .map(p => {
                const [channelName, personalityCode] = p.split(':')
                return {channelName, personalityCode}
            })

        personalityCodes.forEach(pc => {
            channelBotTranslationService.changeChannelBotTranslations(pc.channelName, pc.personalityCode)
        })
    }

    if (utils.getBoolFromString(process.env.ENABLE_INTRO)) {
        if (process.env.SEND_INTRO_TO_CHANNELS) {
            const introChannels = process.env.SEND_INTRO_TO_CHANNELS
                .split(",")
                .map(v => v.trim())

            bot.channels.cache.forEach(c => {
                if (introChannels.includes(`#${c.name.toLowerCase()}`)) {
                    if (channelBotTranslationService.getChannelBotTranslations("#" + c.name.toLowerCase()).introduction.length > 0) {
                        c.send(replaceAsterisksByBackQuotes(`${channelBotTranslationService.getChannelBotTranslations("#" + c.name.toLowerCase()).introduction[0].msg}`)).catch(() => null)
                    }
                }
            })
        }
    }

    updateBotInfo(bot)
});

// TODO: add configurations for aliases
function replaceAliases(nick) {
    if (nick === "AliceBot") {
        return "Alice"
    }
    return nick
}

function replaceAliasesInMessage(message, nick) {
    if (nick === "AliceBot") {
        return message
            .replace("AliceBot", nick)
            .replace("Alicebot", nick)
            .replace("alicebot", nick)
    }

    if (nick === "GLaDOS") {
        return message
            .replace("glados", nick)
            .replace("Glados", nick)
    }

    if (nick === "Lulune") {
        return message
            .replace("Lulu", nick)
    }
    return message
}

bot.on('message', async msg => {
    const privateMessage = msg.channel.type === "dm"
    if (privateMessage && (!process.env.ENABLE_DM || process.env.ENABLE_DM.toLowerCase() !== "true")) {
        return
    }
    const channelName = privateMessage ?
        "##" + replaceAliases(msg.channel.id)
        : "#" + msg.channel.name


    if (!Utils.isMessageFromAllowedChannel(channelName)) {
        return
    }

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

    const cleanContent = replaceAliasesInMessage(replaceBackQuotesByAsterisks(originalMsg.cleanContent), process.env.BOTNAME)
    const userRoles = originalMsg.member?.roles?.cache.map(r => {
        return {id: r.id, name: r.name}
    }) || []

    // React to commands
    if ((cleanContent.startsWith("²") || cleanContent.startsWith("○")) && cleanContent.length === 1) {
        await originalMsg.react("🔄").catch(() => null)
    } else if (cleanContent.startsWith(",") && cleanContent.length === 1) {
        await originalMsg.react("▶").catch(() => null)
    } else if (cleanContent.startsWith("?") && cleanContent.length === 1) {
        await originalMsg.react("⏩").catch(() => null)
    } else if (cleanContent === "!reset") {
        await originalMsg.react("💔").catch(() => null)
        setTimeout(() => {
            originalMsg.delete().catch(() => null)
        }, 3000)
    } else if (cleanContent.startsWith("!setJSONPersonality ")) {
        if (!setJSONPersonality) {
            await originalMsg.inlineReply("# Sorry, but this command is not fully loaded. Please try again later!").catch(() => null)
            return
        }

        if (!utils.checkPermissions(userRoles, process.env.ALLOW_SET_JSON_PERSONALITY, privateMessage)) {
            await originalMsg.react("⛔").catch(() => null)
            return
        }

        const r = await setJSONPersonality(originalMsg.cleanContent, replaceAliases(originalMsg.author.username), channelName, userRoles)
        if (r && r.message) {
            await originalMsg.inlineReply(r.message).catch(() => null)
        } else if (r && r.error) {
            await originalMsg.react("❌").catch(() => null)
        }
    }

    locked = true
    const message = await botService.onChannelMessage(
        replaceAliases(originalMsg.author.username),
        channelName,
        cleanContent,
        process.env.BOTNAME,
        userRoles)
    locked = false

    if (message && message.error) {
        await originalMsg.react("❌").catch(() => null)
        await originalMsg.inlineReply(message.error).catch(() => null)
    }
    if (message && message.permissionError) {
        await originalMsg.react("⛔").catch(() => null)
    } else if (message?.message?.trim().length > 0) {
        const parsedMessage = replaceAsterisksByBackQuotes(message.message)
        if (message.success) {
            await originalMsg.react("✅").catch(() => null)
        }
        voiceChannel = msg.member?.voice?.channel
        const timeToWait = encoder.encode(message.message).length * 50
        channels[channelName].startTyping().then()
        await utils.sleep(timeToWait)
        if (cleanContent.startsWith("²") && cleanContent.length === 1) {
            channels[channelName].lastBotMessage?.edit(parsedMessage)
            originalMsg.delete().catch(() => null)
        } else if (cleanContent.startsWith(",") && cleanContent.length === 1) {
            channels[channelName].lastBotMessage?.edit(channels[channelName].lastBotMessage.cleanContent + parsedMessage)
            originalMsg.delete().catch(() => null)
        } else if (cleanContent.startsWith("?") && cleanContent.length === 1) {
            await originalMsg.channel.send(parsedMessage).catch(() => null)
            originalMsg.delete().catch(() => null)
        } else if (cleanContent.startsWith("!danbooru") && message.error) {
            await originalMsg.react("🤷").catch(() => null)
            channels[channelName].stopTyping(true)
            await originalMsg.react("🇹").catch(() => null)
            await utils.sleep(200)
            await originalMsg.react("🇷").catch(() => null)
            await utils.sleep(200)
            await originalMsg.react("🇾").catch(() => null)
            await utils.sleep(200)
            await originalMsg.react("🔄").catch(() => null)
            await utils.sleep(3000)
            originalMsg.delete().catch(() => null)
            channels[channelName].stopTyping(true)
            return
        } else if (message.message.startsWith("\nLoaded bot")) {
            await originalMsg.inlineReply(parsedMessage).catch(() => null)
            if (speak) await speak(message.message.split("\n")[2], channelName)
            channels[channelName].stopTyping(true)
            return
        } else if (cleanContent.startsWith("!property") || cleanContent.startsWith("!event")) {
            await originalMsg.react("✅").catch(() => null)
        } else if (originalMsg) {
            await originalMsg.inlineReply(parsedMessage).catch(() => null)
        }

        channels[channelName].stopTyping(true)
        if (speak && !message.message.startsWith("#")) {
            await speak(message.message, channelName)
        }
    }
});

async function loop() {
    // Waits two seconds if an answer is still generating
    if (locked) return setTimeout(loop, 2000)

    if (utils.getBoolFromString(process.env.ENABLE_AUTO_ANSWER)) {
        for (let channel in channels) {
            const msg = await messageCommands.talk.call(null, null, channel, [])
            // If normal answer
            if (msg && msg.message?.trim()) {
                const parsedMessage = replaceAsterisksByBackQuotes(msg.message)
                const timeToWait = encoder.encode(parsedMessage).length * 50
                channels[channel].startTyping().then()
                await utils.sleep(timeToWait)
                channels[channel].send(parsedMessage).catch(() => null)
                if (!channel.startsWith("##")) {
                    await speak(parsedMessage, channel)
                }
                channels[channel].stopTyping(true)
            }
        }
    }

    setTimeout(loop, getInterval())
}

setInterval(async () => {
// Waits two seconds if an answer is still generating
    if (locked) return setTimeout(loop, 2000)

    if (utils.getBoolFromString(process.env.ENABLE_AUTO_ANSWER)) {
        for (let channel in channels) {
            // TODO: put into a command
            const history = historyService.getChannelHistory(channel)
            if (history.length > 0 && (history[history.length - 1].timestamp >
                Date.now() - (parseInt(process.env.INTERVAL_AUTO_MESSAGE_CHECK || "30") * 1000)
            || history[history.length - 1].from !== process.env.BOTNAME)) {
                continue
            }
            const tokenCount = Math.min(150, encoder.encode(process.env.BOTNAME).length)
            const prompt = promptService.getPrompt(null, null, channel, true).prompt + "\n"
            const result = await aiService.simpleEvalbot(prompt, tokenCount, channel.startsWith("##"))
            // If next message is from the AI
            if (result === process.env.BOTNAME) {
                const prompt = promptService.getPrompt(null, null, channel)
                const answer = await aiService.sendUntilSuccess(prompt, channel.startsWith("##"))
                if (answer) {
                    const parsedMessage = replaceAsterisksByBackQuotes(answer)
                    const timeToWait = encoder.encode(parsedMessage).length * 50
                    channels[channel].startTyping().then()
                    await utils.sleep(timeToWait)
                    historyService.pushIntoHistory(answer, process.env.BOTNAME, channel)
                    channels[channel].send(parsedMessage).catch(() => null)
                    channels[channel].stopTyping(true)
                }
            }
        }
    }
}, parseInt(process.env.INTERVAL_AUTO_MESSAGE_CHECK || "60") * 1000)

setTimeout(loop, getInterval())

module.exports = {}