import SwiftUI

/// The Mallock mark: two overlapping triangle outlines forming an "M"
/// silhouette. Gold stroke, no fill, per brand spec.
struct TwinTriangleMark: View {
    var strokeColor: Color = Theme.gold
    var lineWidth: CGFloat = 2

    var body: some View {
        TwinTriangleShape()
            .stroke(strokeColor, style: StrokeStyle(lineWidth: lineWidth, lineJoin: .miter))
            .aspectRatio(1, contentMode: .fit)
    }
}

private struct TwinTriangleShape: Shape {
    func path(in rect: CGRect) -> Path {
        let w = rect.width
        let h = rect.height
        let overlap: CGFloat = w * 0.18

        var path = Path()

        // Left triangle, apex up.
        let leftBaseLeft = CGPoint(x: 0, y: h)
        let leftApex = CGPoint(x: w * 0.5, y: 0)
        let leftBaseRight = CGPoint(x: w * 0.5 + overlap, y: h)
        path.move(to: leftBaseLeft)
        path.addLine(to: leftApex)
        path.addLine(to: leftBaseRight)
        path.closeSubpath()

        // Right triangle, apex up, offset so it overlaps the left one.
        let rightBaseLeft = CGPoint(x: w * 0.5 - overlap, y: h)
        let rightApex = CGPoint(x: w, y: 0)
        let rightBaseRight = CGPoint(x: w, y: h)
        path.move(to: rightBaseLeft)
        path.addLine(to: rightApex)
        path.addLine(to: rightBaseRight)
        path.closeSubpath()

        return path
    }
}

#Preview {
    TwinTriangleMark()
        .frame(width: 64, height: 64)
        .padding()
        .background(Theme.background)
}
