import SwiftUI
import WidgetKit

// Add via Xcode: File > New > Target > Widget Extension ("DailyFactWidget").
// Replace the generated source with this file.

// `appOrigin` is defined in AppConfig.swift, generated from APP_URL in .env
// by `npm run config:sync`. Add both files to the widget target.
private let endpoint = URL(string: "\(appOrigin)/api/public/today-title")!

struct TodayTitle: Decodable {
    let title: String?
}

struct FactEntry: TimelineEntry {
    let date: Date
    let title: String
}

struct FactProvider: TimelineProvider {
    func placeholder(in context: Context) -> FactEntry {
        FactEntry(date: Date(), title: "Today's fact")
    }

    func getSnapshot(in context: Context, completion: @escaping (FactEntry) -> Void) {
        completion(FactEntry(date: Date(), title: "Today's fact"))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<FactEntry>) -> Void) {
        Task {
            let title = await fetchTitle() ?? "Today's fact is on its way…"
            let entry = FactEntry(date: Date(), title: title)
            // Schedule next update for tomorrow at 00:01 UTC
            let next = nextUtcMidnightPlusMins()
            completion(Timeline(entries: [entry], policy: .after(next)))
        }
    }

    private func nextUtcMidnightPlusMins() -> Date {
        let calendar = Calendar(identifier: .gregorian)
        var components = DateComponents()
        components.timeZone = TimeZone(abbreviation: "UTC")
        
        let now = Date()
        let utcNow = calendar.dateComponents([.year, .month, .day, .hour, .minute, .second], from: now)
        
        // Calculate tomorrow at 00:01 UTC
        var nextComponents = DateComponents()
        nextComponents.timeZone = TimeZone(abbreviation: "UTC")
        nextComponents.year = utcNow.year
        nextComponents.month = utcNow.month
        nextComponents.day = (utcNow.day ?? 0) + 1
        nextComponents.hour = 0
        nextComponents.minute = 1
        nextComponents.second = 0
        
        return calendar.date(from: nextComponents) ?? Date().addingTimeInterval(86400)

    private func fetchTitle() async -> String? {
        do {
            let (data, _) = try await URLSession.shared.data(from: endpoint)
            return try JSONDecoder().decode(TodayTitle.self, from: data).title
        } catch {
            return nil
        }
    }
}

struct DailyFactWidgetView: View {
    var entry: FactEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("TODAY'S FACT")
                .font(.system(size: 10, weight: .semibold))
                .kerning(1.2)
                .foregroundStyle(.secondary)
            Text(entry.title)
                .font(.system(size: 16, weight: .bold))
                .lineLimit(4)
                .minimumScaleFactor(0.8)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .containerBackground(.background, for: .widget)
        .widgetURL(URL(string: appOrigin))
    }
}

@main
struct DailyFactWidget: Widget {
    let kind = "DailyFactWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: FactProvider()) { entry in
            DailyFactWidgetView(entry: entry)
        }
        .configurationDisplayName("The Daily How")
        .description("Shows today's fact title.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
