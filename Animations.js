import Clutter from 'gi://Clutter';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

/* ----- Native Icon Animations ----- */

const DURATION = 250;
const EASING = Clutter.AnimationMode.EASE_IN_OUT_SINE;

export class Animations {
    constructor(dash, isDesktop) {
        this._dash = dash;
        this._isDesktop = isDesktop;
        this._items = new Map();
        this._separators = new Map();
        this._overviewIds = ['shown', 'hidden'].map(signal =>
            Main.overview.connect(signal, () => this._flushEntrances()));
        this._addedId = dash._box.connect('child-added', (_box, item) => this._watch(item));
        for (const item of dash._box.get_children())
            this._watch(item);
    }

    _canAnimate() {
        return this._isDesktop() && this._dash.mapped &&
            !Main.layoutManager._startingUp && !Main.overview.animationInProgress;
    }

    _watch(item) {
        if (item.has_style_class_name('dash-separator')) {
            this._watchSeparator(item);
            return;
        }
        if (!item.child?._delegate?.app || this._items.has(item))
            return;
        const show = item.show;
        const destroy = item.destroy;
        const record = {
            show: Object.getOwnPropertyDescriptor(item, 'show'),
            destroy: Object.getOwnPropertyDescriptor(item, 'destroy'),
            animateOutAndDestroy: Object.getOwnPropertyDescriptor(item, 'animateOutAndDestroy'),
            pending: false,
            enter: null,
            destroyId: item.connect('destroy', () => this._items.delete(item)),
        };
        this._items.set(item, record);
        record.enter = () => {
            record.pending = false;
            this._prepare(item, record);
            const [, width] = item.get_preferred_width(-1);
            item.width = 0;
            item.child.set_scale(0, 0);
            item.child.opacity = 0;
            item.ease({
                width,
                duration: DURATION,
                mode: EASING,
                onComplete: () => this._restoreLayout(item, record),
            });
            item.child.ease({
                scale_x: 1,
                scale_y: 1,
                opacity: 255,
                duration: DURATION,
                mode: EASING,
            });
        };
        item.show = animate => {
            if (this._canAnimate()) {
                record.enter();
            } else if (this._isDesktop() && this._dash.mapped &&
                !Main.layoutManager._startingUp && Main.overview.animationInProgress) {
                record.pending = true;
            } else {
                record.pending = false;
                show.call(item, animate);
            }
        };
        item.animateOutAndDestroy = () => {
            if (item.animatingOut)
                return;
            record.pending = false;
            item.label?.hide();
            item.animatingOut = true;
            const width = item.width;
            this._prepare(item, record);
            item.width = width;
            item.child.ease({
                scale_x: 0,
                scale_y: 0,
                opacity: 0,
                duration: DURATION,
                mode: EASING,
            });
            item.ease({
                width: 0,
                duration: DURATION,
                mode: EASING,
                onComplete: () => destroy.call(item),
            });
        };
        item.destroy = () => {
            if (item.animatingOut)
                return;
            if (item.get_parent() === this._dash._box && this._canAnimate())
                item.animateOutAndDestroy();
            else
                destroy.call(item);
        };
    }

    /* ----- Running Apps Separator ----- */

    _watchSeparator(actor) {
        if (this._separators.has(actor))
            return;
        const destroy = actor.destroy;
        const node = actor.get_theme_node();
        const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        const record = {
            style: actor.get_style(),
            descriptor: Object.getOwnPropertyDescriptor(actor, 'destroy'),
            width: node.get_length('width') / scale,
            left: node.get_margin(St.Side.LEFT) / scale,
            right: node.get_margin(St.Side.RIGHT) / scale,
            progress: 1,
            timeline: null,
            exiting: false,
            pending: false,
            destroyId: actor.connect('destroy', () => {
                record.timeline?.stop();
                this._separators.delete(actor);
            }),
        };
        this._separators.set(actor, record);
        const render = progress => {
            record.progress = progress;
            const original = record.style?.trim().replace(/;+$/, '');
            actor.set_style(`${original ? `${original}; ` : ''}min-width: 0; ` +
                `width: ${record.width * progress}px; ` +
                `margin-left: ${record.left * progress}px; ` +
                `margin-right: ${record.right * progress}px;`);
            actor.opacity = Math.round(255 * progress);
        };
        record.animate = exiting => {
            record.pending = false;
            record.timeline?.stop();
            const from = record.progress;
            const target = exiting ? 0 : 1;
            const timeline = new Clutter.Timeline({actor, duration: DURATION});
            timeline.set_progress_mode(EASING);
            timeline.connect('new-frame', () => render(from + (target - from) * timeline.get_progress()));
            timeline.connect('completed', () => {
                record.timeline = null;
                if (exiting)
                    destroy.call(actor);
                else
                    actor.set_style(record.style);
            });
            record.timeline = timeline;
            timeline.start();
        };
        actor.destroy = () => {
            if (record.exiting)
                return;
            if (this._canAnimate()) {
                record.exiting = true;
                record.animate(true);
            } else {
                destroy.call(actor);
            }
        };
        if (this._canAnimate()) {
            render(0);
            record.animate(false);
        } else if (this._isDesktop() && Main.overview.animationInProgress) {
            render(0);
            record.pending = true;
        }
    }

    /* ----- Layout and Visual Scale ----- */

    _prepare(item, record) {
        item.remove_all_transitions();
        item.set_scale(1, 1);
        item.opacity = 255;
        if (!record.layout) {
            const child = item.child;
            record.pivot = child.get_pivot_point();
            record.layout = {
                x_expand: child.x_expand,
                y_expand: child.y_expand,
                x_align: child.x_align,
                y_align: child.y_align,
            };
        }
        item.child.set({
            x_expand: false,
            y_expand: false,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        item.child.set_pivot_point(0.5, 0.5);
    }

    _restoreLayout(item, record) {
        if (record.layout) {
            item.child.set(record.layout);
            item.child.set_pivot_point(...record.pivot);
            record.layout = null;
        }
        item.set_width(-1);
    }

    _flushEntrances() {
        for (const [actor, record] of this._separators) {
            if (record.pending && !record.exiting) {
                if (this._canAnimate()) {
                    record.animate(false);
                } else {
                    record.pending = false;
                    record.progress = 1;
                    actor.opacity = 255;
                    actor.set_style(record.style);
                }
            }
        }
        for (const [item, record] of this._items) {
            if (record.pending && !item.animatingOut)
                item.show(false);
        }
    }

    /* ----- Cleanup ----- */

    destroy() {
        this._dash._box.disconnect(this._addedId);
        for (const id of this._overviewIds)
            Main.overview.disconnect(id);
        for (const [actor, record] of this._separators) {
            record.timeline?.stop();
            actor.disconnect(record.destroyId);
            if (record.descriptor)
                Object.defineProperty(actor, 'destroy', record.descriptor);
            else
                delete actor.destroy;
            if (record.exiting) {
                actor.destroy();
            } else {
                actor.set_style(record.style);
                actor.opacity = 255;
            }
        }
        this._separators.clear();
        for (const [item, record] of this._items) {
            item.disconnect(record.destroyId);
            for (const method of ['show', 'destroy', 'animateOutAndDestroy']) {
                if (record[method])
                    Object.defineProperty(item, method, record[method]);
                else
                    delete item[method];
            }
            item.remove_all_transitions();
            item.child.remove_all_transitions();
            if (item.animatingOut) {
                item.destroy();
            } else {
                this._restoreLayout(item, record);
                item.child.set_scale(1, 1);
                item.child.opacity = 255;
                item.set_scale(1, 1);
                item.opacity = 255;
            }
        }
        this._items.clear();
        this._dash = this._isDesktop = null;
    }
}
