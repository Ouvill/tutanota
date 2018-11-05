/**
 * Utility to codesign the finished AppImage.
 * This enables the App to verify the authenticity of the Updates, and
 * enables the User to verify the authenticity of their manually downloaded
 * AppImage with the openssl utility.
 * We use two signatures for this:
 *  the first one is embedded into the AppImage. This is used by the
 *  App to verify its updates after download
 *
 *  Format: [appImage, separator, signature].join()
 *
 *  should the location of the public key change, we can leave the URL to
 *  the new location in place of the key
 *  (in the format :NEWURL: https://new.com/pub.pem :NEWURL:, to protect against format changes
 *  we don't control).
 *  the verifier will follow the links until it gets a response body
 *  that starts with '-----BEGIN PUBLIC KEY-----'
 *  or throw an error if it can't find the next step
 *
 *  the second signature signs the AppImage with the embedded signature #1 and is provided as a separate
 *  file (signature.bin) to the User to verify the initial download via
 *
 *      # get public key from github
 *      wget https://raw.githubusercontent.com/tutao/tutanota/electron-client/tutao-pub.pem
 *      # validate the signature against public key
 *      openssl dgst -sha256 -verify tutao-pub.pem -signature signature.bin tutanota.AppImage
 *
 * openssl should Print 'Verified OK' after the second command if the signature matches the certificate
 *
 * This prevents an attacker from getting forged AppImages/updates installed/applied
 *
 * get public key from cert:
 * openssl x509 -pubkey -noout -in cert.pem > pubkey.pem
 * */

const crypto = require('crypto')
const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs-extra'))
const path = require('path')
// \n, 32 gt, space, 'TLS', space, 32 lt, \n
const separatorBuf = Buffer.from('\n>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> TLS <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<\n', 'utf8')

/**
 *
 * @param args.filePath path to the file to sign
 * @param args.privateKeyPath path to private key file in PEM format
 * @param args.passPhrase pass phrase to the private key
 *
 * @return object with paths to the generated files
 */
function signer(args) {
	const {filePath} = args
	console.log("Signing", path.basename(filePath), '...')
	const dir = path.dirname(filePath)
	const {filename, ext} = splitBasename(filePath)
	const fileData = fs.readFileSync(filePath, null) //binary format

	const fileOutPath = path.join(dir, filename + '-signed.' + ext)
	const sigOutPath = path.join(dir, filename + '-sig.bin')

	const privateKey = {
		key: fs.readFileSync(args.privateKeyPath, {encoding: 'utf-8'}),
		passphrase: args.passPhrase
	}

	//create the first signature
	const sign1 = crypto.createSign('SHA256')
	sign1.update(fileData, null)
	const sig1 = sign1.sign(privateKey, null).toString('hex')

	//append first signature to appImage
	const signedfileData = Buffer.concat([
		fileData,
		separatorBuf,
		Buffer.from(sig1, 'utf-8')
	])

	fs.writeFileSync(fileOutPath, signedfileData, null)

	// create the second (detached) signature
	const sign2 = crypto.createSign('SHA256')
	sign2.update(signedfileData, null)

	const sig2 = sign2.sign(privateKey, null)
	fs.writeFileSync(sigOutPath, sig2, null)

	return {
		signedFilePath: fileOutPath,
		detachedSignaturePath: sigOutPath
	}
}

function splitBasename(filePath) {
	const parts = path.basename(filePath).split('.')
	if (parts.length < 2) {
		return {
			filename: parts.join('.'),
			ext: ''
		}
	} else {
		const ext = parts.pop()
		return {
			filename: parts.join('.'),
			ext: ext
		}
	}
}

module.exports = signer