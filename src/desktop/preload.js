// @flow
import {ipcRenderer, remote} from 'electron'

/**
 * preload scripts can only load modules that have previously been loaded
 * in the main thread.
 */
const app = remote.require('electron').app
const PreloadImports = remote.require('./PreloadImports.js').default
const Menu = remote.Menu
const MenuItem = remote.MenuItem

const menu = new Menu()
menu.append(new MenuItem({label: 'Copy', click() { console.log('item 1 clicked') }}))
menu.append(new MenuItem({label: 'Cut', click() { console.log('item 2 clicked') }}))
menu.append(new MenuItem({label: 'Paste', click() { console.log('item 3 clicked') }}))

window.addEventListener('contextmenu', (e) => {
	e.preventDefault()
	menu.popup({window: remote.getCurrentWindow()})
}, false)

function sendMessage(msg, args) {
	ipcRenderer.send(msg, args)
}

ipcRenderer.on('protocol-message', (ev, msg) => {
	window.tutao.nativeApp._nativeQueue._handleMessage(msg)
})

ipcRenderer.on('print-argv', (ev, msg) => {
	console.log("node argv:", msg)
})

function receiveMessage(msg, listener) {
	return ipcRenderer.on(msg, listener)
}

function removeListener(msg, listener) {
	return ipcRenderer.removeListener(msg, listener)
}

window.onmousewheel = (e) => {
	if (e.ctrlKey) {
		e.preventDefault()
		window.tutao.nativeApp.invokeNative(new PreloadImports.Request('changeZoomFactor', [e.deltaY > 0 ? -10 : 10]))
	}
}

window.nativeApp = {
	invoke: (msg: string) => {sendMessage('protocol-message', msg)},
	sendMessage: (msg: BridgeMessage, data: any) => sendMessage(msg, data),
	startListening: (msg: BridgeMessage, listener: Function) => receiveMessage(msg, listener),
	stopListening: (msg: BridgeMessage, listener: Function) => removeListener(msg, listener),
	getVersion: () => app.getVersion()
}

// window.focus() doesn't seem to be working right now, so we're replacing it
// https://github.com/electron/electron/issues/8969#issuecomment-288024536
window.focus = () => {
	ipcRenderer.send('show-window')
}