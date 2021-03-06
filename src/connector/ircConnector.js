import {config} from "dotenv";

config()
import ircClient from "../irc/ircClient.js";
import botService from "../service/botService.js";
import {getInterval} from "../utils.js";
import messageCommands from "../command/messageCommands.js";
import historyCommands from "../command/memoryCommands.js";

let lastMessageTimestamp = Date.now()
let timeStep = getInterval()
let messagePenalty = 0

class IrcConnector {
    static sendMessage(to, message) {
        ircClient.say(to, message)
    }
}

function replaceAliasesInMessage(message, nick) {
    if (nick === "AliceBot") {
        return message
            .replace("AliceBot", nick)
            .replace("Alicebot", nick)
            .replace("alicebot", nick)
    } else if (nick === "GLaDOS") {
        return message
            .replace("glados", nick)
            .replace("Glados", nick)
    } else {
        return message
    }
}

/**
 * Makes the bot react to messages if its name is mentioned
 */
ircClient.addListener('message', async function (from, to, message) {
    resetLastMessageTimestamp()
    const isDM = !to.startsWith("#")
    const msg = await botService.onChannelMessage(from, isDM ? "##" + from : to, replaceAliasesInMessage(message, process.env.BOTNAME), ircClient.nick)
    if (msg && msg.message) {
        ircClient.say(isDM ? from : msg.channel, msg.message.trim())
        resetLastMessageTimestamp()
    }
});

/**
 * Makes the bot react when someone joins the channel
 * Also triggered when the bot joins at the start
 */
ircClient.addListener('join', async function (channel, nick) {
    resetLastMessageTimestamp()
    if (nick === process.env.BOTNAME) {
        const msg = historyCommands.deleteChannelHistory.call("!forget", "Noli", channel, [])
        if (msg && msg.message) {
            //ircClient.say(msg.channel, msg.message.trim())
            resetLastMessageTimestamp()
        }
    } else {
        const msg = await botService.onJoin(channel, nick)
        if (msg && msg.message) {
            ircClient.say(msg.channel, msg.message.trim())
            resetLastMessageTimestamp()
        }
    }
});

/**
 * Makes the bot react when someone leaves the channel
 */
ircClient.addListener('part', async function (channel, nick) {
    resetLastMessageTimestamp()
    const msg = await botService.onPart(channel, nick)
    if (msg && msg.message) {
        ircClient.say(msg.channel, msg.message.trim())
        resetLastMessageTimestamp()
    }
});

/**
 * Makes the bot react when someone quits the channel
 */
ircClient.addListener('quit', async function (nick) {
});

/**
 * Makes the bot react when someone is kicked from the channel
 */
ircClient.addListener('kick', async function (channel, nick, by, reason) {
    resetLastMessageTimestamp()
    const msg = await botService.onKick(channel, nick, by, reason)
    if (msg && msg.message) {
        ircClient.say(msg.channel, msg.message.trim())
        resetLastMessageTimestamp()
    }
});

/**
 * Makes the bot react when someone makes an action on the channel
 */
ircClient.addListener('action', async function (from, channel, text) {
    resetLastMessageTimestamp()
    const msg = await botService.onAction(channel, from, text)
    if (msg && msg.message) {
        ircClient.say(msg.channel, msg.message.trim())
        resetLastMessageTimestamp()
    }
});

/**
 * Makes the bot react to every PM
 */
ircClient.addListener('pm', async function (from, message) {

});

function resetLastMessageTimestamp() {
    lastMessageTimestamp = Date.now()
}

function wait(ms) {
    return new Promise((resolve => setTimeout(() => resolve(), ms)))
}

async function main() {
    while (true) {
        if (Date.now() - lastMessageTimestamp >= timeStep) {
            timeStep = getInterval()
            messagePenalty = 0
            const allowedChannels = process.env.ALLOWED_CHANNEL_NAMES
                .split(',')
                .map(c => c.trim())
            const msg = await messageCommands.talk.call(
                null,
                null,
                process.env.ALLOWED_CHANNEL_NAMES
                    .split(',')
                    .map(c => c.trim())[0]
            )
            if (msg && msg.message && msg.message.trim()) {
                ircClient.say(msg.channel, msg.message.trim())
                resetLastMessageTimestamp()
            }
        }
        await wait(1000)
    }
}

//main()

export default IrcConnector