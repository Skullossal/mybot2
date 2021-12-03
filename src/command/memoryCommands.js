require('dotenv').config()
const Command = require("./Command");
const memoryService = require("../memoryService");
const historyService = require("../historyService");
const channelBotTranslationService = require("../channelBotTranslationService");

const memoryCommands = {
    remember: new Command(
        "Remember",
        [],
        ["!remember "],
        process.env.ALLOW_REMEMBER,
        (msg, from, channel, command) => {
            const newRememberedThing = msg.replace(command, '').trim()
            memoryService.setUserMemoryInChannel(newRememberedThing, from, channel)
            return {
                message: "# Successfully added the memory!\nNew complete memory:\n" + newRememberedThing,
                success: true
            }
        }),
    alsoRemember: new Command(
        "Also Remember",
        [],
        ["!alsoRemember "],
        process.env.ALLOW_REMEMBER,
        (msg, from, channel, command) => {
            const currentRememberedThings = memoryService.getChannelMemoryForUser(channel, from)?.trim()
            const newRememberedThing = msg.replace(command, '').trim()
            if (newRememberedThing) {
                const fullThingToRemember = (currentRememberedThings + "\n" + newRememberedThing).trim()
                memoryService.setUserMemoryInChannel(fullThingToRemember, from, channel)
                return {
                    message: "# Successfully added the memory!\nNew complete memory:\n" + fullThingToRemember,
                    success: true
                }
            }
        }),
    showRemember: new Command(
        "Show Remember",
        [],
        ["!showRemember "],
        process.env.ALLOW_REMEMBER,
        (msg, from, channel, command) => {
            const memory = memoryService.getChannelMemoryForUser(channel, from)
            return {
                message: "# Your channel memory:\n" + memory,
                success: true
            }
        }),
    showAllRemember: new Command(
        "Show All Remember",
        [],
        ["!showAllRemember "],
        process.env.ALLOW_REMEMBER,
        (msg, from, channel, command) => {
            const memory = memoryService.getChannelMemory(channel)
            return {
                message: "# Channel memory:\n" + memory,
                success: true
            }
        }),
    forgetRemember: new Command(
        "Forget",
        ["!forget"],
        [],
        process.env.ALLOW_REMEMBER,
        (msg, from, channel, command) => {
            memoryService.forgetUserMemoryInChannel(from, channel)
            return {
                message: "# Successfully forgot the memory!",
                success: true
            }
        }),
    forgetAllRemember: new Command(
        "Forget All",
        ["!forgetAll"],
        [],
        process.env.ALLOW_WIPE_REMEMBER,
        (msg, from, channel, command) => {
            memoryService.forgetAllUserMemoryInChannel(channel)
            return {
                message: "# Successfully forgot the memories of everyone!",
                success: true
            }
        }),
    deleteChannelHistory: new Command(
        "Reset",
        ["!reset"],
        [],
        process.env.ALLOW_FORGET,   // TODO: rename to ALLOW_RESET
        (msg, from, channel, command) => {
            historyService.forgetChannelHistory(channel)
            let presentationMessage = ""
            const intro = channel.startsWith("##") ?
                channelBotTranslationService.getChannelBotTranslations(channel).introductionDm :
                channelBotTranslationService.getChannelBotTranslations(channel).introduction
            for (let i of intro) {
                if (i.from === process.env.BOTNAME) {
                    presentationMessage += i.msg + "\n"
                } else {
                    break
                }
            }
            if (presentationMessage) {
                return {
                    message:
                        `${presentationMessage.trim()}`,
                    success: true
                }
            }
        }),
}

memoryCommands.all = [
    memoryCommands.remember,
    memoryCommands.forgetRemember,
    memoryCommands.forgetAllRemember,
    memoryCommands.deleteChannelHistory,
]

module.exports = memoryCommands