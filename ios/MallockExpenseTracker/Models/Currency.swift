import Foundation

/// Currencies supported for expense entry. GBP is the reporting base currency
/// and never needs an FX rate; the other three are converted to GBP using the
/// rate recorded for their transaction month.
enum Currency: String, Codable, CaseIterable, Identifiable {
    case gbp = "GBP"
    case eur = "EUR"
    case usd = "USD"
    case chf = "CHF"

    var id: String { rawValue }

    var symbol: String {
        switch self {
        case .gbp: return "£"
        case .eur: return "€"
        case .usd: return "$"
        case .chf: return "CHF"
        }
    }

    /// Currencies that require a monthly FX rate to convert to GBP.
    static var convertible: [Currency] { [.eur, .usd, .chf] }

    var requiresFXRate: Bool { self != .gbp }
}
