// Screen switcher: each <section class="screen" data-title="..."> becomes a nav button.
const screens = [...document.querySelectorAll('.screen')]
const nav = document.getElementById('nav')
function show(id) {
  screens.forEach((s) => s.classList.toggle('active', s.id === id))
  ;[...nav.children].forEach((b) => b.setAttribute('aria-current', String(b.dataset.id === id)))
  history.replaceState(null, '', '#' + id)
}
screens.forEach((s) => {
  const b = document.createElement('button')
  b.textContent = s.dataset.title
  b.dataset.id = s.id
  b.onclick = () => show(s.id)
  nav.appendChild(b)
})
if (screens.length) show(location.hash.slice(1) || screens[0].id)
