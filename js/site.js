'use strict';
const controls = document.querySelector('.pub-controls');
const papers = [...document.querySelectorAll('.publication')];
const buttons = [...document.querySelectorAll('[data-filter]')];
const year = document.querySelector('#publication-year');
const search = document.querySelector('#publication-search');
const count = document.querySelector('#publication-count');
const empty = document.querySelector('#no-results');
if (controls && year && search && count && empty) {
  let category = 'all';
  const searchText = new Map(papers.map(paper => [paper, paper.textContent.toLowerCase()]));
  function filterPublications() {
    const terms = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    let visible = 0;
    papers.forEach(paper => {
      const matches = (category === 'all' || paper.dataset.category === category) &&
        (year.value === 'all' || paper.dataset.year === year.value) &&
        terms.every(term => searchText.get(paper).includes(term));
      paper.hidden = !matches;
      if (matches) visible++;
    });
    document.querySelectorAll('.year-group').forEach(group => {
      const shown = group.querySelectorAll('.publication:not([hidden])').length;
      group.hidden = shown === 0;
      group.querySelector('.year-heading span').textContent = `${shown} ${shown === 1 ? 'paper' : 'papers'}`;
    });
    empty.hidden = visible > 0;
    count.textContent = `${visible} of ${papers.length} publications`;
  }
  buttons.forEach(button => button.addEventListener('click', () => {
    category = button.dataset.filter;
    buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    filterPublications();
  }));
  year.addEventListener('change', filterPublications);
  search.addEventListener('input', filterPublications);
  controls.hidden = false;
  filterPublications();
}
