require('dotenv').config()
const Command = require("./Command");
const utils = require("../utils");
const aiService = require("../aiService");
const loreGenerationToolEntries = require("../../data/generationPrompt/loreGenerationToolEntries.json");
const encoder = require("gpt-3-encoder");

const promptCommands = {
    prompt: new Command(
        "Prompt",
        [],
        ["!prompt "],
        process.env.ALLOW_PROMPT_MESSAGE,
        async (msg, from, channel, command) => {
            const args = /!prompt *(\d*)\n/g.exec(msg);
            if (args && args[1]) {
                const message = utils.upperCaseFirstLetter(msg.replace(args[0], ""))
                const tokenCount = Math.min(150, parseInt(args[1]))
                const result = await aiService.simpleEvalbot(message, tokenCount, channel.startsWith("##"))
                return {message: result, success: true}
            }
        },
        false
    ),
    lgt: new Command(
        "Lore Generation Tool",
        [],
        ["!lgt "],
        process.env.ALLOW_LORE_GENERATION_TOOL,
        async (msg, from, channel, command) => {
            let input = utils.upperCaseFirstLetter(msg.replace(command, "").trim())
            if (input) {
                const placeholder = `INPUT: ${input}\nOUTPUT:`
                const placeholderLength = encoder.encode(placeholder).length

                const match = input.match(/^([1-3]) ([^\n]*)/)
                let nbResults
                if (match && match[1] && match[2]) {
                    input = match[2]
                    nbResults = parseInt(match[1])
                } else {
                    nbResults = 1
                }

                let results = []
                for (let i = 0; i < nbResults; i++) {
                    let prompt = ``
                    while (true) {
                        const entries = utils.shuffleArray(loreGenerationToolEntries)
                        const entry = entries.pop()
                        const currentPromptLength = encoder.encode(prompt).length
                        const entryText = `INPUT: ${entry.INPUT}\nOUTPUT: ${entry.OUTPUT}\nKEYS: ${entry.KEYS}\n⁂\n`
                        const entryLength = encoder.encode(entryText).length
                        if (currentPromptLength + entryLength + placeholderLength >= 2048 - 150) {
                            break
                        } else {
                            prompt += entryText
                        }
                    }
                    const result = await aiService.simpleEvalbot(prompt + placeholder, 150, channel.startsWith("##"))
                    results.push(result.trimEnd())
                }

                if (results.length === 1) {
                    return {message: "# " + results[0], success: true}
                } else {
                    return {
                        message: results.map((result, index) => `# Result ${index + 1}:${result}`).join('\n'),
                        success: true
                    }
                }
            } else {
                return {error: "# You have to provide an input after the command"}
            }
        },
        false
    ),
}

promptCommands.all = [
    promptCommands.prompt,
    promptCommands.lgt,
]

module.exports = promptCommands