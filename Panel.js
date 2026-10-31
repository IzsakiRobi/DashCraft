import Gio from 'gi://Gio';
import Graphene from 'gi://Graphene';
import Meta from 'gi://Meta';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Workspace from 'resource:///org/gnome/shell/ui/workspace.js';
import {InjectionManager} from 'resource:///org/gnome/shell/extensions/extension.js';

const MANAGED_CLASS = 'dashcraft-panel-managed';
const SOLID_CLASS = 'dashcraft-panel-solid';

/* ----- Panel Background ----- */

export class Panel {
    constructor(settings) {
        this._settings = settings;
        this._panel = Main.panel;
        const context = St.ThemeContext.get_for_stage(global.stage);
        this._theme = context.get_theme();
        this._color = this._readBaseColor(context);
        this._connections = [];
        this._windows = new Map();
        const [file, stream] = Gio.File.new_tmp('dashcraft-panel-XXXXXX.css');
        stream.close(null);
        this._file = file;
        this._loaded = false;
        try {
            for (const key of ['panel-transparency', 'panel-background-color', 'panel-items-color'])
                this._connect(settings, `changed::${key}`, () => this._updateColor());
            this._connect(global.display, 'window-created', (_display, window) => this._watchWindow(window));
            this._connect(global.workspace_manager, 'active-workspace-changed', () => this._sync());
            this._connect(Main.layoutManager, 'monitors-changed', () => this._sync());
            for (const actor of global.get_window_actors())
                this._watchWindow(actor.meta_window);
            this._updateColor();
            this._overviewBackground = new OverviewBackground(settings);
        } catch (error) {
            this.destroy();
            throw error;
        }
    }

    _readBaseColor(context) {
        const panel = this._panel;
        const classes = (panel.get_style_class_name() ?? '').split(/\s+/)
            .filter(name => name && ![MANAGED_CLASS, SOLID_CLASS].includes(name));
        const pseudo = (panel.get_style_pseudo_class() ?? '').split(/\s+/)
            .filter(name => name && name !== 'overview');
        const node = St.ThemeNode.new(
            context, panel.get_theme_node().get_parent(), this._theme,
            panel.constructor.$gtype, panel.name, classes.join(' ') || null,
            pseudo.join(' ') || null, panel.get_style() ?? '');
        return node.get_background_color();
    }

    _connect(object, signal, callback) {
        this._connections.push([object, object.connect(signal, callback)]);
    }

    _updateColor() {
        const color = this._color;
        const alpha = color.alpha / 255 * (1 - this._settings.get_int('panel-transparency') / 100);
        const saved = this._settings.get_string('panel-background-color');
        const rgb = /^#[0-9a-f]{6}$/i.test(saved)
            ? [1, 3, 5].map(offset => parseInt(saved.slice(offset, offset + 2), 16)).join(', ')
            : `${color.red}, ${color.green}, ${color.blue}`;
        let css = `#panel.${MANAGED_CLASS} { ` +
            `background-color: rgba(${rgb}, ${alpha.toFixed(4)}); } ` +
            `#panel.${MANAGED_CLASS}.${SOLID_CLASS} { ` +
            `background-color: rgba(${rgb}, ${(color.alpha / 255).toFixed(4)}); } ` +
            `#panel.${MANAGED_CLASS}:overview { background-color: transparent; }`;
        const items = this._settings.get_string('panel-items-color');
        if (/^#[0-9a-f]{6}$/i.test(items)) {
            const panel = `#panel.${MANAGED_CLASS}`;
            css += `${panel}, ${panel} .panel-button, ${panel} StLabel, ${panel} StIcon { ` +
                `color: ${items} !important; } ` +
                `${panel} .workspace-dot { background-color: ${items} !important; }`;
        }
        if (this._loaded)
            this._theme.unload_stylesheet(this._file);
        this._loaded = false;
        this._file.replace_contents(css, null, false, Gio.FileCreateFlags.PRIVATE, null);
        this._theme.load_stylesheet(this._file);
        this._loaded = true;
        this._sync();
    }

    /* ----- Window State ----- */

    _watchWindow(window) {
        if (this._windows.has(window))
            return;
        const ids = [
            'notify::maximized-horizontally',
            'notify::maximized-vertically',
            'notify::minimized',
            'workspace-changed',
            'position-changed',
        ].map(signal => window.connect(signal, () => this._sync()));
        ids.push(window.connect('unmanaged', () => {
            this._unwatchWindow(window);
            this._sync();
        }));
        this._windows.set(window, ids);
        this._sync();
    }

    _unwatchWindow(window) {
        for (const id of this._windows.get(window) ?? [])
            window.disconnect(id);
        this._windows.delete(window);
    }

    _hasMaximizedWindow() {
        const workspace = global.workspace_manager.get_active_workspace();
        const monitor = Main.layoutManager.primaryIndex;
        for (const window of this._windows.keys()) {
            if (window.get_window_type() === Meta.WindowType.NORMAL &&
                !window.minimized && window.located_on_workspace(workspace) &&
                window.get_monitor() === monitor &&
                window.maximized_horizontally && window.maximized_vertically)
                return true;
        }
        return false;
    }

    _sync() {
        if (!this._loaded)
            return;
        const classes = (this._panel.get_style_class_name() ?? '').split(/\s+/)
            .filter(name => name && ![MANAGED_CLASS, SOLID_CLASS].includes(name));
        classes.push(MANAGED_CLASS);
        if (this._hasMaximizedWindow())
            classes.push(SOLID_CLASS);
        const desired = classes.join(' ');
        if (this._panel.get_style_class_name() !== desired)
            this._panel.set_style_class_name(desired);
    }

    /* ----- Cleanup ----- */

    destroy() {
        this._overviewBackground?.destroy();
        this._overviewBackground = null;
        for (const [object, id] of this._connections)
            object.disconnect(id);
        for (const window of this._windows.keys())
            this._unwatchWindow(window);
        this._panel.remove_style_class_name(MANAGED_CLASS);
        this._panel.remove_style_class_name(SOLID_CLASS);
        if (this._loaded)
            this._theme.unload_stylesheet(this._file);
        this._file.delete(null);
        this._connections = [];
        this._windows.clear();
        this._settings = this._panel = this._color = this._theme = this._file = null;
    }
}

/* ----- Overview Background Coverage ----- */

class OverviewBackground {
    constructor(settings) {
        this._settings = settings;
        this._backgrounds = new Map();
        this._injections = new InjectionManager();
        const owner = this;
        this._injections.overrideMethod(Workspace.WorkspaceBackground.prototype,
            '_updateRoundedClipBounds', original => function () {
                original.call(this);
                owner._watch(this);
                owner._update(this);
            });
        this._changedId = settings.connect('changed::panel-transparency', () => {
            for (const background of this._backgrounds.keys())
                this._update(background);
        });
        try {
            this._discover(Main.layoutManager.overviewGroup);
        } catch (error) {
            this.destroy();
            throw error;
        }
    }

    _discover(actor) {
        if (actor instanceof Workspace.WorkspaceBackground) {
            this._watch(actor);
            this._update(actor);
        }
        for (const child of actor.get_children())
            this._discover(child);
    }

    _watch(background) {
        if (this._backgrounds.has(background))
            return;
        const record = {
            clip: background._bin.clip_to_allocation,
            clipRect: background._bin.has_clip ? background._bin.get_clip() : null,
            allocationId: background._bin.connect('notify::allocation', () => this._update(background)),
            adjustmentId: background._stateAdjustment.connect('notify::value', () => this._update(background)),
            destroyId: background.connect('destroy', () => {
                background._stateAdjustment.disconnect(record.adjustmentId);
                background._bin.disconnect(record.allocationId);
                this._backgrounds.delete(background);
            }),
        };
        this._backgrounds.set(background, record);
    }

    _update(background) {
        const monitor = Main.layoutManager.monitors[background._monitorIndex];
        if (!monitor || !background._bgManager)
            return;
        const area = background._workarea;
        const record = this._backgrounds.get(background);
        const active = background._monitorIndex === Main.layoutManager.primaryIndex &&
            this._settings.get_int('panel-transparency') > 0;
        const progress = Math.max(0, Math.min(1, background._stateAdjustment.value));
        const top = area.y - monitor.y;
        const extension = active ? top * (1 - progress) : 0;
        const bin = background._bin;
        if (extension > 0) {
            const scale = area.height > 0 ? bin.height / area.height : 1;
            const extra = extension * scale;
            bin.clip_to_allocation = false;
            bin.set_clip(0, -extra, bin.width, bin.height + extra);
        } else {
            this._restoreClip(background, record);
        }
        const rect = new Graphene.Rect();
        rect.origin.x = area.x - monitor.x;
        rect.origin.y = top - extension;
        rect.size.width = area.width;
        rect.size.height = area.height + extension;
        background._bgManager.backgroundActor.content.set_rounded_clip_bounds(rect);
    }

    _restoreClip(background, record) {
        const bin = background._bin;
        if (record.clipRect)
            bin.set_clip(...record.clipRect);
        else
            bin.remove_clip();
        bin.clip_to_allocation = record.clip;
    }

    /* ----- Cleanup ----- */

    destroy() {
        this._settings.disconnect(this._changedId);
        this._injections.clear();
        for (const [background, record] of this._backgrounds) {
            background._stateAdjustment.disconnect(record.adjustmentId);
            background.disconnect(record.destroyId);
            background._bin.disconnect(record.allocationId);
            this._restoreClip(background, record);
            background._updateRoundedClipBounds();
        }
        this._backgrounds.clear();
        this._settings = this._injections = null;
    }
}
