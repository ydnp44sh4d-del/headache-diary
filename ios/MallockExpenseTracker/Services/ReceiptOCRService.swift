import Foundation
import Vision
import UIKit

struct ReceiptOCRResult {
    var amount: Decimal?
    var date: Date?
    var currency: Currency?
    var descriptionGuess: String?
    var rawText: String
}

enum OCRError: LocalizedError {
    case invalidImage
    case noTextFound
    case recognitionFailed(Error)

    var errorDescription: String? {
        switch self {
        case .invalidImage:
            return "Couldn't read that image."
        case .noTextFound:
            return "No text was found on the receipt. Try a clearer, well-lit photo, or enter the details manually below."
        case .recognitionFailed(let error):
            return "Receipt scan failed: \(error.localizedDescription). You can still enter the details manually below."
        }
    }
}

/// Extracts amount, date, currency and a description guess from a receipt
/// photo using on-device Vision text recognition. Results are a starting
/// point for the manual entry form — never auto-submitted.
enum ReceiptOCRService {
    static func recognizeText(in image: UIImage) async throws -> ReceiptOCRResult {
        guard let cgImage = image.cgImage else { throw OCRError.invalidImage }

        let lines: [String] = try await withCheckedThrowingContinuation { continuation in
            let request = VNRecognizeTextRequest { request, error in
                if let error {
                    continuation.resume(throwing: OCRError.recognitionFailed(error))
                    return
                }
                let observations = (request.results as? [VNRecognizedTextObservation]) ?? []
                let recognized = observations.compactMap { $0.topCandidates(1).first?.string }
                continuation.resume(returning: recognized)
            }
            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = true

            let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
            do {
                try handler.perform([request])
            } catch {
                continuation.resume(throwing: OCRError.recognitionFailed(error))
            }
        }

        guard !lines.isEmpty else { throw OCRError.noTextFound }
        return parse(lines: lines)
    }

    static func parse(lines: [String]) -> ReceiptOCRResult {
        let rawText = lines.joined(separator: "\n")
        let currency = detectCurrency(in: rawText)
        let amount = detectAmount(in: lines)
        let date = detectDate(in: rawText)
        let description = lines.first { !$0.trimmingCharacters(in: .whitespaces).isEmpty }

        return ReceiptOCRResult(
            amount: amount,
            date: date,
            currency: currency,
            descriptionGuess: description,
            rawText: rawText
        )
    }

    private static func detectCurrency(in text: String) -> Currency? {
        if text.contains("£") { return .gbp }
        if text.contains("€") { return .eur }
        if text.range(of: "CHF", options: .caseInsensitive) != nil { return .chf }
        if text.contains("$") { return .usd }
        return nil
    }

    private static func detectAmount(in lines: [String]) -> Decimal? {
        let moneyPattern = #"(?:[£€$]|CHF)?\s?(\d{1,3}(?:[,.\s]\d{3})*[.,]\d{2})"#
        guard let regex = try? NSRegularExpression(pattern: moneyPattern, options: [.caseInsensitive]) else {
            return nil
        }

        func amounts(in line: String) -> [Decimal] {
            let range = NSRange(line.startIndex..., in: line)
            return regex.matches(in: line, range: range).compactMap { match in
                guard let numberRange = Range(match.range(at: 1), in: line) else { return nil }
                return decimal(fromReceiptNumber: String(line[numberRange]))
            }
        }

        let totalKeywords = ["total", "amount due", "balance due", "grand total", "amount"]
        for line in lines {
            let lower = line.lowercased()
            if totalKeywords.contains(where: { lower.contains($0) }), let value = amounts(in: line).max() {
                return value
            }
        }

        return lines.flatMap(amounts(in:)).max()
    }

    private static func decimal(fromReceiptNumber string: String) -> Decimal? {
        var cleaned = string.replacingOccurrences(of: " ", with: "")
        if let lastComma = cleaned.lastIndex(of: ","), let lastDot = cleaned.lastIndex(of: ".") {
            if lastComma > lastDot {
                cleaned = cleaned.replacingOccurrences(of: ".", with: "")
                cleaned = cleaned.replacingOccurrences(of: ",", with: ".")
            } else {
                cleaned = cleaned.replacingOccurrences(of: ",", with: "")
            }
        } else if cleaned.contains(",") {
            cleaned = cleaned.replacingOccurrences(of: ",", with: ".")
        }
        return Decimal(string: cleaned)
    }

    private static func detectDate(in text: String) -> Date? {
        guard let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.date.rawValue) else {
            return nil
        }
        let range = NSRange(text.startIndex..., in: text)
        let matches = detector.matches(in: text, range: range)
        let calendar = Calendar.current
        guard let earliestPlausible = calendar.date(byAdding: .year, value: -10, to: Date()) else { return nil }
        let latestPlausible = Date().addingTimeInterval(60 * 60 * 24)

        for match in matches {
            if let date = match.date, date > earliestPlausible, date <= latestPlausible {
                return date
            }
        }
        return nil
    }
}
