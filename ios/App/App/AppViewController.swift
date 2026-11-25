import UIKit
import Capacitor
import CoreMotion
import UserNotifications
import BackgroundTasks
import Speech
import AVFoundation

/// The app's web view, with the plugins below registered on it.
class AppViewController: CAPBridgeViewController {
    private var loader: SpineLoader?

    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(MotionHistoryPlugin())
        bridge?.registerPluginInstance(AppLaunchPlugin())
        bridge?.registerPluginInstance(SpeechPlugin())
    }

    override open func viewDidLoad() {
        super.viewDidLoad()
        // Drawn natively so it moves from the first frame, while the web code is still loading
        let dark = AppLaunchPlugin.launchesDark()
        overrideUserInterfaceStyle = dark ? .dark : .light
        let loader = SpineLoader(frame: view.bounds, dark: dark)
        loader.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(loader)
        self.loader = loader
        loader.start()
        liftWhenReady(triesLeft: 200) // gives up waiting after about 4 seconds, so the loader can never stay up
        // Holding a link shouldn't lift iOS's drag preview out of the app
        webView?.scrollView.subviews.forEach { $0.interactions.compactMap { $0 as? UIDragInteraction }.forEach { $0.isEnabled = false } }
        // Anything showing past the page (a bounce, a resize) is the page's own background, light or dark
        let pageBackground = UIColor { $0.userInterfaceStyle == .dark ? UIColor(red: 13 / 255, green: 13 / 255, blue: 15 / 255, alpha: 1) : UIColor(red: 239 / 255, green: 238 / 255, blue: 236 / 255, alpha: 1) }
        view.backgroundColor = pageBackground
        webView?.underPageBackgroundColor = pageBackground
        // iOS 26's fade under the status bar takes its colour from the launch background; the page draws its own
        if #available(iOS 26.0, *) {
            webView?.scrollView.topEdgeEffect.isHidden = true
        }
    }

    // In a resizable iPad window the window controls sit in the top corner. The page doesn't see them as safe
    // area, so it's told how far down to start (--win-top) whenever the window changes.
    private var lastTop: CGFloat = -1
    // After an iPad window is resized UIKit can leave the app's view short of the window's top edge, so the
    // black window behind shows through as a strip: the view always fills the whole window
    override func viewWillLayoutSubviews() {
        super.viewWillLayoutSubviews()
        if let window = view.window, view.superview === window, view.frame != window.bounds { view.frame = window.bounds }
        view.window?.backgroundColor = view.backgroundColor
        if let web = webView, web.superview === view, web.frame != view.bounds { web.frame = view.bounds }
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        // A resized iPad window can hand the web view a top inset, which shows as a dark strip above the
        // page: the page handles its own safe areas, so the scroll view never takes one
        if let scroll = webView?.scrollView {
            if scroll.contentInsetAdjustmentBehavior != .never { scroll.contentInsetAdjustmentBehavior = .never }
            if scroll.contentInset != .zero { scroll.contentInset = .zero }
        }
        if #available(iOS 26.0, *), let web = webView, web.obscuredContentInsets != .zero { web.obscuredContentInsets = .zero }
        shareWindowTop()
    }

    private func shareWindowTop(force: Bool = false) {
        var top = view.safeAreaInsets.top
        if #available(iOS 26.0, *) {
            top = max(top, view.edgeInsets(for: .safeArea(cornerAdaptation: .vertical)).top)
        }
        guard force || top != lastTop else { return }
        lastTop = top
        webView?.evaluateJavaScript("document.documentElement.style.setProperty('--win-top', '\(Int(top.rounded()))px')", completionHandler: nil)
    }

    private func liftWhenReady(triesLeft: Int) {
        webView?.evaluateJavaScript("window.__appReady === true ? 1 : 0") { [weak self] result, _ in
            guard let self else { return }
            if (result as? Int) == 1 || triesLeft == 0 {
                self.shareWindowTop(force: true)
                self.loader?.finish(onReveal: {
                    self.overrideUserInterfaceStyle = .unspecified
                    self.webView?.evaluateJavaScript("window.__reveal && window.__reveal()", completionHandler: nil)
                })
                self.loader = nil
            } else {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.02) { self.liftWhenReady(triesLeft: triesLeft - 1) }
            }
        }
    }
}

/// The logo's spine on the app's background: it grows from its centre out to both ends and back, then
/// settles at full length and fades into the app.
final class SpineLoader: UIView {
    private let group = CALayer()
    private let glow = CAShapeLayer()
    private let line = CAShapeLayer()
    private let gradient = CAGradientLayer()
    private var startedAt = CACurrentMediaTime()
    private static let side: CGFloat = 182 // the logo's 1024 square, drawn at this many points
    private static let beat: CFTimeInterval = 0.5
    private static let curve = CAMediaTimingFunction(controlPoints: 0.65, 0, 0.35, 1)

    init(frame: CGRect, dark: Bool) {
        super.init(frame: frame)
        backgroundColor = dark ? UIColor(red: 13 / 255, green: 13 / 255, blue: 15 / 255, alpha: 1) : UIColor(red: 239 / 255, green: 238 / 255, blue: 236 / 255, alpha: 1)
        let k = Self.side / 1024
        let p = { (x: CGFloat, y: CGFloat) in CGPoint(x: x * k, y: y * k) }
        let path = UIBezierPath()
        path.move(to: p(512, 222))
        path.addCurve(to: p(520, 522), controlPoint1: p(606, 300), controlPoint2: p(592, 424))
        path.addCurve(to: p(512, 806), controlPoint1: p(448, 620), controlPoint2: p(418, 720))
        let size = CGSize(width: Self.side, height: Self.side)
        group.bounds = CGRect(origin: .zero, size: size)
        for shape in [glow, line] {
            shape.frame = group.bounds
            shape.path = path.cgPath
            shape.fillColor = nil
            shape.lineWidth = 42 * k
            shape.lineCap = .round
            shape.strokeColor = UIColor.black.cgColor
        }
        let coral = UIColor(red: 240 / 255, green: 112 / 255, blue: 94 / 255, alpha: 1)
        glow.strokeColor = (dark ? UIColor(red: 249 / 255, green: 221 / 255, blue: 216 / 255, alpha: 1) : coral).cgColor
        glow.shadowColor = glow.strokeColor
        glow.shadowOpacity = dark ? 0.75 : 0.45
        glow.shadowRadius = 11
        glow.shadowOffset = .zero
        gradient.frame = group.bounds
        gradient.startPoint = CGPoint(x: 0.5, y: 220 / 1024)
        gradient.endPoint = CGPoint(x: 0.5, y: 806 / 1024)
        gradient.colors = (dark
            ? [UIColor.white, UIColor(red: 249 / 255, green: 221 / 255, blue: 216 / 255, alpha: 1), coral]
            : [UIColor(red: 29 / 255, green: 28 / 255, blue: 31 / 255, alpha: 1), UIColor(red: 150 / 255, green: 80 / 255, blue: 72 / 255, alpha: 1), coral]).map(\.cgColor)
        gradient.locations = [0, 0.45, 1]
        gradient.mask = line
        group.addSublayer(glow)
        group.addSublayer(gradient)
        layer.addSublayer(group)
    }

    required init?(coder: NSCoder) { fatalError("Not used from a storyboard") }

    override func layoutSubviews() {
        super.layoutSubviews()
        // The logo's curve sits a little low in its square: centre the curve itself
        group.position = CGPoint(x: bounds.midX, y: bounds.midY - (514 - 512) * Self.side / 1024)
    }

    /// Both ends move the same distance from the middle, at the same pace.
    func start() {
        startedAt = CACurrentMediaTime()
        if UIAccessibility.isReduceMotionEnabled { return }
        for shape in [glow, line] {
            for (key, from, to) in [("strokeStart", 0.44, 0.0), ("strokeEnd", 0.56, 1.0)] {
                let pulse = CABasicAnimation(keyPath: key)
                pulse.fromValue = from
                pulse.toValue = to
                pulse.duration = Self.beat
                pulse.timingFunction = Self.curve
                pulse.autoreverses = true
                pulse.repeatCount = .infinity
                shape.add(pulse, forKey: key)
            }
        }
    }

    /// Runs out to full length from wherever it is, then fades as the app rises in beneath.
    func finish(onReveal: @escaping () -> Void) {
        let wait = max(0, Self.beat - (CACurrentMediaTime() - startedAt))
        DispatchQueue.main.asyncAfter(deadline: .now() + wait) { [self] in
            CATransaction.begin()
            CATransaction.setAnimationDuration(0.22)
            CATransaction.setAnimationTimingFunction(CAMediaTimingFunction(name: .easeOut))
            CATransaction.setCompletionBlock { [self] in
                onReveal()
                UIView.animate(withDuration: 0.34, delay: 0, options: [.curveEaseInOut], animations: {
                    self.alpha = 0
                }, completion: { _ in self.removeFromSuperview() })
                let grow = CABasicAnimation(keyPath: "transform.scale")
                grow.fromValue = 1
                grow.toValue = 1.08
                grow.duration = 0.34
                grow.timingFunction = CAMediaTimingFunction(name: .easeOut)
                grow.fillMode = .forwards
                grow.isRemovedOnCompletion = false
                group.add(grow, forKey: "grow")
            }
            for shape in [glow, line] {
                let start = shape.presentation()?.strokeStart ?? 0, end = shape.presentation()?.strokeEnd ?? 1
                shape.removeAllAnimations()
                CATransaction.begin()
                CATransaction.setDisableActions(true)
                shape.strokeStart = start
                shape.strokeEnd = end
                CATransaction.commit()
                let a = CABasicAnimation(keyPath: "strokeStart"), b = CABasicAnimation(keyPath: "strokeEnd")
                a.fromValue = start
                a.toValue = 0
                b.fromValue = end
                b.toValue = 1
                shape.add(a, forKey: "strokeStart")
                shape.add(b, forKey: "strokeEnd")
                shape.strokeStart = 0
                shape.strokeEnd = 1
            }
            CATransaction.commit()
        }
    }
}

/// Remembers the Appearance setting where the loader can read it, before any web code has run.
@objc(AppLaunchPlugin)
public class AppLaunchPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppLaunchPlugin"
    public let jsName = "AppLaunch"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setTheme", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "keepAwake", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openVideo", returnType: CAPPluginReturnPromise),
    ]

    /// A YouTube search: straight into the YouTube app when it's installed (no stop in Safari first),
    /// otherwise the web page. Resolves once iOS has handed it over.
    @objc func openVideo(_ call: CAPPluginCall) {
        guard let web = call.getString("url"), let url = URL(string: web) else { call.reject("No link"); return }
        var app = URLComponents(url: url, resolvingAgainstBaseURL: false)
        app?.scheme = "youtube"
        DispatchQueue.main.async {
            if let direct = app?.url {
                UIApplication.shared.open(direct, options: [:]) { opened in
                    if opened { call.resolve(["app": true]); return }
                    UIApplication.shared.open(url, options: [:]) { _ in call.resolve(["app": false]) }
                }
            } else {
                UIApplication.shared.open(url, options: [:]) { _ in call.resolve(["app": false]) }
            }
        }
    }
    private static let key = "themeSetting"

    /// The same rule as theme.js: the setting if there is one, otherwise light from 6am and dark from 5pm.
    static func launchesDark() -> Bool {
        switch UserDefaults.standard.string(forKey: key) {
        case "light": return false
        case "dark": return true
        default:
            let hour = Calendar.current.component(.hour, from: Date())
            return !(hour >= 6 && hour < 17)
        }
    }

    @objc func setTheme(_ call: CAPPluginCall) {
        UserDefaults.standard.set(call.getString("setting") ?? "auto", forKey: Self.key)
        call.resolve()
    }

    /// Keeps the screen on while a routine is playing, so the phone doesn't lock between moves.
    @objc func keepAwake(_ call: CAPPluginCall) {
        let on = call.getBool("on") ?? false
        DispatchQueue.main.async { UIApplication.shared.isIdleTimerDisabled = on }
        call.resolve()
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
        CAPPluginMethod(name: "query", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setNudge", returnType: CAPPluginReturnPromise)
    ]

    /// The web code's nudge rules and when the next nudge is due, kept so a background check can move it.
    @objc func setNudge(_ call: CAPPluginCall) {
        NudgeKeeper.save(call.options as? [String: Any] ?? [:])
        call.resolve()
    }
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


/// Moves the "Time to move" nudge back while the app is closed. iOS wakes the app in the background now
/// and then (BGAppRefreshTask); this reads the motion record and steps since the nudge was set, and if
/// you've really moved, sets it again from then, within your nudge hours. Same rules as reminders-core.js.
enum NudgeKeeper {
    static let taskId = "com.reginaldoke.unfugmyback.nudge"
    private static let key = "nudgeRules"
    private static let moveId = "1" // MOVE_ID in native.js
    private static let activity = CMMotionActivityManager()
    private static let pedometer = CMPedometer()

    static func save(_ rules: [String: Any]) {
        if let data = try? JSONSerialization.data(withJSONObject: rules) { UserDefaults.standard.set(data, forKey: key) }
    }

    private static func load() -> [String: Any]? {
        guard let data = UserDefaults.standard.data(forKey: key) else { return nil }
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    }

    static func register() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: taskId, using: nil) { task in
            schedule()
            check { task.setTaskCompleted(success: true) }
            task.expirationHandler = { task.setTaskCompleted(success: false) }
        }
    }

    /// Asks iOS for the next background check; it decides when, often within the hour.
    static func schedule() {
        let request = BGAppRefreshTaskRequest(identifier: taskId)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 10 * 60)
        try? BGTaskScheduler.shared.submit(request)
    }

    static func check(done: @escaping () -> Void) {
        guard let rules = load(), let atText = rules["moveAt"] as? String,
              let due = ISO8601DateFormatter.withFraction.date(from: atText) ?? ISO8601DateFormatter().date(from: atText),
              let interval = rules["intervalMin"] as? Double, CMMotionActivityManager.authorizationStatus() == .authorized
        else { return done() }
        let now = Date()
        guard due > now else { return done() }
        let since = due.addingTimeInterval(-interval * 60)
        lastMoved(since: since, now: now, rules: rules) { movedAt in
            guard let movedAt, let next = nextActive(movedAt.addingTimeInterval(interval * 60), rules: rules), next > due else { return done() }
            let center = UNUserNotificationCenter.current()
            center.getPendingNotificationRequests { requests in
                guard let old = requests.first(where: { $0.identifier == moveId }) else { return done() }
                let when = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: next)
                let request = UNNotificationRequest(identifier: moveId, content: old.content, trigger: UNCalendarNotificationTrigger(dateMatching: when, repeats: false))
                center.add(request) { _ in
                    var updated = rules
                    updated["moveAt"] = ISO8601DateFormatter.withFraction.string(from: next)
                    save(updated)
                    done()
                }
            }
        }
    }

    /// When real movement last ended since `since`: a walk, run or ride long enough, or enough steps lately.
    private static func lastMoved(since: Date, now: Date, rules: [String: Any], done: @escaping (Date?) -> Void) {
        let minWalk = (rules["minWalkMin"] as? Double ?? 2) * 60, minSteps = rules["minSteps"] as? Int ?? 150
        activity.queryActivityStarting(from: since, to: now, to: .main) { rows, _ in
            let list = rows ?? []
            var last: Date?
            for (i, row) in list.enumerated() where row.confidence != .low && (row.walking || row.running || row.cycling) {
                let end = i + 1 < list.count ? list[i + 1].startDate : now
                if end.timeIntervalSince(row.startDate) >= minWalk { last = max(last ?? end, end) }
            }
            guard CMPedometer.isStepCountingAvailable() else { return done(last) }
            pedometer.queryPedometerData(from: max(since, now.addingTimeInterval(-10 * 60)), to: now) { data, _ in
                let steps = data?.numberOfSteps.intValue ?? 0
                DispatchQueue.main.async { done(steps >= minSteps ? now : last) }
            }
        }
    }

    /// The earliest time at or after `date` inside the nudge hours (indexed by weekday, Sunday first).
    private static func nextActive(_ date: Date, rules: [String: Any]) -> Date? {
        guard let hours = rules["activeHours"] as? [[String: Any]], hours.count == 7 else { return date }
        let cal = Calendar.current
        let minutes = { (hm: String) -> Int in let p = hm.split(separator: ":").compactMap { Int($0) }; return p.count == 2 ? p[0] * 60 + p[1] : 0 }
        for i in 0..<8 {
            guard let day = cal.date(byAdding: .day, value: i, to: cal.startOfDay(for: date)) else { continue }
            let h = hours[cal.component(.weekday, from: day) - 1]
            guard h["on"] as? Bool == true, let s = h["start"] as? String, let e = h["end"] as? String else { continue }
            let start = day.addingTimeInterval(Double(minutes(s)) * 60), end = day.addingTimeInterval(Double(minutes(e)) * 60)
            if i == 0 {
                if date < start { return start }
                if date < end { return date }
                continue
            }
            return start
        }
        return nil
    }
}

extension ISO8601DateFormatter {
    static let withFraction: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()
}


/// Speech to text with Apple's recogniser, for saying reps and moves out loud (the web view has no speech
/// recognition of its own). Sends "result" with the words so far as they arrive, and "end" when it stops.
public class SpeechPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SpeechPlugin"
    public let jsName = "Speech"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
    ]
    private let engine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?

    @objc func start(_ call: CAPPluginCall) {
        let lang = call.getString("lang")
        SFSpeechRecognizer.requestAuthorization { status in
            guard status == .authorized else { call.reject("not-allowed"); return }
            AVAudioSession.sharedInstance().requestRecordPermission { ok in
                DispatchQueue.main.async {
                    guard ok else { call.reject("not-allowed"); return }
                    do { try self.begin(lang: lang); call.resolve() } catch { self.finish(); call.reject(error.localizedDescription) }
                }
            }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            // Stop listening; the recogniser then gives its last words and "end" follows
            if self.engine.isRunning { self.engine.stop(); self.engine.inputNode.removeTap(onBus: 0) }
            self.request?.endAudio()
            call.resolve()
        }
    }

    private func begin(lang: String?) throws {
        finish()
        let recogniser = lang.flatMap { SFSpeechRecognizer(locale: Locale(identifier: $0)) } ?? SFSpeechRecognizer()
        guard let recogniser, recogniser.isAvailable else { throw NSError(domain: "Speech", code: 1, userInfo: [NSLocalizedDescriptionKey: "unavailable"]) }
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .measurement, options: [.duckOthers, .defaultToSpeaker, .allowBluetooth])
        try session.setActive(true, options: .notifyOthersOnDeactivation)
        let req = SFSpeechAudioBufferRecognitionRequest()
        req.shouldReportPartialResults = true
        let input = engine.inputNode
        input.removeTap(onBus: 0)
        input.installTap(onBus: 0, bufferSize: 1024, format: input.outputFormat(forBus: 0)) { buffer, _ in req.append(buffer) }
        engine.prepare()
        try engine.start()
        request = req
        task = recogniser.recognitionTask(with: req) { [weak self] result, error in
            guard let self else { return }
            if let result {
                self.notifyListeners("result", data: ["text": result.bestTranscription.formattedString, "final": result.isFinal])
            }
            if error != nil || result?.isFinal == true {
                DispatchQueue.main.async { self.finish(); self.notifyListeners("end", data: [:]) }
            }
        }
    }

    private func finish() {
        if engine.isRunning { engine.stop(); engine.inputNode.removeTap(onBus: 0) }
        request?.endAudio()
        task?.cancel()
        task = nil
        request = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}
