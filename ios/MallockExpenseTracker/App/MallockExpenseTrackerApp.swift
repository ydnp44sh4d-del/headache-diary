import SwiftUI
import SwiftData

@main
struct MallockExpenseTrackerApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
                .preferredColorScheme(.dark)
        }
        .modelContainer(PersistenceController.modelContainer)
    }
}
