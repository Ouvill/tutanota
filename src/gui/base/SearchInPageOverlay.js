/**
 * search bar for the Ctrl+F in-page search of the Desktop client
 */
// @flow
import m from 'mithril'
import {logins} from '../../api/main/LoginController.js'
import {displayOverlay} from './Overlay'
import {px, size} from "../size"
import {Icons} from "./icons/Icons"
import {Button} from "./Button"
import {Keys} from "../../misc/KeyManager"
import {assertMainOrNode} from "../../api/Env"
import {Request} from "../../api/common/WorkerProtocol.js"
import {lang} from "../../misc/LanguageViewModel"
import stream from "mithril/stream/stream.js"
import {transform} from "../animation/Animations"

assertMainOrNode()

export class SearchInPageOverlay {
	_closeFunction: (() => void) | null;
	_domInput: HTMLInputElement;
	_skipNextBlur: boolean;
	_matchCase = false;
	onblur: Stream<*>;

	constructor() {
		this._closeFunction = null
		this.onblur = stream()
	}

	open() {
		if (logins.isUserLoggedIn()) {
			if (!this._closeFunction) {
				this._closeFunction = displayOverlay(
					this._getRect(),
					this._getComponent(),
					(dom) => transform(transform.type.translateY, dom.offsetHeight, 0),
					(dom) => transform(transform.type.translateY, 0, dom.offsetHeight)
				)
			}
			m.redraw()
			this._domInput.focus()
		}
	}

	close() {
		if (this._closeFunction) {
			this._closeFunction()
			window.tutao.nativeApp.invokeNative(new Request("stopFindInPage", []))
			this._closeFunction = null
		}
		m.redraw()
	}

	_getRect() {
		return {
			height: px(48),
			bottom: px(0),
			right: px(0),
			left: px(0)
		}
	}

	_inputField = (): VirtualElement | null => {
		return m("input.dropdown-bar.pl-l.button-height.inputWrapper", {
				placeholder: lang.get("searchPage_label"),
				oncreate: (vnode) => {
					this._domInput = vnode.dom
				},
				oninput: e => {
					this._skipNextBlur = true
					window.tutao.nativeApp.invokeNative(new Request("stopFindInPage", []))
					if (this._domInput.value !== '') {
						window.tutao.nativeApp.invokeNative(new Request("findInPage", [this._domInput.value, {foward: true, matchCase: this._matchCase}]))
					} else {
						window.focus()
						this._domInput.focus()
					}
				},
				onblur: e => this.blur(e),
				style: {
					width: px(250),
					top: 0,
					height: px(size.button_height),
					left: 0,
				}
			},
			""
		)
	}

	_getComponent(): VirtualElement {

		let matchCaseButton = new Button("ignoreCase_alt",
			() => {
				this._matchCase = false
				if (this._domInput.value !== "") {
					window.tutao.nativeApp.invokeNative(new Request("stopFindInPage", []))
					window.tutao.nativeApp.invokeNative(new Request("findInPage", [this._domInput.value, {forward: true, matchCase: this._matchCase}]))
				}
				this._domInput.focus()
			},
			() => Icons.MatchCase
		)
			.setSelected(() => true)
			.disableBubbling()

		let ignoreCaseButton = new Button("matchCase_alt",
			() => {
				this._matchCase = true
				if (this._domInput.value !== "") {
					window.tutao.nativeApp.invokeNative(new Request("stopFindInPage", []))
					window.tutao.nativeApp.invokeNative(new Request("findInPage", [this._domInput.value, {forward: true, matchCase: this._matchCase}]))
				}
				this._domInput.focus()
			},
			() => Icons.MatchCase
		)
			.setSelected(() => false)
			.disableBubbling()

		let closeButton = new Button("close_alt", () => {
			this.close()
		}, () => Icons.Cancel)

		let forwardButton = new Button("next_action", () => {
			if (this._domInput.value !== '') {
				window.tutao.nativeApp.invokeNative(new Request("findInPage", [this._domInput.value, {forward: true, matchCase: this._matchCase}]))
			}
		}, () => Icons.ArrowForward)
			.disableBubbling()

		let backwardButton = new Button("previous_action", () => {
			if (this._domInput.value !== '') {
				window.tutao.nativeApp.invokeNative(new Request("findInPage", [this._domInput.value, {forward: false, matchCase: this._matchCase}]))
			}
		}, () => Icons.ArrowBackward)
			.disableBubbling()

		return {
			view: (vnode: Object) => {
				return m(".flex.flex-space-between",
					[
						m(".flex-start",
							{
								onkeydown: e => {
									let keyCode = e.which
									if (keyCode === Keys.ESC.code) {
										this.close()
									}
									// disable key bindings
									e.stopPropagation()
									return true
								},
							},
							[
								this._inputField(),
								m(backwardButton),
								m(forwardButton),
								m(this._matchCase ? matchCaseButton : ignoreCaseButton)
							]),
						m(closeButton)
					])
			}
		}
	}

	blur(e: MouseEvent) {
		if (this._skipNextBlur) {
			if (this._domInput) {
				this._domInput.focus()
			}
		} else {
			this.onblur(e)
		}
		this._skipNextBlur = false
	}
}

export const searchInPageOverlay = new SearchInPageOverlay()