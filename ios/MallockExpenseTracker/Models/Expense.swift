import Foundation
import SwiftData

@Model
final class Expense {
    var id: UUID = UUID()
    var date: Date = Date()
    var expenseDescription: String = ""
    var categoryRaw: String = ExpenseCategory.other.rawValue
    var amount: Decimal = 0
    var currencyRaw: String = Currency.gbp.rawValue

    /// Source receipt image, kept for the lifetime of the entry and embedded
    /// in exports. Stored out-of-line so large images don't bloat query results.
    @Attribute(.externalStorage) var receiptImageData: Data?

    var createdAt: Date = Date()

    var category: ExpenseCategory {
        get { ExpenseCategory(rawValue: categoryRaw) ?? .other }
        set { categoryRaw = newValue.rawValue }
    }

    var currency: Currency {
        get { Currency(rawValue: currencyRaw) ?? .gbp }
        set { currencyRaw = newValue.rawValue }
    }

    /// "YYYY-MM" key for the transaction's month, used to look up FX rates.
    var monthKey: String { Expense.monthKey(for: date) }

    init(
        id: UUID = UUID(),
        date: Date = Date(),
        expenseDescription: String = "",
        category: ExpenseCategory = .other,
        amount: Decimal = 0,
        currency: Currency = .gbp,
        receiptImageData: Data? = nil,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.date = date
        self.expenseDescription = expenseDescription
        self.categoryRaw = category.rawValue
        self.amount = amount
        self.currencyRaw = currency.rawValue
        self.receiptImageData = receiptImageData
        self.createdAt = createdAt
    }

    static func monthKey(for date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM"
        return formatter.string(from: date)
    }
}
