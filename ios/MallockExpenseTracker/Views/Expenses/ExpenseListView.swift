import SwiftUI
import SwiftData

struct ExpenseListView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Expense.date, order: .reverse) private var expensesDescending: [Expense]
    @Query private var allRates: [MonthlyFXRate]

    @State private var sortAscending = false
    @State private var showManualEntry = false
    @State private var showScan = false
    @State private var showAddMenu = false

    private var lookup: FXRateLookup { FXRateLookup(allRates) }

    private var sortedExpenses: [Expense] {
        sortAscending ? expensesDescending.reversed() : expensesDescending
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()

                if sortedExpenses.isEmpty {
                    VStack(spacing: 8) {
                        Image(systemName: "tray")
                            .font(.system(size: 28))
                            .foregroundStyle(Theme.textSecondary)
                        Text("No expenses logged yet.")
                            .font(.body(13))
                            .foregroundStyle(Theme.textSecondary)
                    }
                } else {
                    List {
                        ForEach(sortedExpenses) { expense in
                            ExpenseRowView(expense: expense, lookup: lookup)
                                .listRowInsets(EdgeInsets())
                                .listRowSeparatorTint(Theme.border)
                                .listRowBackground(Theme.panel)
                        }
                        .onDelete(perform: delete)
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                }
            }
            .navigationTitle("Expenses")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        sortAscending.toggle()
                    } label: {
                        Image(systemName: sortAscending ? "arrow.up" : "arrow.down")
                            .foregroundStyle(Theme.gold)
                    }
                    .accessibilityLabel("Sort by date")
                }
                ToolbarItem(placement: .topBarTrailing) {
                    ExportShareButton(expenses: sortedExpenses, lookup: lookup)
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

    private func delete(at offsets: IndexSet) {
        for index in offsets {
            modelContext.delete(sortedExpenses[index])
        }
    }
}
