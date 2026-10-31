/* ----- Background Colors ----- */

export class Colors {
    constructor(dash, settings) {
        this._dash = dash;
        this._settings = settings;
        this._backgroundStyle = dash._background.get_style();
        this._connections = ['background-transparency', 'background-color', 'custom-background']
            .map(key => settings.connect(`changed::${key}`, () => this._sync()));
        this._sync();
    }

    _sync() {
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
        this._dash._background.set_style(this._backgroundStyle);
        this._dash.remove_style_class_name('dashcraft-custom-background');
        this._connections = [];
        this._dash = this._settings = this._backgroundStyle = null;
    }
}
