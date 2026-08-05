import SwiftUI

struct FXRateRowEditor: View {
    @Bindable var rate: MonthlyFXRate
    @State private var text: String = ""

    var body: some View {
        HStack {
            Text(rate.currency.rawValue)
                .font(.body(14, weight: .medium))
                .foregroundStyle(Theme.textPrimary)
                .frame(width: 56, alignment: .leading)

            Text("1 \(rate.currency.rawValue) =")
                .font(.body(12))
                .foregroundStyle(Theme.textSecondary)

            TextField("0.00", text: $text)
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .font(.body(14))
                .foregroundStyle(Theme.textPrimary)
                .onAppear { text = format(rate.rateToGBP) }
                .onChange(of: text) { _, newValue in
                    if let value = Double(newValue.replacingOccurrences(of: ",", with: ".")) {
                        rate.rateToGBP = value
                    }
                }

            Text("GBP")
                .font(.body(12))
                .foregroundStyle(Theme.textSecondary)
        }
    }

    private func format(_ value: Double) -> String {
        String(format: "%.4f", value)
    }
}
