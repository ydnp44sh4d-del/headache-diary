import SwiftUI

struct ExpenseSummary {
    var totalGBP: Double
    var thisMonthGBP: Double
    var entryCount: Int
    var topCategory: ExpenseCategory?
    var missingRateCount: Int

    static let empty = ExpenseSummary(totalGBP: 0, thisMonthGBP: 0, entryCount: 0, topCategory: nil, missingRateCount: 0)

    init(totalGBP: Double, thisMonthGBP: Double, entryCount: Int, topCategory: ExpenseCategory?, missingRateCount: Int) {
        self.totalGBP = totalGBP
        self.thisMonthGBP = thisMonthGBP
        self.entryCount = entryCount
        self.topCategory = topCategory
        self.missingRateCount = missingRateCount
    }

    init(expenses: [Expense], lookup: FXRateLookup) {
        var total: Double = 0
        var thisMonth: Double = 0
        var missing = 0
        var byCategory: [ExpenseCategory: Double] = [:]
        let currentMonth = FXRateService.currentMonthKey

        for expense in expenses {
            guard let value = lookup.gbpValue(for: expense) else {
                missing += 1
                continue
            }
            total += value
            byCategory[expense.category, default: 0] += value
            if expense.monthKey == currentMonth {
                thisMonth += value
            }
        }

        self.totalGBP = total
        self.thisMonthGBP = thisMonth
        self.entryCount = expenses.count
        self.topCategory = byCategory.max(by: { $0.value < $1.value })?.key
        self.missingRateCount = missing
    }
}

struct SummaryStatsView: View {
    let summary: ExpenseSummary

    private var currencyFormatter: NumberFormatter {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencySymbol = "£"
        formatter.maximumFractionDigits = 2
        return formatter
    }

    private func format(_ value: Double) -> String {
        currencyFormatter.string(from: NSNumber(value: value)) ?? "£0.00"
    }

    var body: some View {
        VStack(spacing: 12) {
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                StatTile(label: "Total Spend", value: format(summary.totalGBP))
                StatTile(label: "This Month", value: format(summary.thisMonthGBP))
                StatTile(label: "Entries", value: "\(summary.entryCount)")
                StatTile(label: "Top Category", value: summary.topCategory?.rawValue ?? "—", accent: Theme.gold)
            }

            if summary.missingRateCount > 0 {
                HStack(spacing: 8) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(Theme.warning)
                    Text("\(summary.missingRateCount) entr\(summary.missingRateCount == 1 ? "y" : "ies") excluded from totals — missing FX rate.")
                        .font(.body(12))
                        .foregroundStyle(Theme.warning)
                    Spacer()
                }
                .padding(12)
                .background(Theme.panel)
                .overlay(RoundedRectangle(cornerRadius: Theme.cornerRadius).stroke(Theme.warning.opacity(0.5), lineWidth: 1))
            }
        }
    }
}
