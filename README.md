# SillyTavern Nicknames

*An Extension allowing you to set nicknames for both characters and personas. The nicknames can be used in the UI, chat messages, and prompts towards the model.*

> [!IMPORTANT]
> This extension is currently under development, and not intended for any productive use. Features might not work, and documentation is incomplete.

## Concept

This extension allows setting shorter nicknames for characters and personas that can be used in various places throughout SillyTavern while keeping the original names for display purposes. This is useful when you want the AI to use a shorter or different name in the actual prompts while keeping the full name visible in the UI.

## Features

- Set nicknames for both **user (persona)** and **character** at different context levels:
  - **Global**: Applies across all chats
  - **Character-level**: Persona-specific nickname for a specific character
  - **Chat-level**: Nickname stored in the chat file
- Slash commands to get and set nicknames: `/nickname-user` and `/nickname-char`
- Configurable usage via settings:
  - **Character list**: Display nicknames in the character list (TODO)
  - **Chat messages**: Use nicknames as sender names (TODO)
  - **Macros & prompts**: Replace `{{user}}` and `{{char}}` in prompts sent to the AI

## Usage

### Slash Commands

- `/nickname-user [nickname] [for=global|char|chat]` - Get or set the user/persona nickname
- `/nickname-char [nickname] [for=global|char|chat]` - Get or set the character nickname

Use `#reset` as the nickname to clear a nickname from the specified context.

### Settings

The extension settings panel allows configuring where nicknames should be applied:

- **Character list**: Display nicknames instead of original names in the character list (coming soon)
- **Chat messages**: Use nicknames as sender names for chat messages (coming soon)
- **Macros & prompts**: Replace `{{user}}` and `{{char}}` with nicknames in prompts (enabled by default)

## Development

This extension is currently in active development. Breaking changes may occur.

## Support and Contributions

Contact me on the SillyTavern Discord @Wolfsblvt, or create a GitHub Issue here.

Contributions via PR are always welcome.

## License

AGPL-3.0
