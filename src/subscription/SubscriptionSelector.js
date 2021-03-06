//@flow
import m from "mithril"
import stream from "mithril/stream/stream.js"
import {lang} from "../misc/LanguageViewModel"
import {BuyOptionBox} from "./BuyOptionBox"
import type {SegmentControlItem} from "../gui/base/SegmentControl"
import {SegmentControl} from "../gui/base/SegmentControl"
import type {AccountTypeEnum} from "../api/common/TutanotaConstants"
import {AccountType, BookingItemFeatureType} from "../api/common/TutanotaConstants"
import {worker} from "../api/main/WorkerClient"
import {formatPrice} from "../misc/Formatter"
import {LazyLoaded} from "../api/common/utils/LazyLoaded"
import {getPriceFromPriceData} from "./PriceUtils"
import {isApp} from "../api/Env"

type UpgradePrices = {
	nextYearPremiumPrice: number,
	premiumPrice: number,
	nextYearProPrice: number,
	proPrice: number,
	premiumReferencePrice: number,
	proReferencePrice: number,
}

type UpgradeBox = {
	buyOptionBox: BuyOptionBox;
	paymentInterval: Stream<SegmentControlItem<number>>
}

export class SubscriptionSelector {
	_premiumUpgradeBox: UpgradeBox;
	_proUpgradeBox: UpgradeBox;
	_freeTypeBox: UpgradeBox;
	_monthlyPrice: LazyLoaded<UpgradePrices>;
	_yearlyPrice: LazyLoaded<UpgradePrices>;
	_business: Stream<boolean>;
	_campaign: ?string;
	view: Function;

	constructor(current: AccountTypeEnum, currentPaymentInterval: string, freeAction: clickHandler, premiumAction: clickHandler, proAction: clickHandler, business: Stream<boolean>, includeFree: boolean, campaign: ?string) {
		this._business = business
		this._campaign = campaign

		this._freeTypeBox = {
			buyOptionBox: new BuyOptionBox(() => "Free", "select_action",
				freeAction,
				() => this._getOptions([
					"comparisonUsers", "comparisonStorage", "comparisonDomain", "comparisonSearch"
				], "Free"), 230, 240),
			paymentInterval: stream({name: "yearly", value: 12})
		}
		this._freeTypeBox.buyOptionBox.setPrice(formatPrice(0, true))
		this._freeTypeBox.buyOptionBox.setHelpLabel(lang.get("upgradeLater_msg"))

		//"comparisonAlias", ""comparisonInboxRules"", "comparisonDomain", "comparisonLogin"
		this._premiumUpgradeBox = this._createUpgradeBox(AccountType.STARTER, current, Number(currentPaymentInterval), premiumAction, () => [
			this._premiumUpgradeBox.paymentInterval().value === 1 ? "comparisonUsersMonthlyPayment" : "comparisonUsers",
			"comparisonStorage", "comparisonDomain", "comparisonSearch", "comparisonAlias", "comparisonInboxRules",
			"comparisonSupport"
		])
		this._proUpgradeBox = this._createUpgradeBox(AccountType.PREMIUM, current, Number(currentPaymentInterval), proAction, () => [
			this._proUpgradeBox.paymentInterval().value === 1 ? "comparisonUsersMonthlyPayment" : "comparisonUsers",
			"comparisonStorage", "comparisonDomain", "comparisonSearch", "comparisonAlias", "comparisonInboxRules",
			"comparisonSupport", "comparisonLogin", "comparisonTheme", "comparisonContactForm"
		])

		this._yearlyPrice = new LazyLoaded(() => this._getPrices(current, 12), null)
		this._monthlyPrice = new LazyLoaded(() => this._getPrices(current, 1), null)

		// initial help label and price
		this._yearlyPrice.getAsync().then(yearlyPrice => {
			this.setOptionBoxPrices(false, yearlyPrice, this._premiumUpgradeBox.buyOptionBox)
			this.setOptionBoxPrices(true, yearlyPrice, this._proUpgradeBox.buyOptionBox)

			const helpLabel = lang.get(business() ? "basePriceExcludesTaxes_msg" : "basePriceIncludesTaxes_msg")
			this._premiumUpgradeBox.buyOptionBox.setHelpLabel(helpLabel)
			this._proUpgradeBox.buyOptionBox.setHelpLabel(helpLabel)
			m.redraw()
		})
		business.map(business => {
			const helpLabel = lang.get(business ? "basePriceExcludesTaxes_msg" : "basePriceIncludesTaxes_msg")
			this._premiumUpgradeBox.buyOptionBox.setHelpLabel(helpLabel)
			this._proUpgradeBox.buyOptionBox.setHelpLabel(helpLabel)
		})

		this.view = () => m(".flex-center.flex-wrap", [
			!business() && includeFree ? m(this._freeTypeBox.buyOptionBox) : null,
			m(this._premiumUpgradeBox.buyOptionBox),
			m(this._proUpgradeBox.buyOptionBox)
		])
	}


	_createUpgradeBox(upgrade: AccountTypeEnum, current: AccountTypeEnum, paymentInterval: number, action: clickHandler, featurePrefixes: lazy<string[]>, fixedPaymentInterval: ?number): UpgradeBox {
		const proUpgrade = upgrade === AccountType.PREMIUM
		let title = proUpgrade ? "Pro" : "Premium"
		let buyOptionBox = new BuyOptionBox(() => title, "select_action",
			action,
			() => {
				return this._getOptions(featurePrefixes(), title)
			}, 230, 240)

		if (current === upgrade) {
			buyOptionBox.selected = true
		}

		buyOptionBox.setPrice(lang.get("emptyString_msg"))
		buyOptionBox.setHelpLabel(lang.get("emptyString_msg"))

		let paymentIntervalItems = [
			{name: lang.get("yearly_label"), value: 12},
			{name: lang.get("monthly_label"), value: 1}
		]
		const startingInterval = paymentIntervalItems.find((i) => i.value === paymentInterval)
		let upgradeBox: UpgradeBox = {
			buyOptionBox: buyOptionBox,
			paymentInterval: stream(startingInterval ? startingInterval : paymentIntervalItems[0])
		}

		let subscriptionControl = new SegmentControl(paymentIntervalItems, upgradeBox.paymentInterval)
			.setSelectionChangedHandler(paymentIntervalItem => {
				buyOptionBox.selected = upgrade === current && paymentIntervalItem.value === paymentInterval
				if (paymentIntervalItem.value === 12) {
					this._yearlyPrice.getAsync()
					    .then(upgradePrice => {
						    this.setOptionBoxPrices(proUpgrade, upgradePrice, buyOptionBox)
					    })
					    .then(() => m.redraw())
				} else {
					this._monthlyPrice.getAsync()
					    .then(upgradePrice => {
						    this.setOptionBoxPrices(proUpgrade, upgradePrice, buyOptionBox)
					    })
					    .then(() => m.redraw())
				}
				upgradeBox.paymentInterval(paymentIntervalItem)
			})
		buyOptionBox.setInjection(subscriptionControl)
		return upgradeBox
	}

	setOptionBoxPrices(proUpgrade: boolean, upgradePrice: UpgradePrices, buyOptionBox: BuyOptionBox) {
		let referencePrice = proUpgrade ? upgradePrice.proReferencePrice : upgradePrice.premiumReferencePrice
		let nextYearPrice = proUpgrade ? upgradePrice.nextYearProPrice : upgradePrice.nextYearPremiumPrice
		let price = proUpgrade ? upgradePrice.proPrice : upgradePrice.premiumPrice
		buyOptionBox.setReferencePrice((referencePrice != price) ? formatPrice(referencePrice, true) : null)
		buyOptionBox.setNextYearPrice((nextYearPrice != price) ? formatPrice(nextYearPrice, true) : null)
		buyOptionBox.setPrice(formatPrice(price, true))
	}

	_getPrices(current: AccountTypeEnum, paymentInterval: number): Promise<UpgradePrices> {
		return Promise.join(
			worker.getPrice(BookingItemFeatureType.Users, ((current
				=== AccountType.FREE) ? 1 : 0), false, paymentInterval, AccountType.PREMIUM, this._business(), this._campaign),
			worker.getPrice(BookingItemFeatureType.Alias, 20, false, paymentInterval, AccountType.PREMIUM, this._business(), this._campaign),
			worker.getPrice(BookingItemFeatureType.Storage, 10, false, paymentInterval, AccountType.PREMIUM, this._business(), this._campaign),
			worker.getPrice(BookingItemFeatureType.Branding, 1, false, paymentInterval, AccountType.PREMIUM, this._business(), this._campaign),
			(userReturn, aliasReturn, storageReturn, brandingReturn) => {
				let originalUserPrice = getPriceFromPriceData(userReturn.futurePriceNextPeriod, BookingItemFeatureType.Users)
				let userPrice = originalUserPrice + getPriceFromPriceData(userReturn.futurePriceNextPeriod, BookingItemFeatureType.Discount)
				let originalProPrice = originalUserPrice
					+ getPriceFromPriceData(aliasReturn.futurePriceNextPeriod, BookingItemFeatureType.Alias)
					+ getPriceFromPriceData(storageReturn.futurePriceNextPeriod, BookingItemFeatureType.Storage)
					+ getPriceFromPriceData(brandingReturn.futurePriceNextPeriod, BookingItemFeatureType.Branding)
				// TODO: use price from server?
				let proPrice = originalProPrice + [userReturn, aliasReturn, storageReturn, brandingReturn]
					.reduce((sum, current) => getPriceFromPriceData(current.futurePriceNextPeriod, BookingItemFeatureType.Discount) + sum, 0)
				return {
					nextYearPremiumPrice: originalUserPrice,
					premiumPrice: userPrice,
					nextYearProPrice: originalProPrice,
					proPrice,
					premiumReferencePrice: paymentInterval * 1.2,
					proReferencePrice: paymentInterval * 6,
				}
			})
	}

	_getOptions(featurePrefixes: Array<string>, type: string): Array<string> {
		let featureTexts = featurePrefixes.map((f) => {
			let fullMessage = f + type + "_msg"
			//workaround for removing prices from translations
			switch (fullMessage) {
				case "comparisonUsersMonthlyPaymentPremium_msg":
					return lang.get(f + type + "_msg", {"{1}": formatPrice(1.2, true)})
				case "comparisonUsersMonthlyPaymentPro_msg":
					return lang.get(f + type + "_msg", {"{1}": formatPrice(2.4, true)})
				case "comparisonUsersPremium_msg":
					return lang.get(f + type + "_msg", {"{1}": formatPrice(12, true)})
				case "comparisonUsersPro_msg":
					return lang.get(f + type + "_msg", {"{1}": formatPrice(24, true)})
				default:
					return lang.get(f + type + "_msg")
			}
		})
		let MAX_FEATURE_COUNT = 10
		if (!isApp()) {
			let len = featureTexts.length
			featureTexts.length = MAX_FEATURE_COUNT
			featureTexts.fill("--", len, MAX_FEATURE_COUNT)
		}
		return featureTexts
	}
}