import SwiftUI

/// Generates the audit-ready .xlsx (with embedded receipt images) and hands
/// it to the system share sheet — AirDrop, Files, Mail, whatever the user
/// picks. One tap, no server round-trip.
struct ExportShareButton: View {
    let expenses: [Expense]
    let lookup: FXRateLookup

    @State private var isExporting = false
    @State private var exportedFile: ExportedFile?
    @State private var exportError: String?

    var body: some View {
        Button {
            export()
        } label: {
            if isExporting {
                ProgressView().tint(Theme.gold)
            } else {
                Image(systemName: "square.and.arrow.up")
                    .foregroundStyle(Theme.gold)
            }
        }
        .disabled(isExporting || expenses.isEmpty)
        .accessibilityLabel("Export to Excel")
        .sheet(item: $exportedFile) { file in
            ActivityView(activityItems: [file.url])
        }
        .alert(
            "Export Failed",
            isPresented: Binding(get: { exportError != nil }, set: { if !$0 { exportError = nil } })
        ) {
            Button("OK") { exportError = nil }
        } message: {
            Text(exportError ?? "")
        }
    }

    private func export() {
        isExporting = true
        Task {
            do {
                let url = try ExcelExportService.export(expenses: expenses, lookup: lookup)
                isExporting = false
                exportedFile = ExportedFile(url: url)
            } catch {
                isExporting = false
                exportError = error.localizedDescription
            }
        }
    }
}

private struct ExportedFile: Identifiable {
    let url: URL
    var id: String { url.absoluteString }
}

private struct ActivityView: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
