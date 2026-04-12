/**
 * Core nickname data and settings management for the Nicknames extension.
 */

import { saveSettingsDebounced, saveChatDebounced, user_avatar } from '../../../../../script.js';
import { extension_settings } from '../../../../extensions.js';
import { EXTENSION_KEY } from '../index.js';

/** @enum {string} The context levels at which nicknames can be set */
export const ContextLevel = {
    /** Set to global level, per account */
    GLOBAL: 'global',
    /** Set to character level (only available for personas) */
    CHAR: 'char',
    /** Set to chat level (saved with the chat file) */
    CHAT: 'chat',
    /** No context level (no nickname, using normal name) */
    NONE: 'none',
};

/**
 * Result of a nickname lookup
 * @typedef {Object} NicknameResult
 * @property {ContextLevel} context - The level at which this nickname is set
 * @property {string?} name - The nickname
 */

/**
 * Collection of mappings between characters/personas and nicknames
 * @typedef {Object} NicknameMappings
 * @property {{[personaKey: string]: string}} personas - Mapping of persona keys to a persona nickname.
 * @property {{[charKey: string]: string}} chars - Mapping of character keys to a character nickname.
 */

/**
 * Settings object containing nickname mappings.
 * @typedef {Object} NicknameSettings
 * @property {Object} mappings - Collection of mappings between characters/personas and nicknames
 * @property {{[charKey: string]: { personas: {[personaKey: string]: string}}}} mappings.char - Mapping of character keys to persona nicknames.
 * @property {NicknameMappings} mappings.global - Global mappings for personas and characters.
 * @property {boolean} useForCharList - Whether to use nickname in character list.
 * @property {boolean} useForChatMessages - Whether to use nickname as name for chat messages.
 * @property {boolean} useForMacros - Whether to use nickname as {{user}}/{{char}} in macros and outgoing prompts.
 */

// ---------------------------------------------------------------------------
// Setting Keys
// ---------------------------------------------------------------------------

export const settingKeys = Object.freeze({
    CUR_VERSION: '_curVersion',
    USE_FOR_CHAR_LIST: 'useForCharList',
    USE_FOR_CHAT_MESSAGES: 'useForChatMessages',
    USE_FOR_MACROS: 'useForMacros',
});

const defaultSettings = Object.freeze({
    [settingKeys.CUR_VERSION]: null,
    [settingKeys.USE_FOR_CHAR_LIST]: false,
    [settingKeys.USE_FOR_CHAT_MESSAGES]: false,
    [settingKeys.USE_FOR_MACROS]: false,
    mappings: {
        char: {},
        global: {
            personas: {},
            chars: {},
        },
    },
});

/** @type {NicknameSettings} */
let settings = { ...defaultSettings };

// ---------------------------------------------------------------------------
// Settings Management
// ---------------------------------------------------------------------------

/**
 * Migrates settings from older versions if needed.
 * @param {Record<string, unknown>} loadedSettings
 */
function migrateSettings(loadedSettings) {
    // Future migrations go here
    void loadedSettings;
}

/**
 * Ensures extension settings exist with defaults, running any needed migrations.
 * @param {string|null} [version=null] - Current extension version from manifest.json
 * @returns {NicknameSettings}
 */
export function ensureSettings(version = null) {
    extension_settings[EXTENSION_KEY] = extension_settings[EXTENSION_KEY] || {};
    const loadedSettings = extension_settings[EXTENSION_KEY];

    migrateSettings(loadedSettings);

    // Apply defaults for missing keys
    for (const [key, value] of Object.entries(defaultSettings)) {
        if (!(key in loadedSettings)) loadedSettings[key] = value;
    }

    // Ensure nested mappings object exists
    loadedSettings.mappings ??= { ...defaultSettings.mappings };
    loadedSettings.mappings.char ??= {};
    loadedSettings.mappings.global ??= { ...defaultSettings.mappings.global };
    loadedSettings.mappings.global.personas ??= {};
    loadedSettings.mappings.global.chars ??= {};

    if (version !== null) loadedSettings[settingKeys.CUR_VERSION] = version;

    settings = loadedSettings;
    return settings;
}

/**
 * Persists a setting value and triggers a settings save.
 * @param {string} key
 * @param {unknown} value
 */
export function saveSetting(key, value) {
    ensureSettings()[key] = value;
    saveSettingsDebounced();
}

/**
 * Gets the current nickname settings.
 * @returns {NicknameSettings}
 */
export function getSettings() {
    return ensureSettings();
}

// ---------------------------------------------------------------------------
// Settings Accessors
// ---------------------------------------------------------------------------

export const nicknameSettings = {
    get useForCharList() {
        return Boolean(ensureSettings()[settingKeys.USE_FOR_CHAR_LIST]);
    },
    get useForChatMessages() {
        return Boolean(ensureSettings()[settingKeys.USE_FOR_CHAT_MESSAGES]);
    },
    get useForMacros() {
        return Boolean(ensureSettings()[settingKeys.USE_FOR_MACROS]);
    },
};

// ---------------------------------------------------------------------------
// Context Access
// ---------------------------------------------------------------------------

import { getContext } from '/scripts/st-context.js';

function getPersonaKey() {
    return user_avatar;
}

function getCharKey() {
    return getContext().characters[getContext().characterId]?.avatar;
}

// ---------------------------------------------------------------------------
// Nickname CRUD
// ---------------------------------------------------------------------------

/**
 * Handles nickname settings for the given type, in the given context.
 *
 * @param {'user'|'char'} type - Type of nickname to handle. Can be either 'user' or 'char'
 * @param {string|null} [value=null] - Value to set the nickname to - If not given, the nickname will be read instead
 * @param {ContextLevel|null} [forContext=null] - Context in which to handle the nickname - Can be 'chat', 'char', or 'global'. If not given, the first nickname found in the context in the specified order will be returned
 * @param {object} [options] - Optional arguments
 * @param {boolean} [options.reset=false] - If true, the nickname will be reset to its default value
 *
 * @returns {NicknameResult?} The nickname value after handling
 */
export function handleNickname(type, value = null, forContext = null, { reset = false } = {}) {
    value = value?.trim();

    if (forContext && !Object.values(ContextLevel).includes(forContext)) {
        throw new Error(`Unknown context: ${forContext}`);
    }
    if (!forContext && (value || reset)) {
        throw new Error('Can\'t set nickname or reset it without a context');
    }

    if (forContext === ContextLevel.CHAT || !forContext) {
        /** @type {NicknameMappings} */
        const chatMappings = getContext().chatMetadata[EXTENSION_KEY] ??= { personas: {}, chars: {} };

        const chatTypeKey = type === 'char' ? 'chars' : 'personas';
        const nicknameKey = type === 'char' ? getCharKey() : getPersonaKey();

        // Reset -> return
        if (reset) {
            delete chatMappings[chatTypeKey][nicknameKey];
            saveChatDebounced();
            return null;
        }
        // Set -> return
        if (value) {
            chatMappings[chatTypeKey][nicknameKey] = value;
            saveChatDebounced();
            return { context: ContextLevel.CHAT, name: value };
        }
        // Return if set
        if (forContext || chatMappings[chatTypeKey][nicknameKey]) {
            return { context: ContextLevel.CHAT, name: chatMappings[chatTypeKey][nicknameKey] };
        }
    }

    if (forContext === ContextLevel.CHAR && type === 'char') {
        toastr.warning('Cannot set character nickname on character level', 'Nicknames');
        return null;
    }

    if ((forContext === ContextLevel.CHAR || !forContext) && type !== 'char') {
        const charKey = getCharKey();
        const nicknameKey = getPersonaKey();

        // Reset -> return
        if (reset) {
            delete settings.mappings.char[charKey]?.personas[nicknameKey];
            saveSettingsDebounced();
            return null;
        }
        // Set -> return
        if (value) {
            settings.mappings.char[charKey] ??= { personas: {} };
            settings.mappings.char[charKey].personas[nicknameKey] = value;
            saveSettingsDebounced();
            return { context: ContextLevel.CHAR, name: value };
        }
        // Return if set
        if (forContext || settings.mappings.char[charKey]?.personas[nicknameKey]) {
            return { context: ContextLevel.CHAR, name: settings.mappings.char[charKey]?.personas[nicknameKey] };
        }
    }

    if (forContext === ContextLevel.GLOBAL || !forContext) {
        const globalTypeKey = type === 'char' ? 'chars' : 'personas';
        const nicknameKey = type === 'char' ? getCharKey() : getPersonaKey();

        // Reset -> return
        if (reset) {
            delete settings.mappings.global[globalTypeKey][nicknameKey];
            saveSettingsDebounced();
            return null;
        }
        // Set -> return
        if (value) {
            settings.mappings.global[globalTypeKey][nicknameKey] = value;
            saveSettingsDebounced();
            return { context: ContextLevel.GLOBAL, name: value };
        }
        // Return if set
        if (forContext || settings.mappings.global[globalTypeKey][nicknameKey]) {
            return { context: ContextLevel.GLOBAL, name: settings.mappings.global[globalTypeKey][nicknameKey] };
        }
    }

    // Default, if no nickname is set, just return the current default names
    return { context: ContextLevel.NONE, name: type === 'char' ? getContext().name2 : getContext().name1 };
}

/**
 * Gets the effective nickname for the user.
 * @returns {NicknameResult}
 */
export function getUserNickname() {
    return handleNickname('user');
}

/**
 * Gets the effective nickname for the character.
 * @returns {NicknameResult}
 */
export function getCharNickname() {
    return handleNickname('char');
}

// ---------------------------------------------------------------------------
// Migration Helpers
// ---------------------------------------------------------------------------

/**
 * Migrates character avatar keys when a character is renamed.
 * @param {string} oldAvatarKey
 * @param {string} newAvatarKey
 */
export function migrateCharKeys(oldAvatarKey, newAvatarKey) {
    // Migrate global mappings
    if (settings.mappings.global.chars[oldAvatarKey]) {
        settings.mappings.global.chars[newAvatarKey] = settings.mappings.global.chars[oldAvatarKey];
        delete settings.mappings.global.chars[oldAvatarKey];
    }
    // Migrate char-level mappings
    if (settings.mappings.char[oldAvatarKey]) {
        settings.mappings.char[newAvatarKey] = settings.mappings.char[oldAvatarKey];
        delete settings.mappings.char[oldAvatarKey];
    }
    saveSettingsDebounced();
}

/**
 * Migrates character avatar keys in a past chat's metadata.
 * @param {Array<Object>} chat
 * @param {string} oldAvatarKey
 * @param {string} newAvatarKey
 */
export function migrateChatCharKeys(chat, oldAvatarKey, newAvatarKey) {
    if (!chat.length || !chat[0].chat_metadata || typeof chat[0].chat_metadata !== 'object') {
        return;
    }
    /** @type {NicknameMappings} */
    const chatMappings = chat[0].chat_metadata[EXTENSION_KEY];
    if (chatMappings && chatMappings.chars[oldAvatarKey]) {
        chatMappings.chars[newAvatarKey] = chatMappings.chars[oldAvatarKey];
        delete chatMappings.chars[oldAvatarKey];
    }
    // No save, we are modifying an unloaded temporarily queried chat via event here
}
