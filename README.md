# Soulful Table

Reservation website for the Soulful Table dining experience.

## Stack

- **Frontend**: React + Vite 8 + Tailwind CSS
- **Backend**: Node.js/Express
- **Database**: SQLite by default, or MySQL/MariaDB through XAMPP
- **Authentication**: Session-based admin login

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
# Copy .env.example to .env and configure the required secrets
copy .env.example .env
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

- Home page with the Soulful Table brand and reservation CTA
- Registration form with validation and payment selection
- Form submission to backend API (`POST /api/reservations`)
- Reservation stored in SQLite or MySQL
- Confirmation email sent if SMTP is configured
- Confirmation page with payment details and RIB for bank transfer
- Admin login and dashboard with search, status updates, and CSV export
- Responsive design with mobile-first approach
- Warm Mediterranean slow-living visual system with textured surfaces, serif headings, and responsive admin tables

## Validation

Build the frontend:

```bash
cd client
npm run build
```

Run API smoke tests while the backend is running:

```bash
cd server
npm run test:api
```

Set `TEST_ADMIN_PASSWORD` to include authenticated admin checks. Without it, those checks are reported as skipped.

## Dependency audit

The frontend dependency audit is clean after upgrading Vite and React Router. The backend audit is clean for runtime dependencies; npm may still report a transitive `tar` advisory from SQLite's native build tooling. It does not run as part of the application request path, but should be reviewed when changing the SQLite driver or build toolchain.

## License

MIT