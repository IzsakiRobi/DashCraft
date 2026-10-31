# DashCraft

A lightweight GNOME Shell extension that brings the original GNOME dash to your desktop, with application badges, smooth animations, and customizable backgrounds.

## Features

- **Native dash:** show it at the bottom of the primary monitor, or keep it in the Overview. Fullscreen visibility follows GNOME Shell; the dock does not reserve workspace space.
- **Application badges:** application-provided unread counters take priority over Notification Center counts, even when notifications are cleared. Badges can be switched off.
- **Badge graphics:** red gradient, shaded border, fading edge highlight, and centered numbers. The badge expands into a capsule when needed; counts above 99 appear as `99+`.
- **Smooth animations:** incoming and outgoing app icons zoom while neighboring icons slide and the dock resizes. Icon and separator animations take 250 ms.
- **Dash appearance:** live background color and transparency controls, a native GTK color picker, and Restore original.
- **Panel transparency:** live transparency controls and Restore original. Maximized windows on the active workspace restore an opaque panel. Overview transitions use the system theme's timing, normally 250 ms.
- **Two preferences pages:** Dash and Panel.

## Requirements

GNOME Shell 50 or 51, GTK 4, libadwaita, GJS, and GLib development tools (`glib-compile-schemas`). Tested on GNOME Shell 51.1; GNOME 50 has not been tested.

DashCraft uses private GNOME Shell interfaces. Future Shell versions may require adjustments. Avoid running another extension that changes the dash or panel background at the same time.

## Install

```sh
git clone https://github.com/IzsakiRobi/DashCraft.git
cd DashCraft
./install.sh
```

Log out and back in after installation or JavaScript updates. Then enable DashCraft and open its preferences:

```sh
gnome-extensions enable io.github.IzsakiRobi.Native.Dash
gnome-extensions prefs io.github.IzsakiRobi.Native.Dash
```

The installer compiles the settings schema and installs the extension for the current user. It does not enable extensions or restart GNOME Shell.

The internal UUID `io.github.IzsakiRobi.Native.Dash` and settings schema `org.gnome.shell.extensions.native-dash` are retained from development to preserve existing installations and preferences. The displayed extension name is **DashCraft**.

## Application counters

DashCraft listens for `com.canonical.Unity.LauncherEntry.Update` signals with an `application://APP.desktop` identifier, `count` (`int64`), and `count-visible` (`bool`). No application IDs are hardcoded.

Application-provided counters take priority, including zero and hidden states. If an application does not provide its own counter, DashCraft falls back to its notifications in GNOME's Notification Center. Notifications without an application association are ignored.

The extension requests the `com.canonical.Unity` bus name without replacing an existing owner. Applications watching that name can resend their current counter when the dock starts; other applications become visible after their next counter update. Counters are removed when their publisher exits.

## Code layout

| File | Purpose |
| --- | --- |
| `extension.js` | Extension lifecycle and native dash placement |
| `Badges.js` | Application counters, notification fallback, badge graphics and layout |
| `Colors.js` | Dash background color, transparency, and theme restoration |
| `Animations.js` | App icon, spacing, and separator animations |
| `Panel.js` | Panel transparency, maximized-window state, and Overview background coverage |
| `prefs.js` | Dash and Panel preferences pages |
| `stylesheet.css` | Badge and icon background styles |
| `schemas/` | Persistent preferences |
| `install.sh` | User installation |

Panel color transitions are handled by GNOME's native styling. During Overview transitions, background coverage follows the native workspace animation so wallpaper does not suddenly appear underneath the translucent panel. The normal Overview clipping is restored at its final state and all overrides are removed when the extension is disabled.

## Update

```sh
cd DashCraft
git pull --ff-only
./install.sh
```

Log out and back in to load the updated JavaScript.

## Uninstall

```sh
gnome-extensions disable io.github.IzsakiRobi.Native.Dash
rm -r ~/.local/share/gnome-shell/extensions/io.github.IzsakiRobi.Native.Dash
```

Saved preferences are retained.
