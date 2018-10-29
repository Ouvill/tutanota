// @flow
import {ipcRenderer, remote} from 'electron'

/**
 * preload scripts can only load modules that have previously been loaded
 * in the main thread.
 */
const app = remote.require('electron').app
const PreloadImports = remote.require('./PreloadImports.js').default

function sendMessage(msg, args) {
	ipcRenderer.send(msg, args);
}

ipcRenderer.on('protocol-message', (ev, msg) => {
	let msg64 = JSON.stringify(msg)
	msg64 = PreloadImports.stringToUtf8Uint8Array(msg64)
	msg64 = PreloadImports.uint8ArrayToBase64(msg64)
	window.tutao.nativeApp.handleMessageFromNative(msg64)
})

function receiveMessage(msg, listener) {
	return ipcRenderer.on(msg, listener)
}

function removeListener(msg, listener) {
	return ipcRenderer.removeListener(msg, listener)
}

ipcRenderer.on('get-translations', () => {
	const translations = {
		translations: window.tutao.lang.translations,
		fallback: window.tutao.lang.fallback,
		code: window.tutao.lang.code,
		languageTag: window.tutao.lang.languageTag,
		staticTranslations: window.tutao.lang.staticTranslations,
		formats: window.tutao.lang.formats,
	}
	ipcRenderer.send('get-translations', translations)
})

window.nativeApp = {
	invoke: (msg: string) => {sendMessage('protocol-message', msg)},
	sendMessage: (msg: BridgeMessage, data: any) => sendMessage(msg, data),
	startListening: (msg: BridgeMessage, listener: Function) => receiveMessage(msg, listener),
	stopListening: (msg: BridgeMessage, listener: Function) => removeListener(msg, listener),
	getVersion: () => app.getVersion(),
}

// window.focus() doesn't seem to be working right now, so we're replacing it
// https://github.com/electron/electron/issues/8969#issuecomment-288024536
window.focus = () => {
	ipcRenderer.send('show-window')
}