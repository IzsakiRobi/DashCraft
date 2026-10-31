# DashCraft

The original GNOME dash on your desktop, with:

- Application unread badges and notification counters
- Smooth icon and dock animations
- Custom Show Apps icon with image preview
- Live dash color and transparency controls
- Panel background and item colors, with adaptive transparency
- Separate Dash and Panel preferences, accessible by right-clicking Show Apps

GNOME Shell 50–51. Tested on 51.1.

## Install

Run `./install.sh` from the cloned repository, or download the ZIP from [Releases](https://github.com/IzsakiRobi/DashCraft/releases) and install it:

```sh
gnome-extensions install dashcraft@ostricks.com.shell-extension.zip
```

For manual extraction, use the directory `~/.local/share/gnome-shell/extensions/dashcraft@ostricks.com/` and compile its settings schema:

```sh
glib-compile-schemas ~/.local/share/gnome-shell/extensions/dashcraft@ostricks.com/schemas
```

Log out and back in, then enable **DashCraft**.

UUID: `dashcraft@ostricks.com`
