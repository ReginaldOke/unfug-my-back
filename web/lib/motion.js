// Stand-in for Core Motion (CMMotionActivityManager + CMPedometer).
// A browser can't read motion history, so samples come from the movement simulator on the home screen.
// The iPhone app replaces this module behind the same interface.
import * as R from './repos.js';

const WEEK_MS = 7 * 86_400_000; // iOS keeps about 7 days of activity history

export const motion = {
  record({ type, minutes = 0, steps = 0 }) {
    const end = new Date();
    const sample = { type, start: new Date(+end - minutes * 60_000).toISOString(), end: end.toISOString(), minutes, steps };
    const samples = [...R.settings().motionSamples, sample].filter(s => +end - new Date(s.end) < WEEK_MS);
    R.setSettings({ motionSamples: samples }, { quiet: true });
  },

  samplesSince(iso) {
    const since = iso ? new Date(iso) : new Date(0);
    return R.settings().motionSamples.filter(s => new Date(s.end) > since);
  },

  isDriving: () => !!R.settings().drivingSince,

  startDriving() {
    R.setSettings({ drivingSince: new Date().toISOString() });
  },

  stopDriving() {
    const since = R.settings().drivingSince;
    if (!since) return;
    R.setSettings({ drivingSince: null });
    motion.record({ type: 'automotive', minutes: Math.round((Date.now() - new Date(since)) / 60_000) });
  },
};
