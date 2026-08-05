import Foundation

/// The default rate-to-GBP applied to a currency the first time a new month
/// is created, so the FX table never starts empty. Editable from the FX
/// Rates screen; changing it only affects months created afterwards.
struct StartingRateSet: Codable, Equatable {
    var eur: Double
    var usd: Double
    var chf: Double

    static let fallback = StartingRateSet(eur: 0.85, usd: 0.79, chf: 0.90)

    func rate(for currency: Currency) -> Double? {
        switch currency {
        case .eur: return eur
        case .usd: return usd
        case .chf: return chf
        case .gbp: return nil
        }
    }
}

/// Thin UserDefaults-backed store for app-wide settings that aren't part of
/// the SwiftData model graph.
final class AppSettings {
    static let shared = AppSettings()

    private let defaults: UserDefaults
    private let startingRatesKey = "com.mallock.expensetracker.startingRates"

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    var startingRates: StartingRateSet {
        get {
            guard let data = defaults.data(forKey: startingRatesKey),
                  let decoded = try? JSONDecoder().decode(StartingRateSet.self, from: data)
            else { return .fallback }
            return decoded
        }
        set {
            guard let data = try? JSONEncoder().encode(newValue) else { return }
            defaults.set(data, forKey: startingRatesKey)
        }
    }
}
