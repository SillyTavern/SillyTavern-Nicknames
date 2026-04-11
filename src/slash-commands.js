/**
 * Slash command registrations for the Nicknames extension.
 */

import { SlashCommand } from '../../../../slash-commands/SlashCommand.js';
import { SlashCommandNamedArgument, ARGUMENT_TYPE, SlashCommandArgument } from '../../../../slash-commands/SlashCommandArgument.js';
import { enumIcons } from '../../../../slash-commands/SlashCommandCommonEnumsProvider.js';
import { SlashCommandEnumValue, enumTypes } from '../../../../slash-commands/SlashCommandEnumValue.js';
import { SlashCommandParser } from '../../../../slash-commands/SlashCommandParser.js';
import { ContextLevel, handleNickname, getUserNickname, getCharNickname } from './nicknames.js';
import { refreshAllUI } from './ui.js';

export const RESET_NICKNAME_LABEL = '#reset';

/**
 * Sets a nickname and refreshes the UI.
 * @param {'user'|'char'} type
 * @param {string|null} nickname
 * @param {string|null} context
 * @param {boolean} reset
 * @returns {string}
 */
function setNicknameWithRefresh(type, nickname, context, reset = false) {
    try {
        const result = handleNickname(type, nickname, context, { reset });
        if (result || reset) {
            // Refresh all UI components
            refreshAllUI();
        }
        return result?.name ?? '';
    } catch (error) {
        toastr.error(`Error: ${error?.message}`, 'Nicknames');
        return '';
    }
}

/** @type {(args: { for: ('char'|'chat'|'global')? }, nickname: string) => string} */
function nicknameUserCallback(args, nickname) {
    if (!nickname) {
        // Get only - return effective nickname
        return getUserNickname().name ?? '';
    }
    // Set with refresh
    return setNicknameWithRefresh('user', nickname, args.for, nickname === RESET_NICKNAME_LABEL);
}

/** @type {(args: { for: ('char'|'chat'|'global')? }, nickname: string) => string} */
function nicknameCharCallback(args, nickname) {
    if (!nickname) {
        // Get only - return effective nickname
        return getCharNickname().name ?? '';
    }
    // Set with refresh
    return setNicknameWithRefresh('char', nickname, args.for, nickname === RESET_NICKNAME_LABEL);
}

/**
 * Registers all nickname slash commands.
 */
export function registerSlashCommands() {
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'nickname-user',
        aliases: ['nickname-persona'],
        callback: nicknameUserCallback,
        returns: 'nickname of the current user',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'for',
                description: 'The context for the nickname. Must be provided on set. If non provided for get, the actual used nickname (first defined) will be returned.',
                typeList: [ARGUMENT_TYPE.STRING],
                enumList: [
                    new SlashCommandEnumValue(ContextLevel.GLOBAL, null, enumTypes.namedArgument, 'G'),
                    new SlashCommandEnumValue(ContextLevel.CHAR, null, enumTypes.enum, enumIcons.character),
                    new SlashCommandEnumValue(ContextLevel.CHAT, null, enumTypes.enum, enumIcons.message),
                ],
                forceEnum: true,
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'The nickname to set (or \'#reset\' to remove the nickname)',
                typeList: [ARGUMENT_TYPE.STRING],
                enumList: [
                    new SlashCommandEnumValue(RESET_NICKNAME_LABEL, 'Resets the nickname (removing it from this context)', enumTypes.enum, '❌'),
                    new SlashCommandEnumValue(
                        'a nickname',
                        null,
                        enumTypes.name,
                        enumIcons.default,
                        (input) => /^[\w\w]*$/.test(input),
                        (input) => input,
                    ),
                ],
            }),
        ],
        helpString: 'Sets or gets the nickname for the current user (persona). Without arguments, returns the current effective nickname. With a nickname argument, sets it for the specified context (defaults to global if not specified).',
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'nickname-char',
        callback: nicknameCharCallback,
        returns: 'nickname of the current character',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'for',
                description: 'The context for the nickname. Must be provided on set. If non provided for get, the actual used nickname (first defined) will be returned.',
                typeList: [ARGUMENT_TYPE.STRING],
                enumList: [
                    new SlashCommandEnumValue(ContextLevel.GLOBAL, null, enumTypes.namedArgument, 'G'),
                    new SlashCommandEnumValue(ContextLevel.CHAR, null, enumTypes.enum, enumIcons.character),
                    new SlashCommandEnumValue(ContextLevel.CHAT, null, enumTypes.enum, enumIcons.message),
                ],
                forceEnum: true,
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'The nickname to set (or \'#reset\' to remove the nickname)',
                typeList: [ARGUMENT_TYPE.STRING],
                enumList: [
                    new SlashCommandEnumValue(RESET_NICKNAME_LABEL, 'Resets the nickname (removing it from this context)', enumTypes.enum, '❌'),
                    new SlashCommandEnumValue(
                        'a nickname',
                        null,
                        enumTypes.name,
                        enumIcons.default,
                        (input) => /^[\w\w]*$/.test(input),
                        (input) => input,
                    ),
                ],
            }),
        ],
        helpString: 'Sets or gets the nickname for the current character. Without arguments, returns the current effective nickname. With a nickname argument, sets it for the specified context (defaults to global if not specified). Character-level setting is not available for characters (only works for user/persona).',
    }));
}
