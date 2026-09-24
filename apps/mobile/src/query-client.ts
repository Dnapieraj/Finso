import { QueryClient } from "@tanstack/react-query";

/** The app's single query cache; cleared when the session ends. */
export const queryClient = new QueryClient();
