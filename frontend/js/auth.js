
const API_BASE_URL = 'http://127.0.0.1:8000';
async function handleAuth(endpoint) {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const messageDiv = document.getElementById('message');
    messageDiv.style.color = "blue";
    messageDiv.innerText = "Sending request...";
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email,
                password: password
            })
        });
        const result = await response.json();
        if (!response.ok) {
            messageDiv.style.color = "red";
            messageDiv.innerText = "Error: " + (result.detail || JSON.stringify(result));
            return;
        }
        messageDiv.style.color = "green";
        messageDiv.innerText = "Success: " + JSON.stringify(result);
        if (result.access_token) {
            localStorage.setItem('access_token', result.access_token);
            messageDiv.innerText += "\n(Token saved to localStorage!)";
        }
    } catch (err) {
        messageDiv.style.color = "red";
        messageDiv.innerText = "Network / Server Error: " + err.message;
    }
}
async function testDashboard() {
    const messageDiv = document.getElementById('message');
    const token = localStorage.getItem('access_token');
    if (!token) {
        messageDiv.style.color = "red";
        messageDiv.innerText = "No token found! Please log in first.";
        return;
    }
    try {
        const response = await fetch(`${API_BASE_URL}/api/dashboard`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const result = await response.json();
        messageDiv.style.color = response.ok ? "green" : "red";
        messageDiv.innerText = "Dashboard response: " + JSON.stringify(result);
    } catch (err) {
        messageDiv.style.color = "red";
        messageDiv.innerText = "Error fetching dashboard: " + err.message;
    }
}
