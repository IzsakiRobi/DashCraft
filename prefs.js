import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk?version=4.0';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GdkPixbuf from 'gi://GdkPixbuf';
import Gtk from 'gi://Gtk?version=4.0';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class DashCraftPreferences extends ExtensionPreferences {
    /* ----- Dash Preferences ----- */

    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage({title: 'Dash', icon_name: 'view-app-grid-symbolic'});
        const group = new Adw.PreferencesGroup({title: 'Visibility'});
        const row = new Adw.SwitchRow({
            title: 'Show/Hide',
            subtitle: 'Show the native dash on the desktop. Off: overview only.',
        });
        settings.bind('show-dock', row, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(row);
        this._addVisibilityPreferences(group, settings);
        const badges = new Adw.SwitchRow({
            title: 'Show Badges',
            subtitle: 'Show application counters and notification badges.',
        });
        settings.bind('show-badges', badges, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(badges);
        page.add(group);

        const appearance = new Adw.PreferencesGroup({
            title: 'Dock background',
            description: '0%: solid · 100%: transparent',
        });
        const controls = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 16,
            margin_start: 16,
            margin_end: 16,
            margin_top: 14,
            margin_bottom: 14,
        });
        const left = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 6,
            hexpand: true,
        });
        const heading = new Gtk.Box({spacing: 12});
        heading.append(new Gtk.Label({label: 'Transparency', xalign: 0, hexpand: true}));
        const percentage = new Gtk.Label({width_chars: 4, xalign: 1, css_classes: ['dim-label']});
        heading.append(percentage);
        left.append(heading);
        const scale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({lower: 0, upper: 100, step_increment: 1, page_increment: 10}),
            digits: 0,
            draw_value: false,
            hexpand: true,
            tooltip_text: 'Dock background transparency',
        });
        left.append(scale);
        controls.append(left);
        const colorButton = new Gtk.ColorDialogButton({
            dialog: new Gtk.ColorDialog({title: 'Dock background color', modal: true, with_alpha: false}),
            valign: Gtk.Align.CENTER,
            width_request: 40,
            height_request: 40,
            tooltip_text: 'Background color',
        });
        controls.append(colorButton);
        const appearanceRow = new Adw.PreferencesRow();
        appearanceRow.set_child(controls);
        appearance.add(appearanceRow);
        const borderColorId = this._addColor(appearance, settings, 'border-color', 'Border color', '#ffffff', {
            toggle: 'border-enabled',
        });
        const restoreRow = new Adw.ActionRow({
            title: 'System appearance',
            subtitle: 'Restore the original dash background from your system theme.',
        });
        const restore = new Gtk.Button({
            label: 'Restore original',
            valign: Gtk.Align.CENTER,
        });
        restoreRow.add_suffix(restore);
        restoreRow.activatable_widget = restore;
        appearance.add(restoreRow);
        page.add(appearance);
        const closeIconPreferences = this._addIconPreferences(window, page, settings);

        const updateTransparency = () => {
            const value = settings.get_int('background-transparency');
            scale.set_value(value);
            percentage.label = `${value}%`;
        };
        const updateColor = () => {
            const rgba = new Gdk.RGBA();
            if (!rgba.parse(settings.get_string('background-color')))
                rgba.parse('#38383c');
            if (!colorButton.rgba.equal(rgba))
                colorButton.rgba = rgba;
        };
        updateTransparency();
        updateColor();
        scale.connect('value-changed', () => {
            const value = Math.round(scale.get_value());
            percentage.label = `${value}%`;
            if (settings.get_int('background-transparency') !== value) {
                settings.set_boolean('custom-background', true);
                settings.set_int('background-transparency', value);
            }
        });
        colorButton.connect('notify::rgba', () => {
            const rgba = colorButton.rgba;
            const hex = [rgba.red, rgba.green, rgba.blue]
                .map(channel => Math.round(channel * 255).toString(16).padStart(2, '0')).join('');
            const color = `#${hex}`;
            if (settings.get_string('background-color') !== color) {
                settings.set_boolean('custom-background', true);
                settings.set_string('background-color', color);
            }
        });
        const updateMode = () => {
            const custom = settings.get_boolean('custom-background');
            restore.sensitive = custom || settings.get_boolean('border-enabled') ||
                settings.get_string('border-color') !== '#ffffff';
            appearance.description = custom
                ? '0%: solid · 100%: transparent'
                : 'System theme · adjust the slider or color to customize';
        };
        restore.connect('clicked', () => {
            settings.reset('background-color');
            settings.reset('background-transparency');
            settings.set_boolean('custom-background', false);
            settings.reset('border-enabled');
            settings.reset('border-color');
        });
        updateMode();

        /* ----- Panel Preferences ----- */

        const panelPage = new Adw.PreferencesPage({title: 'Panel', icon_name: 'video-display-symbolic'});
        const panelGroup = new Adw.PreferencesGroup({
            title: 'Panel appearance',
            description: '0%: solid · 100%: transparent',
        });
        const panelControls = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 6,
            margin_start: 16,
            margin_end: 16,
            margin_top: 14,
            margin_bottom: 14,
        });
        const panelHeading = new Gtk.Box({spacing: 12});
        panelHeading.append(new Gtk.Label({label: 'Transparency', xalign: 0, hexpand: true}));
        const panelPercentage = new Gtk.Label({width_chars: 4, xalign: 1, css_classes: ['dim-label']});
        panelHeading.append(panelPercentage);
        panelControls.append(panelHeading);
        const panelScale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            adjustment: new Gtk.Adjustment({lower: 0, upper: 100, step_increment: 1, page_increment: 10}),
            digits: 0,
            draw_value: false,
            tooltip_text: 'Panel background transparency',
        });
        panelControls.append(panelScale);
        const panelRow = new Adw.PreferencesRow();
        panelRow.set_child(panelControls);
        panelGroup.add(panelRow);
        const panelColorIds = [
            this._addColor(panelGroup, settings, 'panel-background-color', 'Panel Background Color', '#000000'),
            this._addColor(panelGroup, settings, 'panel-items-color', 'Items Color', '#ffffff'),
        ];
        const shadowGroup = new Adw.PreferencesGroup({title: 'Shadow'});
        const shadowToggle = new Adw.SwitchRow({title: 'Items shadow'});
        settings.bind('panel-items-shadow', shadowToggle, 'active', Gio.SettingsBindFlags.DEFAULT);
        shadowGroup.add(shadowToggle);
        panelColorIds.push(this._addColor(shadowGroup, settings, 'panel-shadow-color', 'Shadow color', '#000000', {
            sensitive: 'panel-items-shadow',
        }));
        const panelRestoreGroup = new Adw.PreferencesGroup();
        const panelRestoreRow = new Adw.ActionRow({title: 'System appearance'});
        const panelRestore = new Gtk.Button({label: 'Restore original', valign: Gtk.Align.CENTER});
        panelRestoreRow.add_suffix(panelRestore);
        panelRestoreRow.activatable_widget = panelRestore;
        panelRestoreGroup.add(panelRestoreRow);
        panelPage.add(panelGroup);
        panelPage.add(shadowGroup);
        panelPage.add(panelRestoreGroup);
        const updatePanel = () => {
            const value = settings.get_int('panel-transparency');
            panelScale.set_value(value);
            panelPercentage.label = `${value}%`;
            panelRestore.sensitive = value !== 0 ||
                settings.get_string('panel-background-color') !== '' ||
                settings.get_string('panel-items-color') !== '' ||
                settings.get_boolean('panel-items-shadow') ||
                settings.get_string('panel-shadow-color') !== '#000000';
        };
        updatePanel();
        panelScale.connect('value-changed', () => {
            const value = Math.round(panelScale.get_value());
            if (settings.get_int('panel-transparency') !== value)
                settings.set_int('panel-transparency', value);
        });
        panelRestore.connect('clicked', () => {
            for (const key of ['panel-transparency', 'panel-background-color', 'panel-items-color',
                'panel-items-shadow', 'panel-shadow-color'])
                settings.reset(key);
        });

        /* ----- Settings Lifecycle ----- */

        const ids = [
            borderColorId,
            ...panelColorIds,
            settings.connect('changed::border-enabled', updateMode),
            settings.connect('changed::border-color', updateMode),
            settings.connect('changed::panel-items-shadow', updatePanel),
            settings.connect('changed::panel-shadow-color', updatePanel),
            settings.connect('changed::panel-background-color', updatePanel),
            settings.connect('changed::panel-items-color', updatePanel),
            settings.connect('changed::panel-transparency', updatePanel),
            settings.connect('changed::custom-background', updateMode),
            settings.connect('changed::background-transparency', updateTransparency),
            settings.connect('changed::background-color', updateColor),
        ];
        window.connect('close-request', () => {
            closeIconPreferences();
            for (const id of ids)
                settings.disconnect(id);
            ids.length = 0;
            return false;
        });
        window.add(page);
        window.add(panelPage);
        window.set_default_size(560, 744);
    }

    /* ----- Dock Visibility Preferences ----- */

    _addVisibilityPreferences(group, settings) {
        const controls = new Gtk.Box({
            spacing: 20,
            margin_start: 16,
            margin_end: 16,
            margin_top: 14,
            margin_bottom: 14,
        });
        const switches = [
            ['autohide', 'Autohide', 'Hide until hovered'],
            ['intellihide', 'Intelihide', 'Hide when a window overlaps the dock'],
        ];
        for (const [key, title, tooltip] of switches) {
            const box = new Gtk.Box({spacing: 12, hexpand: true});
            box.append(new Gtk.Label({label: title, xalign: 0, hexpand: true}));
            const toggle = new Gtk.Switch({valign: Gtk.Align.CENTER, tooltip_text: tooltip});
            settings.bind(key, toggle, 'active', Gio.SettingsBindFlags.DEFAULT);
            toggle.connect('notify::active', () => {
                if (toggle.active)
                    settings.set_boolean(key === 'autohide' ? 'intellihide' : 'autohide', false);
            });
            box.append(toggle);
            controls.append(box);
        }
        const row = new Adw.PreferencesRow();
        row.set_child(controls);
        group.add(row);
    }

    /* ----- Color Controls ----- */

    _addColor(group, settings, key, title, fallback, {toggle = null, sensitive = toggle} = {}) {
        const row = new Adw.ActionRow({title});
        const button = new Gtk.ColorDialogButton({
            dialog: new Gtk.ColorDialog({title, modal: true, with_alpha: false}),
            valign: Gtk.Align.CENTER,
            width_request: 40,
            height_request: 40,
            tooltip_text: title,
        });
        if (toggle) {
            const enabled = new Gtk.Switch({valign: Gtk.Align.CENTER, tooltip_text: `Enable ${title.toLowerCase()}`});
            settings.bind(toggle, enabled, 'active', Gio.SettingsBindFlags.DEFAULT);
            row.add_suffix(enabled);
            row.activatable_widget = enabled;
        } else {
            row.activatable_widget = button;
        }
        if (sensitive)
            settings.bind(sensitive, button, 'sensitive', Gio.SettingsBindFlags.GET);
        row.add_suffix(button);
        group.add(row);
        let updating = false;
        const update = () => {
            updating = true;
            const saved = settings.get_string(key);
            const rgba = new Gdk.RGBA();
            if (!rgba.parse(saved))
                rgba.parse(fallback);
            if (!button.rgba.equal(rgba))
                button.rgba = rgba;
            row.subtitle = saved ? saved.toUpperCase() : 'System theme';
            updating = false;
        };
        update();
        button.connect('notify::rgba', () => {
            if (updating)
                return;
            const rgba = button.rgba;
            const hex = [rgba.red, rgba.green, rgba.blue]
                .map(channel => Math.round(channel * 255).toString(16).padStart(2, '0')).join('');
            const color = `#${hex}`;
            if (settings.get_string(key) !== color)
                settings.set_string(key, color);
        });
        return settings.connect(`changed::${key}`, update);
    }

    /* ----- Show Apps Preferences ----- */

    _addIconPreferences(window, page, settings) {
        const group = new Adw.PreferencesGroup({title: '“Show Apps” icon'});
        const controls = new Gtk.Box({
            spacing: 16,
            margin_start: 16,
            margin_end: 16,
            margin_top: 14,
            margin_bottom: 14,
        });
        const preview = new Gtk.Image({pixel_size: 64});
        const frame = new Gtk.Frame({
            child: preview,
            width_request: 64,
            height_request: 64,
            valign: Gtk.Align.CENTER,
        });
        controls.append(frame);
        const buttons = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 6,
            valign: Gtk.Align.CENTER,
        });
        const change = new Gtk.Button({label: 'Change “Show Apps” icon'});
        const restore = new Gtk.Button({label: 'Restore original'});
        buttons.append(change);
        buttons.append(restore);
        controls.append(buttons);
        const row = new Adw.PreferencesRow();
        row.set_child(controls);
        group.add(row);
        page.add(group);

        const update = () => {
            const path = settings.get_string('show-apps-icon');
            if (path && GLib.file_test(path, GLib.FileTest.IS_REGULAR))
                preview.set_from_gicon(new Gio.FileIcon({file: Gio.File.new_for_path(path)}));
            else
                preview.set_from_icon_name('view-app-grid-symbolic');
            restore.sensitive = path !== '';
        };
        const changedId = settings.connect('changed::show-apps-icon', update);
        update();
        const cancellable = new Gio.Cancellable();
        change.connect('clicked', () => {
            const filter = new Gtk.FileFilter({name: 'Images'});
            filter.add_pixbuf_formats();
            const filters = new Gio.ListStore({item_type: Gtk.FileFilter});
            filters.append(filter);
            const dialog = new Gtk.FileDialog({
                title: 'Choose Show Apps icon',
                modal: true,
                filters,
                default_filter: filter,
            });
            change.sensitive = false;
            dialog.open(window, cancellable, (source, result) => {
                let file;
                try {
                    file = source.open_finish(result);
                } catch (error) {
                    change.sensitive = true;
                    if (!cancellable.is_cancelled() &&
                        !error.matches(Gtk.DialogError, Gtk.DialogError.DISMISSED) &&
                        !error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.CANCELLED))
                        this._showIconError(window, error);
                    return;
                }
                file.load_contents_async(cancellable, (selected, loaded) => {
                    try {
                        const [, bytes] = selected.load_contents_finish(loaded);
                        if (cancellable.is_cancelled())
                            return;
                        const path = this._saveIcon(bytes);
                        const previous = settings.get_string('show-apps-icon');
                        settings.set_string('show-apps-icon', path);
                        if (previous !== path)
                            this._removeIcon(previous);
                    } catch (error) {
                        if (!cancellable.is_cancelled())
                            this._showIconError(window, error);
                    } finally {
                        change.sensitive = true;
                    }
                });
            });
        });
        restore.connect('clicked', () => {
            const previous = settings.get_string('show-apps-icon');
            settings.reset('show-apps-icon');
            this._removeIcon(previous);
        });
        return () => {
            cancellable.cancel();
            settings.disconnect(changedId);
        };
    }

    /* ----- Saved Icon Files ----- */

    _iconDirectory() {
        return GLib.build_filenamev([GLib.get_user_data_dir(), 'dashcraft', 'icons']);
    }

    _saveIcon(bytes) {
        const loader = new GdkPixbuf.PixbufLoader();
        try {
            loader.write(bytes);
        } finally {
            loader.close();
        }
        if (!loader.get_pixbuf())
            throw new Error('The selected file could not be read as an image.');
        const extension = loader.get_format().get_extensions()[0];
        const digest = GLib.compute_checksum_for_data(GLib.ChecksumType.SHA256, bytes);
        const directory = this._iconDirectory();
        GLib.mkdir_with_parents(directory, 0o700);
        const path = GLib.build_filenamev([directory, `show-apps-${digest}.${extension}`]);
        Gio.File.new_for_path(path).replace_contents(
            bytes, null, false, Gio.FileCreateFlags.PRIVATE, null);
        return path;
    }

    _removeIcon(path) {
        if (!path || GLib.path_get_dirname(path) !== this._iconDirectory() ||
            !/^show-apps-[0-9a-f]{64}\.[a-z0-9]+$/.test(GLib.path_get_basename(path)))
            return;
        const file = Gio.File.new_for_path(path);
        if (file.query_exists(null))
            file.delete(null);
    }

    _showIconError(window, error) {
        const dialog = new Adw.AlertDialog({
            heading: 'Could not load icon',
            body: error.message,
        });
        dialog.add_response('close', 'Close');
        dialog.present(window);
    }
}
