    const form = document.getElementById('location-form');
    const addressInput = document.getElementById('address-input');
    const suggestionsContainer = document.getElementById('suggestions-container');

    // Get CSRF token from form
    const csrftoken = document.querySelector('[name=csrfmiddlewaretoken]').value;

    // Example: AJAX suggestion fetch
    addressInput.addEventListener('input', async () => {
        const query = addressInput.value.trim();
        if (!query) {
            suggestionsContainer.innerHTML = '';
            return;
        }

        try {
            const response = await fetch("{% url 'address_suggestions' %}", {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken
                },
                body: JSON.stringify({ query })
            });
            const data = await response.json();
            
            // Show suggestions
            suggestionsContainer.innerHTML = data.suggestions.map(s => `<div class="suggestion-item">${s}</div>`).join('');
        } catch (err) {
            console.error(err);
        }
    });

    // Optional: AJAX form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const body = new URLSearchParams(formData);

        try {
            const response = await fetch(form.action, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': csrftoken
                },
                body: body
            });
            const data = await response.json();
            console.log(data); // handle result
        } catch (err) {
            console.error(err);
        }
    });

    // Optional: click suggestion to fill input
    suggestionsContainer.addEventListener('click', e => {
        if (e.target.classList.contains('suggestion-item')) {
            addressInput.value = e.target.textContent;
            suggestionsContainer.innerHTML = '';
        }
    });