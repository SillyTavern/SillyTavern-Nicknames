/**
 * UI injection and event handling for the Nicknames extension.
 * Manages the extension settings panel and nickname editor UI.
 */

import { eventSource, event_types } from '../../../../../script.js';
import { renderExtensionTemplateAsync } from '../../../../extensions.js';
import { EXTENSION_NAME } from '../index.js';
import {
    settingKeys,
    nicknameSettings,
    saveSetting,
    handleNickname,
    ContextLevel,
    getUserNickname,
    getCharNickname,
} from './nicknames.js';

let settingsUiInjected = false;
let editorState = {
    user: { selectedContext: ContextLevel.GLOBAL },
    char: { selectedContext: ContextLevel.GLOBAL },
};

// ---------------------------------------------------------------------------
// Event System for Nickname Changes
// ---------------------------------------------------------------------------

/** @type {Set<(type: 'user'|'char', result: import('./nicknames.js').NicknameResult) => void>} */
const nicknameChangeListeners = new Set();

/**
 * Registers a callback to be called when a nickname changes.
 * @param {(type: 'user'|'char', result: import('./nicknames.js').NicknameResult) => void} callback
 */
export function onNicknameChange(callback) {
    nicknameChangeListeners.add(callback);
}

/**
 * Unregisters a nickname change callback.
 * @param {(type: 'user'|'char', result: import('./nicknames.js').NicknameResult) => void} callback
 */
export function offNicknameChange(callback) {
    nicknameChangeListeners.delete(callback);
}

/**
 * Notifies all listeners that a nickname has changed.
 * @param {'user'|'char'} type
 * @param {import('./nicknames.js').NicknameResult} result
 */
function notifyNicknameChange(type, result) {
    for (const listener of nicknameChangeListeners) {
        try {
            listener(type, result);
        } catch (e) {
            console.error(`[${EXTENSION_NAME}] Error in nickname change listener:`, e);
        }
    }

    // Also refresh UI components
    refreshNicknameEditor(type);
    if (nicknameSettings.useForCharList) refreshCharacterList();
    if (nicknameSettings.useForChatMessages) refreshChatMessages();
}

// ---------------------------------------------------------------------------
// Settings UI
// ---------------------------------------------------------------------------

function onCharListToggleChange(event) {
    const enabled = $(event.currentTarget).is(':checked');
    saveSetting(settingKeys.USE_FOR_CHAR_LIST, enabled);
    refreshCharacterList();
}

function onChatMessagesToggleChange(event) {
    const enabled = $(event.currentTarget).is(':checked');
    saveSetting(settingKeys.USE_FOR_CHAT_MESSAGES, enabled);
    refreshChatMessages();
}

function onMacrosToggleChange(event) {
    const enabled = $(event.currentTarget).is(':checked');
    saveSetting(settingKeys.USE_FOR_MACROS, enabled);
}

async function injectSettingsUI() {
    if (settingsUiInjected || document.getElementById('extension_settings_nicknames')) return;

    const col2 = document.getElementById('extensions_settings2');
    const col1 = document.getElementById('extensions_settings');
    const parent = col2 && col1
        ? (col2.children.length > col1.children.length ? col1 : col2)
        : (col2 || col1);

    const html = await renderExtensionTemplateAsync(`third-party/${EXTENSION_NAME}`, 'templates/settings');
    const template = document.createElement('template');
    template.innerHTML = html;
    parent.appendChild(template.content);

    $('#nicknames_use_for_char_list')
        .prop('checked', nicknameSettings.useForCharList)
        .on('change', onCharListToggleChange);

    $('#nicknames_use_for_chat_messages')
        .prop('checked', nicknameSettings.useForChatMessages)
        .on('change', onChatMessagesToggleChange);

    $('#nicknames_use_for_macros')
        .prop('checked', nicknameSettings.useForMacros)
        .on('change', onMacrosToggleChange);

    settingsUiInjected = true;
}

// ---------------------------------------------------------------------------
// Nickname Editor UI
// ---------------------------------------------------------------------------

/**
 * Gets the current values for all context levels.
 * @param {'user'|'char'} type
 * @returns {Object}
 */
function getAllNicknameValues(type) {
    const globalResult = handleNickname(type, null, ContextLevel.GLOBAL);
    const charResult = type === 'user' ? handleNickname(type, null, ContextLevel.CHAR) : { context: ContextLevel.NONE, name: null };
    const chatResult = handleNickname(type, null, ContextLevel.CHAT);
    const effectiveResult = handleNickname(type);

    return {
        global: globalResult.name || null,
        char: charResult.name || null,
        chat: chatResult.name || null,
        effective: effectiveResult.name || null,
        activeContext: effectiveResult.context,
    };
}

/**
 * Renders the nickname editor template data.
 * @param {'user'|'char'} type
 * @returns {Object}
 */
function getEditorTemplateData(type) {
    const values = getAllNicknameValues(type);
    const selectedContext = editorState[type].selectedContext;
    const hasActiveChat = !!document.getElementById('chat')?.children?.length;

    return {
        currentNickname: values.effective || '',
        isGlobalActive: values.activeContext === ContextLevel.GLOBAL,
        isCharActive: values.activeContext === ContextLevel.CHAR,
        isChatActive: values.activeContext === ContextLevel.CHAT,
        isGlobalSelected: selectedContext === ContextLevel.GLOBAL,
        isCharSelected: selectedContext === ContextLevel.CHAR,
        isChatSelected: selectedContext === ContextLevel.CHAT,
        isCharDisabled: type === 'char',
        isChatDisabled: !hasActiveChat,
        globalValue: values.global,
        charValue: values.char,
        chatValue: values.chat,
        effectiveValue: values.effective,
        isCharLevelDisabled: type === 'char',
        isChatLevelDisabled: !hasActiveChat,
    };
}

/**
 * Injects the nickname editor UI.
 * @param {'user'|'char'} type
 * @param {HTMLElement} targetElement
 */
async function injectNicknameEditor(type, targetElement) {
    const containerId = `nickname_editor_${type}`;
    if (document.getElementById(containerId)) return;

    const templateData = getEditorTemplateData(type);

    // Use simple template replacement (Handlebars-style)
    let html = await renderExtensionTemplateAsync(`third-party/${EXTENSION_NAME}`, 'templates/nickname-editor');

    // Simple template variable replacement
    html = html.replace(/\{\{\#if\s+(\w+)\}\}/g, (match, key) => templateData[key] ? '' : '<!--');
    html = html.replace(/\{\{\/if\}\}/g, '-->');
    html = html.replace(/\{\{(\w+)\}\}/g, (match, key) => templateData[key] || '');

    const wrapper = document.createElement('div');
    wrapper.id = containerId;
    wrapper.innerHTML = html;
    targetElement.appendChild(wrapper);

    attachEditorEventListeners(type, wrapper);
}

/**
 * Attaches event listeners to the nickname editor.
 * @param {'user'|'char'} type
 * @param {HTMLElement} container
 */
function attachEditorEventListeners(type, container) {
    const input = container.querySelector('#nickname_input');
    const saveBtn = container.querySelector('#nickname_save_btn');
    const clearBtn = container.querySelector('#nickname_clear_btn');
    const contextBtns = container.querySelectorAll('.context-btn');

    // Context selection
    contextBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const context = btn.dataset.context;
            if (btn.classList.contains('disabled')) return;

            editorState[type].selectedContext = context;

            // Update UI
            contextBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');

            // Update input to show value for selected context
            const values = getAllNicknameValues(type);
            input.value = values[context] || '';
        });
    });

    // Save button
    saveBtn?.addEventListener('click', () => {
        const value = input.value.trim();
        const context = editorState[type].selectedContext;

        if (!value) {
            toastr.warning('Please enter a nickname', 'Nicknames');
            return;
        }

        const result = handleNickname(type, value, context);
        if (result) {
            notifyNicknameChange(type, result);
            toastr.success(`Nickname saved to ${context} level`, 'Nicknames');
        }
    });

    // Clear button
    clearBtn?.addEventListener('click', () => {
        const context = editorState[type].selectedContext;
        const result = handleNickname(type, null, context, { reset: true });

        if (result === null) {
            notifyNicknameChange(type, { context: ContextLevel.NONE, name: handleNickname(type).name });
            toastr.info(`Nickname cleared from ${context} level`, 'Nicknames');
            input.value = '';
        }
    });

    // Enter key on input
    input?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveBtn?.click();
        }
    });
}

/**
 * Refreshes the nickname editor UI for the given type.
 * @param {'user'|'char'} type
 */
function refreshNicknameEditor(type) {
    const containerId = `nickname_editor_${type}`;
    const container = document.getElementById(containerId);
    if (!container) return;

    const templateData = getEditorTemplateData(type);

    // Update input value if not focused
    const input = container.querySelector('#nickname_input');
    if (input && document.activeElement !== input) {
        const values = getAllNicknameValues(type);
        input.value = values[editorState[type].selectedContext] || '';
    }

    // Update context indicators
    const indicators = container.querySelectorAll('.context-icon');
    indicators.forEach(icon => {
        icon.classList.remove('active');
        const context = icon.dataset.context;
        if (context === 'global' && templateData.isGlobalActive) icon.classList.add('active');
        if (context === 'char' && templateData.isCharActive) icon.classList.add('active');
        if (context === 'chat' && templateData.isChatActive) icon.classList.add('active');
    });

    // Update clear button state
    const clearBtn = container.querySelector('#nickname_clear_btn');
    if (clearBtn) {
        if (templateData.currentNickname) {
            clearBtn.classList.remove('disabled');
        } else {
            clearBtn.classList.add('disabled');
        }
    }

    // Update summary section
    const summaryRows = container.querySelectorAll('.level-row');
    summaryRows.forEach(row => {
        const isGlobal = row.querySelector('.fa-globe');
        const isChar = row.querySelector('.fa-user') && !row.classList.contains('effective');
        const isChat = row.querySelector('.fa-message');

        if (isGlobal) row.classList.toggle('has-value', !!templateData.globalValue);
        if (isChar) row.classList.toggle('has-value', !!templateData.charValue);
        if (isChat) row.classList.toggle('has-value', !!templateData.chatValue);
    });
}

// ---------------------------------------------------------------------------
// Editor Injection Points
// ---------------------------------------------------------------------------

/**
 * Injects the user nickname editor into the persona panel.
 */
async function injectUserNicknameEditor() {
    const personaBlock = document.getElementById('persona_description')?.parentElement;
    if (!personaBlock) return;

    // Insert after persona description
    const target = personaBlock.querySelector('#persona_description');
    if (target) {
        const wrapper = document.createElement('div');
        wrapper.className = 'nickname-editor-wrapper';
        target.after(wrapper);
        await injectNicknameEditor('user', wrapper);
    }
}

/**
 * Injects the character nickname editor into the character panel.
 */
async function injectCharNicknameEditor() {
    const charBlock = document.getElementById('character_description_block');
    if (!charBlock) return;

    // Find a good insertion point - after character name or description
    const target = charBlock.querySelector('#ch_name') || charBlock.querySelector('#description_textarea');
    if (target) {
        const wrapper = document.createElement('div');
        wrapper.className = 'nickname-editor-wrapper';
        target.after(wrapper);
        await injectNicknameEditor('char', wrapper);
    }
}

// ---------------------------------------------------------------------------
// Public UI Functions
// ---------------------------------------------------------------------------

/**
 * Injects all UI components.
 */
export async function injectUI() {
    await injectSettingsUI();
    await injectUserNicknameEditor();
    await injectCharNicknameEditor();
}

/**
 * Registers all document-level event listeners.
 */
export function registerEventListeners() {
    // Refresh editors when persona/character changes
    eventSource.on(event_types.CHAT_CHANGED, () => {
        refreshNicknameEditor('user');
        refreshNicknameEditor('char');
    });

    eventSource.on(event_types.CHARACTER_SELECTED, () => {
        // Re-inject char editor for new character
        injectCharNicknameEditor();
        refreshNicknameEditor('char');
    });

    // Handle persona switching
    $(document).on('click', '#user_avatar_block .avatar-container', () => {
        setTimeout(() => {
            refreshNicknameEditor('user');
        }, 100);
    });
}

/**
 * Updates character list display to show nicknames.
 */
export function refreshCharacterList() {
    if (!nicknameSettings.useForCharList) return;
    // TODO: Implement character list nickname display
    console.debug(`[${EXTENSION_NAME}] refreshCharacterList called (not implemented)`);
}

/**
 * Updates chat message display to show nicknames as sender names.
 */
export function refreshChatMessages() {
    if (!nicknameSettings.useForChatMessages) return;
    // TODO: Implement chat message nickname display
    console.debug(`[${EXTENSION_NAME}] refreshChatMessages called (not implemented)`);
}

/**
 * Refreshes all UI components.
 */
export function refreshAllUI() {
    refreshNicknameEditor('user');
    refreshNicknameEditor('char');
    if (nicknameSettings.useForCharList) refreshCharacterList();
    if (nicknameSettings.useForChatMessages) refreshChatMessages();
}
