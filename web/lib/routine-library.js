// Routines with the strongest research behind them for back pain, offered in Routines › Browse, in
// order of how much evidence backs them (the size and number of trials, reviews first). Two of them
// are where new diaries start (DEFAULT_ROUTINES). Each lists the studies behind it, checked on PubMed,
// and comes with reminders set to how often the research did it (`schedule`, as in routines).
// Every move has a figure or a calm guide (checked in test/routine-library.test.js).
//
// Doses read the same way everywhere: "3 × 10" is three sets of ten, "8 reps" is one set, times are
// "30 s" or "2 min", and "each side" follows. A hold during each rep goes in its own box (`extra`).

const pm = id => `https://pubmed.ncbi.nlm.nih.gov/${id}/`;
// Reminder days: 0 is Sunday
const daily = time => [time];
const on = (time, days) => [`${time}@${days.join(',')}`];

export const ROUTINE_LIBRARY = [
  {
    id: 'yoga-back', name: 'Yoga for back pain', kind: 'Stretch', icon: '🧘', minutes: 15, often: '3 times a week', schedule: on('07:30', [1, 3, 5]),
    tagline: 'A gentle flow of the poses used in the big back pain yoga trials.',
    goodFor: 'Long-lasting low back pain and stiffness, especially from sitting.',
    research: 'Weekly yoga eased chronic low back pain as well as physical therapy, and better than a self-care book. A Cochrane review found it helps people move and get on with their day.',
    studies: [
      { name: 'Wieland, Cochrane Review, 2022', size: '21 trials, 2,223 people', url: pm(36398843) },
      { name: 'Saper, Annals of Internal Medicine, 2017', size: '320 adults', url: pm(28631003) },
      { name: 'Sherman, Archives of Internal Medicine, 2011', size: '228 adults', url: pm(22025101) },
    ],
    items: [
      { name: 'Cat-cow', dose: '8 reps' },
      { name: "Child's pose", dose: '1 min' },
      { name: 'Sphinx', dose: '1 min' },
      { name: 'Downward dog', dose: '30 s' },
      { name: 'Bridge', dose: '8 reps' },
      { name: 'Knee to chest', dose: '30 s each side' },
      { name: 'Supine twist', dose: '30 s each side' },
    ],
  },
  {
    id: 'core-stability', name: 'Core stability', kind: 'Strength', icon: '🎯', minutes: 15, often: '3 times a week', schedule: on('18:00', [1, 3, 5]),
    tagline: 'Retrain the deep muscles that hold your spine steady.',
    goodFor: 'Back pain that keeps coming back, and backs that feel weak or unstable.',
    research: 'Motor control exercise eases pain and disability compared with doing little, and works about as well as other exercise.',
    studies: [
      { name: 'Saragiotto, Cochrane Review, 2016', size: '29 trials, 2,431 people', url: pm(26742533) },
    ],
    items: [
      { name: 'Abdominal drawing-in', dose: '10 reps', extra: '10 s hold' },
      { name: 'Dead bug', dose: '10 reps each side' },
      { name: 'Bird dog', dose: '10 reps each side' },
      { name: 'Glute bridge', dose: '3 × 12' },
      { name: 'Side plank on knees', dose: '3 × 20 s each side' },
    ],
  },
  {
    id: 'strength-training', name: 'Strength training', kind: 'Strength', icon: '🏋️', minutes: 40, often: '2 to 3 times a week', schedule: on('18:00', [2, 4, 6]),
    tagline: 'Lifting with good form builds a back that can handle real life.',
    goodFor: 'Recurring back pain in people who want to stay active, lift or get back to the gym.',
    research: 'A review of trials found strength training among the most helpful exercise for chronic low back pain. In a deadlift trial, people with recurring back pain had less pain after eight weeks, as much as with gentler control exercises.',
    studies: [
      { name: 'Searle, Clinical Rehabilitation, 2015', size: '39 trials', url: pm(25681408) },
      { name: 'Aasa, Journal of Orthopaedic and Sports Physical Therapy, 2015', size: '70 adults', url: pm(25641309) },
    ],
    items: [
      { name: 'Romanian deadlift', dose: '3 × 8' },
      { name: 'Goblet squat', dose: '3 × 10' },
      { name: 'Deadlift', dose: '3 × 5' },
      { name: 'Bent-over row', dose: '3 × 10' },
      { name: 'Farmer carry', dose: '3 × 30 m' },
      { name: 'Pallof press', dose: '3 × 10 each side' },
    ],
  },
  {
    id: 'body-scan', name: 'Mindful body scan', kind: 'Mind', icon: '🪷', minutes: 15, often: 'Daily', schedule: daily('21:00'),
    tagline: 'A slow scan from your toes to your head, the heart of mindfulness and vipassana.',
    goodFor: 'Back pain that comes with stress, tension or poor sleep, and pain that takes up a lot of your attention.',
    research: 'Mindfulness training built around the body scan eased back pain and helped people do more, about as well as cognitive behavioural therapy and better than usual care. A review of seven trials found it eases pain in the short term.',
    guide: 'Lie on your back or sit comfortably. The aim isn\'t to relax or fix anything, only to notice. When your mind wanders, and it will, gently come back to the part of the body you were on.',
    studies: [
      { name: 'Cherkin, JAMA, 2016', size: '342 adults', url: pm(27002445) },
      { name: 'Anheyer, Annals of Internal Medicine, 2017', size: '7 trials, 864 people', url: pm(28437793) },
    ],
    items: [
      { name: 'Settle in', dose: '2 min', how: 'Close your eyes and let your breath find its own pace. Feel the floor or chair holding you.' },
      { name: 'Body scan', dose: '10 min', how: 'Move your attention slowly from your toes up to the top of your head. Notice warmth, tension or ache in each part, just as it is.' },
      { name: 'Rest in awareness', dose: '3 min', how: 'Let go of the scan. Rest with the whole body and the breath together.' },
    ],
  },
  {
    id: 'walking', name: 'Walking program', kind: 'Activity', icon: '🚶', minutes: 30, often: '5 days a week', schedule: on('12:30', [1, 2, 3, 4, 5]),
    tagline: 'Regular walks that keep back pain from coming back.',
    goodFor: 'Anyone recovering from a bout of back pain who wants to keep it away.',
    research: 'A walking program with some coaching nearly doubled the time people went before their back pain came back, from 112 days to 208.',
    studies: [
      { name: 'Pocovi, The Lancet, 2024', size: '701 adults', url: pm(38908392) },
    ],
    items: [
      { name: 'March in place', dose: '1 min' },
      { name: 'Brisk walk', dose: '30 min' },
      { name: 'Standing back extension', dose: '5 reps' },
    ],
  },
  {
    id: 'calm-breathing', name: 'Calm breathing', kind: 'Mind', icon: '🌬️', minutes: 10, often: 'Daily', schedule: daily('15:00'),
    tagline: 'Slow breathing that settles your body and eases the grip of pain.',
    goodFor: 'Stressful days, flare-ups, and a back that tightens up when you\'re tense.',
    research: 'A review of thirteen trials found breathing exercises eased chronic low back pain and disability. Slow, deep breathing calms the nervous system, which can turn down how loud pain feels.',
    guide: 'Sit or lie somewhere comfortable with one hand on your belly. Breathe in through your nose. If you feel dizzy at any point, go back to breathing normally.',
    studies: [
      { name: 'Jiang, Journal of Back and Musculoskeletal Rehabilitation, 2024', size: '13 trials, 677 people', url: pm(37718775) },
    ],
    items: [
      { name: 'Belly breathing', dose: '3 min', how: 'Breathe in so your belly rises under your hand, then let it fall. Your chest stays fairly still.' },
      { name: 'Box breathing', dose: '3 min', how: 'In for 4, hold for 4, out for 4, hold for 4. Follow the circle.' },
      { name: 'Long exhale', dose: '4 min', how: 'In for 4, out for 6. A longer out-breath tells your body it\'s safe to settle.' },
    ],
  },
  {
    id: 'pilates', name: 'Pilates for back pain', kind: 'Mixed', icon: '🩰', minutes: 15, often: '2 to 3 times a week', schedule: on('07:30', [2, 4, 6]),
    tagline: 'Slow, controlled Pilates moves for strength and flexibility.',
    goodFor: 'Chronic low back pain, posture, and building control through the middle of the body.',
    research: 'Pilates eases pain and improves function compared with doing little. The trials were small, so the effect could change as more are done.',
    studies: [
      { name: 'Yamato, Cochrane Review, 2015', size: '10 trials, 510 people', url: pm(26133923) },
    ],
    items: [
      { name: 'Pelvic curl', dose: '10 reps' },
      { name: 'Hundred', dose: '5 × 10 breaths' },
      { name: 'Single leg stretch', dose: '10 reps each side' },
      { name: 'Pilates swimming', dose: '3 × 20 s' },
      { name: 'Spine stretch forward', dose: '8 reps' },
      { name: 'Side-lying leg lift', dose: '10 reps each side' },
      { name: 'Cat-cow', dose: '8 reps' },
    ],
  },
  {
    id: 'swimming', name: 'Swimming and water exercise', kind: 'Activity', icon: '🏊', minutes: 30, often: '2 times a week', schedule: on('09:00', [3, 6]),
    tagline: 'The water takes your weight, so you can move more with less strain.',
    goodFor: 'Back pain that makes walking or floor exercise hard, and anyone who enjoys the pool.',
    research: 'A review of eight trials found exercise in water eased low back pain and helped people move better.',
    studies: [
      { name: 'Shi, American Journal of Physical Medicine and Rehabilitation, 2018', size: '8 trials, 331 people', url: pm(28759476) },
    ],
    items: [
      { name: 'Water walking', dose: '5 min' },
      { name: 'Swimming', dose: '20 min' },
      { name: 'Float and stretch', dose: '5 min' },
    ],
  },
  {
    id: 'tai-chi', name: 'Tai chi', kind: 'Mixed', icon: '☯️', minutes: 20, often: '2 times a week', schedule: on('08:00', [2, 5]),
    tagline: 'Slow, flowing moves that build strength, balance and calm together.',
    goodFor: 'Long-lasting back pain, stiffness, and people who want a gentle practice that also settles the mind.',
    research: 'Ten weeks of tai chi eased pain and how much it bothered people, and helped them do more, compared with usual care. A review of trials found the same.',
    studies: [
      { name: 'Hall, Arthritis Care and Research, 2011', size: '160 adults', url: pm(22034119) },
      { name: 'Qin, Medicine, 2019', size: 'Review of trials', url: pm(31517838) },
    ],
    items: [
      { name: 'Commencing form', dose: '1 min' },
      { name: 'Wave hands like clouds', dose: '3 min' },
      { name: 'Brush knee', dose: '3 min' },
      { name: "Part the wild horse's mane", dose: '3 min' },
      { name: 'Closing form', dose: '1 min' },
    ],
  },
  {
    id: 'mcgill-big-3', name: 'McGill Big 3', kind: 'Strength', icon: '🛡️', minutes: 10, often: 'Daily', schedule: daily('08:00'),
    tagline: 'Three moves that build a steady, tireless core without loading your spine.',
    goodFor: 'Everyday back pain, and backs that tire or twinge when you lift, bend or stand for long.',
    research: 'Developed by spine researcher Stuart McGill from lab work on which exercises build core endurance with the least strain on the spine. Reviews of this kind of stabilising exercise find it eases pain and disability.',
    studies: [
      { name: 'Saragiotto, Cochrane Review, 2016', size: '29 trials, 2,431 people', url: pm(26742533) },
      { name: 'McGill, Physical Therapy, 1998', size: 'Review of lab evidence', url: pm(9672547) },
    ],
    items: [
      { name: 'Curl-up', dose: '3 × 4', extra: '10 s hold' },
      { name: 'Side plank', dose: '3 × 4 each side', extra: '10 s hold' },
      { name: 'Bird dog', dose: '3 × 4 each side', extra: '10 s hold' },
    ],
  },
  {
    id: 'hips-hamstrings', name: 'Hip and hamstring stretch', kind: 'Stretch', icon: '🤸', minutes: 12, often: 'Daily', schedule: daily('20:00'),
    tagline: 'Loosen the tight hips and hamstrings that pull on your lower back.',
    goodFor: 'Stiffness after sitting, tight hips, and a lower back that aches by the end of the day.',
    research: 'A 12-week stretching class worked as well as yoga for chronic low back pain, and both beat a self-care book.',
    studies: [
      { name: 'Sherman, Archives of Internal Medicine, 2011', size: '228 adults', url: pm(22025101) },
    ],
    items: [
      { name: 'Hip flexor stretch', dose: '30 s each side' },
      { name: 'Hamstring stretch', dose: '30 s each side' },
      { name: 'Figure-4 stretch', dose: '30 s each side' },
      { name: 'Pigeon', dose: '30 s each side' },
      { name: 'Open book', dose: '8 reps each side' },
      { name: "Child's pose", dose: '1 min' },
    ],
  },
  {
    id: 'mckenzie', name: 'McKenzie extensions', kind: 'Stretch', icon: '🌉', minutes: 8, often: 'A few times a day on bad days', schedule: [...daily('10:00'), ...daily('14:00'), ...daily('18:00')],
    tagline: 'Gentle backward bends for pain that eases when you arch your back.',
    goodFor: 'Pain that gets worse with sitting or bending forward and better when you stand up straight or lie on your front.',
    research: 'Part of the McKenzie method, one of the most used approaches in physiotherapy. A review of trials found it eases pain and disability in the first week compared with passive treatment. It suits people whose pain settles when they bend backwards.',
    studies: [
      { name: 'Machado, Spine, 2006', size: '11 trials', url: pm(16641766) },
    ],
    items: [
      { name: 'Prone lying', dose: '2 min' },
      { name: 'Prone on elbows', dose: '2 min' },
      { name: 'Prone press-up', dose: '10 reps' },
      { name: 'Standing back extension', dose: '10 reps' },
    ],
  },
  {
    id: 'glutes-hips', name: 'Glute and hip strength', kind: 'Strength', icon: '🦵', minutes: 15, often: '3 times a week', schedule: on('18:30', [1, 3, 5]),
    tagline: 'Strong hips take the load off your lower back.',
    goodFor: 'Back pain with weak glutes, long hours sitting, and pain that flares when you walk or stand.',
    research: 'Weak hips are common in people with back pain. In a trial of core work with or without hip strengthening, both groups had clearly less pain after six weeks. Hip work didn\'t add extra relief on top, so it works best alongside core exercise.',
    studies: [
      { name: 'Searle, Clinical Rehabilitation, 2015', size: '39 trials', url: pm(25681408) },
      { name: 'Kendall, Journal of Science and Medicine in Sport, 2015', size: '80 adults', url: pm(25467200) },
    ],
    items: [
      { name: 'Glute bridge', dose: '3 × 12' },
      { name: 'Single-leg bridge', dose: '3 × 8 each side' },
      { name: 'Clamshell', dose: '3 × 15 each side' },
      { name: 'Side-lying hip abduction', dose: '3 × 12 each side' },
      { name: 'Donkey kick', dose: '3 × 12 each side' },
      { name: 'Fire hydrant', dose: '3 × 10 each side' },
    ],
  },
];

/** Where new diaries start: the best strength routine and the best stretching routine. */
export const DEFAULT_ROUTINES = ['mcgill-big-3', 'yoga-back'];

export const libraryRoutine = id => ROUTINE_LIBRARY.find(r => r.id === id);

/** A new routine made from a library one: its moves, emoji and reminders. Breathing and meditation count
 * how many times you did them rather than how hard they were. */
export const fromLibrary = r => ({
  name: r.name, icon: r.icon, items: structuredClone(r.items), schedule: [...r.schedule], libraryId: r.id, ...(r.kind === 'Mind' ? { measure: 'count' } : {}),
});

// Doses as they read before, for routines added from the library then: brought up to date once (repos.js)
export const OLD_DOSES = {
  'Curl-up|6-4-2 × 10 s holds': { dose: '3 × 4', extra: '10 s hold' },
  'Side plank|6-4-2 × 10 s each side': { dose: '3 × 4 each side', extra: '10 s hold' },
  'Bird dog|6-4-2 × 10 s each side': { dose: '3 × 4 each side', extra: '10 s hold' },
  'Cat-cow|× 8': { dose: '8 reps' },
  'Bridge|× 8': { dose: '8 reps' },
  'Prone press-up|× 10': { dose: '10 reps' },
  'Standing back extension|× 10': { dose: '10 reps' },
  'Standing back extension|× 5': { dose: '5 reps' },
  'Abdominal drawing-in|10 × 10 s': { dose: '10 reps', extra: '10 s hold' },
  'Dead bug|× 10 each side': { dose: '10 reps each side' },
  'Bird dog|× 10 each side': { dose: '10 reps each side' },
  'Pelvic curl|× 10': { dose: '10 reps' },
  'Single leg stretch|× 10 each side': { dose: '10 reps each side' },
  'Spine stretch forward|× 8': { dose: '8 reps' },
  'Side-lying leg lift|× 10 each side': { dose: '10 reps each side' },
  'Open book|× 8 each side': { dose: '8 reps each side' },
  'Pelvic tilt|× 10': { dose: '10 reps' },
  'Single knee to chest|× 10 each side': { dose: '10 reps each side' },
  'Double knee to chest|× 10': { dose: '10 reps' },
  'Partial curl-up|× 10': { dose: '10 reps' },
};
