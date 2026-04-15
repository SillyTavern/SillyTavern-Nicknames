/**
 * Core nickname data and settings management for the Nicknames extension.
 */

import { saveSettingsDebounced, saveSettings, saveChatDebounced, saveCharacterDebounced, user_avatar, eventSource, event_types } from '../../../../../script.js';
import { extension_settings } from '../../../../extensions.js';
import { EXTENSION_KEY } from '../index.js';
import { t } from '/scripts/i18n.js';

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
    USE_V3_SPEC_COMPAT: 'useV3SpecCompat',
});

const defaultSettings = Object.freeze({
    [settingKeys.CUR_VERSION]: null,
    [settingKeys.USE_FOR_CHAR_LIST]: false,
    [settingKeys.USE_FOR_CHAT_MESSAGES]: false,
    [settingKeys.USE_FOR_MACROS]: false,
    [settingKeys.USE_V3_SPEC_COMPAT]: false,
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
    get useV3SpecCompat() {
        return Boolean(ensureSettings()[settingKeys.USE_V3_SPEC_COMPAT]);
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
            if (type === 'char' && nicknameKey) syncNicknameToV3SpecField(nicknameKey);
            return null;
        }
        // Set -> return
        if (value) {
            settings.mappings.global[globalTypeKey][nicknameKey] = value;
            saveSettingsDebounced();
            if (type === 'char' && nicknameKey) syncNicknameToV3SpecField(nicknameKey);
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

/**
 * Resolves a nickname for an arbitrary persona avatar key, independent of the currently active persona.
 * Waterfall: chat-level (if charKey given) → char-level (if charKey given) → global.
 * @param {string} personaKey - The persona avatar key (e.g. "user_avatar.png")
 * @param {string} [charKey] - Optional character avatar key for chat/char-level lookups
 * @returns {NicknameResult}
 */
export function getNicknameForPersonaAvatar(personaKey, charKey = null) {
    const s = ensureSettings();

    // Chat-level (requires active chat metadata)
    const chatMappings = getContext().chatMetadata[EXTENSION_KEY];
    if (chatMappings?.personas?.[personaKey]) {
        return { context: ContextLevel.CHAT, name: chatMappings.personas[personaKey] };
    }

    // Char-level (persona nickname for specific character)
    if (charKey && s.mappings.char[charKey]?.personas?.[personaKey]) {
        return { context: ContextLevel.CHAR, name: s.mappings.char[charKey].personas[personaKey] };
    }

    // Global-level
    if (s.mappings.global.personas[personaKey]) {
        return { context: ContextLevel.GLOBAL, name: s.mappings.global.personas[personaKey] };
    }

    return { context: ContextLevel.NONE, name: null };
}

/**
 * Resolves a nickname for an arbitrary character avatar key, independent of the currently active character.
 * Waterfall: chat-level → global.
 * @param {string} charAvatarKey - The character avatar key (e.g. "char.png")
 * @returns {NicknameResult}
 */
export function getNicknameForCharAvatar(charAvatarKey) {
    const s = ensureSettings();

    // Chat-level
    const chatMappings = getContext().chatMetadata[EXTENSION_KEY];
    if (chatMappings?.chars?.[charAvatarKey]) {
        return { context: ContextLevel.CHAT, name: chatMappings.chars[charAvatarKey] };
    }

    // Global-level
    if (s.mappings.global.chars[charAvatarKey]) {
        return { context: ContextLevel.GLOBAL, name: s.mappings.global.chars[charAvatarKey] };
    }

    return { context: ContextLevel.NONE, name: null };
}

// ---------------------------------------------------------------------------
// V3 Spec Compatibility
// ---------------------------------------------------------------------------

/** @type {import('/scripts/char-data.js').v2CharData & { nickname: string }} v3CharData */

/**
 * Writes the current global char nickname back to `character.data.nickname` on
 * the in-memory character object and triggers a debounced card save, so the value
 * is persisted into the exported PNG/card.
 * No-op when not in an active character edit context or compat is disabled.
 * @param {string} charAvatarKey - Character avatar key (e.g. "char.png")
 */
export function syncNicknameToV3SpecField(charAvatarKey) {
    if (!nicknameSettings.useV3SpecCompat) return;

    const context = getContext();
    const character = context.characters.find(c => c.avatar === charAvatarKey);
    if (!character) return;

    const nickname = settings.mappings.global.chars[charAvatarKey] ?? '';

    const v3CharData = /** @type {v3CharData} */ (character.data);
    v3CharData.nickname = nickname || undefined;
    saveCharacterDebounced();
}

/**
 * Returns the `data.nickname` value from the character card, or null if absent.
 * @param {string} charAvatarKey
 * @returns {string|null}
 */
export function getV3SpecNickname(charAvatarKey) {
    const character = getContext().characters.find(c => c.avatar === charAvatarKey);
    const v3CharData = /** @type {v3CharData} */ (character.data);
    return v3CharData.nickname?.trim() || null;
}

/**
 * Directly writes a value into the global char nickname slot and saves settings.
 * Does NOT sync back to the card (caller's responsibility if needed).
 * @param {string} charAvatarKey
 * @param {string} nickname
 */
export function applyGlobalCharNickname(charAvatarKey, nickname) {
    settings.mappings.global.chars[charAvatarKey] = nickname;
    saveSettingsDebounced();
}

/**
 * Handles the V3 spec nickname sync when a character is loaded.
 * Silently resolves non-conflicting cases; calls `onConflict` when both values
 * are set and differ, allowing the caller (UI layer) to handle user interaction.
 *
 * Cases:
 *  - Card has nickname, global is empty  → seed global from card (silent)
 *  - Global has nickname, card is empty  → write global into card (silent)
 *  - Both set and identical              → no-op (already in sync)
 *  - Both set and different              → call onConflict(globalNickname, specNickname)
 *
 * @param {string} charAvatarKey
 * @param {object} [options={}]
 * @param {(charAvatarKey: string, globalNickname: string, specNickname: string) => Promise<void>|null} [options.onConflict=null]
 */
export async function seedNicknameFromV3SpecField(charAvatarKey, { onConflict = null } = {}) {
    if (!nicknameSettings.useV3SpecCompat) return;

    const globalNickname = settings.mappings.global.chars[charAvatarKey] || null;
    const specNickname = getV3SpecNickname(charAvatarKey);

    if (!globalNickname && !specNickname) return;

    if (!globalNickname && specNickname) {
        // Seed global from card
        console.debug(`[Nicknames] V3 compat: seeding global nickname "${specNickname}" from card for ${charAvatarKey}`);
        applyGlobalCharNickname(charAvatarKey, specNickname);
        return;
    }

    if (globalNickname && !specNickname) {
        // Write global into card
        console.debug(`[Nicknames] V3 compat: writing global nickname "${globalNickname}" into card for ${charAvatarKey}`);
        syncNicknameToV3SpecField(charAvatarKey);
        return;
    }

    if (globalNickname === specNickname) return;

    // Both set and different — delegate to caller
    if (onConflict) {
        await onConflict(charAvatarKey, globalNickname, specNickname);
    }
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

/**
 * Migrates a character avatar key in the currently loaded chat's metadata.
 * @param {string} oldAvatarKey
 * @param {string} newAvatarKey
 */
export function migrateCurrentChatCharKey(oldAvatarKey, newAvatarKey) {
    /** @type {NicknameMappings} */
    const chatMappings = getContext().chatMetadata[EXTENSION_KEY];
    if (chatMappings?.chars[oldAvatarKey]) {
        chatMappings.chars[newAvatarKey] = chatMappings.chars[oldAvatarKey];
        delete chatMappings.chars[oldAvatarKey];
        saveChatDebounced();
    }
}

// ---------------------------------------------------------------------------
// Lifecycle Helpers — Delete
// ---------------------------------------------------------------------------

/**
 * Removes all nickname data for a deleted character.
 * Cleans global char mapping and any char-level persona mappings stored under
 * this character's key. The current chat's metadata is left as-is — it will
 * naturally become stale once the chat is gone along with the character.
 * @param {string} avatarKey - Character avatar key (e.g. "char.png")
 */
export function deleteCharNicknameData(avatarKey) {
    delete settings.mappings.global.chars[avatarKey];
    delete settings.mappings.char[avatarKey];
    saveSettingsDebounced();
}

/**
 * Removes all nickname data for a deleted persona.
 * Cleans global persona mapping and char-level entries across all characters.
 * @param {string} avatarId - Persona avatar ID (e.g. "user.png")
 */
export function deletePersonaNicknameData(avatarId) {
    delete settings.mappings.global.personas[avatarId];
    for (const charData of Object.values(settings.mappings.char)) {
        delete charData.personas[avatarId];
    }
    saveSettingsDebounced();
}

// ---------------------------------------------------------------------------
// Lifecycle Helpers — Duplicate / Copy
// ---------------------------------------------------------------------------

/**
 * Copies all nickname data from a source character to a new (duplicated) character.
 * Copies global char nickname and char-level persona mappings.
 * No-op if the source character has no nickname data.
 * @param {string} sourceAvatarKey - Source character avatar key
 * @param {string} targetAvatarKey - New character avatar key
 */
export function copyCharNicknameData(sourceAvatarKey, targetAvatarKey) {
    let changed = false;

    if (settings.mappings.global.chars[sourceAvatarKey]) {
        settings.mappings.global.chars[targetAvatarKey] = settings.mappings.global.chars[sourceAvatarKey];
        changed = true;
    }
    if (settings.mappings.char[sourceAvatarKey]) {
        settings.mappings.char[targetAvatarKey] = structuredClone(settings.mappings.char[sourceAvatarKey]);
        changed = true;
    }

    if (changed) saveSettingsDebounced();
}

/**
 * Copies all nickname data from a source persona to a new (duplicated) persona.
 * Copies global persona nickname and all char-level persona entries.
 * No-op if the source persona has no nickname data.
 * @param {string} sourceAvatarId - Source persona avatar ID
 * @param {string} targetAvatarId - New persona avatar ID
 */
export function copyPersonaNicknameData(sourceAvatarId, targetAvatarId) {
    let changed = false;

    if (settings.mappings.global.personas[sourceAvatarId]) {
        settings.mappings.global.personas[targetAvatarId] = settings.mappings.global.personas[sourceAvatarId];
        changed = true;
    }
    for (const charData of Object.values(settings.mappings.char)) {
        if (charData.personas[sourceAvatarId]) {
            charData.personas[targetAvatarId] = charData.personas[sourceAvatarId];
            changed = true;
        }
    }

    if (changed) saveSettingsDebounced();
}

// ---------------------------------------------------------------------------
// Lifecycle Helpers — Clean (uninstall)
// ---------------------------------------------------------------------------

/**
 * Removes all nickname data added by this extension:
 *  - The entire extension settings block (all global + char-level mappings)
 * Note: chat-level metadata (stored in individual chat files) cannot be
 * cleaned up automatically without loading and re-saving every chat file.
 * Uses a direct (non-debounced) save to guarantee the wipe is persisted
 * before any page reload following an extension uninstall.
 */
export async function cleanAllNicknameData() {
    delete extension_settings[EXTENSION_KEY];
    await saveSettings();

    // Warn chat-based nicknames will not be cleaned up
    toastr.warning(t`Chat-based nickname metadata will not be removed automatically.`, t`Nicknames Cleanup`);
}

// ---------------------------------------------------------------------------
// Data Event Listeners
// ---------------------------------------------------------------------------

/**
 * Registers data-layer event listeners for character and persona lifecycle events.
 * Call once during extension initialization.
 * @param {object} [options={}]
 * @param {(charAvatarKey: string, globalNickname: string, specNickname: string) => Promise<void>|null} [options.onV3SpecConflict=null] - Called when both global and card nicknames are set and differ.
 */
export function registerDataEventListeners({ onV3SpecConflict = null } = {}) {
    // --- Character rename ---
    eventSource.on(event_types.CHARACTER_RENAMED, /** @param {string} oldAvatarKey @param {string} newAvatarKey */
        (oldAvatarKey, newAvatarKey) => {
            migrateCharKeys(oldAvatarKey, newAvatarKey);
            migrateCurrentChatCharKey(oldAvatarKey, newAvatarKey);
        });

    eventSource.on(event_types.CHARACTER_RENAMED_IN_PAST_CHAT, /** @param {Array<Object>} chat @param {string} oldAvatarKey @param {string} newAvatarKey */
        (chat, oldAvatarKey, newAvatarKey) => {
            migrateChatCharKeys(chat, oldAvatarKey, newAvatarKey);
        });

    // --- Character delete ---
    eventSource.on(event_types.CHARACTER_DELETED, /** @param {{ character: { avatar: string } }} data */
        (data) => {
            const avatar = data?.character?.avatar;
            if (avatar) deleteCharNicknameData(avatar);
        });

    // --- Character duplicate ---
    eventSource.on(event_types.CHARACTER_DUPLICATED, /** @param {{ oldAvatar: string, newAvatar: string }} data */
        (data) => {
            if (data?.oldAvatar && data?.newAvatar) {
                copyCharNicknameData(data.oldAvatar, data.newAvatar);
            }
        });

    // --- Persona delete ---
    eventSource.on(event_types.PERSONA_DELETED, /** @param {{ avatarId: string }} data */
        (data) => {
            if (data?.avatarId) deletePersonaNicknameData(data.avatarId);
        });

    // --- Persona duplicate (requires ST core PR #5448) ---
    eventSource.on(event_types.PERSONA_CREATED, /** @param {{ avatarId: string, duplicatedFromAvatarId?: string }} data */
        (data) => {
            if (data?.duplicatedFromAvatarId && data?.avatarId) {
                copyPersonaNicknameData(data.duplicatedFromAvatarId, data.avatarId);
            }
        });

    // --- V3 spec compat: sync global nickname with card when a chat is opened ---
    eventSource.on(event_types.CHAT_CHANGED, async () => {
        const charKey = getContext().characters[getContext().characterId]?.avatar;
        if (charKey) await seedNicknameFromV3SpecField(charKey, { onConflict: onV3SpecConflict });
    });
}
