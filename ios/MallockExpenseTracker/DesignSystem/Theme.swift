import SwiftUI
import UIKit

/// Mallock Automotive brand palette. Flat, no gradients, no drop shadows —
/// dashboard-like and precise.
enum Theme {
    static let background = Color(hex: 0x000000)
    static let panel = Color(hex: 0x0c0c0c)
    static let panelRaised = Color(hex: 0x141414)
    static let border = Color(hex: 0x262626)
    static let gold = Color(hex: 0xC9A24B)
    static let goldDim = Color(hex: 0x7a6532)
    static let textPrimary = Color(hex: 0xEDEDED)
    static let textSecondary = Color(hex: 0x9a9a9a)
    static let warning = Color(hex: 0xC97B4B)
    static let danger = Color(hex: 0xB84B4B)

    static let cornerRadius: CGFloat = 4
    static let panelPadding: CGFloat = 16
}

extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        let r = Double((hex >> 16) & 0xFF) / 255
        let g = Double((hex >> 8) & 0xFF) / 255
        let b = Double(hex & 0xFF) / 255
        self.init(.sRGB, red: r, green: g, blue: b, opacity: opacity)
    }
}

/// Font helpers with graceful fallback to system fonts when the brand fonts
/// (Space Grotesk / Inter) haven't been added to the project yet. Drop the
/// .ttf files into the target and list them under UIAppFonts (already wired
/// up in project.yml) to activate the real typefaces.
extension Font {
    static func heading(_ size: CGFloat, weight: Font.Weight = .bold) -> Font {
        let name = weight == .semibold ? "SpaceGrotesk-SemiBold" : "SpaceGrotesk-Bold"
        if UIFont(name: name, size: size) != nil {
            return .custom(name, size: size)
        }
        return .system(size: size, weight: weight, design: .default)
    }

    static func body(_ size: CGFloat = 15, weight: Font.Weight = .regular) -> Font {
        let name = weight == .medium ? "Inter-Medium" : "Inter-Regular"
        if UIFont(name: name, size: size) != nil {
            return .custom(name, size: size)
        }
        return .system(size: size, weight: weight, design: .default)
    }
}

/// Uppercase, letter-spaced heading text matching the brand spec.
struct BrandHeading: View {
    let text: String
    var size: CGFloat = 13
    var weight: Font.Weight = .semibold
    var color: Color = Theme.textPrimary

    var body: some View {
        Text(text.uppercased())
            .font(.heading(size, weight: weight))
            .tracking(1.4)
            .foregroundStyle(color)
    }
}

struct PanelBackground: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(Theme.panelPadding)
            .background(Theme.panel)
            .overlay(
                RoundedRectangle(cornerRadius: Theme.cornerRadius)
                    .stroke(Theme.border, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius))
    }
}

extension View {
    func panelStyle() -> some View { modifier(PanelBackground()) }
}
