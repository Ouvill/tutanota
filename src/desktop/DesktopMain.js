// @flow
import {app} from 'electron'
import {updater} from './ElectronUpdater.js'
import {MainWindow} from './MainWindow.js'
import DesktopUtils from './DesktopUtils.js'
import {notifier} from "./DesktopNotifier.js"
import {lang} from './DesktopLocalizationProvider.js'
import {ipc} from './IPC.js'
import PreloadImports from './PreloadImports.js'

let mainWindow: MainWindow
PreloadImports.keep()
app.setAppUserModelId("de.tutao.tutanota")
console.log("argv: ", process.argv)
console.log("version:  ", app.getVersion())

//check if there are any cli parameters that should be handled without a window
if (process.argv.indexOf("-r") !== -1) {
	//register as mailto handler, then quit
	DesktopUtils.registerAsMailtoHandler(false)
	            .then(() => app.exit(0))
	            .catch(() => app.exit(1))
} else if (process.argv.indexOf("-u") !== -1) {
	//unregister as mailto handler, then quit
	DesktopUtils.unregisterAsMailtoHandler(false)
	            .then(() => app.exit(0))
	            .catch(() => app.exit(1))
} else { //normal start
	if (!app.requestSingleInstanceLock()) {
		app.exit()
	}

	app.on('window-all-closed', () => {
		if (process.platform !== 'darwin') {
			app.quit()
		}
	})

	app.on('activate', () => {
		if (mainWindow === null) {
			mainWindow = new MainWindow()
		}
		mainWindow.show()
	})

	app.on('second-instance', (e, argv, cwd) => {
		if (mainWindow) {
			mainWindow.show()
			handleMailto(argv.find((arg) => arg.startsWith('mailto')))
		}
	})

	app.on('ready', createMainWindow)
}

function createMainWindow() {
	mainWindow = new MainWindow()
	console.log("default mailto handler:", app.isDefaultProtocolClient("mailto"))
	console.log("notifications available:", notifier.isAvailable())
	ipc.initialized().then(main)
}

function main() {
	console.log("Webapp ready")
	notifier.start()
	updater.start()
	lang.init()
	handleArgv()
	// .then(() => {
	//    return notifier
	//     .showOneShot({
	// 	    title: lang.get('yearly_label'),
	// 	    body: lang.get('amountUsedAndActivatedOf_label', {"{used}": 'nutzt', "{active}": 'aktiv', "{totalAmount}": 'max'}),
	//     })
	// })
	// .then((res) => {
	//    if (res !== NotificationResult.Click) {
	//     return Promise.reject()
	//    }
	//    return DesktopUtils.registerAsMailtoHandler(true)
	// })
	// .then(() => console.log("successfully registered as mailto handler "))
	// .catch((e) => console.log(e))
}

function handleArgv() {
	handleMailto(process.argv.find((arg) => arg.startsWith('mailto')))
}

function handleMailto(mailtoArg?: string) {
	if (mailtoArg) {
		/*[filesUris, text, addresses, subject, mailToUrl]*/
		ipc.sendRequest('createMailEditor', [[], "", "", "", mailtoArg])
	}
}