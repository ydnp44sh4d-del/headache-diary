import Foundation
import SwiftData

enum PersistenceController {
    /// Shared on-device store. Single-user, no sync — data persists locally
    /// across sessions via SwiftData's default local store.
    static let modelContainer: ModelContainer = {
        let schema = Schema([Expense.self, MonthlyFXRate.self])
        let configuration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)
        do {
            return try ModelContainer(for: schema, configurations: [configuration])
        } catch {
            fatalError("Failed to create ModelContainer: \(error)")
        }
    }()
}
