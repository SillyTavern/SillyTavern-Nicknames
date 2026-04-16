/**
 * Macro environment integration for the Nicknames extension.
 *
 * Instead of registering deprecated macros, we use a MacroEnvBuilder provider
 * to modify the env.names.user and env.names.char values directly.
 */

import { MacroEnvBuilder, env_provider_order } from '../../../../../scripts/macros/engine/MacroEnvBuilder.js';
import { groups, selected_group } from '../../../../../scripts/group-chats.js';
import { characters, name2 } from '../../../../../script.js';
import { getUserNickname, getCharNickname, getNicknameForCharAvatar, nicknameSettings, ContextLevel } from './nicknames.js';

let providerRegistered = false;

/**
 * Registers the nickname provider with the MacroEnvBuilder.
 * This modifies the macro environment to use nicknames for user/char names.
 */
export function registerMacroProvider() {
    if (providerRegistered) return;

    MacroEnvBuilder.registerProvider((env) => {
        if (!nicknameSettings.useForMacros) return;

        const userResult = getUserNickname();
        if (userResult.name && userResult.context !== ContextLevel.NONE) {
            env.names.user = userResult.name;
        }

        const charResult = getCharNickname();
        if (charResult.name && charResult.context !== ContextLevel.NONE) {
            env.names.char = charResult.name;
        }

        // Recompute group values with nicknames applied
        // These are originally computed before providers run, so we need to recalculate
        env.names.group = getGroupValue({ includeMuted: true });
        env.names.groupNotMuted = getGroupValue({ includeMuted: false });
        env.names.notChar = getGroupValue({ filterOutChar: true, includeUser: env.names.user });
    }, env_provider_order.NORMAL);

    providerRegistered = true;
}

/**
 * Gets the group value with nicknames applied to character names.
 * Mirrors the logic from MacroEnvBuilder.js but resolves nicknames for each character.
 *
 * @param {Object} options
 * @param {boolean} [options.includeMuted=false] - Whether to include muted members
 * @param {boolean} [options.filterOutChar=false] - Whether to filter out the current character
 * @param {string} [options.includeUser=null] - User name to include if filterOutChar is true
 * @returns {string} Comma-separated list of names with nicknames applied
 */
function getGroupValue({ includeMuted = false, filterOutChar = false, includeUser = null } = {}) {
    const charResult = getCharNickname();
    const currentCharNickname = charResult.name && charResult.context !== ContextLevel.NONE
        ? charResult.name
        : null;

    if (!selected_group) {
        return filterOutChar ? (includeUser || '') : (currentCharNickname || name2 || '');
    }

    const groupEntry = Array.isArray(groups) ? groups.find(x => x && x.id === selected_group) : null;
    const members = /** @type {string[]} */ (groupEntry?.members ?? []);
    const disabledMembers = /** @type {string[]} */ (groupEntry?.disabled_members ?? []);

    const names = Array.isArray(members)
        ? members
            .filter(((id) => includeMuted ? true : !disabledMembers.includes(id)))
            .map(m => Array.isArray(characters) ? characters.find(c => c && c.avatar === m) : null)
            .filter(c => !!c && typeof c.name === 'string')
            .filter(c => !filterOutChar || c.name !== name2)
            .map(c => {
                // Apply nickname if available, otherwise use original name
                const nicknameResult = getNicknameForCharAvatar(c.avatar);
                return nicknameResult.name && nicknameResult.context !== ContextLevel.NONE
                    ? nicknameResult.name
                    : c.name;
            })
            .join(', ')
        : '';

    return names;
}
