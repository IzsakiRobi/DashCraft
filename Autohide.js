import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const PEEK = 5;
const DURATION = 250;
const HIDE_DELAY = 250;

/* ----- Dock Visibility ----- */

export class Autohide {
    constructor(host, dash, settings, isDesktop, isMenuOpen) {
        this._host = host;
        this._dash = dash;
        this._settings = settings;
        this._isDesktop = isDesktop;
        this._isMenuOpen = isMenuOpen;
        this._connections = [];
        this._windows = new Map();
        this._items = new Map();
        this._idleId = 0;
        this._hideId = 0;
        this._target = 0;
        this._dragging = false;
        this._reactive = dash.reactive;
        this._trackHover = dash.track_hover;
        try {
            dash.reactive = true;
            dash.track_hover = true;
            for (const key of ['autohide', 'intellihide'])
                this._connect(settings, `changed::${key}`, () => this.sync());
            this._connect(dash, 'notify::hover', () => this._hoverChanged());
            this._connect(dash, 'notify::width', () => this.queueSync());
            this._connect(dash._box, 'child-added', (_box, item) => this._watchItem(item));
            this._connect(global.display, 'window-created', (_display, window) => this._watchWindow(window));
            this._connect(global.workspace_manager, 'active-workspace-changed', () => this.queueSync());
            for (const signal of ['showing', 'hiding', 'hidden'])
                this._connect(Main.overview, signal, () => this.sync());
            this._connect(Main.overview, 'item-drag-begin', () => {
                this._dragging = true;
                this.sync();
            });
            for (const signal of ['item-drag-end', 'item-drag-cancelled']) {
                this._connect(Main.overview, signal, () => {
                    this._dragging = false;
                    this.sync();
                });
            }
            for (const item of dash._box.get_children())
                this._watchItem(item);
            for (const actor of global.get_window_actors())
                this._watchWindow(actor.meta_window);
        } catch (error) {
            this.destroy();
            throw error;
        }
    }

    _connect(object, signal, callback) {
        this._connections.push([object, object.connect(signal, callback)]);
    }

    queueSync() {
        if (this._idleId)
            return;
        this._idleId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._idleId = 0;
            this.sync();
            return GLib.SOURCE_REMOVE;
        });
    }

    _hoverChanged() {
        if (this._hideId)
            GLib.source_remove(this._hideId);
        this._hideId = 0;
        if (this._dash.hover) {
            this.sync();
        } else {
            this._hideId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, HIDE_DELAY, () => {
                this._hideId = 0;
                this.sync();
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    sync() {
        const enabled = this._settings.get_boolean('autohide') || this._settings.get_boolean('intellihide');
        const desktop = this._isDesktop();
        const reveal = !enabled || !desktop || Main.overview.visible || this._dragging ||
            this._dash.hover || this._hideId !== 0 || this._isMenuOpen() ||
            [...this._items.keys()].some(icon => icon._menu?.isOpen);
        const hide = !reveal && (this._settings.get_boolean('intellihide')
            ? this._hasOverlap() : true);
        const target = hide
            ? Math.max(0, this._host.height - this._dash.y - this._dash._background.y - PEEK)
            : 0;
        if (!desktop) {
            this._host.remove_transition('translation-y');
            this._host.translation_y = 0;
            this._target = 0;
            return;
        }
        if (target === this._target)
            return;
        this._target = target;
        this._host.ease({
            translation_y: target,
            duration: DURATION,
            mode: Clutter.AnimationMode.EASE_IN_OUT_SINE,
        });
        if (hide) {
            this._dash._showAppsIcon.label.hide();
            for (const item of this._dash._box.get_children())
                item.label?.hide();
        }
    }

    /* ----- Window Overlap ----- */

    _watchWindow(window) {
        if (this._windows.has(window))
            return;
        const ids = ['position-changed', 'size-changed', 'notify::minimized', 'workspace-changed']
            .map(signal => window.connect(signal, () => this.queueSync()));
        ids.push(window.connect('unmanaged', () => {
            for (const id of this._windows.get(window) ?? [])
                window.disconnect(id);
            this._windows.delete(window);
            this.queueSync();
        }));
        this._windows.set(window, ids);
        this.queueSync();
    }

    _hasOverlap() {
        const workspace = global.workspace_manager.get_active_workspace();
        const background = this._dash._background;
        const [x, translatedY] = background.get_transformed_position();
        const [width, height] = background.get_transformed_size();
        const y = translatedY - this._host.translation_y;
        for (const window of this._windows.keys()) {
            if (window.minimized || !window.located_on_workspace(workspace) ||
                ![Meta.WindowType.NORMAL, Meta.WindowType.DIALOG,
                    Meta.WindowType.MODAL_DIALOG, Meta.WindowType.UTILITY].includes(window.get_window_type()))
                continue;
            const rect = window.get_frame_rect();
            if (rect.x < x + width && rect.x + rect.width > x &&
                rect.y < y + height && rect.y + rect.height > y)
                return true;
        }
        return false;
    }

    /* ----- Application Menus ----- */

    _watchItem(item) {
        const icon = item.child?._delegate;
        if (!icon?.app || this._items.has(icon))
            return;
        const menuId = icon.connect('menu-state-changed', () => this.queueSync());
        const destroyId = icon.connect('destroy', () => {
            icon.disconnect(menuId);
            this._items.delete(icon);
            this.queueSync();
        });
        this._items.set(icon, [menuId, destroyId]);
    }

    /* ----- Cleanup ----- */

    destroy() {
        if (this._idleId)
            GLib.source_remove(this._idleId);
        if (this._hideId)
            GLib.source_remove(this._hideId);
        for (const [object, id] of this._connections)
            object.disconnect(id);
        for (const [window, ids] of this._windows) {
            for (const id of ids)
                window.disconnect(id);
        }
        for (const [icon, ids] of this._items) {
            for (const id of ids)
                icon.disconnect(id);
        }
        this._host.remove_transition('translation-y');
        this._host.translation_y = 0;
        this._dash.track_hover = this._trackHover;
        this._dash.reactive = this._reactive;
        this._connections = [];
        this._windows.clear();
        this._items.clear();
        this._host = this._dash = this._settings = this._isDesktop = this._isMenuOpen = null;
    }
}
