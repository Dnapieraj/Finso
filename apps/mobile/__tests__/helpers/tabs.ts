import { screen } from "expo-router/testing-library";

// The tab bar exposes each tab as a button labelled "Start, tab, 1 of 2" —
// what VoiceOver reads — rather than as role "tab".
const tabName = (name: string) => new RegExp(`^${name}, tab,`);

/** The tab bar item called `name`. */
export const getTab = (name: string) => screen.getByRole("button", { name: tabName(name) });
/** Waits for the tab bar item called `name`. */
export const findTab = (name: string) => screen.findByRole("button", { name: tabName(name) });
/** The tab bar item called `name`, or null. */
export const queryTab = (name: string) => screen.queryByRole("button", { name: tabName(name) });
