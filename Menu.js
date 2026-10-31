import Clutter from 'gi://Clutter';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

/* ----- Show Apps Context Menu ----- */

export class Menu {
    constructor(dash, openPreferences) {
        this._button = dash.showAppsButton;
        this._openPreferences = openPreferences;
        this._menu = null;
        this._manager = new PopupMenu.PopupMenuManager(this._button);
        this._gesture = new Clutter.ClickGesture({
            required_button: Clutter.BUTTON_SECONDARY,
            recognize_on_press: true,
        });
        this._gesture.connect('recognize', () => this._open());
        this._button.add_action(this._gesture);
        this._hidingId = Main.overview.connect('hiding', () => this._menu?.close());
    }

    _open() {
        if (!this._menu) {
            this._menu = new PopupMenu.PopupMenu(this._button, 0.5, St.Side.BOTTOM);
            this._menu.addAction('Show Settings', () => {
                Main.overview.hide();
                this._openPreferences();
            }, 'emblem-system-symbolic');
            Main.uiGroup.add_child(this._menu.actor);
            this._menu.actor.hide();
            this._manager.addMenu(this._menu);
        }
        this._button._delegate.label.hide();
        this._menu.open();
    }

    /* ----- Cleanup ----- */

    destroy() {
        Main.overview.disconnect(this._hidingId);
        this._button.remove_action(this._gesture);
        this._menu?.destroy();
        this._button = this._gesture = this._menu = this._manager = this._openPreferences = null;
    }
}
