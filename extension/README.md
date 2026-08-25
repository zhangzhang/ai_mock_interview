# Onsite — Mock Interview

A VS Code extension for voice-driven mock coding interviews. Practice your coding interview skills with Sam, an AI interviewer powered by OpenAI.

## Installation

1. Download the extension package from the latest release (or build it yourself — see [Development](#development)).
2. In VS Code, open the Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`).
3. Click the `…` menu (top-right of the Extensions panel) and select **Install from VSIX…**.
4. Select the `onsite-interview-0.1.0.vsix` file.
5. Reload VS Code if prompted.

## Quick Start

### Open the Interview Panel

Click the **🟠 Onsite** button in the status bar (bottom-left corner) to open the Interview panel. The panel also appears as a tab in the bottom panel next to Terminal.

### Configure Settings

1. In the Interview panel, click the **⚙ Settings** button.
2. Paste your [OpenAI API key](https://platform.openai.com/api-keys) (stored securely in VS Code's SecretStorage).
3. Choose your preferred:
   - **Model** (e.g., `gpt-4o` or `gpt-4-turbo`)
   - **Voice** (e.g., `alloy`, `nova`)
   - **Speech speed** (e.g., 1.0x)
   - **Interviewer name** and **pronoun** (Sam and she/her by default)
4. Click **Save**.

### Start an Interview

1. Pick a problem from the dropdown menu in the Interview panel.
2. Click **Start interview**.
3. The `Solution.java` editor opens in the left column.
4. The problem preview opens beside it in the right column.
5. Sam greets you with a voice introduction and awaits your response.

### Communicate with Sam

During the interview, you can:

- **Talk**: Click the **🎤** button and speak. The extension uses adaptive pause detection to know when you're done. Sam transcribes your speech and responds in text and voice.
- **Type**: Type a message in the text box and press **Send** (or Enter).
- **Share code**: Click **Share code** to send your current `Solution.java` for Sam's feedback.
- **Request a hint**: Click **Hint** to get help from Sam.
- **End & feedback**: Click **End & feedback** to wrap up the interview. Sam provides final feedback, then returns to the home state.
- **Mute**: Click **🔊** to toggle audio output (the mute button will appear as 🔇 when muted).

### About Solution.java

`Solution.java` is an untitled file with real Java syntax highlighting and basic completion. For full IntelliSense (method signatures, imports, diagnostics), save it into a Java project structure (e.g., a folder with a `src/` subdirectory or a Maven/Gradle project).

## Development

### Setup

```bash
cd extension
npm install
```

### Watch Mode

```bash
npm run watch
```

This compiles the TypeScript and media files in watch mode. Keep this terminal open during development.

### Run the Extension

Press **F5** to launch the Extension Development Host with your extension active. Any changes made while watch mode is running will hot-reload.

### Run Tests

```bash
npm test
```

This runs the unit tests in the `test/` directory using Node's built-in test runner.

### Build the VSIX Package

```bash
npm run package
```

This compiles the extension and packages it as `onsite-interview-0.1.0.vsix`, ready for distribution or installation.

## Manual Test Checklist

1. F5 → Extension Development Host opens.
2. Click status-bar **🟠 Onsite** → the Interview panel appears in the bottom Panel.
3. Click **⚙ Settings** → paste a real OpenAI key → Save. Reopen Settings → the note says a key is saved.
4. Pick a problem → **Start interview** → `Solution.java` opens in column 1, the problem preview opens beside it, Sam greets you (text + voice).
5. Type a message → Sam replies in text and voice; the mic re-arms.
6. Click **🎤**, speak, pause → it transcribes, sends, Sam replies.
7. **Share code**, **Hint**, **End & feedback** each work; End returns to the home state.
8. Reload the window → settings persist; the key is still saved.

## Architecture

- **Host**: TypeScript/Node.js (`src/extension.ts`) manages the VS Code API, OpenAI calls, and webview communication.
- **Webview**: HTML/CSS/JavaScript (`src/media/`) renders the Interview UI and settings panel.
- **Storage**:
  - Settings (model, voice, name, pronoun) are stored in `context.globalState`.
  - The OpenAI API key is stored securely in `context.secrets`.
  - Settings and key persist across reloads.

## Troubleshooting

- **No OpenAI key saved?** Click **⚙ Settings**, paste your key, and save.
- **Can't transcribe or speak?** Check that you have an active internet connection and a valid OpenAI API key.
- **IntelliSense not working in Solution.java?** Save the file into a Java project folder.

## License

MIT
