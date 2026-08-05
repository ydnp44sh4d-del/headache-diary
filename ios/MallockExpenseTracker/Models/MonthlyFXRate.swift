import Foundation
import SwiftData

/// One currency's rate-to-GBP for a given month. GBP itself is never stored
/// here since it never needs conversion.
@Model
final class MonthlyFXRate {
    var id: UUID = UUID()
    /// "YYYY-MM"
    var month: String = ""
    var currencyRaw: String = Currency.eur.rawValue
    /// Units of `currency` per 1 GBP... no: GBP value of 1 unit of `currency`.
    /// i.e. amountInCurrency * rateToGBP = amountInGBP.
    var rateToGBP: Double = 0

    var currency: Currency {
        get { Currency(rawValue: currencyRaw) ?? .eur }
        set { currencyRaw = newValue.rawValue }
    }

    init(month: String, currency: Currency, rateToGBP: Double) {
        self.id = UUID()
        self.month = month
        self.currencyRaw = currency.rawValue
        self.rateToGBP = rateToGBP
    }
}
