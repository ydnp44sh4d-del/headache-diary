import SwiftUI
import SwiftData

struct DashboardView: View {
    @Query(sort: \Expense.date, order: .reverse) private var expenses: [Expense]
    @Query private var allRates: [MonthlyFXRate]

    @State private var showAddMenu = false
    @State private var showManualEntry = false
    @State private var showScan = false

    private var lookup: FXRateLookup { FXRateLookup(allRates) }
    private var summary: ExpenseSummary { ExpenseSummary(expenses: expenses, lookup: lookup) }
    private var recent: [Expense] { Array(expenses.prefix(5)) }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: 24) {
                        header

                        SummaryStatsView(summary: summary)

                        VStack(alignment: .leading, spacing: 12) {
                            BrandHeading(text: "Recent Expenses", size: 12, color: Theme.textSecondary)

                            if recent.isEmpty {
                                EmptyStateView()
                            } else {
                                VStack(spacing: 1) {
                                    ForEach(recent) { expense in
                                        ExpenseRowView(expense: expense, lookup: lookup)
                                    }
                                }
                                .panelStyle()
                            }
                        }
                    }
                    .padding(20)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    HStack(spacing: 8) {
                        TwinTriangleMark().frame(width: 22, height: 22)
                        BrandHeading(text: "Mallock Expenses", size: 15)
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showAddMenu = true
                    } label: {
                        Image(systemName: "plus")
                            .foregroundStyle(Theme.gold)
                    }
                }
            }
            .confirmationDialog("Add Expense", isPresented: $showAddMenu, titleVisibility: .visible) {
                Button("Scan Receipt") { showScan = true }
                Button("Manual Entry") { showManualEntry = true }
                Button("Cancel", role: .cancel) {}
            }
            .sheet(isPresented: $showManualEntry) {
                ExpenseFormView(mode: .manual)
            }
            .fullScreenCover(isPresented: $showScan) {
                ReceiptScanView()
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 2) {
            BrandHeading(text: "Dashboard", size: 22)
            Text(Date(), style: .date)
                .font(.body(13))
                .foregroundStyle(Theme.textSecondary)
        }
    }
}

private struct EmptyStateView: View {
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: "tray")
                .font(.system(size: 28))
                .foregroundStyle(Theme.textSecondary)
            Text("No expenses logged yet.")
                .font(.body(13))
                .foregroundStyle(Theme.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .panelStyle()
    }
}
