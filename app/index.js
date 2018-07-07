import React, { Component } from 'react';
import { AppRegistry, Platform, YellowBox } from 'react-native';
import { createStore, applyMiddleware, combineReducers } from "redux";

import { Provider } from "react-redux";

import { Navigation, NativeEventsReceiver } from 'react-native-navigation';

import { registerScreens, switchContext } from './screens';

import { persistStore } from 'redux-persist'
import { PersistGate } from 'redux-persist/integration/react'
import InCallManager from 'react-native-incall-manager';


import pushNotification from './lib/pushNotification';
import { IPCortexAPI } from './lib/IPCortexAPI';

import AppReducer, { actions } from './reducers';

import thunk from "redux-thunk";


const createStoreWithMiddleware = applyMiddleware(thunk)(createStore);
const store = createStoreWithMiddleware(
	AppReducer,
);

var persistor;


var notification = new pushNotification(store.dispatch,
	actions.notificationToken.token,
	actions.Phone);
// This needs to be here as it has to initialise
//  when the app is launched in background mode which
//  doesn't start the React lifecycle. Any deeper in the
//  project and onNotification isn't primed to fire when
//  the app is (re)started which means we don't process background
//  notifications
notification.register({
	Ring: function () {
		InCallManager.startRingtone('_BUNDLE_', null, null, 15);
	}
}, {
	Accept: function () {
		InCallManager.stopRingtone();
		store.dispatch(actions.Phone);
		store.dispatch({ type: actions.AcceptCall })
	},
	Reject: function () {
		InCallManager.stopRingtone();
		store.dispatch({ type: actions.RejectCall })
	}
});
/**
 * IPCMobile root React Native Component
 *
 * @type {Class}
 * @name IPCMobile
 */
export default class IPCMobile extends Component {
	constructor(props) {
		super(props);
		this.api = new IPCortexAPI(true, store, Provider);
    console.info('created', this);
		registerScreens(store, Provider)
			.then(() => {
				// Dont fire our first event until we are sure the redux
				// persistent store is re-hydrated
				persistor = persistStore(store, null, () => {
					store.subscribe(this.onStoreUpdate.bind(this));
					this.onStoreUpdate();
				});
			})

	}

	onStoreUpdate() {

		let state = store.getState();
		let { root, refresh } = state.nav
		// handle a root change
		console.log('onStoreUpdate', state, this);
		if (this.currentRoot != root && root !== 'nothing') {
			this.currentRoot = root;
			this.refresh = refresh;
			Navigation.isAppLaunched()
				.then((appLaunched) => {
          console.log('isAppLauncehd', appLaunched);
					if (appLaunched) {
						this.startApp(root);
					}
					new NativeEventsReceiver()
						.appLaunched(() => this.startApp(root));
				})
			//this.startApp(root);
		}
		let { target, loginToken, notificationToken } = state.auth;
		if (target &&
			target != '' &&
			target != this.currentTarget) {
			this.api.loadAPI(target)
				.then((hostname) => {
					this.currentTarget = target;
          console.log('apiLoaded', this);
					store.dispatch(actions.validateTarget);
					if (typeof loginToken === 'object'){
						this.api.doLogin({ token: loginToken }, target)
						// If we succeded, fire state transition
						.then((status) => {
							store.dispatch(actions.Login);
							console.log(status);
						})
						// failed? no point hanging on to a duff token but do_login cant do this for us
						.catch((err) => {
							console.log('this.api.dologin: err: ', err);
							store.dispatch(actions.setLoginToken.token(null));
							store.dispatch(actions.Logout);
						});
          }
          else {
            store.dispatch(actions.Logout);
          }
				})
				.catch((err) => {
          store.dispatch(actions.Logout);
					store.dispatch(actions.invalidateTarget);
				});
		}
    // If we have no current host then we need to present a login screen
    if((target == null || target.length === 0) && root === 'nothing')
      store.dispatch(actions.Logout);
//      this.startApp('login');
//      store.setState({nav: {root: 'login'}});
		if (notificationToken != null && notificationToken != this.notificationToken) {
      console.log('about to endNotificationToken', notificationToken, this.api)
			this.api.sendNotificationToken(notificationToken);
			this.notificationToken = notificationToken;
		}
	}

	startApp(root) {
		// This is a workaround for the fact that JsSIP sets a re-registration timer
		// for multiple minutes and this is an anti-pattern in Android apps.
		// We don't care about this because we are content to let the registration die,
		// but the console nag is a pain.
		YellowBox.ignoreWarnings([
			'Setting a timer', 'Remote debugger'
		]);
    console.log('startApp', root);
		switchContext(root);

	}

}

AppRegistry.registerComponent('IPCMobile', () => IPCMobile);
