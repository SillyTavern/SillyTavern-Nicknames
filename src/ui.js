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
} from './nicknames.js';

let settingsUiInjected = false;

/** @type {{ user: string, char: string }} */
const EDITOR_IDS = {
    user: 'nickname_editor_user',
    char: 'nickname_editor_char',
};

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
// Nickname Editor — Data
// ---------------------------------------------------------------------------

/**
 * Gets the current nickname values for all context levels.
 * @param {'user'|'char'} type
 * @returns {{ global: string|null, char: string|null, chat: string|null, effective: string|null, activeContext: string }}
 */
function getAllNicknameValues(type) {
    const globalResult = handleNickname(type, null, ContextLevel.GLOBAL);
    const chatResult = handleNickname(type, null, ContextLevel.CHAT);
    const effectiveResult = handleNickname(type);

    // char-level context is only available for user/persona type
    const charResult = type === 'user' ? handleNickname(type, null, ContextLevel.CHAR) : null;

    return {
        global: globalResult?.name || null,
        char: charResult?.name || null,
        chat: chatResult?.name || null,
        effective: effectiveResult?.name || null,
        activeContext: effectiveResult?.context ?? ContextLevel.NONE,
    };
}

/**
 * Gets the currently selected context from the editor DOM.
 * @param {HTMLElement} container
 * @returns {string}
 */
function getSelectedContext(container) {
    return /** @type {HTMLElement|null} */ (container.querySelector('.context-btn.selected'))?.dataset.context
        ?? ContextLevel.GLOBAL;
}

/**
 * Safely HTML-encodes a string value.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Nickname Editor — State Rendering
// ---------------------------------------------------------------------------

/**
 * Applies the current nickname state to a given editor container.
 * This is the single source of truth for all dynamic UI state.
 * @param {'user'|'char'} type
 * @param {HTMLElement} container
 */
function updateEditorState(type, container) {
    const values = getAllNicknameValues(type);
    const selectedContext = getSelectedContext(container);
    const hasActiveChat = !!document.querySelector('#chat .mes');
    const isCharLevelAvailable = type === 'user';

    // Update input (skip if user is actively typing)
    const input = /** @type {HTMLInputElement|null} */ (container.querySelector('.nickname-input'));
    if (input && document.activeElement !== input) {
        input.value = values[selectedContext] || '';
    }

    // Update active context indicator icons
    container.querySelectorAll('.context-icon').forEach(el => {
        const icon = /** @type {HTMLElement} */ (el);
        icon.classList.toggle('active', icon.dataset.context === values.activeContext);
    });

    // Update context selector buttons (selected, disabled)
    // Context buttons are divs (menu_button), so disabled state is class-based.
    container.querySelectorAll('.context-btn').forEach(el => {
        const btn = /** @type {HTMLElement} */ (el);
        const ctx = btn.dataset.context;
        const isDisabled =
            (ctx === ContextLevel.CHAR && !isCharLevelAvailable) ||
            (ctx === ContextLevel.CHAT && !hasActiveChat);
        btn.classList.toggle('selected', ctx === selectedContext);
        btn.classList.toggle('disabled', isDisabled);
    });

    // Update clear button (disabled when no value at selected context)
    const clearBtn = /** @type {HTMLButtonElement|null} */ (container.querySelector('.nickname-clear-btn'));
    if (clearBtn) {
        const hasValue = !!values[selectedContext];
        clearBtn.classList.toggle('disabled', !hasValue);
        clearBtn.disabled = !hasValue;
    }

    // Update level summary rows
    container.querySelectorAll('.level-row[data-level]').forEach(el => {
        const row = /** @type {HTMLElement} */ (el);
        const level = row.dataset.level;
        const valueEl = row.querySelector('.level-value');
        if (!valueEl) return;

        if (level === 'effective') {
            valueEl.innerHTML = values.effective
                ? escapeHtml(values.effective)
                : '<em data-i18n="Using original name">Using original name</em>';
            return;
        }

        const isN_A = level === ContextLevel.CHAR && !isCharLevelAvailable;
        const isUnavailable = level === ContextLevel.CHAT && !hasActiveChat;

        row.classList.toggle('has-value', !!values[level]);
        row.classList.toggle('disabled', isN_A || isUnavailable);

        if (isN_A) {
            valueEl.innerHTML = '<em data-i18n="N/A (personas only)">N/A (personas only)</em>';
        } else if (isUnavailable) {
            valueEl.innerHTML = '<em data-i18n="N/A (no active chat)">N/A (no active chat)</em>';
        } else {
            valueEl.innerHTML = values[level]
                ? escapeHtml(values[level])
                : '<em data-i18n="Not set">Not set</em>';
        }
    });
}

/**
 * Refreshes the editor for a given type, if it is present in the DOM.
 * @param {'user'|'char'} type
 */
function refreshNicknameEditor(type) {
    const container = document.getElementById(EDITOR_IDS[type]);
    if (container) updateEditorState(type, container);
}

// ---------------------------------------------------------------------------
// Nickname Editor — Injection
// ---------------------------------------------------------------------------

/**
 * Injects the nickname editor using a caller-supplied DOM insertion callback.
 * @param {'user'|'char'} type
 * @param {($editor: JQuery) => boolean} insertFn - Returns false if the target was not found
 */
async function injectNicknameEditor(type, insertFn) {
    if (document.getElementById(EDITOR_IDS[type])) return;

    const html = await renderExtensionTemplateAsync(`third-party/${EXTENSION_NAME}`, 'templates/nickname-editor');
    const $editor = $(html);
    $editor.attr('id', EDITOR_IDS[type]).attr('data-type', type);

    if (!insertFn($editor)) return;

    const container = document.getElementById(EDITOR_IDS[type]);
    if (container) updateEditorState(type, container);
}

/**
 * Injects the user/persona nickname editor below the persona description textarea.
 * Matches the Pronouns extension's injection pattern.
 */
async function injectUserNicknameEditor() {
    await injectNicknameEditor('user', ($editor) => {
        const $target = $('#persona_description');
        if (!$target.length) return false;
        $target.after($editor);
        return true;
    });
}

/**
 * Injects the character nickname editor before the Creator's Metadata section.
 */
async function injectCharNicknameEditor() {
    await injectNicknameEditor('char', ($editor) => {
        const $target = $('#creator_notes_textarea').closest('.inline-drawer');
        if (!$target.length) return false;
        $target.before($editor);
        return true;
    });
}

// ---------------------------------------------------------------------------
// Nickname Editor — Event Delegation
// ---------------------------------------------------------------------------

/**
 * Registers all document-level event listeners for both nickname editors.
 * Uses event delegation so they work for dynamically injected content.
 */
function registerEditorEventListeners() {
    // Context button selection (context buttons are divs — check class for disabled state)
    $(document).on('click', '.nickname-editor-container .context-btn', function () {
        const $btn = $(this);
        if ($btn.hasClass('disabled')) return;

        const $container = $btn.closest('.nickname-editor-container');
        const type = /** @type {'user'|'char'} */ ($container.attr('data-type'));
        if (!type) return;

        $container.find('.context-btn').removeClass('selected');
        $btn.addClass('selected');

        // Update input to show value for newly selected context
        const values = getAllNicknameValues(type);
        const ctx = /** @type {string} */ ($btn.data('context'));
        const input = /** @type {HTMLInputElement|null} */ ($container.find('.nickname-input')[0]);
        if (input) input.value = values[ctx] || '';

        // Update clear button state for the new context
        const clearBtn = /** @type {HTMLButtonElement|null} */ ($container.find('.nickname-clear-btn')[0]);
        if (clearBtn) {
            const hasValue = !!values[ctx];
            clearBtn.classList.toggle('disabled', !hasValue);
            clearBtn.disabled = !hasValue;
        }
    });

    // Save button
    $(document).on('click', '.nickname-editor-container .nickname-save-btn', function () {
        const $container = $(this).closest('.nickname-editor-container');
        const type = /** @type {'user'|'char'} */ ($container.attr('data-type'));
        if (!type) return;

        const input = /** @type {HTMLInputElement|null} */ ($container.find('.nickname-input')[0]);
        const value = input?.value.trim();
        if (!value) {
            toastr.warning('Please enter a nickname', 'Nicknames');
            return;
        }

        const context = getSelectedContext($container[0]);
        handleNickname(type, value, context);
        refreshAllUI();
        toastr.success(`Nickname saved to ${context} level`, 'Nicknames');
    });

    // Clear button
    $(document).on('click', '.nickname-editor-container .nickname-clear-btn:not([disabled])', function () {
        const $container = $(this).closest('.nickname-editor-container');
        const type = /** @type {'user'|'char'} */ ($container.attr('data-type'));
        if (!type) return;

        const context = getSelectedContext($container[0]);
        handleNickname(type, null, context, { reset: true });
        refreshAllUI();
        toastr.info(`Nickname cleared from ${context} level`, 'Nicknames');
    });

    // Enter key submits save
    $(document).on('keypress', '.nickname-editor-container .nickname-input', function (e) {
        if (e.key === 'Enter') {
            $(this).closest('.nickname-editor-container').find('.nickname-save-btn').trigger('click');
        }
    });
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
    registerEditorEventListeners();

    // Refresh persona editor on persona switch
    eventSource.on(event_types.PERSONA_CHANGED, () => refreshNicknameEditor('user'));

    // Refresh character editor on character selection
    eventSource.on(event_types.CHARACTER_SELECTED, () => refreshNicknameEditor('char'));

    // Refresh both on chat change (locked persona or character may have changed)
    eventSource.on(event_types.CHAT_CHANGED, () => {
        refreshNicknameEditor('user');
        refreshNicknameEditor('char');
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
 * Refreshes all editor and display UI components.
 */
export function refreshAllUI() {
    refreshNicknameEditor('user');
    refreshNicknameEditor('char');
    if (nicknameSettings.useForCharList) refreshCharacterList();
    if (nicknameSettings.useForChatMessages) refreshChatMessages();
}
