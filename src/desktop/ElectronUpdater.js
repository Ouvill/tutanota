// @flow
import {autoUpdater} from 'electron-updater'
import {NotificationResult, notifier} from './DesktopNotifier.js'
import {lang} from './DesktopLocalizationProvider'

class ElectronUpdater {
	_interval: IntervalID;

	start() {
		autoUpdater.logger = {
			info: (m) => console.log("info: ", m),
			debug: (m) => console.log("debug: ", m),
			verbose: (m) => console.log("verbose: ", m),
			error: (m) => console.log("ERROR: ", m),
			warn: (m) => console.log("warn: ", m),
			silly: (m) => console.log("silly: ", m)
		}

		autoUpdater.on('update-downloaded', (info) => {
			clearInterval(this._interval);

			// TODO: insert signature verification step
			//const pubKeyUrl = require(path.join(__dirname, '../..', 'package.json')).tutao.pubKeyUrl
			//const separatorBuf = Buffer.from(require(path.join(__dirname, '../..', 'package.json')).tutao.separator)

			notifier.showOneShot({
				title: lang.get('updateAvailable_label', {"{version}": info.version}),
				body: lang.get('clickToUpdate_msg'),
			}).then((res) => {
				if (res === NotificationResult.Click) {
					autoUpdater.quitAndInstall(false, true)
				}
			})
		})

		if (true /* public key location should be reachable */) {
			autoUpdater.checkForUpdates()

			this._interval = setInterval(() => {
				autoUpdater.checkForUpdates()
			}, 300000)
		}
	}
}

export const updater = new ElectronUpdater()
