import Foundation
import UIKit
import ZIPFoundation

enum ExcelExportError: LocalizedError {
    case archiveCreationFailed
    case entryWriteFailed(String)

    var errorDescription: String? {
        switch self {
        case .archiveCreationFailed:
            return "Couldn't create the export file."
        case .entryWriteFailed(let name):
            return "Couldn't write \(name) into the export file."
        }
    }
}

/// Builds a self-contained .xlsx workbook — one row per expense, with the
/// receipt image embedded inline so the export is a complete, audit-ready
/// record without needing the app.
enum ExcelExportService {
    static func export(expenses: [Expense], lookup: FXRateLookup) throws -> URL {
        let fileName = "Mallock-Expenses-\(fileDateStamp()).xlsx"
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
        if FileManager.default.fileExists(atPath: url.path) {
            try? FileManager.default.removeItem(at: url)
        }

        guard let archive = Archive(url: url, accessMode: .create) else {
            throw ExcelExportError.archiveCreationFailed
        }

        let parts = XLSXBuilder(expenses: expenses, lookup: lookup).buildParts()
        for part in parts {
            do {
                try archive.addEntry(
                    with: part.path,
                    type: .file,
                    uncompressedSize: Int64(part.data.count),
                    compressionMethod: .deflate
                ) { position, size in
                    let start = Int(position)
                    let end = min(start + size, part.data.count)
                    return part.data.subdata(in: start..<end)
                }
            } catch {
                throw ExcelExportError.entryWriteFailed(part.path)
            }
        }

        return url
    }

    private static func fileDateStamp() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }
}

/// One file entry inside the .xlsx zip container.
private struct XLSXPart {
    let path: String
    let data: Data
}

/// Assembles the OOXML SpreadsheetML parts by hand: workbook, single
/// worksheet, shared strings, styles, and a drawing anchoring one image per
/// expense row.
private struct XLSXBuilder {
    let expenses: [Expense]
    let lookup: FXRateLookup

    private let headers = ["Date", "Description", "Category", "Amount", "Currency", "GBP Equivalent", "Receipt"]
    private let emuPerPoint: CGFloat = 12700
    private let imageMaxWidthPt: CGFloat = 150
    private let imageMaxHeightPt: CGFloat = 190
    private let rowPaddingPt: CGFloat = 14

    func buildParts() -> [XLSXPart] {
        var strings = SharedStringTable()
        let dateFormatter: DateFormatter = {
            let f = DateFormatter()
            f.dateFormat = "yyyy-MM-dd"
            return f
        }()

        struct Row {
            let cells: [String]
            let hasImage: Bool
            let imageHeightPt: CGFloat
        }

        var rows: [Row] = []
        var mediaEntries: [(fileName: String, data: Data)] = []

        for expense in expenses {
            let gbp = lookup.gbpValue(for: expense)
            let amount = NSDecimalNumber(decimal: expense.amount).doubleValue
            let cells = [
                dateFormatter.string(from: expense.date),
                expense.expenseDescription,
                expense.category.rawValue,
                String(format: "%.2f", amount),
                expense.currency.rawValue,
                gbp.map { String(format: "%.2f", $0) } ?? "MISSING RATE"
            ]

            var imageHeightPt = rowPaddingPt
            if let imageData = expense.receiptImageData, let image = UIImage(data: imageData) {
                let size = scaledSize(for: image)
                imageHeightPt = size.height + rowPaddingPt
                mediaEntries.append((fileName: "image\(mediaEntries.count + 1).jpeg", data: imageData))
                rows.append(Row(cells: cells, hasImage: true, imageHeightPt: imageHeightPt))
            } else {
                rows.append(Row(cells: cells, hasImage: false, imageHeightPt: imageHeightPt))
            }
        }

        for header in headers { _ = strings.index(for: header) }
        for row in rows { for cell in row.cells { _ = strings.index(for: cell) } }

        var sheetXML = XMLBuilder()
        sheetXML.append(#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>"#)
        sheetXML.append(#"<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">"#)
        sheetXML.append(#"<cols><col min="1" max="1" width="12" customWidth="1"/><col min="2" max="2" width="30" customWidth="1"/><col min="3" max="3" width="16" customWidth="1"/><col min="4" max="4" width="10" customWidth="1"/><col min="5" max="5" width="9" customWidth="1"/><col min="6" max="6" width="14" customWidth="1"/><col min="7" max="7" width="24" customWidth="1"/></cols>"#)
        sheetXML.append("<sheetData>")

        sheetXML.append(#"<row r="1" ht="20" customHeight="1">"#)
        for (index, header) in headers.enumerated() {
            let ref = cellRef(column: index, row: 0)
            sheetXML.append(#"<c r="\#(ref)" t="s" s="1"><v>\#(strings.index(for: header))</v></c>"#)
        }
        sheetXML.append("</row>")

        for (rowIndex, row) in rows.enumerated() {
            let excelRow = rowIndex + 2
            let heightAttr = row.hasImage ? #" ht="\#(String(format: "%.0f", row.imageHeightPt))" customHeight="1""# : ""
            sheetXML.append(#"<row r="\#(excelRow)"\#(heightAttr)>"#)
            for (colIndex, cell) in row.cells.enumerated() {
                let ref = cellRef(column: colIndex, row: rowIndex + 1)
                if colIndex == 3 || colIndex == 5, let number = Double(cell) {
                    sheetXML.append(#"<c r="\#(ref)"><v>\#(number)</v></c>"#)
                } else {
                    sheetXML.append(#"<c r="\#(ref)" t="s"><v>\#(strings.index(for: cell))</v></c>"#)
                }
            }
            sheetXML.append("</row>")
        }

        sheetXML.append("</sheetData>")
        if !mediaEntries.isEmpty {
            sheetXML.append(#"<drawing r:id="rId1"/>"#)
        }
        sheetXML.append("</worksheet>")

        var parts: [XLSXPart] = [
            XLSXPart(path: "[Content_Types].xml", data: contentTypesXML(hasDrawing: !mediaEntries.isEmpty)),
            XLSXPart(path: "_rels/.rels", data: rootRelsXML()),
            XLSXPart(path: "docProps/core.xml", data: coreXML()),
            XLSXPart(path: "docProps/app.xml", data: appXML()),
            XLSXPart(path: "xl/workbook.xml", data: workbookXML()),
            XLSXPart(path: "xl/_rels/workbook.xml.rels", data: workbookRelsXML()),
            XLSXPart(path: "xl/styles.xml", data: stylesXML()),
            XLSXPart(path: "xl/sharedStrings.xml", data: strings.xml()),
            XLSXPart(path: "xl/worksheets/sheet1.xml", data: Data(sheetXML.output.utf8)),
        ]

        if !mediaEntries.isEmpty {
            parts.append(XLSXPart(path: "xl/worksheets/_rels/sheet1.xml.rels", data: sheetRelsXML()))
            parts.append(XLSXPart(path: "xl/drawings/drawing1.xml", data: drawingXML()))
            parts.append(XLSXPart(path: "xl/drawings/_rels/drawing1.xml.rels", data: drawingRelsXML(mediaEntries: mediaEntries)))
            for entry in mediaEntries {
                parts.append(XLSXPart(path: "xl/media/\(entry.fileName)", data: entry.data))
            }
        }

        return parts
    }

    private func scaledSize(for image: UIImage) -> CGSize {
        let w = image.size.width
        let h = image.size.height
        guard w > 0, h > 0 else { return CGSize(width: imageMaxWidthPt, height: imageMaxHeightPt) }
        let scale = min(imageMaxWidthPt / w, imageMaxHeightPt / h)
        return CGSize(width: w * scale, height: h * scale)
    }

    private func cellRef(column: Int, row: Int) -> String {
        "\(columnLetter(column))\(row + 1)"
    }

    private func columnLetter(_ index: Int) -> String {
        var n = index
        var letters = ""
        repeat {
            letters = String(UnicodeScalar(65 + (n % 26))!) + letters
            n = n / 26 - 1
        } while n >= 0
        return letters
    }

    // MARK: - Static XML parts

    private func contentTypesXML(hasDrawing: Bool) -> Data {
        var xml = #"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>"#
        xml += #"<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">"#
        xml += #"<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>"#
        xml += #"<Default Extension="xml" ContentType="application/xml"/>"#
        xml += #"<Default Extension="jpeg" ContentType="image/jpeg"/>"#
        xml += #"<Default Extension="png" ContentType="image/png"/>"#
        xml += #"<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>"#
        xml += #"<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>"#
        xml += #"<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>"#
        xml += #"<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>"#
        if hasDrawing {
            xml += #"<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>"#
        }
        xml += #"<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>"#
        xml += #"<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>"#
        xml += "</Types>"
        return Data(xml.utf8)
    }

    private func rootRelsXML() -> Data {
        var xml = #"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>"#
        xml += #"<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">"#
        xml += #"<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>"#
        xml += #"<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>"#
        xml += #"<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>"#
        xml += "</Relationships>"
        return Data(xml.utf8)
    }

    private func coreXML() -> Data {
        let iso = ISO8601DateFormatter().string(from: Date())
        var xml = #"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>"#
        xml += #"<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">"#
        xml += "<dc:title>Mallock Automotive Expenses</dc:title>"
        xml += "<dc:creator>Mallock Expense Tracker</dc:creator>"
        xml += #"<dcterms:created xsi:type="dcterms:W3CDTF">\#(iso)</dcterms:created>"#
        xml += "</cp:coreProperties>"
        return Data(xml.utf8)
    }

    private func appXML() -> Data {
        var xml = #"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>"#
        xml += #"<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">"#
        xml += "<Application>Mallock Expense Tracker</Application>"
        xml += "</Properties>"
        return Data(xml.utf8)
    }

    private func workbookXML() -> Data {
        var xml = #"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>"#
        xml += #"<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">"#
        xml += #"<sheets><sheet name="Expenses" sheetId="1" r:id="rId1"/></sheets>"#
        xml += "</workbook>"
        return Data(xml.utf8)
    }

    private func workbookRelsXML() -> Data {
        var xml = #"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>"#
        xml += #"<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">"#
        xml += #"<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>"#
        xml += #"<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>"#
        xml += #"<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>"#
        xml += "</Relationships>"
        return Data(xml.utf8)
    }

    private func stylesXML() -> Data {
        var xml = #"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>"#
        xml += #"<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">"#
        xml += #"<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/><color rgb="FFC9A24B"/></font></fonts>"#
        xml += #"<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>"#
        xml += #"<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>"#
        xml += #"<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>"#
        xml += #"<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>"#
        xml += "</styleSheet>"
        return Data(xml.utf8)
    }

    private func sheetRelsXML() -> Data {
        var xml = #"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>"#
        xml += #"<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">"#
        xml += #"<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>"#
        xml += "</Relationships>"
        return Data(xml.utf8)
    }

    private func drawingXML() -> Data {
        var xml = #"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>"#
        xml += #"<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">"#

        var shapeId = 2
        var relId = 1
        for expense in expenses {
            guard let imageData = expense.receiptImageData, let image = UIImage(data: imageData) else { continue }
            let rowIndex = rowIndexForImage(expense: expense)
            guard let rowIndex else { continue }
            let size = scaledSize(for: image)
            let cx = Int(size.width * emuPerPoint)
            let cy = Int(size.height * emuPerPoint)

            xml += #"<xdr:oneCellAnchor>"#
            xml += #"<xdr:from><xdr:col>6</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>\#(rowIndex)</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>"#
            xml += #"<xdr:ext cx="\#(cx)" cy="\#(cy)"/>"#
            xml += #"<xdr:pic>"#
            xml += #"<xdr:nvPicPr><xdr:cNvPr id="\#(shapeId)" name="Receipt \#(shapeId)"/><xdr:cNvPicPr/></xdr:nvPicPr>"#
            xml += #"<xdr:blipFill><a:blip r:embed="rId\#(relId)"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>"#
            xml += #"<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="\#(cx)" cy="\#(cy)"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>"#
            xml += #"</xdr:pic>"#
            xml += #"<xdr:clientData/>"#
            xml += #"</xdr:oneCellAnchor>"#

            shapeId += 1
            relId += 1
        }

        xml += "</xdr:wsDr>"
        return Data(xml.utf8)
    }

    /// 0-indexed worksheet row (drawing anchors are 0-indexed, header is row 0).
    private func rowIndexForImage(expense: Expense) -> Int? {
        guard let position = expenses.firstIndex(where: { $0.id == expense.id }) else { return nil }
        return position + 1
    }

    private func drawingRelsXML(mediaEntries: [(fileName: String, data: Data)]) -> Data {
        var xml = #"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>"#
        xml += #"<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">"#
        for (index, entry) in mediaEntries.enumerated() {
            xml += #"<Relationship Id="rId\#(index + 1)" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/\#(entry.fileName)"/>"#
        }
        xml += "</Relationships>"
        return Data(xml.utf8)
    }
}

/// Accumulates a plain string efficiently; used instead of repeated String
/// concatenation for the (potentially large) worksheet body.
private struct XMLBuilder {
    private(set) var output = ""
    mutating func append(_ s: String) { output += s }
}

/// Deduplicated string pool backing the workbook's sharedStrings.xml part.
private struct SharedStringTable {
    private var strings: [String] = []
    private var indices: [String: Int] = [:]

    mutating func index(for value: String) -> Int {
        if let existing = indices[value] { return existing }
        let newIndex = strings.count
        strings.append(value)
        indices[value] = newIndex
        return newIndex
    }

    func xml() -> Data {
        var xml = #"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>"#
        xml += #"<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="\#(strings.count)" uniqueCount="\#(strings.count)">"#
        for string in strings {
            xml += "<si><t xml:space=\"preserve\">\(xmlEscape(string))</t></si>"
        }
        xml += "</sst>"
        return Data(xml.utf8)
    }

    private func xmlEscape(_ s: String) -> String {
        s.replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
            .replacingOccurrences(of: "'", with: "&apos;")
    }
}
