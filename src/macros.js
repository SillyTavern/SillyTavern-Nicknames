/**
 * Macro environment integration for the Nicknames extension.
 *
 * Instead of registering deprecated macros, we use a MacroEnvBuilder provider
 * to modify the env.names.user and env.names.char values directly.
 */

import { MacroEnvBuilder, env_provider_order } from '../../../../../scripts/macros/engine/MacroEnvBuilder.js';
import { MacroRegistry, MacroCategory } from '../../../../../scripts/macros/engine/MacroRegistry.js';
import { groups, selected_group } from '../../../../../scripts/group-chats.js';
import { characters, name2 } from '../../../../../script.js';
import { getContext } from '/scripts/st-context.js';
import { getUserNickname, getCharNickname, getNicknameForCharAvatar, nicknameSettings, ContextLevel } from './nicknames.js';

let macrosRegistered = false;

/** Text appended to core macro descriptions when the nickname macro override is active. */
const NICKNAME_NOTE = ' [Using nicknames when available]';

/** Core macros whose names are overridden by the nickname env provider. */
const NICKNAME_AFFECTED_MACROS = /** @type {const} */ (['user', 'char', 'group', 'groupNotMuted', 'notChar']);

/** Stores the original descriptions so they can be restored when the setting is toggled off. */
const originalMacroDescriptions = /** @type {Map<string, string>} */ (new Map());

/**
 * Appends or removes the nickname note from core macro descriptions.
 * Should be called whenever the 'useForMacros' setting changes.
 */
export function syncCoreMacroDescriptions() {
    const enabled = nicknameSettings.useForMacros;
    for (const macroName of NICKNAME_AFFECTED_MACROS) {
        const def = MacroRegistry.getMacro(macroName);
        if (!def) continue;

        if (!originalMacroDescriptions.has(macroName)) {
            originalMacroDescriptions.set(macroName, def.description);
        }

        const original = originalMacroDescriptions.get(macroName);
        def.description = enabled ? `${original}${NICKNAME_NOTE}` : original;
    }
}

/**
 * Registers the extension's own nickname macros:
 * - {{userFull}} / {{charFull}}       — always the original name, ignoring override settings
 * - {{userNickname}} / {{charNickname}} — nickname if set, otherwise the original name
 */
function registerNicknameMacros() {
    MacroRegistry.registerMacro('userFull', {
        category: MacroCategory.NAMES,
        description: 'Your current Persona username, always the original full name regardless of nickname settings.',
        returns: 'Persona username (original, no nickname substitution).',
        handler: () => getContext().name1 ?? '',
    });

    MacroRegistry.registerMacro('charFull', {
        category: MacroCategory.NAMES,
        description: 'The character\'s name, always the original full name regardless of nickname settings.',
        returns: 'Character name (original, no nickname substitution).',
        handler: () => getContext().name2 ?? '',
    });

    MacroRegistry.registerMacro('userNickname', {
        category: MacroCategory.NAMES,
        description: 'Your current Persona nickname if one is set, otherwise falls back to the original username.',
        returns: 'Persona nickname, or original username if no nickname is set.',
        handler: () => getUserNickname().name ?? '',
    });

    MacroRegistry.registerMacro('charNickname', {
        category: MacroCategory.NAMES,
        description: 'The character\'s nickname if one is set, otherwise falls back to the original character name.',
        returns: 'Character nickname, or original name if no nickname is set.',
        handler: () => getCharNickname().name ?? '',
    });
}

/**
 * Registers the nickname env provider with MacroEnvBuilder.
 * Substitutes user/char names with their nicknames when 'useForMacros' is enabled.
 */
function registerEnvProvider() {
    MacroEnvBuilder.registerProvider((env, ctx) => {
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
        env.names.group = getGroupValue(ctx, { includeMuted: true });
        env.names.groupNotMuted = getGroupValue(ctx, { includeMuted: false });
        env.names.notChar = getGroupValue(ctx, { filterOutChar: true, includeUser: env.names.user });
    }, env_provider_order.NORMAL);
}

/**
 * Registers all macro contributions from the Nicknames extension:
 * the env provider for nickname substitution, the dedicated nickname macros,
 * and the initial description annotations on affected core macros.
 */
export function registerMacros() {
    if (macrosRegistered) return;

    registerEnvProvider();
    registerNicknameMacros();
    syncCoreMacroDescriptions();

    macrosRegistered = true;
}

/**
 * Gets the group value with nicknames applied to character names.
 * Mirrors the logic from MacroEnvBuilder.js but resolves nicknames for each character.
 *
 * @param {Object} ctx - The macro evaluation context (MacroEnvRawContext)
 * @param {Object} options
 * @param {boolean} [options.includeMuted=false] - Whether to include muted members
 * @param {boolean} [options.filterOutChar=false] - Whether to filter out the current character
 * @param {string} [options.includeUser=null] - User name to include if filterOutChar is true
 * @returns {string} Comma-separated list of names with nicknames applied
 */
function getGroupValue(ctx, { includeMuted = false, filterOutChar = false, includeUser = null } = {}) {
    if (typeof ctx?.groupOverride === 'string') return ctx.groupOverride;

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
