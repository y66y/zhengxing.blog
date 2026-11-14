'use strict';
const controls = document.querySelector('.pub-controls');
const papers = [...document.querySelectorAll('.publication')];
const buttons = [...document.querySelectorAll('[data-filter]')];
const year = document.querySelector('#publication-year');
const count = document.querySelector('#publication-count');
if (controls && year && count) {
  let category = 'all';
  function filterPublications() {
    let visible = 0;
    papers.forEach(paper => {
      const matches = (category === 'all' || paper.dataset.category === category) &&
        (year.value === 'all' || paper.dataset.year === year.value);
      paper.hidden = !matches;
      if (matches) visible++;
    });
    count.textContent = `${visible} of ${papers.length} selected publications`;
  }
  buttons.forEach(button => button.addEventListener('click', () => {
    category = button.dataset.filter;
    buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    filterPublications();
  }));
  year.addEventListener('change', filterPublications);
  controls.hidden = false;
  filterPublications();
}
