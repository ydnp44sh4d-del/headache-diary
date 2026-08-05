import SwiftUI
import PhotosUI

/// A receipt image plus whatever OCR could pull from it (possibly nothing).
/// Carried into the manual entry form for the user to review before saving.
struct ScannedReceipt: Identifiable, Hashable {
    let id = UUID()
    let image: UIImage
    let ocrResult: ReceiptOCRResult?
    let ocrErrorMessage: String?

    static func == (lhs: ScannedReceipt, rhs: ScannedReceipt) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

struct ReceiptScanView: View {
    @State private var showCamera = false
    @State private var photosPickerItem: PhotosPickerItem?
    @State private var isProcessing = false
    @State private var scanned: ScannedReceipt?

    private var cameraAvailable: Bool {
        UIImagePickerController.isSourceTypeAvailable(.camera)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.background.ignoresSafeArea()

                VStack(spacing: 20) {
                    TwinTriangleMark()
                        .frame(width: 56, height: 56)
                        .padding(.top, 24)

                    BrandHeading(text: "Scan a receipt", size: 18)

                    Text("Capture or choose a receipt photo. We'll pull out the amount, date and currency for you to check.")
                        .font(.body(14))
                        .foregroundStyle(Theme.textSecondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)

                    VStack(spacing: 12) {
                        Button {
                            showCamera = true
                        } label: {
                            Label("Take Photo", systemImage: "camera.fill")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.brandFilled)
                        .disabled(!cameraAvailable)

                        PhotosPicker(selection: $photosPickerItem, matching: .images) {
                            Label("Choose from Library", systemImage: "photo.on.rectangle")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.brandOutline)
                    }
                    .padding(.horizontal, 32)
                    .padding(.top, 8)

                    if !cameraAvailable {
                        Text("Camera not available on this device.")
                            .font(.body(12))
                            .foregroundStyle(Theme.textSecondary)
                    }

                    Spacer()
                }

                if isProcessing {
                    ProcessingOverlay()
                }
            }
            .navigationTitle("Scan Receipt")
            .navigationBarTitleDisplayMode(.inline)
            .fullScreenCover(isPresented: $showCamera) {
                CameraPicker(
                    onImagePicked: { image in
                        showCamera = false
                        handle(image: image)
                    },
                    onCancel: { showCamera = false }
                )
                .ignoresSafeArea()
            }
            .onChange(of: photosPickerItem) { _, newItem in
                guard let newItem else { return }
                Task {
                    if let data = try? await newItem.loadTransferable(type: Data.self),
                       let image = UIImage(data: data) {
                        handle(image: image)
                    }
                    photosPickerItem = nil
                }
            }
            .navigationDestination(item: $scanned) { scanned in
                ExpenseFormView(mode: .newFromScan(scanned))
            }
        }
    }

    private func handle(image: UIImage) {
        isProcessing = true
        Task {
            do {
                let result = try await ReceiptOCRService.recognizeText(in: image)
                isProcessing = false
                scanned = ScannedReceipt(image: image, ocrResult: result, ocrErrorMessage: nil)
            } catch {
                isProcessing = false
                scanned = ScannedReceipt(image: image, ocrResult: nil, ocrErrorMessage: error.localizedDescription)
            }
        }
    }
}

private struct ProcessingOverlay: View {
    var body: some View {
        ZStack {
            Color.black.opacity(0.6).ignoresSafeArea()
            VStack(spacing: 14) {
                ProgressView()
                    .tint(Theme.gold)
                BrandHeading(text: "Reading receipt…", size: 12, color: Theme.textSecondary)
            }
            .padding(28)
            .background(Theme.panel)
            .overlay(RoundedRectangle(cornerRadius: Theme.cornerRadius).stroke(Theme.border, lineWidth: 1))
        }
    }
}
