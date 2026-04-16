# SillyTavern Nicknames [Extension]

[![extension version](https://img.shields.io/badge/dynamic/json?color=blue&label=extension%20version&query=%24.version&url=https%3A%2F%2Fraw.githubusercontent.com%2FWolfsblvt%2FSillyTavern-Nicknames%2Fmain%2Fmanifest.json)](https://github.com/Wolfsblvt/SillyTavern-Nicknames/)
[![release version](https://img.shields.io/github/release/Wolfsblvt/SillyTavern-Nicknames?color=lightblue&label=release)](https://github.com/Wolfsblvt/SillyTavern-Nicknames/releases/latest)
[![required ST version](https://img.shields.io/badge/required%20ST%20version-1.13.5-darkred?logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAABRFBMVEVHcEyEGxubFhafFRWfFRWeFBSaFhaWFRWfFRWfFRWOFhaeFRWeFBSeFBSfFRWfFRWdFRWbFBSfFBSfFBSdFRWeExOfFBSfFRWdFBSfFRWfFRWfGxudFRWeFBSTFRWeFRWeFRWfFRWcFhaeFRWfFRWeFRWfFRWfFRWeFRWeFRWeFRWgFBSgFRWfFRWfFRWgFRX26ur4+Pj9+/ugFBT9/v6fFRWtOzueFRWeFRWgFRX///+fFRX6+/vXo6OfFBSrODj6/PzIenr28PD+/f2gFRX06ur17e3dr6+rMzPTlJS5VVW+ZGT9/v7y39/y6OioMTHx//+1Skrrz8+qMDD7+/v7/Pzq0tLkvb22UVHHe3v4+Pi3WFjIgoL4+PjNjIy5XFyuQEDmzMzZpKThubn8/Py+YWHz8/P8/Pz9//+gFRX////36+tJcu2kAAAAaXRSTlMAARDDqIkMB8qyAzqXUrnQGROErSmd1o41pL4iL2oFTFiTHYt5ccZ1PF1G6ONj2/z1gv1n32CkQz/t7ceYYH+KqdZT5fSoY+XbwLSH1u8elxi8+OmeqJ78nTmbXBds8WlWNc+EwcovuYtEjPKpAAACkklEQVQ4y3VTZXfbQBBcwYlZlmSRLdmWmRpwqGFOw1BmPvf/f+/JeU3ipr0Pp/d2VzszO7cAJfj/oXiAxK5xFEU9TkoSxa1pLejggcayrMVNp2lk26w2wEvg4iUry7IATUGVPG12tlfrYB2iWjmPFJjGAxiqwYT5dyEr3MVkoUWZhgTAF0K+JRQfkyrrvhYoYcTWGVEvT/EpF/PudIAKBRTU18LQYswcR1bNiRxv0JXzDjYRzWsiIcuzKgk0OzglkMDVMW4QDiteXu5VJ7dLMBoYMxPxLV0QUk9zRK6SAEIwX+FEL0hTgRGSW00mXXY6Ce8oaw5UETiWokhqN21z9D3RUDMKH0dXo/Ozs/PRwfqbV5UgnNKodtHmydxwOPf+Mr+HJy87rT8ie5kBoLhXw/HXm5uNzf2N4/Hcxu6B6wAYtZiGxgBryNOdi+Xl70ABqsKT8WsKqr7rpAwe1ABhLCDPjT9sj39cX/88QqTgqRm1Yx1ZZAAWhKlPDElZ9vP28szM+HI9L1ADUbSIg061QlTmc252Z+nTTxer27+e5QW82evmdt0bLItvt7a2vn1ZnhTsloAXF++8pznVsu3T4xlyxi/Wqefj/UyibNFSOZq0oGKdERR/JVzd3Ht3eDhC8dHeqhZVGEcRGD2mwHAxbkEJ2Y4CUCmiapHw8lg2IyZh7BrA2bhPZHCJ6OeUFD+HVZRFYnShj21ip5FEEy4VTS1JbUZQeV71b22KEuOBHZzYZ1mx3WRZ3/X/sU2SFRTbbfIHXYyK9YdPnF+cPMlYiO5jTT33UpKbeadspxPLcqwvTNmvz8tyY2mnR+bAYtxnmHoyjdhbYZguxspkHwKZNum/1pcioYW6MJm3Yf5v+02S+Q13BVQ4NCDLNAAAAABJRU5ErJggg==)](https://github.com/SillyTavern/SillyTavern/releases/tag/1.13.5)

Set nicknames for characters and personas to be used in the UI, chat messages, and prompts. Features a dedicated nickname editor in Persona/Character Management, three context levels (global, character, chat), and slash commands.

> [!NOTE]
> This extension requires the **[Experimental Macro Engine](https://docs.sillytavern.app/usage/core-concepts/macros/#macros)** to be enabled for full functionality.

## Installation

Install using SillyTavern's extension installer from the URL:

```txt
https://github.com/Wolfsblvt/SillyTavern-Nicknames
```

## Features

### Nickname Editor

A dedicated nickname editor appears directly in **Persona Management** (for user/persona nicknames) and **Character Management** (for character nicknames).

- **Three context levels** — Set nicknames at different scopes:
  - **Global**: Applies across all chats and characters
  - **Character-level**: Persona-specific nickname for a specific character (personas only)
  - **Chat-level**: Nickname stored in the chat file
- **Visual indicator** — Shows which context level the displayed nickname is currently being sourced from
- **Persistent** — Nicknames are stored in settings and chat metadata, surviving exports and backups
- **Quick actions** — Set, update, or remove nicknames directly from the editor

### Context Levels

| Level | Description | User/Persona | Character |
|---|---|---|---|
| **Global** | Applies everywhere for this entity | ✅ | ✅ |
| **Character** | For a specific character-persona pair | ✅ | ❌ |
| **Chat** | Specific to this chat file only | ✅ | ✅ |

When reading nicknames, the extension checks in order: **Chat → Character → Global**, using the first one found.

### Slash Commands

| Command | Description |
|---|---|
| `/nickname-user [for=global\|char\|chat] [nickname]` | Get or set the user/persona nickname |
| `/nickname-char [for=global\|char\|chat] [nickname]` | Get or set the character nickname |

Use `#reset` as the nickname to clear it from the specified context level.

**Examples:**
- `/nickname-user Alex` - Sets global persona nickname to "Alex"
- `/nickname-user for=chat "The Real Alex"` - Sets chat-level persona nickname
- `/nickname-char Bob` - Sets global character nickname to "Bob"
- `/nickname-char for=global #reset` - Removes global character nickname

### Settings

Access the extension settings under **Extensions → Nicknames** in the SillyTavern settings panel.

All settings are **disabled by default** — enable them as needed:

- **Character list** — Display nicknames instead of original names in the character list
- **Chat messages** — Use nicknames as sender names for chat messages
- **Macros & prompts** — Replace `{{user}}` and `{{char}}` with nicknames in prompts sent to the AI
- **V3 spec compatibility** — Sync global character nicknames with the character card's `data.nickname` field. When enabled, nicknames are saved into the card and can be read from imported cards. If both the card and extension have different nicknames, a conflict resolution popup appears.

### Cleanup Extension Data

> [!NOTE]
> This feature requires the **staging** branch of SillyTavern.

All extension settings and saved nicknames, except for chat-bound nicknames, can be removed via the extensions list or during uninstall.

## Roadmap

Planned features for future releases:

- [ ] Dedicated `{{fullUser}}` / `{{fullChar}}` and `{{nicknameUser}}` / `{{nicknameChar}}` macros — always return the original full name or the nickname (if set), regardless of macro override settings
- [ ] Import/export nickname mappings (bulk export all global and char-level data)
- [ ] Optional visual indicator when nicknames are active (tooltip/label in char list and chat)
- [ ] Allow the model to set nicknames (via function calling)

## ToDo List

- [ ] Extension versioning and migration system

## License

AGPL-3.0

## Contribution

- Discord: `@Wolfsblvt`
- Issues and pull requests are welcome.
- Any features/fixes should be submitted as a PR to the `dev` branch.
