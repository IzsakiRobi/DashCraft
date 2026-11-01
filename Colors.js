import Cairo from 'cairo';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

/* ----- Background Colors ----- */

export class Colors {
    constructor(dash, settings) {
        this._dash = dash;
        this._settings = settings;
        this._backgroundStyle = dash._background.get_style();
        this._border = new DockBorder(dash._background, settings);
        dash.insert_child_above(this._border, dash._background);
        this._connections = [
            'background-transparency', 'background-color', 'custom-background',
            'border-enabled', 'border-color',
        ].map(key => settings.connect(`changed::${key}`, () => this._sync()));
        this._sync();
    }

    _sync() {
        this._border.visible = this._settings.get_boolean('border-enabled');
        this._border.queue_repaint();
        const custom = this._settings.get_boolean('custom-background');
        if (!custom) {
            this._dash.remove_style_class_name('dashcraft-custom-background');
            this._dash._background.set_style(this._backgroundStyle);
            return;
        }
        this._dash.add_style_class_name('dashcraft-custom-background');
        const saved = this._settings.get_string('background-color');
        const color = /^#[0-9a-f]{6}$/i.test(saved) ? saved : '#38383c';
        const rgb = [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16));
        const alpha = 1 - this._settings.get_int('background-transparency') / 100;
        let style = `background-color: rgba(${rgb.join(', ')}, ${alpha.toFixed(2)});`;
        const original = this._backgroundStyle?.trim();
        if (original)
            style = `${original.replace(/;+$/, '')}; ${style}`;
        if (alpha === 0)
            style += ' border-color: transparent; box-shadow: none;';
        this._dash._background.set_style(style);
    }

    destroy() {
        for (const id of this._connections)
            this._settings.disconnect(id);
        this._border.destroy();
        this._border = null;
        this._dash._background.set_style(this._backgroundStyle);
        this._dash.remove_style_class_name('dashcraft-custom-background');
        this._connections = [];
        this._dash = this._settings = this._backgroundStyle = null;
    }
}

/* ----- Dock Edge Highlight ----- */

function drawBorder(cr, width, height, radii, color, scale) {
    if (width <= 0 || height <= 0)
        return;
    const inset = 0.6 * scale;
    const x = inset;
    const y = inset;
    const right = width - inset;
    const bottom = height - inset;
    const maximum = Math.max(0, Math.min(right - x, bottom - y) / 2);
    const [tl, tr, br, bl] = radii.map(radius => Math.max(0, Math.min(maximum, radius - inset)));
    cr.newSubPath();
    cr.moveTo(x + tl, y);
    cr.lineTo(right - tr, y);
    cr.arc(right - tr, y + tr, tr, -Math.PI / 2, 0);
    cr.lineTo(right, bottom - br);
    cr.arc(right - br, bottom - br, br, 0, Math.PI / 2);
    cr.lineTo(x + bl, bottom);
    cr.arc(x + bl, bottom - bl, bl, Math.PI / 2, Math.PI);
    cr.lineTo(x, y + tl);
    cr.arc(x + tl, y + tl, tl, Math.PI, Math.PI * 1.5);
    cr.closePath();
    const rgb = [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16) / 255);
    const light = new Cairo.LinearGradient(0, 0, 0, height);
    light.addColorStopRGBA(0, ...rgb, 0.38);
    light.addColorStopRGBA(0.3, ...rgb, 0.2);
    light.addColorStopRGBA(0.65, ...rgb, 0.045);
    light.addColorStopRGBA(0.9, ...rgb, 0);
    light.addColorStopRGBA(1, ...rgb, 0);
    cr.setSource(light);
    cr.setLineWidth(0.85 * scale);
    cr.stroke();
}

const DockBorder = GObject.registerClass(class DashCraftDockBorder extends St.DrawingArea {
    _init(background, settings) {
        super._init({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.FILL,
            y_align: Clutter.ActorAlign.FILL,
            reactive: false,
        });
        this.connect('repaint', area => {
            const cr = area.get_context();
            try {
                const [width, height] = area.get_surface_size();
                const node = background.get_theme_node();
                const radii = [St.Corner.TOPLEFT, St.Corner.TOPRIGHT, St.Corner.BOTTOMRIGHT, St.Corner.BOTTOMLEFT]
                    .map(corner => node.get_border_radius(corner));
                const saved = settings.get_string('border-color');
                const color = /^#[0-9a-f]{6}$/i.test(saved) ? saved : '#ffffff';
                const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
                drawBorder(cr, width, height, radii, color, scale);
            } finally {
                cr.$dispose();
            }
        });
    }

    vfunc_get_preferred_width() {
        return [0, 0];
    }

    vfunc_get_preferred_height() {
        return [0, 0];
    }
});
