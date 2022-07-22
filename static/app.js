import e from './e.js';

async function loadQuery() {
  const res = await fetch('/query');
  const text = await res.text();
  e('json', {}, text);
}

async function update() {
  const key = e('key').value;
  const value = e('value').value;
  e('update').disabled = true;
  e('update').innerHTML = 'Updating...';
  const response = await fetch(`/update/${key}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: value,
  });
  if (response.status != 200) {
    alert(
        `${response.status} ${response.statusText}: ${await response.text()}`);
  }
  e('update').innerHTML = 'Update';
  e('update').disabled = false;
  await loadQuery();
}

window.onload = async function() {
  e('update').onclick = update;
  await loadQuery();
};
