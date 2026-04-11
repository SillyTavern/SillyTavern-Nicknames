/**
 * UI injection and event handling for the Nicknames extension.
 * Manages the extension settings panel.
 */

import { renderExtensionTemplateAsync } from '../../../../extensions.js';
import { EXTENSION_NAME } from '../index.js';
import { settingKeys, nicknameSettings, saveSetting } from './nicknames.js';

let uiInjected = false;

// ---------------------------------------------------------------------------
// Settings UI
// ---------------------------------------------------------------------------

function onCharListToggleChange(event) {
    const enabled = $(event.currentTarget).is(':checked');
    saveSetting(settingKeys.USE_FOR_CHAR_LIST, enabled);
    // TODO: Refresh character list display when implemented
}

function onChatMessagesToggleChange(event) {
    const enabled = $(event.currentTarget).is(':checked');
    saveSetting(settingKeys.USE_FOR_CHAT_MESSAGES, enabled);
    // TODO: Refresh chat message display when implemented
}

function onMacrosToggleChange(event) {
    const enabled = $(event.currentTarget).is(':checked');
    saveSetting(settingKeys.USE_FOR_MACROS, enabled);
}

// ---------------------------------------------------------------------------
// Injection
// ---------------------------------------------------------------------------

/**
 * Injects the extension settings block into the extensions settings panel.
 */
async function injectSettingsUI() {
    if (uiInjected || document.getElementById('extension_settings_nicknames')) return;

    // Prefer the column with fewer children to keep balance
    const col2 = document.getElementById('extensions_settings2');
    const col1 = document.getElementById('extensions_settings');
    const parent = col2 && col1
        ? (col2.children.length > col1.children.length ? col1 : col2)
        : (col2 || col1);

    const html = await renderExtensionTemplateAsync(`third-party/${EXTENSION_NAME}`, 'templates/settings');
    const template = document.createElement('template');
    template.innerHTML = html;
    parent.appendChild(template.content);

    // Wire up toggles
    $('#nicknames_use_for_char_list')
        .prop('checked', nicknameSettings.useForCharList)
        .on('change', onCharListToggleChange);

    $('#nicknames_use_for_chat_messages')
        .prop('checked', nicknameSettings.useForChatMessages)
        .on('change', onChatMessagesToggleChange);

    $('#nicknames_use_for_macros')
        .prop('checked', nicknameSettings.useForMacros)
        .on('change', onMacrosToggleChange);
}

/**
 * Injects all UI components and marks injection as done.
 */
export async function injectUI() {
    if (uiInjected) return;
    await injectSettingsUI();
    uiInjected = true;
}

/**
 * Registers all document-level event listeners.
 */
export function registerEventListeners() {
    // TODO: Add event listeners for character list and chat message display
}

// ---------------------------------------------------------------------------
// Stubs for future features
// ---------------------------------------------------------------------------

/**
 * TODO: Update character list display to show nicknames instead of original names.
 * This should be called when:
 * - Nickname is set/changed
 * - Character list is rendered
 * - Setting toggle for useForCharList changes
 */
export function refreshCharacterList() {
    if (!nicknameSettings.useForCharList) return;
    // TODO: Implement character list nickname display
    console.debug(`[${EXTENSION_NAME}] refreshCharacterList called (not implemented)`);
}

/**
 * TODO: Update chat message display to show nicknames as message sender names.
 * This should be called when:
 * - Nickname is set/changed
 * - Chat is rendered
 * - Setting toggle for useForChatMessages changes
 */
export function refreshChatMessages() {
    if (!nicknameSettings.useForChatMessages) return;
    // TODO: Implement chat message nickname display
    console.debug(`[${EXTENSION_NAME}] refreshChatMessages called (not implemented)`);
}
