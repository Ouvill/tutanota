const linuxsigner = require('../buildSrc/linuxsigner.js')
const path = require('path')
const request = require('request')
const crypto = require('crypto')
const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs-extra'))

const files = linuxsigner({
	filePath: path.join(__dirname, '../build/desktop-snapshot/tutanota-desktop-snapshot-1541403566513.0.0-linux.AppImage'),
	privateKeyPath: path.join(__dirname, './tutao.pem'),
	passPhrase: 'passphrase' // obviously a testing key
})

//////////////////
// Verification //
//////////////////
const separatorBuf = Buffer.from('\n>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> TLS <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<\n')
const pubKeyUrl = 'https://raw.githubusercontent.com/tutao/tutanota/electron-client/tutao-pub.pem'

const signedAppImageData = fs.readFileSync(files.signedFilePath)
const parts = bufferSplit(signedAppImageData, separatorBuf)
const appImageData = parts.shift()
const signature = parts.shift().toString('utf-8')

trackPublicKey(pubKeyUrl)
	.then((key) => {
		const verify = crypto.createVerify('SHA256')
		verify.update(appImageData, null)

		const signatureVerified = verify.verify(key, signature, 'hex')

		console.log(
			signatureVerified
				? "signature verification successful"
				: "signature verification failed"
		)
	})

//TODO: do a smoke test on the new AppImage before installing?

function bufferSplit(bufferToSplit, delimiter) {
	let i = bufferToSplit.indexOf(delimiter)
	let parts = []
	while (i > -1) {
		parts.push(bufferToSplit.slice(0, i))
		bufferToSplit = bufferToSplit.slice(i + delimiter.length, bufferToSplit.length)
		i = bufferToSplit.indexOf(delimiter)
	}
	parts.push(bufferToSplit)
	return parts
}

function trackPublicKey(url) {
	if (!url.startsWith('https://')) {
		return Promise.reject(new Error("invalid URL"))
	}
	return requestPublicKey(url)
		.then((result) => {
			if (!result.startsWith('-----BEGIN PUBLIC KEY-----')) {
				const newUrl = result
					.split(':NEWURL:')
					.filter((part) => {
						return part.startsWith(' https://')
					})[0]
					.trim()
				return trackPublicKey(newUrl)
			} else {
				return result
			}
		})
}

function requestPublicKey(url) {
	return new Promise((resolve, reject) => {
		request(url, (error, response, body) => {
			if (error !== null) {
				reject(error)
			}
			resolve(body)
		})
	})
}