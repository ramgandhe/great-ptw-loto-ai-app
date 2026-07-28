export const routes = {
  root: "/",
  login: "/login",
  home: "/(app)/(tabs)",
  settings: "/(app)/(tabs)/settings",
} as const;

export const tabItems = [
  { name: "index" as const, title: "Home", href: routes.home },
  { name: "settings" as const, title: "Settings", href: routes.settings },
];
