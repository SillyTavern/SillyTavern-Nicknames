import { injectUI, registerUIEventListeners, resolveV3SpecConflict } from './src/ui.js';
import { ensureSettings, registerDataEventListeners, cleanAllNicknameData } from './src/nicknames.js';
import { registerMacroProvider } from './src/macros.js';
import { registerSlashCommands } from './src/slash-commands.js';

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

    registerDataEventListeners({ onV3SpecConflict: resolveV3SpecConflict });

    await injectUI();
    registerUIEventListeners();

    registerMacroProvider();
    registerSlashCommands();

    console.debug(`[${EXTENSION_NAME}] Extension activated`);

    initialized = true;
}

/**
 * Extension clean hook — called when the extension is uninstalled.
 * Removes all nickname data from extension settings.
 * Note: nickname data stored in individual chat files (chat-level mappings)
 * cannot be automatically cleaned without loading and re-saving every chat.
 */
export async function clean() {
    console.debug(`[${EXTENSION_NAME}] Running clean hook...`);
    await cleanAllNicknameData();
    console.debug(`[${EXTENSION_NAME}] Clean complete.`);
}
