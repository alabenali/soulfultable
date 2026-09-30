# Soulful Table Reservation Site

A simple reservation website for the Soulful Table wellness/food/slow-living premium experience.

## Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js/Express with JSON file storage
- **Email**: Placeholder for Nodemailer/Resend integration

## Project Structure

```
/client          # Frontend React app
/server          # Backend Express API
/client/public/images   # Background images (to be replaced)
```

## Setup

### Frontend

```bash
cd client
npm install
npm run dev   # runs on http://localhost:3000
```

### Backend

```bash
cd server
npm install
# Copy .env.example to .env and fill in email credentials (optional)
cp .env.example .env
# Edit .env with your SMTP settings
npm start   # runs on http://localhost:5000
```

### Environment Variables

Create a `.env` file in `/server` based on `.env.example`:

- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`: SMTP configuration for sending confirmation emails.
- `EMAIL_FROM`: Sender address.
- `PORT`: Server port (default 5000).

If email credentials are not provided, the app will still store reservations but will not send emails.

## Features

- Home page with description and "S'inscrire" button
- Registration form with validation (nom, prénom, téléphone, adresse, email)
- Form submission to backend API (`POST /api/reservations`)
- Reservation stored in `server/reservations.json`
- Confirmation email sent (if email configured)
- Redirect to confirmation page showing success message and practical details placeholder
- Responsive design with mobile-first approach
- Background images per page with dark overlay for text readability
- Simple, elegant Mediterranean slow living aesthetic (earthy tones, serif fonts)

## Placeholders

Replace the following placeholders with actual content:

- In `client/src/pages/Home.jsx`: `[PLACEHOLDER — description à remplacer]`
- In `client/src/pages/Confirmation.jsx`: `[PLACEHOLDER — détails pratiques à remplacer]`
- Images in `client/public/images/`:
  - `hero-bg.jpg`
  - `form-bg.jpg`
  - `confirmation-bg.jpg`

## Notes

- The site is designed to be simple and easy to modify for non-developers.
- All text and images are clearly marked as placeholders.
- The backend uses a JSON file for storage; for production consider using a proper database.
- Form validation includes basic phone and email format checks.
- The design uses Tailwind CSS for easy customization of colors, spacing, etc.

## License

MIT