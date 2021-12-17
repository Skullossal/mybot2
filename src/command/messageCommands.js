import {config} from "dotenv";
import Command from "./Command.js";
import historyService from "../service/historyService.js";
import utils from "../utils.js";
import promptService from "../service/promptService.js";
import aiService from "../service/aiService.js";
import translationsService from "../service/translationService.js";

config()


const messageCommands = {
    noContextMessage: new Command(
        "No Context Message",
        [],
        ["!!"],
        process.env.ALLOW_NO_CONTEXT_MESSAGE,
        async (msg, from, channel, command, roles, messageId, targetMessageId) => {
            const message = utils.upperCaseFirstLetter(msg.replace(command, '').trim())
            historyService.pushIntoHistory(message, from, channel, messageId)
            const prompt = promptService.getNoContextPrompt(message, from, channel)
            const answer = await aiService.sendUntilSuccess({
                prompt,
                repetition_penalty_range: 1024
            }, channel.startsWith("##"), channel)
            return {
                message: answer, success: true, reactWith: "🙈",
                pushIntoHistory: [answer, process.env.BOTNAME, channel]
            }
        },
        false
    ),
    continueMessage: new Command(
        "Continue Message",
        [",", "!continue"],
        [],
        process.env.ALLOW_CONTINUE_MESSAGE,
        async (msg, from, channel, command, roles, messageId, targetMessageId) => {
            const prompt = promptService.getPrompt(channel, true, false)
            const answer = await aiService.sendUntilSuccess(prompt, channel.startsWith("##"), channel)
            historyService.getChannelHistory(channel).reverse()
            for (let h of historyService.getChannelHistory(channel)) {
                if (h.from === process.env.BOTNAME) {
                    h.msg += answer
                    break
                }
            }
            historyService.getChannelHistory(channel).reverse()
            return {message: answer, success: true, deleteUserMsg: true, appendToLastMessage: true, reactWith: "▶"}
        },
        false
    ),
    retryMessage: new Command(
        "Retry Message",
        ["²", "○", "!retry"],
        ["!retry "],
        process.env.ALLOW_RETRY_MESSAGE,
        async (msg, from, channel, command, roles, messageId, targetMessageId) => {
            const prompt = promptService.getPrompt(channel, false, true)
            const answer = await aiService.sendUntilSuccess(prompt, channel.startsWith("##"), channel)
            historyService.getChannelHistory(channel).reverse()
            for (let h of historyService.getChannelHistory(channel)) {
                if (h.from === process.env.BOTNAME) {
                    h.msg = answer
                    break
                }
            }
            historyService.getChannelHistory(channel).reverse()
            return {message: answer, success: true, deleteUserMsg: true, editLastMessage: true, reactWith: "🔄"}
        },
        false
    ),
    deleteMessage: new Command(
        "Delete Message",
        [],
        ["!delete "],
        process.env.ALLOW_DELETE_MESSAGE,
        async (msg, from, channel, command, roles, messageId, targetMessageId) => {
            const success = historyService.delete(channel, targetMessageId)
            if (success) {
                return {success: true, deleteUserMsg: true, deleteMessage: targetMessageId}
            }
            return {reactWith: `🤷`, deleteUserMsg: true}
        },
        true
    ),
    pruneMessages: new Command(
        "Prune Messages",
        [],
        ["!prune "],
        process.env.ALLOW_PRUNE_MESSAGES,
        async (msg, from, channel, command, roles, messageId, targetMessageId) => {
            const success = historyService.prune(channel, targetMessageId)
            if (success) {
                return {success: true, deleteUserMsg: true, deleteMessagesUpTo: targetMessageId}
            }
            return {reactWith: `🤷`, deleteUserMsg: true}
        },
        true
    ),
    editMessage: new Command(
        "Edit Message",
        [],
        ["!edit "],
        process.env.ALLOW_EDIT_MESSAGE,
        async (msg, from, channel, command, roles, messageId, targetMessageId) => {
            let message = utils.upperCaseFirstLetter(msg.replace(command, '').trim())
            if (targetMessageId)
                message = utils.upperCaseFirstLetter(message.replace("#" + targetMessageId, '').trim())
            historyService.getChannelHistory(channel).reverse()
            for (let h of historyService.getChannelHistory(channel)) {
                if (h.messageId === targetMessageId) {
                    h.msg = message
                    break
                }
            }
            historyService.getChannelHistory(channel).reverse()
            return {message: message, success: true, deleteUserMsg: true, editLastMessage: !targetMessageId, editMessage: targetMessageId}
        },
        false
    ),
    answerMessage: new Command(
        "Answer Message",
        [],
        ["?", "!talk"],
        process.env.ALLOW_ANSWER_MESSAGE,
        async (msg, from, channel, command, roles, messageId, targetMessageId) => {
            const message = utils.upperCaseFirstLetter(msg.replace(command, '').trim())
            if (message) {
                historyService.pushIntoHistory(message, from, channel, messageId)
            }
            const prompt = promptService.getPrompt(channel)
            const answer = await aiService.sendUntilSuccess(prompt, channel.startsWith("##"), channel)
            return {
                message: answer, success: true, reactWith: "⏩",
                pushIntoHistory: [answer, process.env.BOTNAME, channel]
            }
        },
        false
    ),
    forceTalk: new Command(
        "Force Message",
        ["?", "!talk"],
        [],
        process.env.ALLOW_ANSWER_MESSAGE,
        async (msg, from, channel, command, roles, messageId, targetMessageId) => {
            const message = utils.upperCaseFirstLetter(msg.replace(command, '').trim())
            if (message) {
                historyService.pushIntoHistory(message, from, channel, messageId)
            }
            const prompt = promptService.getPrompt(channel)
            const answer = await aiService.sendUntilSuccess(prompt, channel.startsWith("##"), channel)
            return {
                message: answer, success: true, deleteUserMsg: true, reactWith: "⏩",
                pushIntoHistory: [answer, process.env.BOTNAME, channel]
            }
        },
        false
    ),
    comment: new Command(
        "Comment Message",
        [],
        ["#"],
        process.env.ALLOW_COMMENT_MESSAGE,
        (msg, from, channel, command) => {
            // Do nothing (ignore the comment message)
        }),
    answerToName: new Command(
        "Answer to Name",
        [],
        [],
        null,
        async (msg, from, channel, command, roles, messageId, targetMessageId) => {
            historyService.pushIntoHistory(msg, from, channel, messageId)

            if (!utils.checkPermissions(roles, process.env.ALLOW_REPLY_TO_NAME, channel.startsWith("##"))) {
                return
            }

            if (msg.toLowerCase().includes(process.env.BOTNAME.toLowerCase())) {
                const prompt = promptService.getPrompt(channel)
                const answer = await aiService.sendUntilSuccess(prompt, channel.startsWith("##"), channel)
                return {
                    message: answer,
                    pushIntoHistory: [answer, process.env.BOTNAME, channel]
                }
            }
        },
        false
    ),
    talk: new Command(
        "Talk",
        [],
        [],
        null,
        async (msg, from, channel, command, roles, messageId, targetMessageId) => {
            if (!utils.getBoolFromString(process.env.ENABLE_AUTO_ANSWER)) return false

            const history = historyService.getChannelHistory(channel)
            const lastMessageFromChannel = history && history.length > 0 ?
                history[history.length - 1]
                : null
            const lastMessageIsOldEnough = !lastMessageFromChannel ?
                false :
                Date.now() - lastMessageFromChannel.timestamp > (parseInt(process.env.MIN_BOT_MESSAGE_INTERVAL) * 1000)
            if (lastMessageIsOldEnough && lastMessageFromChannel?.from !== process.env.BOTNAME) {
                const prompt = promptService.getPrompt(channel)
                const answer = await aiService.sendUntilSuccess(prompt, channel.startsWith("##"), channel)
                if (answer) {
                    return {
                        message: answer,
                        pushIntoHistory: [answer, process.env.BOTNAME, channel]
                    }
                }
            }
        },
        false
    ),
    reactToAction: new Command(
        "React to Action",
        [],
        [],
        process.env.ALLOW_REACTIONS,
        async (msg, from, channel, command, roles, messageId, targetMessageId) => {
            const action = translationsService.translations.onAction
                .replace("${text}", utils.upperCaseFirstLetter(msg.trim()))
            historyService.pushIntoHistory(action, from, channel, messageId)
            const prompt = promptService.getPrompt(channel)
            const answer = await aiService.sendUntilSuccess(prompt, channel.startsWith("##"), channel)
            return {
                message: answer,
                pushIntoHistory: [answer, process.env.BOTNAME, channel]
            }
        },
        false
    ),
}

messageCommands.all = [
    messageCommands.deleteMessage,
    messageCommands.pruneMessages,
    messageCommands.forceTalk,
    messageCommands.comment,
    messageCommands.noContextMessage,
    messageCommands.continueMessage,
    messageCommands.retryMessage,
    messageCommands.editMessage,
    messageCommands.answerMessage,
    messageCommands.answerToName,
    // messageCommands.talk,
    // messageCommands.reactToAction,
]

export default messageCommands