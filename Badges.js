import Cairo from 'cairo';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

/* ----- Badge Graphics ----- */

function capsule(cr, x, y, width, height) {
    const radius = height / 2;
    cr.newSubPath();
    cr.arc(x + width - radius, y + radius, radius, -Math.PI / 2, Math.PI / 2);
    cr.arc(x + radius, y + radius, radius, Math.PI / 2, Math.PI * 1.5);
    cr.closePath();
}

function drawBadgeHighlight(cr, width, height) {
    if (width <= 0 || height <= 0)
        return;
    cr.save();
    const scale = height / 30;
    cr.scale(scale, scale);
    const w = width / scale;
    capsule(cr, 0.35, 0.35, w - 0.7, 29.3);
    capsule(cr, 0.95, 1.15, w - 1.9, 28.35);
    cr.setFillRule(Cairo.FillRule.EVEN_ODD);
    const light = new Cairo.LinearGradient(0, 0, 0, 30);
    light.addColorStopRGBA(0, 1, 1, 1, 0.34);
    light.addColorStopRGBA(0.4, 1, 1, 1, 0.17);
    light.addColorStopRGBA(0.75, 1, 1, 1, 0.065);
    light.addColorStopRGBA(1, 1, 1, 1, 0.025);
    cr.setSource(light);
    cr.fill();
    cr.restore();
}

const BadgeOverlay = GObject.registerClass(class DashCraftBadgeOverlay extends St.Widget {
    _init(icon, badge) {
        super._init({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.FILL,
            reactive: false,
        });
        this._icon = icon;
        this._badge = badge;
        this.add_child(badge);
    }

    vfunc_get_preferred_width() {
        return [0, 0];
    }

    vfunc_get_preferred_height() {
        return [0, 0];
    }

    vfunc_allocate(box) {
        this.set_allocation(box);
        const texture = this._icon.icon.icon;
        if (!texture)
            return;
        let x = 0;
        let y = 0;
        for (let actor = texture; actor && actor !== this.get_parent(); actor = actor.get_parent()) {
            x += actor.x;
            y += actor.y;
        }
        const [, naturalWidth] = this._badge.get_preferred_width(-1);
        const [, naturalHeight] = this._badge.get_preferred_height(-1);
        const height = Math.ceil(naturalHeight);
        const width = Math.max(height, Math.ceil(naturalWidth));
        const left = Math.round(x + texture.width - height * 0.8 - (width - height));
        const top = Math.round(y - height * 0.125);
        this._badge.allocate(new Clutter.ActorBox({
            x1: left,
            y1: top,
            x2: left + width,
            y2: top + height,
        }));
    }
});

/* ----- Application Counters ----- */

class LauncherBadges {
    constructor(changed) {
        this._changed = changed;
        this._publishers = new Map();
        this._bus = Gio.DBus.session;
        this._updateId = this._bus.signal_subscribe(
            null, 'com.canonical.Unity.LauncherEntry', 'Update', null, null,
            Gio.DBusSignalFlags.NONE,
            (_bus, sender, _path, _interface, _signal, parameters) => {
                this._update(sender, parameters);
            });
        this._ownerId = this._bus.signal_subscribe(
            'org.freedesktop.DBus', 'org.freedesktop.DBus', 'NameOwnerChanged',
            '/org/freedesktop/DBus', null, Gio.DBusSignalFlags.NONE,
            (_bus, _sender, _path, _interface, _signal, parameters) => {
                const [name, oldOwner, newOwner] = parameters.deep_unpack();
                if (name.startsWith(':') && oldOwner && !newOwner &&
                    this._publishers.delete(name))
                    this._changed?.();
            });
        this._nameId = Gio.bus_own_name(
            Gio.BusType.SESSION, 'com.canonical.Unity',
            Gio.BusNameOwnerFlags.NONE, null, null, null);
    }

    _update(sender, parameters) {
        if (parameters.get_type_string() !== '(sa{sv})')
            return;
        const [uri, properties] = parameters.deep_unpack();
        if (!uri.startsWith('application://'))
            return;
        let appId;
        try {
            appId = decodeURIComponent(uri.slice('application://'.length));
        } catch {
            return;
        }
        if (!appId.endsWith('.desktop') || appId.includes('/'))
            return;
        const countValue = properties.count;
        const visibleValue = properties['count-visible'];
        const hasCount = countValue?.get_type_string() === 'x';
        const hasVisible = visibleValue?.get_type_string() === 'b';
        if (!hasCount && !hasVisible)
            return;
        let entries = this._publishers.get(sender);
        if (!entries) {
            entries = new Map();
            this._publishers.set(sender, entries);
        }
        const previous = entries.get(appId) ?? {count: 0, visible: false};
        entries.set(appId, {
            count: hasCount ? Math.max(0, Math.min(Number.MAX_SAFE_INTEGER,
                countValue.get_int64())) : previous.count,
            visible: hasVisible ? visibleValue.get_boolean() : previous.visible,
        });
        this._changed?.();
    }

    getCounts() {
        const counts = new Map();
        for (const entries of this._publishers.values()) {
            for (const [appId, {count, visible}] of entries) {
                counts.set(appId, Math.max(counts.get(appId) ?? 0, visible ? count : 0));
            }
        }
        return counts;
    }

    destroy() {
        this._changed = null;
        this._bus.signal_unsubscribe(this._updateId);
        this._bus.signal_unsubscribe(this._ownerId);
        Gio.bus_unown_name(this._nameId);
        this._publishers.clear();
    }
}

/* ----- Badge Controller ----- */

export class Badges {
    constructor(dash, settings) {
        this._dash = dash;
        this._settings = settings;
        this._sources = new Map();
        this._badges = new Map();
        this._connections = [
            [settings, settings.connect('changed::show-badges', () => this._sync())],
            [dash._box, dash._box.connect('child-added', () => this._sync())],
            [Main.messageTray, Main.messageTray.connect('source-added', (_tray, source) => {
                this._watchSource(source);
                this._sync();
            })],
            [Main.messageTray, Main.messageTray.connect('source-removed', (_tray, source) => {
                this._unwatchSource(source);
                this._sync();
            })],
        ];
        for (const source of Main.messageTray.getSources())
            this._watchSource(source);
        this._launcherBadges = new LauncherBadges(() => this._sync());
        this._sync();
    }

    _watchSource(source) {
        if (this._sources.has(source))
            return;
        this._sources.set(source, source.connect('notify::count', () => this._sync()));
    }

    _unwatchSource(source) {
        const id = this._sources.get(source);
        if (id !== undefined) {
            source.disconnect(id);
            this._sources.delete(source);
        }
    }

    _sync() {
        if (!this._settings.get_boolean('show-badges')) {
            for (const {overlay} of this._badges.values())
                overlay.hide();
            return;
        }
        const counts = new Map();
        for (const source of this._sources.keys()) {
            const appId = source.app?.get_id() ??
                (source.policy?.id ? `${source.policy.id.replace(/\.desktop$/, '')}.desktop` : null);
            if (appId)
                counts.set(appId, (counts.get(appId) ?? 0) + source.count);
        }
        for (const [appId, count] of this._launcherBadges?.getCounts() ?? [])
            counts.set(appId, count);
        for (const item of this._dash._box.get_children()) {
            const icon = item.child?._delegate;
            if (!icon?.app || !icon._iconContainer)
                continue;
            let badge = this._badges.get(icon);
            if (!badge) {
                const label = new St.Label({
                    style_class: 'dashcraft-badge-number',
                    x_expand: true,
                    y_expand: true,
                    x_align: Clutter.ActorAlign.CENTER,
                    y_align: Clutter.ActorAlign.CENTER,
                });
                label.clutter_text.set({
                    x_align: Clutter.ActorAlign.CENTER,
                    y_align: Clutter.ActorAlign.CENTER,
                });
                const face = new St.Widget({
                    layout_manager: new Clutter.BinLayout(),
                    x_expand: true,
                    y_expand: true,
                    x_align: Clutter.ActorAlign.FILL,
                    y_align: Clutter.ActorAlign.FILL,
                });
                const highlight = new St.DrawingArea({
                    x_expand: true,
                    y_expand: true,
                    x_align: Clutter.ActorAlign.FILL,
                    y_align: Clutter.ActorAlign.FILL,
                    reactive: false,
                });
                highlight.connect('repaint', area => {
                    const cr = area.get_context();
                    try {
                        const [width, height] = area.get_surface_size();
                        drawBadgeHighlight(cr, width, height);
                    } finally {
                        cr.$dispose();
                    }
                });
                face.add_child(highlight);
                face.add_child(label);
                const actor = new St.Bin({
                    style_class: 'dashcraft-badge',
                    child: face,
                    reactive: false,
                });
                const overlay = new BadgeOverlay(icon, actor);
                icon._iconContainer.add_child(overlay);
                const destroyId = icon.connect('destroy', () => this._badges.delete(icon));
                badge = {actor, label, overlay, destroyId};
                this._badges.set(icon, badge);
            }
            const count = counts.get(icon.app.get_id()) ?? 0;
            badge.label.text = count > 99 ? '99+' : String(count);
            badge.actor.visible = count > 0;
            badge.overlay.visible = count > 0;
            badge.overlay.queue_relayout();
            badge.label.accessible_name = `${count} notifications`;
        }
    }

    destroy() {
        this._launcherBadges.destroy();
        for (const [object, id] of this._connections)
            object.disconnect(id);
        for (const source of this._sources.keys())
            this._unwatchSource(source);
        for (const [icon, {overlay, destroyId}] of this._badges) {
            icon.disconnect(destroyId);
            overlay.destroy();
        }
        this._badges.clear();
        this._connections = [];
        this._launcherBadges = this._dash = this._settings = null;
    }
}
