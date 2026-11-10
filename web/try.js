// The try page's phone: the app is laid out at a real iPhone's width and scaled to fit the frame, and the status
// bar takes its colours from whichever look the app is in.
addEventListener('DOMContentLoaded', () => {
  const phone = document.querySelector('.phone'), screen = phone.querySelector('.screen');
  const device = phone.querySelector('.device'), frame = phone.querySelector('iframe');
  const fit = () => { device.style.transform = `scale(${screen.clientWidth / 402})`; };
  fit();
  addEventListener('resize', fit);
  frame.addEventListener('load', () => {
    const root = frame.contentDocument?.documentElement;
    if (!root) return;
    const sync = () => { phone.dataset.app = root.dataset.theme === 'light' ? 'light' : 'dark'; };
    sync();
    new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  });
});
