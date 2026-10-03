# Capture shortcuts and recovery

The extension registers three commands:

| Action | Suggested shortcut |
|---|---|
| Selected area | Alt + Shift + A |
| Visible viewport | Alt + Shift + V |
| Full page | Alt + Shift + F |

Chrome may leave a binding unassigned when it conflicts with another shortcut. Use **Customize capture shortcuts** in the popup, or open `chrome://extensions/shortcuts`, to choose bindings. On macOS, Alt is Option. Commands are browser-scoped and work while Chrome is focused.

Popup actions, context menus, and commands share a background capture entry point. It checks that the source is a supported HTTP(S) page, refuses to overwrite active/unsaved captures, recovers missing content scripts, requires readiness acknowledgement, and resets session ownership if startup fails. Chrome internal pages, extension pages, file/data/view-source pages, and Chrome Web Store pages receive an explanation. Shortcut failures appear in the popup and the toolbar tooltip.

The screenshot modes are action buttons with keyboard focus, and stay disabled during startup. Existing exit/discard and owner-tab recovery remain available.

Unit tests cover command mapping, supported URLs, concurrent startup, ownership protection, negative acknowledgements, and cleanup. Browser tests verify command registration and execute the same background gateway used by shortcuts, including a real viewport capture. OS-level shortcut routing is not simulated by the headless test suite.
