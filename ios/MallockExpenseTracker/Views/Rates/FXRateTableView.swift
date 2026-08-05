import SwiftUI
import SwiftData

struct FXRateTableView: View {
    @Environment(\.modelContext) private var modelContext
    @Query private var allRates: [MonthlyFXRate]
    @State private var showStartingRates = false

    private var months: [String] { FXRateService.months(from: allRates) }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()

                if months.isEmpty {
                    VStack(spacing: 14) {
                        Text("No FX months yet.")
                            .font(.body(13))
                            .foregroundStyle(Theme.textSecondary)
                        Button("Add This Month") { addMonth(FXRateService.currentMonthKey) }
                            .buttonStyle(.brandOutline)
                            .frame(width: 200)
                    }
                } else {
                    List {
                        ForEach(months, id: \.self) { month in
                            Section {
                                ForEach(Currency.convertible) { currency in
                                    if let rate = allRates.first(where: { $0.month == month && $0.currency == currency }) {
                                        FXRateRowEditor(rate: rate)
                                    }
                                }
                            } header: {
                                Text(monthLabel(month))
                                    .font(.heading(13, weight: .semibold))
                                    .foregroundStyle(Theme.gold)
                            }
                            .listRowBackground(Theme.panel)
                        }
                    }
                    .listStyle(.insetGrouped)
                    .scrollContentBackground(.hidden)
                }
            }
            .navigationTitle("FX Rates")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        showStartingRates = true
                    } label: {
                        Image(systemName: "gearshape")
                            .foregroundStyle(Theme.gold)
                    }
                    .accessibilityLabel("Default starting rates")
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        addMonth(nextMonthKey())
                    } label: {
                        Image(systemName: "plus")
                            .foregroundStyle(Theme.gold)
                    }
                    .accessibilityLabel("Add month")
                }
            }
            .sheet(isPresented: $showStartingRates) {
                StartingRatesSettingsView()
            }
        }
    }

    private func addMonth(_ month: String) {
        FXRateService.ensureMonthExists(month, existingRates: allRates, in: modelContext)
    }

    private func nextMonthKey() -> String {
        let current = FXRateService.currentMonthKey
        guard !months.isEmpty, let latest = months.first else { return current }
        if latest >= current {
            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy-MM"
            guard let latestDate = formatter.date(from: latest),
                  let next = Calendar.current.date(byAdding: .month, value: 1, to: latestDate) else {
                return current
            }
            return formatter.string(from: next)
        }
        return current
    }

    private func monthLabel(_ key: String) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM"
        guard let date = formatter.date(from: key) else { return key }
        formatter.dateFormat = "MMMM yyyy"
        return formatter.string(from: date)
    }
}
