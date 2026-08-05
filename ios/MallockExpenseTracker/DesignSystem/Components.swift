import SwiftUI

/// Flat gold-outlined primary button — no gradients, no shadows.
struct BrandButtonStyle: ButtonStyle {
    var filled: Bool = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.heading(13, weight: .semibold))
            .tracking(1.2)
            .textCase(.uppercase)
            .foregroundStyle(filled ? Theme.background : Theme.gold)
            .padding(.horizontal, 18)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity)
            .background(filled ? Theme.gold : Color.clear)
            .overlay(
                RoundedRectangle(cornerRadius: Theme.cornerRadius)
                    .stroke(Theme.gold, lineWidth: filled ? 0 : 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerRadius))
            .opacity(configuration.isPressed ? 0.7 : 1)
    }
}

extension ButtonStyle where Self == BrandButtonStyle {
    static var brandFilled: BrandButtonStyle { BrandButtonStyle(filled: true) }
    static var brandOutline: BrandButtonStyle { BrandButtonStyle(filled: false) }
}

/// A single stat tile for the dashboard summary row.
struct StatTile: View {
    let label: String
    let value: String
    var accent: Color = Theme.textPrimary

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            BrandHeading(text: label, size: 11, color: Theme.textSecondary)
            Text(value)
                .font(.heading(20, weight: .bold))
                .foregroundStyle(accent)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .panelStyle()
    }
}

/// Small pill used to flag a missing FX rate on an expense row.
struct MissingRateBadge: View {
    var body: some View {
        Label("Rate missing", systemImage: "exclamationmark.triangle.fill")
            .font(.body(11, weight: .medium))
            .foregroundStyle(Theme.warning)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .overlay(
                RoundedRectangle(cornerRadius: Theme.cornerRadius)
                    .stroke(Theme.warning.opacity(0.6), lineWidth: 1)
            )
    }
}

