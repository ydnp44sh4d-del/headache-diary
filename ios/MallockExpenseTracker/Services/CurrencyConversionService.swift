import Foundation

/// Fast lookup of GBP-converted expense amounts, built once from an
/// already-fetched rate array (e.g. an @Query result) rather than hitting
/// the store per-expense.
struct FXRateLookup {
    private let ratesByKey: [String: Double]

    init(_ rates: [MonthlyFXRate]) {
        var dict = [String: Double]()
        for rate in rates {
            dict[Self.key(month: rate.month, currency: rate.currency)] = rate.rateToGBP
        }
        self.ratesByKey = dict
    }

    static func key(month: String, currency: Currency) -> String {
        "\(month)_\(currency.rawValue)"
    }

    func rate(month: String, currency: Currency) -> Double? {
        ratesByKey[Self.key(month: month, currency: currency)]
    }

    /// GBP value of an expense, or nil if it's in a foreign currency with no
    /// rate recorded for its month — callers should flag this rather than
    /// silently treating it as zero.
    func gbpValue(for expense: Expense) -> Double? {
        let amount = (expense.amount as NSDecimalNumber).doubleValue
        if expense.currency == .gbp { return amount }
        guard let rate = rate(month: expense.monthKey, currency: expense.currency) else { return nil }
        return amount * rate
    }

    func hasMissingRate(for expense: Expense) -> Bool {
        expense.currency.requiresFXRate && gbpValue(for: expense) == nil
    }
}
