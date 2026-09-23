import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Node natywnie zdejmuje adnotacje typów, ale nie rozumie
    // rozwiązywania modułów `nodenext` (`./x.js` -> `./x.ts`), którego
    // używa wygenerowany klient Prismy — stąd tsx, nie goły `node`.
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
