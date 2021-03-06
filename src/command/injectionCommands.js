import {config} from "dotenv";

config()
import Command from "./Command.js";
import historyService from "../service/historyService.js";
import utils from "../utils.js";


const injectionCommands = {
    event: new Command(
        "Inject Event",
        [],
        ["!event "],
        process.env.ALLOW_EVENT_INJECTION_MESSAGE,
        async (msg, from, channel, command, roles, messageId, targetMessageId) => {
            const event = msg.replace(command, "").trim()
            if (event) {
                const formattedEvent = event.startsWith("[") && event.endsWith("]") ? event :
                    `[ Event: ${event.trim()} ]`

                return {
                    message: formattedEvent, success: true, deleteUserMsg: true,
                    pushIntoHistory: [formattedEvent, null, channel]
                }
            }
        },
        false
    ),
    property: new Command(
        "Inject Property",
        [],
        ["!property "],
        process.env.ALLOW_PROPERTY_INJECTION_MESSAGE,
        async (msg, from, channel, command, roles, messageId, targetMessageId) => {
            const fullCommand = msg.replace(command, "").trim()
            const words = fullCommand.split(" ")
            const key = words.shift().replace(':', '')
            const value = words.join(" ")

            if (key && value) {
                const formattedEvent = `[ ${utils.upperCaseFirstLetter(key)}: ${value.trim()} ]`
                return {
                    message: formattedEvent, success: true, deleteUserMsg: true,
                    pushIntoHistory: [formattedEvent, null, channel]
                }
            }
        },
        false
    ),
}

injectionCommands.all = [
    injectionCommands.event,
    injectionCommands.property
]

export default injectionCommands