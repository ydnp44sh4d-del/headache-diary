import SwiftUI

struct RootView: View {
    init() {
        configureAppearance()
    }

    var body: some View {
        TabView {
            DashboardView()
                .tabItem { Label("Dashboard", systemImage: "square.grid.2x2") }

            ExpenseListView()
                .tabItem { Label("Expenses", systemImage: "list.bullet") }

            FXRateTableView()
                .tabItem { Label("FX Rates", systemImage: "arrow.left.arrow.right") }
        }
        .tint(Theme.gold)
    }

    private func configureAppearance() {
        let navAppearance = UINavigationBarAppearance()
        navAppearance.configureWithOpaqueBackground()
        navAppearance.backgroundColor = UIColor(Theme.background)
        navAppearance.titleTextAttributes = [.foregroundColor: UIColor(Theme.textPrimary)]
        navAppearance.largeTitleTextAttributes = [.foregroundColor: UIColor(Theme.textPrimary)]
        UINavigationBar.appearance().standardAppearance = navAppearance
        UINavigationBar.appearance().scrollEdgeAppearance = navAppearance
        UINavigationBar.appearance().compactAppearance = navAppearance
        UINavigationBar.appearance().tintColor = UIColor(Theme.gold)

        let tabAppearance = UITabBarAppearance()
        tabAppearance.configureWithOpaqueBackground()
        tabAppearance.backgroundColor = UIColor(Theme.panel)
        UITabBar.appearance().standardAppearance = tabAppearance
        UITabBar.appearance().scrollEdgeAppearance = tabAppearance
        UITabBar.appearance().tintColor = UIColor(Theme.gold)
        UITabBar.appearance().unselectedItemTintColor = UIColor(Theme.textSecondary)

        UITableView.appearance().backgroundColor = UIColor(Theme.background)
    }
}
