import UIKit
import Capacitor
import CoreMotion

/// The app's web view, with the plugin below registered on it.
class AppViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(MotionHistoryPlugin())
    }

    /// The launch image stays over the web view until the page's own spine, in the same spot, has painted.
    override open func viewDidLoad() {
        super.viewDidLoad()
        let cover = UIImageView(image: UIImage(named: "Splash"))
        cover.contentMode = .scaleAspectFill
        cover.frame = view.bounds
        cover.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(cover)
        liftWhenPainted(cover, triesLeft: 150)
    }

    private func liftWhenPainted(_ cover: UIView, triesLeft: Int) {
        webView?.evaluateJavaScript("document.getElementById('boot') ? 1 : 0") { [weak self] result, _ in
            if (result as? Int) == 1 || triesLeft == 0 {
                UIView.animate(withDuration: 0.15, delay: 0.1, options: [], animations: { cover.alpha = 0 }, completion: { _ in cover.removeFromSuperview() })
            } else {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.02) { self?.liftWhenPainted(cover, triesLeft: triesLeft - 1) }
            }
        }
    }
}

/// iPhone's record of how the user has been moving (Core Motion keeps about a week, app open or not),
/// so a walk can push back the next reminder to move. Nothing here leaves the phone.
@objc(MotionHistoryPlugin)
public class MotionHistoryPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MotionHistoryPlugin"
    public let jsName = "MotionHistory"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "query", returnType: CAPPluginReturnPromise)
    ]
    private let activity = CMMotionActivityManager()
    private let pedometer = CMPedometer()
    private let iso = ISO8601DateFormatter()

    private func statusName() -> String {
        switch CMMotionActivityManager.authorizationStatus() {
        case .authorized: return "authorized"
        case .notDetermined: return "notDetermined"
        default: return "denied"
        }
    }

    @objc func status(_ call: CAPPluginCall) {
        call.resolve(["available": CMMotionActivityManager.isActivityAvailable(), "permission": statusName()])
    }

    /// Activity periods since `from`, and steps in the last `stepsMinutes`. Asks permission the first time.
    @objc func query(_ call: CAPPluginCall) {
        guard CMMotionActivityManager.isActivityAvailable() else {
            call.resolve(["available": false, "permission": statusName(), "periods": [], "steps": 0])
            return
        }
        let now = Date()
        let from = call.getString("from").flatMap { iso.date(from: $0) } ?? now.addingTimeInterval(-3600)
        let stepsFrom = now.addingTimeInterval(-Double(call.getInt("stepsMinutes") ?? 10) * 60)
        activity.queryActivityStarting(from: from, to: now, to: .main) { [weak self] rows, error in
            guard let self = self else { return }
            var periods: [[String: Any]] = []
            let list = rows ?? []
            for (i, row) in list.enumerated() where row.confidence != .low {
                let type = row.running ? "running" : row.walking ? "walking" : row.cycling ? "cycling" : row.automotive ? "automotive" : nil
                guard let name = type else { continue }
                let end = i + 1 < list.count ? list[i + 1].startDate : now
                periods.append(["type": name, "start": self.iso.string(from: row.startDate), "end": self.iso.string(from: end)])
            }
            let finish: (Int) -> Void = { steps in
                call.resolve(["available": true, "permission": self.statusName(), "periods": periods, "steps": steps])
            }
            guard error == nil, CMPedometer.isStepCountingAvailable() else { return finish(0) }
            self.pedometer.queryPedometerData(from: stepsFrom, to: now) { data, _ in
                let steps = data?.numberOfSteps.intValue ?? 0
                DispatchQueue.main.async { finish(steps) }
            }
        }
    }
}
