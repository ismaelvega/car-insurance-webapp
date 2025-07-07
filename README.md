# Car Insurance Webapp

This project was created for **Banorte's 2025 Hackathon**. It is a Next.js application that allows authenticated users to manage car insurance information by uploading CSV files to Supabase. The app provides a dashboard with various filters and supports different user roles.

## Features

- **Next.js 15** with **React 19** and **Tailwind CSS**
- Authentication and storage powered by **Supabase**
- Role based access for `admin` and `alianza` users
- Dashboard to search, filter and sort insurance data
- Upload CSV files (`auto`, `renovaciones` and `validaciones` tables) with preview before saving
- Alerts for expiring or expired policies

## Getting Started

1. Install dependencies

   ```bash
   npm install
   ```

2. Create a `.env.local` file with your Supabase credentials:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=<your-url>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
   ```

3. Start the development server

   ```bash
   npm run dev
   ```

Other useful commands:

```bash
npm run build    # build for production
npm start        # start the production build
npm run lint     # run Next.js linting
```

Open <http://localhost:3000> to see the application.

## Project Structure

- `app/` – Next.js pages, dashboard and components
- `app/api/` – API routes used to process and upload CSV files
- `utils/` – Supabase client and admin helpers

The data is stored in Supabase tables called `auto`, `renovaciones` and `validaciones`.

## Learn More

For more information on the underlying framework see the [Next.js documentation](https://nextjs.org/docs) and the [Supabase documentation](https://supabase.com/docs).
