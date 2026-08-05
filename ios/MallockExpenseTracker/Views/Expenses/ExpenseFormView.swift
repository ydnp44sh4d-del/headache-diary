import SwiftUI
import SwiftData

/// Manual entry form. Also used to review OCR results from a receipt scan —
/// fields are prefilled but nothing is saved until the user confirms.
struct ExpenseFormView: View {
    enum Mode {
        case manual
        case newFromScan(ScannedReceipt)
    }

    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Query(sort: \MonthlyFXRate.month) private var allRates: [MonthlyFXRate]

    let mode: Mode

    @State private var date: Date
    @State private var descriptionText: String
    @State private var category: ExpenseCategory
    @State private var amountText: String
    @State private var currency: Currency
    @State private var receiptImage: UIImage?
    @State private var ocrErrorMessage: String?

    init(mode: Mode) {
        self.mode = mode
        switch mode {
        case .manual:
            _date = State(initialValue: Date())
            _descriptionText = State(initialValue: "")
            _category = State(initialValue: .other)
            _amountText = State(initialValue: "")
            _currency = State(initialValue: .gbp)
            _receiptImage = State(initialValue: nil)
            _ocrErrorMessage = State(initialValue: nil)
        case .newFromScan(let scanned):
            let result = scanned.ocrResult
            _date = State(initialValue: result?.date ?? Date())
            _descriptionText = State(initialValue: result?.descriptionGuess ?? "")
            _category = State(initialValue: .other)
            if let amount = result?.amount {
                _amountText = State(initialValue: NSDecimalNumber(decimal: amount).stringValue)
            } else {
                _amountText = State(initialValue: "")
            }
            _currency = State(initialValue: result?.currency ?? .gbp)
            _receiptImage = State(initialValue: scanned.image)
            _ocrErrorMessage = State(initialValue: scanned.ocrErrorMessage)
        }
    }

    private var parsedAmount: Decimal? {
        Decimal(string: amountText.replacingOccurrences(of: ",", with: "."))
    }

    private var isValid: Bool {
        guard let amount = parsedAmount, amount > 0 else { return false }
        return !descriptionText.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private var conversionPreview: String? {
        guard currency != .gbp, let amount = parsedAmount else { return nil }
        let month = Expense.monthKey(for: date)
        let lookup = FXRateLookup(allRates)
        guard let rate = lookup.rate(month: month, currency: currency) else {
            return "No FX rate set for \(monthLabel(month)) yet — add one on the FX Rates screen."
        }
        let value = (amount as NSDecimalNumber).doubleValue * rate
        return "≈ £\(String(format: "%.2f", value)) at \(String(format: "%.4f", rate))"
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()
                Form {
                    if let ocrErrorMessage {
                        Section {
                            Text(ocrErrorMessage)
                                .font(.body(13))
                                .foregroundStyle(Theme.warning)
                        }
                        .listRowBackground(Theme.panel)
                    } else if case .newFromScan = mode {
                        Section {
                            Text("Review the details pulled from your receipt before saving.")
                                .font(.body(13))
                                .foregroundStyle(Theme.textSecondary)
                        }
                        .listRowBackground(Theme.panel)
                    }

                    if let receiptImage {
                        Section {
                            Image(uiImage: receiptImage)
                                .resizable()
                                .scaledToFit()
                                .frame(maxHeight: 220)
                                .frame(maxWidth: .infinity)
                        }
                        .listRowBackground(Theme.panel)
                    }

                    Section {
                        DatePicker("Date", selection: $date, displayedComponents: .date)
                        TextField("Description", text: $descriptionText)
                        Picker("Category", selection: $category) {
                            ForEach(ExpenseCategory.allCases) { cat in
                                Text(cat.rawValue).tag(cat)
                            }
                        }
                    }
                    .listRowBackground(Theme.panel)

                    Section {
                        HStack {
                            TextField("Amount", text: $amountText)
                                .keyboardType(.decimalPad)
                            Picker("Currency", selection: $currency) {
                                ForEach(Currency.allCases) { c in
                                    Text(c.rawValue).tag(c)
                                }
                            }
                            .pickerStyle(.menu)
                        }
                        if let conversionPreview {
                            Text(conversionPreview)
                                .font(.body(12))
                                .foregroundStyle(Theme.textSecondary)
                        }
                    }
                    .listRowBackground(Theme.panel)
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle(navigationTitleText)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(!isValid)
                }
            }
        }
    }

    private var navigationTitleText: String {
        switch mode {
        case .manual: return "New Expense"
        case .newFromScan: return "Review Scan"
        }
    }

    private func monthLabel(_ key: String) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM"
        guard let date = formatter.date(from: key) else { return key }
        formatter.dateFormat = "MMMM yyyy"
        return formatter.string(from: date)
    }

    private func save() {
        guard let amount = parsedAmount else { return }
        let imageData = receiptImage?.jpegData(compressionQuality: 0.8)
        let expense = Expense(
            date: date,
            expenseDescription: descriptionText.trimmingCharacters(in: .whitespaces),
            category: category,
            amount: amount,
            currency: currency,
            receiptImageData: imageData
        )
        modelContext.insert(expense)

        let month = Expense.monthKey(for: date)
        FXRateService.ensureMonthExists(month, existingRates: allRates, in: modelContext)

        dismiss()
    }
}
