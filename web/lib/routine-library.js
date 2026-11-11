// Routines with the strongest research behind them for back pain, offered in Routines › Browse. Two of them
// are where new diaries start (DEFAULT_ROUTINES). Each lists the studies behind it, checked on PubMed.
// Every move has a figure (checked in test/routine-library.test.js).

export const ROUTINE_LIBRARY = [
  {
    id: 'mcgill-big-3', name: 'McGill Big 3', kind: 'Strength', minutes: 10, often: 'Daily', cover: 'Bird dog',
    tagline: 'Three moves that build a steady, tireless core without loading your spine.',
    goodFor: 'Everyday back pain, and backs that tire or twinge when you lift, bend or stand for long.',
    research: 'Developed by spine researcher Stuart McGill from lab work on which exercises build core endurance with the least strain on the spine. Reviews of this kind of stabilising exercise find it eases pain and disability.',
    studies: [
      { name: 'McGill, Physical Therapy, 1998', size: 'Review of lab evidence', url: 'https://pubmed.ncbi.nlm.nih.gov/9672547/' },
      { name: 'Saragiotto, Cochrane Review, 2016', size: '29 trials, 2,431 people', url: 'https://pubmed.ncbi.nlm.nih.gov/26742533/' },
    ],
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
    research: 'Weekly yoga eased chronic low back pain as well as physical therapy, and better than a self-care book. A Cochrane review found it helps people move and get on with their day.',
    studies: [
      { name: 'Saper, Annals of Internal Medicine, 2017', size: '320 adults', url: 'https://pubmed.ncbi.nlm.nih.gov/28631003/' },
      { name: 'Sherman, Archives of Internal Medicine, 2011', size: '228 adults', url: 'https://pubmed.ncbi.nlm.nih.gov/22025101/' },
      { name: 'Wieland, Cochrane Review, 2022', size: '21 trials, 2,223 people', url: 'https://pubmed.ncbi.nlm.nih.gov/36398843/' },
    ],
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
    research: 'Part of the McKenzie method, one of the most used approaches in physiotherapy. A review of trials found it eases pain and disability in the first week compared with passive treatment. It suits people whose pain settles when they bend backwards.',
    studies: [
      { name: 'Machado, Spine, 2006', size: '11 trials', url: 'https://pubmed.ncbi.nlm.nih.gov/16641766/' },
    ],
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
    research: 'A classic program used by physiotherapists since the 1930s. There are few modern trials of it on its own, but a Cochrane review of 249 trials found exercise of almost any kind eases chronic low back pain. It suits people whose pain clearly eases when they bend forward.',
    studies: [
      { name: 'Hayden, Cochrane Review, 2021', size: '249 trials', url: 'https://pubmed.ncbi.nlm.nih.gov/34580864/' },
    ],
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
    research: 'Motor control exercise eases pain and disability compared with doing little, and works about as well as other exercise.',
    studies: [
      { name: 'Saragiotto, Cochrane Review, 2016', size: '29 trials, 2,431 people', url: 'https://pubmed.ncbi.nlm.nih.gov/26742533/' },
    ],
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
    research: 'Pilates eases pain and improves function compared with doing little. The trials were small, so the effect could change as more are done.',
    studies: [
      { name: 'Yamato, Cochrane Review, 2015', size: '10 trials, 510 people', url: 'https://pubmed.ncbi.nlm.nih.gov/26133923/' },
    ],
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
    research: 'Weak hips are common in people with back pain. In a trial of core work with or without hip strengthening, both groups had clearly less pain after six weeks. Hip work didn\'t add extra relief on top, so it works best alongside core exercise.',
    studies: [
      { name: 'Kendall, Journal of Science and Medicine in Sport, 2015', size: '80 adults', url: 'https://pubmed.ncbi.nlm.nih.gov/25467200/' },
      { name: 'Searle, Clinical Rehabilitation, 2015', size: '39 trials', url: 'https://pubmed.ncbi.nlm.nih.gov/25681408/' },
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
  {
    id: 'strength-training', name: 'Strength training', kind: 'Strength', minutes: 40, often: '2 to 3 times a week', cover: 'Romanian deadlift',
    tagline: 'Lifting with good form builds a back that can handle real life.',
    goodFor: 'Recurring back pain in people who want to stay active, lift or get back to the gym.',
    research: 'A review of trials found strength training among the most helpful exercise for chronic low back pain. In a deadlift trial, people with recurring back pain had less pain after eight weeks, as much as with gentler control exercises.',
    studies: [
      { name: 'Searle, Clinical Rehabilitation, 2015', size: '39 trials', url: 'https://pubmed.ncbi.nlm.nih.gov/25681408/' },
      { name: 'Aasa, Journal of Orthopaedic and Sports Physical Therapy, 2015', size: '70 adults', url: 'https://pubmed.ncbi.nlm.nih.gov/25641309/' },
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
    id: 'walking', name: 'Walking program', kind: 'Activity', minutes: 30, often: '5 days a week', cover: 'Brisk walk',
    tagline: 'Regular walks that keep back pain from coming back.',
    goodFor: 'Anyone recovering from a bout of back pain who wants to keep it away.',
    research: 'A walking program with some coaching nearly doubled the time people went before their back pain came back, from 112 days to 208.',
    studies: [
      { name: 'Pocovi, The Lancet, 2024', size: '701 adults', url: 'https://pubmed.ncbi.nlm.nih.gov/38908392/' },
    ],
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
    research: 'A 12-week stretching class worked as well as yoga for chronic low back pain, and both beat a self-care book.',
    studies: [
      { name: 'Sherman, Archives of Internal Medicine, 2011', size: '228 adults', url: 'https://pubmed.ncbi.nlm.nih.gov/22025101/' },
    ],
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
