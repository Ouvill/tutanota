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
import {transform} from "../animation/Animations"
import {nativeApp} from "../../native/NativeWrapper.js"

assertMainOrNode()

/**
 * search bar for the Ctrl+F in-page search of the Desktop client
 * gets loaded asynchronously, shouldn't be in the web bundle
 */
export class SearchInPageOverlay {
	_closeFunction: (() => void) | null;
	_domInput: HTMLInputElement;
	_matchCase = false;

	constructor() {
		this._closeFunction = null
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
			nativeApp.invokeNative(new Request("stopFindInPage", []))
			this._closeFunction = null
		}
		m.redraw()
	}

	_getRect() {
		return {
			height: px(size.navbar_height_mobile),
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
					nativeApp.invokeNative(new Request("findInPage", [this._domInput.value, {foward: true, matchCase: this._matchCase}]))
				},
				onchange: e => {
					this._domInput.focus()
				},
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
				nativeApp.invokeNative(new Request("findInPage", [this._domInput.value, {forward: true, matchCase: this._matchCase}]))
				this._domInput.focus()
			},
			() => Icons.MatchCase
		)
			.setSelected(() => true)
			.disableBubbling()

		let ignoreCaseButton = new Button("matchCase_alt",
			() => {
				this._matchCase = true
				nativeApp.invokeNative(new Request("findInPage", [this._domInput.value, {forward: true, matchCase: this._matchCase}]))
				this._domInput.focus()
			},
			() => Icons.MatchCase
		)
			.setSelected(() => false)
			.disableBubbling()

		let forwardButton = new Button("next_action", () => {
			nativeApp.invokeNative(new Request("findInPage", [this._domInput.value, {forward: true, matchCase: this._matchCase}]))
		}, () => Icons.ArrowForward)
			.disableBubbling()

		let backwardButton = new Button("previous_action", () => {
			nativeApp.invokeNative(new Request("findInPage", [this._domInput.value, {forward: false, matchCase: this._matchCase}]))
		}, () => Icons.ArrowBackward)
			.disableBubbling()

		let closeButton = new Button("close_alt", () => {
			this.close()
		}, () => Icons.Cancel)

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
}

export const searchInPageOverlay = new SearchInPageOverlay()