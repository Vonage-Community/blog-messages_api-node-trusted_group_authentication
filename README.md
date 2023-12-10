
# Trusted Group Authentication with SMS and Express

This app allows an admin to invite new users via SMS text message. Users can sign up with a username and temporary PIN.

## How it Works

1. Admin invites a phone number by submitting it on the website.

2. The app texts the user asking them to reply with a code phrase. 

3. When the user replies correctly, the app texts them a temporary PIN.

4. The user signs up on the website by entering their phone number, PIN, and a username.

5. The app verifies their PIN matches and creates an account, deleting the phone number.

6. The user is now logged in without exposing their personal phone number!

## Technologies

- Node.js + Express backend
- SQLite database 
- Vonage Messages and Verify APIs
- HTML/CSS/JS frontend

## Running Locally

1. Clone this repo
2. Install dependencies with `npm install`
3. Configure your Vonage APIs and `.env`
4. Start the server with `npm start`
5. View in browser at `http://localhost:{port}`