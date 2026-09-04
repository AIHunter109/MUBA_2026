# Welcome to your Expo app 👋

Project development is tracked in [plan.md](plan.md). Phase 0 integration findings and open decisions are recorded in [docs/phase-0-integration-decisions.md](docs/phase-0-integration-decisions.md).

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the API in a second terminal. It provides the Sui balance and transfer endpoints used by
   the app.

   ```bash
   npm.cmd run server
   ```

3. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Backend setup (once per machine)

The app talks to a separate Node API in `server/`. It needs its own env files (not committed - copy the `.example` ones) and a local SQLite database.

1. Copy the env templates and fill in real values (Gonka key, etc; the DB settings already work as-is):
   ```bash
   cp .env.example .env.local
   cp server/.env.example server/.env
   cp prisma/.env.example prisma/.env
   ```
2. Install dependencies (this also runs `prisma generate`):
   ```bash
   npm install
   ```
3. In one terminal, start the API. This applies any pending database migrations automatically before it boots:
   ```bash
   npm run server
   ```
4. In another terminal, start the app:
   ```bash
   npx expo start
   ```

If you ever see a Prisma error like `The table main.X does not exist`, it means `prisma/.env` is missing or the database migrations were never applied - `npm run server` fixes that on its own next run, or run `npm run db:deploy` directly.

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To  learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions. 
