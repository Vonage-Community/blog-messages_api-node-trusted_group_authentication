let phone = document.querySelector('#phone');
let username = document.querySelector('#username');
let feedback = document.querySelector('#feedback');

// INVITE FORM
let invite_btn = document.querySelector('#invite_btn');
if (invite_btn) {
  invite_btn.onclick = function(e) {
    e.preventDefault();
    let body = JSON.stringify({
      phone: phone.value,
      username: username.value
    });
    goFetch('/invite', body, e.target);
    return false;
  };
}

// SIGNUP FORM
let signup_btn = document.querySelector('#signup_btn');
if (signup_btn) {
  signup_btn.onclick = function(e) {
    e.preventDefault();
    let body = JSON.stringify({
      phone: phone.value,
      username: username.value,
      pin: document.querySelector('#pin').value
    });
    goFetch('/login', body, e.target);
    return false;
  };
}

function goFetch(url, body, btn) {
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: body
  })
  .then(response => response.json())
  .then(data => {
    feedback.innerText = data.message || 'Thank you!';
    btn.style.display = 'none';
  });
}
