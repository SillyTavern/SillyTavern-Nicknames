/**
 * Macro environment integration for the Nicknames extension.
 *
 * Instead of registering deprecated macros, we use a MacroEnvBuilder provider
 * to modify the env.names.user and env.names.char values directly.
 */

import { MacroEnvBuilder, env_provider_order } from '../../../../../scripts/macros/engine/MacroEnvBuilder.js';
import { getUserNickname, getCharNickname, nicknameSettings, ContextLevel } from './nicknames.js';

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
    }, env_provider_order.NORMAL);

    providerRegistered = true;
}
