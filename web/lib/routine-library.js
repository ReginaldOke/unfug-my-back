// Routines with the strongest research behind them for back pain, offered in Routines › Browse. Two of them
// are where new diaries start (DEFAULT_ROUTINES). Every move has a figure (checked in test/routine-library.test.js).

export const ROUTINE_LIBRARY = [
  {
    id: 'mcgill-big-3', name: 'McGill Big 3', kind: 'Strength', minutes: 10, often: 'Daily', cover: 'Bird dog',
    tagline: 'Three moves that build a steady, tireless core without loading your spine.',
    goodFor: 'Everyday back pain, and backs that tire or twinge when you lift, bend or stand for long.',
    research: 'Developed by spine researcher Stuart McGill from decades of lab work on which exercises build core endurance with the least strain on the spine. Trials of this kind of stabilising exercise show it eases pain and helps people get back to normal activity.',
    items: [
      { name: 'Curl-up', dose: '6-4-2 × 10 s holds' },
      { name: 'Side plank', dose: '6-4-2 × 10 s each side' },
      { name: 'Bird dog', dose: '6-4-2 × 10 s each side' },
    ],
  },
  {
    id: 'yoga-back', name: 'Yoga for back pain', kind: 'Stretch', minutes: 15, often: '3 times a week', cover: 'Cat-cow',
    tagline: 'A gentle flow of the poses used in the big back pain yoga trials.',
    goodFor: 'Long-lasting low back pain and stiffness, especially from sitting.',
    research: 'Large trials found weekly yoga eased chronic low back pain as well as physical therapy (Saper, 2017, 320 adults) and better than a self-care book (Sherman, 2011). A Cochrane review of 21 trials found it improves how well people can move and get on with their day.',
    items: [
      { name: 'Cat-cow', dose: '× 8' },
      { name: "Child's pose", dose: '1 min' },
      { name: 'Sphinx', dose: '1 min' },
      { name: 'Downward dog', dose: '30 s' },
      { name: 'Bridge', dose: '× 8' },
      { name: 'Knee to chest', dose: '30 s each side' },
      { name: 'Supine twist', dose: '30 s each side' },
    ],
  },
  {
    id: 'mckenzie', name: 'McKenzie extensions', kind: 'Stretch', minutes: 8, often: 'Every 2 to 3 hours on bad days', cover: 'Prone press-up',
    tagline: 'Gentle backward bends for pain that eases when you arch your back.',
    goodFor: 'Pain that gets worse with sitting or bending forward and better when you stand up straight or lie on your front.',
    research: 'Part of the McKenzie method, one of the most used approaches in physiotherapy. Reviews of trials find it eases pain in the short term, most of all for people whose pain settles when they bend backwards.',
    items: [
      { name: 'Prone lying', dose: '2 min' },
      { name: 'Prone on elbows', dose: '2 min' },
      { name: 'Prone press-up', dose: '× 10' },
      { name: 'Standing back extension', dose: '× 10' },
    ],
  },
  {
    id: 'williams', name: 'Williams flexion', kind: 'Stretch', minutes: 12, often: 'Daily', cover: 'Double knee to chest',
    tagline: 'Forward-bending stretches that open up the lower back.',
    goodFor: 'Pain that eases when you bend forward or sit, which is common with age-related narrowing of the spine.',
    research: 'A classic program used by physiotherapists since the 1930s. The research behind it is older and smaller than for newer routines, so it suits people whose pain clearly eases when they bend forward.',
    items: [
      { name: 'Pelvic tilt', dose: '× 10' },
      { name: 'Single knee to chest', dose: '× 10 each side' },
      { name: 'Double knee to chest', dose: '× 10' },
      { name: 'Partial curl-up', dose: '× 10' },
      { name: 'Hamstring stretch', dose: '30 s each side' },
      { name: 'Hip flexor stretch', dose: '30 s each side' },
      { name: 'Wall sit', dose: '5 × 10 s' },
    ],
  },
  {
    id: 'core-stability', name: 'Core stability', kind: 'Strength', minutes: 15, often: '3 times a week', cover: 'Dead bug',
    tagline: 'Retrain the deep muscles that hold your spine steady.',
    goodFor: 'Back pain that keeps coming back, and backs that feel weak or unstable.',
    research: 'A Cochrane review of 29 trials and over 2,400 people found this kind of motor control exercise eases pain and disability compared with doing little, and works about as well as other exercise.',
    items: [
      { name: 'Abdominal drawing-in', dose: '10 × 10 s' },
      { name: 'Dead bug', dose: '× 10 each side' },
      { name: 'Bird dog', dose: '× 10 each side' },
      { name: 'Glute bridge', dose: '3 × 12' },
      { name: 'Side plank on knees', dose: '3 × 20 s each side' },
    ],
  },
  {
    id: 'pilates', name: 'Pilates for back pain', kind: 'Mixed', minutes: 15, often: '2 to 3 times a week', cover: 'Single leg stretch',
    tagline: 'Slow, controlled Pilates moves for strength and flexibility.',
    goodFor: 'Chronic low back pain, posture, and building control through the middle of the body.',
    research: 'A Cochrane review of 10 trials found Pilates eases pain and improves function compared with doing little.',
    items: [
      { name: 'Pelvic curl', dose: '× 10' },
      { name: 'Hundred', dose: '5 × 10 breaths' },
      { name: 'Single leg stretch', dose: '× 10 each side' },
      { name: 'Pilates swimming', dose: '3 × 20 s' },
      { name: 'Spine stretch forward', dose: '× 8' },
      { name: 'Side-lying leg lift', dose: '× 10 each side' },
      { name: 'Cat-cow', dose: '× 8' },
    ],
  },
  {
    id: 'glutes-hips', name: 'Glute and hip strength', kind: 'Strength', minutes: 15, often: '3 times a week', cover: 'Glute bridge',
    tagline: 'Strong hips take the load off your lower back.',
    goodFor: 'Back pain with weak glutes, long hours sitting, and pain that flares when you walk or stand.',
    research: 'In a trial of people with low back pain, adding hip strengthening to core exercise eased pain more than core exercise alone (Kendall, 2015). Weak hip muscles are common in people with back pain.',
    items: [
      { name: 'Glute bridge', dose: '3 × 12' },
      { name: 'Single-leg bridge', dose: '3 × 8 each side' },
      { name: 'Clamshell', dose: '3 × 15 each side' },
      { name: 'Side-lying hip abduction', dose: '3 × 12 each side' },
      { name: 'Donkey kick', dose: '3 × 12 each side' },
      { name: 'Fire hydrant', dose: '3 × 10 each side' },
    ],
  },
  {
    id: 'strength-training', name: 'Strength training', kind: 'Strength', minutes: 40, often: '2 to 3 times a week', cover: 'Romanian deadlift',
    tagline: 'Lifting with good form builds a back that can handle real life.',
    goodFor: 'Recurring back pain in people who want to stay active, lift or get back to the gym.',
    research: 'A review of 39 trials found strength training among the most helpful exercise for chronic low back pain (Searle, 2015). Trials of deadlift training found it eased pain and disability as well as gentler exercise, and more for some people.',
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
    id: 'walking', name: 'Walking program', kind: 'Activity', minutes: 30, often: '5 days a week', cover: 'Brisk walk',
    tagline: 'Regular walks that keep back pain from coming back.',
    goodFor: 'Anyone recovering from a bout of back pain who wants to keep it away.',
    research: 'In the WalkBack trial of 701 adults (The Lancet, 2024), a walking program with some coaching nearly doubled the time people went before their back pain came back.',
    items: [
      { name: 'March in place', dose: '1 min' },
      { name: 'Brisk walk', dose: '30 min' },
      { name: 'Standing back extension', dose: '× 5' },
    ],
  },
  {
    id: 'hips-hamstrings', name: 'Hip and hamstring stretch', kind: 'Stretch', minutes: 12, often: 'Daily', cover: 'Hip flexor stretch',
    tagline: 'Loosen the tight hips and hamstrings that pull on your lower back.',
    goodFor: 'Stiffness after sitting, tight hips, and a lower back that aches by the end of the day.',
    research: 'In a trial of 228 adults with chronic low back pain, a 12-week stretching class worked as well as yoga, and both beat a self-care book (Sherman, 2011).',
    items: [
      { name: 'Hip flexor stretch', dose: '30 s each side' },
      { name: 'Hamstring stretch', dose: '30 s each side' },
      { name: 'Figure-4 stretch', dose: '30 s each side' },
      { name: 'Pigeon', dose: '30 s each side' },
      { name: 'Open book', dose: '× 8 each side' },
      { name: "Child's pose", dose: '1 min' },
    ],
  },
];

/** Where new diaries start: the best strength routine and the best stretching routine. */
export const DEFAULT_ROUTINES = ['mcgill-big-3', 'yoga-back'];

export const libraryRoutine = id => ROUTINE_LIBRARY.find(r => r.id === id);
