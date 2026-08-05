import Foundation
import SwiftData

/// Handles creation and defaulting of monthly FX rates. Mutating operations
/// take a ModelContext directly and are called from user actions (not view
/// bodies) — for reactive reads inside views, fetch rates with @Query and
/// use FXRateLookup instead.
enum FXRateService {
    /// Ensures a MonthlyFXRate row exists for every convertible currency in
    /// the given month. New rows are seeded from the closest earlier month
    /// that has a rate for that currency, falling back to the configured
    /// starting rate set.
    @discardableResult
    static func ensureMonthExists(_ month: String, existingRates: [MonthlyFXRate], in context: ModelContext) -> [MonthlyFXRate] {
        var created: [MonthlyFXRate] = []
        for currency in Currency.convertible {
            let hasRate = existingRates.contains { $0.month == month && $0.currency == currency }
            if !hasRate {
                let seed = seedRate(for: currency, before: month, existingRates: existingRates)
                let newRate = MonthlyFXRate(month: month, currency: currency, rateToGBP: seed)
                context.insert(newRate)
                created.append(newRate)
            }
        }
        return created
    }

    private static func seedRate(for currency: Currency, before month: String, existingRates: [MonthlyFXRate]) -> Double {
        let candidates = existingRates
            .filter { $0.currency == currency && $0.month < month }
            .sorted { $0.month > $1.month }
        if let mostRecent = candidates.first {
            return mostRecent.rateToGBP
        }
        return AppSettings.shared.startingRates.rate(for: currency) ?? 0
    }

    static func months(from rates: [MonthlyFXRate]) -> [String] {
        Array(Set(rates.map(\.month))).sorted(by: >)
    }

    /// "YYYY-MM" for the current calendar month, in the app's fixed
    /// gregorian/en_US_POSIX formatting.
    static var currentMonthKey: String { Expense.monthKey(for: Date()) }
}
