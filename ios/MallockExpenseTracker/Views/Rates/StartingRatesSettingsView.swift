import SwiftUI

/// Editable default rate-to-GBP applied whenever a brand new month is
/// created and no earlier month has a rate to carry forward.
struct StartingRatesSettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var eurText: String
    @State private var usdText: String
    @State private var chfText: String

    init() {
        let starting = AppSettings.shared.startingRates
        _eurText = State(initialValue: String(format: "%.4f", starting.eur))
        _usdText = State(initialValue: String(format: "%.4f", starting.usd))
        _chfText = State(initialValue: String(format: "%.4f", starting.chf))
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()
                Form {
                    Section {
                        Text("Applied automatically the first time a new month with no earlier rate history is created. Existing months are never overwritten.")
                            .font(.body(12))
                            .foregroundStyle(Theme.textSecondary)
                    }
                    .listRowBackground(Theme.panel)

                    Section("Default Rate to GBP") {
                        rateField("EUR", text: $eurText)
                        rateField("USD", text: $usdText)
                        rateField("CHF", text: $chfText)
                    }
                    .listRowBackground(Theme.panel)
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle("Starting Rates")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                }
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    private func rateField(_ label: String, text: Binding<String>) -> some View {
        HStack {
            Text(label).foregroundStyle(Theme.textPrimary)
            Spacer()
            TextField("0.00", text: text)
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .foregroundStyle(Theme.textPrimary)
        }
    }

    private func save() {
        let eur = Double(eurText.replacingOccurrences(of: ",", with: ".")) ?? StartingRateSet.fallback.eur
        let usd = Double(usdText.replacingOccurrences(of: ",", with: ".")) ?? StartingRateSet.fallback.usd
        let chf = Double(chfText.replacingOccurrences(of: ",", with: ".")) ?? StartingRateSet.fallback.chf
        AppSettings.shared.startingRates = StartingRateSet(eur: eur, usd: usd, chf: chf)
        dismiss()
    }
}
