#!/usr/bin/env bash
set -euo pipefail
source_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
extension_dir="${XDG_DATA_HOME:-$HOME/.local/share}/gnome-shell/extensions/dashcraft@ostricks.com"
glib-compile-schemas --strict "$source_dir/schemas"
mkdir -p "$extension_dir/schemas"
for file in metadata.json extension.js Badges.js Colors.js Icons.js Menu.js Animations.js Panel.js prefs.js stylesheet.css; do
    install -m 644 "$source_dir/$file" "$extension_dir/$file"
done
install -m 644 "$source_dir/schemas/org.gnome.shell.extensions.dashcraft.gschema.xml" "$extension_dir/schemas/"
install -m 644 "$source_dir/schemas/gschemas.compiled" "$extension_dir/schemas/"
printf 'Installed: %s\n' "$extension_dir"
