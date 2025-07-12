import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";
import { taskRouter } from "@/server/api/routers/task";
import { projectRouter } from "@/server/api/routers/project";
import { noteRouter } from "@/server/api/routers/note";
import { journalRouter } from "@/server/api/routers/journal";
import { tagRouter } from "@/server/api/routers/tag";
import { searchRouter } from "@/server/api/routers/search";
import { schedulerRouter } from "@/server/api/routers/scheduler";
import { userSettingsRouter } from "@/server/api/routers/user-settings";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  task: taskRouter,
  project: projectRouter,
  note: noteRouter,
  journal: journalRouter,
  tag: tagRouter,
  search: searchRouter,
  scheduler: schedulerRouter,
  userSettings: userSettingsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
