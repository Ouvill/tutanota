const linuxsigner = require('./linuxsigner.js')

/**
 *  gets executed after all installers are ready but before latest.yml gets created
 * @param args
 */

function hook(args) {
	console.log("AfterAllArtifactBuild hook...")

	const exePath = args.artifactPaths.find(path => path.endsWith('.exe'))
	const appImagePath = args.artifactPaths.find(path => path.endsWith('AppImage'))

	if (appImagePath !== undefined && process.env.LINUX_CSC_LINK) {
		linuxsigner(appImagePath)
	}
}

module.exports = hook