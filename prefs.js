import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk?version=4.0';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class DashCraftPreferences extends ExtensionPreferences {
    /* ----- Dash Preferences ----- */

    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage({title: 'Dash', icon_name: 'view-app-grid-symbolic'});
        const group = new Adw.PreferencesGroup();
        const row = new Adw.SwitchRow({
            title: 'Show/Hide',
            subtitle: 'Show the native dash on the desktop. Off: overview only.',
        });
        settings.bind('show-dock', row, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(row);
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
            restore.sensitive = custom;
            appearance.description = custom
                ? '0%: solid · 100%: transparent'
                : 'System theme · adjust the slider or color to customize';
        };
        restore.connect('clicked', () => {
            settings.reset('background-color');
            settings.reset('background-transparency');
            settings.set_boolean('custom-background', false);
        });
        updateMode();

        /* ----- Panel Preferences ----- */

        const panelPage = new Adw.PreferencesPage({title: 'Panel', icon_name: 'video-display-symbolic'});
        const panelGroup = new Adw.PreferencesGroup({
            title: 'Panel background',
            description: '0%: original background · 100%: transparent',
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
        const panelRestoreRow = new Adw.ActionRow({title: 'System appearance'});
        const panelRestore = new Gtk.Button({label: 'Restore original', valign: Gtk.Align.CENTER});
        panelRestoreRow.add_suffix(panelRestore);
        panelRestoreRow.activatable_widget = panelRestore;
        panelGroup.add(panelRestoreRow);
        panelPage.add(panelGroup);
        const updatePanel = () => {
            const value = settings.get_int('panel-transparency');
            panelScale.set_value(value);
            panelPercentage.label = `${value}%`;
            panelRestore.sensitive = value !== 0;
        };
        updatePanel();
        panelScale.connect('value-changed', () => {
            const value = Math.round(panelScale.get_value());
            if (settings.get_int('panel-transparency') !== value)
                settings.set_int('panel-transparency', value);
        });
        panelRestore.connect('clicked', () => settings.reset('panel-transparency'));

        /* ----- Settings Lifecycle ----- */

        const ids = [
            settings.connect('changed::panel-transparency', updatePanel),
            settings.connect('changed::custom-background', updateMode),
            settings.connect('changed::background-transparency', updateTransparency),
            settings.connect('changed::background-color', updateColor),
        ];
        window.connect('close-request', () => {
            for (const id of ids)
                settings.disconnect(id);
            ids.length = 0;
            return false;
        });
        window.add(page);
        window.add(panelPage);
        window.set_default_size(560, 560);
    }
}
