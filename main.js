// Scroll fade-in animation
const observer = new IntersectionObserver(
  (entries) => entries.forEach(e => e.isIntersecting && e.target.classList.add('visible')),
  { threshold: 0.1 }
);

document.querySelectorAll('.timeline-card, .edu-card, .skill-group, .cert-card').forEach(el => {
  el.classList.add('fade-in');
  observer.observe(el);
});

// Active nav link highlight
const sections = document.querySelectorAll('section[id], header[id]');
const navLinks = document.querySelectorAll('nav ul a[href^="#"]');

const sectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(a => a.style.color = '');
        const active = document.querySelector(`nav ul a[href="#${entry.target.id}"]`);
        if (active) active.style.color = '#6366f1';
      }
    });
  },
  { rootMargin: '-40% 0px -55% 0px' }
);

sections.forEach(s => sectionObserver.observe(s));
