import SwiftUI

struct ExpenseRowView: View {
    let expense: Expense
    let lookup: FXRateLookup

    private var gbpValue: Double? { lookup.gbpValue(for: expense) }

    private var dateText: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "d MMM yyyy"
        return formatter.string(from: expense.date)
    }

    private var originalAmountText: String {
        let number = NSDecimalNumber(decimal: expense.amount)
        return "\(expense.currency.symbol)\(number.stringValue)"
    }

    private var gbpText: String {
        guard let gbpValue else { return "—" }
        return String(format: "£%.2f", gbpValue)
    }

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: expense.category.symbolName)
                .foregroundStyle(Theme.gold)
                .frame(width: 22)

            VStack(alignment: .leading, spacing: 3) {
                Text(expense.expenseDescription)
                    .font(.body(14, weight: .medium))
                    .foregroundStyle(Theme.textPrimary)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    Text(dateText)
                    Text("·")
                    Text(expense.category.rawValue)
                }
                .font(.body(12))
                .foregroundStyle(Theme.textSecondary)

                if expense.currency.requiresFXRate && gbpValue == nil {
                    MissingRateBadge()
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 3) {
                Text(originalAmountText)
                    .font(.body(13))
                    .foregroundStyle(Theme.textSecondary)
                Text(gbpText)
                    .font(.heading(15, weight: .semibold))
                    .foregroundStyle(gbpValue == nil ? Theme.warning : Theme.textPrimary)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(Theme.panel)
    }
}
