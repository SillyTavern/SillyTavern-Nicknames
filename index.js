import { injectUI, registerEventListeners } from './src/ui.js';
import { ensureSettings, migrateCharKeys, migrateChatCharKeys } from './src/nicknames.js';
import { registerMacroProvider } from './src/macros.js';
import { registerSlashCommands } from './src/slash-commands.js';
import { event_types, eventSource } from '/script.js';
import { getContext } from '/scripts/st-context.js';

export const EXTENSION_KEY = 'nicknames';
export const EXTENSION_NAME = 'SillyTavern-Nicknames';

let initCalled = false;
export let initialized = false;

/**
 * Extension initialization — called via the 'activate' lifecycle hook.
 */
export async function init() {
    if (initCalled) return;
    initCalled = true;

    console.debug(`[${EXTENSION_NAME}] Initializing...`);

    const version = SillyTavern.getContext().getExtensionManifest?.(EXTENSION_NAME)?.version ?? null;
    ensureSettings(version);

    await injectUI();
    registerEventListeners();

    registerMacroProvider();
    registerSlashCommands();
    registerNicknameEvents();

    console.debug(`[${EXTENSION_NAME}] Extension activated`);

    initialized = true;
}

/**
 * Registers event listeners for character rename events.
 */
function registerNicknameEvents() {
    eventSource.on(event_types.CHARACTER_RENAMED, /** @param {string} oldAvatarKey @param {string} newAvatarKey */
        (oldAvatarKey, newAvatarKey) => {
            migrateCharKeys(oldAvatarKey, newAvatarKey);

            // Also migrate chat-level mappings for current chat
            /** @type {import('./src/nicknames.js').NicknameMappings} */
            const chatMappings = getContext().chatMetadata[EXTENSION_KEY];
            if (chatMappings && chatMappings.chars[oldAvatarKey]) {
                chatMappings.chars[newAvatarKey] = chatMappings.chars[oldAvatarKey];
                delete chatMappings.chars[oldAvatarKey];
                // saveChatDebounced is called in migrateCharKeys via saveSettingsDebounced,
                // but we might need to save chat separately if we want the chat metadata persisted
            }
        });

    eventSource.on(event_types.CHARACTER_RENAMED_IN_PAST_CHAT, /** @param {Array<Object>} chat @param {string} oldAvatarKey @param {string} newAvatarKey */
        (chat, oldAvatarKey, newAvatarKey) => {
            migrateChatCharKeys(chat, oldAvatarKey, newAvatarKey);
        });
}
