/**
 * UI injection and event handling for the Nicknames extension.
 * Manages the extension settings panel and nickname editor UI.
 */

import { eventSource, event_types } from '../../../../../script.js';
import { Popup, POPUP_RESULT } from '/scripts/popup.js';
import { t } from '/scripts/i18n.js';
import { renderExtensionTemplateAsync } from '../../../../extensions.js';
import { EXTENSION_NAME } from '../index.js';
import { getContext } from '/scripts/st-context.js';
import {
    settingKeys,
    nicknameSettings,
    saveSetting,
    handleNickname,
    ContextLevel,
    getNicknameForPersonaAvatar,
    getNicknameForCharAvatar,
    seedNicknameFromV3SpecField,
    applyGlobalCharNickname,
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

/**
 * Creates a settings toggle change handler for a given key with an optional post-change refresh.
 * @param {string} key
 * @param {Function} [refreshFn]
 */
function createSettingToggleHandler(key, refreshFn) {
    return function (event) {
        const enabled = $(event.currentTarget).is(':checked');
        saveSetting(key, enabled);
        refreshFn?.();
    };
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
        .on('change', createSettingToggleHandler(settingKeys.USE_FOR_CHAR_LIST, refreshCharacterList));

    $('#nicknames_use_for_chat_messages')
        .prop('checked', nicknameSettings.useForChatMessages)
        .on('change', createSettingToggleHandler(settingKeys.USE_FOR_CHAT_MESSAGES, refreshChatMessages));

    $('#nicknames_use_for_macros')
        .prop('checked', nicknameSettings.useForMacros)
        .on('change', createSettingToggleHandler(settingKeys.USE_FOR_MACROS, refreshV3CompatWarning));

    $('#nicknames_use_v3_spec_compat')
        .prop('checked', nicknameSettings.useV3SpecCompat)
        .on('change', createSettingToggleHandler(settingKeys.USE_V3_SPEC_COMPAT, async () => {
            refreshV3CompatWarning();
            // Sync current character immediately when compat is turned on
            if (nicknameSettings.useV3SpecCompat) {
                const charKey = getContext().characters[getContext().characterId]?.avatar;
                if (charKey) {
                    await seedNicknameFromV3SpecField(charKey, { onConflict: resolveV3SpecConflict });
                    refreshAllUI();
                }
            }
        }));

    refreshV3CompatWarning();

    settingsUiInjected = true;
}

/**
 * Conflict resolver for seedNicknameFromV3SpecField. Shows a popup when both the
 * extension and the character card have different nicknames set, and syncs accordingly.
 * @param {string} charAvatarKey
 * @param {string} globalNickname
 * @param {string} specNickname
 */
export async function resolveV3SpecConflict(charAvatarKey, globalNickname, specNickname) {
    const result = await Popup.show.confirm(
        t`Nickname Conflict`,
        t`Both the extension and the character card have different nicknames set for this character.

<b>Extension (global):</b> ${globalNickname}
<b>Card (V3 spec):</b> ${specNickname}

Which one should be used?`,
        {
            okButton: t`Use Card (V3 Spec)`,
            cancelButton: t`Keep Extension (Global)`,
        },
    );

    if (result === POPUP_RESULT.AFFIRMATIVE) {
        // Apply V3 spec value → global
        applyGlobalCharNickname(charAvatarKey, specNickname);
        refreshAllUI();
    } else if (result === POPUP_RESULT.NEGATIVE) {
        // Write global → card (via the next nickname save; already in sync)
        // syncNicknameToV3SpecField is called automatically when the global nickname is next saved
    }
    // CANCELLED = do nothing
}

/**
 * Shows or hides the warning icon next to the V3 spec compat setting.
 * Visible when compat is enabled but "use for macros" is off, since the spec
 * requires {{char}} to resolve to the nickname — which only works with macros on.
 */
function refreshV3CompatWarning() {
    const showWarning = nicknameSettings.useV3SpecCompat && !nicknameSettings.useForMacros;
    $('#nicknames_v3_compat_warning').toggleClass('hidden', !showWarning);
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
 * Resolves the initial context to pre-select on first render.
 * Trusts the data layer's activeContext directly — priority is already encoded there.
 * Falls back to global when no nickname is set (NONE).
 * @param {string} activeContext - The effective context returned by the data layer
 * @returns {string}
 */
function resolveInitialContext(activeContext) {
    return activeContext !== ContextLevel.NONE ? activeContext : ContextLevel.GLOBAL;
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
    const hasActiveChat = !!document.querySelector('#chat .mes');
    const isCharLevelAvailable = type === 'user';

    // On first render (no button selected yet), auto-select the most specific
    // active context so the user immediately sees the currently effective value.
    // On subsequent renders, keep the user's selection unless it became unavailable.
    const hasSelection = !!container.querySelector('.context-btn.selected');
    const currentSelection = getSelectedContext(container);
    const currentIsUnavailable =
        (currentSelection === ContextLevel.CHAT && !hasActiveChat) ||
        (currentSelection === ContextLevel.CHAR && !isCharLevelAvailable);
    const selectedContext = (!hasSelection || currentIsUnavailable)
        ? resolveInitialContext(values.activeContext)
        : currentSelection;

    // Update input (skip if user is actively typing)
    const input = /** @type {HTMLInputElement|null} */ (container.querySelector('.nickname-input'));
    if (input && document.activeElement !== input) {
        input.value = values[selectedContext] || '';
    }

    // Update context indicator icons: set (has value) vs active (effective)
    container.querySelectorAll('.context-icon').forEach(el => {
        const icon = /** @type {HTMLElement} */ (el);
        const ctx = icon.dataset.context;
        const hasValue = !!values[ctx];
        const isActive = ctx === values.activeContext;

        icon.classList.toggle('set', hasValue && !isActive);
        icon.classList.toggle('active', isActive);

        // Dynamic tooltip showing value or "not set"
        const label = ctx === 'global' ? 'Global' : ctx === 'char' ? 'Character' : 'Chat';
        const valueText = values[ctx] || 'Not set';
        icon.title = isActive
            ? `${label}: "${valueText}" (active)`
            : hasValue
                ? `${label}: "${valueText}"`
                : `${label}: Not set`;
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
 * Refreshes the editor for a given type, preserving any user-selected context.
 * Use this after save/clear where the user's context choice should be kept.
 * @param {'user'|'char'} type
 */
function refreshNicknameEditor(type) {
    const container = document.getElementById(EDITOR_IDS[type]);
    if (container) updateEditorState(type, container);
}

/**
 * Resets the editor selection and re-resolves the best context from scratch.
 * Use this when the persona, character, or chat context changes — the old
 * selection is stale and the auto-resolve should run again with fresh data.
 * @param {'user'|'char'} type
 */
function resetAndRefreshNicknameEditor(type) {
    const container = document.getElementById(EDITOR_IDS[type]);
    if (!container) return;
    container.querySelectorAll('.context-btn').forEach(btn => btn.classList.remove('selected'));
    updateEditorState(type, container);
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
 * Injects the character nickname editor before the Creator's Notes section
 * (#spoiler_free_desc) in the basic character edit panel.
 */
async function injectCharNicknameEditor() {
    await injectNicknameEditor('char', ($editor) => {
        const $target = $('#spoiler_free_desc');
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

        // Mark the selection, then let updateEditorState handle all rendering
        $container.find('.context-btn').removeClass('selected');
        $btn.addClass('selected');
        updateEditorState(type, $container[0]);
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
        const currentNickname = handleNickname(type, null, context);

        // Update nickname
        const nickname = handleNickname(type, value, context);
        refreshAllUI();

        if (currentNickname.name !== nickname.name) {
            toastr.success(`Nickname saved to ${context} level`, 'Nicknames');
        }
    });

    // Clear button
    $(document).on('click', '.nickname-editor-container .nickname-clear-btn:not([disabled])', function () {
        const $container = $(this).closest('.nickname-editor-container');
        const type = /** @type {'user'|'char'} */ ($container.attr('data-type'));
        if (!type) return;

        const context = getSelectedContext($container[0]);
        const currentNickname = handleNickname(type, null, context);

        handleNickname(type, null, context, { reset: true });
        refreshAllUI();

        if (currentNickname.context !== ContextLevel.NONE) {
            toastr.info(`Nickname cleared from ${context} level`, 'Nicknames');
        }
    });

    // Enter key submits save
    $(document).on('keypress', '.nickname-editor-container .nickname-input', function (e) {
        if (e.key === 'Enter') {
            $(this).closest('.nickname-editor-container').find('.nickname-save-btn').trigger('click');
        }
    });

    // Inline drawer toggle for nickname summary
    $(document).on('click', '.nickname-editor-container .inline-drawer-toggle', function () {
        const $toggle = $(this);
        const $content = $toggle.next('.inline-drawer-content');
        const $icon = $toggle.find('.inline-drawer-icon');

        $content.slideToggle(200);
        $icon.toggleClass('down up');
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
export function registerUIEventListeners() {
    registerEditorEventListeners();

    // On context-change events the old selection is stale — reset and re-resolve.
    eventSource.on(event_types.PERSONA_CHANGED, () => {
        resetAndRefreshNicknameEditor('user');
        if (nicknameSettings.useForChatMessages) refreshChatMessages();
    });
    eventSource.on(event_types.CHAT_CHANGED, () => {
        resetAndRefreshNicknameEditor('user');
        resetAndRefreshNicknameEditor('char');
        if (nicknameSettings.useForCharList) refreshCharacterList();
        if (nicknameSettings.useForChatMessages) refreshChatMessages();
    });
    eventSource.on(event_types.CHAT_LOADED, () => {
        if (nicknameSettings.useForChatMessages) refreshChatMessages();
    });
    eventSource.on(event_types.MORE_MESSAGES_LOADED, () => {
        if (nicknameSettings.useForChatMessages) refreshChatMessages();
    });

    // Patch each newly rendered message immediately
    eventSource.on(event_types.USER_MESSAGE_RENDERED, (/** @type {number} */ messageId) => {
        applyNicknameToMessage(messageId);
    });
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (/** @type {number} */ messageId) => {
        applyNicknameToMessage(messageId);
    });
}

// ---------------------------------------------------------------------------
// Character & Persona List Nickname Display
// ---------------------------------------------------------------------------

/** @type {MutationObserver|null} */
let charListObserver = null;

/**
 * Applies or restores a nickname on a single character list item (`.character_select`).
 * @param {HTMLElement} el
 * @param {boolean} apply
 */
function applyNicknameToCharItem(el, apply) {
    const context = getContext();
    const chNameEl = el.querySelector('.ch_name');
    if (!chNameEl || !(chNameEl instanceof HTMLElement)) return;

    if (!apply) {
        const original = el.dataset.nicknameOriginalName;
        if (original !== undefined) {
            chNameEl.textContent = original;
            chNameEl.removeAttribute('title');
            delete el.dataset.nicknameOriginalName;
        }
        return;
    }

    const chid = Number(el.getAttribute('data-chid'));
    const char = context.characters[chid];
    if (!char?.avatar) return;

    const result = getNicknameForCharAvatar(char.avatar);
    if (result.context === ContextLevel.NONE) return;

    if (el.dataset.nicknameOriginalName === undefined) {
        el.dataset.nicknameOriginalName = chNameEl.textContent;
    }
    chNameEl.textContent = result.name;
    chNameEl.title = `[Character] ${el.dataset.nicknameOriginalName}`;
}

/**
 * Applies or restores a nickname on a single persona list item (`.avatar-container`).
 * @param {HTMLElement} el
 * @param {boolean} apply
 */
function applyNicknameToPersonaItem(el, apply) {
    const chNameEl = el.querySelector('.ch_name');
    if (!chNameEl || !(chNameEl instanceof HTMLElement)) return;

    if (!apply) {
        const original = el.dataset.nicknameOriginalName;
        if (original !== undefined) {
            chNameEl.textContent = original;
            chNameEl.removeAttribute('title');
            delete el.dataset.nicknameOriginalName;
        }
        return;
    }

    const avatarId = el.getAttribute('data-avatar-id');
    if (!avatarId) return;

    // For persona nicknames, char-level lookup requires the active char key
    const context = getContext();
    const charKey = context.characters[context.characterId]?.avatar ?? null;
    const result = getNicknameForPersonaAvatar(avatarId, charKey);
    if (result.context === ContextLevel.NONE) return;

    if (el.dataset.nicknameOriginalName === undefined) {
        el.dataset.nicknameOriginalName = chNameEl.textContent;
    }
    chNameEl.textContent = result.name;
    chNameEl.title = `[Persona] ${el.dataset.nicknameOriginalName}`;
}

/**
 * Patches all currently rendered character and persona list items.
 * @param {boolean} apply
 */
function patchAllListItems(apply) {
    document.querySelectorAll('#rm_print_characters_block .character_select').forEach(el => {
        applyNicknameToCharItem(/** @type {HTMLElement} */ (el), apply);
    });
    document.querySelectorAll('#user_avatar_block .avatar-container').forEach(el => {
        applyNicknameToPersonaItem(/** @type {HTMLElement} */ (el), apply);
    });
}

/**
 * MutationObserver callback — patches newly added character/persona list items.
 * @param {MutationRecord[]} mutations
 */
function onCharListMutation(mutations) {
    if (!nicknameSettings.useForCharList) return;
    for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
            if (!(node instanceof HTMLElement)) continue;
            // Character list items added directly
            if (node.matches('.character_select')) {
                applyNicknameToCharItem(node, true);
            } else {
                node.querySelectorAll('.character_select').forEach(el => {
                    applyNicknameToCharItem(/** @type {HTMLElement} */ (el), true);
                });
            }
            // Persona list items added directly
            if (node.matches('.avatar-container')) {
                applyNicknameToPersonaItem(node, true);
            } else {
                node.querySelectorAll('.avatar-container').forEach(el => {
                    applyNicknameToPersonaItem(/** @type {HTMLElement} */ (el), true);
                });
            }
        }
    }
}

/**
 * Updates character and persona list display to show nicknames.
 * Starts a MutationObserver to patch items as they are rendered.
 * When disabled, restores all original names and disconnects the observer.
 */
export function refreshCharacterList() {
    const enabled = nicknameSettings.useForCharList;

    // Always patch/restore what is currently in the DOM
    patchAllListItems(enabled);

    if (enabled) {
        if (!charListObserver) {
            charListObserver = new MutationObserver(onCharListMutation);
            const charBlock = document.getElementById('rm_print_characters_block');
            const personaBlock = document.getElementById('user_avatar_block');
            if (charBlock) charListObserver.observe(charBlock, { childList: true, subtree: true });
            if (personaBlock) charListObserver.observe(personaBlock, { childList: true, subtree: true });
        }
    } else {
        charListObserver?.disconnect();
        charListObserver = null;
    }
}

/**
 * Resolves the nickname to display for a single chat message DOM element.
 * Strategy:
 *   1. Look up the message in the chat array by mesid for `original_avatar`.
 *   2. If is_user: resolve persona nickname via original_avatar key.
 *   3. If char: resolve char nickname via original_avatar key.
 *   4. Fallback: match ch_name against character list for a best-effort avatar key.
 * @param {HTMLElement} mesEl - The `.mes` DOM element
 * @returns {string|null} Nickname to display, or null if none
 */
function resolveNicknameForMesElement(mesEl) {
    const context = getContext();
    const mesId = Number(mesEl.getAttribute('mesid'));
    const isUser = mesEl.getAttribute('is_user') === 'true';
    const isSystem = mesEl.getAttribute('is_system') === 'true';
    const chName = mesEl.getAttribute('ch_name') ?? '';

    if (isSystem) return null;

    const chatMessage = context.chat?.[mesId];
    const originalAvatar = chatMessage?.original_avatar ?? null;

    if (isUser) {
        // Extract the persona key from the force_avatar URL stored in the chat message object.
        // The URL format is: /thumbnail?type=persona&file=PERSONA_KEY
        const forceAvatarUrl = chatMessage?.force_avatar ?? null;
        if (!forceAvatarUrl) return null;

        let personaKey = null;
        try {
            const url = new URL(forceAvatarUrl, window.location.origin);
            personaKey = url.searchParams.get('file');
        } catch {
            return null;
        }
        if (!personaKey) return null;

        // For char-level lookup, we need the current char key
        const charKey = context.characters[context.characterId]?.avatar ?? null;
        const result = getNicknameForPersonaAvatar(personaKey, charKey);
        return result.context !== ContextLevel.NONE ? result.name : null;
    }

    // Character message — resolve avatar key
    let charAvatarKey = originalAvatar;
    if (!charAvatarKey) {
        // For 1:1 chats: use the active character's avatar key directly
        if (context.characterId !== undefined) {
            charAvatarKey = context.characters[context.characterId]?.avatar ?? null;
        }
        // Fallback: best-effort match by name across all characters
        if (!charAvatarKey) {
            charAvatarKey = context.characters.find(c => c.name === chName)?.avatar ?? null;
        }
    }

    if (!charAvatarKey) return null;

    const result = getNicknameForCharAvatar(charAvatarKey);
    return result.context !== ContextLevel.NONE ? result.name : null;
}

/**
 * Applies nickname (or restores original name) to a single `.mes` DOM element.
 * Stores the original name in a data attribute for safe restoration.
 * @param {HTMLElement} mesEl
 * @param {boolean} [apply=true] - true to apply nickname, false to restore original
 */
function applyNicknameToMesElement(mesEl, apply = true) {
    const nameTextEl = mesEl.querySelector('.ch_name .name_text');
    if (!nameTextEl || !(nameTextEl instanceof HTMLElement)) return;

    if (!apply) {
        // Restore original name if we stored it
        const original = mesEl.dataset.nicknameOriginalName;
        if (original !== undefined) {
            nameTextEl.textContent = original;
            nameTextEl.removeAttribute('title');
            delete mesEl.dataset.nicknameOriginalName;
        }
        return;
    }

    const nickname = resolveNicknameForMesElement(mesEl);
    if (!nickname) return;

    // Store original only once (don't overwrite if already stored)
    if (mesEl.dataset.nicknameOriginalName === undefined) {
        mesEl.dataset.nicknameOriginalName = nameTextEl.textContent;
    }
    nameTextEl.textContent = nickname;
    const isUser = mesEl.getAttribute('is_user') === 'true';
    const label = isUser ? 'Persona' : 'Character';
    nameTextEl.title = `[${label}] ${mesEl.dataset.nicknameOriginalName}`;
}

/**
 * Updates chat message display to show nicknames as sender names.
 * Iterates all current `.mes` elements in `#chat` and patches their displayed name.
 */
export function refreshChatMessages() {
    const enabled = nicknameSettings.useForChatMessages;
    document.querySelectorAll('#chat .mes').forEach(el => {
        applyNicknameToMesElement(/** @type {HTMLElement} */ (el), enabled);
    });
}

/**
 * Applies nickname to a single newly-rendered message by its chat index.
 * Called from USER_MESSAGE_RENDERED / CHARACTER_MESSAGE_RENDERED event handlers.
 * @param {number} messageId
 */
export function applyNicknameToMessage(messageId) {
    if (!nicknameSettings.useForChatMessages) return;
    const mesEl = /** @type {HTMLElement|null} */ (document.querySelector(`#chat .mes[mesid="${messageId}"]`));
    if (mesEl) applyNicknameToMesElement(mesEl, true);
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
