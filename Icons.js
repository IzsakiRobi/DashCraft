import Gio from 'gi://Gio';

/* ----- Show Apps Icon ----- */

export class Icons {
    constructor(dash, settings) {
        this._settings = settings;
        this._bin = dash.showAppsButton.child._iconBin;
        this._actor = null;
        this._original = null;
        this._changedId = settings.connect('changed::show-apps-icon', () => this._sync());
        this._childId = this._bin.connect('notify::child', () => this._sync());
        this._sync();
    }

    _sync() {
        const actor = this._bin.child;
        if (!actor)
            return;
        if (actor !== this._actor) {
            this._actor = actor;
            this._original = actor.gicon;
        }
        const path = this._settings.get_string('show-apps-icon');
        const file = path ? Gio.File.new_for_path(path) : null;
        actor.gicon = file?.query_exists(null)
            ? new Gio.FileIcon({file})
            : this._original;
    }

    /* ----- Cleanup ----- */

    destroy() {
        this._settings.disconnect(this._changedId);
        this._bin.disconnect(this._childId);
        if (this._bin.child === this._actor)
            this._actor.gicon = this._original;
        this._settings = this._bin = this._actor = this._original = null;
    }
}
