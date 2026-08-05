import Foundation

enum ExpenseCategory: String, Codable, CaseIterable, Identifiable {
    case travel = "Travel"
    case accommodation = "Accommodation"
    case meals = "Meals"
    case materials = "Materials"
    case marketing = "Marketing"
    case professionalFees = "Professional Fees"
    case other = "Other"

    var id: String { rawValue }

    var symbolName: String {
        switch self {
        case .travel: return "car.fill"
        case .accommodation: return "bed.double.fill"
        case .meals: return "fork.knife"
        case .materials: return "shippingbox.fill"
        case .marketing: return "megaphone.fill"
        case .professionalFees: return "briefcase.fill"
        case .other: return "square.grid.2x2.fill"
        }
    }
}
